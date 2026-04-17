// Shared validation edge function. Called by both the partner upload dialog (after
// the partner client has uploaded the file) and by the student-application function
// (immediately after its internal upload). Same code path, same output shape.
//
// Inputs (JSON):
//   { lead_document_id: string }   // required — points to a row already in lead_documents
//
// Behavior:
//   1. Loads the lead_documents row + linked document_master + linked student_lead.
//   2. Downloads the file from the lead-documents storage bucket.
//   3. Extracts text (PDF in Phase 1; images return "inconclusive").
//   4. Applies type rules + name-match.
//   5. Writes the result to lead_documents.validation_result.
//   6. Returns the result + a soft_block flag.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractTextFromUpload } from "../_shared/validation/extractText.ts";
import { decide, shouldSoftBlock } from "../_shared/validation/decide.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const leadDocumentId = body?.lead_document_id;
    if (!leadDocumentId || typeof leadDocumentId !== "string") {
      return jsonResponse({ error: "Missing lead_document_id" }, 400);
    }

    // Load the document row + its document_master + parent lead
    const { data: doc, error: docErr } = await supabase
      .from("lead_documents")
      .select("id, lead_id, document_type_id, mime_type, storage_path, document_master:document_type_id(document_code, applicable_for)")
      .eq("id", leadDocumentId)
      .single();

    if (docErr || !doc) {
      return jsonResponse({ error: docErr?.message || "Document not found" }, 404);
    }

    if (!doc.storage_path) {
      return jsonResponse({ error: "Document has no storage path" }, 400);
    }

    const { data: lead, error: leadErr } = await supabase
      .from("student_leads")
      .select("student_full_name, student_first_name, student_last_name, coapplicant_name")
      .eq("id", doc.lead_id)
      .single();

    if (leadErr || !lead) {
      return jsonResponse({ error: leadErr?.message || "Lead not found" }, 404);
    }

    // Download the file
    const { data: fileBlob, error: dlErr } = await supabase.storage
      .from("lead-documents")
      .download(doc.storage_path);

    if (dlErr || !fileBlob) {
      return jsonResponse({ error: dlErr?.message || "Could not download file" }, 500);
    }

    const buf = new Uint8Array(await fileBlob.arrayBuffer());
    const mime = doc.mime_type || fileBlob.type || "application/octet-stream";

    const extraction = await extractTextFromUpload(buf, mime);

    const docCode = (doc as any).document_master?.document_code ?? null;
    const applicableFor = (doc as any).document_master?.applicable_for ?? null;
    const studentName = lead.student_full_name
      || [lead.student_first_name, lead.student_last_name].filter(Boolean).join(" ").trim()
      || null;

    const result = decide({
      documentCode: docCode,
      extractedText: extraction.text,
      extractionMethod: extraction.method,
      extractionError: extraction.error,
      studentName,
      coapplicantName: lead.coapplicant_name ?? null,
      applicableFor,
    });

    // Persist
    const { error: updErr } = await supabase
      .from("lead_documents")
      .update({ validation_result: result })
      .eq("id", leadDocumentId);

    if (updErr) {
      console.error("[validate-document] persist error", updErr);
    }

    return jsonResponse({
      validation_result: result,
      soft_block: shouldSoftBlock(result, docCode),
    });
  } catch (err) {
    console.error("[validate-document] error", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

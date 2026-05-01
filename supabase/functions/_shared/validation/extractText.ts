// PDF + image text extraction with Gemini OCR fallback.
//
// Path 1 (unchanged): PDFs with an embedded text layer go through `unpdf`.
// Path 2 (new):       PDFs with empty extracted text fall through to Lovable AI
//                     Gateway (Gemini) OCR using the raw PDF bytes.
// Path 3 (new):       image/* uploads go directly to Gemini OCR.
//
// If the OCR fallback fails or returns empty, we return the same shape the
// caller has always handled (`success: false`) so existing decide.ts behavior
// (review_needed for strict-tier docs) is preserved exactly.

import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

export interface ExtractionOutput {
  method: "pdf_text" | "ocr_gemini" | "skipped_image_phase1" | "none";
  text: string;
  success: boolean;
  error: string | null;
}

const OCR_PROMPT = "Extract ALL visible text from this document exactly as it appears. " +
  "Include headers, footers, numbers, IDs, names, dates, and any non-English text " +
  "(e.g. Hindi/Devanagari) verbatim. Output plain text only — no commentary, no markdown.";

const OCR_MODEL = "google/gemini-2.5-flash";
const OCR_TIMEOUT_MS = 25_000;

function uint8ToBase64(bytes: Uint8Array): string {
  // Chunked encoder to avoid call-stack overflow on large files.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // btoa is available in the Deno runtime used by Supabase edge functions.
  return btoa(binary);
}

async function ocrViaGemini(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ text: string; error: string | null }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return { text: "", error: "LOVABLE_API_KEY not configured" };
  }

  let base64: string;
  try {
    base64 = uint8ToBase64(bytes);
  } catch (e) {
    return { text: "", error: e instanceof Error ? e.message : String(e) };
  }
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OCR_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: OCR_PROMPT },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { text: "", error: `Gemini OCR HTTP ${resp.status}: ${body.slice(0, 200)}` };
    }

    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content;
    const merged = (typeof text === "string" ? text : "")
      .replace(/\s+/g, " ")
      .trim();
    return { text: merged, error: merged.length === 0 ? "OCR returned empty text" : null };
  } catch (err) {
    return { text: "", error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractTextFromUpload(
  fileBytes: Uint8Array,
  mimeType: string,
): Promise<ExtractionOutput> {
  // ---- image/* path: go straight to OCR ----
  if (mimeType.startsWith("image/")) {
    const ocr = await ocrViaGemini(fileBytes, mimeType);
    if (ocr.text.length > 0) {
      return { method: "ocr_gemini", text: ocr.text, success: true, error: null };
    }
    // OCR failed/empty → preserve previous semantics (image phase 1 skipped → inconclusive).
    return {
      method: "skipped_image_phase1",
      text: "",
      success: false,
      error: ocr.error,
    };
  }

  if (mimeType !== "application/pdf") {
    return { method: "none", text: "", success: false, error: `Unsupported mime: ${mimeType}` };
  }

  // ---- PDF path: existing unpdf extraction unchanged ----
  let pdfText = "";
  let pdfError: string | null = null;
  try {
    const pdf = await getDocumentProxy(fileBytes);
    const { text } = await extractText(pdf, { mergePages: true });
    pdfText = (Array.isArray(text) ? text.join("\n") : text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (pdfText.length === 0) {
      pdfError = "No extractable text (likely scanned PDF)";
    }
  } catch (err) {
    pdfError = err instanceof Error ? err.message : String(err);
  }

  if (pdfText.length > 0) {
    // Embedded text layer present — original behavior, untouched.
    return { method: "pdf_text", text: pdfText, success: true, error: null };
  }

  // ---- PDF had no extractable text → OCR fallback ----
  const ocr = await ocrViaGemini(fileBytes, "application/pdf");
  if (ocr.text.length > 0) {
    return { method: "ocr_gemini", text: ocr.text, success: true, error: null };
  }

  // OCR also failed → preserve previous failure shape so decide.ts produces the
  // same review_needed outcome it does today for strict-tier docs.
  return {
    method: "pdf_text",
    text: "",
    success: false,
    error: ocr.error ? `${pdfError ?? "pdf empty"}; ocr: ${ocr.error}` : pdfError,
  };
}

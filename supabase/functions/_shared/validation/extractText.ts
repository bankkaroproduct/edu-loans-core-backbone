// PDF text extraction. Phase 1: PDF only. Images return "skipped" so caller produces "inconclusive".
//
// We use `unpdf` which is a Deno-native PDF text extractor (serverless build of pdf.js).
// `npm:` specifier is preferred over esm.sh for stability in edge-runtime.

import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

export interface ExtractionOutput {
  method: "pdf_text" | "skipped_image_phase1" | "none";
  text: string;
  success: boolean;
  error: string | null;
}

export async function extractTextFromUpload(
  fileBytes: Uint8Array,
  mimeType: string,
): Promise<ExtractionOutput> {
  if (mimeType.startsWith("image/")) {
    return { method: "skipped_image_phase1", text: "", success: false, error: null };
  }

  if (mimeType !== "application/pdf") {
    return { method: "none", text: "", success: false, error: `Unsupported mime: ${mimeType}` };
  }

  try {
    const pdf = await getDocumentProxy(fileBytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = (Array.isArray(text) ? text.join("\n") : text || "")
      .replace(/\s+/g, " ")
      .trim();
    return {
      method: "pdf_text",
      text: merged,
      success: merged.length > 0,
      error: merged.length === 0 ? "No extractable text (likely scanned PDF)" : null,
    };
  } catch (err) {
    return {
      method: "pdf_text",
      text: "",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

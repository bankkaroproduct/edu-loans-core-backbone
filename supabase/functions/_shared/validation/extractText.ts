// PDF text extraction using pdfjs-serverless (Deno-friendly fork of pdf.js).
// Phase 1: PDF only. Images return a "skipped" result so the caller can produce
// a consistent "inconclusive" flag.

// Using esm.sh for Deno compatibility
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.5.0";

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
  // Images — Phase 1 doesn't OCR them
  if (mimeType.startsWith("image/")) {
    return {
      method: "skipped_image_phase1",
      text: "",
      success: false,
      error: null,
    };
  }

  if (mimeType !== "application/pdf") {
    return {
      method: "none",
      text: "",
      success: false,
      error: `Unsupported mime: ${mimeType}`,
    };
  }

  try {
    const loadingTask = getDocument({
      data: fileBytes,
      // Disable worker (not needed in Deno) and font/image fetches
      disableFontFace: true,
      useSystemFonts: false,
    });
    const pdf = await loadingTask.promise;
    const parts: string[] = [];
    const maxPages = Math.min(pdf.numPages, 10); // Cap at first 10 pages — keeps latency low
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ");
      parts.push(pageText);
    }
    const text = parts.join("\n").replace(/\s+/g, " ").trim();
    return {
      method: "pdf_text",
      text,
      success: text.length > 0,
      error: text.length === 0 ? "No extractable text (likely scanned PDF)" : null,
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

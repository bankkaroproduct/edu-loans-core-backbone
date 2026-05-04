/**
 * User-facing lender code display helper.
 *
 * Narrowly fixes the Credila/HDFC display issue: the lender record stores
 * lender_code = "HDFC" for the lender named "Credila" (legacy code, must
 * not be changed in DB). When showing the code as a subtitle to end users,
 * "HDFC" under "Credila" is misleading.
 *
 * This helper hides the code ONLY for that specific Credila/HDFC mismatch.
 * For every other lender, the code is returned unchanged so subtitles like
 * BOB, SBI, AXIS, AVANSE, INCRED, etc. remain visible exactly as today.
 *
 * Internal screens (BRE rule editor, technical config) should continue to
 * read `lender_code` directly — this helper is for user-facing displays only.
 */
export function displayLenderCode(
  lenderName: string | null | undefined,
  lenderCode: string | null | undefined,
): string | null {
  if (!lenderCode) return null;
  const name = (lenderName ?? "").trim().toLowerCase();
  const code = lenderCode.trim().toUpperCase();
  // Specific carve-out: Credila is internally coded HDFC. Hide the code subtitle.
  if (name === "credila" && code === "HDFC") return null;
  return lenderCode;
}

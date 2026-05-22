/**
 * Local color tokens for the redesigned lender-match cards.
 *
 * Intentionally NOT wired into the global Tailwind theme — these are
 * presentation-only constants for the /student/recommendations surface
 * so palette tweaks are a one-file change and don't affect other pages.
 *
 * Reference these from JSX via inline style or `bg-[${T.primary}]`-style
 * Tailwind arbitrary classes. Do not import elsewhere.
 */
export const T = {
  // Brand
  primary: "#0036DA",
  primaryHover: "#2C40AA",
  primaryBgSoft: "#F7F9FF",

  // Accents
  accentOrange: "#FF6D1D",
  peachBg: "#FFF5ED",

  // Semantic
  successText: "#117A3A",
  successBg: "#E4F7EC",
  errorText: "#B0190B",
  errorBg: "#FDE8E5",

  // Neutrals
  text: "#262626",
  textSecondary: "#5C5C5C",
  textTertiary: "#9A9A9A",
  hairline: "#F1F1F1",
  screenBg: "#F5F7F9",
  ineligibleBg: "#FBFBFC",
  headerStripFrom: "#F7F9FF",
  headerStripTo: "#FFFFFF",
  headerStripIneligibleFrom: "#F1F1F1",
  headerStripIneligibleTo: "#FBFBFC",
} as const;

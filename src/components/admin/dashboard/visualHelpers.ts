// Pure presentational helpers for the admin dashboard.
// No state, no fetching, no business logic.

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

const AVATAR_PALETTE = [
  "#0036DA",
  "#FF6D1D",
  "#26A651",
  "#9747FF",
  "#DA2760",
  "#2C40AA",
  "#44C194",
  "#E5A800",
];

export const avatarColor = (name: string): string => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
};

export const partnerColor = (name: string): string => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(h) % 360}, 55%, 48%)`;
};

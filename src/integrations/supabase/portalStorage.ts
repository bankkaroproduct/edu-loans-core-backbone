/**
 * Portal-scoped Supabase auth storage.
 *
 * Problem: Admin, Partner, and Student portals share a single Supabase
 * client (single `storage: localStorage`, single default key
 * `sb-<ref>-auth-token`). Signing in to one portal in Tab B overwrites
 * the token Tab A is using → Tab A's next read sees the wrong session
 * and the guards boot the user.
 *
 * Fix: Patch Storage.prototype.{getItem,setItem,removeItem,key} so any
 * access to a Supabase auth key (`sb-<ref>-...`) is transparently
 * rewritten to a portal-namespaced key (`sb-<ref>-<portal>-...`).
 * Each tab's portal is decided ONCE from its URL at module load and
 * stays fixed for the tab's lifetime, so Admin tab persists to one
 * key, Partner tab to another, Student tab to a third — no collision,
 * no cross-tab storage-event interference.
 *
 * Imported as the first line of `src/main.tsx` so the prototype patch
 * is in place before `client.ts` is evaluated transitively.
 *
 * Non-Supabase keys pass through unchanged.
 */

type Portal = "admin" | "partner" | "student";

function detectPortal(): Portal {
  if (typeof window === "undefined") return "partner";
  const path = window.location.pathname || "/";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/student")) return "student";
  return "partner";
}

const PROJECT_REF =
  (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_SUPABASE_PROJECT_ID ?? "";

// Match any Supabase auth-related key for this project ref:
//   sb-<ref>-auth-token
//   sb-<ref>-auth-token-code-verifier
//   sb-<ref>-auth-token.0 / .1   (chunked sessions)
const PREFIX = PROJECT_REF ? `sb-${PROJECT_REF}-` : "sb-";
const PORTAL = detectPortal();
const NAMESPACE = `${PORTAL}-`;

function shouldRewrite(key: string): boolean {
  if (!key.startsWith(PREFIX)) return false;
  // Already namespaced — leave alone (defensive; shouldn't happen).
  const rest = key.slice(PREFIX.length);
  if (
    rest.startsWith("admin-") ||
    rest.startsWith("partner-") ||
    rest.startsWith("student-")
  ) {
    return false;
  }
  return true;
}

function rewriteKey(key: string): string {
  return PREFIX + NAMESPACE + key.slice(PREFIX.length);
}

// Idempotency guard — Vite HMR can re-evaluate modules.
const FLAG = "__lovablePortalStoragePatched__";
type PatchedStorage = Storage & { [FLAG]?: boolean };

function patch(storage: PatchedStorage | undefined) {
  if (!storage) return;
  const proto = Object.getPrototypeOf(storage) as PatchedStorage;
  if (proto[FLAG]) return;
  proto[FLAG] = true;

  const origGet = proto.getItem;
  const origSet = proto.setItem;
  const origRemove = proto.removeItem;

  proto.getItem = function (key: string) {
    return origGet.call(this, shouldRewrite(key) ? rewriteKey(key) : key);
  };
  proto.setItem = function (key: string, value: string) {
    return origSet.call(this, shouldRewrite(key) ? rewriteKey(key) : key, value);
  };
  proto.removeItem = function (key: string) {
    return origRemove.call(this, shouldRewrite(key) ? rewriteKey(key) : key);
  };
}

if (typeof window !== "undefined") {
  try {
    patch(window.localStorage as PatchedStorage);
    patch(window.sessionStorage as PatchedStorage);
  } catch {
    // Storage may be unavailable (private mode, etc.) — supabase-js will
    // fall back to memory storage on its own; nothing to do here.
  }
}

export {};

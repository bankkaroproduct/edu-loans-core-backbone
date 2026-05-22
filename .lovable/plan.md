# Fix: Admin ↔ Partner login session conflict

## Root cause (confirmed)
1. `useAuth` exposes only `loading` + `user` + `appUser`. Guards (`AdminRoute`, `AppLayout`) read `user` and `appUser` independently, so there's a window where `user` is set but `appUser` is still `null` — guards flip the wrong way and redirect mid-flight.
2. Both login pages do `signInWithPassword` → `supabase.auth.getUser()` → query `users`. The `getUser()` round-trip occasionally returns the previous session id because in-memory session hasn't persisted yet — wrong profile is read, wrong rejection toast fires.
3. `onAuthStateChange` re-hydrates on every event including same-user `SIGNED_IN`/`TOKEN_REFRESHED`, causing skeleton flashes and intermediate `loading` states that the guards interpret as "not authenticated yet → bounce".
4. RLS on `public.users` is fine — `Users can view own profile (auth_user_id = auth.uid())` exists. No migration needed.

## Why the previous fix failed
It only swapped `navigate()` for `window.location.href`. The race between `user` being set and `appUser` arriving still exists, so on the post-redirect boot the guard still sees inconsistent state for a tick and bounces.

## Solution: status-driven atomic auth

Single `status: "initializing" | "anonymous" | "authenticated" | "unauthorized"` is the only thing guards read. `signIn(email, password, { expect: "admin" | "partner" })` is atomic: password → fetch profile by `data.user.id` (no `getUser()` round-trip) → validate role/active → set state synchronously. On role mismatch, `signOut` and return typed error.

`onAuthStateChange` ignores same-user re-emits (no skeleton flash on tab focus). `SIGNED_OUT` → `anonymous`. Other events → hydrate.

## Files to change (5)
1. **`src/hooks/useAuth.tsx`** — add `status`, atomic `signIn(..., { expect })`, harden listener, remove `getUser()` usage.
2. **`src/components/AdminRoute.tsx`** — gate purely on `status`; `initializing` → skeleton, `anonymous`/`unauthorized` → `/admin/login`, `authenticated` + not admin → `/`.
3. **`src/components/AppLayout.tsx`** — same pattern for partner side; `authenticated` + admin → `/admin`.
4. **`src/pages/Login.tsx`** — `LoginForm` calls `signIn(..., { expect: "partner" })`; keep username→email resolve; `window.location.assign("/")` on success.
5. **`src/pages/admin/AdminLogin.tsx`** — call `signIn(..., { expect: "admin" })`; `window.location.assign("/admin")` on success.

## Explicitly NOT touched
- `src/integrations/supabase/client.ts`
- RLS / migrations (already correct)
- AdminUsers page or any edge function
- Sidebar, layout chrome, AdminPermissions, partner context
- BRE / leads / payouts / documents
- Student auth (`useStudentAuth`)

## Why this fully fixes it
- One `status` value → no more "user set, profile not yet" window → no mis-redirect.
- `signIn` uses the id from the sign-in response → no stale `getUser()` race.
- Same-user auth events are ignored → no skeleton flash on focus, no bounce.
- Atomic role check inside `signIn` → admin creds on partner page are rejected and signed out before any state flips.
- Each portal is a pure function of `status` + `role` → no cross-portal interference.

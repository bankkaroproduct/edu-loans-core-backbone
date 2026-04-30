import { plugin } from "bun";

(globalThis as any).localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 };
(globalThis as any).window ??= { location: { origin: "http://localhost" } };

const supaMod = await import("/dev-server/node_modules/@supabase/supabase-js/dist/index.mjs");
const { createClient } = supaMod as any;
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

plugin({
  name: "bre-qa-shims",
  setup(build) {
    build.module("@/integrations/supabase/client", () => ({
      loader: "object",
      exports: { supabase: sb },
    }));
    build.module("@supabase/supabase-js", () => ({
      loader: "object",
      exports: supaMod,
    }));
    // Resolve @/ paths from project src for the QA script (which lives in /tmp).
    build.onResolve({ filter: /^@\/(.*)/ }, (args) => {
      const sub = args.path.replace(/^@\//, "");
      // Try common extensions.
      const candidates = [
        `/dev-server/src/${sub}`,
        `/dev-server/src/${sub}.ts`,
        `/dev-server/src/${sub}.tsx`,
        `/dev-server/src/${sub}/index.ts`,
      ];
      const fs = require("fs");
      for (const c of candidates) {
        try { if (fs.statSync(c).isFile()) return { path: c }; } catch {}
      }
      return undefined;
    });
  },
});

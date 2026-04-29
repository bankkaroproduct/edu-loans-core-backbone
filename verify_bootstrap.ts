(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
(globalThis as any).window = globalThis;
await import("./verify_bre.ts");

(globalThis as any).localStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
};
(globalThis as any).window = { location: { origin: "http://localhost" } };
await import("./bre-broad-qa");

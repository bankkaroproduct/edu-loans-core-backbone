import { describe, it, expect } from "vitest";
import { validateNumeric, sanitizeNumericInput } from "@/lib/numericValidation";

describe("validateNumeric", () => {
  it("treats blank as ok with null clean (optional fields stay optional)", () => {
    for (const k of ["integer", "decimal", "amount", "phone", "pincode", "year"] as const) {
      expect(validateNumeric(k, "")).toEqual({ ok: true, clean: null });
      expect(validateNumeric(k, null)).toEqual({ ok: true, clean: null });
      expect(validateNumeric(k, "   ")).toEqual({ ok: true, clean: null });
    }
  });

  it("blocks alphabets across all kinds", () => {
    for (const k of ["integer", "decimal", "amount", "phone", "pincode", "year"] as const) {
      expect(validateNumeric(k, "abc").ok).toBe(false);
      expect(validateNumeric(k, "wjjrjrj").ok).toBe(false);
      expect(validateNumeric(k, "82a").ok).toBe(false);
    }
  });

  it("integer accepts digits only", () => {
    expect(validateNumeric("integer", "82")).toEqual({ ok: true, clean: 82 });
    expect(validateNumeric("integer", "82.5").ok).toBe(false);
  });

  it("decimal accepts 7.5 / 82.5 / 8.25 and integers", () => {
    expect(validateNumeric("decimal", "7.5")).toEqual({ ok: true, clean: 7.5 });
    expect(validateNumeric("decimal", "82.5")).toEqual({ ok: true, clean: 82.5 });
    expect(validateNumeric("decimal", "82")).toEqual({ ok: true, clean: 82 });
    expect(validateNumeric("decimal", "8.25")).toEqual({ ok: true, clean: 8.25 });
    expect(validateNumeric("decimal", "1.2345").ok).toBe(false);
  });

  it("amount allows commas, returns cleaned number", () => {
    expect(validateNumeric("amount", "50,00,000")).toEqual({ ok: true, clean: 5000000 });
    expect(validateNumeric("amount", "5000000")).toEqual({ ok: true, clean: 5000000 });
    expect(validateNumeric("amount", "5,00,000.5").ok).toBe(false);
  });

  it("phone enforces 10 digits, tolerates +91 prefix", () => {
    expect(validateNumeric("phone", "9876543210")).toEqual({ ok: true, clean: "9876543210" });
    expect(validateNumeric("phone", "+91 98765 43210")).toEqual({ ok: true, clean: "9876543210" });
    expect(validateNumeric("phone", "12345").ok).toBe(false);
    expect(validateNumeric("phone", "98abc43210").ok).toBe(false);
  });

  it("pincode = 6 digits", () => {
    expect(validateNumeric("pincode", "560001")).toEqual({ ok: true, clean: "560001" });
    expect(validateNumeric("pincode", "56001").ok).toBe(false);
    expect(validateNumeric("pincode", "5600AB").ok).toBe(false);
  });

  it("year requires 4 digits in valid range", () => {
    expect(validateNumeric("year", "2026")).toEqual({ ok: true, clean: 2026 });
    expect(validateNumeric("year", "1999").ok).toBe(false);
    expect(validateNumeric("year", "20260").ok).toBe(false);
  });
});

describe("sanitizeNumericInput", () => {
  it("strips alphabets for integer/phone/pincode/year", () => {
    expect(sanitizeNumericInput("integer", "82abc")).toBe("82");
    expect(sanitizeNumericInput("phone", "+91 98abc 43210")).toBe("919843210");
    expect(sanitizeNumericInput("pincode", "560A0B01")).toBe("560001");
  });
  it("keeps a single dot for decimal", () => {
    expect(sanitizeNumericInput("decimal", "8.2.5abc")).toBe("8.25");
  });
  it("keeps commas for amount", () => {
    expect(sanitizeNumericInput("amount", "₹50,00,000")).toBe("50,00,000");
  });
});

import { describe, expect, it } from "vitest";
import { formatTraceInput } from "../displayLabels";
import type { ParameterTrace } from "../types";

function trace(partial: Partial<ParameterTrace>): ParameterTrace {
  return {
    bucket: "coapplicant",
    param_key: "employment_type",
    label: "Employment type",
    input: null,
    matched_band: null,
    weight: 15,
    band_score: 0,
    contribution: 0,
    ...partial,
  };
}

describe("formatTraceInput (display-only)", () => {
  it("renders employment_type enum with friendly override label", () => {
    expect(
      formatTraceInput(
        trace({
          input: "self_employed_business",
          matched_band: { value: "self_employed_business", score: 65, label: "Self-employed Business" },
        }),
      ),
    ).toBe("Business owner");

    expect(
      formatTraceInput(
        trace({
          input: "salaried_private",
          matched_band: { value: "salaried_private", score: 85, label: "Salaried (Private)" },
        }),
      ),
    ).toBe("Salaried - Private");

    expect(
      formatTraceInput(
        trace({
          input: "salaried_govt",
          matched_band: { value: "salaried_govt", score: 100, label: "Salaried (Govt / PSU)" },
        }),
      ),
    ).toBe("Salaried - Government");

    expect(
      formatTraceInput(
        trace({
          input: "self_employed_professional",
          matched_band: { value: "self_employed_professional", score: 75, label: "Self-employed Professional" },
        }),
      ),
    ).toBe("Self-employed professional");

    expect(
      formatTraceInput(
        trace({
          input: "retired_with_pension",
          matched_band: { value: "retired_with_pension", score: 55, label: "Retired (Pension)" },
        }),
      ),
    ).toBe("Retired");

    expect(
      formatTraceInput(
        trace({
          input: "unemployed",
          matched_band: { value: "unemployed", score: 10, label: "Unemployed" },
        }),
      ),
    ).toBe("Unemployed");
  });

  it("falls back to band label for other enum params without overrides", () => {
    expect(
      formatTraceInput(
        trace({
          param_key: "course_category",
          input: "management",
          matched_band: { value: "management", score: 80, label: "Management / Business" },
        }),
      ),
    ).toBe("Management / Business");
  });

  it("renders numeric inputs as-is", () => {
    expect(
      formatTraceInput(
        trace({
          param_key: "monthly_income",
          input: 69500,
          matched_band: { from: 40000, to: 74999.99, score: 65, label: "₹40K-75K" },
        }),
      ),
    ).toBe("69500");
  });

  it("renders em-dash for null / empty input without crashing", () => {
    expect(formatTraceInput(trace({ input: null }))).toBe("—");
    expect(formatTraceInput(trace({ input: "" }))).toBe("—");
    expect(formatTraceInput(trace({ input: undefined }))).toBe("—");
  });

  it("applies override even when band did not match (unknown variant)", () => {
    expect(
      formatTraceInput(
        trace({
          input: "self_employed_business",
          matched_band: null,
        }),
      ),
    ).toBe("Business owner");
  });
});

/**
 * Tests for src/problem/constraints/validation.ts
 *
 * Validates DomainRule and DomainRuleCatalogue structures.
 */

import { describe, expect, it } from "vitest";
import type {
  DomainRule,
  DomainRuleCatalogue,
} from "../../src/problem/constraints/contracts.js";
import {
  validateDomainRule,
  validateDomainRuleCatalogue,
} from "../../src/problem/constraints/validation.js";

function makeRule(overrides: Partial<DomainRule> = {}): DomainRule {
  return {
    id: "rule-1",
    description: "A test domain rule",
    arity: "unary",
    involvedEntityIds: ["d-1"],
    ...overrides,
  };
}

function makeCatalogue(
  overrides: Partial<DomainRuleCatalogue> = {},
): DomainRuleCatalogue {
  return {
    scenarioId: "scenario-1",
    rules: [makeRule()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DomainRule
// ---------------------------------------------------------------------------

describe("validateDomainRule — valid rules", () => {
  it("accepts a valid unary rule", () => {
    expect(validateDomainRule(makeRule({ arity: "unary" }), "r").valid).toBe(true);
  });

  it("accepts a valid binary rule", () => {
    expect(
      validateDomainRule(
        makeRule({ arity: "binary", involvedEntityIds: ["d-1", "d-2"] }),
        "r",
      ).valid,
    ).toBe(true);
  });

  it("accepts a valid global rule with many entities", () => {
    expect(
      validateDomainRule(
        makeRule({
          arity: "global",
          involvedEntityIds: ["d-1", "d-2", "d-3"],
        }),
        "r",
      ).valid,
    ).toBe(true);
  });

  it("accepts a global rule with empty involvedEntityIds", () => {
    // Purely global rules may govern all entities
    expect(
      validateDomainRule(makeRule({ arity: "global", involvedEntityIds: [] }), "r").valid,
    ).toBe(true);
  });

  it("accepts rules with optional evaluationInputs", () => {
    expect(
      validateDomainRule(
        makeRule({ evaluationInputs: ["occupancy", "effectivePower"] }),
        "r",
      ).valid,
    ).toBe(true);
  });
});

describe("validateDomainRule — invalid rules", () => {
  it("rejects empty rule id", () => {
    const result = validateDomainRule(makeRule({ id: "" }), "r");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("identifier"))).toBe(true);
    }
  });

  it("rejects empty description", () => {
    const result = validateDomainRule(makeRule({ description: "" }), "r");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("description"))).toBe(true);
    }
  });

  it("rejects whitespace-only description", () => {
    const result = validateDomainRule(makeRule({ description: "   " }), "r");
    expect(result.valid).toBe(false);
  });

  it("rejects unknown arity value", () => {
    const result = validateDomainRule(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeRule({ arity: "quadratic" as any }),
      "r",
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("arity"))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// DomainRuleCatalogue
// ---------------------------------------------------------------------------

describe("validateDomainRuleCatalogue — valid catalogues", () => {
  it("accepts a catalogue with one rule", () => {
    expect(validateDomainRuleCatalogue(makeCatalogue()).valid).toBe(true);
  });

  it("accepts a catalogue with multiple distinct rules", () => {
    const result = validateDomainRuleCatalogue(
      makeCatalogue({
        rules: [
          makeRule({ id: "r-1", arity: "unary" }),
          makeRule({ id: "r-2", arity: "binary", involvedEntityIds: ["d-1", "d-2"] }),
          makeRule({ id: "r-3", arity: "global", involvedEntityIds: [] }),
        ],
      }),
    );
    expect(result.valid).toBe(true);
  });

  it("accepts a catalogue with zero rules (no domain rules for scenario)", () => {
    expect(validateDomainRuleCatalogue(makeCatalogue({ rules: [] })).valid).toBe(
      true,
    );
  });
});

describe("validateDomainRuleCatalogue — invalid catalogues", () => {
  it("rejects empty scenarioId", () => {
    const result = validateDomainRuleCatalogue(makeCatalogue({ scenarioId: "" }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("scenarioId"))).toBe(true);
    }
  });

  it("rejects duplicate rule ids", () => {
    const result = validateDomainRuleCatalogue(
      makeCatalogue({
        rules: [makeRule({ id: "dup" }), makeRule({ id: "dup" })],
      }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("duplicate rule ids"))).toBe(true);
    }
  });

  it("propagates errors from individual invalid rules", () => {
    const result = validateDomainRuleCatalogue(
      makeCatalogue({
        rules: [makeRule({ id: "", description: "" })],
      }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    }
  });
});

/**
 * Problem-level domain rule contracts.
 *
 * These represent real-world scenario/domain rules *before* CSP adaptation.
 * They are owned by `problem/` and are distinct from the solver-ready
 * CspConstraint structures defined in `csp/model/contracts.ts`.
 *
 * `csp/model/` is responsible for converting these into solver-ready form.
 * This module must not implement CSP search, evaluation logic, or solver state.
 */

import type {
  Identifier,
  ScenarioProperties,
} from "../scenario/contracts.js";

/**
 * The kind of arity a domain rule involves.
 * - "unary"  : concerns a single device/variable in isolation.
 * - "binary" : concerns a pair of devices/variables.
 * - "global" : concerns three or more devices/variables together.
 */
export type DomainRuleArity = "unary" | "binary" | "global";

/**
 * A domain rule is a real-world constraint expressed at the problem level.
 * It identifies which entities it governs and describes the rule in
 * human-readable form.  The CSP adapter (csp/model/) is responsible for
 * converting it into a solver-ready CspConstraint.
 *
 * `evaluationInputs` lists the property keys or context keys relevant to
 * evaluation (e.g. "occupancy", "effectivePower").  It mirrors the field on
 * ScenarioConstraint so that the CSP adapter can read it from either source.
 */
export interface DomainRule {
  /** Unique identifier for this rule. */
  readonly id: Identifier;
  /** Human-readable description of the real-world requirement. */
  readonly description: string;
  /** The arity of the rule with respect to scenario entities. */
  readonly arity: DomainRuleArity;
  /**
   * Identifiers of the devices or rooms the rule governs.
   * Empty only for purely global rules that apply to every entity.
   */
  readonly involvedEntityIds: readonly Identifier[];
  /**
   * Property keys or context keys that an evaluator will need.
   * Informational only at the problem level.
   */
  readonly evaluationInputs?: readonly string[];
  /** Any additional domain-specific metadata. */
  readonly properties?: ScenarioProperties;
}

/**
 * A catalogue of domain rules that collectively describe the constraint
 * regime for a scenario.  Owned by `problem/constraints/`.
 */
export interface DomainRuleCatalogue {
  readonly scenarioId: Identifier;
  readonly rules: readonly DomainRule[];
}

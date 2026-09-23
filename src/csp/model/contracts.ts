import type { Identifier, ScenarioProperties } from "../../problem/scenario/contracts.js";

export type CspValue = string | number | boolean | null;
export type CspVariableId = Identifier;

export interface CspVariable {
  readonly id: CspVariableId;
  readonly domainId: Identifier;
  readonly relatedEntityId?: Identifier;
  readonly properties?: ScenarioProperties;
}

export interface CspDomain {
  readonly id: Identifier;
  readonly variableId: CspVariableId;
  readonly possibleValues: readonly CspValue[];
}

export interface CspAssignment {
  readonly variable: CspVariableId;
  readonly value: CspValue;
}

export type CspConfiguration = Readonly<Record<CspVariableId, CspValue>>;

export type ConstraintStatus = "satisfied" | "violated" | "undecided";

export interface ConstraintEvaluationResult {
  readonly constraintId: Identifier;
  readonly status: ConstraintStatus;
  readonly assignment: CspConfiguration;
  readonly reason?: string;
  readonly details?: ScenarioProperties;
}

export interface CspConstraint {
  readonly id: Identifier;
  readonly involvedVariables: readonly CspVariableId[];
  readonly description: string;
  readonly evaluationSemantics: string;
  readonly evaluationInputs: readonly string[];
  /**
   * Describes the information an evaluator must return. It does not prescribe
   * a programming-language-specific evaluator implementation.
   */
  readonly evaluationResult: Pick<
    ConstraintEvaluationResult,
    "status" | "reason" | "details"
  >;
}

export interface CspProblem {
  readonly variables: readonly CspVariable[];
  readonly domains: readonly CspDomain[];
  readonly constraints: readonly CspConstraint[];
  readonly initialAssignment?: readonly CspAssignment[];
}

export interface CspFeasibleSolution {
  readonly configuration: CspConfiguration;
  readonly assignments: readonly CspAssignment[];
}

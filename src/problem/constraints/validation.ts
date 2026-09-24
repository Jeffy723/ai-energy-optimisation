/**
 * Validation for problem-level domain rules.
 *
 * These functions validate DomainRule and DomainRuleCatalogue structures.
 * They do NOT validate CSP constraint evaluation logic; that belongs to
 * csp/model/.
 */

import type { DomainRule, DomainRuleCatalogue } from "./contracts.js";
import {
  type ValidationFailure,
  type ValidationResult,
  type ValidationSuccess,
  validateIdentifier,
} from "../scenario/validation.js";

// Re-export ValidationResult so callers of this module need only one import.
export type { ValidationResult };

const VALID_ARITIES = new Set(["unary", "binary", "global"]);

function localSuccess(): ValidationSuccess {
  return { valid: true };
}

function localFailure(errors: readonly string[]): ValidationFailure {
  return { valid: false, errors };
}

function localMerge(...results: ValidationResult[]): ValidationResult {
  const errors: string[] = [];
  for (const r of results) {
    if (!r.valid) {
      errors.push(...r.errors);
    }
  }
  return errors.length > 0 ? localFailure(errors) : localSuccess();
}

/**
 * Validates a single DomainRule.
 *
 * Rules:
 * - id must be a non-empty string.
 * - description must be a non-empty string.
 * - arity must be "unary", "binary", or "global".
 * - involvedEntityIds must be an array (may be empty for purely global rules).
 */
export function validateDomainRule(
  rule: DomainRule,
  context: string,
): ValidationResult {
  const results: ValidationResult[] = [];

  results.push(validateIdentifier(rule.id, `${context}.id`));

  if (typeof rule.description !== "string" || rule.description.trim().length === 0) {
    results.push(localFailure([`${context}.description must be a non-empty string`]));
  }

  if (!VALID_ARITIES.has(rule.arity)) {
    results.push(
      localFailure([`${context}.arity must be "unary", "binary", or "global"`]),
    );
  }

  if (!Array.isArray(rule.involvedEntityIds)) {
    results.push(localFailure([`${context}.involvedEntityIds must be an array`]));
  }

  return localMerge(...results);
}

/**
 * Validates a DomainRuleCatalogue.
 *
 * Rules:
 * - scenarioId must be a non-empty string.
 * - rules must be an array (may be empty if the scenario has no domain rules).
 * - Each rule is individually validated.
 * - Rule ids must be unique within the catalogue.
 */
export function validateDomainRuleCatalogue(
  catalogue: DomainRuleCatalogue,
): ValidationResult {
  const ctx = `DomainRuleCatalogue[${catalogue.scenarioId}]`;
  const results: ValidationResult[] = [];

  results.push(validateIdentifier(catalogue.scenarioId, `${ctx}.scenarioId`));

  if (!Array.isArray(catalogue.rules)) {
    return localFailure([`${ctx}.rules must be an array`]);
  }

  for (const rule of catalogue.rules) {
    results.push(validateDomainRule(rule, `${ctx}.rules[${rule.id}]`));
  }

  const ruleIds = catalogue.rules.map((r) => r.id);
  const unique = new Set(ruleIds);
  if (unique.size !== ruleIds.length) {
    results.push(localFailure([`${ctx}.rules contains duplicate rule ids`]));
  }

  return localMerge(...results);
}

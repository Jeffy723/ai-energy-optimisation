/**
 * Generic, implementation-independent scenario contracts.
 * Building type is input data only; it does not select an application mode.
 */

export type Identifier = string;

export interface ScenarioPropertyObject {
  readonly [key: string]: ScenarioPropertyValue;
}

export type ScenarioPropertyValue =
  | string
  | number
  | boolean
  | null
  | readonly ScenarioPropertyValue[]
  | ScenarioPropertyObject;

export type ScenarioProperties = Readonly<
  Record<string, ScenarioPropertyValue>
>;

export interface DeviceOperatingState {
  readonly id: Identifier;
  readonly label?: string;
  /**
   * The optional state-specific power in kW. When present, energy evaluation
   * uses it as the effective power instead of the device reference power.
   */
  readonly effectivePower?: number;
  readonly properties?: ScenarioProperties;
}

export interface Device {
  readonly id: Identifier;
  readonly type: string;
  /** Reference/rated power in kW. */
  readonly ratedPower: number;
  /** Operating duration in hours. */
  readonly operatingTime: number;
  readonly availableStates: readonly DeviceOperatingState[];
  readonly properties?: ScenarioProperties;
}

export interface Room {
  readonly id: Identifier;
  readonly name: string;
  /** Number of occupants. */
  readonly occupancy: number;
  readonly devices: readonly Device[];
}

export interface Building {
  readonly id: Identifier;
  readonly name: string;
  readonly type: string;
  readonly rooms: readonly Room[];
}

export interface ScenarioConstraint {
  readonly id: Identifier;
  readonly description: string;
  readonly evaluationInputs?: readonly string[];
  /**
   * Structured semantics consumed by the CSP adapter. A description alone is
   * explanatory text and is never treated as executable constraint logic.
   */
  readonly semantics?: ScenarioConstraintSemantics;
  readonly properties?: ScenarioProperties;
}

export type ScenarioConstraintSemantics =
  | {
      readonly kind: "forbid-states-when-room-occupancy";
      readonly deviceIds: readonly Identifier[];
      readonly occupancy: number;
      readonly stateIds: readonly Identifier[];
    }
  | {
      readonly kind: "require-state-when-room-occupancy";
      readonly deviceIds: readonly Identifier[];
      readonly occupancy: number;
      readonly stateId: Identifier;
    };

export interface ObjectiveConfiguration {
  readonly objectiveId: Identifier;
  readonly properties?: ScenarioProperties;
}

export interface Scenario {
  readonly id: Identifier;
  readonly name: string;
  readonly building: Building;
  readonly context?: ScenarioProperties;
  readonly constraints: readonly ScenarioConstraint[];
  readonly objectiveConfiguration: ObjectiveConfiguration;
}

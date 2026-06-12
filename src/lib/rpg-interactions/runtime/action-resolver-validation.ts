import {
  ACTION_RESOLVER_DEFAULT_EVENT_STATUS,
  type ActionResolution,
  type ActionResolverCost,
  type ActionResolverCostKind,
  type ActionResolverDirectResult,
  type ActionResolverEventDraft,
  type ActionResolverFeasibilityResult,
  type ActionResolverFeasibilityStatus,
  type ActionResolverIntentKind,
  type ActionResolverObstacle,
  type ActionResolverObstacleSeverity,
  type ActionResolverProgressPotential,
  type ActionResolverProgressPotentialLevel,
  type ActionResolverReference,
  type ActionResolverTimeDelta,
  type ActionResolverTimeDeltaScale,
  type ActionResolverTimeUnit,
  type ActionResolverWarning,
  type ActionResolverWarningSeverity,
  type ParsedPlayerIntent,
  type PlayerActionDelta,
} from "../../rpg-runtime/types"
import type {
  RpgHappenedStatus,
  RpgKnowledgeScope,
  RpgNarrativeLine,
  RpgRuntimeDeltaRef,
  RpgRuntimeDeltaSourceStage,
  RpgUsePurpose,
  RpgVisibilityScope,
} from "../../rpg-wiki-schema"

const ALLOWED_INTENT_KINDS = new Set<ActionResolverIntentKind>([
  "attack",
  "move",
  "talk",
  "investigate",
  "observe",
  "rescue",
  "use_item",
  "wait",
  "prepare",
  "mixed",
  "custom",
])

const ALLOWED_HAPPENED_STATUSES = new Set<RpgHappenedStatus>([
  "attempted_not_confirmed",
  "confirmed_happened",
  "ongoing",
  "blocked",
  "failed",
  "possible_future",
  "intention_only",
  "misunderstanding",
])

const ALLOWED_FEASIBILITY_STATUSES = new Set<ActionResolverFeasibilityStatus>([
  "feasible",
  "partially_feasible",
  "requires_cost",
  "blocked",
  "uncertain",
])

const ALLOWED_COST_KINDS = new Set<ActionResolverCostKind>([
  "time",
  "resource",
  "risk",
  "position",
  "relationship",
  "information",
  "condition",
  "other",
])

const ALLOWED_OBSTACLE_SEVERITIES = new Set<ActionResolverObstacleSeverity>([
  "minor",
  "moderate",
  "major",
  "hard_block",
])

const ALLOWED_TIME_DELTA_SCALES = new Set<ActionResolverTimeDeltaScale>([
  "instant",
  "seconds",
  "minutes",
  "tens_of_minutes",
  "hours",
  "days",
  "scene_dependent",
])

const ALLOWED_TIME_UNITS = new Set<ActionResolverTimeUnit>([
  "seconds",
  "minutes",
  "hours",
  "days",
  "turns",
  "scene",
])

const ALLOWED_PROGRESS_LEVELS = new Set<ActionResolverProgressPotentialLevel>([
  "none",
  "low",
  "medium",
  "high",
  "major",
])

const ALLOWED_NARRATIVE_LINES = new Set<RpgNarrativeLine>([
  "playerVisibleLine",
  "parallelLine",
  "tensionLine",
])

const ALLOWED_USE_PURPOSES = new Set<RpgUsePurpose>([
  "actionResolution",
  "worldTick",
  "recall",
  "outlineControl",
  "ruleCheck",
  "narration",
  "writeback",
  "reviewOnly",
  "journalOnly",
])

const ACTION_RESOLUTION_DELTA_PURPOSES = new Set<RpgUsePurpose>([
  "actionResolution",
  "journalOnly",
  "reviewOnly",
])

const ALLOWED_VISIBILITY_SCOPES = new Set<RpgVisibilityScope>([
  "pc_visible",
  "pc_inferred",
  "user_visible_pc_unknown",
  "gm_only",
  "hidden",
])

const ALLOWED_KNOWLEDGE_SCOPES = new Set<RpgKnowledgeScope>([
  "pc_known",
  "pc_misunderstanding",
  "npc_known",
  "user_only",
  "gm_only",
  "unknown_to_pc",
])

const ALLOWED_WARNING_SEVERITIES = new Set<ActionResolverWarningSeverity>([
  "info",
  "warning",
  "unsafe_output",
])

const FORBIDDEN_OUTPUT_KEYS = [
  {
    pattern: /^(?:proposedUpdates?|proposedWikiUpdates?|pendingUpdates?|wikiWrites?|wikiWriteProposal|writeProposal|targetPath|strategy)$/i,
    message: "Action Resolver output must not include wiki write proposals.",
  },
  {
    pattern: /^(?:narrative|narration|playerNarration|playerFacingText|playerFacingNarration|playerFacingOutput|nextActionOptions|parallelLineText)$/i,
    message: "Action Resolver output must not include player-facing narration or next action options.",
  },
  {
    pattern: /^(?:worldTick|worldTickResult|worldDeltas?|worldStateDelta|reactionQueue|npcReactions?|worldReactions?|informationBroadcast)$/i,
    message: "Action Resolver output must not include World Tick or Reaction results.",
  },
] as const

const GENERIC_TIME_DELTA_PATTERN =
  /\b(?:one|1)\s+(?:turn|round).{0,24}(?:one|1)?\s*minute\b|\b(?:one|1)\s*minute\s*(?:per\s*)?(?:turn|round)\b|一轮一?分钟|一回合一?分钟|默认一?分钟|固定一?分钟/iu

const CONFIRMED_BASIS_PATTERN =
  /\b(?:already|previously|pre[-\s]?confirmed|explicitly confirms?|the action text states|snapshot confirms?|completed before resolution)\b|已确认|已经发生|明确确认|行动文本已说明|快照确认/iu

export function validateActionResolution(value: unknown): ActionResolution {
  assertNoForbiddenOutputKeys(value)

  const record = expectRecord(value, "ActionResolution")
  const resolutionId = readString(record, "resolutionId", "ActionResolution.resolutionId")
  const submittedActionId = readString(record, "submittedActionId", "ActionResolution.submittedActionId")
  const parsedIntent = validateParsedIntent(record.parsedIntent)
  const eventDraft = validateEventDraft(record.eventDraft)
  const feasibility = validateFeasibility(record.feasibility)
  const costs = readArray(record, "costs", "ActionResolution.costs").map(validateCost)
  const obstacles = readArray(record, "obstacles", "ActionResolution.obstacles").map(validateObstacle)
  const directResults = readArray(record, "directResults", "ActionResolution.directResults").map(validateDirectResult)
  const timeDelta = validateTimeDelta(record.timeDelta)
  const progressPotential = validateProgressPotential(record.progressPotential)
  const playerActionDelta = validatePlayerActionDelta(record.playerActionDelta)
  const runtimeDeltaRefs = readArray(record, "runtimeDeltaRefs", "ActionResolution.runtimeDeltaRefs").map(
    validateRuntimeDeltaRef,
  )
  const references = readArray(record, "references", "ActionResolution.references").map(validateReference)
  const warnings = readArray(record, "warnings", "ActionResolution.warnings").map(validateWarning)

  return {
    resolutionId,
    submittedActionId,
    parsedIntent,
    eventDraft,
    feasibility,
    costs,
    obstacles,
    directResults,
    timeDelta,
    progressPotential,
    playerActionDelta,
    runtimeDeltaRefs,
    references,
    warnings,
  }
}

function validateParsedIntent(value: unknown): ParsedPlayerIntent {
  const record = expectRecord(value, "ActionResolution.parsedIntent")
  const intentKind = readEnum(record, "intentKind", ALLOWED_INTENT_KINDS, "ActionResolution.parsedIntent.intentKind")

  return {
    intentKind,
    actorRef: readString(record, "actorRef", "ActionResolution.parsedIntent.actorRef"),
    targetRefs: readStringArray(record, "targetRefs", "ActionResolution.parsedIntent.targetRefs"),
    actionScope: readString(record, "actionScope", "ActionResolution.parsedIntent.actionScope"),
    declaredGoal: readString(record, "declaredGoal", "ActionResolution.parsedIntent.declaredGoal"),
    timeJumpSignal: readOptionalString(record, "timeJumpSignal", "ActionResolution.parsedIntent.timeJumpSignal"),
    ambiguityNotes: readStringArray(record, "ambiguityNotes", "ActionResolution.parsedIntent.ambiguityNotes"),
  }
}

function validateEventDraft(value: unknown): ActionResolverEventDraft {
  const record = expectRecord(value, "ActionResolution.eventDraft")
  const rawStatus = record.status ?? ACTION_RESOLVER_DEFAULT_EVENT_STATUS
  const status = readEnumValue(rawStatus, ALLOWED_HAPPENED_STATUSES, "ActionResolution.eventDraft.status")
  const confirmationBasis = readOptionalString(record, "confirmationBasis", "ActionResolution.eventDraft.confirmationBasis")

  if (status === "confirmed_happened" && (!confirmationBasis || !CONFIRMED_BASIS_PATTERN.test(confirmationBasis))) {
    throw new Error(
      "Invalid ActionResolution: eventDraft.status confirmed_happened requires a specific confirmationBasis from the action text or pre-action snapshot.",
    )
  }

  return {
    eventId: readString(record, "eventId", "ActionResolution.eventDraft.eventId"),
    eventType: readString(record, "eventType", "ActionResolution.eventDraft.eventType"),
    summary: readString(record, "summary", "ActionResolution.eventDraft.summary"),
    status,
    confirmationBasis,
    actorRefs: readStringArray(record, "actorRefs", "ActionResolution.eventDraft.actorRefs"),
    targetRefs: readStringArray(record, "targetRefs", "ActionResolution.eventDraft.targetRefs"),
    affectedRefs: readStringArray(record, "affectedRefs", "ActionResolution.eventDraft.affectedRefs"),
    riskSummary: readString(record, "riskSummary", "ActionResolution.eventDraft.riskSummary"),
    requiredChecks: readStringArray(record, "requiredChecks", "ActionResolution.eventDraft.requiredChecks"),
    ambiguityNotes: readStringArray(record, "ambiguityNotes", "ActionResolution.eventDraft.ambiguityNotes"),
  }
}

function validateFeasibility(value: unknown): ActionResolverFeasibilityResult {
  const record = expectRecord(value, "ActionResolution.feasibility")

  if ("costs" in record || "obstacles" in record || "directResults" in record) {
    throw new Error(
      "Invalid ActionResolution: feasibility, costs, obstacles, and directResults must be separate top-level fields.",
    )
  }

  return {
    status: readEnum(record, "status", ALLOWED_FEASIBILITY_STATUSES, "ActionResolution.feasibility.status"),
    rationale: readString(record, "rationale", "ActionResolution.feasibility.rationale"),
    limitingFactors: readStringArray(record, "limitingFactors", "ActionResolution.feasibility.limitingFactors"),
    requiredChecks: readStringArray(record, "requiredChecks", "ActionResolution.feasibility.requiredChecks"),
    alternativeResults: readStringArray(record, "alternativeResults", "ActionResolution.feasibility.alternativeResults"),
  }
}

function validateCost(value: unknown, index: number): ActionResolverCost {
  const record = expectRecord(value, `ActionResolution.costs[${index}]`)

  return {
    costId: readString(record, "costId", `ActionResolution.costs[${index}].costId`),
    kind: readEnum(record, "kind", ALLOWED_COST_KINDS, `ActionResolution.costs[${index}].kind`),
    description: readString(record, "description", `ActionResolution.costs[${index}].description`),
    appliesIf: readString(record, "appliesIf", `ActionResolution.costs[${index}].appliesIf`),
  }
}

function validateObstacle(value: unknown, index: number): ActionResolverObstacle {
  const record = expectRecord(value, `ActionResolution.obstacles[${index}]`)

  return {
    obstacleId: readString(record, "obstacleId", `ActionResolution.obstacles[${index}].obstacleId`),
    severity: readEnum(
      record,
      "severity",
      ALLOWED_OBSTACLE_SEVERITIES,
      `ActionResolution.obstacles[${index}].severity`,
    ),
    description: readString(record, "description", `ActionResolution.obstacles[${index}].description`),
    bypassHint: readOptionalString(record, "bypassHint", `ActionResolution.obstacles[${index}].bypassHint`),
  }
}

function validateDirectResult(value: unknown, index: number): ActionResolverDirectResult {
  const record = expectRecord(value, `ActionResolution.directResults[${index}]`)

  return {
    resultId: readString(record, "resultId", `ActionResolution.directResults[${index}].resultId`),
    summary: readString(record, "summary", `ActionResolution.directResults[${index}].summary`),
    happenedStatus: readEnum(
      record,
      "happenedStatus",
      ALLOWED_HAPPENED_STATUSES,
      `ActionResolution.directResults[${index}].happenedStatus`,
    ),
    visibilityScope: readEnum(
      record,
      "visibilityScope",
      ALLOWED_VISIBILITY_SCOPES,
      `ActionResolution.directResults[${index}].visibilityScope`,
    ),
    affectedRefs: readStringArray(record, "affectedRefs", `ActionResolution.directResults[${index}].affectedRefs`),
  }
}

function validateTimeDelta(value: unknown): ActionResolverTimeDelta {
  const record = expectRecord(value, "ActionResolution.timeDelta")
  const summary = readString(record, "summary", "ActionResolution.timeDelta.summary")
  const reasoning = readString(record, "reasoning", "ActionResolution.timeDelta.reasoning")
  const combined = `${summary}\n${reasoning}`

  if (GENERIC_TIME_DELTA_PATTERN.test(combined)) {
    throw new Error(
      "Invalid ActionResolution: timeDelta must be derived from the submitted action and cannot be a generic one-turn/one-minute default.",
    )
  }

  return {
    scale: readEnum(record, "scale", ALLOWED_TIME_DELTA_SCALES, "ActionResolution.timeDelta.scale"),
    unit: readEnum(record, "unit", ALLOWED_TIME_UNITS, "ActionResolution.timeDelta.unit"),
    min: readOptionalNumber(record, "min", "ActionResolution.timeDelta.min"),
    max: readOptionalNumber(record, "max", "ActionResolution.timeDelta.max"),
    summary,
    reasoning,
  }
}

function validateProgressPotential(value: unknown): ActionResolverProgressPotential {
  const record = expectRecord(value, "ActionResolution.progressPotential")

  return {
    level: readEnum(record, "level", ALLOWED_PROGRESS_LEVELS, "ActionResolution.progressPotential.level"),
    summary: readString(record, "summary", "ActionResolution.progressPotential.summary"),
    possibleUnlocks: readStringArray(record, "possibleUnlocks", "ActionResolution.progressPotential.possibleUnlocks"),
    gapTriggerPotential: readEnumValue(
      record.gapTriggerPotential,
      new Set(["none", "minor", "branch", "major"] as const),
      "ActionResolution.progressPotential.gapTriggerPotential",
    ),
  }
}

function validatePlayerActionDelta(value: unknown): PlayerActionDelta {
  const record = expectRecord(value, "ActionResolution.playerActionDelta")
  const scope = readString(record, "scope", "ActionResolution.playerActionDelta.scope")
  if (scope !== "player_action_only") {
    throw new Error("Invalid ActionResolution: playerActionDelta.scope must be player_action_only.")
  }

  return {
    deltaId: readString(record, "deltaId", "ActionResolution.playerActionDelta.deltaId"),
    causedByActionId: readString(record, "causedByActionId", "ActionResolution.playerActionDelta.causedByActionId"),
    scope,
    positionChanges: readStringArray(record, "positionChanges", "ActionResolution.playerActionDelta.positionChanges"),
    resourceChanges: readStringArray(record, "resourceChanges", "ActionResolution.playerActionDelta.resourceChanges"),
    inventoryChanges: readStringArray(record, "inventoryChanges", "ActionResolution.playerActionDelta.inventoryChanges"),
    conditionChanges: readStringArray(record, "conditionChanges", "ActionResolution.playerActionDelta.conditionChanges"),
    knowledgeChanges: readStringArray(record, "knowledgeChanges", "ActionResolution.playerActionDelta.knowledgeChanges"),
    relationshipSignals: readStringArray(
      record,
      "relationshipSignals",
      "ActionResolution.playerActionDelta.relationshipSignals",
    ),
    sceneChanges: readStringArray(record, "sceneChanges", "ActionResolution.playerActionDelta.sceneChanges"),
    interruptedEvents: readStringArray(
      record,
      "interruptedEvents",
      "ActionResolution.playerActionDelta.interruptedEvents",
    ),
    exposedInformation: readStringArray(
      record,
      "exposedInformation",
      "ActionResolution.playerActionDelta.exposedInformation",
    ),
    runtimeDeltaRefs: readArray(
      record,
      "runtimeDeltaRefs",
      "ActionResolution.playerActionDelta.runtimeDeltaRefs",
    ).map(validateRuntimeDeltaRef),
    notes: readStringArray(record, "notes", "ActionResolution.playerActionDelta.notes"),
  }
}

function validateRuntimeDeltaRef(value: unknown, index: number): RpgRuntimeDeltaRef {
  const record = expectRecord(value, `ActionResolution.runtimeDeltaRefs[${index}]`)
  const sourceStage = readString(record, "sourceStage", `ActionResolution.runtimeDeltaRefs[${index}].sourceStage`)

  if (sourceStage !== "actionResolution") {
    throw new Error("Invalid ActionResolution: RuntimeDeltaRef.sourceStage must be actionResolution.")
  }

  const usePurpose = readEnumValue(
    record.usePurpose,
    ACTION_RESOLUTION_DELTA_PURPOSES,
    `ActionResolution.runtimeDeltaRefs[${index}].usePurpose`,
  )

  return {
    deltaId: readString(record, "deltaId", `ActionResolution.runtimeDeltaRefs[${index}].deltaId`),
    sourceStage: sourceStage as RpgRuntimeDeltaSourceStage,
    sourcePath: readString(record, "sourcePath", `ActionResolution.runtimeDeltaRefs[${index}].sourcePath`),
    summary: readString(record, "summary", `ActionResolution.runtimeDeltaRefs[${index}].summary`),
    narrativeLine: readEnumValue(
      record.narrativeLine,
      ALLOWED_NARRATIVE_LINES,
      `ActionResolution.runtimeDeltaRefs[${index}].narrativeLine`,
    ),
    usePurpose,
    happenedStatus: readEnumValue(
      record.happenedStatus,
      ALLOWED_HAPPENED_STATUSES,
      `ActionResolution.runtimeDeltaRefs[${index}].happenedStatus`,
    ),
  }
}

function validateReference(value: unknown, index: number): ActionResolverReference {
  const record = expectRecord(value, `ActionResolution.references[${index}]`)

  return {
    path: readString(record, "path", `ActionResolution.references[${index}].path`),
    sectionId: readOptionalString(record, "sectionId", `ActionResolution.references[${index}].sectionId`),
    reason: readString(record, "reason", `ActionResolution.references[${index}].reason`),
    usePurpose: readEnumValue(
      record.usePurpose,
      ALLOWED_USE_PURPOSES,
      `ActionResolution.references[${index}].usePurpose`,
    ),
    visibilityScope: readOptionalEnumValue(
      record.visibilityScope,
      ALLOWED_VISIBILITY_SCOPES,
      `ActionResolution.references[${index}].visibilityScope`,
    ),
    knowledgeScope: readOptionalEnumValue(
      record.knowledgeScope,
      ALLOWED_KNOWLEDGE_SCOPES,
      `ActionResolution.references[${index}].knowledgeScope`,
    ),
  }
}

function validateWarning(value: unknown, index: number): ActionResolverWarning {
  const record = expectRecord(value, `ActionResolution.warnings[${index}]`)

  return {
    code: readString(record, "code", `ActionResolution.warnings[${index}].code`),
    message: readString(record, "message", `ActionResolution.warnings[${index}].message`),
    severity: readEnum(record, "severity", ALLOWED_WARNING_SEVERITIES, `ActionResolution.warnings[${index}].severity`),
  }
}

function assertNoForbiddenOutputKeys(value: unknown, path = "ActionResolution"): void {
  if (value === null || typeof value !== "object") return

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenOutputKeys(entry, `${path}[${index}]`))
    return
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const forbidden = FORBIDDEN_OUTPUT_KEYS.find((entry) => entry.pattern.test(key))
    if (forbidden) {
      throw new Error(`Invalid ActionResolution: ${forbidden.message} Forbidden key ${path}.${key}.`)
    }
    assertNoForbiddenOutputKeys(child, `${path}.${key}`)
  }
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an object.`)
  }
  return value as Record<string, unknown>
}

function readString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${label}: must be a non-empty string.`)
  }
  return value.trim()
}

function readOptionalString(record: Record<string, unknown>, key: string, label: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== "string") {
    throw new Error(`Invalid ${label}: must be a string when provided.`)
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function readStringArray(record: Record<string, unknown>, key: string, label: string): string[] {
  return readArray(record, key, label).map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`Invalid ${label}[${index}]: must be a string.`)
    }
    return entry.trim()
  }).filter(Boolean)
}

function readArray(record: Record<string, unknown>, key: string, label: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}: must be an array.`)
  }
  return value
}

function readOptionalNumber(record: Record<string, unknown>, key: string, label: string): number | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${label}: must be a finite non-negative number when provided.`)
  }
  return value
}

function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T>,
  label: string,
): T {
  return readEnumValue(record[key], allowed, label)
}

function readEnumValue<T extends string>(value: unknown, allowed: ReadonlySet<T>, label: string): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`Invalid ${label}: value is not allowed.`)
  }
  return value as T
}

function readOptionalEnumValue<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  label: string,
): T | undefined {
  if (value === undefined) return undefined
  return readEnumValue(value, allowed, label)
}

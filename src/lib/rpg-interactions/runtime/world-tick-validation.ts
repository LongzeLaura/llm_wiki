import type {
  ActionResolverTimeDelta,
  WorldTickClockKind,
  WorldTickClockUpdate,
  WorldTickClockUpdateKind,
  WorldTickDeltaBase,
  WorldTickGapMode,
  WorldTickGapState,
  WorldTickInformationBroadcast,
  WorldTickOngoingEventSettlementKind,
  WorldTickPacingDebt,
  WorldTickPacingUpdate,
  WorldTickPressureChange,
  WorldTickReactionQueueEntry,
  WorldTickReactionTiming,
  WorldTickReference,
  WorldTickResult,
  WorldTickSettledOngoingEvent,
  WorldTickTimeAdvance,
  WorldTickVisibilityMeta,
  WorldTickWarning,
  WorldTickWarningSeverity,
  WorldTickWorldDelta,
} from "../../rpg-runtime/types"
import type {
  RpgGapImpactCandidate,
  RpgHappenedStatus,
  RpgKnowledgeScope,
  RpgKnowledgeSourceKind,
  RpgNarrativeLine,
  RpgRuntimeDeltaRef,
  RpgRuntimeDeltaSourceStage,
  RpgUsePurpose,
  RpgVisibilityScope,
} from "../../rpg-wiki-schema"

const ALLOWED_NARRATIVE_LINES = new Set<RpgNarrativeLine>([
  "playerVisibleLine",
  "parallelLine",
  "tensionLine",
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

const ALLOWED_KNOWLEDGE_SOURCE_KINDS = new Set<RpgKnowledgeSourceKind>([
  "seen",
  "heard",
  "told",
  "inferred",
  "documented",
  "memory",
  "parallel_line",
  "misread",
  "unknown",
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

const WORLD_TICK_DELTA_PURPOSES = new Set<RpgUsePurpose>(["worldTick", "journalOnly", "reviewOnly"])
const ALLOWED_DELTA_SOURCE_STAGES = new Set<RpgRuntimeDeltaSourceStage>(["worldTick"])

const ALLOWED_TIME_DELTA_SCALES = new Set<ActionResolverTimeDelta["scale"]>([
  "instant",
  "seconds",
  "minutes",
  "tens_of_minutes",
  "hours",
  "days",
  "scene_dependent",
])

const ALLOWED_TIME_UNITS = new Set<ActionResolverTimeDelta["unit"]>([
  "seconds",
  "minutes",
  "hours",
  "days",
  "turns",
  "scene",
])

const ALLOWED_CLOCK_KINDS = new Set<WorldTickClockKind>([
  "worldClock",
  "countdown",
  "pacingDebt",
  "relationshipPressure",
  "investigationClock",
  "combatClock",
  "dangerClock",
  "ongoingEventClock",
])

const ALLOWED_CLOCK_UPDATE_KINDS = new Set<WorldTickClockUpdateKind>([
  "advance",
  "decrease",
  "pause",
  "resume",
  "trigger",
  "interrupt",
  "resolve",
  "reset",
  "create",
  "no_change",
])

const ALLOWED_SETTLEMENT_KINDS = new Set<WorldTickOngoingEventSettlementKind>([
  "advanced",
  "paused",
  "triggered",
  "interrupted",
  "blocked",
  "failed",
  "resolved",
  "no_change",
])

const ALLOWED_REACTION_TIMING = new Set<WorldTickReactionTiming>([
  "immediate",
  "delayed",
  "parallel",
  "tension",
  "none",
])

const ALLOWED_REACTION_PRIORITY = new Set<WorldTickReactionQueueEntry["priority"]>([
  "low",
  "medium",
  "high",
  "scene_focus",
])

const ALLOWED_PACING_DEBTS = new Set<WorldTickPacingDebt>(["none", "low", "medium", "high", "critical"])
const ALLOWED_PRESSURE_CHANGES = new Set<WorldTickPressureChange>([
  "relieved",
  "unchanged",
  "increased",
  "scene_cut_needed",
])
const ALLOWED_GAP_MODES = new Set<WorldTickGapMode>([
  "none",
  "skip",
  "compress",
  "parallel_line_tick",
  "relationship_beat",
  "branching_event",
  "major_divergence_event",
])
const ALLOWED_GAP_IMPACT_CANDIDATES = new Set<RpgGapImpactCandidate>(["none", "minor", "branch", "major"])
const ALLOWED_WARNING_SEVERITIES = new Set<WorldTickWarningSeverity>(["info", "warning", "unsafe_output"])
const ALLOWED_DISPLAY_POLICIES = new Set<WorldTickVisibilityMeta["displayPolicy"]>([
  "player_visible",
  "user_visible_pc_unknown",
  "gm_only",
  "hidden",
])
const ALLOWED_BROADCAST_CERTAINTY = new Set<WorldTickInformationBroadcast["certainty"]>([
  "confirmed",
  "partial",
  "misread",
  "unknown",
])

const FORBIDDEN_OUTPUT_KEYS = [
  {
    pattern:
      /^(?:proposedUpdates?|proposedWikiUpdates?|pendingUpdates?|wikiWrites?|wikiWriteProposal|writeProposal|targetPath|strategy|applyUpdates?|acceptedUpdates?)$/i,
    message: "World Tick output must not include wiki write proposals or apply targets.",
  },
  {
    pattern:
      /^(?:narrative|narration|playerNarration|playerFacingText|playerFacingNarration|playerFacingOutput|parallelLineText|tensionBriefText|visibleNarration)$/i,
    message: "World Tick output must not include player-facing narration or prose narration fields.",
  },
  {
    pattern: /^(?:nextActionOptions)$/i,
    message: "World Tick output must not include next action options.",
  },
  {
    pattern:
      /^(?:outlineRevision|outlineRevisionProposal|provisionalOutlinePatch|regenerationRequest|storyOutlineRegeneration)$/i,
    message: "World Tick output must not include outline revision or regeneration authority.",
  },
  {
    pattern:
      /^(?:recallSelection|selectedItems|retrievalIndex|recalledMaterials|recallCandidates|recallOutput)$/i,
    message: "World Tick output must not include Recall Selector output.",
  },
] as const

export function validateWorldTickResult(value: unknown): WorldTickResult {
  assertNoForbiddenOutputKeys(value)

  const record = expectRecord(value, "WorldTickResult")
  const tickId = readString(record, "tickId", "WorldTickResult.tickId")
  const sourceActionResolutionId = readString(
    record,
    "sourceActionResolutionId",
    "WorldTickResult.sourceActionResolutionId",
  )
  const timeAdvance = validateTimeAdvance(record.timeAdvance)
  const worldDeltas = validateWorldDeltas(record.worldDeltas)
  const clockUpdates = readArray(record, "clockUpdates", "WorldTickResult.clockUpdates").map(validateClockUpdate)
  const settledOngoingEvents = readArray(
    record,
    "settledOngoingEvents",
    "WorldTickResult.settledOngoingEvents",
  ).map(validateSettledOngoingEvent)
  const informationBroadcast = readArray(
    record,
    "informationBroadcast",
    "WorldTickResult.informationBroadcast",
  ).map(validateInformationBroadcast)
  const reactionQueue = readArray(record, "reactionQueue", "WorldTickResult.reactionQueue").map(validateReaction)
  const pacingUpdate = validatePacingUpdate(record.pacingUpdate)
  const gapState = validateGapState(record.gapState)
  const runtimeDeltaRefs = readArray(record, "runtimeDeltaRefs", "WorldTickResult.runtimeDeltaRefs").map(
    validateRuntimeDeltaRef,
  )
  const references = readArray(record, "references", "WorldTickResult.references").map(validateReference)
  const warnings = readArray(record, "warnings", "WorldTickResult.warnings").map(validateWarning)

  return {
    tickId,
    sourceActionResolutionId,
    timeAdvance,
    worldDeltas,
    clockUpdates,
    settledOngoingEvents,
    informationBroadcast,
    reactionQueue,
    pacingUpdate,
    gapState,
    runtimeDeltaRefs,
    references,
    warnings,
  }
}

function validateWorldDeltas(value: unknown): WorldTickResult["worldDeltas"] {
  const record = expectRecord(value, "WorldTickResult.worldDeltas")

  return {
    playerVisibleLine: readArray(
      record,
      "playerVisibleLine",
      "WorldTickResult.worldDeltas.playerVisibleLine",
    ).map((delta, index) =>
      validateWorldDelta(delta, index, "WorldTickResult.worldDeltas.playerVisibleLine", "playerVisibleLine"),
    ),
    parallelLine: readArray(record, "parallelLine", "WorldTickResult.worldDeltas.parallelLine").map((delta, index) =>
      validateWorldDelta(delta, index, "WorldTickResult.worldDeltas.parallelLine", "parallelLine"),
    ),
    tensionLine: readArray(record, "tensionLine", "WorldTickResult.worldDeltas.tensionLine").map((delta, index) =>
      validateWorldDelta(delta, index, "WorldTickResult.worldDeltas.tensionLine", "tensionLine"),
    ),
  }
}

function validateWorldDelta(
  value: unknown,
  index: number,
  path: string,
  expectedLine: RpgNarrativeLine,
): WorldTickWorldDelta {
  const label = `${path}[${index}]`
  const record = expectRecord(value, label)
  const base = validateDeltaBase(record, label)

  if (base.narrativeLine !== expectedLine) {
    throw new Error(`Invalid ${label}.narrativeLine: must be ${expectedLine}.`)
  }

  return {
    ...base,
    deltaId: readString(record, "deltaId", `${label}.deltaId`),
    summary: readString(record, "summary", `${label}.summary`),
    sourcePlayerDeltaIds: readStringArray(record, "sourcePlayerDeltaIds", `${label}.sourcePlayerDeltaIds`),
    sourceClockIds: readStringArray(record, "sourceClockIds", `${label}.sourceClockIds`),
    knowledgeEffects: readStringArray(record, "knowledgeEffects", `${label}.knowledgeEffects`),
  }
}

function validateTimeAdvance(value: unknown): WorldTickTimeAdvance {
  const record = expectRecord(value, "WorldTickResult.timeAdvance")

  return {
    sourceTimeDelta: validateActionResolverTimeDelta(record.sourceTimeDelta),
    appliedSummary: readString(record, "appliedSummary", "WorldTickResult.timeAdvance.appliedSummary"),
    clockReasoning: readString(record, "clockReasoning", "WorldTickResult.timeAdvance.clockReasoning"),
  }
}

function validateClockUpdate(value: unknown, index: number): WorldTickClockUpdate {
  const label = `WorldTickResult.clockUpdates[${index}]`
  const record = expectRecord(value, label)

  return {
    ...validateDeltaBase(record, label),
    clockId: readString(record, "clockId", `${label}.clockId`),
    clockKind: readEnum(record, "clockKind", ALLOWED_CLOCK_KINDS, `${label}.clockKind`),
    updateKind: readEnum(record, "updateKind", ALLOWED_CLOCK_UPDATE_KINDS, `${label}.updateKind`),
    previousState: readString(record, "previousState", `${label}.previousState`),
    nextState: readString(record, "nextState", `${label}.nextState`),
    amount: readOptionalNumber(record, "amount", `${label}.amount`),
    timeDeltaBasis: validateActionResolverTimeDelta(record.timeDeltaBasis),
    reason: readString(record, "reason", `${label}.reason`),
    sourcePlayerDeltaIds: readStringArray(record, "sourcePlayerDeltaIds", `${label}.sourcePlayerDeltaIds`),
  }
}

function validateSettledOngoingEvent(value: unknown, index: number): WorldTickSettledOngoingEvent {
  const label = `WorldTickResult.settledOngoingEvents[${index}]`
  const record = expectRecord(value, label)

  return {
    ...validateDeltaBase(record, label),
    eventId: readString(record, "eventId", `${label}.eventId`),
    eventRef: readOptionalString(record, "eventRef", `${label}.eventRef`),
    settlementKind: readEnum(record, "settlementKind", ALLOWED_SETTLEMENT_KINDS, `${label}.settlementKind`),
    summary: readString(record, "summary", `${label}.summary`),
    cause: readString(record, "cause", `${label}.cause`),
    participantRefs: readStringArray(record, "participantRefs", `${label}.participantRefs`),
    clockUpdateIds: readStringArray(record, "clockUpdateIds", `${label}.clockUpdateIds`),
  }
}

function validateInformationBroadcast(value: unknown, index: number): WorldTickInformationBroadcast {
  const label = `WorldTickResult.informationBroadcast[${index}]`
  const record = expectRecord(value, label)

  return {
    ...validateDeltaBase(record, label),
    broadcastId: readString(record, "broadcastId", `${label}.broadcastId`),
    informationRef: readOptionalString(record, "informationRef", `${label}.informationRef`),
    informationSummary: readString(record, "informationSummary", `${label}.informationSummary`),
    sourceActorRefs: readStringArray(record, "sourceActorRefs", `${label}.sourceActorRefs`),
    recipientRefs: readStringArray(record, "recipientRefs", `${label}.recipientRefs`),
    channel: readString(record, "channel", `${label}.channel`),
    certainty: readEnum(record, "certainty", ALLOWED_BROADCAST_CERTAINTY, `${label}.certainty`),
    preventsPcKnowledgeLeak: readBoolean(record, "preventsPcKnowledgeLeak", `${label}.preventsPcKnowledgeLeak`),
  }
}

function validateReaction(value: unknown, index: number): WorldTickReactionQueueEntry {
  const label = `WorldTickResult.reactionQueue[${index}]`
  const record = expectRecord(value, label)

  return {
    ...validateDeltaBase(record, label),
    reactionId: readString(record, "reactionId", `${label}.reactionId`),
    actorRef: readString(record, "actorRef", `${label}.actorRef`),
    reactionTiming: readEnum(record, "reactionTiming", ALLOWED_REACTION_TIMING, `${label}.reactionTiming`),
    summary: readString(record, "summary", `${label}.summary`),
    triggerDeltaIds: readStringArray(record, "triggerDeltaIds", `${label}.triggerDeltaIds`),
    knowledgeBasis: readStringArray(record, "knowledgeBasis", `${label}.knowledgeBasis`),
    priority: readEnum(record, "priority", ALLOWED_REACTION_PRIORITY, `${label}.priority`),
  }
}

function validatePacingUpdate(value: unknown): WorldTickPacingUpdate {
  const label = "WorldTickResult.pacingUpdate"
  const record = expectRecord(value, label)

  return {
    ...validateDeltaBase(record, label),
    updateId: readString(record, "updateId", `${label}.updateId`),
    previousDebt: readEnum(record, "previousDebt", ALLOWED_PACING_DEBTS, `${label}.previousDebt`),
    nextDebt: readEnum(record, "nextDebt", ALLOWED_PACING_DEBTS, `${label}.nextDebt`),
    pressureChange: readEnum(record, "pressureChange", ALLOWED_PRESSURE_CHANGES, `${label}.pressureChange`),
    campaignDelta: readString(record, "campaignDelta", `${label}.campaignDelta`),
    compensationNeeded: readBoolean(record, "compensationNeeded", `${label}.compensationNeeded`),
  }
}

function validateGapState(value: unknown): WorldTickGapState {
  const label = "WorldTickResult.gapState"
  const record = expectRecord(value, label)
  const isPreliminary = readBoolean(record, "isPreliminary", `${label}.isPreliminary`)
  if (isPreliminary !== true) {
    throw new Error(`Invalid ${label}.isPreliminary: must be true.`)
  }

  const outlineImpactAuthority = readString(record, "outlineImpactAuthority", `${label}.outlineImpactAuthority`)
  if (outlineImpactAuthority !== "outlineImpactDetector") {
    throw new Error(`Invalid ${label}.outlineImpactAuthority: must be outlineImpactDetector.`)
  }

  return {
    ...validateDeltaBase(record, label),
    gapSignalId: readString(record, "gapSignalId", `${label}.gapSignalId`),
    gapMode: readEnum(record, "gapMode", ALLOWED_GAP_MODES, `${label}.gapMode`),
    gapImpactCandidate: readEnum(
      record,
      "gapImpactCandidate",
      ALLOWED_GAP_IMPACT_CANDIDATES,
      `${label}.gapImpactCandidate`,
    ),
    isPreliminary,
    outlineImpactAuthority,
    summary: readString(record, "summary", `${label}.summary`),
    causalChain: readStringArray(record, "causalChain", `${label}.causalChain`),
    affectedBeatRefs: readStringArray(record, "affectedBeatRefs", `${label}.affectedBeatRefs`),
  }
}

function validateDeltaBase(record: Record<string, unknown>, label: string): WorldTickDeltaBase {
  return {
    narrativeLine: readEnum(record, "narrativeLine", ALLOWED_NARRATIVE_LINES, `${label}.narrativeLine`),
    visibility: validateVisibility(record.visibility, `${label}.visibility`),
    happenedStatus: readEnum(record, "happenedStatus", ALLOWED_HAPPENED_STATUSES, `${label}.happenedStatus`),
    affectedPaths: readNonEmptyStringArray(record, "affectedPaths", `${label}.affectedPaths`),
    runtimeDeltaRefs: readArray(record, "runtimeDeltaRefs", `${label}.runtimeDeltaRefs`).map(validateRuntimeDeltaRef),
  }
}

function validateVisibility(value: unknown, label: string): WorldTickVisibilityMeta {
  const record = expectRecord(value, label)

  return {
    visibilityScope: readEnum(record, "visibilityScope", ALLOWED_VISIBILITY_SCOPES, `${label}.visibilityScope`),
    knowledgeScope: readEnum(record, "knowledgeScope", ALLOWED_KNOWLEDGE_SCOPES, `${label}.knowledgeScope`),
    knowledgeSourceKind: readEnum(
      record,
      "knowledgeSourceKind",
      ALLOWED_KNOWLEDGE_SOURCE_KINDS,
      `${label}.knowledgeSourceKind`,
    ),
    knownBy: readStringArray(record, "knownBy", `${label}.knownBy`),
    excludedKnowledgeFor: readStringArray(record, "excludedKnowledgeFor", `${label}.excludedKnowledgeFor`),
    displayPolicy: readEnum(record, "displayPolicy", ALLOWED_DISPLAY_POLICIES, `${label}.displayPolicy`),
    reason: readString(record, "reason", `${label}.reason`),
  }
}

function validateActionResolverTimeDelta(value: unknown): ActionResolverTimeDelta {
  const record = expectRecord(value, "ActionResolverTimeDelta")

  return {
    scale: readEnum(record, "scale", ALLOWED_TIME_DELTA_SCALES, "ActionResolverTimeDelta.scale"),
    unit: readEnum(record, "unit", ALLOWED_TIME_UNITS, "ActionResolverTimeDelta.unit"),
    min: readOptionalNumber(record, "min", "ActionResolverTimeDelta.min"),
    max: readOptionalNumber(record, "max", "ActionResolverTimeDelta.max"),
    summary: readString(record, "summary", "ActionResolverTimeDelta.summary"),
    reasoning: readString(record, "reasoning", "ActionResolverTimeDelta.reasoning"),
  }
}

function validateRuntimeDeltaRef(value: unknown, index: number): RpgRuntimeDeltaRef {
  const record = expectRecord(value, `WorldTickResult.runtimeDeltaRefs[${index}]`)
  const sourceStage = readEnumValue(
    record.sourceStage,
    ALLOWED_DELTA_SOURCE_STAGES,
    `WorldTickResult.runtimeDeltaRefs[${index}].sourceStage`,
  )
  const usePurpose = readEnumValue(
    record.usePurpose,
    WORLD_TICK_DELTA_PURPOSES,
    `WorldTickResult.runtimeDeltaRefs[${index}].usePurpose`,
  )

  return {
    deltaId: readString(record, "deltaId", `WorldTickResult.runtimeDeltaRefs[${index}].deltaId`),
    sourceStage,
    sourcePath: readString(record, "sourcePath", `WorldTickResult.runtimeDeltaRefs[${index}].sourcePath`),
    summary: readString(record, "summary", `WorldTickResult.runtimeDeltaRefs[${index}].summary`),
    narrativeLine: readEnumValue(
      record.narrativeLine,
      ALLOWED_NARRATIVE_LINES,
      `WorldTickResult.runtimeDeltaRefs[${index}].narrativeLine`,
    ),
    usePurpose,
    happenedStatus: readEnumValue(
      record.happenedStatus,
      ALLOWED_HAPPENED_STATUSES,
      `WorldTickResult.runtimeDeltaRefs[${index}].happenedStatus`,
    ),
  }
}

function validateReference(value: unknown, index: number): WorldTickReference {
  const record = expectRecord(value, `WorldTickResult.references[${index}]`)

  return {
    path: readString(record, "path", `WorldTickResult.references[${index}].path`),
    sectionId: readOptionalString(record, "sectionId", `WorldTickResult.references[${index}].sectionId`),
    reason: readString(record, "reason", `WorldTickResult.references[${index}].reason`),
    usePurpose: readEnum(record, "usePurpose", ALLOWED_USE_PURPOSES, `WorldTickResult.references[${index}].usePurpose`),
    visibility:
      record.visibility === undefined
        ? undefined
        : validateVisibility(record.visibility, `WorldTickResult.references[${index}].visibility`),
  }
}

function validateWarning(value: unknown, index: number): WorldTickWarning {
  const record = expectRecord(value, `WorldTickResult.warnings[${index}]`)

  return {
    code: readString(record, "code", `WorldTickResult.warnings[${index}].code`),
    message: readString(record, "message", `WorldTickResult.warnings[${index}].message`),
    severity: readEnum(record, "severity", ALLOWED_WARNING_SEVERITIES, `WorldTickResult.warnings[${index}].severity`),
  }
}

function assertNoForbiddenOutputKeys(value: unknown, path = "WorldTickResult"): void {
  if (value === null || typeof value !== "object") return

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenOutputKeys(entry, `${path}[${index}]`))
    return
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const forbidden = FORBIDDEN_OUTPUT_KEYS.find((entry) => entry.pattern.test(key))
    if (forbidden) {
      throw new Error(`Invalid WorldTickResult: ${forbidden.message} Forbidden key ${path}.${key}.`)
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
  return readArray(record, key, label)
    .map((entry, index) => {
      if (typeof entry !== "string") {
        throw new Error(`Invalid ${label}[${index}]: must be a string.`)
      }
      return entry.trim()
    })
    .filter(Boolean)
}

function readNonEmptyStringArray(record: Record<string, unknown>, key: string, label: string): string[] {
  const value = readStringArray(record, key, label)
  if (value.length === 0) {
    throw new Error(`Invalid ${label}: must contain at least one string.`)
  }
  return value
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

function readBoolean(record: Record<string, unknown>, key: string, label: string): boolean {
  const value = record[key]
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${label}: must be a boolean.`)
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

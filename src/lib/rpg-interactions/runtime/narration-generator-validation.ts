import type {
  NarrationDisplayPolicy,
  NarrationGeneratorInput,
  NarrationMeta,
  NarrationPacingComplianceStatus,
  NarrationRevealBoundary,
  NarrationSourceRef,
  RuntimeNarrationActionOption,
  TensionBrief,
  TurnNarration,
} from "../../rpg-runtime/types"
import type { RpgKnowledgeScope, RpgNarrativeLine, RpgUsePurpose, RpgVisibilityScope } from "../../rpg-wiki-schema"
import { isConcreteNonPcActorRef, validateRpgKnowledgeClaim } from "../../rpg-runtime/actor-knowledge"

const ALLOWED_ACTION_INTENTS = new Set<RuntimeNarrationActionOption["intent"]>([
  "investigate",
  "talk",
  "fight",
  "move",
  "wait",
  "use_item",
  "custom",
])
const ALLOWED_RISK_LEVELS = new Set<RuntimeNarrationActionOption["riskLevel"]>(["low", "medium", "high"])
const ALLOWED_OPTION_HAPPENED_STATUSES = new Set<RuntimeNarrationActionOption["happenedStatus"]>([
  "possible_future",
  "intention_only",
])
const ALLOWED_PLAYER_KNOWLEDGE_SCOPES = new Set<RuntimeNarrationActionOption["knowledgeScope"]>([
  "pc_known",
  "pc_misunderstanding",
])
const ALLOWED_PLAYER_VISIBILITY_SCOPES = new Set<RuntimeNarrationActionOption["visibilityScope"]>([
  "pc_visible",
  "pc_inferred",
])
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
const ALLOWED_PACING = new Set<NarrationPacingComplianceStatus>([
  "followed",
  "partially_followed",
  "not_applicable",
])
const ALLOWED_TIME_COMPRESSION = new Set<NarrationMeta["timeCompression"]>([
  "none",
  "compressed",
  "expanded",
  "scene_cut",
])
const ALLOWED_SCENE_TRANSITION = new Set<NarrationMeta["sceneTransition"]>([
  "none",
  "soft_transition",
  "hard_cut",
  "new_scene",
])
const ALLOWED_CAMPAIGN_DELTA = new Set<NarrationMeta["campaignDelta"]>([
  "none",
  "minor",
  "meaningful",
  "scene_changing",
])
const ALLOWED_REVEAL_BOUNDARIES = new Set<NarrationRevealBoundary>([
  "allowed_now",
  "hint_only",
  "delay",
  "forbid",
  "parallel_only",
  "gm_only",
])

const FORBIDDEN_OUTPUT_KEYS = [
  /^(?:wikiWrites?|wikiWriteProposal|writeProposal|targetPath|strategy|applyUpdates?|pendingUpdates?)$/i,
  /^(?:proposedUpdates?|proposedWikiUpdates?|ProposedWikiUpdate|ordinaryRuntimeUpdate|runtimeUpdate|runtimeWikiUpdate)$/i,
  /^(?:outlineRevisionProposal|outlineRevision|provisionalOutlinePatch|fullOutline|outlinesMain|mainOutlinePayload)$/i,
  /^(?:eventFacts?|confirmedEvents?|worldFacts?|plotFacts?|styleFacts?)$/i,
] as const

const LEAK_TEXT_PATTERN = /\b(hidden|gm_only|user_visible_pc_unknown|parallelLine-only|parallel-line only)\b/i
const PC_KNOWLEDGE_LEAK_PATTERN =
  /\b(parallelLineText|showParallelLine|parallel line display)\b[\s\S]{0,80}\b(grants PC knowledge|is PC knowledge|becomes PC knowledge|known by PC)\b/i

export function validateTurnNarration(value: unknown, input?: NarrationGeneratorInput): TurnNarration {
  assertNoForbiddenOutputKeys(value)
  const record = expectRecord(value, "TurnNarration")
  assertOnlyTopLevelKeys(record)

  const playerFacingText = readString(record, "playerFacingText", "TurnNarration.playerFacingText")
  rejectKnowledgeLeakText(playerFacingText, "TurnNarration.playerFacingText")

  const parallelLineText = readOptionalString(record, "parallelLineText", "TurnNarration.parallelLineText")
  const tensionBrief = validateTensionBrief(record.tensionBrief)
  const displayPolicy = validateDisplayPolicy(record.displayPolicy)
  const narrationMeta = validateNarrationMeta(record.narrationMeta, input)
  const nextActionOptions = readArray(
    record,
    "nextActionOptions",
    "TurnNarration.nextActionOptions",
  ).map(validateActionOption)
  const references = readArray(record, "references", "TurnNarration.references").map((ref, index) =>
    validateReference(ref, `TurnNarration.references[${index}]`),
  )
  const warnings = readStringArray(record, "warnings", "TurnNarration.warnings")

  if (nextActionOptions.length < 3 || nextActionOptions.length > 5) {
    throw new Error("Invalid TurnNarration.nextActionOptions: must contain 3 to 5 option-only future actions.")
  }
  if (displayPolicy.showParallelLine && !parallelLineText) {
    throw new Error("Invalid TurnNarration: displayPolicy.showParallelLine requires parallelLineText.")
  }
  assertNoPcKnowledgeClaims(value)

  return {
    playerFacingText,
    ...(parallelLineText ? { parallelLineText } : {}),
    tensionBrief,
    displayPolicy,
    narrationMeta,
    nextActionOptions,
    references,
    warnings,
  }
}

function validateDisplayPolicy(value: unknown): NarrationDisplayPolicy {
  const record = expectRecord(value, "TurnNarration.displayPolicy")
  const showPlayerFacingText = readBoolean(record, "showPlayerFacingText", "TurnNarration.displayPolicy.showPlayerFacingText")
  if (showPlayerFacingText !== true) {
    throw new Error("Invalid TurnNarration.displayPolicy.showPlayerFacingText: must be true.")
  }
  const parallelLineGrantsPcKnowledge = readBoolean(
    record,
    "parallelLineGrantsPcKnowledge",
    "TurnNarration.displayPolicy.parallelLineGrantsPcKnowledge",
  )
  if (parallelLineGrantsPcKnowledge !== false) {
    throw new Error("Invalid TurnNarration.displayPolicy: showParallelLine must not grant PC knowledge.")
  }
  const showTensionBriefToPlayer = readBoolean(
    record,
    "showTensionBriefToPlayer",
    "TurnNarration.displayPolicy.showTensionBriefToPlayer",
  )
  if (showTensionBriefToPlayer !== false) {
    throw new Error("Invalid TurnNarration.displayPolicy: tensionBrief is not player-facing text.")
  }
  const tensionBriefIsReviewHandoff = readBoolean(
    record,
    "tensionBriefIsReviewHandoff",
    "TurnNarration.displayPolicy.tensionBriefIsReviewHandoff",
  )
  if (tensionBriefIsReviewHandoff !== true) {
    throw new Error("Invalid TurnNarration.displayPolicy: tensionBrief must remain a runtime/review handoff.")
  }

  return {
    showPlayerFacingText,
    showParallelLine: readBoolean(record, "showParallelLine", "TurnNarration.displayPolicy.showParallelLine"),
    parallelLineGrantsPcKnowledge,
    showTensionBriefToPlayer,
    tensionBriefIsReviewHandoff,
  }
}

function validateTensionBrief(value: unknown): TensionBrief {
  const record = expectRecord(value, "TurnNarration.tensionBrief")
  const runtimeReviewHandoff = readBoolean(record, "runtimeReviewHandoff", "TurnNarration.tensionBrief.runtimeReviewHandoff")
  const ordinaryEventFact = readBoolean(record, "ordinaryEventFact", "TurnNarration.tensionBrief.ordinaryEventFact")
  const playerFacing = readBoolean(record, "playerFacing", "TurnNarration.tensionBrief.playerFacing")
  if (runtimeReviewHandoff !== true || ordinaryEventFact !== false || playerFacing !== false) {
    throw new Error("Invalid TurnNarration.tensionBrief: must be structured runtime/review handoff, not player prose or ordinary event fact.")
  }

  return {
    summary: readString(record, "summary", "TurnNarration.tensionBrief.summary"),
    pressureSignals: readStringArray(record, "pressureSignals", "TurnNarration.tensionBrief.pressureSignals"),
    relationshipSignals: readStringArray(
      record,
      "relationshipSignals",
      "TurnNarration.tensionBrief.relationshipSignals",
    ),
    plotArcSignals: readStringArray(record, "plotArcSignals", "TurnNarration.tensionBrief.plotArcSignals"),
    reviewHandoff: readString(record, "reviewHandoff", "TurnNarration.tensionBrief.reviewHandoff"),
    runtimeReviewHandoff,
    ordinaryEventFact,
    playerFacing,
    references: readArray(record, "references", "TurnNarration.tensionBrief.references").map((ref, index) =>
      validateReference(ref, `TurnNarration.tensionBrief.references[${index}]`),
    ),
  }
}

function validateNarrationMeta(value: unknown, input?: NarrationGeneratorInput): NarrationMeta {
  const record = expectRecord(value, "TurnNarration.narrationMeta")
  const usedProvisionalPatch = readBoolean(
    record,
    "usedProvisionalPatch",
    "TurnNarration.narrationMeta.usedProvisionalPatch",
  )
  const hasHandoff = input?.provisionalNarrationHandoff !== undefined
  if (input && usedProvisionalPatch !== hasHandoff) {
    throw new Error("Invalid TurnNarration.narrationMeta.usedProvisionalPatch: contradicts provisional narration handoff availability.")
  }
  const respectedMustNotReveal = readBoolean(
    record,
    "respectedMustNotReveal",
    "TurnNarration.narrationMeta.respectedMustNotReveal",
  )
  if (respectedMustNotReveal !== true) {
    throw new Error("Invalid TurnNarration.narrationMeta.respectedMustNotReveal: must be true.")
  }
  const styleRemainedNonFact = readBoolean(
    record,
    "styleRemainedNonFact",
    "TurnNarration.narrationMeta.styleRemainedNonFact",
  )
  if (styleRemainedNonFact !== true) {
    throw new Error("Invalid TurnNarration.narrationMeta: style bundle must not become world, plot, or event fact.")
  }

  return {
    narrationId: readString(record, "narrationId", "TurnNarration.narrationMeta.narrationId"),
    usedProvisionalPatch,
    respectedMustNotReveal,
    followedPacingIntent: readEnum(
      record,
      "followedPacingIntent",
      ALLOWED_PACING,
      "TurnNarration.narrationMeta.followedPacingIntent",
    ),
    timeCompression: readEnum(
      record,
      "timeCompression",
      ALLOWED_TIME_COMPRESSION,
      "TurnNarration.narrationMeta.timeCompression",
    ),
    sceneTransition: readEnum(
      record,
      "sceneTransition",
      ALLOWED_SCENE_TRANSITION,
      "TurnNarration.narrationMeta.sceneTransition",
    ),
    campaignDelta: readEnum(
      record,
      "campaignDelta",
      ALLOWED_CAMPAIGN_DELTA,
      "TurnNarration.narrationMeta.campaignDelta",
    ),
    revealBoundary: readEnum(
      record,
      "revealBoundary",
      ALLOWED_REVEAL_BOUNDARIES,
      "TurnNarration.narrationMeta.revealBoundary",
    ),
    playerKnowledgeBoundary: validatePlayerKnowledgeBoundary(record.playerKnowledgeBoundary),
    provisionalPatchUsage:
      record.provisionalPatchUsage === undefined
        ? undefined
        : validateProvisionalPatchUsage(record.provisionalPatchUsage, usedProvisionalPatch),
    styleBundleApplied: readBoolean(record, "styleBundleApplied", "TurnNarration.narrationMeta.styleBundleApplied"),
    styleRemainedNonFact,
    warnings: readStringArray(record, "warnings", "TurnNarration.narrationMeta.warnings"),
  }
}

function validatePlayerKnowledgeBoundary(value: unknown): NarrationMeta["playerKnowledgeBoundary"] {
  const record = expectRecord(value, "TurnNarration.narrationMeta.playerKnowledgeBoundary")
  const parallelLineDoesNotGrantPcKnowledge = readBoolean(
    record,
    "parallelLineDoesNotGrantPcKnowledge",
    "TurnNarration.narrationMeta.playerKnowledgeBoundary.parallelLineDoesNotGrantPcKnowledge",
  )
  const showParallelLineDoesNotGrantPcKnowledge = readBoolean(
    record,
    "showParallelLineDoesNotGrantPcKnowledge",
    "TurnNarration.narrationMeta.playerKnowledgeBoundary.showParallelLineDoesNotGrantPcKnowledge",
  )
  if (parallelLineDoesNotGrantPcKnowledge !== true || showParallelLineDoesNotGrantPcKnowledge !== true) {
    throw new Error("Invalid TurnNarration.narrationMeta.playerKnowledgeBoundary: parallel-line display is not PC knowledge.")
  }

  return {
    boundaryId: readString(record, "boundaryId", "TurnNarration.narrationMeta.playerKnowledgeBoundary.boundaryId"),
    pcKnowledgePath: readExactString(
      record,
      "pcKnowledgePath",
      "wiki/player/known_information.md",
      "TurnNarration.narrationMeta.playerKnowledgeBoundary.pcKnowledgePath",
    ),
    allowedKnowledgeRefs: readArray(
      record,
      "allowedKnowledgeRefs",
      "TurnNarration.narrationMeta.playerKnowledgeBoundary.allowedKnowledgeRefs",
    ).map((ref, index) =>
      validateReference(ref, `TurnNarration.narrationMeta.playerKnowledgeBoundary.allowedKnowledgeRefs[${index}]`),
    ),
    forbiddenVisibilityScopes: readStringArray(
      record,
      "forbiddenVisibilityScopes",
      "TurnNarration.narrationMeta.playerKnowledgeBoundary.forbiddenVisibilityScopes",
    ).map((scope, index) =>
      readEnumValue(
        scope,
        new Set(["user_visible_pc_unknown", "gm_only", "hidden"]),
        `TurnNarration.narrationMeta.playerKnowledgeBoundary.forbiddenVisibilityScopes[${index}]`,
      ),
    ),
    parallelLineDoesNotGrantPcKnowledge,
    showParallelLineDoesNotGrantPcKnowledge,
    notes: readStringArray(record, "notes", "TurnNarration.narrationMeta.playerKnowledgeBoundary.notes"),
  }
}

function validateProvisionalPatchUsage(value: unknown, usedProvisionalPatch: boolean): NarrationMeta["provisionalPatchUsage"] {
  const record = expectRecord(value, "TurnNarration.narrationMeta.provisionalPatchUsage")
  const sameTurnOnly = readBoolean(record, "sameTurnOnly", "TurnNarration.narrationMeta.provisionalPatchUsage.sameTurnOnly")
  const respectedMustNotReveal = readBoolean(
    record,
    "respectedMustNotReveal",
    "TurnNarration.narrationMeta.provisionalPatchUsage.respectedMustNotReveal",
  )
  if (!usedProvisionalPatch) {
    throw new Error("Invalid TurnNarration.narrationMeta.provisionalPatchUsage: cannot appear when usedProvisionalPatch is false.")
  }
  if (sameTurnOnly !== true || respectedMustNotReveal !== true) {
    throw new Error("Invalid TurnNarration.narrationMeta.provisionalPatchUsage: provisional patch constraints were not respected.")
  }

  return {
    usedProvisionalPatch,
    handoffId: readOptionalString(record, "handoffId", "TurnNarration.narrationMeta.provisionalPatchUsage.handoffId"),
    sourcePatchId: readOptionalString(
      record,
      "sourcePatchId",
      "TurnNarration.narrationMeta.provisionalPatchUsage.sourcePatchId",
    ),
    followedMustFollow: readStringArray(
      record,
      "followedMustFollow",
      "TurnNarration.narrationMeta.provisionalPatchUsage.followedMustFollow",
    ),
    respectedMustNotReveal,
    hardConstraintsApplied: readStringArray(
      record,
      "hardConstraintsApplied",
      "TurnNarration.narrationMeta.provisionalPatchUsage.hardConstraintsApplied",
    ),
    sameTurnOnly,
  }
}

function validateActionOption(value: unknown, index: number): RuntimeNarrationActionOption {
  const label = `TurnNarration.nextActionOptions[${index}]`
  const record = expectRecord(value, label)
  if (record.optionOnly !== true) {
    throw new Error(`Invalid ${label}.optionOnly: action options must remain future option material.`)
  }
  if (record.grantsPcKnowledge !== false && record.grantsPcKnowledge !== true) {
    throw new Error(`Invalid ${label}.grantsPcKnowledge: must be boolean.`)
  }

  return {
    id: readString(record, "id", `${label}.id`),
    playerFacingText: readString(record, "playerFacingText", `${label}.playerFacingText`),
    intent: readEnum(record, "intent", ALLOWED_ACTION_INTENTS, `${label}.intent`),
    riskLevel: readEnum(record, "riskLevel", ALLOWED_RISK_LEVELS, `${label}.riskLevel`),
    likelyAffectedPaths: readStringArray(record, "likelyAffectedPaths", `${label}.likelyAffectedPaths`),
    knowledgeScope: readEnum(record, "knowledgeScope", ALLOWED_PLAYER_KNOWLEDGE_SCOPES, `${label}.knowledgeScope`),
    visibilityScope: readEnum(record, "visibilityScope", ALLOWED_PLAYER_VISIBILITY_SCOPES, `${label}.visibilityScope`),
    grantsPcKnowledge: readBoolean(record, "grantsPcKnowledge", `${label}.grantsPcKnowledge`),
    optionOnly: readExactBoolean(record, "optionOnly", true, `${label}.optionOnly`),
    happenedStatus: readEnum(record, "happenedStatus", ALLOWED_OPTION_HAPPENED_STATUSES, `${label}.happenedStatus`),
    sourceRefs: readArray(record, "sourceRefs", `${label}.sourceRefs`).map((ref, refIndex) =>
      validateReference(ref, `${label}.sourceRefs[${refIndex}]`),
    ),
  }
}

function validateReference(value: unknown, label: string): NarrationSourceRef {
  const record = expectRecord(value, label)
  const path = readString(record, "path", `${label}.path`)
  if (!/^(?:wiki|\.llm-wiki\/runtime)\//.test(path) || path.includes("wiki/runtime/")) {
    throw new Error(`Invalid ${label}.path: must be a wiki or runtime reference path, not wiki/runtime.`)
  }
  if (path === "wiki/outlines/main.md") {
    throw new Error(`Invalid ${label}.path: Narration Generator must not receive or output full outlines/main.md payload references.`)
  }

  const knowledgeScope =
    record.knowledgeScope === undefined
      ? undefined
      : readEnum(record, "knowledgeScope", ALLOWED_KNOWLEDGE_SCOPES, `${label}.knowledgeScope`)
  const knowledgeClaims = record.knowledgeClaims === undefined
    ? undefined
    : readArray(record, "knowledgeClaims", `${label}.knowledgeClaims`).map((claim, index) =>
      validateRpgKnowledgeClaim(claim, `${label}.knowledgeClaims[${index}]`),
    )
  if (
    knowledgeScope === "npc_known" &&
    !knowledgeClaims?.some((claim) => claim.holders.some(isConcreteNonPcActorRef))
  ) {
    throw new Error(`Invalid ${label}.knowledgeClaims: npc_known references require concrete npc/faction/group holders.`)
  }

  return {
    path,
    sectionId: readOptionalString(record, "sectionId", `${label}.sectionId`),
    runtimeDeltaId: readOptionalString(record, "runtimeDeltaId", `${label}.runtimeDeltaId`),
    stableId: readOptionalString(record, "stableId", `${label}.stableId`),
    ref: readOptionalString(record, "ref", `${label}.ref`),
    lineTarget:
      record.lineTarget === undefined
        ? undefined
        : readEnum(record, "lineTarget", ALLOWED_NARRATIVE_LINES, `${label}.lineTarget`),
    usePurpose: readEnum(record, "usePurpose", ALLOWED_USE_PURPOSES, `${label}.usePurpose`),
    visibilityScope:
      record.visibilityScope === undefined
        ? undefined
        : readEnum(record, "visibilityScope", ALLOWED_VISIBILITY_SCOPES, `${label}.visibilityScope`),
    knowledgeScope,
    ...(knowledgeClaims ? { knowledgeClaims } : {}),
    reason: readString(record, "reason", `${label}.reason`),
  }
}

function assertNoForbiddenOutputKeys(value: unknown, path = "TurnNarration"): void {
  if (value === null || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenOutputKeys(entry, `${path}[${index}]`))
    return
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_OUTPUT_KEYS.some((pattern) => pattern.test(key))) {
      throw new Error(`Invalid TurnNarration: forbidden wiki/update/outline/fact key ${path}.${key}.`)
    }
    if (typeof child === "string" && /wiki\/outlines\/main\.md|outlines\/main\.md payload|full outline/i.test(child)) {
      throw new Error(`Invalid TurnNarration: forbidden full outline or outlines/main.md payload at ${path}.${key}.`)
    }
    assertNoForbiddenOutputKeys(child, `${path}.${key}`)
  }
}

function assertOnlyTopLevelKeys(record: Record<string, unknown>): void {
  const allowed = new Set([
    "playerFacingText",
    "parallelLineText",
    "tensionBrief",
    "displayPolicy",
    "narrationMeta",
    "nextActionOptions",
    "references",
    "warnings",
  ])
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new Error(`Invalid TurnNarration top-level key: ${key}.`)
    }
  }
}

function assertNoPcKnowledgeClaims(value: unknown): void {
  const text = JSON.stringify(value)
  if (PC_KNOWLEDGE_LEAK_PATTERN.test(text)) {
    throw new Error("Invalid TurnNarration: parallelLineText/displayPolicy.showParallelLine must not be declared as PC knowledge.")
  }
  if (/"style(?:Bundle)?(?:As|Is)?(?:World|Plot|Event)Fact"\s*:\s*true/i.test(text)) {
    throw new Error("Invalid TurnNarration: style bundle must not become world, plot, or event fact.")
  }
}

function rejectKnowledgeLeakText(value: string, label: string): void {
  if (LEAK_TEXT_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: player-facing text leaks hidden, gm_only, user_visible_pc_unknown, or parallelLine-only material.`)
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

function readArray(record: Record<string, unknown>, key: string, label: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}: must be an array.`)
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

function readExactBoolean<T extends boolean>(
  record: Record<string, unknown>,
  key: string,
  expected: T,
  label: string,
): T {
  const value = readBoolean(record, key, label)
  if (value !== expected) {
    throw new Error(`Invalid ${label}: must be ${expected}.`)
  }
  return value as T
}

function readExactString<T extends string>(
  record: Record<string, unknown>,
  key: string,
  expected: T,
  label: string,
): T {
  const value = readString(record, key, label)
  if (value !== expected) {
    throw new Error(`Invalid ${label}: must be ${expected}.`)
  }
  return value as T
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

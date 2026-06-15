import type {
  ActionResolution,
  OutlineAwareNarrationBrief,
  OutlineImpactReport,
  OutlineRevisionProposal,
  PostActionWorkingState,
  ProvisionalOutlinePatch,
  RecalledMaterial,
  RecallSelection,
  RegenerationSafetyReport,
  RegenerationRequest,
  SubmittedAction,
  TurnSemanticHandoff,
  TurnNarration,
  WorldTickResult,
  WorldTickVisibleSelection,
} from "./types"
import { buildTurnSemanticHandoff } from "./turn-semantic-handoff"
import { buildWorldTickSemanticHandoff } from "./world-tick-working-state"

export type RpgActionIntent =
  | "investigate"
  | "talk"
  | "fight"
  | "move"
  | "wait"
  | "use_item"
  | "custom"

export type RpgRiskLevel = "low" | "medium" | "high"

export interface RpgActionOption {
  id: string
  playerFacingText: string
  intent: RpgActionIntent
  riskLevel: RpgRiskLevel
  likelyAffectedPaths: string[]
}

export interface RpgTurnResult {
  narrative: string
  nextActionOptions: RpgActionOption[]
  references: string[]
}

export interface RpgTurnRecord {
  submittedAction: SubmittedAction
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
  turnSemanticHandoff?: TurnSemanticHandoff
  recallSelection: RecallSelection
  recalledMaterials: RecalledMaterial[]
  outlineAwareNarrationBrief: OutlineAwareNarrationBrief
  outlineImpactReport: OutlineImpactReport
  regenerationRequest?: RegenerationRequest
  provisionalOutlinePatch?: ProvisionalOutlinePatch
  outlineRevisionProposal?: OutlineRevisionProposal
  regenerationSafetyReport?: RegenerationSafetyReport
  turnNarration?: TurnNarration
  generatedNarrative: string
  references: string[]
}

export interface CreateRpgTurnRecordInput {
  submittedAction: SubmittedAction
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
  turnSemanticHandoff: TurnSemanticHandoff
  recallSelection: RecallSelection
  recalledMaterials: RecalledMaterial[]
  outlineAwareNarrationBrief: OutlineAwareNarrationBrief
  outlineImpactReport: OutlineImpactReport
  regenerationRequest?: RegenerationRequest
  provisionalOutlinePatch?: ProvisionalOutlinePatch
  outlineRevisionProposal?: OutlineRevisionProposal
  regenerationSafetyReport?: RegenerationSafetyReport
  turnNarration: TurnNarration
  turnResult: RpgTurnResult
}

const ALLOWED_RPG_REFERENCE_DIRS = new Set([
  "sources",
  "world",
  "characters",
  "player",
  "locations",
  "factions",
  "items",
  "plot-arcs",
  "events",
  "current-scene",
  "relationships",
  "style",
  "rules",
  "memory",
  "quests",
])

const LEGACY_REFERENCE_DIRS = new Set([
  "entities",
  "concepts",
  "queries",
  "comparisons",
  "synthesis",
  "methodology",
  "findings",
  "thesis",
])

const ALLOWED_ACTION_INTENTS = new Set<RpgActionIntent>([
  "investigate",
  "talk",
  "fight",
  "move",
  "wait",
  "use_item",
  "custom",
])

const ALLOWED_RISK_LEVELS = new Set<RpgRiskLevel>(["low", "medium", "high"])

export function createRpgTurnRecord(input: CreateRpgTurnRecordInput): RpgTurnRecord {
  const turnSemanticHandoff = input.turnSemanticHandoff ?? buildTurnSemanticHandoff({
    submittedAction: input.submittedAction,
    actionResolution: input.actionResolution,
    worldTickResult: input.worldTickResult,
    visibleSelection: input.visibleSelection,
    postActionWorkingState: input.postActionWorkingState,
    worldTickSemanticHandoff: buildWorldTickSemanticHandoff({
      submittedAction: input.submittedAction,
      actionResolution: input.actionResolution,
      worldTickResult: input.worldTickResult,
      visibleSelection: input.visibleSelection,
      postActionWorkingState: input.postActionWorkingState,
    }),
  })
  return {
    submittedAction: input.submittedAction,
    actionResolution: input.actionResolution,
    worldTickResult: input.worldTickResult,
    visibleSelection: input.visibleSelection,
    postActionWorkingState: input.postActionWorkingState,
    turnSemanticHandoff,
    recallSelection: input.recallSelection,
    recalledMaterials: input.recalledMaterials,
    outlineAwareNarrationBrief: input.outlineAwareNarrationBrief,
    outlineImpactReport: input.outlineImpactReport,
    ...(input.regenerationRequest ? { regenerationRequest: input.regenerationRequest } : {}),
    ...(input.provisionalOutlinePatch ? { provisionalOutlinePatch: input.provisionalOutlinePatch } : {}),
    ...(input.outlineRevisionProposal ? { outlineRevisionProposal: input.outlineRevisionProposal } : {}),
    ...(input.regenerationSafetyReport ? { regenerationSafetyReport: input.regenerationSafetyReport } : {}),
    turnNarration: input.turnNarration,
    generatedNarrative: input.turnNarration.playerFacingText,
    references: cleanRpgReferences([
      ...input.turnResult.references,
      ...input.turnNarration.references.map((reference) => reference.path),
      ...input.turnNarration.tensionBrief.references.map((reference) => reference.path),
      ...input.actionResolution.references.map((reference) => reference.path),
      ...input.worldTickResult.references.map((reference) => reference.path),
      ...input.postActionWorkingState.references,
      ...input.outlineAwareNarrationBrief.references.map((reference) => reference.path),
      ...(input.regenerationRequest?.sourceRefs.map((reference) => reference.path) ?? []),
    ]),
  }
}

export function createTurnResultFromTurnNarration(turnNarration: TurnNarration): RpgTurnResult {
  return validateRpgTurnResult({
    narrative: turnNarration.playerFacingText,
    nextActionOptions: turnNarration.nextActionOptions.map((option) => ({
      id: option.id,
      playerFacingText: option.playerFacingText,
      intent: option.intent,
      riskLevel: option.riskLevel,
      likelyAffectedPaths: option.likelyAffectedPaths,
    })),
    references: turnNarration.references.map((reference) => reference.path),
  })
}

export function validateRpgTurnResult(value: unknown): RpgTurnResult {
  const result = expectRecord(value, "RpgTurnResult")

  if (typeof result.narrative !== "string" || result.narrative.trim().length === 0) {
    throw new Error("Invalid RpgTurnResult: narrative must be a non-empty string.")
  }

  if (!Array.isArray(result.nextActionOptions)) {
    throw new Error("Invalid RpgTurnResult: nextActionOptions must be an array.")
  }

  if (result.nextActionOptions.length < 3 || result.nextActionOptions.length > 5) {
    throw new Error("Invalid RpgTurnResult: nextActionOptions must contain 3 to 5 options.")
  }

  const nextActionOptions = result.nextActionOptions.map((option, index) => {
    const record = expectRecord(option, `RpgTurnResult.nextActionOptions[${index}]`)

    if (typeof record.id !== "string" || record.id.trim().length === 0) {
      throw new Error(`Invalid RpgTurnResult: option ${index} id must be a non-empty string.`)
    }
    if (typeof record.playerFacingText !== "string" || record.playerFacingText.trim().length === 0) {
      throw new Error(`Invalid RpgTurnResult: option ${index} playerFacingText must be a non-empty string.`)
    }
    if (typeof record.intent !== "string" || !ALLOWED_ACTION_INTENTS.has(record.intent as RpgActionIntent)) {
      throw new Error(`Invalid RpgTurnResult: option ${index} intent is not allowed.`)
    }
    if (typeof record.riskLevel !== "string" || !ALLOWED_RISK_LEVELS.has(record.riskLevel as RpgRiskLevel)) {
      throw new Error(`Invalid RpgTurnResult: option ${index} riskLevel is not allowed.`)
    }
    if (!Array.isArray(record.likelyAffectedPaths) || !record.likelyAffectedPaths.every((path) => typeof path === "string")) {
      throw new Error(`Invalid RpgTurnResult: option ${index} likelyAffectedPaths must be a string array.`)
    }

    return {
      id: record.id.trim(),
      playerFacingText: record.playerFacingText.trim(),
      intent: record.intent as RpgActionIntent,
      riskLevel: record.riskLevel as RpgRiskLevel,
      likelyAffectedPaths: record.likelyAffectedPaths.map((path) => path.trim()).filter(Boolean),
    }
  })

  if (!Array.isArray(result.references) || !result.references.every((reference) => typeof reference === "string")) {
    throw new Error("Invalid RpgTurnResult: references must be a string array.")
  }

  return {
    narrative: result.narrative.trim(),
    nextActionOptions,
    references: cleanRpgReferences(result.references),
  }
}

export function cleanRpgReferences(references: string[]): string[] {
  return [...new Set(references.map(normalizeReference).filter(isAllowedRpgReference))].sort()
}

function normalizeReference(reference: string): string {
  return reference.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/^\/+/, "")
}

function isAllowedRpgReference(reference: string): boolean {
  const parts = reference.split("/")
  if (parts.length < 3 || parts[0] !== "wiki") return false

  const dir = parts[1]
  if (LEGACY_REFERENCE_DIRS.has(dir)) return false
  return ALLOWED_RPG_REFERENCE_DIRS.has(dir)
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an object.`)
  }
  return value as Record<string, unknown>
}

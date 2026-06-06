import type { SubmittedAction } from "./types"

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
  generatedNarrative: string
  references: string[]
}

export interface CreateRpgTurnRecordInput {
  submittedAction: SubmittedAction
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

export function createRpgTurnRecord(input: CreateRpgTurnRecordInput): RpgTurnRecord {
  return {
    submittedAction: input.submittedAction,
    generatedNarrative: input.turnResult.narrative,
    references: cleanRpgReferences(input.turnResult.references),
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

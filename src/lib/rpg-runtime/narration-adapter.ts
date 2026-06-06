import type { RpgNarrationPrompt } from "./narration-prompts"
import { cleanRpgReferences, type RpgActionIntent, type RpgRiskLevel, type RpgTurnResult } from "./turn-model"

export interface RpgNarrationAdapter {
  generateTurn(prompt: RpgNarrationPrompt): Promise<RpgTurnResult>
}

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

export function createFixtureNarrationAdapter(turnResult: RpgTurnResult): RpgNarrationAdapter {
  return {
    async generateTurn() {
      return turnResult
    },
  }
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

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an object.`)
  }
  return value as Record<string, unknown>
}

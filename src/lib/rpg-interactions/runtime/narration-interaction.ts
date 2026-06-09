import { validateRpgTurnResult } from "./narration-adapter"
import type { RpgTurnResult } from "../../rpg-runtime/turn-model"
import type { CompactStoryBrief } from "../../rpg-runtime/types"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"

export interface BuildRpgNarrationPromptInput {
  brief: CompactStoryBrief
}

export type RpgNarrationPrompt = RpgInteractionPrompt

const ALLOWED_ACTION_INTENTS = ["investigate", "talk", "fight", "move", "wait", "use_item", "custom"] as const
const ALLOWED_RISK_LEVELS = ["low", "medium", "high"] as const

export const narrationInteractionSpec: RpgInteractionSpec<BuildRpgNarrationPromptInput, RpgTurnResult> = {
  kind: "narration",
  buildPrompt(input) {
    const { brief } = input

    return {
      systemPrompt: [
        "You are the dedicated llmWikiRPG narration runtime, separate from normal wiki QA chat.",
        "Generate only the player-facing continuation for one RPG turn.",
        "Use brief.submittedAction as the only submitted player action for this turn.",
        "Do not treat any proposed nextActionOptions as events that have already happened.",
        "Unchosen nextActionOptions are candidate future actions only; they must not appear inside narrative as completed outcomes.",
        "A later state extraction step may use only SubmittedAction + generated narrative as factual input.",
        "That later state extraction step must not extract facts from unchosen nextActionOptions.",
        "Do not perform wiki writes, current-scene changes, event logging, relationship updates, or update proposal generation.",
        "",
        "Return strict JSON matching this RpgTurnResult shape:",
        "Required fields: narrative: string; nextActionOptions: RpgActionOption[]; references: string[].",
        "{",
        "  \"narrative\": string,",
        "  \"nextActionOptions\": RpgActionOption[],",
        "  \"references\": string[]",
        "}",
        "",
        "RpgActionOption fields:",
        "- id: string",
        "- playerFacingText: string",
        "- intent: one of investigate, talk, fight, move, wait, use_item, custom",
        "- riskLevel: one of low, medium, high",
        "- likelyAffectedPaths: string[]",
        "",
        "Produce 3 to 5 nextActionOptions.",
        "Allowed intent values: " + ALLOWED_ACTION_INTENTS.join(", ") + ".",
        "Allowed riskLevel values: " + ALLOWED_RISK_LEVELS.join(", ") + ".",
        "references must list only brief references that materially supported the narrative or options.",
      ].join("\n"),
      userPrompt: [
        "# RPG Narration Brief",
        "",
        "## Submitted Action",
        formatSubmittedAction(brief),
        "",
        "## Current Scene",
        formatText(brief.currentScene),
        "",
        "## Player State",
        formatText(brief.playerState),
        "",
        "## Hard Facts",
        formatList(brief.hardFacts),
        "",
        "## Active Constraints",
        formatList(brief.activeConstraints),
        "",
        "## Present Characters",
        formatList(brief.presentCharacters),
        "",
        "## Relationship Tensions",
        formatList(brief.relationshipTensions),
        "",
        "## Active Plot Pressure",
        formatList(brief.activePlotPressure),
        "",
        "## Outline Notes",
        formatList(brief.outlineNotes),
        "",
        "## Active Quests",
        formatList(brief.activeQuests),
        "",
        "## Relevant Locations",
        formatList(brief.relevantLocations),
        "",
        "## Relevant Factions",
        formatList(brief.relevantFactions),
        "",
        "## Relevant Items",
        formatList(brief.relevantItems),
        "",
        "## Style Rules",
        formatList(brief.styleRules),
        "",
        "## Rule Notes",
        formatList(brief.ruleNotes),
        "",
        "## Memory Notes",
        formatList(brief.memoryNotes),
        "",
        "## Forbidden Contradictions",
        formatList(brief.forbiddenContradictions),
        "",
        "## References",
        formatList(brief.references),
        "",
        "Write the continuation caused by the submitted action above, then offer 3 to 5 candidate future actions.",
      ].join("\n"),
    }
  },
  parseOutput(output) {
    return parseRpgNarrationOutput(output)
  },
}

export function buildRpgNarrationPrompt(input: BuildRpgNarrationPromptInput): RpgNarrationPrompt {
  return narrationInteractionSpec.buildPrompt(input)
}

export function parseRpgNarrationOutput(output: string): RpgTurnResult {
  if (output.trim().length === 0) {
    throw new Error("RPG narration interaction received empty LLM output.")
  }

  const jsonText = extractJsonObjectText(output)

  if (!jsonText) {
    throw new Error("RPG narration interaction could not find a JSON object in LLM output.")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText) as RpgTurnResult
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG narration interaction failed to parse RpgTurnResult JSON: ${message}`)
  }

  try {
    return validateRpgTurnResult(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG narration interaction received invalid RpgTurnResult: ${message}`)
  }
}

function formatSubmittedAction(brief: CompactStoryBrief): string {
  const action = brief.submittedAction
  const lines = [`id: ${formatInline(action.id)}`, `text: ${formatInline(action.text)}`, `source: ${action.source}`]
  if (action.selectedOptionId) {
    lines.push(`selectedOptionId: ${formatInline(action.selectedOptionId)}`)
  }
  return lines.join("\n")
}

function formatText(value: string): string {
  return value.trim() || "None provided."
}

function formatList(values: readonly string[]): string {
  const cleaned = values.map((value) => value.trim()).filter(Boolean)
  if (cleaned.length === 0) return "- None provided."
  return cleaned.map((value) => `- ${value}`).join("\n")
}

function formatInline(value: string): string {
  return JSON.stringify(value)
}

function extractJsonObjectText(output: string): string | null {
  const fenced = extractFencedJsonCandidate(output)
  if (fenced !== null) {
    const fencedObject = findFirstBalancedJsonObject(fenced)
    if (fencedObject !== null) return fencedObject
  }

  return findFirstBalancedJsonObject(output)
}

function extractFencedJsonCandidate(output: string): string | null {
  const jsonFence = /```json\s*([\s\S]*?)```/i.exec(output)
  if (jsonFence) return jsonFence[1]

  const genericFence = /```\s*([\s\S]*?)```/.exec(output)
  return genericFence?.[1] ?? null
}

function findFirstBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{")
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === "\\") {
        escaped = true
      } else if (char === "\"") {
        inString = false
      }
      continue
    }

    if (char === "\"") {
      inString = true
      continue
    }

    if (char === "{") {
      depth += 1
    } else if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, index + 1)
      }
    }
  }

  return null
}

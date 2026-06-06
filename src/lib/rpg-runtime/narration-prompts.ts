import type { CompactStoryBrief } from "./types"

export interface BuildRpgNarrationPromptInput {
  brief: CompactStoryBrief
}

export interface RpgNarrationPrompt {
  systemPrompt: string
  userPrompt: string
}

const ALLOWED_ACTION_INTENTS = ["investigate", "talk", "fight", "move", "wait", "use_item", "custom"] as const
const ALLOWED_RISK_LEVELS = ["low", "medium", "high"] as const

export function buildRpgNarrationPrompt(input: BuildRpgNarrationPromptInput): RpgNarrationPrompt {
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

function formatList(values: string[]): string {
  const cleaned = values.map((value) => value.trim()).filter(Boolean)
  if (cleaned.length === 0) return "- None provided."
  return cleaned.map((value) => `- ${value}`).join("\n")
}

function formatInline(value: string): string {
  return JSON.stringify(value)
}

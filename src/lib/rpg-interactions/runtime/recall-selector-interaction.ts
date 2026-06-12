import type { RecallSelection, RecallSelectorInput } from "../../rpg-runtime/types"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"
import { validateRecallSelection } from "./recall-selector-validation"

export type RpgRecallSelectorPrompt = RpgInteractionPrompt

export const recallSelectorInteractionSpec: RpgInteractionSpec<RecallSelectorInput, RecallSelection> = {
  kind: "recall_selector",
  buildPrompt(input) {
    return {
      systemPrompt: [
        "You are the llmWikiRPG Recall Selector interaction for LLM 3 / Step 13.",
        "Recall Selector is based on the post-action PostActionWorkingState, not old current-scene coarse recall.",
        "Your only job is to output a recall plan / deterministic file-read allowlist candidate.",
        "You cannot read files.",
        "You cannot include recalled file contents or full text.",
        "You cannot generate narration.",
        "You cannot write wiki.",
        "You cannot generate update proposal output.",
        "You cannot generate wikiWrites, wikiWriteProposal, proposedUpdates, or pendingUpdates.",
        "You cannot generate Outline-aware Brief, Outline Impact, Outline Regeneration, outlineBrief, outlineImpactReport, outlineRevision, outlineRevisionProposal, provisionalOutlinePatch, or regenerationRequest output.",
        "Do not enter LLM 4.",
        "selectedItems.sections must reference stable sectionId values from RetrievalIndexEntry.availableSections; never rely only on natural-language headings.",
        "Every selected item must mark lineTarget, visibilityScope, knowledgeScope, priority, reason, and expectedUse.",
        "Every selected section must mark sectionId, priority, reason, and expectedUse.",
        "Exclusions must explain omitted known paths / sections.",
        "parallelLine or user_visible_pc_unknown material must never be marked as PC knowledge.",
        "Return only strict RecallSelection JSON.",
        "",
        "RecallSelection shape:",
        "{",
        "  \"selectionId\": string,",
        "  \"sourceWorkingStateId\": string,",
        "  \"selectedItems\": [",
        "    {",
        "      \"path\": string,",
        "      \"lineTarget\": \"playerVisibleLine\" | \"parallelLine\" | \"tensionLine\",",
        "      \"readMode\": \"summary\" | \"focusedSection\" | \"fullPage\" | \"metadataOnly\",",
        "      \"priority\": \"critical\" | \"high\" | \"medium\" | \"low\",",
        "      \"reason\": string,",
        "      \"expectedUse\": string,",
        "      \"visibilityScope\": \"pc_visible\" | \"pc_inferred\" | \"user_visible_pc_unknown\" | \"gm_only\" | \"hidden\",",
        "      \"knowledgeScope\": \"pc_known\" | \"pc_misunderstanding\" | \"npc_known\" | \"user_only\" | \"gm_only\" | \"unknown_to_pc\",",
        "      \"sections\": [{ \"sectionId\": string, \"reason\": string, \"expectedUse\": string, \"priority\": string }]",
        "    }",
        "  ],",
        "  \"exclusions\": [{ \"path\": string, \"sectionIds\": string[], \"reason\": string }],",
        "  \"recallBudget\": RecallBudget,",
        "  \"recallPolicy\": RecallPolicy,",
        "  \"warnings\": string[]",
        "}",
      ].join("\n"),
      userPrompt: [
        "# Recall Selector Input",
        "",
        "Use only this structured input. Do not read wiki files, do not inspect the filesystem, and do not assume material outside retrievalIndex.",
        "",
        "## PostActionWorkingState",
        "This is the action-after-world-tick working state and the only recall anchor.",
        formatJson(input.postActionWorkingState),
        "",
        "## ActionResolution",
        formatJson(input.actionResolution ?? input.postActionWorkingState.actionResolution),
        "",
        "## WorldTickResult",
        formatJson(input.worldTickResult ?? input.postActionWorkingState.worldTickResult),
        "",
        "## WorldTickVisibleSelection",
        formatJson(input.visibleSelection ?? input.postActionWorkingState.visibleSelection),
        "",
        "## Pacing State",
        formatJson(input.pacingState ?? input.postActionWorkingState.pacingState),
        "",
        "## Gap State",
        formatJson(input.gapState ?? input.postActionWorkingState.gapState),
        "",
        "## Retrieval Index",
        "Select only paths and sectionId values present here.",
        formatJson(input.retrievalIndex),
        "",
        "## Recall Budget",
        formatJson(input.recallBudget),
        "",
        "## Recall Policy",
        formatJson(input.recallPolicy),
        "",
        "Return RecallSelection JSON only.",
      ].join("\n"),
    }
  },
  parseOutput(output, input) {
    return parseRpgRecallSelectionOutput(output, input)
  },
}

export function buildRecallSelectorPrompt(input: RecallSelectorInput): RpgRecallSelectorPrompt {
  return recallSelectorInteractionSpec.buildPrompt(input)
}

export function parseRpgRecallSelectionOutput(output: string, input: RecallSelectorInput): RecallSelection {
  if (output.trim().length === 0) {
    throw new Error("RPG Recall Selector interaction received empty LLM output.")
  }

  const jsonText = extractJsonObjectText(output)
  if (!jsonText) {
    throw new Error("RPG Recall Selector interaction could not find a JSON object in LLM output.")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText) as RecallSelection
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Recall Selector interaction failed to parse RecallSelection JSON: ${message}`)
  }

  try {
    return validateRecallSelection(parsed, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Recall Selector interaction received invalid RecallSelection: ${message}`)
  }
}

function formatJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n")
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

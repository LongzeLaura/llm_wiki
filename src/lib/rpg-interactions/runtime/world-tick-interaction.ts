import type { WorldTickInput, WorldTickResult } from "../../rpg-runtime/types"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"
import { validateWorldTickResult } from "./world-tick-validation"

export type RpgWorldTickPrompt = RpgInteractionPrompt

export const worldTickInteractionSpec: RpgInteractionSpec<WorldTickInput, WorldTickResult> = {
  kind: "world_tick",
  buildPrompt(input) {
    return {
      systemPrompt: [
        "You are the llmWikiRPG World Tick + Reaction interaction.",
        "Action Resolver owns player-action-only adjudication.",
        "Consume ActionResolution.playerActionDelta as the canonical player-action-only delta.",
        "World Tick consumes playerActionDelta as-is.",
        "Do not reinterpret or re-adjudicate the player action.",
        "Do not derive canonical player facts from directResults.",
        "Only advance the resolved timeDelta interval.",
        "Advance world clocks, ongoing events, information propagation, NPC reactions, pacing pressure, and preliminary gap signals during that interval.",
        "Classify every world delta into playerVisibleLine, parallelLine, or tensionLine.",
        "Parallel-line display is not PC knowledge; user-visible parallel information must remain separate from wiki/player/known_information.md unless explicitly broadcast to the PC.",
        "Every delta-like object must include narrativeLine, visibility, visibility.visibilityScope, visibility.knowledgeScope, happenedStatus, affectedPaths, and runtimeDeltaRefs.",
        "no wiki write",
        "no player-facing narration",
        "no nextActionOptions",
        "no Recall Selector output",
        "no Outline revision",
        "Do not output proposedUpdates, pendingUpdates, wikiWrites, wikiWriteProposal, targetPath, strategy, narration, playerFacingText, parallelLineText, nextActionOptions, recallSelection, selectedItems, retrievalIndex, recalledMaterials, outlineRevision, outlineRevisionProposal, provisionalOutlinePatch, or regenerationRequest.",
        "World Tick does not write wiki, does not run Recall Selector, does not revise outlines, and does not generate player-visible prose.",
        "Return only strict WorldTickResult JSON.",
        "",
        "WorldTickResult shape:",
        "{",
        "  \"tickId\": string,",
        "  \"sourceActionResolutionId\": string,",
        "  \"timeAdvance\": { \"sourceTimeDelta\": ActionResolution.timeDelta, \"appliedSummary\": string, \"clockReasoning\": string },",
        "  \"worldDeltas\": {",
        "    \"playerVisibleLine\": WorldTickWorldDelta[],",
        "    \"parallelLine\": WorldTickWorldDelta[],",
        "    \"tensionLine\": WorldTickWorldDelta[]",
        "  },",
        "  \"clockUpdates\": WorldTickClockUpdate[],",
        "  \"settledOngoingEvents\": WorldTickSettledOngoingEvent[],",
        "  \"informationBroadcast\": WorldTickInformationBroadcast[],",
        "  \"reactionQueue\": WorldTickReactionQueueEntry[],",
        "  \"pacingUpdate\": WorldTickPacingUpdate,",
        "  \"gapState\": WorldTickGapState,",
        "  \"runtimeDeltaRefs\": RuntimeDeltaRef[],",
        "  \"references\": WorldTickReference[],",
        "  \"warnings\": WorldTickWarning[]",
        "}",
      ].join("\n"),
      userPrompt: [
        "# World Tick Input",
        "",
        "Use only the structured input below. Do not read wiki files or assume external state.",
        "",
        "## Submitted Action",
        formatJson(input.submittedAction),
        "",
        "## ActionResolution",
        formatJson(input.actionResolution),
        "",
        "## Canonical Player Action Delta",
        "This is the only canonical player-action delta. Do not recompute it from directResults.",
        formatJson(input.playerActionDelta),
        "",
        "## Resolved Time Delta",
        "Advance only this interval.",
        formatJson(input.timeDelta),
        "",
        "## Pre-Action Runtime References",
        formatJson(input.preActionRefs),
        "",
        "## Post-Action Runtime References",
        formatJson(input.postActionRefs),
        "",
        "## Active Clocks",
        formatJson(input.activeClocks),
        "",
        "## Ongoing Events",
        formatJson(input.ongoingEvents),
        "",
        "## Pacing State",
        formatJson(input.pacingState),
        "",
        "## Gap Signals",
        formatJson(input.gapSignals),
        "",
        "## Visibility Policy",
        formatJson(input.visibilityPolicy),
        "",
        "## Runtime Delta Refs",
        formatJson(input.runtimeRefs),
        "",
        "Return WorldTickResult JSON only.",
      ].join("\n"),
    }
  },
  parseOutput(output) {
    return parseRpgWorldTickOutput(output)
  },
}

export function buildWorldTickPrompt(input: WorldTickInput): RpgWorldTickPrompt {
  return worldTickInteractionSpec.buildPrompt(input)
}

export function parseRpgWorldTickOutput(output: string): WorldTickResult {
  if (output.trim().length === 0) {
    throw new Error("RPG World Tick interaction received empty LLM output.")
  }

  const jsonText = extractJsonObjectText(output)
  if (!jsonText) {
    throw new Error("RPG World Tick interaction could not find a JSON object in LLM output.")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText) as WorldTickResult
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG World Tick interaction failed to parse WorldTickResult JSON: ${message}`)
  }

  try {
    return validateWorldTickResult(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG World Tick interaction received invalid WorldTickResult: ${message}`)
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

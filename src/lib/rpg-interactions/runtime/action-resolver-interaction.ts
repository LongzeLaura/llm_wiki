import type { ActionResolution, ActionResolverInput } from "../../rpg-runtime/types"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"
import { validateActionResolution } from "./action-resolver-validation"

export type RpgActionResolverPrompt = RpgInteractionPrompt

export const actionResolverInteractionSpec: RpgInteractionSpec<ActionResolverInput, ActionResolution> = {
  kind: "action_resolver",
  buildPrompt(input) {
    return {
      systemPrompt: [
        "You are the llmWikiRPG Action Resolver interaction.",
        "Your only job is to parse and adjudicate the submitted player action as structured JSON.",
        "The player action is an attempt, not an automatic success event.",
        "Default eventDraft.status to attempted_not_confirmed unless the action text or pre-action snapshot explicitly confirms it already happened.",
        "If you use confirmed_happened, include eventDraft.confirmationBasis explaining the explicit confirmation.",
        "Separate feasibility, cost, obstacle, and direct result. Do not hide costs or obstacles inside feasibility prose.",
        "Resolve only direct results caused by the submitted player action.",
        "Do not advance offscreen clocks, parallel plots, NPC plans, or pacing beyond the submitted action.",
        "no world tick",
        "no wiki write",
        "no player-facing narration",
        "Do not output World Tick, Reaction Queue, information broadcast, update proposal, pending update, next action options, or prose narration.",
        "PlayerActionDelta must contain only player-action-caused changes; no world tick, no wiki write, and no player-facing narration.",
        "timeDelta must be derived from the action, rules, distance, scene constraints, and active clocks; it must not be a generic one-turn/one-minute default.",
        "progressPotential must explain whether the action can advance the campaign, reveal information, change position, spend resources, or trigger outline-gap pressure.",
        "references and warnings must be separate arrays.",
        "",
        "Return only strict JSON matching this ActionResolution shape:",
        "{",
        "  \"resolutionId\": string,",
        "  \"submittedActionId\": string,",
        "  \"parsedIntent\": {",
        "    \"intentKind\": \"attack\" | \"move\" | \"talk\" | \"investigate\" | \"observe\" | \"rescue\" | \"use_item\" | \"wait\" | \"prepare\" | \"mixed\" | \"custom\",",
        "    \"actorRef\": string,",
        "    \"targetRefs\": string[],",
        "    \"actionScope\": string,",
        "    \"declaredGoal\": string,",
        "    \"timeJumpSignal\": string | undefined,",
        "    \"ambiguityNotes\": string[]",
        "  },",
        "  \"eventDraft\": {",
        "    \"eventId\": string,",
        "    \"eventType\": string,",
        "    \"summary\": string,",
        "    \"status\": \"attempted_not_confirmed\" | \"confirmed_happened\" | \"ongoing\" | \"blocked\" | \"failed\" | \"possible_future\" | \"intention_only\" | \"misunderstanding\",",
        "    \"confirmationBasis\": string | undefined,",
        "    \"actorRefs\": string[],",
        "    \"targetRefs\": string[],",
        "    \"affectedRefs\": string[],",
        "    \"riskSummary\": string,",
        "    \"requiredChecks\": string[],",
        "    \"ambiguityNotes\": string[]",
        "  },",
        "  \"feasibility\": {",
        "    \"status\": \"feasible\" | \"partially_feasible\" | \"requires_cost\" | \"blocked\" | \"uncertain\",",
        "    \"rationale\": string,",
        "    \"limitingFactors\": string[],",
        "    \"requiredChecks\": string[],",
        "    \"alternativeResults\": string[]",
        "  },",
        "  \"costs\": ActionResolverCost[],",
        "  \"obstacles\": ActionResolverObstacle[],",
        "  \"directResults\": ActionResolverDirectResult[],",
        "  \"timeDelta\": { \"scale\": string, \"unit\": string, \"min\": number | undefined, \"max\": number | undefined, \"summary\": string, \"reasoning\": string },",
        "  \"progressPotential\": { \"level\": \"none\" | \"low\" | \"medium\" | \"high\" | \"major\", \"summary\": string, \"possibleUnlocks\": string[], \"gapTriggerPotential\": \"none\" | \"minor\" | \"branch\" | \"major\" },",
        "  \"playerActionDelta\": {",
        "    \"deltaId\": string,",
        "    \"causedByActionId\": string,",
        "    \"scope\": \"player_action_only\",",
        "    \"positionChanges\": string[],",
        "    \"resourceChanges\": string[],",
        "    \"inventoryChanges\": string[],",
        "    \"conditionChanges\": string[],",
        "    \"knowledgeChanges\": string[],",
        "    \"relationshipSignals\": string[],",
        "    \"sceneChanges\": string[],",
        "    \"interruptedEvents\": string[],",
        "    \"exposedInformation\": string[],",
        "    \"runtimeDeltaRefs\": RuntimeDeltaRef[],",
        "    \"notes\": string[]",
        "  },",
        "  \"runtimeDeltaRefs\": RuntimeDeltaRef[],",
        "  \"references\": ActionResolverReference[],",
        "  \"warnings\": ActionResolverWarning[]",
        "}",
      ].join("\n"),
      userPrompt: [
        "# Action Resolver Input",
        "",
        "Use the submitted action and frozen pre-action snapshot below. Do not read or assume any wiki state outside this input.",
        "",
        "## Submitted Action",
        formatSubmittedAction(input),
        "",
        "## Pre-Action Snapshot",
        formatJson(input.preActionSnapshot),
        "",
        "## Relevant Rules",
        formatJson(input.relevantRules),
        "",
        "## Fixed Slot Refs",
        formatJson(input.fixedSlotRefs),
        "",
        "## Recent Turn Summary",
        input.recentTurnSummary?.trim() || "None provided.",
        "",
        "## Runtime Refs",
        formatJson(input.runtimeRefs),
        "",
        "Return ActionResolution JSON only.",
      ].join("\n"),
    }
  },
  parseOutput(output) {
    return parseRpgActionResolverOutput(output)
  },
}

export function buildActionResolverPrompt(input: ActionResolverInput): RpgActionResolverPrompt {
  return actionResolverInteractionSpec.buildPrompt(input)
}

export function parseRpgActionResolverOutput(output: string): ActionResolution {
  if (output.trim().length === 0) {
    throw new Error("RPG Action Resolver interaction received empty LLM output.")
  }

  const jsonText = extractJsonObjectText(output)
  if (!jsonText) {
    throw new Error("RPG Action Resolver interaction could not find a JSON object in LLM output.")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText) as ActionResolution
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Action Resolver interaction failed to parse ActionResolution JSON: ${message}`)
  }

  try {
    return validateActionResolution(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Action Resolver interaction received invalid ActionResolution: ${message}`)
  }
}

function formatSubmittedAction(input: ActionResolverInput): string {
  const action = input.submittedAction
  const lines = [`id: ${formatInline(action.id)}`, `text: ${formatInline(action.text)}`, `source: ${action.source}`]
  if (action.selectedOptionId) {
    lines.push(`selectedOptionId: ${formatInline(action.selectedOptionId)}`)
  }
  return lines.join("\n")
}

function formatJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n")
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

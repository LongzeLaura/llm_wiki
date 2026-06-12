import type { NarrationGeneratorInput, TurnNarration } from "../../rpg-runtime/types"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"
import { validateTurnNarration } from "./narration-generator-validation"

export type RpgNarrationGeneratorPrompt = RpgInteractionPrompt

export const narrationGeneratorInteractionSpec: RpgInteractionSpec<NarrationGeneratorInput, TurnNarration> = {
  kind: "narration_generator",
  buildPrompt(input) {
    return {
      systemPrompt: [
        "You are the llmWikiRPG LLM 5 Narration Generator interaction contract.",
        "This is a runtime-only contract layer, not wiki writer/apply/UI/orchestrator wiring.",
        "Return strict JSON matching TurnNarration only.",
        "",
        "Consume these runtime inputs only:",
        "- PostActionWorkingState",
        "- ActionResolution",
        "- WorldTickResult",
        "- WorldTickVisibleSelection",
        "- OutlineAwareNarrationBrief",
        "- optional provisionalNarrationHandoff derived from provisionalOutlinePatch.narrationHandoff",
        "- RecallSelection",
        "- recalledMaterials",
        "- style bundle",
        "- forbidden narration constraints",
        "- player knowledge boundary",
        "- references / runtime refs",
        "",
        "TurnNarration must distinguish playerFacingText, parallelLineText, tensionBrief, displayPolicy, narrationMeta, nextActionOptions, and references.",
        "playerFacingText must not leak parallelLine-only, hidden, gm_only, or user_visible_pc_unknown material.",
        "parallelLineText may be shown to the real user, but parallel line display is not PC knowledge.",
        "displayPolicy.showParallelLine controls display only and does not change the fact layer.",
        "tensionBrief is runtime / review handoff, not ordinary event fact and not player prose.",
        "narrationMeta must support later Step 16 validation: usedProvisionalPatch, respectedMustNotReveal, followedPacingIntent, time compression, scene transition, campaign delta, reveal boundary, and player knowledge boundary.",
        "provisionalOutlinePatch.narrationHandoff is optional hard constraint input only.",
        "Do not rewrite PostActionWorkingState, WorldTickResult, or ActionResolution.",
        "outlineRevisionProposal is not Narration fact material.",
        "Do not output wiki writes, ordinary runtime updates, ProposedWikiUpdate, outlineRevisionProposal, provisionalOutlinePatch, full outline content, or outlines/main.md content.",
        "Style bundle controls narration texture only; style does not become world facts, plot facts, event facts, or wiki facts.",
        "Unchosen nextActionOptions are candidate future actions only and must not be marked as already happened facts.",
        "",
        "Required TurnNarration JSON shape:",
        "{",
        "  \"playerFacingText\": string,",
        "  \"parallelLineText\"?: string,",
        "  \"tensionBrief\": TensionBrief,",
        "  \"displayPolicy\": NarrationDisplayPolicy,",
        "  \"narrationMeta\": NarrationMeta,",
        "  \"nextActionOptions\": RuntimeNarrationActionOption[],",
        "  \"references\": NarrationSourceRef[],",
        "  \"warnings\": string[]",
        "}",
      ].join("\n"),
      userPrompt: [
        "# NarrationGeneratorInput",
        "",
        "Use the structured runtime handoff below. Return TurnNarration JSON only.",
        "",
        "## PostActionWorkingState",
        formatJson(input.postActionWorkingState),
        "",
        "## ActionResolution",
        formatJson(input.actionResolution),
        "",
        "## WorldTickResult",
        formatJson(input.worldTickResult),
        "",
        "## WorldTickVisibleSelection",
        formatJson(input.visibleSelection),
        "",
        "## OutlineAwareNarrationBrief",
        formatJson(input.outlineAwareNarrationBrief),
        "",
        "## provisionalOutlinePatch.narrationHandoff / provisionalNarrationHandoff",
        "Optional hard constraints only. Do not output provisionalOutlinePatch.",
        input.provisionalNarrationHandoff ? formatJson(input.provisionalNarrationHandoff) : "None provided.",
        "",
        "## RecallSelection",
        formatJson(input.recallSelection),
        "",
        "## recalledMaterials",
        formatJson(input.recalledMaterials),
        "",
        "## style bundle",
        "Style controls prose only; style does not become world / plot facts.",
        formatJson(input.styleBundle),
        "",
        "## forbidden narration constraints",
        formatJson(input.forbiddenNarrationConstraints),
        "",
        "## player knowledge boundary",
        "parallel line display is not PC knowledge.",
        formatJson(input.playerKnowledgeBoundary),
        "",
        "## references / runtime refs",
        formatJson({ references: input.references, runtimeRefs: input.runtimeRefs }),
      ].join("\n"),
    }
  },
  parseOutput(output, input) {
    return parseRpgNarrationGeneratorOutput(output, input)
  },
}

export function buildNarrationGeneratorPrompt(input: NarrationGeneratorInput): RpgNarrationGeneratorPrompt {
  return narrationGeneratorInteractionSpec.buildPrompt(input)
}

export function parseRpgNarrationGeneratorOutput(
  output: string,
  input?: NarrationGeneratorInput,
): TurnNarration {
  if (output.trim().length === 0) {
    throw new Error("RPG Narration Generator interaction received empty LLM output.")
  }

  const jsonText = extractJsonObjectText(output)
  if (!jsonText) {
    throw new Error("RPG Narration Generator interaction could not find a JSON object in LLM output.")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText) as TurnNarration
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Narration Generator interaction failed to parse TurnNarration JSON: ${message}`)
  }

  try {
    return validateTurnNarration(parsed, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Narration Generator interaction received invalid TurnNarration: ${message}`)
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

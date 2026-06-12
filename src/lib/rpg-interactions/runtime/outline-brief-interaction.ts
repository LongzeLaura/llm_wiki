import type {
  OutlineBriefCompilerInput,
  OutlineBriefCompilerOutput,
} from "../../rpg-runtime/types"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"
import {
  REGENERATION_REQUEST_AUDIT_ONLY_LINE,
  STORY_OUTLINE_REGENERATOR_NOT_TRIGGERED_LINE,
} from "./llm4-handoff-boundary"
import { validateOutlineBriefCompilerOutput } from "./outline-brief-validation"

export type RpgOutlineBriefPrompt = RpgInteractionPrompt

export const outlineBriefInteractionSpec: RpgInteractionSpec<
  OutlineBriefCompilerInput,
  OutlineBriefCompilerOutput
> = {
  kind: "outline_brief",
  buildPrompt(input) {
    return {
      systemPrompt: [
        "You are the llmWikiRPG Outline-aware Brief Compiler + Outline Impact Detector for LLM 4 / Step 14.",
        "Your job is to compile a line-specific narration brief and detect outline impact.",
        "Input recalledMaterials are the Recall Selector filtered handoff, not complete outline authority.",
        "Use only the structured input below and the deterministic recalledMaterials handoff.",
        "Do not directly read files; file reading only happened in the previous deterministic reader stage.",
        "Do not change ActionResolution, WorldTickResult, PostActionWorkingState, RecallSelection, or recalledMaterials.",
        "Do not generate player-facing narrative prose.",
        "Do not generate nextActionOptions.",
        "Do not write wiki.",
        "Do not generate runtime update proposal output.",
        "Do not generate wikiWrites, wikiWriteProposal, proposedUpdates, or pendingUpdates.",
        "Do not generate outlineRevision, outlineRevisionProposal, provisionalOutlinePatch, fullOutlineText, rawOutline, or fileContent.",
        `${STORY_OUTLINE_REGENERATOR_NOT_TRIGGERED_LINE} Only output a regenerationRequest when impactLevel is major_rewrite_required and requiresRegeneration is true.`,
        REGENERATION_REQUEST_AUDIT_ONLY_LINE,
        "Do not perform Narration Generator three-line prose generation.",
        "Do not perform Runtime Update Proposal work.",
        "Do not turn GM-only, hidden, parallelLine-only, or user_visible_pc_unknown material into PC knowledge.",
        "parallelLineBrief must explicitly not grant PC knowledge.",
        "playerFacingBrief must only contain PC-visible or PC-inferred guidance.",
        "tensionBriefInput is for relationship, emotional, pacing, and plot-arc fuel; it is not player-facing prose.",
        "references must only use paths, sectionIds, stableIds, or runtimeDeltaIds present in the input.",
        "Return only strict JSON.",
        "",
        "Allowed top-level JSON shape:",
        "{",
        "  \"outlineAwareNarrationBrief\": {",
        "    \"briefId\": string,",
        "    \"sourceWorkingStateId\": string,",
        "    \"playerFacingBrief\": PlayerFacingBrief,",
        "    \"parallelLineBrief\": ParallelLineBrief,",
        "    \"tensionBriefInput\": TensionBriefInput,",
        "    \"revealPolicies\": OutlineRevealPolicyDirective[],",
        "    \"forbiddenNarrationBoundary\": ForbiddenNarrationItem[],",
        "    \"pacingDirective\": OutlinePacingDirective,",
        "    \"campaignDeltaRequirement\": CampaignDeltaRequirement,",
        "    \"references\": OutlineBriefReference[]",
        "  },",
        "  \"outlineImpactReport\": {",
        "    \"impactLevel\": \"none\" | \"minor\" | \"branch\" | \"major_rewrite_required\",",
        "    \"affected\": { \"lines\": [], \"beats\": [], \"reveals\": [], \"branchConditions\": [], \"plotArcs\": [], \"tensionLine\": [] },",
        "    \"invalidatedAssumptions\": string[],",
        "    \"reason\": string,",
        "    \"requiresRegeneration\": boolean",
        "  },",
        "  \"regenerationRequest\": optional audit/control RegenerationRequest for major_rewrite_required only,",
        "  \"warnings\": string[]",
        "}",
      ].join("\n"),
      userPrompt: [
        "# Outline-aware Brief Compiler Input",
        "",
        "Use only this structured input. Do not inspect the filesystem.",
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
        "## RecallSelection",
        formatJson(input.recallSelection),
        "",
        "## recalledMaterials",
        "These are filtered handoff materials from deterministic local reads, not full outline authority and not accepted wiki facts.",
        formatJson(input.recalledMaterials),
        "",
        "## Pacing State",
        formatJson(input.pacingState),
        "",
        "## Gap State",
        formatJson(input.gapState),
        "",
        "## Reaction Queue",
        formatJson(input.reactionQueue),
        "",
        "## Visibility Boundaries",
        formatJson(input.visibilityBoundaries),
        "",
        "## Outline Slices",
        "Use stable beat/reveal/branch condition ids, dependency/invalidation metadata, line targets, and reveal policies only from these slices.",
        formatJson(input.outlineSlices),
        "",
        "## Plot-arc Tension Fuel",
        formatJson(input.plotArcTensionFuel),
        "",
        "## Hard Constraints Metadata",
        formatJson(input.hardConstraints),
        "",
        "## Known Runtime Refs",
        formatJson(input.runtimeRefs),
        "",
        "## Known References",
        formatJson(input.knownReferences),
        "",
        "Return OutlineBriefCompilerOutput JSON only.",
      ].join("\n"),
    }
  },
  parseOutput(output, input) {
    return parseRpgOutlineBriefOutput(output, input)
  },
}

export function buildOutlineBriefPrompt(input: OutlineBriefCompilerInput): RpgOutlineBriefPrompt {
  return outlineBriefInteractionSpec.buildPrompt(input)
}

export function parseRpgOutlineBriefOutput(
  output: string,
  input: OutlineBriefCompilerInput,
): OutlineBriefCompilerOutput {
  if (output.trim().length === 0) {
    throw new Error("RPG Outline Brief interaction received empty LLM output.")
  }

  const jsonText = extractJsonObjectText(output)
  if (!jsonText) {
    throw new Error("RPG Outline Brief interaction could not find a JSON object in LLM output.")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText) as OutlineBriefCompilerOutput
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Outline Brief interaction failed to parse OutlineBriefCompilerOutput JSON: ${message}`)
  }

  try {
    return validateOutlineBriefCompilerOutput(parsed, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Outline Brief interaction received invalid OutlineBriefCompilerOutput: ${message}`)
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

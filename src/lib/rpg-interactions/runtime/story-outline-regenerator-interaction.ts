import type {
  StoryOutlineRegeneratorInput,
  StoryOutlineRegeneratorOutput,
} from "../../rpg-runtime/types"
import type { RpgInteractionPrompt, RpgInteractionSpec } from "../interaction-spec"
import { validateStoryOutlineRegeneratorOutput } from "./story-outline-regenerator-validation"

export type RpgStoryOutlineRegeneratorPrompt = RpgInteractionPrompt

export const storyOutlineRegeneratorInteractionSpec: RpgInteractionSpec<
  StoryOutlineRegeneratorInput,
  StoryOutlineRegeneratorOutput
> = {
  kind: "outline_regeneration",
  buildPrompt(input) {
    return {
      systemPrompt: [
        "You are the llmWikiRPG Story Outline Regenerator for conditional Step 14.5.",
        "You run only after Outline-aware Brief Compiler reports impactLevel major_rewrite_required and requiresRegeneration true.",
        "Your input is a runtime/review handoff: OutlineImpactReport, RegenerationRequest, post-action working state, recalled outline slices, plot-arc tension fuel, runtime refs, confirmed fact boundaries, and forbidden reveal boundaries.",
        "Your output is not accepted wiki fact state.",
        "provisionalOutlinePatch is same-turn only. It does not write wiki/, does not modify wiki/outlines/main.md, and does not mean wiki/outlines/main.md already changed.",
        "provisionalOutlinePatch.narrationHandoff is a hard constraint for later Step 15 Narration, but you must not generate narration here.",
        "outlineRevisionProposal is an independent pending/review item with reviewItemKind outlineRevision.",
        "outlineRevisionProposal is not a ProposedWikiUpdate, not runtimeWikiUpdate, not an ordinary runtime update, and cannot be mixed into ordinary runtime update.",
        "Do not output player-facing prose, narration, visible narration, parallel-line prose, or nextActionOptions.",
        "Do not output wikiWrites, wikiWriteProposal, proposedUpdates, pendingUpdates, runtimeUpdate, runtimeWikiUpdate, or direct write target paths.",
        "Do not directly modify wiki/outlines/main.md or claim that it was modified.",
        "Do not write future plans, proposed beats, or possible revisions into wiki/events/ or mark them confirmed_happened.",
        "Do not rewrite confirmed facts from the input boundaries.",
        "Do not leak forbidden reveal, hidden, gm_only, parallelLine-only, or user_visible_pc_unknown material into PC knowledge.",
        "All refs must come from the structured input: runtimeDeltaRefs, outline refs, recalled materials, visibility boundaries, hard constraints, or knownReferences.",
        "Return only strict JSON.",
        "",
        "Allowed top-level JSON shape:",
        "{",
        "  \"provisionalOutlinePatch\": ProvisionalOutlinePatch,",
        "  \"outlineRevisionProposal\": OutlineRevisionProposal,",
        "  \"regenerationSafetyReport\": RegenerationSafetyReport,",
        "  \"warnings\": string[]",
        "}",
      ].join("\n"),
      userPrompt: [
        "# Story Outline Regenerator Input",
        "",
        "Use only this structured input. Do not inspect the filesystem.",
        "",
        "## OutlineImpactReport",
        formatJson(input.outlineImpactReport),
        "",
        "## RegenerationRequest",
        formatJson(input.regenerationRequest),
        "",
        "## PostActionWorkingState",
        formatJson(input.postActionWorkingState),
        "",
        "## RecalledMaterials",
        "These are filtered deterministic handoff materials, not permission to read or rewrite full outline files.",
        formatJson(input.recalledMaterials),
        "",
        "## Outline Slices",
        "Use only stable beat/reveal/branch ids present here. Do not target wiki/outlines/main.md for direct modification.",
        formatJson(input.outlineSlices),
        "",
        "## Plot-arc Tension Fuel",
        formatJson(input.plotArcTensionFuel),
        "",
        "## Visibility Boundaries",
        "Hidden, gm_only, parallelLine-only, and user_visible_pc_unknown material must not become PC knowledge.",
        formatJson(input.visibilityBoundaries),
        "",
        "## Hard Constraints",
        formatJson(input.hardConstraints),
        "",
        "## Confirmed Fact Boundaries",
        "Every confirmed fact must be preserved and must not be invalidated, rewritten, or moved into future-only revision text.",
        formatJson(input.confirmedFacts),
        "",
        "## Forbidden Reveal Boundaries",
        "Forbidden reveals may appear only in protection fields such as mustNotReveal or safety refs.",
        formatJson(input.forbiddenReveals),
        "",
        "## Runtime Refs",
        formatJson(input.runtimeRefs),
        "",
        "## Known References",
        formatJson(input.knownReferences),
        "",
        "Return StoryOutlineRegeneratorOutput JSON only.",
      ].join("\n"),
    }
  },
  parseOutput(output, input) {
    return parseRpgStoryOutlineRegeneratorOutput(output, input)
  },
}

export function buildStoryOutlineRegeneratorPrompt(
  input: StoryOutlineRegeneratorInput,
): RpgStoryOutlineRegeneratorPrompt {
  return storyOutlineRegeneratorInteractionSpec.buildPrompt(input)
}

export function parseRpgStoryOutlineRegeneratorOutput(
  output: string,
  input: StoryOutlineRegeneratorInput,
): StoryOutlineRegeneratorOutput {
  if (output.trim().length === 0) {
    throw new Error("RPG Story Outline Regenerator interaction received empty LLM output.")
  }

  const jsonText = extractJsonObjectText(output)
  if (!jsonText) {
    throw new Error("RPG Story Outline Regenerator interaction could not find a JSON object in LLM output.")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText) as StoryOutlineRegeneratorOutput
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Story Outline Regenerator interaction failed to parse JSON: ${message}`)
  }

  try {
    return validateStoryOutlineRegeneratorOutput(parsed, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG Story Outline Regenerator interaction received invalid output: ${message}`)
  }
}

function formatJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n")
}

function extractJsonObjectText(output: string): string | undefined {
  const fenced = output.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]?.trim()) {
    return fenced[1].trim()
  }

  const start = output.indexOf("{")
  const end = output.lastIndexOf("}")
  if (start < 0 || end < start) return undefined
  return output.slice(start, end + 1).trim()
}

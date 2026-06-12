import type {
  RuntimeUpdateProposalInput,
  RuntimeUpdateProposalResult,
} from "../../rpg-runtime/types"
import { getRpgRuntimeCrossDirectorySyncGuidance } from "../../rpg-wiki-schema"
import type { RpgInteractionSpec } from "../interaction-spec"
import { parseAndValidateRuntimeUpdateProposalResult } from "./runtime-update-proposal-validation"

export type BuildRuntimeUpdateInteractionInput = RuntimeUpdateProposalInput

export type RuntimeUpdateInteractionResult = RuntimeUpdateProposalResult

export const runtimeUpdateInteractionSpec: RpgInteractionSpec<
  BuildRuntimeUpdateInteractionInput,
  RuntimeUpdateInteractionResult
> = {
  kind: "runtime_update_proposal",
  buildPrompt(input) {
    const proposalInput = input

    return {
      systemPrompt: [
        "You are the llmWikiRPG Runtime Update Proposal interaction, LLM 6 in the 19-step runtime flow.",
        "Your task is to convert already-settled current-turn structures into reviewable RuntimeUpdateProposalResult JSON.",
        "Primary factual sources are the structured current-turn inputs: PostActionWorkingState, ActionResolution, WorldTickResult, WorldTickVisibleSelection, TurnNarration, consistencyValidation, recall handoff, and outline handoff.",
        "generatedNarrative and playerFacingText are display/evidence material. They are not the only fact source and must not override settled structured deltas.",
        "Use actionResolution, worldTickResult, visibleSelection, postActionWorkingState, outlineAwareNarrationBrief, outlineImpactReport, recalledMaterials, and turnNarration before relying on prose wording.",
        "outlineImpactReport and provisionalOutlinePatch may explain current-turn outline impact and narration constraints, but they do not authorize direct main-outline writes.",
        "outlineRevisionProposal can only become independent outlineRevisionReviewItems. It must never be mixed into ordinary proposedWikiUpdates and must never auto-write wiki/outlines/main.md.",
        "parallelLineText and user_visible_pc_unknown material may be user-visible evidence, but they do not automatically grant PC knowledge and must not automatically update wiki/player/known_information.md.",
        "nextActionOptions are candidate future actions, not facts. Do not use them as happened events, current state, player goals, quests, or plot progress.",
        "attempted_not_confirmed cannot enter confirmed events. Only confirmed_happened event deltas may target wiki/events/*.md.",
        "possible_future, intention_only, foreshadowing, future plans, and candidate actions cannot be written as confirmed facts.",
        "You may only propose updates. Do not claim that anything has already been written to the wiki.",
        "Output only allowed runtime target paths and their required strategies.",
        "Stable, manual, base, and legacy paths are forbidden.",
        "Forbidden examples include wiki/world/, wiki/style/, wiki/rules/, wiki/sources/, base wiki/characters/*.md, base wiki/locations/*.md, base wiki/factions/*.md, base wiki/items/*.md, and legacy entities/concepts/queries/comparisons/synthesis/methodology/findings/thesis paths.",
        "Self-check each proposal before output: the path must match the content semantics in this single generation pass.",
        "Do not output proposals that would need another LLM review, retry, or repair. There will be no second LLM validation round.",
        "events updates must contain only confirmed happened events and immediate consequences; never include future plans, candidate actions, unchosen options, next actions, possible futures, or foreshadowing.",
        "current-scene must be a compact latest-moment snapshot only; never include long-term lore, full character sheets, event logs, complete timelines, or route recaps.",
        "Cross-directory sync contract:",
        "current-scene is the compact latest-moment snapshot; long-term state must not live only in current-scene.",
        "When the completed turn confirms a persistent NPC change, also propose wiki/characters/runtime/*.md.",
        "When the completed turn confirms a persistent location change, also propose wiki/locations/runtime/*.md.",
        "When the completed turn confirms a persistent faction stance/resource/alert change, also propose wiki/factions/runtime/*.md.",
        "When the completed turn confirms object-level item state, also propose wiki/items/runtime/*.md.",
        "When the completed turn confirms relationship trust/tension/conflict/secret/misunderstanding changes, also propose wiki/relationships/runtime/*.md.",
        "When the completed turn changes plot arc runtime state, triggered/skipped/delayed/advanced beats, pressure, or resolution, also propose wiki/plot-arcs/runtime/*.md.",
        "When the completed turn changes player holdings, quantities, equipment, loss, acquisition, or consumption, propose wiki/player/inventory.md.",
        "When the completed turn changes play progress relative to the outline, propose wiki/outlines/progress.md.",
        "First-version runtime sync does not auto-create missing updates; missing companion updates become deterministic validator warnings or review signals only.",
        "relationships/runtime updates must record relationship deltas, trust, tension, conflicts, secrets, misunderstandings, and constraints; never repeat full biographies, appearance sheets, or ability profiles.",
        "player/goals.md is for PC subjective motives, wishes, promises, and personal priorities; do not store quest progress, player TODO/checklists, candidate actions, or plot pressure there.",
        "quests are game-recognized trackable objectives with blockers/progress and completion/failure conditions; do not treat any goal, subjective wish, or player TODO/checklist as a quest.",
        "plot-arcs/runtime updates are for runtime story pressure, unresolved conflict, foreshadowing status, reveal pacing, progression conditions, possible developments, and beat progress; never use them as player TODO/checklists or quest ledgers.",
        "player/inventory.md is for current holdings, quantities, equipped/backpack status, and consumption/damage state; item definitions and object-level runtime state belong in items/runtime/.",
        "Forbidden runtime targets include base wiki/relationships/*.md, base wiki/plot-arcs/*.md, wiki/outlines/main.md, wiki/style/, wiki/rules/, wiki/sources/, wiki/world/, and base wiki/characters/*.md, wiki/locations/*.md, wiki/factions/*.md, wiki/items/*.md.",
        "runtime overlay updates must preserve accepted runtime state only; do not store candidate actions, stable setting pages, global style rules, or control rules there.",
        "Narration is responsible for player-visible story and future action options; this interaction is only for runtime update proposal review material.",
        "Pending, apply, and write policy remain deterministic safety boundaries after this proposal step.",
        "All ordinary proposedWikiUpdates must include sourceDeltas, lineTarget, visibility, knowledgeScope, happenedStatus, confidence, and validationHints.",
        "The only accepted output contract is structured JSON.",
        "",
        "Code-readable runtime cross-directory sync guidance:",
        formatRuntimeSyncGuidance(),
        "",
        "Output exactly one JSON object with this top-level shape:",
        "{",
        '  "proposedWikiUpdates": [],',
        '  "outlineRevisionReviewItems": [],',
        '  "journalEntries": [],',
        '  "skippedDeltas": [],',
        '  "pacingUpdateProposal": null,',
        '  "proposalGroups": [],',
        '  "warnings": []',
        "}",
        "",
        "Each ordinary proposedWikiUpdates[] item must include: id, targetPath, strategy, reason, content, sourceTurnId, references, sourceDeltas, lineTarget, visibility, knowledgeScope, happenedStatus, confidence, validationHints.",
        "Each sourceDeltas[] item must include: deltaId, sourceStage, summary, lineTarget, visibility, knowledgeScope, happenedStatus, usePurpose, affectedPaths, runtimeDeltaRefs.",
        "If no safe ordinary updates exist, return proposedWikiUpdates: [] and explain skipped structured deltas in skippedDeltas.",
      ].join("\n"),
      userPrompt: [
        "# Runtime Update Proposal Input",
        "",
        "Use the structured current-turn sources below as the fact boundary. Prose fields are evidence and display material.",
        "",
        "## Submitted Action",
        formatSubmittedAction(proposalInput),
        "",
        "## Structured Current-Turn Sources",
        formatJson({
          postActionWorkingState: proposalInput.postActionWorkingState,
          actionResolution: proposalInput.actionResolution,
          worldTickResult: proposalInput.worldTickResult,
          visibleSelection: proposalInput.visibleSelection,
          recallSelection: proposalInput.recallSelection,
          recalledMaterials: proposalInput.recalledMaterials,
          outlineAwareNarrationBrief: proposalInput.outlineAwareNarrationBrief,
          outlineImpactReport: proposalInput.outlineImpactReport,
          provisionalOutlinePatch: proposalInput.provisionalOutlinePatch,
          outlineRevisionProposal: proposalInput.outlineRevisionProposal,
          turnNarration: proposalInput.turnNarration,
          consistencyValidation: proposalInput.consistencyValidation,
        }),
        "",
        "## Display / Evidence Text",
        "generatedNarrative:",
        formatText(proposalInput.turnRecord.generatedNarrative),
        "",
        "playerFacingText:",
        formatText(proposalInput.turnNarration?.playerFacingText ?? ""),
        "",
        "parallelLineText:",
        formatText(proposalInput.turnNarration?.parallelLineText ?? ""),
        "",
        "## References",
        formatList(proposalInput.turnRecord.references),
        "",
        "## Allowed Runtime Update Target Rules",
        formatAllowedTargets(proposalInput.allowedTargets),
        "",
        "## Write Policy",
        formatJson(proposalInput.writePolicy),
        "",
        "## Review Policy",
        formatJson(proposalInput.reviewPolicy),
        "",
        "## Local Validation Boundary",
        "This stage only parses JSON and performs structure/boundary checks.",
        "Do not stage pending updates, do not apply updates, do not write wiki files, and do not modify writer/apply/UI behavior.",
      ].join("\n"),
    }
  },
  parseOutput(output, input) {
    const proposalInput = input
    return parseAndValidateRuntimeUpdateProposalResult(output, proposalInput)
  },
}

function formatSubmittedAction(input: RuntimeUpdateProposalInput): string {
  const action = input.turnRecord.submittedAction
  const lines = [`id: ${formatInline(action.id)}`, `text: ${formatInline(action.text)}`, `source: ${action.source}`]
  if (action.selectedOptionId) {
    lines.push(`selectedOptionId: ${formatInline(action.selectedOptionId)}`)
  }
  return lines.join("\n")
}

function formatAllowedTargets(allowedTargets: readonly RuntimeUpdateProposalInput["allowedTargets"][number][]): string {
  if (allowedTargets.length === 0) return "- None. Do not output update blocks."
  return allowedTargets
    .map((rule) => `- ${rule.pathPattern} | strategy: ${rule.strategy} | ${rule.description}`)
    .join("\n")
}

function formatRuntimeSyncGuidance(): string {
  return getRpgRuntimeCrossDirectorySyncGuidance()
    .map((entry) => {
      const targets = entry.requiredTargets.join(", ")
      const guidance = entry.guidance.map((line) => `  - ${line}`).join("\n")
      return `- ${entry.syncId}: ${entry.trigger} Required targets: ${targets}.\n${guidance}`
    })
    .join("\n")
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

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

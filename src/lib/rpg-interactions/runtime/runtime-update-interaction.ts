import { extractRpgStateUpdates, type ProposedWikiUpdate } from "../../rpg-runtime/state-extractor"
import type { RpgTurnRecord } from "../../rpg-runtime/turn-model"
import { getRpgRuntimeCrossDirectorySyncGuidance } from "../../rpg-wiki-schema"
import type { RpgInteractionSpec } from "../interaction-spec"
import { RPG_WIKI_UPDATE_FENCE } from "./runtime-update-protocol"
import { getRpgRuntimeUpdateTargetRules, type RpgRuntimeUpdateTargetRule } from "./wiki-update-policy"

export interface BuildRuntimeUpdateInteractionInput {
  turnRecord: RpgTurnRecord
  allowedTargets?: readonly RpgRuntimeUpdateTargetRule[]
}

export interface RuntimeUpdateInteractionResult {
  proposedUpdates: ProposedWikiUpdate[]
  warnings: string[]
}

export const runtimeUpdateInteractionSpec: RpgInteractionSpec<
  BuildRuntimeUpdateInteractionInput,
  RuntimeUpdateInteractionResult
> = {
  kind: "runtime_state_update",
  buildPrompt(input) {
    const allowedTargets = input.allowedTargets ?? getRpgRuntimeUpdateTargetRules()
    const turnRecord = input.turnRecord

    return {
      systemPrompt: [
        "You are the llmWikiRPG runtime state update interaction.",
        "Your task is to propose wiki updates from one completed RPG turn record.",
        "Use only the completed turn record fields: submittedAction, generatedNarrative, and references.",
        "The factual source is strictly submittedAction + generatedNarrative + references.",
        "Do not use, infer from, or mention unchosen nextActionOptions as facts.",
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
        "Narration is responsible for player-visible story and future action options; this interaction is only for ProposedWikiUpdate candidates.",
        "Pending, apply, and write policy remain deterministic safety boundaries after this proposal step.",
        "",
        "Code-readable runtime cross-directory sync guidance:",
        formatRuntimeSyncGuidance(),
        "",
        "Use this first-version fenced output protocol for each proposed update:",
        "```" + RPG_WIKI_UPDATE_FENCE,
        "targetPath: wiki/current-scene/scene_state.md",
        "strategy: overwrite",
        "reason: One concise reason grounded in the completed turn.",
        "---",
        "Markdown content for the proposed update.",
        "```",
        "",
        `If there are no safe updates, output no ${RPG_WIKI_UPDATE_FENCE} blocks.`,
      ].join("\n"),
      userPrompt: [
        "# Completed RPG Turn Record",
        "",
        "Only the data in this completed turn record may be used as factual input.",
        "There is intentionally no nextActionOptions section here; unchosen options are future candidates, not events.",
        "",
        "## Submitted Action",
        formatSubmittedAction(turnRecord),
        "",
        "## Generated Narrative",
        formatText(turnRecord.generatedNarrative),
        "",
        "## References",
        formatList(turnRecord.references),
        "",
        "## Allowed Runtime Update Target Rules",
        formatAllowedTargets(allowedTargets),
        "",
        "## Local Validation Boundary",
        "After this single update generation, deterministic path-aware lint will run before pending staging.",
        "Rejected proposals will be skipped and reported for review instead of entering the pending queue.",
        "Warning-only proposals may enter pending, but the warning remains visible in the controller result and runtime journal.",
      ].join("\n"),
    }
  },
  parseOutput(output, input) {
    return extractRpgStateUpdates({
      turnRecord: {
        submittedAction: input.turnRecord.submittedAction,
        generatedNarrative: output,
        references: input.turnRecord.references,
      },
    })
  },
}

function formatSubmittedAction(turnRecord: RpgTurnRecord): string {
  const action = turnRecord.submittedAction
  const lines = [`id: ${formatInline(action.id)}`, `text: ${formatInline(action.text)}`, `source: ${action.source}`]
  if (action.selectedOptionId) {
    lines.push(`selectedOptionId: ${formatInline(action.selectedOptionId)}`)
  }
  return lines.join("\n")
}

function formatAllowedTargets(allowedTargets: readonly RpgRuntimeUpdateTargetRule[]): string {
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

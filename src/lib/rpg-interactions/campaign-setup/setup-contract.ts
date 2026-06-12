import { getFileStem } from "@/lib/path-utils"
import { getRpgSchemaSlot } from "@/lib/rpg-wiki-schema"
import { makeQuerySlug } from "@/lib/wiki-filename"

export const CAMPAIGN_SETUP_IMPORT_TARGET_SLOTS = [
  "player_main",
  "player_abilities",
  "player_inventory",
  "player_goals",
  "player_known_information",
  "current_scene",
  "events_prologue",
  "main_quest",
  "quest",
  "player_relationship",
] as const

export type CampaignSetupImportTargetSlot = (typeof CAMPAIGN_SETUP_IMPORT_TARGET_SLOTS)[number]
export type CampaignSetupWritePolicy = "merge" | "overwrite" | "append"
export type CampaignSetupContentType = "player" | "current-scene" | "event" | "quest" | "relationship"

export interface CampaignSetupImportSlotResolutionInput {
  sourceFileName?: string
  options?: Record<string, unknown>
}

export interface CampaignSetupSlotDefinition {
  slotId: CampaignSetupImportTargetSlot
  title: string
  targetPath: string
  writePolicy: CampaignSetupWritePolicy
  reviewPolicy: string
  canonicalizationNote: string
  contentType: CampaignSetupContentType
}

export interface CampaignSetupImportContract {
  mode: "campaign_setup_import"
  kind: "campaign_setup_import_contract"
  supportedSlots: readonly CampaignSetupImportTargetSlot[]
  usesLlmByDefault: false
  writePolicies: Record<CampaignSetupImportTargetSlot, CampaignSetupWritePolicy>
  reviewBoundaryNotes: readonly string[]
  canonicalizationBoundaryNotes: readonly string[]
  futurePressureBoundaryNotes: readonly string[]
  abilityLikeInputReviewBoundaryNotes: readonly string[]
  currentSceneBootstrapBoundaryNotes: readonly string[]
}

export const CAMPAIGN_SETUP_REVIEW_BOUNDARY_NOTES = [
  "campaign_setup_import is campaign bootstrap, not ordinary source ingest and not completed-turn runtime update apply.",
  "rpg-import/campaign-setup-import.ts owns file reads, safe writes, manual confirmation, and review item generation.",
  "Review imported bootstrap pages before treating them as active play state.",
] as const

export const CAMPAIGN_SETUP_CANONICALIZATION_BOUNDARY_NOTES = [
  "Canonicalization is deterministic bootstrap shaping, not lossy model extraction.",
  "player_main is fixed to wiki/player/player.md.",
  "player_abilities, player_inventory, player_goals, and player_known_information write directly to their fixed wiki/player/*.md slots.",
  "current_scene is an overwrite-only latest scene snapshot for the first playable turn.",
  "events_prologue may contain only already-happened setup facts.",
  "main_quest, quest, and player_relationship are merged setup pages, not runtime overlays.",
] as const

export const CAMPAIGN_SETUP_FUTURE_PRESSURE_BOUNDARY_NOTES = [
  "Identify and filter future pressure, possible futures, future plans, later reveal, untriggered reveal, not-yet-revealed material, foreshadowing, possible development, GM notes, and outline text.",
  "Filtered future pressure must stay out of wiki/events/ because events are history of confirmed happened facts.",
  "Review should route future guidance to plot-arcs or outlines as appropriate; campaign_setup_import does not auto-create those pages.",
] as const

export const CAMPAIGN_SETUP_ABILITY_REVIEW_BOUNDARY_NOTES = [
  "Ability-like input includes abilities, skills, powers, limits, costs, cooldowns, spells, feats, stats, and availability.",
  "Ability-like player material should prompt review for wiki/player/abilities.md.",
  "Ability-like player material must not be routed to wiki/rules/ by campaign_setup_import.",
] as const

export const CAMPAIGN_SETUP_CURRENT_SCENE_BOOTSTRAP_BOUNDARY_NOTES = [
  "current_scene requires options.explicitBootstrap === true or options.manualConfirm === true before writing wiki/current-scene/scene_state.md.",
  "Without explicit bootstrap/manual confirmation, only the raw source anchor is written and the current scene target is skipped for review.",
] as const

export const CAMPAIGN_SETUP_WRITE_POLICIES: Record<CampaignSetupImportTargetSlot, CampaignSetupWritePolicy> = {
  player_main: "merge",
  player_abilities: "merge",
  player_inventory: "merge",
  player_goals: "merge",
  player_known_information: "merge",
  current_scene: "overwrite",
  events_prologue: "append",
  main_quest: "merge",
  quest: "merge",
  player_relationship: "merge",
}

export const campaignSetupImportContract: CampaignSetupImportContract = {
  mode: "campaign_setup_import",
  kind: "campaign_setup_import_contract",
  supportedSlots: CAMPAIGN_SETUP_IMPORT_TARGET_SLOTS,
  usesLlmByDefault: false,
  writePolicies: CAMPAIGN_SETUP_WRITE_POLICIES,
  reviewBoundaryNotes: CAMPAIGN_SETUP_REVIEW_BOUNDARY_NOTES,
  canonicalizationBoundaryNotes: CAMPAIGN_SETUP_CANONICALIZATION_BOUNDARY_NOTES,
  futurePressureBoundaryNotes: CAMPAIGN_SETUP_FUTURE_PRESSURE_BOUNDARY_NOTES,
  abilityLikeInputReviewBoundaryNotes: CAMPAIGN_SETUP_ABILITY_REVIEW_BOUNDARY_NOTES,
  currentSceneBootstrapBoundaryNotes: CAMPAIGN_SETUP_CURRENT_SCENE_BOOTSTRAP_BOUNDARY_NOTES,
}

const CAMPAIGN_SETUP_FUTURE_PRESSURE_PATTERN =
  /\b(possible futures?|future pressure|future plans?|later reveal|untriggered reveal|not yet revealed|foreshadow(?:ing)?|possible development|may later|might later|could later|will later|act\s*[2-9]|gm note|outline)\b|未来可能|可能发展|未来压力|未触发|尚未揭示|伏笔|预示|后续剧情|之后揭示|大纲/iu

const CAMPAIGN_SETUP_FUTURE_SECTION_HEADING_PATTERN =
  /^#{1,6}\s*(Possible Futures?|Future Pressure|Future Plans?|Later Reveals?|Foreshadowing|GM Notes?|Outline|未来可能|可能发展|未来压力|未触发|尚未揭示|伏笔|预示|后续剧情|大纲)\b/iu

const CAMPAIGN_SETUP_ABILITY_LIKE_PATTERN =
  /\b(abilities?|skills?|powers?|limits?|limitations?|availability|available|usable|cooldown|costs?|spells?|feats?|stats?|strength|dexterity)\b|能力|技能|限制|可用|可用性|代价|消耗|冷却|法术|属性/iu

export function isCampaignSetupImportTargetSlot(value: string): value is CampaignSetupImportTargetSlot {
  return CAMPAIGN_SETUP_IMPORT_TARGET_SLOTS.some((slot) => slot === value)
}

export function resolveCampaignSetupImportSlot(
  slotId: CampaignSetupImportTargetSlot,
  input: CampaignSetupImportSlotResolutionInput = {},
): CampaignSetupSlotDefinition {
  if (slotId === "player_main") {
    const schemaSlot = requireSchemaSlot(slotId)
    return {
      slotId,
      title: "Player Character",
      targetPath: schemaSlot.path,
      writePolicy: "merge",
      reviewPolicy: "campaign_bootstrap_not_runtime_update",
      canonicalizationNote: "deterministic_player_profile_bootstrap_fixed_player_slot_only",
      contentType: "player",
    }
  }

  if (slotId === "player_abilities") {
    const schemaSlot = requireSchemaSlot(slotId)
    return {
      slotId,
      title: "Player Abilities",
      targetPath: schemaSlot.path,
      writePolicy: "merge",
      reviewPolicy: "campaign_bootstrap_not_runtime_update",
      canonicalizationNote: "deterministic_player_abilities_bootstrap_fixed_player_slot_only",
      contentType: "player",
    }
  }

  if (slotId === "player_inventory") {
    const schemaSlot = requireSchemaSlot(slotId)
    return {
      slotId,
      title: "Player Inventory",
      targetPath: schemaSlot.path,
      writePolicy: "merge",
      reviewPolicy: "campaign_bootstrap_not_runtime_update",
      canonicalizationNote: "deterministic_player_inventory_bootstrap_fixed_player_slot_only",
      contentType: "player",
    }
  }

  if (slotId === "player_goals") {
    const schemaSlot = requireSchemaSlot(slotId)
    return {
      slotId,
      title: "Player Goals",
      targetPath: schemaSlot.path,
      writePolicy: "merge",
      reviewPolicy: "campaign_bootstrap_not_runtime_update",
      canonicalizationNote: "deterministic_player_goals_bootstrap_fixed_player_slot_only",
      contentType: "player",
    }
  }

  if (slotId === "player_known_information") {
    const schemaSlot = requireSchemaSlot(slotId)
    return {
      slotId,
      title: "Player Known Information",
      targetPath: schemaSlot.path,
      writePolicy: "merge",
      reviewPolicy: "campaign_bootstrap_not_runtime_update",
      canonicalizationNote: "deterministic_player_knowledge_bootstrap_fixed_player_slot_only",
      contentType: "player",
    }
  }

  if (slotId === "current_scene") {
    const schemaSlot = requireSchemaSlot(slotId)
    return {
      slotId,
      title: "Current Scene State",
      targetPath: schemaSlot.path,
      writePolicy: "overwrite",
      reviewPolicy: "explicit_bootstrap_or_manual_confirm_required",
      canonicalizationNote: "latest_scene_snapshot_only_no_history_accumulation",
      contentType: "current-scene",
    }
  }

  if (slotId === "events_prologue") {
    return {
      slotId,
      title: "Prologue",
      targetPath: "wiki/events/prologue.md",
      writePolicy: "append",
      reviewPolicy: "happened_prologue_facts_only_non_happened_guidance_review",
      canonicalizationNote: "filter_non_happened_guidance_from_event_history",
      contentType: "event",
    }
  }

  if (slotId === "main_quest") {
    return {
      slotId,
      title: "Main Quest",
      targetPath: "wiki/quests/main.md",
      writePolicy: "merge",
      reviewPolicy: "opening_objective_and_progress_boundary_review",
      canonicalizationNote: "trackable_opening_objective_not_player_todo_or_event_history",
      contentType: "quest",
    }
  }

  if (slotId === "quest") {
    const questSlug = safeOptionSlug(
      input.options,
      ["questName", "title"],
      getFileStem(input.sourceFileName ?? "") || "quest",
    )
    return {
      slotId,
      title: titleFromSlug(questSlug, "Quest"),
      targetPath: `wiki/quests/${questSlug}.md`,
      writePolicy: "merge",
      reviewPolicy: "opening_objective_and_progress_boundary_review",
      canonicalizationNote: "trackable_opening_objective_not_player_todo_or_event_history",
      contentType: "quest",
    }
  }

  const relationshipSlug = safeOptionSlug(
    input.options,
    ["relationshipName", "relatedCharacter", "characterName", "title"],
    getFileStem(input.sourceFileName ?? "") || "relationship",
  )
  return {
    slotId,
    title: `Player Relationship: ${titleFromSlug(relationshipSlug, "Relationship")}`,
    targetPath: `wiki/relationships/player-${relationshipSlug}.md`,
    writePolicy: "merge",
    reviewPolicy: "initial_base_relationship_only_not_runtime_overlay",
    canonicalizationNote: "initial_relationship_bootstrap_no_runtime_overlay_write",
    contentType: "relationship",
  }
}

export function getCampaignSetupImportTargetPath(
  targetSlot: string,
  options: Record<string, unknown> | undefined = undefined,
  sourceFileName = "inline-campaign-setup.md",
): string | undefined {
  if (!isCampaignSetupImportTargetSlot(targetSlot)) return undefined
  return resolveCampaignSetupImportSlot(targetSlot, { sourceFileName, options }).targetPath
}

export function campaignSetupSourceHasFuturePressure(text: string): boolean {
  return CAMPAIGN_SETUP_FUTURE_PRESSURE_PATTERN.test(text)
    || CAMPAIGN_SETUP_FUTURE_SECTION_HEADING_PATTERN.test(text)
}

export function stripCampaignSetupFuturePressureText(text: string): string {
  const normalized = normalizeCampaignSetupSourceText(text, { trim: false })
  const lines = normalized.split("\n")
  const kept: string[] = []
  let inFutureSection = false

  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      inFutureSection = CAMPAIGN_SETUP_FUTURE_SECTION_HEADING_PATTERN.test(line)
      if (inFutureSection) continue
    }

    if (inFutureSection) continue
    if (CAMPAIGN_SETUP_FUTURE_PRESSURE_PATTERN.test(line)) continue
    kept.push(line)
  }

  return kept.join("\n").trim()
}

export function campaignSetupSourceHasAbilityLikeInput(text: string): boolean {
  return CAMPAIGN_SETUP_ABILITY_LIKE_PATTERN.test(text)
}

export function hasCampaignSetupExplicitBootstrapOption(options: Record<string, unknown> | undefined): boolean {
  return options?.explicitBootstrap === true || options?.manualConfirm === true
}

function requireSchemaSlot(slotId: string) {
  const schemaSlot = getRpgSchemaSlot(slotId)
  if (!schemaSlot) {
    throw new Error(`campaign_setup_import targetSlot "${slotId}" is missing from the RPG schema slot registry.`)
  }
  return schemaSlot
}

function safeOptionSlug(
  options: Record<string, unknown> | undefined,
  keys: string[],
  fallback: string,
): string {
  for (const key of keys) {
    const value = options?.[key]
    if (typeof value === "string" && value.trim()) {
      return makeQuerySlug(value)
    }
  }
  return makeQuerySlug(fallback)
}

function titleFromSlug(slug: string, fallback: string): string {
  const title = slug
    .split("-")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "")
    .join(" ")
    .trim()
  return title || fallback
}

function normalizeCampaignSetupSourceText(
  text: string,
  options: { trim?: boolean } = { trim: true },
): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  return options.trim === false ? normalized : normalized.trim()
}

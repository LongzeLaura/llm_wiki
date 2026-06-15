import type { RpgUpdateStrategy } from "../../rpg-runtime/state-extractor"
import { RPG_FIXED_PLAYER_SLOT_PATHS } from "../../rpg-wiki-schema"

export interface RpgRuntimeUpdateTargetRule {
  pathPattern: string
  strategy: RpgUpdateStrategy
  description: string
}

export type RpgRuntimeUpdateTargetValidation =
  | { ok: true; targetPath: string; strategy: RpgUpdateStrategy }
  | { ok: false; reason: string }

const FIXED_PLAYER_RUNTIME_TARGET_RULES: readonly RpgRuntimeUpdateTargetRule[] = RPG_FIXED_PLAYER_SLOT_PATHS.map(
  (path) => ({
    pathPattern: path,
    strategy: "merge" as const,
    description: fixedPlayerSlotDescription(path),
  }),
)

const RUNTIME_UPDATE_TARGET_RULES: readonly RpgRuntimeUpdateTargetRule[] = [
  {
    pathPattern: "wiki/current-scene/scene_state.md",
    strategy: "overwrite",
    description: "Current scene snapshot; overwrite so it stays the latest runtime state only.",
  },
  {
    pathPattern: "wiki/events/*.md",
    strategy: "append",
    description: "Confirmed happened events; append or create discrete timeline entries.",
  },
  ...FIXED_PLAYER_RUNTIME_TARGET_RULES,
  {
    pathPattern: "wiki/quests/*.md",
    strategy: "merge",
    description: "Game-recognized trackable objectives only: objective, blockers/progress, completion/failure conditions, and accepted runtime changes; not any goal, subjective wish, player TODO/checklist, theme, author intent, or plot pressure.",
  },
  {
    pathPattern: "wiki/outlines/progress.md",
    strategy: "merge",
    description: "Runtime-reviewed outline progress: active act/beat, completed/skipped/advanced/delayed beats, and divergence notes; never rewrite outlines/main.md from runtime update.",
  },
  {
    pathPattern: "wiki/relationships/runtime/*.md",
    strategy: "merge",
    description: "Runtime relationship deltas, trust, tension, conflict, secrets, misunderstandings, constraints, and pair-specific tone changes; never write base wiki/relationships/*.md from runtime update.",
  },
  {
    pathPattern: "wiki/plot-arcs/runtime/*.md",
    strategy: "merge",
    description: "Runtime plot arc state, triggered/skipped/delayed/advanced beats, pressure changes, unresolved conflict, foreshadowing status, reveal pacing, and progression conditions; never player TODO/checklists, quest ledgers, or base wiki/plot-arcs/*.md runtime writes.",
  },
  {
    pathPattern: "wiki/characters/runtime/*.md",
    strategy: "merge",
    description: "Runtime overlays for NPC current campaign state; never base character pages.",
  },
  {
    pathPattern: "wiki/locations/runtime/*.md",
    strategy: "merge",
    description: "Runtime overlays for location state changed by play; never base location pages.",
  },
  {
    pathPattern: "wiki/factions/runtime/*.md",
    strategy: "merge",
    description: "Runtime overlays for faction stance, resources, and pressure; never base faction pages.",
  },
  {
    pathPattern: "wiki/items/runtime/*.md",
    strategy: "merge",
    description: "Runtime overlays for item ownership, condition, use, transfer, damage, or object-level state; player current quantities/equipment status belong in wiki/player/inventory.md.",
  },
]

function fixedPlayerSlotDescription(path: string): string {
  if (path === "wiki/player/player.md") {
    return "Fixed player slot for accepted PC identity and current state summary; do not create arbitrary wiki/player/*.md runtime pages."
  }
  if (path === "wiki/player/abilities.md") {
    return "Fixed player slot for PC abilities, skills, limits, costs, and current availability; do not route rules/control mechanics here."
  }
  if (path === "wiki/player/inventory.md") {
    return "Fixed player slot for current holdings, quantities, equipped/backpack status, acquisition, loss, and consumption; object-level item state belongs in wiki/items/runtime/*.md."
  }
  if (path === "wiki/player/goals.md") {
    return "Fixed player slot for PC subjective motives, wishes, promises, and personal priorities; not quest progress, player TODO/checklists, candidate actions, or plot pressure."
  }
  return "Fixed player slot for player-known information, misunderstandings, and asymmetric knowledge; do not create arbitrary wiki/player/*.md runtime pages."
}

export function getRpgRuntimeUpdateTargetRules(): readonly RpgRuntimeUpdateTargetRule[] {
  return RUNTIME_UPDATE_TARGET_RULES
}

export function validateRpgRuntimeUpdateTarget(
  targetPath: string,
  strategy: string,
): RpgRuntimeUpdateTargetValidation {
  const normalizedPath = normalizeWikiPath(targetPath)
  if (!isRpgUpdateStrategy(strategy)) {
    return { ok: false, reason: `strategy "${strategy}" is not allowed.` }
  }
  if (normalizedPath.includes("*")) {
    return {
      ok: false,
      reason: `targetPath "${normalizedPath}" must be a concrete file path, not a wildcard or pathPattern.`,
    }
  }

  for (const rule of RUNTIME_UPDATE_TARGET_RULES) {
    if (matchesRule(normalizedPath, rule.pathPattern)) {
      if (strategy !== rule.strategy) {
        return { ok: false, reason: `targetPath "${normalizedPath}" requires strategy "${rule.strategy}".` }
      }
      return { ok: true, targetPath: normalizedPath, strategy }
    }
  }

  return { ok: false, reason: `targetPath "${normalizedPath}" is outside allowed runtime update paths.` }
}

function matchesRule(targetPath: string, pathPattern: string): boolean {
  if (!pathPattern.includes("*")) return targetPath === pathPattern

  const [prefix, suffix] = pathPattern.split("*")
  if (!targetPath.startsWith(prefix) || !targetPath.endsWith(suffix)) return false

  const rest = targetPath.slice(prefix.length, targetPath.length - suffix.length)
  return rest.length > 0 && !rest.includes("/")
}

function isRpgUpdateStrategy(value: string): value is RpgUpdateStrategy {
  return value === "overwrite" || value === "append" || value === "merge"
}

function normalizeWikiPath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/^\/+/, "")
}

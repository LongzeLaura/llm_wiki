import type {
  RpgBeliefState,
  RpgKnowledgeActorRef,
  RpgKnowledgeScope,
  RpgRevealState,
  RpgVisibilityScope,
} from "../rpg-wiki-schema"
import type { RpgKnowledgeClaim, RpgRevealGateRef } from "./types"

const ACTOR_REF_PATTERN = /^(?:pc|user|gm|(?:npc|faction|group):[a-z0-9][a-z0-9_-]*)$/u
const BELIEF_STATES = new Set<RpgBeliefState>([
  "known",
  "suspected",
  "inferred",
  "misunderstood",
  "unknown",
])
const REVEAL_STATES = new Set<RpgRevealState>([
  "hidden",
  "hinted",
  "partially_revealed",
  "revealed",
  "forbidden",
])
const TRUTH_STATUSES = new Set<RpgKnowledgeClaim["truthStatus"]>(["true", "false", "partial", "unknown"])

export interface DefaultKnowledgeClaimInput {
  path: string
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  summary: string
  sourceEventPath?: string
}

export function isRpgKnowledgeActorRef(value: unknown): value is RpgKnowledgeActorRef {
  return typeof value === "string" && ACTOR_REF_PATTERN.test(value.trim())
}

export function isConcreteNonPcActorRef(value: RpgKnowledgeActorRef): boolean {
  return value.startsWith("npc:") || value.startsWith("faction:") || value.startsWith("group:")
}

export function validateRpgKnowledgeActorRef(value: unknown, label: string): RpgKnowledgeActorRef {
  if (!isRpgKnowledgeActorRef(value)) {
    throw new Error(`Invalid ${label}: expected pc, user, gm, npc:<id>, faction:<id>, or group:<id>.`)
  }
  return value.trim() as RpgKnowledgeActorRef
}

export function validateRpgBeliefState(value: unknown, label: string): RpgBeliefState {
  if (typeof value !== "string" || !BELIEF_STATES.has(value as RpgBeliefState)) {
    throw new Error(`Invalid ${label}: unsupported belief state.`)
  }
  return value as RpgBeliefState
}

export function validateRpgRevealState(value: unknown, label: string): RpgRevealState {
  if (typeof value !== "string" || !REVEAL_STATES.has(value as RpgRevealState)) {
    throw new Error(`Invalid ${label}: unsupported reveal state.`)
  }
  return value as RpgRevealState
}

export function validateRpgKnowledgeClaim(value: unknown, label: string): RpgKnowledgeClaim {
  const record = expectRecord(value, label)
  const claim: RpgKnowledgeClaim = {
    claimId: readString(record, "claimId", `${label}.claimId`),
    summary: readString(record, "summary", `${label}.summary`),
    truthStatus: readEnum(record.truthStatus, TRUTH_STATUSES, `${label}.truthStatus`),
    holders: readArray(record, "holders", `${label}.holders`).map((entry, index) =>
      validateRpgKnowledgeActorRef(entry, `${label}.holders[${index}]`),
    ),
    nonHolders: readArray(record, "nonHolders", `${label}.nonHolders`).map((entry, index) =>
      validateRpgKnowledgeActorRef(entry, `${label}.nonHolders[${index}]`),
    ),
    beliefStateByActor: readArray(record, "beliefStateByActor", `${label}.beliefStateByActor`).map(
      (entry, index) => {
        const belief = expectRecord(entry, `${label}.beliefStateByActor[${index}]`)
        return {
          actor: validateRpgKnowledgeActorRef(belief.actor, `${label}.beliefStateByActor[${index}].actor`),
          beliefState: validateRpgBeliefState(
            belief.beliefState,
            `${label}.beliefStateByActor[${index}].beliefState`,
          ),
          reason: readString(belief, "reason", `${label}.beliefStateByActor[${index}].reason`),
        }
      },
    ),
    ...(typeof record.sourcePath === "string" && record.sourcePath.trim()
      ? { sourcePath: record.sourcePath.trim() }
      : {}),
    ...(typeof record.sourceEventPath === "string" && record.sourceEventPath.trim()
      ? { sourceEventPath: record.sourceEventPath.trim() }
      : {}),
  }

  if (claim.holders.some((holder) => claim.nonHolders.includes(holder))) {
    throw new Error(`Invalid ${label}: holders and nonHolders must not contain the same actor.`)
  }
  if (claim.holders.length === 0 && claim.nonHolders.length === 0 && claim.beliefStateByActor.length === 0) {
    throw new Error(`Invalid ${label}: at least one actor holder, non-holder, or belief state is required.`)
  }

  return claim
}

export function validateRpgRevealGateRef(value: unknown, label: string): RpgRevealGateRef {
  const record = expectRecord(value, label)
  return {
    gateId: readString(record, "gateId", `${label}.gateId`),
    truthId: readString(record, "truthId", `${label}.truthId`),
    revealState: validateRpgRevealState(record.revealState, `${label}.revealState`),
    allowedAudience: readArray(record, "allowedAudience", `${label}.allowedAudience`).map((entry, index) =>
      validateRpgKnowledgeActorRef(entry, `${label}.allowedAudience[${index}]`),
    ),
    blockedAudience: readArray(record, "blockedAudience", `${label}.blockedAudience`).map((entry, index) =>
      validateRpgKnowledgeActorRef(entry, `${label}.blockedAudience[${index}]`),
    ),
    reason: readString(record, "reason", `${label}.reason`),
  }
}

export function defaultKnowledgeClaimsForPath(input: DefaultKnowledgeClaimInput): RpgKnowledgeClaim[] {
  const path = normalizeWikiPath(input.path)
  const summary = input.summary.trim() || `Knowledge boundary for ${path}.`
  const sourceEventPath = input.sourceEventPath
  if (path === "wiki/player/known_information.md") {
    return [
      createClaim({
        path,
        summary,
        truthStatus: input.knowledgeScope === "pc_misunderstanding" ? "false" : "unknown",
        holders: ["pc"],
        nonHolders: [],
        actor: "pc",
        beliefState: input.knowledgeScope === "pc_misunderstanding"
          ? "misunderstood"
          : input.visibilityScope === "pc_inferred"
            ? "inferred"
            : "known",
        sourceEventPath,
      }),
    ]
  }

  if (path.startsWith("wiki/outlines/")) {
    return [
      createClaim({
        path,
        summary,
        truthStatus: "unknown",
        holders: ["gm"],
        nonHolders: ["pc"],
        actor: "gm",
        beliefState: "known",
        sourceEventPath,
      }),
    ]
  }

  const characterId = runtimeOverlayId(path, "characters")
  if (characterId) {
    return [
      createClaim({
        path,
        summary,
        truthStatus: "unknown",
        holders: [`npc:${characterId}`],
        nonHolders: input.visibilityScope === "pc_visible" || input.visibilityScope === "pc_inferred" ? [] : ["pc"],
        actor: `npc:${characterId}`,
        beliefState: "known",
        sourceEventPath,
      }),
    ]
  }

  const factionId = runtimeOverlayId(path, "factions")
  if (factionId) {
    return [
      createClaim({
        path,
        summary,
        truthStatus: "unknown",
        holders: [`faction:${factionId}`],
        nonHolders: input.visibilityScope === "pc_visible" || input.visibilityScope === "pc_inferred" ? [] : ["pc"],
        actor: `faction:${factionId}`,
        beliefState: "known",
        sourceEventPath,
      }),
    ]
  }

  if (path.startsWith("wiki/relationships/runtime/") || path.startsWith("wiki/plot-arcs/")) {
    return []
  }

  return []
}

function createClaim(input: {
  path: string
  summary: string
  truthStatus: RpgKnowledgeClaim["truthStatus"]
  holders: RpgKnowledgeActorRef[]
  nonHolders: RpgKnowledgeActorRef[]
  actor: RpgKnowledgeActorRef
  beliefState: RpgBeliefState
  sourceEventPath?: string
}): RpgKnowledgeClaim {
  return {
    claimId: `claim.${slug(input.path)}.${slug(input.actor)}`,
    summary: input.summary,
    truthStatus: input.truthStatus,
    holders: input.holders,
    nonHolders: input.nonHolders,
    beliefStateByActor: [
      {
        actor: input.actor,
        beliefState: input.beliefState,
        reason: `Derived from ${input.path}.`,
      },
      ...input.nonHolders.map((actor) => ({
        actor,
        beliefState: "unknown" as const,
        reason: `Not granted by ${input.path}.`,
      })),
    ],
    sourcePath: input.path,
    ...(input.sourceEventPath ? { sourceEventPath: input.sourceEventPath } : {}),
  }
}

function runtimeOverlayId(path: string, category: "characters" | "factions"): string | undefined {
  const match = new RegExp(`^wiki/${category}/runtime/([^/]+)\\.md$`, "iu").exec(path)
  return match?.[1]
}

function normalizeWikiPath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/^\/+/, "")
}

function slug(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "ref"
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an object.`)
  }
  return value as Record<string, unknown>
}

function readString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${label}: expected a non-empty string.`)
  }
  return value.trim()
}

function readArray(record: Record<string, unknown>, key: string, label: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an array.`)
  }
  return value
}

function readEnum<T extends string>(value: unknown, allowed: ReadonlySet<T>, label: string): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`Invalid ${label}: unsupported value ${JSON.stringify(value)}.`)
  }
  return value as T
}

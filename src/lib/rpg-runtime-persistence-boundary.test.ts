import { describe, expect, it } from "vitest"
import {
  createPendingRpgUpdates,
  summarizeRpgRuntimePersistenceBoundary,
  validateRpgRuntimePersistenceBoundary,
  type RuntimeProposedWikiUpdate,
  type RuntimeUpdateSourceDelta,
} from "./rpg-runtime"

describe("RPG runtime persistence boundary", () => {
  it("accepts only updates that pass target policy and runtime write validation", () => {
    const result = validateRpgRuntimePersistenceBoundary({
      proposedUpdates: [
        update({ id: "scene", targetPath: "wiki/current-scene/scene_state.md", strategy: "overwrite" }),
        update({
          id: "future-event",
          targetPath: "wiki/events/future.md",
          strategy: "append",
          content: "# Future\n\n## Possible Futures\n- Next action: the player may force the gate.",
        }),
        update({ id: "base-world", targetPath: "wiki/world/basic_overview.md", strategy: "merge" }),
      ],
    })

    expect(result.acceptedUpdates.map((entry) => entry.id)).toEqual(["scene"])
    expect(result.pendingEligibleUpdateIds).toEqual(["scene"])
    expect(result.rejectedUpdates.map(({ update }) => update.id)).toEqual(["base-world", "future-event"])
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["runtime_update_target_policy", "events_future_candidate_pollution"]),
    )
  })

  it("keeps review-only audit items visible but outside pending eligibility", () => {
    const result = validateRpgRuntimePersistenceBoundary({
      proposedUpdates: [
        update({ id: "scene", targetPath: "wiki/current-scene/scene_state.md", strategy: "overwrite" }),
      ],
      reviewOnlyAuditItems: [
        {
          kind: "skipped_delta",
          id: "skip-hidden-outline",
          summary: "Hidden outline material stays review-only.",
          reviewPolicy: "review_only",
        },
        {
          kind: "outline_revision_review",
          id: "outline-review-1",
          summary: "Future outline revision requires manual review.",
          reviewPolicy: "manual_review",
        },
      ],
    })
    const summary = summarizeRpgRuntimePersistenceBoundary(result, 1)

    expect(result.pendingEligibleUpdateIds).toEqual(["scene"])
    expect(result.reviewOnlyAuditItems.map((item) => item.id)).toEqual(["skip-hidden-outline", "outline-review-1"])
    expect(summary).toMatchObject({
      proposedCount: 1,
      acceptedCount: 1,
      rejectedCount: 0,
      pendingEligibleCount: 1,
      pendingEligibleUpdateIds: ["scene"],
      reviewOnlyAuditIds: ["skip-hidden-outline", "outline-review-1"],
    })
  })

  it("does not stage rejected targets or unsafe knowledge claims as pending updates", () => {
    const rejectedTarget = update({
      id: "base-world",
      targetPath: "wiki/world/basic_overview.md",
      strategy: "merge",
    })
    const unsafePlayerKnowledge = update({
      id: "unsafe-player-knowledge",
      targetPath: "wiki/player/known_information.md",
      strategy: "merge",
      content: "# Known Information\n\nNPC-only order is incorrectly stored as PC knowledge.",
      sourceDeltas: [npcOnlySourceDelta("wiki/player/known_information.md")],
      visibility: "user_visible_pc_unknown",
      knowledgeScope: "npc_known",
    })
    const acceptedScene = update({
      id: "scene",
      targetPath: "wiki/current-scene/scene_state.md",
      strategy: "overwrite",
    })

    const result = validateRpgRuntimePersistenceBoundary({
      proposedUpdates: [rejectedTarget, unsafePlayerKnowledge, acceptedScene],
    })
    const pendingUpdates = createPendingRpgUpdates(result.acceptedUpdates)

    expect(result.rejectedUpdates.map(({ update }) => update.id)).toEqual(
      expect.arrayContaining(["base-world", "unsafe-player-knowledge"]),
    )
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["runtime_update_target_policy", "player_knowledge_claim_boundary"]),
    )
    expect(pendingUpdates.map((entry) => entry.id)).toEqual(["scene"])
  })
})

function update(overrides: Partial<RuntimeProposedWikiUpdate> & { id: string; targetPath: string; strategy: RuntimeProposedWikiUpdate["strategy"] }): RuntimeProposedWikiUpdate {
  const { id, targetPath, strategy, ...rest } = overrides
  const sourceDelta = runtimeSourceDelta(targetPath)
  return {
    id,
    targetPath,
    strategy,
    reason: "Track accepted runtime state.",
    content: "# Runtime Update\n\nAccepted runtime state.",
    sourceTurnId: "turn-boundary",
    references: ["wiki/current-scene/scene_state.md"],
    sourceDeltas: [sourceDelta],
    lineTarget: "playerVisibleLine",
    visibility: targetPath.startsWith("wiki/events/") ? "gm_only" : "pc_visible",
    knowledgeScope: targetPath.startsWith("wiki/events/") ? "gm_only" : "pc_known",
    happenedStatus: targetPath.startsWith("wiki/events/") ? "confirmed_happened" : "ongoing",
    confidence: "high",
    validationHints: [],
    ...rest,
  }
}

function runtimeSourceDelta(targetPath: string): RuntimeUpdateSourceDelta {
  const event = targetPath.startsWith("wiki/events/")
  return {
    deltaId: `delta-${targetPath.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "")}`,
    sourceStage: "postActionWorkingState",
    sourceField: "campaignDelta",
    summary: "Runtime source delta.",
    lineTarget: "playerVisibleLine",
    visibility: event ? "gm_only" : "pc_visible",
    knowledgeScope: event ? "gm_only" : "pc_known",
    happenedStatus: event ? "confirmed_happened" : "ongoing",
    usePurpose: "writeback",
    affectedPaths: [targetPath],
    runtimeDeltaRefs: [],
    knowledgeClaims: event
      ? [{
          claimId: `claim-${targetPath}`,
          summary: "GM tracked event claim.",
          truthStatus: "unknown",
          holders: ["gm"],
          nonHolders: ["pc"],
          beliefStateByActor: [
            { actor: "gm", beliefState: "known", reason: "GM audit." },
            { actor: "pc", beliefState: "unknown", reason: "PC has not learned this." },
          ],
          sourcePath: targetPath,
        }]
      : [{
          claimId: `claim-${targetPath}`,
          summary: "PC visible runtime claim.",
          truthStatus: "unknown",
          holders: ["pc"],
          nonHolders: [],
          beliefStateByActor: [
            { actor: "pc", beliefState: "known", reason: "PC visible runtime source." },
          ],
          sourcePath: targetPath,
        }],
    revealGateRefs: [],
  }
}

function npcOnlySourceDelta(targetPath: string): RuntimeUpdateSourceDelta {
  return {
    ...runtimeSourceDelta(targetPath),
    lineTarget: "parallelLine",
    visibility: "user_visible_pc_unknown",
    knowledgeScope: "npc_known",
    knowledgeClaims: [
      {
        claimId: `npc-only-claim-${targetPath}`,
        summary: "NPC-only information must not enter player known information.",
        truthStatus: "unknown",
        holders: ["npc:watch-captain"],
        nonHolders: ["pc"],
        beliefStateByActor: [
          { actor: "npc:watch-captain", beliefState: "known", reason: "NPC heard the order." },
          { actor: "pc", beliefState: "unknown", reason: "PC has not learned this." },
        ],
        sourcePath: targetPath,
      },
    ],
  }
}

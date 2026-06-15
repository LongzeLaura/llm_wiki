import { describe, expect, it } from "vitest"
import {
  defaultKnowledgeClaimsForPath,
  validateRpgBeliefState,
  validateRpgKnowledgeActorRef,
  validateRpgKnowledgeClaim,
  validateRpgRevealState,
} from "./rpg-runtime"

describe("RPG actor knowledge metadata", () => {
  it("validates actor refs, belief states, and reveal states", () => {
    expect(validateRpgKnowledgeActorRef("pc", "actor")).toBe("pc")
    expect(validateRpgKnowledgeActorRef("npc:rin", "actor")).toBe("npc:rin")
    expect(validateRpgKnowledgeActorRef("faction:harbor-watch", "actor")).toBe("faction:harbor-watch")
    expect(validateRpgBeliefState("misunderstood", "belief")).toBe("misunderstood")
    expect(validateRpgRevealState("partially_revealed", "reveal")).toBe("partially_revealed")

    expect(() => validateRpgKnowledgeActorRef("npc:", "actor")).toThrow(/actor/)
    expect(() => validateRpgKnowledgeActorRef("NPC:Rin", "actor")).toThrow(/actor/)
    expect(() => validateRpgBeliefState("guessed", "belief")).toThrow(/belief/)
    expect(() => validateRpgRevealState("known", "reveal")).toThrow(/reveal/)
  })

  it("validates structured knowledge claims without repairing contradictions", () => {
    expect(
      validateRpgKnowledgeClaim(
        {
          claimId: "claim-rin",
          summary: "Rin knows the ward anchor.",
          truthStatus: "unknown",
          holders: ["npc:rin"],
          nonHolders: ["pc"],
          beliefStateByActor: [
            { actor: "npc:rin", beliefState: "known", reason: "Rin inspected it." },
            { actor: "pc", beliefState: "unknown", reason: "Rin has not said it." },
          ],
          sourcePath: "wiki/characters/runtime/rin.md",
        },
        "claim",
      ).holders,
    ).toEqual(["npc:rin"])

    expect(() =>
      validateRpgKnowledgeClaim(
        {
          claimId: "claim-bad",
          summary: "Contradictory actor holder.",
          truthStatus: "unknown",
          holders: ["pc"],
          nonHolders: ["pc"],
          beliefStateByActor: [{ actor: "pc", beliefState: "known", reason: "Bad fixture." }],
        },
        "claim",
      ),
    ).toThrow(/holders and nonHolders/)
  })

  it("derives only safe default holders from unambiguous wiki paths", () => {
    expect(
      defaultKnowledgeClaimsForPath({
        path: "wiki/player/known_information.md",
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
        summary: "PC knows the ward is active.",
      })[0]?.holders,
    ).toEqual(["pc"])
    expect(
      defaultKnowledgeClaimsForPath({
        path: "wiki/outlines/main.md",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        summary: "GM-only reveal gate.",
      })[0]?.nonHolders,
    ).toEqual(["pc"])
    expect(
      defaultKnowledgeClaimsForPath({
        path: "wiki/characters/runtime/rin.md",
        visibilityScope: "gm_only",
        knowledgeScope: "npc_known",
        summary: "Rin knows the ward anchor.",
      })[0]?.holders,
    ).toEqual(["npc:rin"])
    expect(
      defaultKnowledgeClaimsForPath({
        path: "wiki/factions/runtime/harbor-watch.md",
        visibilityScope: "gm_only",
        knowledgeScope: "npc_known",
        summary: "The Harbor Watch knows the alarm state.",
      })[0]?.holders,
    ).toEqual(["faction:harbor-watch"])
    expect(
      defaultKnowledgeClaimsForPath({
        path: "wiki/relationships/runtime/rin-sakura.md",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        summary: "Ambiguous relationship information gap.",
      }),
    ).toEqual([])
    expect(
      defaultKnowledgeClaimsForPath({
        path: "wiki/plot-arcs/runtime/hidden-ward.md",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        summary: "Reveal progress needs explicit gate metadata.",
      }),
    ).toEqual([])
    expect(
      defaultKnowledgeClaimsForPath({
        path: "wiki/events/scene-001.md",
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
        summary: "Confirmed events do not automatically grant PC knowledge.",
      }),
    ).toEqual([])
  })
})

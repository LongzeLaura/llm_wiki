import { describe, expect, it } from "vitest"
import {
  createRpgRelationshipDeriverReviewItems,
  deriveRpgRelationshipTensions,
  type RpgRelationshipDeriverPage,
} from "./rpg-relationship-tension-deriver"
import type { RpgIngestSignal } from "./rpg-ingest-signals"

function page(path: string, title: string, body: string): RpgRelationshipDeriverPage {
  return {
    path,
    content: [
      "---",
      `title: "${title}"`,
      "---",
      "",
      `# ${title}`,
      "",
      body,
    ].join("\n"),
  }
}

function signal(overrides: Partial<RpgIngestSignal> = {}): RpgIngestSignal {
  return {
    kind: "relationship_tension",
    targetPath: "wiki/relationships/mira-iven.md",
    summary: "Mira hides her debt from Iven, increasing tension when Iven offers help.",
    rpUse: "Use as a guarded dialogue pressure point.",
    evidence: "Dialogue signal: Mira cuts off the debt topic and Iven notices.",
    utilityScore: 4,
    confidence: "medium",
    canonStatus: "canon",
    ...overrides,
  }
}

describe("Relationship/Tension Deriver v0", () => {
  it("derives a reviewable trust or tension proposal from character behavior plus event consequences", () => {
    const result = deriveRpgRelationshipTensions({
      pages: [
        page(
          "wiki/characters/mira.md",
          "Mira",
          [
            "## Relationship Levers",
            "- Trust rises if Iven protects the sealed ledger; trust drops if Iven exposes the debt in public.",
          ].join("\n"),
        ),
        page(
          "wiki/characters/iven.md",
          "Iven",
          "## Behavior Rules\n- Iven protects allies but suspects anyone who hides debt.",
        ),
        page(
          "wiki/events/ledger-ambush.md",
          "Ledger Ambush",
          [
            "## Confirmed Consequences",
            "Participants: Mira, Iven",
            "Iven protected Mira during the ambush, but the damaged ledger created a trust change and lingering tension.",
          ].join("\n"),
        ),
      ],
    })

    const relationship = result.proposals.find((proposal) => proposal.targetKind === "relationship")
    expect(relationship).toBeDefined()
    expect(relationship?.targetPath).toBe("wiki/relationships/mira-iven.md")
    expect(["trust", "tension"]).toContain(relationship?.derivationKind)
    expect(relationship?.canonStatus).toBe("inferred_for_play")
    expect(relationship?.participants).toEqual(expect.arrayContaining(["Mira", "Iven"]))
    expect(relationship?.proposalMarkdown).toContain("REVIEW / proposal-only")
  })

  it("marks secrets and misunderstandings as inferred_for_play", () => {
    const result = deriveRpgRelationshipTensions({
      pages: [
        page("wiki/characters/mira.md", "Mira", "## Secrets\n- Mira hides the debt from Iven and does not reveal who controls the ledger."),
        page("wiki/characters/iven.md", "Iven", "## Runtime Capsule\n- Iven suspects Mira is protecting someone else."),
      ],
    })

    const secret = result.proposals.find((proposal) => proposal.derivationKind === "secret")
    expect(secret).toBeDefined()
    expect(secret?.targetKind).toBe("relationship")
    expect(secret?.canonStatus).toBe("inferred_for_play")
    expect(secret?.proposalMarkdown).toContain("inferred_for_play")
  })

  it("keeps direct evidence as proposal evidence instead of silently promoting canon facts", () => {
    const result = deriveRpgRelationshipTensions({
      pages: [
        page("wiki/characters/mira.md", "Mira", "## Relationship Levers\n- Mira directly says she trusts Iven after he protects the ledger."),
        page("wiki/characters/iven.md", "Iven", "## Runtime Capsule\n- Iven is present as the ally named in Mira's trust lever."),
      ],
      signals: [
        signal({
          summary: "Mira explicitly says she trusts Iven.",
          evidence: "Direct dialogue evidence: Mira says she trusts Iven.",
          canonStatus: "canon",
        }),
      ],
    })

    const proposal = result.proposals.find((item) => item.evidence.some((evidence) => evidence.summary.includes("Direct dialogue evidence")))
    expect(proposal).toBeDefined()
    expect(proposal?.targetKind).toBe("relationship")
    expect(proposal?.canonStatus).toBe("inferred_for_play")
    expect(proposal?.proposalMarkdown).toContain("sourceCanonStatus=canon")
    expect(proposal?.proposalMarkdown).toContain("do not overwrite, append, merge, accept, apply, or write canon facts automatically")
  })

  it("creates relationship merge proposals without repeating full character introductions", () => {
    const result = deriveRpgRelationshipTensions({
      pages: [
        page("wiki/relationships/mira-iven.md", "Mira and Iven", "## Trust and Tension\nMira trusts Iven's protection but fears his habit of exposing secrets."),
      ],
    })

    const proposal = result.proposals[0]
    expect(proposal.targetKind).toBe("relationship")
    expect(proposal.mergePatchMarkdown).toContain("Proposed Relationship Merge Patch")
    expect(proposal.mergePatchMarkdown).toContain("Relationship Delta")
    expect(proposal.mergePatchMarkdown).not.toContain("Biography")
    expect(proposal.mergePatchMarkdown).not.toContain("Character Profile")
    expect(proposal.proposalMarkdown).toContain("REVIEW / proposal-only")
  })

  it("creates plot-arc conflict pressure proposals with unresolved boundaries", () => {
    const result = deriveRpgRelationshipTensions({
      pages: [
        page(
          "wiki/plot-arcs/patron-ledger.md",
          "Patron Ledger",
          [
            "## Unresolved Pressure",
            "Participants: Mira, Iven",
            "The patron's leverage remains unresolved; do not reveal the patron until the player connects the ledger debt to the canal ambush.",
          ].join("\n"),
        ),
      ],
    })

    const plot = result.proposals.find((proposal) => proposal.targetKind === "plot_arc")
    expect(plot).toBeDefined()
    expect(plot?.targetPath).toBe("wiki/plot-arcs/patron-ledger.md")
    expect(plot?.derivationKind).toBe("conflict_pressure")
    expect(plot?.canonStatus).toBe("inferred_for_play")
    expect(plot?.unresolvedBoundaries.join("\n")).toContain("do not reveal")
    expect(plot?.proposalMarkdown).toContain("do not write this as a completed event")
  })

  it("uses source notes and structured signals as evidence while staying proposal-only", () => {
    const result = deriveRpgRelationshipTensions({
      pages: [
        page("wiki/characters/mira.md", "Mira", "## Runtime Capsule\n- Mira avoids debt topics."),
        page("wiki/characters/iven.md", "Iven", "## Runtime Capsule\n- Iven offers help when danger rises."),
      ],
      sourceNotes: [
        {
          sourcePath: "wiki/sources/session-notes.md",
          content: "Participants: Mira, Iven\nSource note: Mira hides a debt from Iven, creating secret tension.",
        },
      ],
      signals: [signal()],
    })

    const proposal = result.proposals.find((item) => item.targetKind === "relationship")
    expect(proposal).toBeDefined()
    expect(proposal?.evidence.map((item) => item.sourcePath)).toEqual(expect.arrayContaining([
      "wiki/sources/session-notes.md",
      "wiki/relationships/mira-iven.md",
    ]))
    expect(proposal?.canonStatus).toBe("inferred_for_play")
    expect(proposal?.proposalMarkdown).toContain("REVIEW / proposal-only")

    const reviews = createRpgRelationshipDeriverReviewItems(result)
    expect(reviews.length).toBeGreaterThan(0)
    expect(reviews[0].type).toBe("suggestion")
    expect(reviews[0].options).toEqual([
      { label: "Inspect", action: "Inspect" },
      { label: "Dismiss", action: "Dismiss" },
    ])
  })

  it("emits a warning and review-only proposal when participants are insufficient", () => {
    const result = deriveRpgRelationshipTensions({
      pages: [
        page("wiki/events/anonymous-warning.md", "Anonymous Warning", "## Consequences\nSomeone hides a secret and creates tension, but no participants are named."),
      ],
    })

    expect(result.warnings.some((warning) => warning.includes("Insufficient participants"))).toBe(true)
    expect(result.proposals.some((proposal) => proposal.targetKind === "review_only")).toBe(true)
    expect(result.proposals.some((proposal) => proposal.targetPath.startsWith("wiki/relationships/"))).toBe(false)
  })

  it("marks every proposal markdown with REVIEW/proposal-only boundaries", () => {
    const result = deriveRpgRelationshipTensions({
      pages: [
        page("wiki/characters/mira.md", "Mira", "## Secrets\n- Mira hides the patron's letter from Iven."),
        page("wiki/characters/iven.md", "Iven", "## Dialogue Style\n- Iven asks direct questions when he suspects a secret."),
        page("wiki/plot-arcs/patron-letter.md", "Patron Letter", "## Conflict Pressure\nThe letter remains unresolved and cannot resolve early."),
      ],
    })

    expect(result.proposals.length).toBeGreaterThan(0)
    for (const proposal of result.proposals) {
      expect(proposal.proposalMarkdown).toContain("REVIEW / proposal-only")
    }
  })
})

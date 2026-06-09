import { describe, expect, it } from "vitest"
import {
  applyAcceptedRpgDistillProposal,
  reviewRpgMergeOutput,
} from "./rpg-merge-review"

const PAGE = (title: string, body: string) => [
  "---",
  "type: rpg",
  `title: ${title}`,
  "---",
  "",
  `# ${title}`,
  "",
  body,
].join("\n")

function longParagraph(label: string): string {
  return Array.from(
    { length: 34 },
    (_, index) => `${label} detail ${index + 1} repeats ordinary profile history without changing action, tension, risk, cost, trust, trigger, or portrayal.`,
  ).join(" ")
}

describe("RPG merge review", () => {
  it("routes high-risk event merge output to review instead of accepting final page", () => {
    const result = reviewRpgMergeOutput({
      pagePath: "wiki/events/canal-gate.md",
      existingContent: PAGE("Canal Gate", "## Runtime Capsule\n\n- Confirmed incident.\n\n## Confirmed Event\n\n- The guard withdrew."),
      incomingContent: PAGE("Canal Gate", "## Runtime Capsule\n\n- Confirmed incident.\n\n## Confirmed Event\n\n- The brass light answered."),
      mergedCandidate: PAGE("Canal Gate", [
        "## Runtime Capsule",
        "- Confirmed incident plus contaminated options.",
        "",
        "## Confirmed Event",
        "- The brass light answered.",
        "",
        "## Next Steps",
        "- Possible future: if the player chooses, an ambush may happen later.",
      ].join("\n")),
    })

    expect(result.disposition).toBe("review")
    expect(result.acceptedContent).toBeNull()
    expect(result.highRiskReasons.join("\n")).toContain("event-future-or-option-contamination")
    expect(result.reviewItems).toHaveLength(1)
    expect(result.reviewItems[0]).toMatchObject({
      type: "suggestion",
      sourcePath: "wiki/events/canal-gate.md",
      affectedPages: ["wiki/events/canal-gate.md"],
    })
  })

  it("routes plot-arc future-as-fact contamination to review", () => {
    const result = reviewRpgMergeOutput({
      pagePath: "wiki/plot-arcs/canal-threat.md",
      existingContent: PAGE("Canal Threat", "## Runtime Capsule\n\n- Unresolved canal pressure."),
      incomingContent: PAGE("Canal Threat", "## Runtime Capsule\n\n- Unresolved canal pressure."),
      mergedCandidate: PAGE("Canal Threat", [
        "## Runtime Capsule",
        "- Unresolved canal pressure.",
        "",
        "## Confirmed Facts",
        "- Possible future: the rival may exploit the gate.",
      ].join("\n")),
    })

    expect(result.disposition).toBe("review")
    expect(result.acceptedContent).toBeNull()
    expect(result.highRiskReasons.join("\n")).toContain("plot-arc-future-in-confirmed-facts")
  })

  it("routes base stable pages with runtime-only current state to review", () => {
    const result = reviewRpgMergeOutput({
      pagePath: "wiki/characters/mira.md",
      existingContent: PAGE("Mira", "## Runtime Capsule\n\n- Tests honesty.\n\n## Behavior Rules\n\n- Deflects under pressure."),
      incomingContent: PAGE("Mira", "## Runtime Capsule\n\n- Tests honesty.\n\n## Behavior Rules\n\n- Deflects under pressure."),
      mergedCandidate: PAGE("Mira", [
        "## Runtime Capsule",
        "- Tests honesty.",
        "",
        "## Current State",
        "- Current campaign state: currently wounded after this session.",
      ].join("\n")),
    })

    expect(result.disposition).toBe("review")
    expect(result.highRiskReasons.join("\n")).toContain("base-page-runtime-state-contamination")
  })

  it("creates a distill proposal for an overlong character page without auto-compressing it", () => {
    const mergedCandidate = PAGE("Mira", [
      "## Runtime Capsule",
      "- Mira tests whether the player can keep a dangerous secret.",
      "",
      "## Biography",
      longParagraph("Biography"),
      "",
      "## Behavior Rules",
      "- If the player pressures Mira about the sealed ledger, she deflects with humor before admitting fear.",
      "",
      "## Dialogue Style",
      "- Dialogue is clipped and avoids direct apologies until trust is earned.",
    ].join("\n"))
    const result = reviewRpgMergeOutput({
      pagePath: "wiki/characters/mira.md",
      existingContent: mergedCandidate,
      incomingContent: mergedCandidate,
      mergedCandidate,
      longPageThreshold: 500,
    })

    expect(result.disposition).toBe("accepted")
    expect(result.acceptedContent).toContain("## Biography")
    expect(result.acceptedContent).toContain("## Behavior Rules")
    expect(result.distillProposals).toHaveLength(1)
    expect(result.distillReviewItems).toHaveLength(1)
    expect(result.distillProposals[0].proposalMarkdown).toContain("REVIEW/proposal only")
    expect(result.acceptedContent).toContain("## Biography")
  })

  it("creates distill proposals for long relationship and plot-arc pages", () => {
    const relationship = PAGE("Mira and Caretaker", [
      "## Runtime Capsule",
      "- Debt leverage makes cooperation brittle.",
      "",
      "## Trust and Tension",
      "- Trust rises if the player protects the debt secret.",
      "",
      "## Character Profiles",
      longParagraph("Profile"),
    ].join("\n"))
    const plotArc = PAGE("Canal Threat", [
      "## Runtime Capsule",
      "- The canal gate is unresolved pressure.",
      "",
      "## Unresolved Questions",
      "- Who opened the inner sigil?",
      "",
      "## Route Recap",
      longParagraph("Route recap"),
    ].join("\n"))

    const relationshipResult = reviewRpgMergeOutput({
      pagePath: "wiki/relationships/mira-caretaker.md",
      existingContent: relationship,
      incomingContent: relationship,
      mergedCandidate: relationship,
      longPageThreshold: 500,
    })
    const plotResult = reviewRpgMergeOutput({
      pagePath: "wiki/plot-arcs/canal-threat.md",
      existingContent: plotArc,
      incomingContent: plotArc,
      mergedCandidate: plotArc,
      longPageThreshold: 500,
    })

    expect(relationshipResult.distillProposals[0].category).toBe("relationships")
    expect(plotResult.distillProposals[0].category).toBe("plot-arcs")
    expect(relationshipResult.acceptedContent).toContain("## Character Profiles")
    expect(plotResult.acceptedContent).toContain("## Route Recap")
  })

  it("applies compression candidate only for accepted proposals", () => {
    const original = PAGE("Mira", [
      "## Biography",
      longParagraph("Biography"),
      "",
      "## Behavior Rules",
      "- If pressured, Mira deflects with humor before admitting fear.",
      "",
      "## Dialogue Style",
      "- Dialogue is clipped and avoids direct apologies until trust is earned.",
    ].join("\n"))
    const review = reviewRpgMergeOutput({
      pagePath: "wiki/characters/mira.md",
      existingContent: original,
      incomingContent: original,
      mergedCandidate: original,
      longPageThreshold: 500,
    })
    const proposal = review.distillProposals[0]

    const accepted = applyAcceptedRpgDistillProposal({
      proposal,
      originalContent: original,
      status: "accepted",
    })
    const pending = applyAcceptedRpgDistillProposal({
      proposal,
      originalContent: original,
      status: "pending",
    })
    const rejected = applyAcceptedRpgDistillProposal({
      proposal,
      originalContent: original,
      status: "rejected",
    })

    expect(accepted.applied).toBe(true)
    expect(accepted.content).toContain("## Runtime Capsule")
    expect(accepted.content).toContain("## Behavior Rules")
    expect(accepted.content).toContain("## Dialogue Style")
    expect(accepted.content).toContain("## Compression Review Notes")
    expect(accepted.content).not.toContain("## Biography\n")
    expect(pending.applied).toBe(false)
    expect(pending.content).toBeNull()
    expect(rejected.applied).toBe(false)
    expect(rejected.content).toBeNull()
  })

  it("does not auto-distill manual style/rules/memory or source pages", () => {
    const longManual = PAGE("Style", "## Voice\n\n" + longParagraph("Style rule"))
    const paths = [
      "wiki/style/voice.md",
      "wiki/rules/table-rules.md",
      "wiki/memory/manual.md",
      "wiki/sources/raw-notes.md",
    ]

    for (const pagePath of paths) {
      const result = reviewRpgMergeOutput({
        pagePath,
        existingContent: longManual,
        incomingContent: longManual,
        mergedCandidate: longManual,
        longPageThreshold: 100,
      })
      expect(result.distillProposals, pagePath).toEqual([])
      expect(result.distillReviewItems, pagePath).toEqual([])
    }
  })
})

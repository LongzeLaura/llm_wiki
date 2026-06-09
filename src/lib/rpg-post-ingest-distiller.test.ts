import { describe, expect, it } from "vitest"
import {
  createRpgDistillReviewItems,
  distillRpgWikiPage,
  distillRpgWikiPages,
} from "./rpg-post-ingest-distiller"

function page(path: string, title: string, body: string): { path: string; content: string } {
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

function longParagraph(label: string): string {
  return Array.from({ length: 24 }, (_, index) => `${label} detail ${index + 1} repeats ordinary profile history without changing action, tension, risk, cost, trust, or portrayal.`).join(" ")
}

describe("Post-ingest RPG distiller", () => {
  it("creates a candidate Runtime Capsule for a character page and marks biography/timeline for compression", () => {
    const proposal = distillRpgWikiPage(page(
      "wiki/characters/mira.md",
      "Mira Vale",
      [
        "## Biography",
        longParagraph("Biography"),
        "",
        "## Timeline",
        longParagraph("Timeline"),
        "",
        "## Behavior Rules",
        "- If the player pressures Mira about the sealed ledger, she deflects with humor before admitting fear.",
        "- She refuses to endanger a child even when the faction demands it.",
        "",
        "## Dialogue Style",
        "- Dialogue is clipped, dry, and avoids direct apologies until trust is earned.",
      ].join("\n"),
    ))

    expect(proposal.category).toBe("characters")
    expect(proposal.hasRuntimeCapsule).toBe(false)
    expect(proposal.candidateRuntimeCapsule).toContain("## Runtime Capsule")
    expect(proposal.candidateRuntimeCapsule).toContain("NPC operating model")
    expect(proposal.compressSections.map((section) => section.heading)).toEqual(expect.arrayContaining(["Biography", "Timeline"]))
    expect(proposal.keepSections.map((section) => section.heading)).toEqual(expect.arrayContaining(["Behavior Rules", "Dialogue Style"]))
    expect(proposal.roleplaySignals.some((signal) => signal.kind === "portrayal_rule" && signal.utilityScore === 4)).toBe(true)
    expect(proposal.proposalMarkdown).toContain("## Recommended Compress")
  })

  it("keeps location interactables, dangers, clues, and sensory anchors", () => {
    const proposal = distillRpgWikiPage(page(
      "wiki/locations/old-archive.md",
      "Old Archive",
      [
        "## Sensory Anchors",
        "Dust tastes metallic in the air; the only light pulses under the locked map table.",
        "",
        "## Interactables",
        "The map table can be pried open, and the bell rope can call a hidden caretaker.",
        "",
        "## Dangers",
        "Opening the west stacks without a sigil releases glass moths and creates a real risk of injury.",
        "",
        "## Clues",
        "A wet footprint points toward the restricted lift.",
        "",
        "## Travel Guide",
        longParagraph("Architecture history"),
      ].join("\n"),
    ))

    expect(proposal.category).toBe("locations")
    expect(proposal.keepSections.map((section) => section.heading)).toEqual(expect.arrayContaining([
      "Sensory Anchors",
      "Interactables",
      "Dangers",
      "Clues",
    ]))
    expect(proposal.compressSections.map((section) => section.heading)).toContain("Travel Guide")
    expect(proposal.candidateRuntimeCapsule).toContain("playable scene card")
    expect(proposal.roleplaySignals.some((signal) => signal.kind === "scene_affordance")).toBe(true)
  })

  it("keeps only confirmed event facts and routes future plans or foreshadowing to human confirmation", () => {
    const proposal = distillRpgWikiPage(page(
      "wiki/events/archive-break-in.md",
      "Archive Break-In",
      [
        "## Confirmed Occurrence",
        "At midnight, Mira and the player entered the Old Archive through the canal door.",
        "",
        "## Consequences",
        "The alarm bell rang, the caretaker now knows someone entered, and the map table is damaged.",
        "",
        "## Future Plans and Foreshadowing",
        "Future scenes may reveal the caretaker's patron. If the player studies the torn map, this could become a progression condition for the next arc.",
        "",
        "## Route Timeline",
        longParagraph("Route timeline"),
      ].join("\n"),
    ))

    expect(proposal.category).toBe("events")
    expect(proposal.keepSections.map((section) => section.heading)).toEqual(expect.arrayContaining(["Confirmed Occurrence", "Consequences"]))
    expect(proposal.needsHumanConfirmation.map((section) => section.heading)).toContain("Future Plans and Foreshadowing")
    expect(proposal.needsHumanConfirmation[0].reason).toContain("plot-arcs")
    expect(proposal.compressSections.map((section) => section.heading)).toContain("Route Timeline")
    expect(proposal.candidateRuntimeCapsule).toContain("confirmed event history")
  })

  it("keeps plot-arc unresolved questions, pressure points, and progression conditions while flagging future-as-fact wording", () => {
    const proposal = distillRpgWikiPage(page(
      "wiki/plot-arcs/caretaker-patron.md",
      "Caretaker Patron",
      [
        "## Unresolved Questions",
        "Who pays the caretaker, and why does the patron need the map table hidden?",
        "",
        "## Pressure Points",
        "The patron may expose Mira's debt if the player presses too hard.",
        "",
        "## Progression Conditions",
        "Reveal the patron only after the player connects the wet footprint to the restricted lift.",
        "",
        "## Possible Future Written As Fact",
        "The patron may later reveal the ritual, but this section also says the reveal has already happened and must happen.",
      ].join("\n"),
    ))

    expect(proposal.category).toBe("plot-arcs")
    expect(proposal.keepSections.map((section) => section.heading)).toEqual(expect.arrayContaining([
      "Unresolved Questions",
      "Pressure Points",
      "Progression Conditions",
    ]))
    expect(proposal.needsHumanConfirmation.map((section) => section.heading)).toContain("Possible Future Written As Fact")
    expect(proposal.needsHumanConfirmation[0].reason).toContain("possible future")
    expect(proposal.candidateRuntimeCapsule).toContain("unresolved plot pressure")
  })

  it("keeps relationship trust, tension, secrets, and change triggers while compressing duplicate profiles", () => {
    const proposal = distillRpgWikiPage(page(
      "wiki/relationships/mira-caretaker.md",
      "Mira and the Caretaker",
      [
        "## Trust and Tension",
        "Mira trusts the caretaker's knowledge but distrusts his silence about the patron.",
        "",
        "## Secrets",
        "The caretaker knows Mira's debt and uses that secret to control the pace of cooperation.",
        "",
        "## Change Triggers",
        "Trust rises if the player protects the caretaker from the patron; trust drops if the debt is exposed publicly.",
        "",
        "## Character Profiles",
        longParagraph("Profile"),
      ].join("\n"),
    ))

    expect(proposal.category).toBe("relationships")
    expect(proposal.keepSections.map((section) => section.heading)).toEqual(expect.arrayContaining([
      "Trust and Tension",
      "Secrets",
      "Change Triggers",
    ]))
    expect(proposal.compressSections.map((section) => section.heading)).toContain("Character Profiles")
    expect(proposal.roleplaySignals.some((signal) => signal.kind === "relationship_tension")).toBe(true)
    expect(proposal.candidateRuntimeCapsule).toContain("relationship tension")
  })

  it("is pure and does not write back to the original page content", () => {
    const input = page(
      "wiki/characters/pure.md",
      "Pure Character",
      [
        "## Behavior Rules",
        "The character gives a clue only after the player accepts a cost.",
      ].join("\n"),
    )
    const before = { ...input }
    const first = distillRpgWikiPage(input)
    const second = distillRpgWikiPage(input)

    expect(input).toEqual(before)
    expect(first).toEqual(second)
    expect(first.proposalMarkdown).toContain("REVIEW/proposal only")
    expect(first.proposalMarkdown).not.toBe(input.content)
  })

  it("creates review proposals with affected page and inspect/dismiss options", () => {
    const proposals = distillRpgWikiPages([
      page(
        "wiki/locations/review-room.md",
        "Review Room",
        [
          "## Clues",
          "A torn badge gives the player an investigation hook.",
        ].join("\n"),
      ),
      page("wiki/sources/raw-profile.md", "Raw Profile", "## Evidence\nRelease and voice actor metadata."),
    ])
    const items = createRpgDistillReviewItems(proposals)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      type: "suggestion",
      sourcePath: "wiki/locations/review-room.md",
      affectedPages: ["wiki/locations/review-room.md"],
    })
    expect(items[0].description).toContain("Post-Ingest Distill Proposal")
    expect(items[0].options).toEqual([
      { label: "Inspect", action: "Inspect" },
      { label: "Dismiss", action: "Dismiss" },
    ])
    expect(proposals[1].skipped).toBe(true)
    expect(proposals[1].warnings[0]).toContain("wiki/sources/")
  })
})

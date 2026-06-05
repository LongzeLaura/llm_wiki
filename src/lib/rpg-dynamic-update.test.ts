import { describe, expect, it } from "vitest"
import {
  prepareExistingContentForRpgDynamicMerge,
  validateRpgDynamicWrite,
} from "./rpg-dynamic-update"

const PAGE = (body: string) => [
  "---",
  'type: "characters"',
  'title: "Rin"',
  "---",
  "",
  body,
].join("\n")

describe("prepareExistingContentForRpgDynamicMerge", () => {
  it("strips stale character current-state sections before merge", () => {
    const existing = PAGE([
      "# Rin",
      "",
      "## Canon Facts",
      "Rin is a disciplined magus.",
      "",
      "## Current State",
      "Standing in the school courtyard.",
      "",
      "## Player Relevance",
      "Suspicious of the player.",
    ].join("\n"))

    const prepared = prepareExistingContentForRpgDynamicMerge("wiki/characters/rin.md", existing)

    expect(prepared).toContain("## Canon Facts")
    expect(prepared).toContain("Rin is a disciplined magus.")
    expect(prepared).not.toContain("## Current State")
    expect(prepared).not.toContain("Standing in the school courtyard.")
    expect(prepared).not.toContain("## Player Relevance")
  })

  it("keeps long-term character-card sections instead of stripping them as dynamic trash", () => {
    const existing = PAGE([
      "# Rin",
      "",
      "## Canon Facts",
      "- Heir to the Tohsaka family.",
      "",
      "## Reasonable Interpretation",
      "- Uses sharpness to protect vulnerability.",
      "",
      "## Psychological Model",
      "- Shame quickly becomes defiance.",
      "",
      "## Dialogue Style",
      "- Precise, sarcastic, and defensive when embarrassed.",
      "",
      "## Relationship Dynamics",
      "- Tests trust before showing softness.",
      "",
      "## Route and Timeline Variants",
      "- UBW route and HF route should stay distinct.",
      "",
      "## RP Usage",
      "- Push competence and pride before asking for intimacy.",
      "",
      "## Evidence and Uncertainty",
      "- Some post-ending emotional states remain route-dependent.",
      "",
      "## Recent Changes",
      "- Just argued with Archer.",
    ].join("\n"))

    const prepared = prepareExistingContentForRpgDynamicMerge("wiki/characters/rin.md", existing)

    expect(prepared).toContain("## Canon Facts")
    expect(prepared).toContain("## Reasonable Interpretation")
    expect(prepared).toContain("## Psychological Model")
    expect(prepared).toContain("## Dialogue Style")
    expect(prepared).toContain("## Relationship Dynamics")
    expect(prepared).toContain("## Route and Timeline Variants")
    expect(prepared).toContain("## RP Usage")
    expect(prepared).toContain("## Evidence and Uncertainty")
    expect(prepared).not.toContain("## Recent Changes")
  })

  it("strips plot-arc future-direction sections before merge", () => {
    const existing = [
      "---",
      'type: "plot-arcs"',
      'title: "Main Arc"',
      "---",
      "",
      "# Main Arc",
      "",
      "## Core Question",
      "Who is controlling the city barrier?",
      "",
      "## Future Directions",
      "The player may confront the church next.",
      "",
      "## Next Steps",
      "Reveal a hidden messenger.",
    ].join("\n")

    const prepared = prepareExistingContentForRpgDynamicMerge("wiki/plot-arcs/main-arc.md", existing)

    expect(prepared).toContain("## Core Question")
    expect(prepared).not.toContain("## Future Directions")
    expect(prepared).not.toContain("## Next Steps")
  })
})

describe("validateRpgDynamicWrite", () => {
  it("rejects events pages that contain future-planning sections", () => {
    const content = [
      "---",
      'type: "events"',
      'title: "Timeline"',
      "---",
      "",
      "# Timeline",
      "",
      "## Summary",
      "The player escaped the warehouse.",
      "",
      "## Possible Directions",
      "Next, the player may investigate the mayor.",
    ].join("\n")

    const result = validateRpgDynamicWrite("wiki/events/timeline.md", content)

    expect(result.allowWrite).toBe(false)
    expect(result.warnings[0]).toContain("wiki/events/")
    expect(result.warnings[0]).toContain("wiki/plot-arcs/")
  })

  it("allows events pages that stay historical", () => {
    const content = [
      "---",
      'type: "events"',
      'title: "Timeline"',
      "---",
      "",
      "# Timeline",
      "",
      "## Summary",
      "The player escaped the warehouse.",
      "",
      "## Consequences",
      "The guards now know the player's face.",
    ].join("\n")

    const result = validateRpgDynamicWrite("wiki/events/timeline.md", content)

    expect(result.allowWrite).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it("rejects current-scene pages generated from static encyclopedia-style ending material", () => {
    const content = [
      "---",
      'type: "current-scene"',
      'title: "Current Scene"',
      "---",
      "",
      "# Current Scene",
      "",
      "Saber and Shirou watch cherry blossoms in the HF True End epilogue.",
    ].join("\n")

    const result = validateRpgDynamicWrite("wiki/current-scene/scene_state.md", content, {
      sourcePath: "raw/sources/fate-encyclopedia.md",
      sourceText: "HF True End flower-viewing epilogue. Years later, Shirou and Saber reunite under the blossoms. This is an ending summary and route recap.",
    })

    expect(result.allowWrite).toBe(false)
    expect(result.warnings[0]).toContain("wiki/current-scene/")
    expect(result.warnings[0]).toContain("wiki/events/")
    expect(result.warnings[0]).toContain("wiki/plot-arcs/")
  })

  it("allows current-scene pages when the source explicitly declares the live scene", () => {
    const content = [
      "---",
      'type: "current-scene"',
      'title: "Current Scene"',
      "---",
      "",
      "# Current Scene",
      "",
      "The player is standing at the Fuyuki church gate, preparing to question Kirei.",
    ].join("\n")

    const result = validateRpgDynamicWrite("wiki/current-scene/scene_state.md", content, {
      sourcePath: "raw/sources/session-03.md",
      sourceText: "[RPG-LIVE]\nCurrent scene: the player is standing at the Fuyuki church gate. GM notes that the church interior is lit by candlelight.",
    })

    expect(result.allowWrite).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it("rejects unmarked Current scene input even when it looks like live play", () => {
    const content = [
      "---",
      'type: "current-scene"',
      'title: "Current Scene"',
      "---",
      "",
      "# Current Scene",
      "",
      "The player is standing at the Fuyuki church gate, preparing to question Kirei.",
    ].join("\n")

    const result = validateRpgDynamicWrite("wiki/current-scene/scene_state.md", content, {
      sourcePath: "raw/sources/session-03.md",
      sourceText: "Current scene: the player is standing at the Fuyuki church gate.\nGM: The church interior is lit by candlelight.\nPlayer: I push the door open.",
    })

    expect(result.allowWrite).toBe(false)
    expect(result.warnings[0]).toContain("[RPG-LIVE]")
    expect(result.warnings[0]).toContain("wiki/current-scene/")
  })
})

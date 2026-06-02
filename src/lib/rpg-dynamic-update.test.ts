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
      "## Static Profile",
      "A disciplined magus.",
      "",
      "## Current State",
      "Standing in the school courtyard.",
      "",
      "## Player Relevance",
      "Suspicious of the player.",
    ].join("\n"))

    const prepared = prepareExistingContentForRpgDynamicMerge(
      "wiki/characters/rin.md",
      existing,
    )

    expect(prepared).toContain("## Static Profile")
    expect(prepared).toContain("A disciplined magus.")
    expect(prepared).not.toContain("## Current State")
    expect(prepared).not.toContain("Standing in the school courtyard.")
    expect(prepared).not.toContain("## Player Relevance")
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

    const prepared = prepareExistingContentForRpgDynamicMerge(
      "wiki/plot-arcs/main-arc.md",
      existing,
    )

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
})

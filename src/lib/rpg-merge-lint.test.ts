import { describe, expect, it } from "vitest"
import { lintRpgMergedPage } from "./rpg-merge-lint"

const PAGE = (body: string) => `---\ntype: test\ntitle: Test\n---\n\n${body}`

describe("lintRpgMergedPage", () => {
  it("does not require Runtime Capsule for source pages", () => {
    const result = lintRpgMergedPage(PAGE("## Source Summary\n\nEvidence notes."), {
      pagePath: "wiki/sources/fate-notes.md",
    })

    expect(result.shouldReject).toBe(false)
    expect(result.issues).toEqual([])
  })

  it("warns but does not reject when a base character page lacks Runtime Capsule", () => {
    const result = lintRpgMergedPage(PAGE("## Behavior Rules\n\n- Keeps distance under pressure."), {
      pagePath: "wiki/characters/rin.md",
    })

    expect(result.shouldReject).toBe(false)
    expect(result.issues).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "missing-runtime-capsule",
        pagePath: "wiki/characters/rin.md",
      }),
    ])
  })

  it("rejects events pages that contain future plans or next-step suggestions", () => {
    const result = lintRpgMergedPage(
      PAGE("## Runtime Capsule\n\n- Already happened at the bridge.\n\n## Next Steps\n\n- Possible future: if the player chooses, the ambush may happen later."),
      { pagePath: "wiki/events/bridge-incident.md" },
    )

    expect(result.shouldReject).toBe(true)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "reject",
          code: "event-future-or-option-contamination",
        }),
      ]),
    )
  })

  it("rejects plot-arcs pages that write possible futures as confirmed happened facts", () => {
    const result = lintRpgMergedPage(
      PAGE("## Runtime Capsule\n\n- The unresolved threat pressures the next scene.\n\n## Possible Developments\n\n- This possible future has happened already and is now canon."),
      { pagePath: "wiki/plot-arcs/canal-threat.md" },
    )

    expect(result.shouldReject).toBe(true)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "reject",
          code: "plot-arc-future-as-fact",
        }),
      ]),
    )
  })

  it("rejects plot-arc possible futures placed inside Confirmed Facts", () => {
    const result = lintRpgMergedPage(
      PAGE("## Runtime Capsule\n\n- The unresolved threat pressures the next scene.\n\n## Confirmed Facts\n\n- Possible future: the rival may exploit the opened gate.\n\n## Possible Futures\n\n- The canal could flood if ignored."),
      { pagePath: "wiki/plot-arcs/canal-threat.md" },
    )

    expect(result.shouldReject).toBe(true)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "reject",
          code: "plot-arc-future-in-confirmed-facts",
        }),
      ]),
    )
  })

  it("allows normal plot-arc pages with Confirmed Facts and separate Possible Futures", () => {
    const result = lintRpgMergedPage(
      PAGE("## Runtime Capsule\n\n- The canal gate is unresolved pressure.\n\n## Confirmed Facts\n\n- The outer gate opened.\n\n## Possible Futures\n\n- The canal could flood if ignored."),
      { pagePath: "wiki/plot-arcs/canal-threat.md" },
    )

    expect(result.shouldReject).toBe(false)
    expect(result.issues).toEqual([])
  })

  it.each([
    ["wiki/characters/rin.md", "Current campaign state: currently wounded after this session."],
    ["wiki/locations/church.md", "Current scene: now located at the sealed church."],
    ["wiki/factions/association.md", "This session changed the faction stance."],
    ["wiki/items/gem.md", "Current holder: the player after an accepted player action."],
  ])("flags runtime-only current state in base stable pages: %s", (pagePath, body) => {
    const result = lintRpgMergedPage(
      PAGE(`## Runtime Capsule\n\n- Pressure cue for play.\n\n## Notes\n\n${body}`),
      { pagePath },
    )

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "base-page-runtime-state-contamination",
          pagePath,
        }),
      ]),
    )
  })

  it("rejects current-scene pages that accumulate history or full timelines", () => {
    const result = lintRpgMergedPage(
      PAGE("## Runtime Capsule\n\n- Immediate danger is visible.\n\n## Complete Event Timeline\n\n- All previous events from the route recap are preserved here."),
      { pagePath: "wiki/current-scene/scene_state.md" },
    )

    expect(result.shouldReject).toBe(true)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "reject",
          code: "current-scene-accumulated-history",
        }),
      ]),
    )
  })
})

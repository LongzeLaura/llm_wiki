import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  ActionOptionsPanel,
  CurrentScenePanel,
  RpgPlayPanel,
  TurnNarrativePanel,
} from "@/components/rpg"
import type { RpgActionOption } from "@/lib/rpg-runtime"

describe("RPG Play Panel v0 components", () => {
  it("exports Stage 4 RPG panel components from src/components/rpg", () => {
    expect(RpgPlayPanel).toBeTypeOf("function")
    expect(CurrentScenePanel).toBeTypeOf("function")
    expect(ActionOptionsPanel).toBeTypeOf("function")
    expect(TurnNarrativePanel).toBeTypeOf("function")
  })

  it("renders the current scene in the dedicated RPG play panel", () => {
    const html = renderToStaticMarkup(
      <RpgPlayPanel
        currentScene="Iven and Mira face a locked canal gate."
        lastNarrative=""
        nextActionOptions={sampleOptions()}
        onSubmitAction={() => undefined}
      />,
    )

    expect(html).toContain("Current scene")
    expect(html).toContain("Iven and Mira face a locked canal gate.")
  })

  it("renders the last narrative separately from candidate options", () => {
    const html = renderToStaticMarkup(
      <RpgPlayPanel
        currentScene="The patrol lanterns are passing overhead."
        lastNarrative="Mira traces the sigil and stops before touching the crack."
        nextActionOptions={sampleOptions()}
        onSubmitAction={() => undefined}
      />,
    )

    expect(html).toContain("Last narrative")
    expect(html).toContain("Mira traces the sigil")
    expect(html).toContain("Future candidate actions")
    expect(html).not.toContain("Completed future action")
    expect(html).not.toContain("Wiki update")
  })

  it("renders action options as future candidate actions", () => {
    const html = renderToStaticMarkup(
      <ActionOptionsPanel
        options={sampleOptions()}
        selectedOptionId="opt-talk"
        onSelectOption={() => undefined}
      />,
    )

    expect(html).toContain("Future candidate actions")
    expect(html).toContain("Ask Mira what the cracked sigil means before touching it.")
    expect(html).toContain("Force the canal gate before the patrol returns.")
    expect(html).toContain("Wait in silence and watch the patrol route.")
  })
})

function sampleOptions(): RpgActionOption[] {
  return [
    {
      id: "opt-talk",
      playerFacingText: "Ask Mira what the cracked sigil means before touching it.",
      intent: "talk",
      riskLevel: "low",
      likelyAffectedPaths: ["wiki/relationships/iven-mira.md"],
    },
    {
      id: "opt-force",
      playerFacingText: "Force the canal gate before the patrol returns.",
      intent: "fight",
      riskLevel: "high",
      likelyAffectedPaths: ["wiki/current-scene/scene_state.md", "wiki/events/session-03.md"],
    },
    {
      id: "opt-wait",
      playerFacingText: "Wait in silence and watch the patrol route.",
      intent: "wait",
      riskLevel: "medium",
      likelyAffectedPaths: ["wiki/plot-arcs/canal-gate.md"],
    },
  ]
}

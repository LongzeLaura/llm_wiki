import { describe, expect, it } from "vitest"
import { mergeRpgSections } from "./rpg-section-merge"

const PAGE = (body: string) => `---\ntype: test\ntitle: Test\n---\n\n${body}`

function merge(
  llmBody: string,
  options: {
    pagePath?: string
    existingBody?: string
    incomingBody?: string
  } = {},
) {
  return mergeRpgSections(PAGE(llmBody), {
    pagePath: options.pagePath ?? "wiki/relationships/rin-shirou.md",
    existingContent: PAGE(options.existingBody ?? ""),
    incomingContent: PAGE(options.incomingBody ?? ""),
  })
}

describe("mergeRpgSections", () => {
  it("parses and recomposes core ## / ### RPG sections", () => {
    const result = merge(
      [
        "## Runtime Capsule",
        "",
        "- Immediate pressure cue.",
        "",
        "## Current State",
        "",
        "- Current stance.",
        "",
        "### Evidence and Uncertainty",
        "",
        "- Source A is uncertain.",
        "",
        "## Confirmed Facts",
        "",
        "- Fact A.",
        "",
        "## Possible Futures",
        "",
        "- Future pressure A.",
      ].join("\n"),
      { pagePath: "wiki/plot-arcs/main.md" },
    )

    expect(result.content).toContain("---\ntype: test\ntitle: Test\n---")
    expect(result.content).toContain("## Runtime Capsule")
    expect(result.content).toContain("## Current State")
    expect(result.content).toContain("### Evidence and Uncertainty")
    expect(result.content).toContain("## Confirmed Facts")
    expect(result.content).toContain("## Possible Futures")
    expect(result.appliedStrategies).toEqual(
      expect.arrayContaining([
        { heading: "Runtime Capsule", strategy: "prefer-llm" },
        { heading: "Current State", strategy: "prefer-llm" },
        { heading: "Evidence and Uncertainty", strategy: "append-dedupe" },
        { heading: "Confirmed Facts", strategy: "append-dedupe" },
        { heading: "Possible Futures", strategy: "append-dedupe" },
      ]),
    )
  })

  it("replaces stale Current State on runtime-state pages with LLM or incoming state", () => {
    const llmState = merge("## Current State\n\n- Player is beside the sealed gate.", {
      pagePath: "wiki/player/status.md",
      existingBody: "## Current State\n\n- Player is still in the tavern.",
      incomingBody: "## Current State\n\n- Player is beside the canal.",
    })
    expect(llmState.content).toContain("sealed gate")
    expect(llmState.content).not.toContain("still in the tavern")

    const incomingState = merge("## Runtime Capsule\n\n- Player state matters next turn.", {
      pagePath: "wiki/player/status.md",
      existingBody: "## Current State\n\n- Player is still in the tavern.",
      incomingBody: "## Current State\n\n- Player is beside the canal.",
    })
    expect(incomingState.content).toContain("Player is beside the canal")
    expect(incomingState.content).not.toContain("still in the tavern")
  })

  it("append-dedupe merges Evidence and Uncertainty bullet lines", () => {
    const result = merge("## Evidence and Uncertainty\n\n- Source B says the gate is locked.\n- Source C is unsure.", {
      existingBody: "## Evidence and Uncertainty\n\n- Source A saw the broken key.\n- Source B says the gate is locked.",
      incomingBody: "## Evidence and Uncertainty\n\n- Source B says the gate is locked.\n- Source D contradicts the timing.",
    })

    expect(result.content).toContain("- Source A saw the broken key.")
    expect(result.content).toContain("- Source B says the gate is locked.")
    expect(result.content).toContain("- Source C is unsure.")
    expect(result.content).toContain("- Source D contradicts the timing.")
    expect(result.content.match(/Source B says the gate is locked/g)).toHaveLength(1)
  })

  it("append-dedupe merges Confirmed Facts without absorbing Possible Futures", () => {
    const result = merge("## Confirmed Facts\n\n- The bridge bell rang.\n\n## Possible Futures\n\n- The rival may arrive later.", {
      pagePath: "wiki/plot-arcs/canal-threat.md",
      existingBody: "## Confirmed Facts\n\n- The gate was sealed.\n\n## Possible Futures\n\n- The rival may arrive later.",
      incomingBody: "## Confirmed Facts\n\n- The player found the key.\n\n## Possible Futures\n\n- The canal could flood.",
    })

    const confirmed = result.content.slice(
      result.content.indexOf("## Confirmed Facts"),
      result.content.indexOf("## Possible Futures"),
    )
    expect(confirmed).toContain("The gate was sealed")
    expect(confirmed).toContain("The player found the key")
    expect(confirmed).toContain("The bridge bell rang")
    expect(confirmed).not.toContain("rival may arrive")
    expect(confirmed).not.toContain("canal could flood")
  })

  it("keeps plot-arcs Possible Futures as possible futures instead of confirmed facts", () => {
    const result = merge("## Runtime Capsule\n\n- Unresolved canal pressure.\n\n## Confirmed Facts\n\n- The gate was sealed.\n\n## Possible Futures\n\n- The canal could flood.", {
      pagePath: "wiki/plot-arcs/canal-threat.md",
      existingBody: "## Possible Futures\n\n- The rival may arrive later.",
      incomingBody: "## Possible Futures\n\n- The seal may crack if ignored.",
    })

    expect(result.content).toContain("## Possible Futures")
    expect(result.content).toContain("The rival may arrive later")
    expect(result.content).toContain("The seal may crack if ignored")
    expect(result.content).toContain("The canal could flood")
    const confirmed = result.content.slice(
      result.content.indexOf("## Confirmed Facts"),
      result.content.indexOf("## Possible Futures"),
    )
    expect(confirmed).not.toContain("may arrive")
    expect(confirmed).not.toContain("may crack")
  })

  it("preserves Possible Futures on event pages for lint rejection instead of repairing them", () => {
    const result = merge("## Runtime Capsule\n\n- Confirmed incident.\n\n## Possible Futures\n\n- The ambush may happen later.", {
      pagePath: "wiki/events/bridge-incident.md",
      existingBody: "## Confirmed Facts\n\n- The guard withdrew.",
      incomingBody: "## Possible Futures\n\n- The rival may arrive.",
    })

    expect(result.content).toContain("## Possible Futures")
    expect(result.content).toContain("The ambush may happen later")
    expect(result.content).not.toContain("The rival may arrive")
  })

  it("does not restore low-value sections deleted by the LLM on runtime-facing non-source pages", () => {
    const result = merge("## Runtime Capsule\n\n- The NPC tests player honesty.", {
      pagePath: "wiki/characters/rin.md",
      existingBody: "## Trivia\n\n- Birthday metadata.\n\n## Voice Actor\n\n- Cast note.\n\n## Full Biography\n\n- Long character profile.",
      incomingBody: "## Release Metadata\n\n- Platform note.",
    })

    expect(result.content).not.toContain("## Trivia")
    expect(result.content).not.toContain("## Voice Actor")
    expect(result.content).not.toContain("## Full Biography")
    expect(result.content).not.toContain("## Release Metadata")
  })

  it("does not drop low-value or evidence-like sections present in source pages", () => {
    const result = merge("## Production Notes\n\n- Source-only metadata.\n\n## Evidence and Uncertainty\n\n- Source conflicts with another guide.", {
      pagePath: "wiki/sources/source-notes.md",
      existingBody: "## Evidence and Uncertainty\n\n- Older source has a different date.",
    })

    expect(result.content).toContain("## Production Notes")
    expect(result.content).toContain("Source-only metadata")
    expect(result.content).toContain("Older source has a different date")
  })

  it("restores an incoming Runtime Capsule when the LLM omitted it", () => {
    const result = merge("## Behavior Rules\n\n- Keeps distance until proof appears.", {
      pagePath: "wiki/characters/rin.md",
      existingBody: "## Runtime Capsule\n\n- Older capsule.",
      incomingBody: "## Runtime Capsule\n\n- Incoming capsule with better next-turn use.",
    })

    expect(result.content.indexOf("## Runtime Capsule")).toBeLessThan(result.content.indexOf("## Behavior Rules"))
    expect(result.content).toContain("Incoming capsule with better next-turn use")
    expect(result.content).not.toContain("Older capsule")
    expect(result.warnings).toEqual([expect.stringContaining("Restored existing Runtime Capsule")])
  })

  it("can preserve useful existing runtime sections while replacing touched sections", () => {
    const result = mergeRpgSections("## Current State\n\n- Player is beside the opened canal gate.", {
      pagePath: "wiki/player/player.md",
      existingContent: PAGE(
        "## Current State\n\n- Player is still outside the sealed gate.\n\n## Known Resources\n\n- Lantern key is available.\n\n## Trivia\n\n- Menu metadata.",
      ),
      incomingContent: PAGE("## Current State\n\n- Player is beside the opened canal gate."),
      preserveExistingSections: true,
    })

    expect(result.content).toContain("Player is beside the opened canal gate")
    expect(result.content).not.toContain("still outside the sealed gate")
    expect(result.content).toContain("## Known Resources")
    expect(result.content).toContain("Lantern key is available")
    expect(result.content).not.toContain("## Trivia")
  })
})

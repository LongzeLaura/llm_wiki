import { describe, expect, it } from "vitest"
import {
  buildStructuredRpgSignalContext,
  mergeRpgIngestSignals,
  normalizeRpgIngestSignal,
  parseRpgIngestSignalsFromText,
  type RpgIngestSignal,
} from "./rpg-ingest-signals"

function signal(overrides: Partial<RpgIngestSignal> = {}): RpgIngestSignal {
  return {
    kind: "plot_pressure",
    targetPath: "wiki/plot-arcs/canal-gate-pressure.md",
    summary: "The locked canal gate keeps pressure on the crew.",
    rpUse: "Use as an unresolved pressure that forces negotiation or stealth.",
    evidence: "The source says the canal gate is locked from above.",
    utilityScore: 4,
    confidence: "medium",
    canonStatus: "canon",
    ...overrides,
  }
}

describe("RpgIngestSignal normalizer", () => {
  it("keeps a valid fenced JSON signal", () => {
    const parsed = parseRpgIngestSignalsFromText([
      "## RP Runtime Signals JSON",
      "```json",
      JSON.stringify([signal({ sourceChunkId: undefined })]),
      "```",
    ].join("\n"), { sourceChunkId: "chunk-1" })

    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({
      kind: "plot_pressure",
      targetPath: "wiki/plot-arcs/canal-gate-pressure.md",
      utilityScore: 4,
      confidence: "medium",
      canonStatus: "canon",
      sourceChunkId: "chunk-1",
    })
  })

  it("clamps utilityScore and defaults invalid enum values safely", () => {
    const normalized = normalizeRpgIngestSignal({
      kind: "major_reveal",
      targetPath: "wiki/events/reveal.md",
      summary: "Invalid kind should not become an event signal.",
      rpUse: "Would be dangerous if used directly.",
      evidence: "The chunk contains a vague reveal note.",
      utilityScore: 99,
      confidence: "certain",
      canonStatus: "definitely_canon",
    })

    expect(normalized).toMatchObject({
      kind: "noise",
      utilityScore: 1,
      confidence: "low",
      canonStatus: "uncertain",
    })
  })

  it("clears unsafe targetPath values", () => {
    const normalized = normalizeRpgIngestSignal({
      kind: "action_hook",
      targetPath: "../wiki/plot-arcs/escape.md",
      summary: "Unsafe path should not survive normalization.",
      rpUse: "Use as a review-only hook.",
      evidence: "The chunk mentions an escape path.",
      utilityScore: 3,
      confidence: "high",
      canonStatus: "canon",
    })

    expect(normalized?.targetPath).toBeUndefined()
    expect(normalized?.warnings?.some((warning) => warning.includes("Unsafe targetPath"))).toBe(true)
  })

  it("clears other-mode Source Ingest targetPath values and keeps them review-only", () => {
    const normalized = normalizeRpgIngestSignal({
      kind: "style_rule",
      targetPath: "wiki/style/narration.md",
      summary: "Use terse second-person narration.",
      rpUse: "This should become a control document review, not a source page.",
      evidence: "The chunk gives global narration requirements.",
      utilityScore: 5,
      confidence: "high",
      canonStatus: "canon",
    })

    expect(normalized).toMatchObject({
      kind: "style_rule",
      targetPath: undefined,
      utilityScore: 2,
    })
    expect(normalized?.warnings?.some((warning) => warning.includes("control_doc_import"))).toBe(true)
  })

  it("clears unsupported player targetPath values outside fixed Source Ingest slots", () => {
    const normalized = normalizeRpgIngestSignal({
      kind: "state_change",
      targetPath: "wiki/player/custom-sheet.md",
      summary: "A loose player sheet appeared.",
      rpUse: "Should not create arbitrary player files.",
      evidence: "The chunk describes a custom player packet.",
      utilityScore: 4,
      confidence: "medium",
      canonStatus: "canon",
    })

    expect(normalized?.targetPath).toBeUndefined()
    expect(normalized?.utilityScore).toBe(2)
    expect(normalized?.warnings?.some((warning) => warning.includes("not an allowed Source Ingest target"))).toBe(true)
  })

  it("downgrades non-noise signals with missing summary or evidence", () => {
    const normalized = normalizeRpgIngestSignal({
      kind: "relationship_tension",
      targetPath: "wiki/relationships/iven-mira.md",
      summary: "Mira distrusts Iven under pressure.",
      rpUse: "Use to frame guarded dialogue.",
      utilityScore: 5,
      confidence: "high",
      canonStatus: "canon",
    })

    expect(normalized).toMatchObject({
      kind: "noise",
      utilityScore: 1,
      confidence: "low",
      canonStatus: "uncertain",
    })
  })
})

describe("RpgIngestSignal merge", () => {
  it("deduplicates repeated signals and caps merged evidence/rpUse text", () => {
    const merged = mergeRpgIngestSignals([
      signal({
        summary: "Gate pressure",
        rpUse: "A".repeat(80),
        evidence: "Chunk one evidence about the locked gate.",
      }),
      signal({
        summary: "gate pressure",
        rpUse: "B".repeat(80),
        evidence: "Chunk two evidence about the locked gate.",
        utilityScore: 5,
        confidence: "high",
      }),
    ], { maxEvidenceChars: 90, maxRpUseChars: 90 })

    expect(merged).toHaveLength(1)
    expect(merged[0].utilityScore).toBe(5)
    expect(merged[0].confidence).toBe("high")
    expect(merged[0].evidence.length).toBeLessThanOrEqual(90)
    expect(merged[0].rpUse.length).toBeLessThanOrEqual(90)
  })

  it("does not promote uncertain or inferred signals to canon", () => {
    const merged = mergeRpgIngestSignals([
      signal({ summary: "Mira tests trust", kind: "relationship_tension", targetPath: "wiki/relationships/iven-mira.md", canonStatus: "canon" }),
      signal({ summary: "Mira tests trust", kind: "relationship_tension", targetPath: "wiki/relationships/iven-mira.md", canonStatus: "uncertain", confidence: "low" }),
      signal({ summary: "Mira tests trust", kind: "relationship_tension", targetPath: "wiki/relationships/iven-mira.md", canonStatus: "inferred_for_play" }),
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0].canonStatus).toBe("uncertain")
  })
})

describe("structured long-source signal context", () => {
  it("routes utilityScore 3-5, 2, and 0-1 into separate Stage 2 sections", () => {
    const context = buildStructuredRpgSignalContext([
      signal({ utilityScore: 5, summary: "Hard gate rule", kind: "world_constraint", targetPath: "wiki/world/supernatural_presence.md" }),
      signal({ utilityScore: 3, summary: "Usable action hook", kind: "action_hook", targetPath: "wiki/plot-arcs/gate-pressure.md" }),
      signal({ utilityScore: 2, summary: "Weak rumor", kind: "plot_pressure", targetPath: "wiki/plot-arcs/gate-rumor.md", canonStatus: "uncertain" }),
      signal({ utilityScore: 1, summary: "Voice actor trivia", kind: "noise", targetPath: undefined, confidence: "low", canonStatus: "uncertain" }),
    ], { sourceIdentity: "raw/sources/long-recap.md" })

    expect(context).toContain("## Structured RP Runtime Signals")
    expect(context).toContain("### Core Page Signals (utilityScore 3-5)")
    expect(context).toContain("Hard gate rule")
    expect(context).toContain("Runtime Capsule priority: yes")
    expect(context).toContain("### Review / Evidence and Uncertainty Signals (utilityScore 2)")
    expect(context).toContain("Weak rumor")
    expect(context).toContain("### Source-only / Ignored Noise Signals (utilityScore 0-1)")
    expect(context).toContain("Voice actor trivia")
  })

  it("keeps long plot recaps oriented toward plot-arcs plus discrete confirmed events", () => {
    const context = buildStructuredRpgSignalContext([
      signal({
        kind: "plot_pressure",
        targetPath: "wiki/plot-arcs/hf-route-pressure.md",
        summary: "The route-level secret remains unresolved and should create pressure.",
        rpUse: "Use as unresolved conflict and progression condition, not as a completed event.",
        evidence: "The long recap describes foreshadowing and possible later reveals.",
        utilityScore: 4,
        canonStatus: "uncertain",
      }),
      signal({
        kind: "state_change",
        targetPath: "wiki/events/sakura-transfer.md",
        summary: "Sakura was transferred to the Matou family.",
        rpUse: "Use as a confirmed past event with consequences.",
        evidence: "The recap states this transfer already happened before the route.",
        utilityScore: 3,
        canonStatus: "canon",
      }),
    ])

    expect(context).toContain("needed_categories: [plot-arcs, events]")
    expect(context).toContain("Do not turn a long route/course summary into one long wiki/events/ page")
    expect(context).toContain("wiki/plot-arcs/hf-route-pressure.md")
    expect(context).toContain("wiki/events/sakura-transfer.md")
  })

  it("carries D1 boundary rules into structured signal context", () => {
    const context = buildStructuredRpgSignalContext([
      signal({
        kind: "action_hook",
        targetPath: "wiki/plot-arcs/gate-pressure.md",
        summary: "The gate pressure remains unresolved.",
        rpUse: "Keep it as story pressure, not a player checklist.",
        evidence: "The source frames the gate as unresolved pressure.",
        utilityScore: 4,
      }),
    ])

    expect(context).toContain("PC subjective goals may enter wiki/player/goals.md only for an explicitly declared current PC")
    expect(context).toContain("wiki/quests/ is REVIEW-only in ordinary Source Ingest")
    expect(context).toContain("Plot pressure, unresolved conflict, foreshadowing, and possible development belong in wiki/plot-arcs/, not wiki/player/goals.md")
    expect(context).toContain("Player TODO/checklists are REVIEW-only unless they are true current-PC subjective goals")
    expect(context).toContain("character-specific voice, catchphrases, address habits, politeness level")
    expect(context).toContain("rules/control material is REVIEW-only control_doc_import material")
    expect(context).toContain("world material is background, common knowledge, history, society, geography, and stable setting facts")
  })

  it("treats metadata-heavy trivia fixtures as high noise/source-only", () => {
    const context = buildStructuredRpgSignalContext([
      signal({ kind: "noise", targetPath: undefined, summary: "Release platform metadata", rpUse: "Archive only.", evidence: "The source lists release versions.", utilityScore: 0, confidence: "low", canonStatus: "uncertain" }),
      signal({ kind: "noise", targetPath: undefined, summary: "Voice actor listing", rpUse: "Archive only.", evidence: "The source lists voice actors.", utilityScore: 1, confidence: "low", canonStatus: "uncertain" }),
    ])

    expect(context).toContain("needed_categories: []")
    expect(context).toContain("noise_ratio: high")
    expect(context).toContain("recommended_ingest_mode: source_only")
    expect(context).toContain("No utilityScore 3-5 signals were extracted")
  })
})

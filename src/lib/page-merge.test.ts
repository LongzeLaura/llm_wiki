/**
 * Tests for the page-merge layer that decides what content to write
 * when an ingest produces a wiki page that already exists on disk.
 *
 * The merger function (LLM call) is injected so these tests run
 * deterministically without hitting any model. A separate real-llm
 * test suite exercises the wired-up production path against the
 * actual generation model.
 */
import { describe, it, expect, vi } from "vitest"
import { mergePageContent } from "./page-merge"

const PAGE = (fm: string, body: string) => `---\n${fm}\n---\n\n${body}`

const FIXED_TODAY = () => "2026-04-30"
const baseOpts = {
  sourceFileName: "doc-B.pdf",
  pagePath: "wiki/entities/foo.md",
  today: FIXED_TODAY,
}

// ──────────────────────────────────────────────────────────────────
// Fast paths — no LLM call should happen
// ──────────────────────────────────────────────────────────────────

describe("mergePageContent — fast paths", () => {
  it("returns newContent when existingContent is null (new page)", async () => {
    const merger = vi.fn()
    const out = await mergePageContent(
      PAGE('type: entity\ntitle: Foo\nsources: ["doc.pdf"]', "body"),
      null,
      merger,
      baseOpts,
    )
    expect(out).toContain('sources: ["doc.pdf"]')
    expect(merger).not.toHaveBeenCalled()
  })

  it("returns existingContent when both contents are byte-identical", async () => {
    const merger = vi.fn()
    const c = PAGE("type: entity\ntitle: Foo", "body")
    const out = await mergePageContent(c, c, merger, baseOpts)
    expect(out).toBe(c)
    expect(merger).not.toHaveBeenCalled()
  })

  it("skips LLM when bodies are identical (only sources differ)", async () => {
    // Re-ingest of the same file from a different source just adds
    // its source filename — body is byte-identical. Don't waste an
    // LLM call on this.
    const merger = vi.fn()
    const existing = PAGE(
      'type: entity\ntitle: Foo\nsources: ["a.pdf"]',
      "same body",
    )
    const incoming = PAGE(
      'type: entity\ntitle: Foo\nsources: ["b.pdf"]',
      "same body",
    )
    const out = await mergePageContent(incoming, existing, merger, baseOpts)
    expect(out).toContain('sources: ["a.pdf", "b.pdf"]')
    expect(out).toContain("same body")
    expect(merger).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────────────────────
// LLM merge happy path
// ──────────────────────────────────────────────────────────────────

describe("mergePageContent — LLM merge", () => {
  it("calls the merger when bodies differ and uses the merged output", async () => {
    const abortController = new AbortController()
    const existing = PAGE(
      'type: entity\ntitle: Accumulibacter\ncreated: 2026-04-09\ntags: [microbiology, ebpr]\nrelated: [dpao, vfa]\nsources: ["doc-A.pdf"]',
      "## Anaerobic Phase\n\nDescription from doc A.\n\n## Denitrification\n\nMore from doc A.",
    )
    const incoming = PAGE(
      'type: entity\ntitle: Accumulibacter\ncreated: 2026-04-30\ntags: [paos, propionate]\nrelated: [pha]\nsources: ["doc-B.pdf"]',
      "## Carbon Source Preferences\n\nDescription from doc B.\n\n## Acetate vs Propionate\n\nMore from doc B.",
    )
    const mergedBody = "## Anaerobic Phase\n\nDescription from doc A.\n\n## Denitrification\n\nMore from doc A.\n\n## Carbon Source Preferences\n\nDescription from doc B.\n\n## Acetate vs Propionate\n\nMore from doc B."
    const merger = vi.fn().mockResolvedValue(
      PAGE(
        // LLM might also output frontmatter — we'll override locked fields.
        'type: entity\ntitle: Accumulibacter\ncreated: 2026-04-09\ntags: [paos, propionate]\nrelated: [pha]\nsources: ["doc-B.pdf"]',
        mergedBody,
      ),
    )
    const out = await mergePageContent(incoming, existing, merger, {
      ...baseOpts,
      signal: abortController.signal,
    })

    expect(merger).toHaveBeenCalledOnce()
    expect(merger.mock.calls[0]?.[2]).toEqual({
      sourceFileName: "doc-B.pdf",
      pagePath: "wiki/entities/foo.md",
      signal: abortController.signal,
    })

    // Body uses LLM-merged version
    expect(out).toContain("Anaerobic Phase")
    expect(out).toContain("Carbon Source Preferences")

    // Locked fields preserved from existing
    expect(out).toContain("title: Accumulibacter")
    expect(out).toContain("created: 2026-04-09")
    expect(out).toContain("type: entity")

    // updated forced to today
    expect(out).toContain("updated: 2026-04-30")

    // Array fields are unions
    expect(out).toMatch(/sources:\s*\[\s*"doc-A.pdf",\s*"doc-B.pdf"\s*\]/)
    expect(out).toMatch(/tags:\s*\[\s*"microbiology",\s*"ebpr",\s*"paos",\s*"propionate"\s*\]/)
    expect(out).toMatch(/related:\s*\[\s*"dpao",\s*"vfa",\s*"pha"\s*\]/)
  })

  it("preserves locked title even if LLM rewrote it", async () => {
    // Title changes break wikilinks — never accept LLM-rewritten title.
    const existing = PAGE("type: entity\ntitle: Accumulibacter", "old body content here")
    const incoming = PAGE("type: entity\ntitle: Accumulibacter", "very different new body here")
    const merger = vi.fn().mockResolvedValue(
      PAGE("type: entity\ntitle: ACCUMULIBACTER (renamed)", "merged body that is reasonably long enough to pass the threshold check"),
    )
    const out = await mergePageContent(incoming, existing, merger, baseOpts)
    expect(out).toContain("title: Accumulibacter")
    expect(out).not.toContain("ACCUMULIBACTER (renamed)")
  })

  it("preserves locked type even if LLM changed it", async () => {
    const existing = PAGE("type: entity\ntitle: Foo", "original body content")
    const incoming = PAGE("type: entity\ntitle: Foo", "new content from another source")
    const merger = vi.fn().mockResolvedValue(
      PAGE("type: concept\ntitle: Foo", "merged body that is long enough to clear the seventy percent threshold"),
    )
    const out = await mergePageContent(incoming, existing, merger, baseOpts)
    expect(out).toContain("type: entity")
    expect(out).not.toContain("type: concept")
  })
})

// ──────────────────────────────────────────────────────────────────
// LLM failure / sanity rejection — always falls back safely
// ──────────────────────────────────────────────────────────────────

describe("mergePageContent — LLM failure fallback", () => {
  it("falls back to array-merged incoming when LLM throws", async () => {
    const existing = PAGE(
      'type: entity\ntitle: Foo\ntags: [old]\nsources: ["a.pdf"]',
      "old body content",
    )
    const incoming = PAGE(
      'type: entity\ntitle: Foo\ntags: [new]\nsources: ["b.pdf"]',
      "new body content",
    )
    const merger = vi.fn().mockRejectedValue(new Error("LLM rate limited"))
    const out = await mergePageContent(incoming, existing, merger, baseOpts)

    // Array fields are still merged (no LLM needed for that)
    expect(out).toMatch(/tags:\s*\[\s*"old",\s*"new"\s*\]/)
    expect(out).toMatch(/sources:\s*\[\s*"a.pdf",\s*"b.pdf"\s*\]/)
    // Body is the new (incoming) one — old body is lost; this is the
    // pre-LLM-merge behavior, the documented fallback contract.
    expect(out).toContain("new body content")
  })

  it("rejects LLM output that shrinks body below 70% of max(old, new)", async () => {
    const longBody = "long body content ".repeat(200) // ~3600 chars
    const existing = PAGE("type: entity\ntitle: Foo", longBody)
    const incoming = PAGE("type: entity\ntitle: Foo", "incoming body that is also pretty long " + longBody)
    const merger = vi.fn().mockResolvedValue(
      PAGE("type: entity\ntitle: Foo", "tiny merged body"),
    )
    const out = await mergePageContent(incoming, existing, merger, baseOpts)
    // Should fall back to incoming (array-merged) — not the tiny LLM output
    expect(out).not.toContain("tiny merged body")
    expect(out).toContain("incoming body that is also pretty long")
  })

  it("allows stronger RPG runtime compression for relationship pages", async () => {
    const longRelationshipBody = "old biography detail without playable tension. ".repeat(20)
    const existing = PAGE("type: relationships\ntitle: Rin and Shirou", longRelationshipBody)
    const incoming = PAGE("type: relationships\ntitle: Rin and Shirou", "incoming duplicate character biography. ".repeat(20))
    const compressedRuntimeBody = [
      "## Runtime Capsule",
      "",
      "- Trust is brittle and shifts when the player reveals secrets.",
      "- The useful lever is defensive banter under pressure, not biography recap.",
      "",
      "## Current Tension",
      "",
      "- New confirmed relationship pressure replaces stale profile detail.",
      "- Escalation requires earned vulnerability rather than abrupt confession.",
      "",
    ].join("\n")
    const merger = vi.fn().mockResolvedValue(
      PAGE("type: relationships\ntitle: Rin and Shirou", compressedRuntimeBody),
    )

    const out = await mergePageContent(incoming, existing, merger, {
      ...baseOpts,
      pagePath: "wiki/relationships/rin-shirou.md",
    })

    expect(out).toContain("Trust is brittle")
    expect(out).toContain("updated: 2026-04-30")
  })

  it("falls back to array-merged incoming when RPG merge lint rejects the LLM output", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const existing = PAGE(
      'type: events\ntitle: Bridge Incident\nsources: ["a.md"]',
      "## Runtime Capsule\n\n- The old confirmed incident happened at the bridge.\n\n## Confirmed Event\n\n" + "Old confirmed consequence. ".repeat(20),
    )
    const incoming = PAGE(
      'type: events\ntitle: Bridge Incident\nsources: ["b.md"]',
      "## Runtime Capsule\n\n- The incoming confirmed event changed the bridge guard's stance.\n\n## Confirmed Event\n\n" + "Incoming confirmed consequence. ".repeat(20),
    )
    const rejectedBody = [
      "## Runtime Capsule",
      "",
      "- The incident happened, but the page also records future options.",
      "",
      "## Confirmed Event",
      "",
      "The bridge guard withdrew after the accepted exchange.",
      "",
      "## Next Steps",
      "",
      "Possible future: if the player chooses, an ambush may happen later.",
      "",
      "Confirmed consequence detail. ".repeat(30),
    ].join("\n")
    const backup = vi.fn().mockResolvedValue(undefined)
    const merger = vi.fn().mockResolvedValue(
      PAGE('type: events\ntitle: Bridge Incident\nsources: ["b.md"]', rejectedBody),
    )

    const out = await mergePageContent(incoming, existing, merger, {
      ...baseOpts,
      pagePath: "wiki/events/bridge-incident.md",
      backup,
    })

    expect(out).toContain("Incoming confirmed consequence")
    expect(out).not.toContain("Possible future")
    expect(out).toMatch(/sources:\s*\[\s*"a.md",\s*"b.md"\s*\]/)
    expect(backup).toHaveBeenCalledWith(existing)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("event-future-or-option-contamination"))
    warnSpy.mockRestore()
  })

  it("accepts LLM merge output when RPG merge lint only warns", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const existing = PAGE(
      "type: characters\ntitle: Rin",
      "## Behavior Rules\n\nOld pressure behavior.",
    )
    const incoming = PAGE(
      "type: characters\ntitle: Rin",
      "## Behavior Rules\n\nIncoming pressure behavior.",
    )
    const warningOnlyBody = [
      "## Behavior Rules",
      "",
      "- Keeps control through sharp bargaining.",
      "- Tests the player's claims before trusting them.",
      "",
      "## Dialogue Style",
      "",
      "- Precise, clipped, and defensive under pressure.",
      "",
    ].join("\n")
    const merger = vi.fn().mockResolvedValue(
      PAGE("type: characters\ntitle: Rin", warningOnlyBody),
    )

    const out = await mergePageContent(incoming, existing, merger, {
      ...baseOpts,
      pagePath: "wiki/characters/rin.md",
    })

    expect(out).toContain("Tests the player's claims")
    expect(out).toContain("updated: 2026-04-30")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("missing-runtime-capsule"))
    warnSpy.mockRestore()
  })

  it("runs section-aware merge before lint so an incoming Runtime Capsule can be restored", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const existing = PAGE(
      "type: characters\ntitle: Rin",
      "## Runtime Capsule\n\n- Older capsule.\n\n## Behavior Rules\n\n- Old behavior.",
    )
    const incoming = PAGE(
      "type: characters\ntitle: Rin",
      "## Runtime Capsule\n\n- Incoming capsule keeps the next-turn social pressure visible.\n\n## Behavior Rules\n\n- Incoming behavior.",
    )
    const llmBody = [
      "## Behavior Rules",
      "",
      "- Incoming behavior.",
      "- Old behavior.",
      "",
      "## Dialogue Style",
      "",
      "- Sharp under pressure.",
    ].join("\n")
    const merger = vi.fn().mockResolvedValue(PAGE("type: characters\ntitle: Rin", llmBody))

    const out = await mergePageContent(incoming, existing, merger, {
      ...baseOpts,
      pagePath: "wiki/characters/rin.md",
    })

    expect(out).toContain("## Runtime Capsule")
    expect(out).toContain("Incoming capsule keeps the next-turn social pressure visible")
    expect(out).toContain("## Behavior Rules")
    expect(out).toContain("updated: 2026-04-30")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("RPG section merge"))
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("missing-runtime-capsule"))
    warnSpy.mockRestore()
  })

  it("does not preserve stale Current State beside incoming runtime state", async () => {
    const existing = PAGE(
      "type: player\ntitle: Player Status",
      "## Runtime Capsule\n\n- Player state affects the next turn.\n\n## Current State\n\n- The player is still in the tavern.",
    )
    const incoming = PAGE(
      "type: player\ntitle: Player Status",
      "## Runtime Capsule\n\n- Player state affects the next turn.\n\n## Current State\n\n- The player is at the sealed canal gate.",
    )
    const llmBody = [
      "## Runtime Capsule",
      "",
      "- Player state affects the next turn.",
      "",
      "## Known Information",
      "",
      "- The canal gate is locked.",
    ].join("\n")
    const merger = vi.fn().mockResolvedValue(PAGE("type: player\ntitle: Player Status", llmBody))

    const out = await mergePageContent(incoming, existing, merger, {
      ...baseOpts,
      pagePath: "wiki/player/status.md",
    })

    expect(out).toContain("The player is at the sealed canal gate")
    expect(out).not.toContain("still in the tavern")
  })

  it("does not let deterministic section merge bring back deleted low-value sections", async () => {
    const existing = PAGE(
      "type: characters\ntitle: Rin",
      "## Runtime Capsule\n\n- Tests player honesty.\n\n## Trivia\n\n- Birthday metadata.\n\n## Voice Actor\n\n- Cast note.",
    )
    const incoming = PAGE(
      "type: characters\ntitle: Rin",
      "## Runtime Capsule\n\n- Tests player honesty.\n\n## Release Metadata\n\n- Platform note.",
    )
    const llmBody = "## Runtime Capsule\n\n- Tests player honesty.\n\n## Behavior Rules\n\n- Demands proof before trust."
    const merger = vi.fn().mockResolvedValue(PAGE("type: characters\ntitle: Rin", llmBody))

    const out = await mergePageContent(incoming, existing, merger, {
      ...baseOpts,
      pagePath: "wiki/characters/rin.md",
    })

    expect(out).toContain("Demands proof before trust")
    expect(out).not.toContain("## Trivia")
    expect(out).not.toContain("## Voice Actor")
    expect(out).not.toContain("## Release Metadata")
  })

  it("rejects LLM output that has no frontmatter at all", async () => {
    const existing = PAGE("type: entity\ntitle: Foo", "old body content here")
    const incoming = PAGE("type: entity\ntitle: Foo", "new body content here")
    const merger = vi.fn().mockResolvedValue(
      "raw markdown with no frontmatter at all and definitely no opening triple-dash",
    )
    const out = await mergePageContent(incoming, existing, merger, baseOpts)
    // Falls back to incoming — never writes frontmatter-less output to disk
    expect(out.startsWith("---")).toBe(true)
    expect(out).toContain("new body content here")
  })

  it("calls the optional backup callback when falling back", async () => {
    const existing = PAGE("type: entity\ntitle: Foo", "old body")
    const incoming = PAGE("type: entity\ntitle: Foo", "new body")
    const backup = vi.fn().mockResolvedValue(undefined)
    const merger = vi.fn().mockRejectedValue(new Error("network error"))
    await mergePageContent(incoming, existing, merger, {
      ...baseOpts,
      backup,
    })
    expect(backup).toHaveBeenCalledWith(existing)
  })

  it("does not call backup when LLM merge succeeds", async () => {
    const existing = PAGE("type: entity\ntitle: Foo", "old body")
    const incoming = PAGE("type: entity\ntitle: Foo", "new body content")
    const backup = vi.fn().mockResolvedValue(undefined)
    const merger = vi.fn().mockResolvedValue(
      PAGE("type: entity\ntitle: Foo", "merged body that is long enough to clear the threshold check"),
    )
    await mergePageContent(incoming, existing, merger, {
      ...baseOpts,
      backup,
    })
    expect(backup).not.toHaveBeenCalled()
  })

  it("backup failure is swallowed (best-effort, never blocks the write)", async () => {
    const existing = PAGE("type: entity\ntitle: Foo", "old body")
    const incoming = PAGE("type: entity\ntitle: Foo", "new body content")
    const backup = vi.fn().mockRejectedValue(new Error("disk full"))
    const merger = vi.fn().mockRejectedValue(new Error("network error"))

    // Should still resolve — backup error must not propagate
    const out = await mergePageContent(incoming, existing, merger, {
      ...baseOpts,
      backup,
    })
    expect(out).toContain("new body content")
  })
})

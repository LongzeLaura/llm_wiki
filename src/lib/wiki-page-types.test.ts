import { describe, expect, it } from "vitest"
import {
  buildWikiPageLookupCandidates,
  GENERATION_WIKI_TYPES,
  inferWikiTypeFromPath,
  resolveRegisteredWikiPageType,
  wikiTypeLabel,
} from "./wiki-page-types"

describe("inferWikiTypeFromPath", () => {
  it("recognizes core wiki directories", () => {
    expect(inferWikiTypeFromPath("/project/wiki/entities/ada-lovelace.md")).toBe("entity")
    expect(inferWikiTypeFromPath("/project/wiki/concepts/attention.md")).toBe("concept")
    expect(inferWikiTypeFromPath("/project/wiki/sources/paper.md")).toBe("source")
    expect(inferWikiTypeFromPath("/project/wiki/queries/open-question.md")).toBe("query")
    expect(inferWikiTypeFromPath("/project/wiki/comparisons/model-a-vs-b.md")).toBe("comparison")
    expect(inferWikiTypeFromPath("/project/wiki/synthesis/summary.md")).toBe("synthesis")
  })

  it("recognizes research-template wiki directories", () => {
    expect(inferWikiTypeFromPath("/project/wiki/findings/result.md")).toBe("finding")
    expect(inferWikiTypeFromPath("/project/wiki/thesis/main-claim.md")).toBe("thesis")
    expect(inferWikiTypeFromPath("/project/wiki/methodology/systematic-review.md")).toBe("methodology")
  })

  it("recognizes chemical registry directories", () => {
    expect(inferWikiTypeFromPath("/project/wiki/catalytic-systems/h-zsm-5.md")).toBe("catalytic_system")
    expect(inferWikiTypeFromPath("/project/wiki/elementary-processes/methoxy-formation.md")).toBe("elementary_process")
    expect(inferWikiTypeFromPath("/project/wiki/mechanistic-networks/dual-cycle.md")).toBe("mechanistic_network")
    expect(inferWikiTypeFromPath("/project/wiki/evidence-claims/isotope-labeling.md")).toBe("evidence_claim")
  })

  it("handles Windows separators and overview pages", () => {
    expect(inferWikiTypeFromPath("C:\\wiki\\findings\\result.md")).toBe("finding")
    expect(inferWikiTypeFromPath("/project/wiki/overview.md")).toBe("overview")
  })

  it("uses custom wiki subdirectories as dynamic types", () => {
    expect(inferWikiTypeFromPath("/project/wiki/people/ada-lovelace.md")).toBe("people")
    expect(inferWikiTypeFromPath("/project/wiki/technologies/vector-db.md")).toBe("technologies")
  })
})

describe("wikiTypeLabel", () => {
  it("uses readable singular labels for registered and custom types", () => {
    expect(wikiTypeLabel("finding")).toBe("Finding")
    expect(wikiTypeLabel("thesis")).toBe("Thesis")
    expect(wikiTypeLabel("methodology")).toBe("Methodology")
    expect(wikiTypeLabel("catalytic_system")).toBe("Catalytic System")
    expect(wikiTypeLabel("custom-topic")).toBe("Custom Topic")
  })

  it("keeps generation prompt type list aligned with research-template types", () => {
    expect(GENERATION_WIKI_TYPES).toContain("finding")
    expect(GENERATION_WIKI_TYPES).toContain("thesis")
    expect(GENERATION_WIKI_TYPES).toContain("methodology")
  })
})

describe("resolveRegisteredWikiPageType", () => {
  it("canonicalizes registered aliases without rewriting custom types", () => {
    expect(resolveRegisteredWikiPageType("Catalytic System")).toBe("catalytic_system")
    expect(resolveRegisteredWikiPageType("mechanistic-networks")).toBe("mechanistic_network")
    expect(resolveRegisteredWikiPageType("species")).toBeNull()
  })

  it("fills missing registered types from the wiki path when safe", () => {
    expect(
      resolveRegisteredWikiPageType("", "/project/wiki/evidence-claims/isotope-labeling.md"),
    ).toBe("evidence_claim")
    expect(
      resolveRegisteredWikiPageType(undefined, "/project/wiki/people/ada-lovelace.md"),
    ).toBeNull()
  })
})

describe("buildWikiPageLookupCandidates", () => {
  it("keeps the requested wiki path first and adds registered chemical directories", () => {
    expect(
      buildWikiPageLookupCandidates("/project", "wiki/entities/h-zsm-5.md"),
    ).toEqual([
      "/project/wiki/entities/h-zsm-5.md",
      "/project/wiki/sources/h-zsm-5.md",
      "/project/wiki/concepts/h-zsm-5.md",
      "/project/wiki/catalytic-systems/h-zsm-5.md",
      "/project/wiki/elementary-processes/h-zsm-5.md",
      "/project/wiki/mechanistic-networks/h-zsm-5.md",
      "/project/wiki/evidence-claims/h-zsm-5.md",
      "/project/wiki/comparisons/h-zsm-5.md",
      "/project/wiki/queries/h-zsm-5.md",
      "/project/wiki/synthesis/h-zsm-5.md",
      "/project/wiki/findings/h-zsm-5.md",
      "/project/wiki/thesis/h-zsm-5.md",
      "/project/wiki/methodology/h-zsm-5.md",
      "/project/wiki/h-zsm-5.md",
    ])
  })

  it("normalizes slash styles and accepts a bare slug", () => {
    expect(
      buildWikiPageLookupCandidates("C:\\project\\wiki", "dual-cycle-mto"),
    ).toContain("C:/project/wiki/wiki/mechanistic-networks/dual-cycle-mto.md")
  })
})

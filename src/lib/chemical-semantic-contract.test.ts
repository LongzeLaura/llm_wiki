import { describe, expect, it } from "vitest"
import { applyChemicalSemanticContract } from "./chemical-semantic-contract"
import { parseFrontmatterArray, parseFrontmatterScalar } from "./sources-merge"

function wrap(frontmatter: string, body: string = "# Page\n"): string {
  return `---\n${frontmatter}\n---\n${body}`
}

describe("applyChemicalSemanticContract", () => {
  it("adds missing required semantic fields to catalytic system pages", () => {
    const content = wrap(
      [
        "type: catalytic_system",
        "title: H-ZSM-5",
        "created: 2026-06-01",
        "updated: 2026-06-01",
        "tags: [zeolite]",
        "related: [surface-methoxy-formation]",
        'sources: ["paper.md"]',
      ].join("\n"),
    )

    const rewritten = applyChemicalSemanticContract(
      content,
      "wiki/catalytic-systems/h-zsm-5.md",
    )

    expect(parseFrontmatterScalar(rewritten, "system_type")).toBe("unknown")
    expect(parseFrontmatterScalar(rewritten, "role")).toBe("not_specified")
    expect(parseFrontmatterScalar(rewritten, "catalyst_material")).toBe("unknown")
    expect(parseFrontmatterScalar(rewritten, "active_site_type")).toBe("unknown")
    expect(parseFrontmatterScalar(rewritten, "reaction_conditions")).toBe("not_specified")
  })

  it("normalizes controlled evidence enums and preserves provided values", () => {
    const content = wrap(
      [
        "type: evidence_claim",
        "title: Isotope labeling evidence",
        "created: 2026-06-01",
        "updated: 2026-06-01",
        "tags: [evidence]",
        "related: [dual-cycle-mto]",
        'sources: ["paper.md"]',
        "claim: retained hydrocarbon species contribute to olefin formation",
        "evidence_type: isotope_labeling",
        "relation_type: Partially Supports",
        "target_layer: Mechanistic Network",
        "target_page: dual-cycle-mto",
        "evidence_summary: labeling supports the route",
      ].join("\n"),
    )

    const rewritten = applyChemicalSemanticContract(
      content,
      "wiki/evidence-claims/isotope-labeling.md",
    )

    expect(parseFrontmatterScalar(rewritten, "relation_type")).toBe("partially_supports")
    expect(parseFrontmatterScalar(rewritten, "target_layer")).toBe("mechanistic_network")
  })

  it("adds empty required arrays for process and mechanism pages", () => {
    const processContent = wrap(
      [
        "type: elementary_process",
        "title: Surface Methoxy Formation",
        "created: 2026-06-01",
        "updated: 2026-06-01",
        "tags: [methoxy]",
        "related: [h-zsm-5-mfi-mto]",
        'sources: ["paper.md"]',
      ].join("\n"),
    )
    const networkContent = wrap(
      [
        "type: mechanistic_network",
        "title: Dual-cycle MTO",
        "created: 2026-06-01",
        "updated: 2026-06-01",
        "tags: [mechanism]",
        "related: [surface-methoxy-formation]",
        'sources: ["paper.md"]',
      ].join("\n"),
    )

    const rewrittenProcess = applyChemicalSemanticContract(
      processContent,
      "wiki/elementary-processes/surface-methoxy-formation.md",
    )
    const rewrittenNetwork = applyChemicalSemanticContract(
      networkContent,
      "wiki/mechanistic-networks/dual-cycle-mto.md",
    )

    expect(parseFrontmatterArray(rewrittenProcess, "participants")).toEqual([])
    expect(parseFrontmatterArray(rewrittenNetwork, "network_nodes")).toEqual([])
    expect(parseFrontmatterArray(rewrittenNetwork, "network_edges")).toEqual([])
    expect(parseFrontmatterArray(rewrittenNetwork, "competing_pathways")).toEqual([])
  })

  it("does not modify legacy entity pages", () => {
    const content = wrap(
      [
        "type: entity",
        "title: Transformer",
        "created: 2026-06-01",
        "updated: 2026-06-01",
        "tags: [ai]",
        "related: [attention]",
        'sources: ["paper.md"]',
      ].join("\n"),
    )

    expect(applyChemicalSemanticContract(content, "wiki/entities/transformer.md")).toBe(content)
  })
})

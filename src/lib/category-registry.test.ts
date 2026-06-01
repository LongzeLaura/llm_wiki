import { describe, expect, it } from "vitest"
import {
  CHEMICAL_CATEGORY_PROFILE_ID,
  DEFAULT_CATEGORY_PROFILE_ID,
  getCategoryDefinition,
  getCategoryDefinitionByDirectory,
  getCategoryProfile,
  getGenerationCategoryIds,
  inferRegisteredCategoryFromPath,
} from "./category-registry"

describe("category registry", () => {
  it("preserves the legacy profile as the default runtime profile", () => {
    expect(getCategoryProfile().id).toBe(DEFAULT_CATEGORY_PROFILE_ID)
    expect(getGenerationCategoryIds()).toEqual([
      "source",
      "entity",
      "concept",
      "comparison",
      "query",
      "synthesis",
      "thesis",
      "methodology",
      "finding",
    ])
  })

  it("defines chemical categories without removing compatibility categories", () => {
    const chemicalProfile = getCategoryProfile(CHEMICAL_CATEGORY_PROFILE_ID)
    expect(chemicalProfile.activeCategoryIds).toContain("catalytic_system")
    expect(chemicalProfile.activeCategoryIds).toContain("elementary_process")
    expect(chemicalProfile.activeCategoryIds).toContain("mechanistic_network")
    expect(chemicalProfile.activeCategoryIds).toContain("evidence_claim")
    expect(chemicalProfile.activeCategoryIds).toContain("entity")
    expect(chemicalProfile.activeCategoryIds).toContain("concept")
    expect(chemicalProfile.sourceSummaryCategoryId).toBe("source")
  })

  it("looks up canonical metadata by id and directory", () => {
    expect(getCategoryDefinition("entity")?.displayLabel).toBe("Entity")
    expect(getCategoryDefinition("mechanistic_network")?.ontologyLayer).toBe("mechanistic_network")
    expect(getCategoryDefinitionByDirectory("catalytic-systems")?.id).toBe("catalytic_system")
    expect(getCategoryDefinitionByDirectory("evidence-claims")?.id).toBe("evidence_claim")
  })

  it("accepts storage-facing aliases for registered legacy and chemical types", () => {
    expect(getCategoryDefinition("Entities")?.id).toBe("entity")
    expect(getCategoryDefinition("Catalytic System")?.id).toBe("catalytic_system")
    expect(getCategoryDefinition("wiki/elementary-processes/")?.id).toBe("elementary_process")
    expect(getCategoryDefinition("mechanistic-networks")?.id).toBe("mechanistic_network")
    expect(getCategoryDefinition("Evidence Claims")?.id).toBe("evidence_claim")
  })

  it("infers registered categories from legacy and chemical wiki paths", () => {
    expect(inferRegisteredCategoryFromPath("/project/wiki/entities/ada-lovelace.md")?.id).toBe("entity")
    expect(inferRegisteredCategoryFromPath("/project/wiki/catalytic-systems/h-zsm-5.md")?.id).toBe("catalytic_system")
    expect(inferRegisteredCategoryFromPath("/project/wiki/evidence-claims/methanol-pathway.md")?.id).toBe("evidence_claim")
  })
})

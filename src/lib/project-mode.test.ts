import { describe, expect, it } from "vitest"
import {
  inferProjectModeFromSchema,
  projectModeToProfileId,
} from "./project-mode"

describe("project mode helpers", () => {
  it("maps explicit modes to the expected category profile ids", () => {
    expect(projectModeToProfileId("default")).toBe("legacy-default")
    expect(projectModeToProfileId("chemical")).toBe("chemical-default")
  })

  it("detects legacy chemical schemas for fallback compatibility", () => {
    const schema = [
      "# Wiki Schema",
      "Project mode: chemical",
      "Category profile: chemical-default",
      "Use wiki/catalytic-systems/ for catalytic systems.",
    ].join("\n")

    expect(inferProjectModeFromSchema(schema)).toBe("chemical")
  })

  it("returns null when schema text does not advertise a chemical mode", () => {
    expect(inferProjectModeFromSchema("# Wiki Schema\n\nUse wiki/entities/ for entities.")).toBeNull()
  })
})

import { describe, expect, it } from "vitest"
import * as runtime from "./rpg-runtime"

describe("RPG Runtime public API", () => {
  it("does not expose removed compact-brief preview/compiler entry points", () => {
    const previewEntryPoint = ["runRpg", "RuntimePreview"].join("")
    const compilerEntryPoint = ["compileRpg", "Context"].join("")

    expect(previewEntryPoint in runtime).toBe(false)
    expect(compilerEntryPoint in runtime).toBe(false)
  })
})

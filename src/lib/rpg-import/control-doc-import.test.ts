import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { realFs, createTempProject, fileExists, readFileRaw, writeFileRaw } from "@/test-helpers/fs-temp"
import { getRpgImportModeSpec, listRpgImportModeSpecs, runRpgImport } from "."
import {
  CONTROL_DOC_IMPORT_TARGET_SLOTS,
  getControlDocImportTargetPath,
} from "./control-doc-import"

vi.mock("@/commands/fs", () => realFs)

let cleanups: Array<() => Promise<void>> = []

beforeEach(() => {
  cleanups = []
})

afterEach(async () => {
  for (const cleanup of cleanups) {
    await cleanup()
  }
  cleanups = []
})

describe("RPG import control_doc_import", () => {
  it("is registered in the RPG import registry", () => {
    expect(getRpgImportModeSpec("control_doc_import")?.mode).toBe("control_doc_import")
    expect(listRpgImportModeSpecs().map((spec) => spec.mode)).toContain("control_doc_import")
  })

  it.each([
    ["main_outline", "wiki/outlines/main.md"],
    ["outline_progress", "wiki/outlines/progress.md"],
    ["rules_core", "wiki/rules/core.md"],
    ["style_narration", "wiki/style/narration.md"],
  ])("writes %s to %s with provenance metadata", async (targetSlot, targetPath) => {
    const projectPath = await createProject(`control-doc-${targetSlot}`)
    const result = await runRpgImport({
      mode: "control_doc_import",
      projectPath,
      sourcePath: `${projectPath}/raw/sources/${targetSlot}.md`,
      targetSlot,
      options: { now: "2026-06-08T00:00:00.000Z" },
    })

    expect(result.mode).toBe("control_doc_import")
    expect(result.writtenPaths).toContain(targetPath)
    expect(result.writtenPaths.some((path) => path.startsWith("wiki/sources/imports/"))).toBe(true)
    expect(result.warnings.join("\n")).toContain("review/manual-confirm boundary")
    expect(result.reviewItems).toHaveLength(1)

    const controlDoc = await readFileRaw(`${projectPath}/${targetPath}`)
    expect(controlDoc).toContain(`slot_id: "${targetSlot}"`)
    expect(controlDoc).toContain('import_mode: "control_doc_import"')
    expect(controlDoc).toContain(`source_file_name: "${targetSlot}.md"`)
    expect(controlDoc).toContain(`source_path: "${projectPath}/raw/sources/${targetSlot}.md"`)
    expect(controlDoc).toContain("source_anchor:")
    expect(controlDoc).toContain("source_import_path:")
    expect(controlDoc).toContain('imported_at: "2026-06-08T00:00:00.000Z"')
    expect(controlDoc).toContain("write_policy:")
    expect(controlDoc).toContain("review_policy:")
    expect(controlDoc).toContain("## Canonical Control Text")
    expect(controlDoc).toContain(sampleControlText(targetSlot))
  })

  it("exposes the four allowed slot target paths", () => {
    expect(CONTROL_DOC_IMPORT_TARGET_SLOTS).toEqual([
      "main_outline",
      "outline_progress",
      "rules_core",
      "style_narration",
    ])
    expect(getControlDocImportTargetPath("main_outline")).toBe("wiki/outlines/main.md")
    expect(getControlDocImportTargetPath("outline_progress")).toBe("wiki/outlines/progress.md")
    expect(getControlDocImportTargetPath("rules_core")).toBe("wiki/rules/core.md")
    expect(getControlDocImportTargetPath("style_narration")).toBe("wiki/style/narration.md")
    expect(getControlDocImportTargetPath("style_dialogue")).toBeUndefined()
  })

  it("rejects unsupported targetSlot without writing files", async () => {
    const projectPath = await createProject("control-doc-unsupported")

    await expect(
      runRpgImport({
        mode: "control_doc_import",
        projectPath,
        sourceText: "Do not write this.",
        targetSlot: "style_dialogue",
      }),
    ).rejects.toThrow(/not supported/)

    expect(await fileExists(`${projectPath}/wiki/style/dialogue.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/current-scene/scene_state.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/events/style-dialogue.md`)).toBe(false)
  })

  it("requires targetSlot and sourceText or sourcePath", async () => {
    const projectPath = await createProject("control-doc-required")

    await expect(
      runRpgImport({
        mode: "control_doc_import",
        projectPath,
        sourceText: "Control text.",
      }),
    ).rejects.toThrow("targetSlot")

    await expect(
      runRpgImport({
        mode: "control_doc_import",
        projectPath,
        targetSlot: "main_outline",
      }),
    ).rejects.toThrow("sourceText or sourcePath")
  })

  it("uses sourceText over sourcePath while recording source path provenance", async () => {
    const projectPath = await createProject("control-doc-source-priority")
    await writeFileRaw(`${projectPath}/raw/sources/outline.md`, "PATH_TEXT_SHOULD_NOT_APPEAR")

    await runRpgImport({
      mode: "control_doc_import",
      projectPath,
      sourceText: "SOURCE_TEXT_SHOULD_APPEAR",
      sourcePath: `${projectPath}/raw/sources/outline.md`,
      targetSlot: "main_outline",
      options: { now: "2026-06-08T01:00:00.000Z" },
    })

    const controlDoc = await readFileRaw(`${projectPath}/wiki/outlines/main.md`)
    expect(controlDoc).toContain("SOURCE_TEXT_SHOULD_APPEAR")
    expect(controlDoc).not.toContain("PATH_TEXT_SHOULD_NOT_APPEAR")
    expect(controlDoc).toContain(`source_path: "${projectPath}/raw/sources/outline.md"`)
    expect(controlDoc).toContain("source_text_takes_priority: true")
  })

  it("does not write current-scene or events", async () => {
    const projectPath = await createProject("control-doc-forbidden-targets")

    await runRpgImport({
      mode: "control_doc_import",
      projectPath,
      sourceText: [
        "# Possible Futures",
        "",
        "- The patron may be revealed in act three.",
        "- Do not write this into events as history.",
      ].join("\n"),
      targetSlot: "main_outline",
    })

    expect(await fileExists(`${projectPath}/wiki/current-scene/scene_state.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/events/main.md`)).toBe(false)
  })

  it("marks main_outline as manual_or_review_only and skips meaningful existing control files", async () => {
    const projectPath = await createProject("control-doc-main-review")
    await writeFileRaw(`${projectPath}/wiki/outlines/main.md`, "# Main Outline\n\nExisting GM-only plan.")

    const result = await runRpgImport({
      mode: "control_doc_import",
      projectPath,
      sourceText: "# New Outline\n\nThe next reveal is hidden.",
      targetSlot: "main_outline",
    })

    expect(result.writtenPaths).not.toContain("wiki/outlines/main.md")
    expect(result.skipped).toContain("wiki/outlines/main.md")
    expect(result.warnings.join("\n")).toContain("manualConfirm")
    expect(result.reviewItems).toHaveLength(2)
    expect(await readFileRaw(`${projectPath}/wiki/outlines/main.md`)).toContain("Existing GM-only plan.")

    const rawImportPath = result.writtenPaths.find((path) => path.startsWith("wiki/sources/imports/"))
    expect(rawImportPath).toBeDefined()
    expect(await readFileRaw(`${projectPath}/${rawImportPath}`)).toContain("The next reveal is hidden.")
  })

  it("can initialize outline_progress with empty source text", async () => {
    const projectPath = await createProject("control-doc-progress-empty")

    await runRpgImport({
      mode: "control_doc_import",
      projectPath,
      sourceText: "",
      sourceFileName: "opening-progress.md",
      targetSlot: "outline_progress",
    })

    const progress = await readFileRaw(`${projectPath}/wiki/outlines/progress.md`)
    expect(progress).toContain('slot_id: "outline_progress"')
    expect(progress).toContain('write_policy: "merge"')
    expect(progress).toContain("Not started.")
    expect(progress).toContain("Completed Beats")
  })

  it("preserves hard gates, setvar blocks, forbidden words, and explicit control blocks", async () => {
    const projectPath = await createProject("control-doc-preserve")
    const sourceText = [
      "# Rules",
      "",
      "HARD GATE: Never resolve a fatal wound without a cost.",
      "{{setvar::tension=high}}",
      "禁用词: destiny, chosen one",
      "<user-control>",
      "Do not reveal the patron's name before Act 3.",
      "</user-control>",
    ].join("\n")

    const result = await runRpgImport({
      mode: "control_doc_import",
      projectPath,
      sourceText,
      sourceFileName: "core-rules.md",
      targetSlot: "rules_core",
    })

    const rules = await readFileRaw(`${projectPath}/wiki/rules/core.md`)
    const rawImportPath = result.writtenPaths.find((path) => path.startsWith("wiki/sources/imports/"))
    const raw = await readFileRaw(`${projectPath}/${rawImportPath}`)

    for (const content of [rules, raw]) {
      expect(content).toContain("HARD GATE")
      expect(content).toContain("{{setvar::tension=high}}")
      expect(content).toContain("禁用词: destiny, chosen one")
      expect(content).toContain("<user-control>")
      expect(content).toContain("Do not reveal the patron's name before Act 3.")
    }
  })

  it("keeps raw source anchor traceable from target file to import source file", async () => {
    const projectPath = await createProject("control-doc-anchor")
    const result = await runRpgImport({
      mode: "control_doc_import",
      projectPath,
      sourceText: "Narration should stay close third person.",
      sourceFileName: "Narration Style!.md",
      targetSlot: "style_narration",
      options: { now: "2026-06-08T02:00:00.000Z" },
    })

    const rawImportPath = result.writtenPaths.find((path) => path.startsWith("wiki/sources/imports/"))
    expect(rawImportPath).toBe("wiki/sources/imports/narration-style--style_narration.md")

    const style = await readFileRaw(`${projectPath}/wiki/style/narration.md`)
    const raw = await readFileRaw(`${projectPath}/${rawImportPath}`)
    expect(style).toContain(`source_import_path: "${rawImportPath}"`)
    expect(style).toContain("<!-- control_doc_import:style_narration:narration-style--style_narration -->")
    expect(raw).toContain("<!-- control_doc_import:style_narration:narration-style--style_narration:raw -->")
    expect(raw).toContain("Narration should stay close third person.")
  })
})

async function createProject(label: string): Promise<string> {
  const tmp = await createTempProject(label)
  cleanups.push(tmp.cleanup)

  await writeFileRaw(`${tmp.path}/.llm-wiki/project.json`, JSON.stringify({ mode: "llmwikirpg" }))
  await writeFileRaw(`${tmp.path}/schema.md`, "wikiMode: llmwikirpg\n")
  await writeFileRaw(`${tmp.path}/purpose.md`, "# Purpose\n\nTrack RPG control documents.\n")
  await writeFileRaw(`${tmp.path}/wiki/index.md`, "# Index\n")
  await writeFileRaw(`${tmp.path}/wiki/overview.md`, "# Overview\n")
  for (const slot of CONTROL_DOC_IMPORT_TARGET_SLOTS) {
    await writeFileRaw(`${tmp.path}/raw/sources/${slot}.md`, sampleControlText(slot))
  }

  return tmp.path
}

function sampleControlText(slot: string): string {
  if (slot === "main_outline") {
    return "Main outline keeps the patron hidden until the sigil is decoded."
  }
  if (slot === "outline_progress") {
    return "Opening progress: act one has not started."
  }
  if (slot === "rules_core") {
    return "HARD GATE: ritual backlash must have a visible cost."
  }
  return "Forbidden phrasing: avoid chosen one language."
}

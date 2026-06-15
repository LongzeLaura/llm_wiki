import { describe, expect, it, vi } from "vitest"
import { resolveWikiEditorSaveBody } from "@/components/editor/wiki-editor-save"

describe("resolveWikiEditorSaveBody", () => {
  it("uses live Milkdown markdown when the editor getter is available", () => {
    const getCurrentMarkdown = vi.fn(() => "# Current editor body\n")

    expect(resolveWikiEditorSaveBody(getCurrentMarkdown, "# Cached old body\n")).toBe("# Current editor body\n")
    expect(getCurrentMarkdown).toHaveBeenCalledOnce()
  })

  it("falls back to the latest cached body before the editor instance is ready", () => {
    expect(resolveWikiEditorSaveBody(null, "# Cached body\n")).toBe("# Cached body\n")
  })
})

import { describe, expect, it, vi } from "vitest"
import {
  formatSaveError,
  persistWikiPreviewMarkdown,
  shouldSkipWikiPreviewSave,
} from "@/components/layout/preview-panel"

vi.mock("@/commands/fs", () => ({
  readFile: vi.fn(),
  writeFileAtomic: vi.fn(),
}))

vi.mock("@/components/editor/wiki-editor", () => ({
  WikiEditor: () => null,
}))

vi.mock("@/components/editor/file-preview", () => ({
  FilePreview: () => null,
}))

describe("PreviewPanel wiki save helpers", () => {
  it("skips no-op saves against the last loaded content", () => {
    expect(shouldSkipWikiPreviewSave("# Page\n", "# Page\n")).toBe(true)
    expect(shouldSkipWikiPreviewSave("# Page\n\nUpdated\n", "# Page\n")).toBe(false)
  })

  it("persists markdown through the provided atomic writer and syncs loaded/store state", async () => {
    const writeMarkdownFile = vi.fn(async () => undefined)
    const markLoaded = vi.fn()
    const setFileContent = vi.fn()

    await persistWikiPreviewMarkdown({
      path: "C:/project/wiki/page.md",
      markdown: "# Page\n\nUpdated.\n",
      syncStore: true,
      writeMarkdownFile,
      markLoaded,
      setFileContent,
    })

    expect(writeMarkdownFile).toHaveBeenCalledWith("C:/project/wiki/page.md", "# Page\n\nUpdated.\n")
    expect(markLoaded).toHaveBeenCalledWith("# Page\n\nUpdated.\n")
    expect(setFileContent).toHaveBeenCalledWith("# Page\n\nUpdated.\n")
  })

  it("does not sync loaded/store state when the writer fails", async () => {
    const error = new Error("disk is read-only")
    const markLoaded = vi.fn()
    const setFileContent = vi.fn()

    await expect(
      persistWikiPreviewMarkdown({
        path: "C:/project/wiki/page.md",
        markdown: "# Page\n\nUpdated.\n",
        syncStore: true,
        writeMarkdownFile: vi.fn(async () => {
          throw error
        }),
        markLoaded,
        setFileContent,
      }),
    ).rejects.toThrow("disk is read-only")

    expect(markLoaded).not.toHaveBeenCalled()
    expect(setFileContent).not.toHaveBeenCalled()
    expect(formatSaveError(error)).toBe("disk is read-only")
  })
})

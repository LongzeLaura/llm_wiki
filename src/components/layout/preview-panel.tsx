import { useEffect, useCallback, useRef, useState } from "react"
import { AlertCircle, Check, Loader2, X } from "lucide-react"
import { useWikiStore } from "@/stores/wiki-store"
import { readFile, writeFileAtomic } from "@/commands/fs"
import { getFileCategory, isBinary, isExtractedTextPreviewFile } from "@/lib/file-types"
import { WikiEditor } from "@/components/editor/wiki-editor"
import { FilePreview } from "@/components/editor/file-preview"
import { getFileName } from "@/lib/path-utils"

export function PreviewPanel() {
  const selectedFile = useWikiStore((s) => s.selectedFile)
  const fileContent = useWikiStore((s) => s.fileContent)
  const externalPreview = useWikiStore((s) => s.externalPreview)
  const setFileContent = useWikiStore((s) => s.setFileContent)
  const setSelectedFile = useWikiStore((s) => s.setSelectedFile)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  // Snapshot of what was most recently loaded from disk. Milkdown re-emits
  // `markdownUpdated` on initial parse (before the user types anything),
  // which used to trigger an auto-save that could write back a placeholder
  // marker if read_file had returned one for a missing/locked file. We
  // skip save when the incoming markdown equals the last-loaded content.
  const lastLoadedRef = useRef<string>("")

  useEffect(() => {
    if (!selectedFile) {
      setFileContent("")
      lastLoadedRef.current = ""
      return
    }
    if (externalPreview?.path === selectedFile) {
      lastLoadedRef.current = fileContent
      return
    }

    const category = getFileCategory(selectedFile)

    if (isBinary(category) && !isExtractedTextPreviewFile(selectedFile)) {
      setFileContent("")
      lastLoadedRef.current = ""
      return
    }

    readFile(selectedFile)
      .then((content) => {
        lastLoadedRef.current = content
        setFileContent(content)
        setSaveState("idle")
        setSaveError(null)
      })
      .catch((err) => {
        lastLoadedRef.current = ""
        setFileContent(`Error loading file: ${err}`)
        setSaveState("idle")
        setSaveError(null)
      })
  }, [selectedFile, externalPreview, fileContent, setFileContent])

  const writeNow = useCallback(async (path: string, markdown: string, syncStore = false) => {
    setSaveState("saving")
    setSaveError(null)
    try {
      await persistWikiPreviewMarkdown({
        path,
        markdown,
        syncStore,
        writeMarkdownFile: writeFileAtomic,
        markLoaded: (content) => {
          lastLoadedRef.current = content
        },
        setFileContent,
      })
      setSaveState("saved")
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      saveStatusTimerRef.current = setTimeout(() => setSaveState("idle"), 1800)
    } catch (err) {
      const message = formatSaveError(err)
      setSaveState("error")
      setSaveError(message)
      console.error("Failed to save:", err)
      throw err
    }
  }, [setFileContent])

  const handleSave = useCallback(
    async (markdown: string, options?: { immediate?: boolean }) => {
      if (!selectedFile) return
      // Ignore no-op saves from the editor's initial re-emit. Only write
      // when the user has actually changed the content relative to the
      // last disk read.
      if (shouldSkipWikiPreviewSave(markdown, lastLoadedRef.current)) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (options?.immediate) {
        await writeNow(selectedFile, markdown, true)
        return
      }
      saveTimerRef.current = setTimeout(() => {
        void writeNow(selectedFile, markdown, true).catch(() => undefined)
      }, 1000)
    },
    [selectedFile, setFileContent, writeNow]
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
    }
  }, [])

  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a file to preview
      </div>
    )
  }

  const category = getFileCategory(selectedFile)
  const fileName = externalPreview?.path === selectedFile
    ? externalPreview.title
    : getFileName(selectedFile)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="truncate text-xs text-muted-foreground" title={selectedFile}>
          {fileName}
        </span>
        <SaveStatusIndicator state={saveState} error={saveError} />
        <button
          onClick={() => setSelectedFile(null)}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 min-w-0 overflow-auto">
        {externalPreview?.path === selectedFile ? (
          <ExternalReferencePreview
            source={externalPreview.source}
            title={externalPreview.title}
            path={externalPreview.url}
            snippet={externalPreview.snippet || fileContent}
          />
        ) : category === "markdown" ? (
          <WikiEditor
            key={selectedFile}
            content={fileContent}
            onSave={handleSave}
          />
        ) : (
          <FilePreview
            key={selectedFile}
            filePath={selectedFile}
            textContent={fileContent}
          />
        )}
      </div>
    </div>
  )
}

export function shouldSkipWikiPreviewSave(markdown: string, lastLoaded: string): boolean {
  return markdown === lastLoaded
}

export function formatSaveError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export async function persistWikiPreviewMarkdown({
  path,
  markdown,
  syncStore,
  writeMarkdownFile,
  markLoaded,
  setFileContent,
}: {
  path: string
  markdown: string
  syncStore: boolean
  writeMarkdownFile: (path: string, markdown: string) => Promise<void>
  markLoaded: (markdown: string) => void
  setFileContent: (markdown: string) => void
}): Promise<void> {
  await writeMarkdownFile(path, markdown)
  markLoaded(markdown)
  if (syncStore) setFileContent(markdown)
}

function SaveStatusIndicator({
  state,
  error,
}: {
  state: "idle" | "saving" | "saved" | "error"
  error: string | null
}) {
  if (state === "idle") return null

  if (state === "saving") {
    return (
      <span className="ml-auto inline-flex shrink-0 items-center gap-1 px-2 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving
      </span>
    )
  }

  if (state === "saved") {
    return (
      <span className="ml-auto inline-flex shrink-0 items-center gap-1 px-2 text-[11px] text-emerald-600">
        <Check className="h-3 w-3" />
        Saved
      </span>
    )
  }

  return (
    <span
      className="ml-auto inline-flex min-w-0 shrink items-center gap-1 px-2 text-[11px] text-destructive"
      title={error ?? "Save failed"}
    >
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span className="truncate">Save failed</span>
    </span>
  )
}

function ExternalReferencePreview({
  source,
  title,
  path,
  snippet,
}: {
  source: string
  title: string
  path: string
  snippet: string
}) {
  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            {source}
          </span>
          <h3 className="truncate text-sm font-medium" title={title}>{title}</h3>
        </div>
        <div className="break-all rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {path}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/60 bg-background p-4">
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">
          {snippet || "(No preview fragment returned.)"}
        </pre>
      </div>
    </div>
  )
}

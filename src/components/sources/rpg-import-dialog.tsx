import { useEffect, useMemo, useState, type ReactNode } from "react"
import { open as openFileDialog } from "@tauri-apps/plugin-dialog"
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  FileText,
  ListChecks,
  Upload,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { listDirectory } from "@/commands/fs"
import {
  DEFAULT_RPG_IMPORT_UI_OPTION_ID,
  RPG_IMPORT_UI_OPTIONS,
  getRpgImportUiOption,
  resolveRpgImportUiSelection,
} from "@/lib/rpg-import/ui-import-options"
import { runRpgImport, type RpgImportResult } from "@/lib/rpg-import"
import { importSourceFilesWithReport } from "@/lib/source-lifecycle"
import { getFileName, normalizePath } from "@/lib/path-utils"
import { useReviewStore, type ReviewItem } from "@/stores/review-store"
import { useWikiStore, type LlmConfig, type SourceWatchConfig } from "@/stores/wiki-store"
import type { WikiProject } from "@/types/wiki"

interface RpgImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: WikiProject | null
  llmConfig: LlmConfig
  sourceWatchConfig: SourceWatchConfig
  onImported?: () => Promise<void> | void
}

interface ImportResultView {
  result: RpgImportResult
  reviewItemsAdded: number
}

interface DisplayReviewItem {
  title: string
  description: string
  affectedPages: string[]
}

const SOURCE_FILE_FILTERS = [
  {
    name: "Documents",
    extensions: [
      "md", "mdx", "txt", "rtf", "pdf",
      "html", "htm", "xml",
      "doc", "docx", "xls", "xlsx", "ppt", "pptx",
      "odt", "ods", "odp", "epub", "pages", "numbers", "key",
    ],
  },
  {
    name: "Data",
    extensions: ["json", "jsonl", "csv", "tsv", "yaml", "yml", "ndjson"],
  },
  {
    name: "Code",
    extensions: [
      "py", "js", "ts", "jsx", "tsx", "rs", "go", "java",
      "c", "cpp", "h", "rb", "php", "swift", "sql", "sh",
    ],
  },
  {
    name: "Images",
    extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tiff", "avif", "heic"],
  },
  {
    name: "Media",
    extensions: ["mp4", "webm", "mov", "avi", "mkv", "mp3", "wav", "ogg", "flac", "m4a"],
  },
  { name: "All Files", extensions: ["*"] },
]

export function RpgImportDialog({
  open,
  onOpenChange,
  project,
  llmConfig,
  sourceWatchConfig,
  onImported,
}: RpgImportDialogProps) {
  const { t } = useTranslation()
  const [optionId, setOptionId] = useState<string>(DEFAULT_RPG_IMPORT_UI_OPTION_ID)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [questName, setQuestName] = useState("")
  const [relationshipName, setRelationshipName] = useState("")
  const [explicitBootstrap, setExplicitBootstrap] = useState(false)
  const [manualConfirm, setManualConfirm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latestResult, setLatestResult] = useState<ImportResultView | null>(null)

  const selectedOption = getRpgImportUiOption(optionId)
  const selection = useMemo(() => resolveRpgImportUiSelection({
    optionId,
    questName,
    relationshipName,
    explicitBootstrap,
    manualConfirm,
  }), [explicitBootstrap, manualConfirm, optionId, questName, relationshipName])

  useEffect(() => {
    if (!open) return
    setOptionId(DEFAULT_RPG_IMPORT_UI_OPTION_ID)
    setSelectedPaths([])
    setQuestName("")
    setRelationshipName("")
    setExplicitBootstrap(false)
    setManualConfirm(false)
    setError(null)
    setLatestResult(null)
  }, [open])

  function handleOptionChange(value: string) {
    const nextOption = getRpgImportUiOption(value)
    setOptionId(nextOption.id)
    setError(null)
    setExplicitBootstrap(false)
    setManualConfirm(false)
    setSelectedPaths((paths) => nextOption.allowMultipleFiles ? paths : paths.slice(0, 1))
  }

  async function handleChooseFiles() {
    const selected = await openFileDialog({
      multiple: selectedOption.allowMultipleFiles,
      title: selectedOption.allowMultipleFiles
        ? t("sources.rpgImport.chooseFiles")
        : t("sources.rpgImport.chooseFile"),
      filters: SOURCE_FILE_FILTERS,
    })

    if (!selected) return
    const paths = (Array.isArray(selected) ? selected : [selected])
      .filter((path): path is string => typeof path === "string")
    setSelectedPaths(selectedOption.allowMultipleFiles ? paths : paths.slice(0, 1))
    setError(null)
  }

  async function handleImport() {
    if (!project || importing) return
    if (selectedPaths.length === 0) {
      setError(t("sources.rpgImport.noFileSelected"))
      return
    }
    if (selection.option.requiresSingleFile && selectedPaths.length !== 1) {
      setError(t("sources.rpgImport.singleFileRequired"))
      return
    }

    setImporting(true)
    setError(null)

    try {
      const result = selection.mode === "source_ingest"
        ? await runSourceImport(project, selectedPaths, llmConfig, sourceWatchConfig)
        : await runDedicatedImport(project, selectedPaths[0], selection)

      const reviewItems = result.reviewItems.map((item) => toReviewStoreItem(item, result, {
        openRelated: t("sources.rpgImport.actions.openRelated"),
        skip: t("sources.rpgImport.actions.skip"),
      }))
      if (reviewItems.length > 0) {
        useReviewStore.getState().addItems(reviewItems)
      }

      await refreshProjectViews(project, onImported)
      setLatestResult({ result, reviewItemsAdded: reviewItems.length })
    } catch (err) {
      console.error("[rpg-import-dialog] import failed:", err)
      setError(String(err))
    } finally {
      setImporting(false)
    }
  }

  const displayReviewItems = latestResult?.result.reviewItems.map(toDisplayReviewItem) ?? []
  const canImport = Boolean(project) && selectedPaths.length > 0 && !importing

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl grid-rows-[auto_1fr_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("sources.rpgImport.title")}</DialogTitle>
          <DialogDescription>{t("sources.rpgImport.description")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="rpg-import-mode">{t("sources.rpgImport.semanticLabel")}</Label>
              <select
                id="rpg-import-mode"
                value={selectedOption.id}
                onChange={(event) => handleOptionChange(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={DEFAULT_RPG_IMPORT_UI_OPTION_ID}>
                  {t("sources.rpgImport.options.sourceIngest.label")}
                </option>
                <optgroup label={t("sources.rpgImport.groups.controlDoc")}>
                  {RPG_IMPORT_UI_OPTIONS.filter((option) => option.group === "control_doc_import").map((option) => (
                    <option key={option.id} value={option.id}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t("sources.rpgImport.groups.campaignSetup")}>
                  {RPG_IMPORT_UI_OPTIONS.filter((option) => option.group === "campaign_setup_import").map((option) => (
                    <option key={option.id} value={option.id}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t(selectedOption.descriptionKey)}
              </p>
            </div>

            <Button type="button" variant="outline" onClick={handleChooseFiles} disabled={!project || importing}>
              <FilePlus2 className="mr-1.5 h-4 w-4" />
              {selectedOption.allowMultipleFiles
                ? t("sources.rpgImport.chooseFiles")
                : t("sources.rpgImport.chooseFile")}
            </Button>
          </div>

          {selectedOption.nameOption === "questName" && (
            <div className="space-y-2">
              <Label htmlFor="rpg-import-quest-name">{t("sources.rpgImport.questName")}</Label>
              <Input
                id="rpg-import-quest-name"
                value={questName}
                onChange={(event) => setQuestName(event.target.value)}
                placeholder={t("sources.rpgImport.questNamePlaceholder")}
              />
            </div>
          )}

          {selectedOption.nameOption === "relationshipName" && (
            <div className="space-y-2">
              <Label htmlFor="rpg-import-relationship-name">{t("sources.rpgImport.relationshipName")}</Label>
              <Input
                id="rpg-import-relationship-name"
                value={relationshipName}
                onChange={(event) => setRelationshipName(event.target.value)}
                placeholder={t("sources.rpgImport.relationshipNamePlaceholder")}
              />
            </div>
          )}

          {selectedOption.confirmation === "current_scene_bootstrap" && (
            <label className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <input
                type="checkbox"
                checked={explicitBootstrap}
                onChange={(event) => setExplicitBootstrap(event.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium">
                  {t("sources.rpgImport.confirmCurrentScene")}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {t("sources.rpgImport.confirmCurrentSceneHint")}
                </span>
              </span>
            </label>
          )}

          {selectedOption.confirmation === "control_overwrite" && (
            <label className="flex items-start gap-3 rounded-md border border-border/70 bg-muted/20 p-3">
              <input
                type="checkbox"
                checked={manualConfirm}
                onChange={(event) => setManualConfirm(event.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium">
                  {t("sources.rpgImport.confirmControlOverwrite")}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {t("sources.rpgImport.confirmControlOverwriteHint")}
                </span>
              </span>
            </label>
          )}

          <div className="space-y-2">
            <Label>{t("sources.rpgImport.selectedFiles")}</Label>
            <div className="max-h-28 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
              {selectedPaths.length === 0 ? (
                <span className="text-muted-foreground">{t("sources.rpgImport.noFiles")}</span>
              ) : (
                <ul className="space-y-1">
                  {selectedPaths.map((path) => (
                    <li key={path} className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate" title={path}>{path}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {latestResult && (
            <div className="space-y-3 rounded-md border border-border/70 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {t("sources.rpgImport.resultsTitle")}
                {latestResult.reviewItemsAdded > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {t("sources.rpgImport.addedToReview", { count: latestResult.reviewItemsAdded })}
                  </span>
                )}
              </div>
              <ResultList
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                title={t("sources.rpgImport.results.warnings")}
                items={latestResult.result.warnings}
                emptyLabel={t("sources.rpgImport.results.none")}
              />
              <ReviewResultList
                title={t("sources.rpgImport.results.reviewItems")}
                items={displayReviewItems}
                emptyLabel={t("sources.rpgImport.results.none")}
              />
              <ResultList
                icon={<Upload className="h-3.5 w-3.5" />}
                title={t("sources.rpgImport.results.writtenPaths")}
                items={latestResult.result.writtenPaths}
                emptyLabel={t("sources.rpgImport.results.none")}
              />
              <ResultList
                icon={<ListChecks className="h-3.5 w-3.5" />}
                title={t("sources.rpgImport.results.skipped")}
                items={latestResult.result.skipped}
                emptyLabel={t("sources.rpgImport.results.none")}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            {t("sources.rpgImport.close")}
          </Button>
          <Button onClick={handleImport} disabled={!canImport}>
            <Upload className="mr-1.5 h-4 w-4" />
            {importing ? t("sources.importing") : t("sources.rpgImport.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

async function runSourceImport(
  project: WikiProject,
  selectedPaths: string[],
  llmConfig: LlmConfig,
  sourceWatchConfig: SourceWatchConfig,
): Promise<RpgImportResult> {
  const { importedPaths, skippedPaths } = await importSourceFilesWithReport(
    project,
    selectedPaths,
    llmConfig,
    sourceWatchConfig,
  )
  const warnings = skippedPaths.length === 0
    ? []
    : ["Some selected source files were skipped by the source import filters or source-watch size/type rules."]

  return {
    mode: "source_ingest",
    writtenPaths: importedPaths,
    reviewItems: [],
    warnings,
    skipped: skippedPaths,
  }
}

async function runDedicatedImport(
  project: WikiProject,
  sourcePath: string,
  selection: ReturnType<typeof resolveRpgImportUiSelection>,
): Promise<RpgImportResult> {
  return runRpgImport({
    mode: selection.mode,
    projectPath: project.path,
    sourcePath,
    sourceFileName: getFileName(sourcePath),
    targetSlot: selection.targetSlot,
    options: selection.options,
  })
}

async function refreshProjectViews(
  project: WikiProject,
  onImported: RpgImportDialogProps["onImported"],
): Promise<void> {
  await onImported?.()
  const pp = normalizePath(project.path)
  const tree = await listDirectory(pp)
  const store = useWikiStore.getState()
  store.setFileTree(tree)
  store.bumpDataVersion()
}

function toReviewStoreItem(
  item: unknown,
  result: RpgImportResult,
  labels: { openRelated: string; skip: string },
): Omit<ReviewItem, "id" | "resolved" | "createdAt"> {
  const display = toDisplayReviewItem(item)
  const affectedPages = display.affectedPages.length > 0
    ? display.affectedPages
    : [...result.skipped, ...result.writtenPaths]
  const options: ReviewItem["options"] = []
  if (affectedPages[0]) {
    options.push({ label: labels.openRelated, action: `open:${affectedPages[0]}` })
  }
  options.push({ label: labels.skip, action: "skip" })

  return {
    type: "confirm",
    title: display.title,
    description: display.description,
    affectedPages: affectedPages.length > 0 ? affectedPages : undefined,
    options,
  }
}

function toDisplayReviewItem(item: unknown): DisplayReviewItem {
  if (isRecord(item)) {
    return {
      title: stringValue(item.title) ?? "Review RPG import item",
      description: stringValue(item.description) ?? stringifyReviewItem(item),
      affectedPages: stringArray(item.affectedPages),
    }
  }

  return {
    title: "Review RPG import item",
    description: stringifyReviewItem(item),
    affectedPages: [],
  }
}

function ResultList({
  icon,
  title,
  items,
  emptyLabel,
}: {
  icon: ReactNode
  title: string
  items: string[]
  emptyLabel: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
        {icon}
        <span>{title}</span>
        <span>({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {items.map((item) => (
            <li key={item} className="truncate rounded bg-muted/40 px-2 py-1" title={item}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReviewResultList({
  title,
  items,
  emptyLabel,
}: {
  title: string
  items: DisplayReviewItem[]
  emptyLabel: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" />
        <span>{title}</span>
        <span>({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {items.map((item, index) => (
            <li key={`${item.title}-${index}`} className="rounded bg-muted/40 px-2 py-1.5">
              <div className="font-medium">{item.title}</div>
              <div className="mt-0.5 text-muted-foreground">{item.description}</div>
              {item.affectedPages.length > 0 && (
                <div className="mt-1 truncate text-muted-foreground" title={item.affectedPages.join(", ")}>
                  {item.affectedPages.join(", ")}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function stringifyReviewItem(item: unknown): string {
  if (typeof item === "string") return item
  try {
    return JSON.stringify(item)
  } catch {
    return String(item)
  }
}

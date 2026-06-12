import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { listDirectory, readFile } from "@/commands/fs"
import { useWikiStore, type LlmConfig } from "@/stores/wiki-store"
import {
  createLlmRpgActionResolverAdapter,
  createLlmRpgNarrationGeneratorAdapter,
  createLlmRpgOutlineBriefAdapter,
  createLlmRpgRecallSelectorAdapter,
  createLlmRpgRuntimeUpdateInteractionAdapter,
  createLlmRpgWorldTickAdapter,
  type RpgActionResolverAdapter,
  type RpgNarrationGeneratorAdapter,
  type RpgOutlineBriefAdapter,
  type RpgRecallSelectorAdapter,
  type RpgRuntimeUpdateInteractionAdapter,
  type RpgWorldTickAdapter,
} from "@/lib/rpg-interactions/runtime"
import {
  runRpgRuntimeTurnFlow,
  type RunRpgRuntimeTurnFlowResult,
  type RpgRuntimeTurnPersistence,
} from "@/lib/rpg-runtime/runtime-controller"
import {
  appendRpgApplyJournalEntry,
  appendRpgTurnJournalEntry,
  loadRpgRuntimeSnapshot,
  saveRpgPendingUpdates,
  type RuntimeApplyJournalEntry,
  type RuntimeTurnJournalEntry,
} from "@/lib/rpg-runtime/runtime-persistence"
import type { RpgActionOption } from "@/lib/rpg-runtime/turn-model"
import type { SubmittedAction } from "@/lib/rpg-runtime/types"
import {
  acceptPendingRpgUpdate,
  rejectPendingRpgUpdate,
  type PendingRpgUpdate,
} from "@/lib/rpg-runtime/update-staging"
import {
  applyRpgPendingUpdates,
  type ApplyRpgPendingUpdatesInput,
  type ApplyRpgPendingUpdatesResult,
} from "@/lib/rpg-runtime/write-policy"
import { PendingRpgUpdatesPanel } from "./pending-rpg-updates-panel"
import { RpgPlayPanel } from "./rpg-play-panel"

const CURRENT_SCENE_PATH = "wiki/current-scene/scene_state.md"

export interface RpgRuntimePanelDependencies {
  readFile: (path: string) => Promise<string>
  createActionResolverAdapter: (input: { llmConfig: LlmConfig; signal?: AbortSignal }) => RpgActionResolverAdapter
  createWorldTickAdapter: (input: { llmConfig: LlmConfig; signal?: AbortSignal }) => RpgWorldTickAdapter
  createRecallSelectorAdapter: (input: { llmConfig: LlmConfig; signal?: AbortSignal }) => RpgRecallSelectorAdapter
  createOutlineBriefCompilerAdapter: (input: { llmConfig: LlmConfig; signal?: AbortSignal }) => RpgOutlineBriefAdapter
  createNarrationAdapter: (input: { llmConfig: LlmConfig; signal?: AbortSignal }) => RpgNarrationGeneratorAdapter
  createUpdateInteractionAdapter: (input: {
    llmConfig: LlmConfig
    signal?: AbortSignal
  }) => RpgRuntimeUpdateInteractionAdapter
  runTurnFlow: (input: {
    projectPath: string
    wikiMode: "llmwikirpg"
    submittedAction: SubmittedAction
    actionResolverAdapter: RpgActionResolverAdapter
    worldTickAdapter: RpgWorldTickAdapter
    recallSelectorAdapter: RpgRecallSelectorAdapter
    outlineBriefCompilerAdapter: RpgOutlineBriefAdapter
    narrationAdapter: RpgNarrationGeneratorAdapter
    updateInteractionAdapter: RpgRuntimeUpdateInteractionAdapter
    runtimePersistence?: RpgRuntimeTurnPersistence
  }) => Promise<RunRpgRuntimeTurnFlowResult>
  applyPendingUpdates: (input: ApplyRpgPendingUpdatesInput) => Promise<ApplyRpgPendingUpdatesResult>
  loadRuntimeSnapshot: (projectPath: string) => Promise<{ pendingUpdates: PendingRpgUpdate[]; warnings: string[] }>
  savePendingUpdates: (projectPath: string, updates: PendingRpgUpdate[]) => Promise<{ warnings?: string[] }>
  appendTurnJournalEntry: (projectPath: string, entry: RuntimeTurnJournalEntry) => Promise<{ warnings?: string[] } | void>
  appendApplyJournalEntry: (projectPath: string, entry: RuntimeApplyJournalEntry) => Promise<{ warnings?: string[] } | void>
  reloadProjectFiles: (
    projectPath: string,
    affectedPaths: string[],
  ) => Promise<{ warnings?: string[] } | void>
}

export interface RpgRuntimePanelState {
  currentScene: string
  lastNarrative: string
  nextActionOptions: RpgActionOption[]
  warnings: string[]
  pendingUpdates: PendingRpgUpdate[]
  lastApplyResult: ApplyRpgPendingUpdatesResult | null
  skippedApplyReasons: Record<string, string>
  runtimeError: string
  isLoadingScene: boolean
  isSubmitting: boolean
  isApplying: boolean
}

export interface RpgRuntimePanelSubmitResult {
  lastNarrative: string
  nextActionOptions: RpgActionOption[]
  warnings: string[]
  pendingUpdates: PendingRpgUpdate[]
}

export interface RpgRuntimePanelProps {
  projectPath?: string
  llmConfig?: LlmConfig
  dependencies?: Partial<RpgRuntimePanelDependencies>
  initialState?: Partial<RpgRuntimePanelState>
  onProjectFilesChanged?: (affectedPaths: string[]) => void | Promise<void>
}

const defaultDependencies: RpgRuntimePanelDependencies = {
  readFile,
  createActionResolverAdapter: createLlmRpgActionResolverAdapter,
  createWorldTickAdapter: createLlmRpgWorldTickAdapter,
  createRecallSelectorAdapter: createLlmRpgRecallSelectorAdapter,
  createOutlineBriefCompilerAdapter: createLlmRpgOutlineBriefAdapter,
  createNarrationAdapter: createLlmRpgNarrationGeneratorAdapter,
  createUpdateInteractionAdapter: createLlmRpgRuntimeUpdateInteractionAdapter,
  runTurnFlow: runRpgRuntimeTurnFlow,
  applyPendingUpdates: applyRpgPendingUpdates,
  loadRuntimeSnapshot: loadRpgRuntimeSnapshot,
  savePendingUpdates: saveRpgPendingUpdates,
  appendTurnJournalEntry: appendRpgTurnJournalEntry,
  appendApplyJournalEntry: appendRpgApplyJournalEntry,
  reloadProjectFiles: reloadRpgProjectFiles,
}

export async function loadRpgCurrentScene(
  projectPath: string,
  dependencies: Pick<RpgRuntimePanelDependencies, "readFile"> = defaultDependencies,
): Promise<{ currentScene: string; warnings: string[] }> {
  const normalizedProjectPath = projectPath.trim().replace(/\\/g, "/").replace(/\/+$/, "")
  if (!normalizedProjectPath) {
    return {
      currentScene: "",
      warnings: ["Open an llmWikiRPG project before starting the RPG runtime."],
    }
  }

  try {
    const currentScene = await dependencies.readFile(`${normalizedProjectPath}/${CURRENT_SCENE_PATH}`)
    return { currentScene, warnings: [] }
  } catch {
    return {
      currentScene: "",
      warnings: [`Missing current scene: ${CURRENT_SCENE_PATH}`],
    }
  }
}

export async function submitRpgRuntimePanelAction(input: {
  projectPath: string
  llmConfig: LlmConfig
  submittedAction: SubmittedAction
  signal?: AbortSignal
  dependencies?: Partial<
    Pick<
      RpgRuntimePanelDependencies,
      | "createActionResolverAdapter"
      | "createWorldTickAdapter"
      | "createRecallSelectorAdapter"
      | "createOutlineBriefCompilerAdapter"
      | "createNarrationAdapter"
      | "createUpdateInteractionAdapter"
      | "runTurnFlow"
      | "appendTurnJournalEntry"
      | "savePendingUpdates"
    >
  >
}): Promise<RpgRuntimePanelSubmitResult> {
  const dependencies = { ...defaultDependencies, ...input.dependencies }
  const actionResolverAdapter = dependencies.createActionResolverAdapter({
    llmConfig: input.llmConfig,
    signal: input.signal,
  })
  const worldTickAdapter = dependencies.createWorldTickAdapter({
    llmConfig: input.llmConfig,
    signal: input.signal,
  })
  const recallSelectorAdapter = dependencies.createRecallSelectorAdapter({
    llmConfig: input.llmConfig,
    signal: input.signal,
  })
  const outlineBriefCompilerAdapter = dependencies.createOutlineBriefCompilerAdapter({
    llmConfig: input.llmConfig,
    signal: input.signal,
  })
  const narrationAdapter = dependencies.createNarrationAdapter({
    llmConfig: input.llmConfig,
    signal: input.signal,
  })
  const updateInteractionAdapter = dependencies.createUpdateInteractionAdapter({
    llmConfig: input.llmConfig,
    signal: input.signal,
  })
  const result = await dependencies.runTurnFlow({
    projectPath: input.projectPath,
    wikiMode: "llmwikirpg",
    submittedAction: input.submittedAction,
    actionResolverAdapter,
    worldTickAdapter,
    recallSelectorAdapter,
    outlineBriefCompilerAdapter,
    narrationAdapter,
    updateInteractionAdapter,
    runtimePersistence: {
      appendTurnJournalEntry: dependencies.appendTurnJournalEntry,
    },
  })
  const persistenceResult = await dependencies.savePendingUpdates(input.projectPath, result.pendingUpdates)

  return {
    lastNarrative: result.turnResult.narrative,
    nextActionOptions: result.turnResult.nextActionOptions,
    warnings: [...result.warnings, ...(persistenceResult.warnings ?? [])],
    pendingUpdates: result.pendingUpdates,
  }
}

export async function loadRpgRuntimePanelPendingUpdates(
  projectPath: string,
  dependencies: Pick<RpgRuntimePanelDependencies, "loadRuntimeSnapshot"> = defaultDependencies,
): Promise<{ pendingUpdates: PendingRpgUpdate[]; warnings: string[] }> {
  if (!projectPath.trim()) return { pendingUpdates: [], warnings: [] }
  return dependencies.loadRuntimeSnapshot(projectPath)
}

export async function saveRpgRuntimePanelPendingUpdates(input: {
  projectPath: string
  updates: PendingRpgUpdate[]
  dependencies?: Partial<Pick<RpgRuntimePanelDependencies, "savePendingUpdates">>
}): Promise<{ warnings: string[] }> {
  const dependencies = { ...defaultDependencies, ...input.dependencies }
  const result = await dependencies.savePendingUpdates(input.projectPath, input.updates)
  return { warnings: result.warnings ?? [] }
}

export async function applyRpgRuntimePanelAcceptedUpdates(input: {
  projectPath: string
  updates: PendingRpgUpdate[]
  dependencies?: Partial<
    Pick<
      RpgRuntimePanelDependencies,
      "applyPendingUpdates" | "savePendingUpdates" | "appendApplyJournalEntry" | "readFile" | "reloadProjectFiles"
    >
  >
}): Promise<{
  pendingUpdates: PendingRpgUpdate[]
  applyResult: ApplyRpgPendingUpdatesResult
  skippedApplyReasons: Record<string, string>
  affectedPaths: string[]
  refreshedCurrentScene?: string
}> {
  const dependencies = { ...defaultDependencies, ...input.dependencies }
  const acceptedUpdates = input.updates.filter((update) => update.status === "accepted")
  const applyResult = await dependencies.applyPendingUpdates({
    projectPath: input.projectPath,
    updates: acceptedUpdates,
  })
  const appliedIds = new Set(applyResult.appliedUpdates.map((update) => update.id))
  const skippedApplyReasons = Object.fromEntries(
    applyResult.skippedUpdates.map((update) => [update.id, update.reason]),
  )
  const affectedPaths = getAppliedRpgUpdatePaths(applyResult)
  const remainingPendingUpdates = input.updates.filter((update) => !appliedIds.has(update.id))
  const persistenceWarnings = await appendAndSaveApplyPersistence(input.projectPath, {
    attemptedUpdates: acceptedUpdates,
    remainingPendingUpdates,
    applyResult,
    dependencies,
  })
  const refreshWarnings: string[] = []
  let refreshedCurrentScene: string | undefined

  if (affectedPaths.length > 0) {
    try {
      const reloadResult = await dependencies.reloadProjectFiles(input.projectPath, affectedPaths)
      refreshWarnings.push(...(reloadResult?.warnings ?? []))
    } catch (error) {
      refreshWarnings.push(`Could not refresh project files after RPG apply: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (didApplyCurrentSceneOverwrite(applyResult)) {
    const sceneResult = await loadRpgCurrentScene(input.projectPath, dependencies)
    refreshedCurrentScene = sceneResult.currentScene
    refreshWarnings.push(...sceneResult.warnings)
  }

  return {
    pendingUpdates: remainingPendingUpdates,
    applyResult: {
      ...applyResult,
      warnings: [...applyResult.warnings, ...persistenceWarnings, ...refreshWarnings],
    },
    skippedApplyReasons,
    affectedPaths,
    refreshedCurrentScene,
  }
}

export function RpgRuntimePanel({
  projectPath,
  llmConfig,
  dependencies,
  initialState,
  onProjectFilesChanged,
}: RpgRuntimePanelProps) {
  const storeProject = useWikiStore((state) => state.project)
  const storeLlmConfig = useWikiStore((state) => state.llmConfig)
  const effectiveProjectPath = projectPath ?? storeProject?.path ?? ""
  const effectiveLlmConfig = llmConfig ?? storeLlmConfig
  const resolvedDependencies = useMemo(
    () => ({ ...defaultDependencies, ...dependencies }),
    [dependencies],
  )
  const abortRef = useRef<AbortController | null>(null)

  const [state, setState] = useState<RpgRuntimePanelState>({
    currentScene: initialState?.currentScene ?? "",
    lastNarrative: initialState?.lastNarrative ?? "",
    nextActionOptions: initialState?.nextActionOptions ?? [],
    warnings: initialState?.warnings ?? [],
    pendingUpdates: initialState?.pendingUpdates ?? [],
    lastApplyResult: initialState?.lastApplyResult ?? null,
    skippedApplyReasons: initialState?.skippedApplyReasons ?? {},
    runtimeError: initialState?.runtimeError ?? "",
    isLoadingScene: initialState?.isLoadingScene ?? false,
    isSubmitting: initialState?.isSubmitting ?? false,
    isApplying: initialState?.isApplying ?? false,
  })

  useEffect(() => {
    if (initialState?.currentScene !== undefined) return

    let cancelled = false
    setState((current) => ({
      ...current,
      isLoadingScene: true,
      runtimeError: "",
    }))

    loadRpgCurrentScene(effectiveProjectPath, resolvedDependencies).then((result) => {
      if (cancelled) return
      setState((current) => ({
        ...current,
        currentScene: result.currentScene,
        warnings: mergeWarnings(current.warnings, result.warnings),
        isLoadingScene: false,
      }))
    })

    return () => {
      cancelled = true
    }
  }, [effectiveProjectPath, initialState?.currentScene, resolvedDependencies])

  useEffect(() => {
    if (initialState?.pendingUpdates !== undefined || !effectiveProjectPath) return

    let cancelled = false
    loadRpgRuntimePanelPendingUpdates(effectiveProjectPath, resolvedDependencies).then((result) => {
      if (cancelled) return
      setState((current) => ({
        ...current,
        pendingUpdates: result.pendingUpdates,
        warnings: mergeWarnings(current.warnings, result.warnings),
      }))
    })

    return () => {
      cancelled = true
    }
  }, [effectiveProjectPath, initialState?.pendingUpdates, resolvedDependencies])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const handleSubmitAction = async (submittedAction: SubmittedAction) => {
    if (!effectiveProjectPath) {
      setState((current) => ({
        ...current,
        runtimeError: "Open an llmWikiRPG project before submitting an RPG action.",
      }))
      return
    }

    abortRef.current?.abort()
    const abortController = new AbortController()
    abortRef.current = abortController

    setState((current) => ({
      ...current,
      isSubmitting: true,
      runtimeError: "",
    }))

    try {
      const result = await submitRpgRuntimePanelAction({
        projectPath: effectiveProjectPath,
        llmConfig: effectiveLlmConfig,
        submittedAction,
        signal: abortController.signal,
        dependencies: resolvedDependencies,
      })
      setState((current) => ({
        ...current,
        lastNarrative: result.lastNarrative,
        nextActionOptions: result.nextActionOptions,
        warnings: result.warnings,
        pendingUpdates: result.pendingUpdates,
        lastApplyResult: null,
        skippedApplyReasons: {},
        isSubmitting: false,
      }))
    } catch (error) {
      if (abortController.signal.aborted) return
      setState((current) => ({
        ...current,
        runtimeError: `RPG runtime error: ${error instanceof Error ? error.message : String(error)}`,
        isSubmitting: false,
      }))
    }
  }

  const handleAcceptUpdate = (id: string) => {
    const pendingUpdates = acceptPendingRpgUpdate(state.pendingUpdates, id)
    void persistPendingQueue(effectiveProjectPath, pendingUpdates, resolvedDependencies, setState)
    setState((current) => ({
      ...current,
      pendingUpdates,
      skippedApplyReasons: withoutKey(current.skippedApplyReasons, id),
    }))
  }

  const handleRejectUpdate = (id: string) => {
    const pendingUpdates = rejectPendingRpgUpdate(state.pendingUpdates, id)
    void persistPendingQueue(effectiveProjectPath, pendingUpdates, resolvedDependencies, setState)
    setState((current) => ({
      ...current,
      pendingUpdates,
      skippedApplyReasons: withoutKey(current.skippedApplyReasons, id),
    }))
  }

  const handleApplyAcceptedUpdates = async () => {
    if (!effectiveProjectPath) {
      setState((current) => ({
        ...current,
        runtimeError: "Open an llmWikiRPG project before applying RPG updates.",
      }))
      return
    }

    setState((current) => ({
      ...current,
      isApplying: true,
      runtimeError: "",
    }))

    try {
      const result = await applyRpgRuntimePanelAcceptedUpdates({
        projectPath: effectiveProjectPath,
        updates: state.pendingUpdates,
        dependencies: {
          ...resolvedDependencies,
          reloadProjectFiles: async (currentProjectPath, affectedPaths) => {
            if (onProjectFilesChanged) {
              await onProjectFilesChanged(affectedPaths)
              return undefined
            }
            return resolvedDependencies.reloadProjectFiles(currentProjectPath, affectedPaths)
          },
        },
      })
      setState((current) => ({
        ...current,
        ...(result.refreshedCurrentScene !== undefined
          ? { currentScene: result.refreshedCurrentScene }
          : {}),
        pendingUpdates: result.pendingUpdates,
        lastApplyResult: result.applyResult,
        skippedApplyReasons: result.skippedApplyReasons,
        isApplying: false,
      }))
    } catch (error) {
      setState((current) => ({
        ...current,
        runtimeError: `RPG apply error: ${error instanceof Error ? error.message : String(error)}`,
        isApplying: false,
      }))
    }
  }

  const disabled = state.isLoadingScene || state.isSubmitting || state.isApplying || !effectiveProjectPath

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background" data-rpg-runtime-panel="v0">
      <section className="shrink-0 border-b border-border/70 bg-muted/30 px-4 py-3" aria-labelledby="rpg-runtime-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 id="rpg-runtime-heading" className="text-sm font-semibold text-foreground">
              RPG Runtime
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Pending updates: {state.pendingUpdates.length}
            </p>
          </div>
          {(state.isLoadingScene || state.isSubmitting) && (
            <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {state.isSubmitting ? "Running turn..." : "Loading scene..."}
            </div>
          )}
        </div>

        {state.runtimeError && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.runtimeError}
          </div>
        )}

        {state.warnings.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Runtime warnings
            </div>
            <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              {state.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {state.pendingUpdates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {state.pendingUpdates.slice(0, 4).map((update) => (
              <span key={update.id} className="rounded border border-border/70 px-2 py-1">
                {update.strategy}: {update.targetPath}
              </span>
            ))}
            {state.pendingUpdates.length > 4 && (
              <span className="rounded border border-border/70 px-2 py-1">
                +{state.pendingUpdates.length - 4} more
              </span>
            )}
          </div>
        )}
      </section>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="min-h-0 flex-1 overflow-hidden">
          <RpgPlayPanel
            currentScene={state.currentScene}
            lastNarrative={state.lastNarrative}
            nextActionOptions={state.nextActionOptions}
            onSubmitAction={handleSubmitAction}
            disabled={disabled}
          />
        </div>
        <div className="min-h-0 max-h-96 shrink-0 border-t border-border/70 lg:h-full lg:max-h-none lg:w-[420px] lg:border-l lg:border-t-0">
          <PendingRpgUpdatesPanel
            updates={state.pendingUpdates}
            onAcceptUpdate={handleAcceptUpdate}
            onRejectUpdate={handleRejectUpdate}
            onApplyAcceptedUpdates={handleApplyAcceptedUpdates}
            applyResult={state.lastApplyResult}
            skippedApplyReasons={state.skippedApplyReasons}
            isApplying={state.isApplying}
            disabled={state.isLoadingScene || state.isSubmitting || !effectiveProjectPath}
          />
        </div>
      </div>
    </div>
  )
}

function withoutKey(record: Record<string, string>, key: string): Record<string, string> {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key]
  return next
}

export function getAppliedRpgUpdatePaths(applyResult: ApplyRpgPendingUpdatesResult): string[] {
  return uniqueNormalizedPaths(applyResult.appliedUpdates.map((update) => update.targetPath))
}

export function didApplyCurrentSceneOverwrite(applyResult: ApplyRpgPendingUpdatesResult): boolean {
  return applyResult.appliedUpdates.some(
    (update) => normalizeRpgApplyPath(update.targetPath) === CURRENT_SCENE_PATH && update.strategy === "overwrite",
  )
}

async function reloadRpgProjectFiles(
  projectPath: string,
  affectedPaths: string[],
): Promise<{ warnings?: string[] } | void> {
  if (affectedPaths.length === 0) return undefined
  const normalizedProjectPath = projectPath.trim().replace(/\\/g, "/").replace(/\/+$/, "")
  if (!normalizedProjectPath) {
    return { warnings: ["Could not refresh project files after RPG apply: projectPath is required."] }
  }

  const tree = await listDirectory(normalizedProjectPath)
  const store = useWikiStore.getState()
  store.setFileTree(tree)
  store.bumpDataVersion()
  return undefined
}

async function appendAndSaveApplyPersistence(
  projectPath: string,
  input: {
    attemptedUpdates: PendingRpgUpdate[]
    remainingPendingUpdates: PendingRpgUpdate[]
    applyResult: ApplyRpgPendingUpdatesResult
    dependencies: Pick<RpgRuntimePanelDependencies, "appendApplyJournalEntry" | "savePendingUpdates">
  },
): Promise<string[]> {
  const entry: RuntimeApplyJournalEntry = {
    timestamp: new Date().toISOString(),
    attemptedUpdateIds: input.attemptedUpdates.map((update) => update.id),
    appliedUpdateIds: input.applyResult.appliedUpdates.map((update) => update.id),
    remainingPendingUpdateIds: input.remainingPendingUpdates.map((update) => update.id),
    applyResult: input.applyResult,
  }

  const warnings: string[] = []
  try {
    const journalResult = await input.dependencies.appendApplyJournalEntry(projectPath, entry)
    warnings.push(...(journalResult?.warnings ?? []))
  } catch (error) {
    warnings.push(`Could not append RPG apply journal entry: ${error instanceof Error ? error.message : String(error)}`)
  }

  try {
    const saveResult = await input.dependencies.savePendingUpdates(projectPath, input.remainingPendingUpdates)
    warnings.push(...(saveResult.warnings ?? []))
  } catch (error) {
    warnings.push(`Could not save RPG pending updates: ${error instanceof Error ? error.message : String(error)}`)
  }

  return warnings
}

async function persistPendingQueue(
  projectPath: string,
  updates: PendingRpgUpdate[],
  dependencies: Pick<RpgRuntimePanelDependencies, "savePendingUpdates">,
  setState: Dispatch<SetStateAction<RpgRuntimePanelState>>,
): Promise<void> {
  if (!projectPath) return

  try {
    const result = await dependencies.savePendingUpdates(projectPath, updates)
    if (!result.warnings?.length) return
    setState((current) => ({
      ...current,
      warnings: mergeWarnings(current.warnings, result.warnings ?? []),
    }))
  } catch (error) {
    setState((current) => ({
      ...current,
      warnings: mergeWarnings(current.warnings, [
        `Could not save RPG pending updates: ${error instanceof Error ? error.message : String(error)}`,
      ]),
    }))
  }
}

function mergeWarnings(current: string[], next: string[]): string[] {
  return [...new Set([...current, ...next])]
}

function uniqueNormalizedPaths(paths: string[]): string[] {
  return [...new Set(paths.map(normalizeRpgApplyPath).filter(Boolean))]
}

function normalizeRpgApplyPath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/^\/+/, "")
}

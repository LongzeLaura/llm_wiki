import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { readFile } from "@/commands/fs"
import { useWikiStore, type LlmConfig } from "@/stores/wiki-store"
import type { RpgNarrationAdapter } from "@/lib/rpg-runtime/narration-adapter"
import { createLlmRpgNarrationAdapter } from "@/lib/rpg-runtime/llm-narration-adapter"
import {
  runRpgRuntimeTurnFlow,
  type RunRpgRuntimeTurnFlowResult,
} from "@/lib/rpg-runtime/runtime-controller"
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
  createNarrationAdapter: (input: { llmConfig: LlmConfig; signal?: AbortSignal }) => RpgNarrationAdapter
  runTurnFlow: (input: {
    projectPath: string
    wikiMode: "llmwikirpg"
    submittedAction: SubmittedAction
    narrationAdapter: RpgNarrationAdapter
  }) => Promise<RunRpgRuntimeTurnFlowResult>
  applyPendingUpdates: (input: ApplyRpgPendingUpdatesInput) => Promise<ApplyRpgPendingUpdatesResult>
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
}

const defaultDependencies: RpgRuntimePanelDependencies = {
  readFile,
  createNarrationAdapter: createLlmRpgNarrationAdapter,
  runTurnFlow: runRpgRuntimeTurnFlow,
  applyPendingUpdates: applyRpgPendingUpdates,
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
  dependencies?: Partial<Pick<RpgRuntimePanelDependencies, "createNarrationAdapter" | "runTurnFlow">>
}): Promise<RpgRuntimePanelSubmitResult> {
  const dependencies = { ...defaultDependencies, ...input.dependencies }
  const narrationAdapter = dependencies.createNarrationAdapter({
    llmConfig: input.llmConfig,
    signal: input.signal,
  })
  const result = await dependencies.runTurnFlow({
    projectPath: input.projectPath,
    wikiMode: "llmwikirpg",
    submittedAction: input.submittedAction,
    narrationAdapter,
  })

  return {
    lastNarrative: result.turnResult.narrative,
    nextActionOptions: result.turnResult.nextActionOptions,
    warnings: result.warnings,
    pendingUpdates: result.pendingUpdates,
  }
}

export async function applyRpgRuntimePanelAcceptedUpdates(input: {
  projectPath: string
  updates: PendingRpgUpdate[]
  dependencies?: Partial<Pick<RpgRuntimePanelDependencies, "applyPendingUpdates">>
}): Promise<{
  pendingUpdates: PendingRpgUpdate[]
  applyResult: ApplyRpgPendingUpdatesResult
  skippedApplyReasons: Record<string, string>
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

  return {
    pendingUpdates: input.updates.filter((update) => !appliedIds.has(update.id)),
    applyResult,
    skippedApplyReasons,
  }
}

export function RpgRuntimePanel({
  projectPath,
  llmConfig,
  dependencies,
  initialState,
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
        warnings: result.warnings,
        isLoadingScene: false,
      }))
    })

    return () => {
      cancelled = true
    }
  }, [effectiveProjectPath, initialState?.currentScene, resolvedDependencies])

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
    setState((current) => ({
      ...current,
      pendingUpdates: acceptPendingRpgUpdate(current.pendingUpdates, id),
      skippedApplyReasons: withoutKey(current.skippedApplyReasons, id),
    }))
  }

  const handleRejectUpdate = (id: string) => {
    setState((current) => ({
      ...current,
      pendingUpdates: rejectPendingRpgUpdate(current.pendingUpdates, id),
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
        dependencies: resolvedDependencies,
      })
      setState((current) => ({
        ...current,
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

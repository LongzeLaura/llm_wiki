import { Download, Eye, Trash2 } from "lucide-react"
import type {
  RpgRuntimeDebugSection,
  RpgRuntimeDebugStep,
  RpgRuntimeDebugTrace,
} from "@/lib/rpg-runtime/debug-trace"

export interface RpgRuntimeDebugConsoleProps {
  currentTrace: RpgRuntimeDebugTrace | null
  lastTrace: RpgRuntimeDebugTrace | null
  onClear?: () => void
  onExportTrace?: (trace: RpgRuntimeDebugTrace) => void
  persistencePolicy?: { enabled: boolean; maxTraces: 5 | 10 | 20 }
  onPersistencePolicyChange?: (policy: { enabled: boolean; maxTraces: 5 | 10 | 20 }) => void
  repairRetryEnabled?: boolean
  onRepairRetryEnabledChange?: (enabled: boolean) => void
  persistedTraces?: RpgRuntimeDebugTrace[]
  selectedPersistedTraceId?: string | null
  onSelectPersistedTrace?: (traceId: string) => void
  onClearSaved?: () => void
  persistenceWarnings?: string[]
  defaultExpandedStepIds?: string[]
  defaultExpandedSectionIds?: string[]
}

const RETENTION_OPTIONS = [5, 10, 20] as const

type SectionGroup =
  | { id: "input"; title: "输入组装"; sections: RpgRuntimeDebugSection[] }
  | { id: "prompt"; title: "提示词"; sections: RpgRuntimeDebugSection[] }
  | { id: "raw"; title: "原始输出"; sections: RpgRuntimeDebugSection[] }
  | { id: "parsed"; title: "解析后输出"; sections: RpgRuntimeDebugSection[] }
  | { id: "formatRecovery"; title: "格式恢复"; recovery: StepFormatRecoveryView }
  | { id: "validation"; title: "校验"; sections: RpgRuntimeDebugSection[] }
  | { id: "warnings"; title: "警告"; warnings: string[] }
  | { id: "handoff"; title: "交接 / 下一步输入"; sections: RpgRuntimeDebugSection[] }

interface StepFormatRecoveryView {
  hasRecovery: boolean
  localRepairOperations: string[]
  looseCoercions: RpgRuntimeDebugStep["looseCoercions"]
  repairRetryAttempted: boolean
  repairRetrySucceeded: boolean
  repairRetryFailureSummary?: string
}

interface TraceFormatRecoverySummary {
  hasRecovery: boolean
  localRepairOperationCount: number
  looseCoercionCount: number
  repairRetrySucceededCount: number
  repairRetryFailedCount: number
}

export function RpgRuntimeDebugConsole({
  currentTrace,
  lastTrace,
  onClear,
  onExportTrace,
  persistencePolicy = { enabled: false, maxTraces: 5 },
  onPersistencePolicyChange,
  repairRetryEnabled = false,
  onRepairRetryEnabledChange,
  persistedTraces = [],
  selectedPersistedTraceId = null,
  onSelectPersistedTrace,
  onClearSaved,
  persistenceWarnings = [],
  defaultExpandedStepIds = [],
  defaultExpandedSectionIds = [],
}: RpgRuntimeDebugConsoleProps) {
  const selectedPersistedTrace = persistedTraces.find((entry) => entry.traceId === selectedPersistedTraceId) ?? null
  const trace = currentTrace ?? selectedPersistedTrace ?? lastTrace
  const traceKind = currentTrace
    ? "当前 trace"
    : selectedPersistedTrace
      ? "已保存 trace"
      : lastTrace
        ? "上一次 trace"
        : "暂无 trace"
  const exportableTrace = selectRpgRuntimeDebugConsoleExportTrace({
    currentTrace,
    selectedPersistedTrace,
    lastTrace,
  })
  const recoverySummary = trace ? summarizeTraceFormatRecovery(trace) : null
  const canClear = Boolean(currentTrace || lastTrace) && !currentTrace

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background" aria-label="RPG runtime 调试控制台">
      <div className="shrink-0 border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">调试控制台</h2>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{traceKind}</span>
              {trace && <span>状态：{trace.status}</span>}
              {trace && <span>行动：{trace.submittedActionText}</span>}
              {trace && <span>Trace：{trace.traceId}</span>}
              {recoverySummary?.hasRecovery && (
                <span>
                  格式恢复：本地修复 {recoverySummary.localRepairOperationCount} / 宽松转换{" "}
                  {recoverySummary.looseCoercionCount} / 重试成功 {recoverySummary.repairRetrySucceededCount} / 重试失败{" "}
                  {recoverySummary.repairRetryFailedCount}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-2.5 text-xs font-medium text-muted-foreground disabled:opacity-50"
              onClick={() => exportableTrace && onExportTrace?.(exportableTrace)}
              disabled={!exportableTrace || !onExportTrace}
              title="导出 trace JSON"
              aria-label="导出 trace JSON"
            >
              <Download className="h-3.5 w-3.5" />
              导出
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-2.5 text-xs font-medium text-muted-foreground disabled:opacity-50"
              onClick={onClear}
              disabled={!canClear}
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 text-xs">
          <label className="inline-flex items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={repairRetryEnabled}
              onChange={(event) => onRepairRetryEnabledChange?.(event.currentTarget.checked)}
            />
            修复重试
          </label>
          <label className="inline-flex items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={persistencePolicy.enabled}
              onChange={(event) => onPersistencePolicyChange?.({
                ...persistencePolicy,
                enabled: event.currentTarget.checked,
              })}
            />
            持久化
          </label>
          <label className="inline-flex items-center gap-2 text-muted-foreground">
            保留数量
            <select
              className="h-7 rounded-md border border-border/70 bg-background px-2 text-xs text-foreground"
              value={persistencePolicy.maxTraces}
              onChange={(event) => onPersistencePolicyChange?.({
                ...persistencePolicy,
                maxTraces: Number(event.currentTarget.value) as 5 | 10 | 20,
              })}
            >
              {RETENTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/70 px-2 text-xs font-medium text-muted-foreground disabled:opacity-50"
            onClick={onClearSaved}
            disabled={!onClearSaved}
          >
            <Trash2 className="h-3.5 w-3.5" />
            清除已保存
          </button>
        </div>
        {persistenceWarnings.length > 0 && (
          <div className="mt-2 border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-foreground">
            {persistenceWarnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <PersistedTraceList
          traces={persistedTraces}
          selectedTraceId={selectedPersistedTraceId}
          onSelectTrace={onSelectPersistedTrace}
          onExportTrace={onExportTrace}
        />
        {!trace ? (
          <div className="border border-dashed border-border/80 px-3 py-6 text-sm text-muted-foreground">
            当前没有 runtime 调试 trace。
          </div>
        ) : (
          <div className="space-y-2">
            {trace.steps.map((step) => (
              <DebugStepRow
                key={step.stepId}
                step={step}
                defaultOpen={defaultExpandedStepIds.includes(step.stepId)}
                defaultExpandedSectionIds={defaultExpandedSectionIds}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function selectRpgRuntimeDebugConsoleExportTrace(input: {
  currentTrace: RpgRuntimeDebugTrace | null
  selectedPersistedTrace: RpgRuntimeDebugTrace | null
  lastTrace: RpgRuntimeDebugTrace | null
}): RpgRuntimeDebugTrace | null {
  return input.currentTrace ?? input.selectedPersistedTrace ?? input.lastTrace
}

function PersistedTraceList({
  traces,
  selectedTraceId,
  onSelectTrace,
  onExportTrace,
}: {
  traces: RpgRuntimeDebugTrace[]
  selectedTraceId: string | null
  onSelectTrace?: (traceId: string) => void
  onExportTrace?: (trace: RpgRuntimeDebugTrace) => void
}) {
  if (traces.length === 0) return null

  return (
    <details className="mb-3 border border-border/70" open>
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-foreground marker:text-muted-foreground">
        <span>已保存 trace</span>
        <span className="font-normal text-muted-foreground">{traces.length}</span>
      </summary>
      <div className="divide-y divide-border/60 border-t border-border/70">
        {traces.map((trace) => (
          <div
            key={trace.traceId}
            className={`grid grid-cols-1 items-center gap-2 px-3 py-2 text-xs lg:grid-cols-[90px_minmax(120px,1.2fr)_90px_minmax(140px,1fr)_minmax(160px,1.6fr)_40px] ${
              trace.traceId === selectedTraceId ? "bg-muted/50" : "bg-background"
            }`}
          >
            <button
              type="button"
              className="inline-flex h-7 w-fit items-center gap-1.5 rounded-md border border-border/70 px-2 font-medium text-muted-foreground disabled:opacity-50"
              onClick={() => onSelectTrace?.(trace.traceId)}
              disabled={!onSelectTrace}
              title="查看已保存 trace"
              aria-label={`查看已保存 trace ${trace.traceId}`}
            >
              <Eye className="h-3.5 w-3.5" />
              查看
            </button>
            <span className="min-w-0 truncate font-medium text-foreground">{trace.traceId}</span>
            <span className={trace.status === "failed" || trace.status === "aborted" ? "text-destructive" : "text-muted-foreground"}>
              {trace.status}
            </span>
            <span className="min-w-0 truncate text-muted-foreground">{trace.startedAt}</span>
            <span className="min-w-0 truncate text-muted-foreground">{trace.submittedActionText}</span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 text-muted-foreground disabled:opacity-50"
              onClick={() => onExportTrace?.(trace)}
              disabled={!onExportTrace}
              title="导出已保存 trace JSON"
              aria-label={`导出已保存 trace ${trace.traceId}`}
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </details>
  )
}

function DebugStepRow({
  step,
  defaultOpen,
  defaultExpandedSectionIds,
}: {
  step: RpgRuntimeDebugStep
  defaultOpen: boolean
  defaultExpandedSectionIds: string[]
}) {
  const promptStats = sumSections(step.promptSections)
  const outputStats = sumSections(step.rawOutput ? [step.rawOutput] : [])
  const summary = step.failureSummary || step.sourceSummary || "无来源摘要。"
  const recoveryBadge = formatStepRecoveryBadge(step)

  return (
    <details
      className="group border border-border/70 bg-background"
      open={defaultOpen || undefined}
      data-step-id={step.stepId}
      data-step-status={step.status}
    >
      <summary className="grid cursor-pointer grid-cols-1 gap-2 px-3 py-2 text-sm marker:text-muted-foreground lg:grid-cols-[minmax(180px,1.4fr)_110px_150px_160px_160px_minmax(180px,2fr)]">
        <span className="font-medium text-foreground">{step.label}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={statusClassName(step.status)}>{step.status}</span>
          {recoveryBadge && (
            <span className={recoveryBadge === "修复重试失败" ? "text-xs font-medium text-destructive" : "text-xs font-medium text-emerald-700 dark:text-emerald-400"}>
              {recoveryBadge}
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatStepTime(step)}
        </span>
        <span className="text-xs text-muted-foreground">
          提示词：{formatStats(promptStats)}
        </span>
        <span className="text-xs text-muted-foreground">
          输出：{formatStats(outputStats)}
        </span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">{summary}</span>
      </summary>
      <div className="border-t border-border/70 px-3 py-3">
        <div className="space-y-2">
          {sectionGroups(step).map((group) => (
            <DebugSectionGroup
              key={group.id}
              stepId={step.stepId}
              group={group}
              defaultOpen={defaultExpandedSectionIds.includes(`${step.stepId}:${group.id}`)}
            />
          ))}
        </div>
      </div>
    </details>
  )
}

function DebugSectionGroup({
  stepId,
  group,
  defaultOpen,
}: {
  stepId: string
  group: SectionGroup
  defaultOpen: boolean
}) {
  const count = "warnings" in group
    ? group.warnings.length
    : "recovery" in group
      ? formatRecoveryCount(group.recovery)
      : group.sections.length

  return (
    <details
      className="border border-border/60"
      open={defaultOpen || undefined}
      data-section-id={`${stepId}:${group.id}`}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-2.5 py-2 text-xs font-medium text-foreground marker:text-muted-foreground">
        <span>{group.title}</span>
        <span className="font-normal text-muted-foreground">{count}</span>
      </summary>
      <div className="space-y-2 border-t border-border/60 p-2.5">
        {"warnings" in group ? (
          group.warnings.length > 0 ? (
            <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
              {group.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : (
            <EmptySection />
          )
        ) : "recovery" in group ? (
          <FormatRecoveryBlock recovery={group.recovery} />
        ) : group.sections.length > 0 ? (
          group.sections.map((section) => (
            <DebugSectionBlock key={section.sectionId} section={section} />
          ))
        ) : (
          <EmptySection />
        )}
      </div>
    </details>
  )
}

function FormatRecoveryBlock({ recovery }: { recovery: StepFormatRecoveryView }) {
  if (!recovery.hasRecovery) return <EmptySection />

  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      {recovery.localRepairOperations.length > 0 && (
        <div>
          <div className="font-medium text-foreground">本地 JSON 修复</div>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {recovery.localRepairOperations.map((operation) => (
              <li key={operation}>{operation}</li>
            ))}
          </ul>
        </div>
      )}
      {recovery.looseCoercions.length > 0 && (
        <div>
          <div className="font-medium text-foreground">宽松草稿转换</div>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {recovery.looseCoercions.map((coercion) => (
              <li key={`${coercion.kind ?? ""}:${coercion.label ?? ""}:${coercion.message}`}>
                {coercion.label ? `${coercion.label}: ` : ""}
                {coercion.kind ? `[${coercion.kind}] ` : ""}
                {coercion.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {recovery.repairRetryAttempted && (
        <div>
          <div className="font-medium text-foreground">修复专用重试</div>
          <div>结果：{recovery.repairRetrySucceeded ? "成功" : "失败"}</div>
          {recovery.repairRetryFailureSummary && <div>{recovery.repairRetryFailureSummary}</div>}
        </div>
      )}
    </div>
  )
}

function DebugSectionBlock({ section }: { section: RpgRuntimeDebugSection }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{section.title}</span>
        <span>{section.sourceKind}</span>
        <span>{section.sourceLabel}</span>
        <span>{section.chars} 字符</span>
        <span>约 {section.estimatedTokens} token</span>
      </div>
      <pre
        className={`max-h-80 overflow-auto whitespace-pre-wrap break-words border border-border/60 bg-muted/30 p-2 text-xs leading-relaxed ${
          section.contentType === "json" ? "font-mono" : "font-mono"
        }`}
      >
        {section.content}
      </pre>
    </div>
  )
}

function EmptySection() {
  return <div className="text-xs text-muted-foreground">空</div>
}

function sectionGroups(step: RpgRuntimeDebugStep): SectionGroup[] {
  const recovery = summarizeStepFormatRecovery(step)
  const groups: SectionGroup[] = [
    { id: "input", title: "输入组装", sections: step.inputSections },
    { id: "prompt", title: "提示词", sections: step.promptSections },
    { id: "raw", title: "原始输出", sections: step.rawOutput ? [step.rawOutput] : [] },
    { id: "parsed", title: "解析后输出", sections: step.parsedOutput ? [step.parsedOutput] : [] },
  ]
  if (recovery.hasRecovery) groups.push({ id: "formatRecovery", title: "格式恢复", recovery })
  groups.push(
    { id: "validation", title: "校验", sections: step.validationSections },
    { id: "warnings", title: "警告", warnings: step.warnings },
    { id: "handoff", title: "交接 / 下一步输入", sections: step.handoffSections },
  )
  return groups
}

function summarizeTraceFormatRecovery(trace: RpgRuntimeDebugTrace): TraceFormatRecoverySummary {
  const summary: TraceFormatRecoverySummary = {
    hasRecovery: false,
    localRepairOperationCount: 0,
    looseCoercionCount: 0,
    repairRetrySucceededCount: 0,
    repairRetryFailedCount: 0,
  }

  for (const step of trace.steps) {
    const recovery = summarizeStepFormatRecovery(step)
    if (!recovery.hasRecovery) continue
    summary.hasRecovery = true
    summary.localRepairOperationCount += recovery.localRepairOperations.length
    summary.looseCoercionCount += recovery.looseCoercions.length
    if (recovery.repairRetrySucceeded) summary.repairRetrySucceededCount += 1
    if (recovery.repairRetryAttempted && !recovery.repairRetrySucceeded) summary.repairRetryFailedCount += 1
  }

  return summary
}

function summarizeStepFormatRecovery(step: RpgRuntimeDebugStep): StepFormatRecoveryView {
  const localRepairOperations = step.localRepairOperations ?? []
  const looseCoercions = step.looseCoercions ?? []
  const repairRetryAttempted = step.repairRetryAttempted ?? false
  const repairRetrySucceeded = step.repairRetrySucceeded ?? false
  return {
    hasRecovery: Boolean(step.formatRecoveryApplied)
      || localRepairOperations.length > 0
      || looseCoercions.length > 0
      || repairRetryAttempted,
    localRepairOperations,
    looseCoercions,
    repairRetryAttempted,
    repairRetrySucceeded,
    repairRetryFailureSummary: step.repairRetryFailureSummary,
  }
}

function formatStepRecoveryBadge(step: RpgRuntimeDebugStep): string | null {
  const recovery = summarizeStepFormatRecovery(step)
  if (!recovery.hasRecovery) return null
  if (recovery.repairRetryAttempted && !recovery.repairRetrySucceeded) return "修复重试失败"
  return "格式恢复"
}

function formatRecoveryCount(recovery: StepFormatRecoveryView): number {
  return recovery.localRepairOperations.length
    + recovery.looseCoercions.length
    + (recovery.repairRetryAttempted ? 1 : 0)
}

function sumSections(sections: RpgRuntimeDebugSection[]): { chars: number; estimatedTokens: number } {
  return sections.reduce(
    (total, section) => ({
      chars: total.chars + section.chars,
      estimatedTokens: total.estimatedTokens + section.estimatedTokens,
    }),
    { chars: 0, estimatedTokens: 0 },
  )
}

function formatStats(stats: { chars: number; estimatedTokens: number }): string {
  if (stats.chars === 0 && stats.estimatedTokens === 0) return "无"
  return `${stats.chars} 字符 / ${stats.estimatedTokens} token`
}

function formatStepTime(step: RpgRuntimeDebugStep): string {
  if (!step.startedAt) return "未开始"
  const start = formatClock(step.startedAt)
  const end = step.endedAt ? formatClock(step.endedAt) : "..."
  const duration = step.durationMs === undefined ? "" : ` / ${step.durationMs} 毫秒`
  return `${start} -> ${end}${duration}`
}

function formatClock(value: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return value
  return new Date(timestamp).toISOString().slice(11, 19)
}

function statusClassName(status: RpgRuntimeDebugStep["status"]): string {
  const base = "text-xs font-medium"
  if (status === "failed" || status === "aborted") return `${base} text-destructive`
  if (status === "succeeded") return `${base} text-emerald-700 dark:text-emerald-400`
  if (status === "running" || status === "streaming" || status === "parsing" || status === "validating") {
    return `${base} text-blue-700 dark:text-blue-400`
  }
  return `${base} text-muted-foreground`
}

import { Check, FileText, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ApplyRpgPendingUpdatesResult } from "@/lib/rpg-runtime/write-policy-shared"
import type { PendingRpgUpdate } from "@/lib/rpg-runtime/update-staging"

export interface PendingRpgUpdatesPanelProps {
  updates: PendingRpgUpdate[]
  onAcceptUpdate: (id: string) => void
  onRejectUpdate: (id: string) => void
  onApplyAcceptedUpdates: () => void | Promise<void>
  applyResult?: ApplyRpgPendingUpdatesResult | null
  skippedApplyReasons?: Record<string, string>
  isApplying?: boolean
  disabled?: boolean
}

export function PendingRpgUpdatesPanel({
  updates,
  onAcceptUpdate,
  onRejectUpdate,
  onApplyAcceptedUpdates,
  applyResult,
  skippedApplyReasons = {},
  isApplying = false,
  disabled = false,
}: PendingRpgUpdatesPanelProps) {
  const acceptedCount = updates.filter((update) => update.status === "accepted").length
  const applyDisabled = disabled || isApplying || acceptedCount === 0

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-background"
      aria-labelledby="pending-rpg-updates-heading"
      data-pending-rpg-updates-panel="v0"
    >
      <div className="shrink-0 border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="pending-rpg-updates-heading" className="text-sm font-semibold text-foreground">
              待处理 RPG 更新
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              待定 {countStatus(updates, "pending")} / 已接受 {acceptedCount} / 已拒绝{" "}
              {countStatus(updates, "rejected")}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={onApplyAcceptedUpdates}
            disabled={applyDisabled}
            className="h-8 gap-1.5 rounded-md px-3"
            title="应用已接受的 RPG 更新"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{isApplying ? "应用中" : "应用已接受项"}</span>
          </Button>
        </div>
      </div>

      {updates.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          <p className="text-sm text-muted-foreground">当前没有待处理的 RPG 更新。</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-3">
          {updates.map((update) => (
            <article
              key={update.id}
              className="rounded-md border border-border/80 bg-card/60 p-3"
              aria-label={`Pending RPG update ${update.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="break-all">{update.targetPath}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    <span className="rounded border border-border/70 px-1.5 py-0.5">
                      {update.strategy}
                    </span>
                    <span className="rounded border border-border/70 px-1.5 py-0.5">
                      {statusLabel(update.status)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onAcceptUpdate(update.id)}
                    disabled={disabled || update.status === "accepted" || isApplying}
                    className="h-7 gap-1 rounded-md px-2"
                    title={`接受更新 ${update.id}`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>接受</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => onRejectUpdate(update.id)}
                    disabled={disabled || update.status === "rejected" || isApplying}
                    className="h-7 gap-1 rounded-md px-2"
                    title={`拒绝更新 ${update.id}`}
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>拒绝</span>
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">原因</div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-foreground/90">{update.reason}</p>
                </div>
                <details className="rounded-md border border-border/70 bg-background/70">
                  <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    内容
                  </summary>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words px-2 pb-2 text-xs leading-5 text-foreground/90">
                    {update.content}
                  </pre>
                </details>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">引用</div>
                  {update.references.length > 0 ? (
                    <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                      {update.references.map((reference) => (
                        <li key={reference} className="break-all">
                          {reference}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">无</p>
                  )}
                </div>
                {skippedApplyReasons[update.id] && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-foreground">
                    已跳过：{skippedApplyReasons[update.id]}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {applyResult && (
        <div className="shrink-0 border-t border-border/70 bg-muted/20 px-4 py-3 text-xs" aria-live="polite">
          <div className="font-medium text-foreground">上次应用结果</div>
          <div className="mt-2 space-y-2 text-muted-foreground">
            <ResultList
              label="受影响路径"
              emptyLabel="受影响路径：无"
              items={getAffectedPaths(applyResult)}
            />
            <ResultList
              label="已应用更新"
              emptyLabel="已应用更新：无"
              items={applyResult.appliedUpdates.map((update) => `${update.id}: ${update.targetPath}`)}
            />
            <ResultList
              label="已跳过更新"
              emptyLabel="已跳过更新：无"
              items={applyResult.skippedUpdates.map((update) => `${update.id}: ${update.targetPath} - ${update.reason}`)}
            />
            <ResultList label="警告" emptyLabel="警告：无" items={applyResult.warnings} />
          </div>
        </div>
      )}
    </section>
  )
}

function ResultList({ label, emptyLabel, items }: { label: string; emptyLabel: string; items: string[] }) {
  if (items.length === 0) return <div>{emptyLabel}</div>

  return (
    <div>
      <div className="font-medium text-foreground/90">{label}</div>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function getAffectedPaths(applyResult: ApplyRpgPendingUpdatesResult): string[] {
  return [
    ...new Set(
      applyResult.appliedUpdates
        .map((update) => update.targetPath.trim().replace(/\\/g, "/").replace(/\/+/g, "/"))
        .filter(Boolean),
    ),
  ]
}

function countStatus(updates: PendingRpgUpdate[], status: PendingRpgUpdate["status"]): number {
  return updates.filter((update) => update.status === status).length
}

function statusLabel(status: PendingRpgUpdate["status"]): string {
  if (status === "accepted") return "已接受"
  if (status === "rejected") return "已拒绝"
  return "待定"
}

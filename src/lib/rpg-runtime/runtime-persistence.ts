import fs from "node:fs/promises"
import path from "node:path"
import type { ApplyRpgPendingUpdatesResult } from "./write-policy"
import type { PendingRpgUpdate } from "./update-staging"
import type { ProposedWikiUpdate } from "./state-extractor"
import type { RpgTurnRecord, RpgTurnResult } from "./turn-model"
import type { SubmittedAction } from "./types"

export type RuntimeUpdateProposalSource = "interaction"

export interface RuntimeTurnJournalEntry {
  timestamp: string
  submittedAction: SubmittedAction
  turnResult: RpgTurnResult
  turnRecord: RpgTurnRecord
  proposedUpdates: ProposedWikiUpdate[]
  pendingUpdateIds: string[]
  warnings: string[]
  proposalSource: RuntimeUpdateProposalSource
  runtimeUpdateValidation?: RuntimeUpdateValidationJournalSummary
}

export interface RuntimeUpdateValidationJournalSummary {
  acceptedUpdateIds: string[]
  rejectedUpdates: Array<{
    id: string
    targetPath: string
    issueCodes: string[]
    messages: string[]
  }>
  warningIssues: Array<{
    updateId: string
    targetPath: string
    code: string
    message: string
  }>
}

export interface RuntimeApplyJournalEntry {
  timestamp: string
  attemptedUpdateIds: string[]
  appliedUpdateIds: string[]
  remainingPendingUpdateIds: string[]
  applyResult: ApplyRpgPendingUpdatesResult
}

export interface RuntimePersistencePaths {
  projectRoot: string
  runtimeDir: string
  turnRecordsPath: string
  pendingUpdatesPath: string
  applyResultsPath: string
}

export interface LoadRpgPendingUpdatesResult {
  updates: PendingRpgUpdate[]
  warnings: string[]
}

export interface SaveRpgPendingUpdatesResult {
  warnings: string[]
}

export interface LoadRpgRuntimeSnapshotResult {
  pendingUpdates: PendingRpgUpdate[]
  warnings: string[]
}

const PENDING_UPDATES_VERSION = 1

export function createRuntimePersistencePaths(projectPath: string): RuntimePersistencePaths {
  const projectRoot = resolveProjectRoot(projectPath)
  const runtimeDir = path.resolve(projectRoot, ".llm-wiki", "runtime")

  if (!isPathInsideOrEqual(runtimeDir, projectRoot)) {
    throw new Error("Runtime persistence directory must stay inside the project root.")
  }

  return {
    projectRoot,
    runtimeDir,
    turnRecordsPath: path.join(runtimeDir, "turn-records.jsonl"),
    pendingUpdatesPath: path.join(runtimeDir, "pending-updates.json"),
    applyResultsPath: path.join(runtimeDir, "apply-results.jsonl"),
  }
}

export async function loadRpgPendingUpdates(projectPath: string): Promise<LoadRpgPendingUpdatesResult> {
  const resolved = safeCreateRuntimePersistencePaths(projectPath)
  if (!resolved.ok) return { updates: [], warnings: [resolved.warning] }

  try {
    const raw = await fs.readFile(resolved.paths.pendingUpdatesPath, "utf-8")
    const parsed = JSON.parse(raw) as unknown
    return parsePendingUpdatesPayload(parsed)
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { updates: [], warnings: [] }
    }

    return {
      updates: [],
      warnings: [`Could not load RPG pending updates: ${error instanceof Error ? error.message : String(error)}`],
    }
  }
}

export async function saveRpgPendingUpdates(
  projectPath: string,
  updates: PendingRpgUpdate[],
): Promise<SaveRpgPendingUpdatesResult> {
  const resolved = safeCreateRuntimePersistencePaths(projectPath)
  if (!resolved.ok) return { warnings: [resolved.warning] }

  await fs.mkdir(resolved.paths.runtimeDir, { recursive: true })
  const payload = JSON.stringify({ version: PENDING_UPDATES_VERSION, updates }, null, 2) + "\n"
  const tempPath = `${resolved.paths.pendingUpdatesPath}.tmp`
  await fs.writeFile(tempPath, payload, "utf-8")
  await fs.rename(tempPath, resolved.paths.pendingUpdatesPath)
  return { warnings: [] }
}

export async function appendRpgTurnJournalEntry(
  projectPath: string,
  entry: RuntimeTurnJournalEntry,
): Promise<SaveRpgPendingUpdatesResult> {
  return appendRuntimeJsonl(projectPath, "turnRecordsPath", entry)
}

export async function appendRpgApplyJournalEntry(
  projectPath: string,
  entry: RuntimeApplyJournalEntry,
): Promise<SaveRpgPendingUpdatesResult> {
  return appendRuntimeJsonl(projectPath, "applyResultsPath", entry)
}

export async function loadRpgRuntimeSnapshot(projectPath: string): Promise<LoadRpgRuntimeSnapshotResult> {
  const pending = await loadRpgPendingUpdates(projectPath)
  return {
    pendingUpdates: pending.updates,
    warnings: pending.warnings,
  }
}

async function appendRuntimeJsonl(
  projectPath: string,
  pathKey: "turnRecordsPath" | "applyResultsPath",
  entry: RuntimeTurnJournalEntry | RuntimeApplyJournalEntry,
): Promise<SaveRpgPendingUpdatesResult> {
  const resolved = safeCreateRuntimePersistencePaths(projectPath)
  if (!resolved.ok) return { warnings: [resolved.warning] }

  await fs.mkdir(resolved.paths.runtimeDir, { recursive: true })
  await fs.appendFile(resolved.paths[pathKey], JSON.stringify(entry) + "\n", "utf-8")
  return { warnings: [] }
}

function parsePendingUpdatesPayload(payload: unknown): LoadRpgPendingUpdatesResult {
  const rawUpdates = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.updates)
      ? payload.updates
      : undefined

  if (!rawUpdates) {
    return {
      updates: [],
      warnings: ["Could not load RPG pending updates: pending-updates.json did not contain an update array."],
    }
  }

  const warnings: string[] = []
  const updates = rawUpdates.flatMap((value, index) => {
    const update = parsePendingUpdate(value)
    if (update) return [update]
    warnings.push(`Skipped invalid RPG pending update at index ${index}.`)
    return []
  })

  return { updates, warnings }
}

function parsePendingUpdate(value: unknown): PendingRpgUpdate | undefined {
  if (!isRecord(value)) return undefined
  if (!isString(value.id)) return undefined
  if (!isString(value.targetPath)) return undefined
  if (!isRpgUpdateStrategy(value.strategy)) return undefined
  if (!isString(value.reason)) return undefined
  if (!isString(value.content)) return undefined
  if (!isString(value.sourceTurnId)) return undefined
  if (!Array.isArray(value.references) || !value.references.every(isString)) return undefined
  if (!isPendingStatus(value.status)) return undefined

  return {
    id: value.id,
    targetPath: value.targetPath,
    strategy: value.strategy,
    reason: value.reason,
    content: value.content,
    sourceTurnId: value.sourceTurnId,
    references: [...value.references],
    status: value.status,
  }
}

function safeCreateRuntimePersistencePaths(projectPath: string):
  | { ok: true; paths: RuntimePersistencePaths }
  | { ok: false; warning: string } {
  try {
    return { ok: true, paths: createRuntimePersistencePaths(projectPath) }
  } catch (error) {
    return {
      ok: false,
      warning: `RPG runtime persistence skipped: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

function resolveProjectRoot(projectPath: string): string {
  const normalized = projectPath.trim()
  if (!normalized) {
    throw new Error("projectPath is required.")
  }
  return path.resolve(normalized)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isRpgUpdateStrategy(value: unknown): value is ProposedWikiUpdate["strategy"] {
  return value === "overwrite" || value === "append" || value === "merge"
}

function isPendingStatus(value: unknown): value is PendingRpgUpdate["status"] {
  return value === "pending" || value === "accepted" || value === "rejected"
}

function isPathInsideOrEqual(child: string, parent: string): boolean {
  const relative = path.relative(parent, child)
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative))
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

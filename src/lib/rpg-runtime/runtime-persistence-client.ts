import { createDirectory, fileExists, readFile, writeFileAtomic } from "@/commands/fs"
import type { PendingRpgUpdate } from "./update-staging"
import {
  PENDING_UPDATES_VERSION,
  parsePendingUpdatesPayload,
  type LoadRpgPendingUpdatesResult,
  type LoadRpgRuntimeSnapshotResult,
  type RuntimeApplyJournalEntry,
  type RuntimePersistencePaths,
  type RuntimeTurnJournalEntry,
  type SaveRpgPendingUpdatesResult,
} from "./runtime-persistence-shared"

export type {
  LoadRpgPendingUpdatesResult,
  LoadRpgRuntimeSnapshotResult,
  RuntimeApplyJournalEntry,
  RuntimePersistencePaths,
  RuntimeTurnJournalEntry,
  RpgRuntimePersistenceBoundarySummary,
  RuntimeUpdateProposalAuditSummary,
  RuntimeUpdateProposalSource,
  RuntimeUpdateValidationJournalSummary,
  SaveRpgPendingUpdatesResult,
} from "./runtime-persistence-shared"

export function createRuntimePersistencePaths(projectPath: string): RuntimePersistencePaths {
  const projectRoot = resolveProjectRoot(projectPath)
  const runtimeDir = `${projectRoot}/.llm-wiki/runtime`

  return {
    projectRoot,
    runtimeDir,
    turnRecordsPath: `${runtimeDir}/turn-records.jsonl`,
    pendingUpdatesPath: `${runtimeDir}/pending-updates.json`,
    applyResultsPath: `${runtimeDir}/apply-results.jsonl`,
  }
}

export async function loadRpgPendingUpdates(projectPath: string): Promise<LoadRpgPendingUpdatesResult> {
  const resolved = safeCreateRuntimePersistencePaths(projectPath)
  if (!resolved.ok) return { updates: [], warnings: [resolved.warning] }

  try {
    if (!(await fileExists(resolved.paths.pendingUpdatesPath))) return { updates: [], warnings: [] }
    const raw = await readFile(resolved.paths.pendingUpdatesPath)
    const parsed = JSON.parse(raw) as unknown
    return parsePendingUpdatesPayload(parsed)
  } catch (error) {
    return {
      updates: [],
      warnings: [`无法加载 RPG 待处理更新：${error instanceof Error ? error.message : String(error)}`],
    }
  }
}

export async function saveRpgPendingUpdates(
  projectPath: string,
  updates: PendingRpgUpdate[],
): Promise<SaveRpgPendingUpdatesResult> {
  const resolved = safeCreateRuntimePersistencePaths(projectPath)
  if (!resolved.ok) return { warnings: [resolved.warning] }

  await createDirectory(resolved.paths.runtimeDir)
  const payload = JSON.stringify({ version: PENDING_UPDATES_VERSION, updates }, null, 2) + "\n"
  await writeFileAtomic(resolved.paths.pendingUpdatesPath, payload)
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

  await createDirectory(resolved.paths.runtimeDir)
  const path = resolved.paths[pathKey]
  const existing = (await fileExists(path)) ? await readFile(path) : ""
  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : ""
  await writeFileAtomic(path, `${existing}${separator}${JSON.stringify(entry)}\n`)
  return { warnings: [] }
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
  const normalized = projectPath.trim().replace(/\\/g, "/").replace(/\/+$/, "")
  if (!normalized) {
    throw new Error("projectPath is required.")
  }
  return normalized
}

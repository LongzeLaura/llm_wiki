import fs from "node:fs/promises"
import path from "node:path"
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

function isPathInsideOrEqual(child: string, parent: string): boolean {
  const relative = path.relative(parent, child)
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative))
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

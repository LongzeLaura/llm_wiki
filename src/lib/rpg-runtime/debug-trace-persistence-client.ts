import { createDirectory, deleteFile, fileExists, listDirectory, readFile, writeFileAtomic } from "@/commands/fs"
import type { FileNode } from "@/types/wiki"
import type { RpgRuntimeDebugTrace } from "./debug-trace"
import {
  buildRpgRuntimeDebugTraceExportFileName,
  serializeRpgRuntimeDebugTraceForExport,
  type RpgRuntimeDebugTraceExportPayload,
} from "./debug-trace-export"

export interface SaveRpgRuntimeDebugTraceOptions {
  maxTraces: number
}

export interface SaveRpgRuntimeDebugTraceResult {
  warnings: string[]
}

export interface LoadRpgRuntimeDebugTracesResult {
  traces: RpgRuntimeDebugTrace[]
  warnings: string[]
}

export interface ClearRpgRuntimeDebugTracesResult {
  warnings: string[]
}

interface RuntimeDebugTracePaths {
  projectRoot: string
  traceDir: string
}

interface PersistedTraceFile {
  fileName: string
  path: string
  trace: RpgRuntimeDebugTrace
}

export function createRuntimeDebugTracePersistencePaths(projectPath: string): RuntimeDebugTracePaths {
  const projectRoot = resolveProjectRoot(projectPath)
  return {
    projectRoot,
    traceDir: `${projectRoot}/.llm-wiki/runtime/debug-traces`,
  }
}

export async function saveRpgRuntimeDebugTrace(
  projectPath: string,
  trace: RpgRuntimeDebugTrace,
  options: SaveRpgRuntimeDebugTraceOptions,
): Promise<SaveRpgRuntimeDebugTraceResult> {
  const resolved = safeCreateRuntimeDebugTracePersistencePaths(projectPath)
  if (!resolved.ok) return { warnings: [resolved.warning] }

  try {
    await createDirectory(resolved.paths.traceDir)
    const fileName = buildRpgRuntimeDebugTraceExportFileName(trace)
    await writeFileAtomic(
      `${resolved.paths.traceDir}/${fileName}`,
      serializeRpgRuntimeDebugTraceForExport(trace),
    )
    const pruneWarnings = await pruneOldDebugTraces(resolved.paths.traceDir, options.maxTraces)
    return { warnings: pruneWarnings }
  } catch (error) {
    return {
      warnings: [`无法保存 RPG runtime 调试 trace：${error instanceof Error ? error.message : String(error)}`],
    }
  }
}

export async function loadRpgRuntimeDebugTraces(projectPath: string): Promise<LoadRpgRuntimeDebugTracesResult> {
  const resolved = safeCreateRuntimeDebugTracePersistencePaths(projectPath)
  if (!resolved.ok) return { traces: [], warnings: [resolved.warning] }

  try {
    if (!(await fileExists(resolved.paths.traceDir))) return { traces: [], warnings: [] }
    const loaded = await loadPersistedTraceFiles(resolved.paths.traceDir)
    return {
      traces: sortPersistedTraceFilesNewestFirst(loaded.files).map((entry) => entry.trace),
      warnings: loaded.warnings,
    }
  } catch (error) {
    return {
      traces: [],
      warnings: [`无法加载 RPG runtime 调试 trace：${error instanceof Error ? error.message : String(error)}`],
    }
  }
}

export async function clearRpgRuntimeDebugTraces(projectPath: string): Promise<ClearRpgRuntimeDebugTracesResult> {
  const resolved = safeCreateRuntimeDebugTracePersistencePaths(projectPath)
  if (!resolved.ok) return { warnings: [resolved.warning] }

  try {
    if (!(await fileExists(resolved.paths.traceDir))) return { warnings: [] }
    const entries = await listDirectory(resolved.paths.traceDir)
    const warnings: string[] = []

    for (const entry of entries.filter(isTraceJsonFileNode)) {
      try {
        await deleteFile(`${resolved.paths.traceDir}/${entry.name}`)
      } catch (error) {
        warnings.push(`无法删除 RPG runtime 调试 trace ${entry.name}：${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { warnings }
  } catch (error) {
    return {
      warnings: [`无法清除 RPG runtime 调试 trace：${error instanceof Error ? error.message : String(error)}`],
    }
  }
}

async function pruneOldDebugTraces(traceDir: string, maxTraces: number): Promise<string[]> {
  const retention = Math.max(1, Math.floor(maxTraces))
  const loaded = await loadPersistedTraceFiles(traceDir)
  const warnings = [...loaded.warnings]
  const sorted = sortPersistedTraceFilesNewestFirst(loaded.files)
  const excess = sorted.slice(retention)

  for (const entry of excess) {
    try {
      await deleteFile(entry.path)
    } catch (error) {
      warnings.push(`无法裁剪旧的 RPG runtime 调试 trace ${entry.fileName}：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return warnings
}

async function loadPersistedTraceFiles(traceDir: string): Promise<{ files: PersistedTraceFile[]; warnings: string[] }> {
  const entries = await listDirectory(traceDir)
  const files: PersistedTraceFile[] = []
  const warnings: string[] = []

  for (const entry of entries.filter(isTraceJsonFileNode)) {
    const path = `${traceDir}/${entry.name}`
    try {
      const raw = await readFile(path)
      const payload = JSON.parse(raw) as unknown
      const trace = parseRuntimeDebugTracePayload(payload)
      if (!trace) {
        warnings.push(`Ignored invalid RPG runtime debug trace file: ${entry.name}`)
        continue
      }
      files.push({ fileName: entry.name, path, trace })
    } catch (error) {
      warnings.push(`Ignored unreadable RPG runtime debug trace file ${entry.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { files, warnings }
}

function parseRuntimeDebugTracePayload(payload: unknown): RpgRuntimeDebugTrace | null {
  if (!payload || typeof payload !== "object") return null
  const candidate = payload as Partial<RpgRuntimeDebugTraceExportPayload>
  const trace = candidate.trace
  if (candidate.version !== 1 || !trace || typeof trace !== "object") return null
  if (typeof trace.traceId !== "string" || typeof trace.startedAt !== "string") return null
  return trace
}

function sortPersistedTraceFilesNewestFirst(files: PersistedTraceFile[]): PersistedTraceFile[] {
  return [...files].sort((a, b) => {
    const startedAtDelta = sortableTime(b.trace.startedAt) - sortableTime(a.trace.startedAt)
    if (startedAtDelta !== 0) return startedAtDelta
    return b.fileName.localeCompare(a.fileName)
  })
}

function sortableTime(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function isTraceJsonFileNode(entry: FileNode): boolean {
  return !entry.is_dir && /^rpg-runtime-trace-[a-z0-9._-]+\.json$/i.test(entry.name)
}

function safeCreateRuntimeDebugTracePersistencePaths(projectPath: string):
  | { ok: true; paths: RuntimeDebugTracePaths }
  | { ok: false; warning: string } {
  try {
    return { ok: true, paths: createRuntimeDebugTracePersistencePaths(projectPath) }
  } catch (error) {
    return {
      ok: false,
      warning: `RPG runtime debug trace persistence skipped: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

function resolveProjectRoot(projectPath: string): string {
  const normalized = projectPath.trim().replace(/\\/g, "/").replace(/\/+$/, "")
  if (!normalized) throw new Error("projectPath is required.")
  return normalized
}

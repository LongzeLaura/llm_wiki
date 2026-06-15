import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearRpgRuntimeDebugTraces,
  createRuntimeDebugTracePersistencePaths,
  loadRpgRuntimeDebugTraces,
  saveRpgRuntimeDebugTrace,
} from "./rpg-runtime/debug-trace-persistence-client"
import { serializeRpgRuntimeDebugTraceForExport } from "./rpg-runtime/debug-trace-export"
import type { RpgRuntimeDebugTrace } from "./rpg-runtime/debug-trace"

const fsMock = vi.hoisted(() => ({
  files: new Map<string, string>(),
  directories: new Set<string>(),
  deleted: [] as string[],
}))

vi.mock("@/commands/fs", () => ({
  createDirectory: vi.fn(async (path: string) => {
    fsMock.directories.add(path)
  }),
  deleteFile: vi.fn(async (path: string) => {
    fsMock.deleted.push(path)
    fsMock.files.delete(path)
  }),
  fileExists: vi.fn(async (path: string) => fsMock.files.has(path) || fsMock.directories.has(path)),
  listDirectory: vi.fn(async (path: string) => listMockDirectory(path)),
  readFile: vi.fn(async (path: string) => {
    const value = fsMock.files.get(path)
    if (value === undefined) throw new Error(`missing ${path}`)
    return value
  }),
  writeFileAtomic: vi.fn(async (path: string, contents: string) => {
    fsMock.files.set(path, contents)
  }),
}))

describe("RPG runtime debug trace persistence client", () => {
  beforeEach(() => {
    fsMock.files.clear()
    fsMock.directories.clear()
    fsMock.deleted = []
  })

  it("saves debug trace JSON under .llm-wiki/runtime/debug-traces without writing wiki", async () => {
    const result = await saveRpgRuntimeDebugTrace(
      "C:\\tmp\\rpg-project\\",
      sampleTrace("trace-one", "2026-06-13T00:00:00.000Z"),
      { maxTraces: 5 },
    )

    expect(result.warnings).toEqual([])
    expect(createRuntimeDebugTracePersistencePaths("C:\\tmp\\rpg-project\\").traceDir).toBe(
      "C:/tmp/rpg-project/.llm-wiki/runtime/debug-traces",
    )
    expect(fsMock.directories.has("C:/tmp/rpg-project/.llm-wiki/runtime/debug-traces")).toBe(true)
    expect([...fsMock.files.keys()]).toEqual([
      "C:/tmp/rpg-project/.llm-wiki/runtime/debug-traces/rpg-runtime-trace-trace-one.json",
    ])
    expect([...fsMock.files.keys()].some((path) => path.includes("/wiki/"))).toBe(false)
  })

  it("loads valid payloads newest first and warns on bad JSON", async () => {
    const traceDir = "C:/tmp/rpg-project/.llm-wiki/runtime/debug-traces"
    fsMock.directories.add(traceDir)
    fsMock.files.set(
      `${traceDir}/rpg-runtime-trace-old.json`,
      serializeRpgRuntimeDebugTraceForExport(sampleTrace("old", "2026-06-13T00:00:00.000Z")),
    )
    fsMock.files.set(
      `${traceDir}/rpg-runtime-trace-new.json`,
      serializeRpgRuntimeDebugTraceForExport(sampleTrace("new", "2026-06-13T00:00:02.000Z")),
    )
    fsMock.files.set(`${traceDir}/rpg-runtime-trace-bad.json`, "{not json")

    const result = await loadRpgRuntimeDebugTraces("C:/tmp/rpg-project")

    expect(result.traces.map((trace) => trace.traceId)).toEqual(["new", "old"])
    expect(result.warnings.join("\n")).toContain("Ignored unreadable RPG runtime debug trace file")
  })

  it("prunes old traces beyond maxTraces using startedAt and filename ordering", async () => {
    await saveRpgRuntimeDebugTrace("C:/tmp/rpg-project", sampleTrace("one", "2026-06-13T00:00:00.000Z"), {
      maxTraces: 2,
    })
    await saveRpgRuntimeDebugTrace("C:/tmp/rpg-project", sampleTrace("two", "2026-06-13T00:00:01.000Z"), {
      maxTraces: 2,
    })
    await saveRpgRuntimeDebugTrace("C:/tmp/rpg-project", sampleTrace("three", "2026-06-13T00:00:02.000Z"), {
      maxTraces: 2,
    })

    const result = await loadRpgRuntimeDebugTraces("C:/tmp/rpg-project")

    expect(result.traces.map((trace) => trace.traceId)).toEqual(["three", "two"])
    expect(fsMock.deleted).toContain("C:/tmp/rpg-project/.llm-wiki/runtime/debug-traces/rpg-runtime-trace-one.json")
  })

  it("clears only trace JSON files inside debug-traces", async () => {
    const traceDir = "C:/tmp/rpg-project/.llm-wiki/runtime/debug-traces"
    fsMock.directories.add(traceDir)
    fsMock.files.set(
      `${traceDir}/rpg-runtime-trace-one.json`,
      serializeRpgRuntimeDebugTraceForExport(sampleTrace("one", "2026-06-13T00:00:00.000Z")),
    )
    fsMock.files.set(`${traceDir}/notes.json`, "{}")
    fsMock.files.set("C:/tmp/rpg-project/wiki/current-scene/scene_state.md", "# Current Scene")

    const result = await clearRpgRuntimeDebugTraces("C:/tmp/rpg-project")

    expect(result.warnings).toEqual([])
    expect(fsMock.files.has(`${traceDir}/rpg-runtime-trace-one.json`)).toBe(false)
    expect(fsMock.files.has(`${traceDir}/notes.json`)).toBe(true)
    expect(fsMock.files.has("C:/tmp/rpg-project/wiki/current-scene/scene_state.md")).toBe(true)
    expect(fsMock.deleted).toEqual([`${traceDir}/rpg-runtime-trace-one.json`])
  })

  it("returns warnings instead of throwing when projectPath is empty", async () => {
    await expect(
      saveRpgRuntimeDebugTrace(" ", sampleTrace("one", "2026-06-13T00:00:00.000Z"), { maxTraces: 5 }),
    ).resolves.toEqual({
      warnings: ["RPG runtime debug trace persistence skipped: projectPath is required."],
    })
  })
})

function sampleTrace(traceId: string, startedAt: string): RpgRuntimeDebugTrace {
  return {
    traceId,
    turnId: traceId,
    submittedActionId: `action-${traceId}`,
    submittedActionText: `Action ${traceId}`,
    status: "succeeded",
    startedAt,
    endedAt: startedAt,
    steps: [],
    warnings: [],
  }
}

function listMockDirectory(path: string) {
  const prefix = `${path}/`
  return [...fsMock.files.keys()]
    .filter((filePath) => filePath.startsWith(prefix))
    .map((filePath) => filePath.slice(prefix.length))
    .filter((relativePath) => relativePath && !relativePath.includes("/"))
    .map((name) => ({
      name,
      path: `${path}/${name}`,
      is_dir: false,
    }))
}

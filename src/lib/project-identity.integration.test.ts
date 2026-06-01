import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createTempProject, readFileRaw, realFs } from "@/test-helpers/fs-temp"

vi.mock("@/commands/fs", () => realFs)
vi.mock("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    get: async () => undefined,
    set: async () => undefined,
  }),
}))

import { ensureProjectId, loadProjectMode, saveProjectMode } from "./project-identity"

let tmp: { path: string; cleanup: () => Promise<void> }

beforeEach(async () => {
  tmp = await createTempProject("project-identity")
})

afterEach(async () => {
  await tmp.cleanup()
})

describe("project mode persistence", () => {
  it("stores the selected project mode in .llm-wiki/project.json", async () => {
    const id = await ensureProjectId(tmp.path)
    await saveProjectMode(tmp.path, "chemical")

    const raw = await readFileRaw(`${tmp.path}/.llm-wiki/project.json`)
    expect(raw).toContain(`\"id\": \"${id}\"`)
    expect(raw).toContain('\"mode\": \"chemical\"')
    expect(await loadProjectMode(tmp.path)).toBe("chemical")
  })

  it("returns null for legacy projects that do not have a persisted mode yet", async () => {
    await ensureProjectId(tmp.path)
    expect(await loadProjectMode(tmp.path)).toBeNull()
  })
})

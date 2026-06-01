/**
 * Project identity: stable UUID per project + global registry mapping
 * `UUID -> current filesystem path`.
 *
 * Why: absolute paths are unstable (users move / rename project folders).
 * Queue tasks reference projects by UUID and look up the current path
 * via the registry at run time, so a moved folder doesn't orphan tasks.
 *
 * Storage:
 * - Per-project identity: `{project}/.llm-wiki/project.json`
 *     `{ "id": "<uuid>", "createdAt": <ms>, "mode"?: "default" | "chemical" }`
 * - Global registry: Tauri plugin-store `app-state.json` key `projectRegistry`
 *     `{ [id]: { id, path, name, lastOpened } }`
 */

import { load } from "@tauri-apps/plugin-store"
import { readFile, writeFile } from "@/commands/fs"
import { normalizePath } from "@/lib/path-utils"
import { normalizeProjectMode, type ProjectMode } from "@/lib/project-mode"

const STORE_NAME = "app-state.json"
const REGISTRY_KEY = "projectRegistry"

export interface ProjectIdentity {
  id: string
  createdAt: number
  mode?: ProjectMode
}

export interface ProjectRegistryEntry {
  id: string
  path: string
  name: string
  lastOpened: number
}

export type ProjectRegistry = Record<string, ProjectRegistryEntry>

function identityPath(projectPath: string): string {
  return `${normalizePath(projectPath)}/.llm-wiki/project.json`
}

async function loadProjectIdentity(projectPath: string): Promise<ProjectIdentity | null> {
  try {
    const raw = await readFile(identityPath(projectPath))
    const parsed = JSON.parse(raw) as ProjectIdentity
    if (parsed?.id && typeof parsed.id === "string") {
      return {
        ...parsed,
        mode: normalizeProjectMode(parsed.mode) ?? undefined,
      }
    }
  } catch {
    // missing or corrupt
  }
  return null
}

async function writeProjectIdentity(projectPath: string, identity: ProjectIdentity): Promise<void> {
  await writeFile(identityPath(projectPath), JSON.stringify(identity, null, 2))
}

export async function ensureProjectId(projectPath: string): Promise<string> {
  const existing = await loadProjectIdentity(projectPath)
  if (existing?.id) {
    return existing.id
  }

  const identity: ProjectIdentity = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  }

  try {
    await writeProjectIdentity(projectPath, identity)
  } catch (err) {
    console.warn("[project-identity] failed to write identity file:", err)
  }

  return identity.id
}

export async function loadProjectMode(projectPath: string): Promise<ProjectMode | null> {
  const identity = await loadProjectIdentity(projectPath)
  return identity?.mode ?? null
}

export async function saveProjectMode(projectPath: string, mode: ProjectMode): Promise<void> {
  const existing = await loadProjectIdentity(projectPath)
  const identity: ProjectIdentity = existing ?? {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  }
  identity.mode = mode
  await writeProjectIdentity(projectPath, identity)
}

async function getStore() {
  return load(STORE_NAME, { autoSave: true, defaults: {} })
}

export async function loadRegistry(): Promise<ProjectRegistry> {
  try {
    const store = await getStore()
    const registry = await store.get<ProjectRegistry>(REGISTRY_KEY)
    return registry ?? {}
  } catch {
    return {}
  }
}

async function saveRegistry(registry: ProjectRegistry): Promise<void> {
  const store = await getStore()
  await store.set(REGISTRY_KEY, registry)
}

export async function upsertProjectInfo(
  id: string,
  path: string,
  name: string,
): Promise<void> {
  const registry = await loadRegistry()
  registry[id] = {
    id,
    path: normalizePath(path),
    name,
    lastOpened: Date.now(),
  }
  await saveRegistry(registry)
}

export async function getProjectPathById(id: string): Promise<string | null> {
  const registry = await loadRegistry()
  return registry[id]?.path ?? null
}

export async function getProjectIdByPath(path: string): Promise<string | null> {
  const normalized = normalizePath(path)
  const registry = await loadRegistry()
  for (const entry of Object.values(registry)) {
    if (entry.path === normalized) return entry.id
  }
  return null
}

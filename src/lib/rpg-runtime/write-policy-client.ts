import { createDirectory, fileExists, readFile, writeFileAtomic } from "@/commands/fs"
import { validateRpgRuntimeUpdateTarget } from "../rpg-interactions/runtime/wiki-update-policy"
import type { RpgUpdateStrategy } from "./state-extractor"
import type { PendingRpgUpdate } from "./update-staging"
import {
  appendRuntimeSection,
  createEmptyProjectPathApplyResult,
  formatWriteContent,
  mergeRuntimeSections,
  normalizeWikiPathForDisplay,
  type AppliedRpgUpdate,
  type ApplyRpgPendingUpdatesInput,
  type ApplyRpgPendingUpdatesResult,
  type SkippedRpgUpdate,
} from "./write-policy-shared"

export type {
  AppliedRpgUpdate,
  ApplyRpgPendingUpdatesInput,
  ApplyRpgPendingUpdatesResult,
  SkippedRpgUpdate,
} from "./write-policy-shared"

type WriteTargetValidation =
  | { ok: true; targetPath: string; strategy: RpgUpdateStrategy; filePath: string }
  | { ok: false; targetPath: string; reason: string }

export async function applyRpgPendingUpdates(
  input: ApplyRpgPendingUpdatesInput,
): Promise<ApplyRpgPendingUpdatesResult> {
  const projectRoot = normalizeProjectRoot(input.projectPath)
  if (!projectRoot) return createEmptyProjectPathApplyResult(input.updates)

  const appliedUpdates: AppliedRpgUpdate[] = []
  const skippedUpdates: SkippedRpgUpdate[] = []
  const warnings: string[] = []

  for (const update of input.updates) {
    const targetPath = normalizeWikiPathForDisplay(update.targetPath)

    if (update.status !== "accepted") {
      skippedUpdates.push({
        id: update.id,
        targetPath,
        reason: `update status is "${update.status}", not "accepted".`,
      })
      continue
    }

    const validation = validateRpgRuntimeWriteTarget(update, projectRoot)
    if (!validation.ok) {
      skippedUpdates.push({
        id: update.id,
        targetPath: validation.targetPath,
        reason: validation.reason,
      })
      warnings.push(`Skipped RPG pending update "${update.id}": ${validation.reason}`)
      continue
    }

    try {
      await writeRuntimeUpdate(validation.filePath, update.content, validation.strategy, validation.targetPath)
      appliedUpdates.push({
        id: update.id,
        targetPath: validation.targetPath,
        strategy: validation.strategy,
        status: "applied",
      })
    } catch (error) {
      const reason = `failed to write update: ${error instanceof Error ? error.message : String(error)}`
      skippedUpdates.push({
        id: update.id,
        targetPath: validation.targetPath,
        reason,
      })
      warnings.push(`Skipped RPG pending update "${update.id}": ${reason}`)
    }
  }

  return { appliedUpdates, skippedUpdates, warnings }
}

function validateRpgRuntimeWriteTarget(
  update: PendingRpgUpdate,
  projectRoot: string,
): WriteTargetValidation {
  const targetPath = normalizeWikiPathForDisplay(update.targetPath)
  const policy = validateRpgRuntimeUpdateTarget(update.targetPath, update.strategy)
  if (!policy.ok) {
    return { ok: false, targetPath, reason: policy.reason }
  }

  if (!isSafeProjectRelativeWikiPath(policy.targetPath)) {
    return { ok: false, targetPath: policy.targetPath, reason: `targetPath "${policy.targetPath}" escapes project wiki directory.` }
  }

  return {
    ok: true,
    targetPath: policy.targetPath,
    strategy: policy.strategy,
    filePath: joinClientPath(projectRoot, policy.targetPath),
  }
}

async function writeRuntimeUpdate(
  filePath: string,
  content: string,
  strategy: RpgUpdateStrategy,
  targetPath: string,
): Promise<void> {
  await createDirectory(clientDirname(filePath))

  if (strategy === "overwrite") {
    await writeFileAtomic(filePath, formatWriteContent(content))
    return
  }

  if (strategy === "append" || strategy === "merge") {
    const existing = await readOptionalFile(filePath)
    const nextContent = strategy === "append" ? appendRuntimeSection(existing, content) : mergeRuntimeSections(existing, content, targetPath)
    await writeFileAtomic(filePath, nextContent)
  }
}

async function readOptionalFile(filePath: string): Promise<string> {
  if (!(await fileExists(filePath))) return ""
  return readFile(filePath)
}

function normalizeProjectRoot(projectPath: string): string {
  return projectPath.trim().replace(/\\/g, "/").replace(/\/+$/, "")
}

function joinClientPath(root: string, relativePath: string): string {
  return `${root}/${relativePath.split("/").filter(Boolean).join("/")}`
}

function clientDirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").replace(/\/+$/, "")
  const index = normalized.lastIndexOf("/")
  return index > 0 ? normalized.slice(0, index) : normalized
}

function isSafeProjectRelativeWikiPath(targetPath: string): boolean {
  const parts = targetPath.split("/")
  return parts[0] === "wiki" && parts.every((part) => part.length > 0 && part !== "." && part !== "..")
}

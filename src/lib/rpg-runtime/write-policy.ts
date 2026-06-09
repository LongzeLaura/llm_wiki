import fs from "node:fs/promises"
import path from "node:path"
import { validateRpgRuntimeUpdateTarget } from "../rpg-interactions/runtime/wiki-update-policy"
import { mergeRpgSections } from "../rpg-section-merge"
import type { RpgUpdateStrategy } from "./state-extractor"
import type { PendingRpgUpdate } from "./update-staging"

export interface ApplyRpgPendingUpdatesInput {
  projectPath: string
  updates: PendingRpgUpdate[]
}

export interface AppliedRpgUpdate {
  id: string
  targetPath: string
  strategy: RpgUpdateStrategy
  status: "applied"
}

export interface SkippedRpgUpdate {
  id: string
  targetPath: string
  reason: string
}

export interface ApplyRpgPendingUpdatesResult {
  appliedUpdates: AppliedRpgUpdate[]
  skippedUpdates: SkippedRpgUpdate[]
  warnings: string[]
}

type WriteTargetValidation =
  | { ok: true; targetPath: string; strategy: RpgUpdateStrategy; absolutePath: string }
  | { ok: false; targetPath: string; reason: string }

export async function applyRpgPendingUpdates(
  input: ApplyRpgPendingUpdatesInput,
): Promise<ApplyRpgPendingUpdatesResult> {
  const appliedUpdates: AppliedRpgUpdate[] = []
  const skippedUpdates: SkippedRpgUpdate[] = []
  const warnings: string[] = []
  const projectPath = input.projectPath.trim()

  if (!projectPath) {
    warnings.push("Skipped RPG pending updates: projectPath is required.")
    return {
      appliedUpdates,
      skippedUpdates: input.updates.map((update) => ({
        id: update.id,
        targetPath: normalizeWikiPathForDisplay(update.targetPath),
        reason: "projectPath is required.",
      })),
      warnings,
    }
  }

  const projectRoot = path.resolve(projectPath)
  const wikiRoot = path.resolve(projectRoot, "wiki")

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

    const validation = validateRpgRuntimeWriteTarget(update, projectRoot, wikiRoot)
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
      await writeRuntimeUpdate(validation.absolutePath, update.content, validation.strategy, validation.targetPath)
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
  wikiRoot: string,
): WriteTargetValidation {
  const targetPath = normalizeWikiPathForDisplay(update.targetPath)

  const policy = validateRpgRuntimeUpdateTarget(update.targetPath, update.strategy)
  if (!policy.ok) {
    return { ok: false, targetPath, reason: policy.reason }
  }

  const absolutePath = path.resolve(projectRoot, ...policy.targetPath.split("/"))
  if (!isPathInsideOrEqual(absolutePath, wikiRoot)) {
    return { ok: false, targetPath: policy.targetPath, reason: `targetPath "${policy.targetPath}" escapes project wiki directory.` }
  }

  return { ok: true, targetPath: policy.targetPath, strategy: policy.strategy, absolutePath }
}

async function writeRuntimeUpdate(
  absolutePath: string,
  content: string,
  strategy: RpgUpdateStrategy,
  targetPath: string,
): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })

  if (strategy === "overwrite") {
    await fs.writeFile(absolutePath, formatWriteContent(content), "utf-8")
    return
  }

  if (strategy === "append" || strategy === "merge") {
    const existing = await readOptionalFile(absolutePath)
    const nextContent = strategy === "append" ? appendSection(existing, content) : mergeRuntimeSections(existing, content, targetPath)
    await fs.writeFile(absolutePath, nextContent, "utf-8")
  }
}

async function readOptionalFile(absolutePath: string): Promise<string> {
  try {
    return await fs.readFile(absolutePath, "utf-8")
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return ""
    throw error
  }
}

function appendSection(existing: string, content: string): string {
  const nextContent = content.trim()
  if (!existing.trim()) return formatWriteContent(nextContent)
  return `${existing.trimEnd()}\n\n${nextContent}\n`
}

function mergeRuntimeSections(existing: string, content: string, targetPath: string): string {
  const nextContent = content.trim()
  if (!existing.trim()) return formatWriteContent(nextContent)

  const result = mergeRpgSections(nextContent, {
    pagePath: targetPath,
    existingContent: existing,
    incomingContent: nextContent,
    preserveExistingSections: true,
    preserveExistingFrontmatter: true,
    preserveExistingBodyPrefix: true,
  })
  if (result.warnings.length > 0) {
    console.warn(`[rpg-runtime-write] section merge for ${targetPath}: ${result.warnings.join(" | ")}`)
  }
  return formatWriteContent(result.content)
}

function formatWriteContent(content: string): string {
  return `${content.trimEnd()}\n`
}

function normalizeWikiPathForDisplay(targetPath: string): string {
  return targetPath.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/^\/+/, "")
}

function isPathInsideOrEqual(child: string, parent: string): boolean {
  const relative = path.relative(parent, child)
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative))
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

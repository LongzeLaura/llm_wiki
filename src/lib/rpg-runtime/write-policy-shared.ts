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

export function createEmptyProjectPathApplyResult(
  updates: PendingRpgUpdate[],
): ApplyRpgPendingUpdatesResult {
  return {
    appliedUpdates: [],
    skippedUpdates: updates.map((update) => ({
      id: update.id,
      targetPath: normalizeWikiPathForDisplay(update.targetPath),
      reason: "projectPath is required.",
    })),
    warnings: ["Skipped RPG pending updates: projectPath is required."],
  }
}

export function appendRuntimeSection(existing: string, content: string): string {
  const nextContent = content.trim()
  if (!existing.trim()) return formatWriteContent(nextContent)
  return `${existing.trimEnd()}\n\n${nextContent}\n`
}

export function mergeRuntimeSections(existing: string, content: string, targetPath: string): string {
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

export function formatWriteContent(content: string): string {
  return `${content.trimEnd()}\n`
}

export function normalizeWikiPathForDisplay(targetPath: string): string {
  return targetPath.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/^\/+/, "")
}

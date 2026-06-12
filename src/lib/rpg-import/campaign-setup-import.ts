import { createDirectory, fileExists, readFile, writeFile } from "@/commands/fs"
import { getFileName, getFileStem, normalizePath } from "@/lib/path-utils"
import {
  CAMPAIGN_SETUP_IMPORT_TARGET_SLOTS,
  campaignSetupSourceHasAbilityLikeInput,
  campaignSetupSourceHasFuturePressure,
  hasCampaignSetupExplicitBootstrapOption,
  isCampaignSetupImportTargetSlot,
  resolveCampaignSetupImportSlot,
  stripCampaignSetupFuturePressureText,
  type CampaignSetupImportTargetSlot,
  type CampaignSetupSlotDefinition,
} from "@/lib/rpg-interactions/campaign-setup"
import { makeQuerySlug } from "@/lib/wiki-filename"
import type { RpgImportModeSpec, RpgImportRequest, RpgImportResult } from "./types"

export {
  CAMPAIGN_SETUP_IMPORT_TARGET_SLOTS,
  getCampaignSetupImportTargetPath,
  type CampaignSetupImportTargetSlot,
} from "@/lib/rpg-interactions/campaign-setup"

interface CampaignSetupSource {
  text: string
  sourceFileName: string
  sourcePath: string
  sourceOrigin: "sourceText" | "sourcePath"
  sourceTextTakesPriority: boolean
}

interface CampaignSetupImportContext {
  slot: CampaignSetupSlotDefinition
  source: CampaignSetupSource
  importedAt: string
  rawImportPath: string
  sourceAnchor: string
  explicitBootstrap: boolean
  omittedFuturePressure: boolean
}

interface CampaignSetupPreparedTarget {
  content: string
  skipReason?: string
}

export async function runCampaignSetupImport(
  request: RpgImportRequest,
): Promise<RpgImportResult> {
  const targetSlot = resolveCampaignSetupTargetSlot(request.targetSlot)
  const source = await resolveCampaignSetupSource(request)
  const slot = resolveCampaignSetupSlot(targetSlot, source, request.options)
  const importedAt = resolveImportTimestamp(request.options?.now)
  const rawImportPath = buildRawSourceImportPath(source.sourceFileName, slot.slotId)
  const sourceAnchor = buildSourceAnchor(slot.slotId, rawImportPath)
  const explicitBootstrap = hasCampaignSetupExplicitBootstrapOption(request.options)
  const omittedFuturePressure = campaignSetupSourceHasFuturePressure(source.text)
  const context: CampaignSetupImportContext = {
    slot,
    source,
    importedAt,
    rawImportPath,
    sourceAnchor,
    explicitBootstrap,
    omittedFuturePressure,
  }

  const writtenPaths: string[] = []
  const warnings = buildInitialWarnings(context)
  const skipped: string[] = []
  const reviewItems: unknown[] = [
    buildCampaignSetupReviewItem(context, "review_import"),
  ]

  await writeProjectRelativeFile(
    request.projectPath,
    rawImportPath,
    buildRawSourceAnchorFile(context),
  )
  writtenPaths.push(rawImportPath)

  const preparedTarget = prepareCampaignSetupTarget(context)
  if (preparedTarget.skipReason) {
    skipped.push(slot.targetPath)
    warnings.push(preparedTarget.skipReason)
    reviewItems.push(buildCampaignSetupReviewItem(context, "skipped_target", preparedTarget.skipReason))
    return {
      mode: "campaign_setup_import",
      writtenPaths,
      reviewItems,
      warnings,
      skipped,
    }
  }

  const writeResult = await writeCampaignSetupTarget(
    request.projectPath,
    slot.targetPath,
    preparedTarget.content,
    context,
    request.options,
  )

  if (writeResult.ok) {
    writtenPaths.push(slot.targetPath)
    if (writeResult.warning) warnings.push(writeResult.warning)
  } else {
    skipped.push(slot.targetPath)
    warnings.push(writeResult.reason)
    reviewItems.push(buildCampaignSetupReviewItem(context, "manual_overwrite_required", writeResult.reason))
  }

  return {
    mode: "campaign_setup_import",
    writtenPaths,
    reviewItems,
    warnings,
    skipped,
  }
}

export const campaignSetupImportModeSpec: RpgImportModeSpec = {
  mode: "campaign_setup_import",
  run: runCampaignSetupImport,
}

function resolveCampaignSetupTargetSlot(targetSlot: string | undefined): CampaignSetupImportTargetSlot {
  if (!targetSlot) {
    throw new Error("campaign_setup_import requires targetSlot.")
  }
  if (!isCampaignSetupImportTargetSlot(targetSlot)) {
    throw new Error(
      `campaign_setup_import targetSlot "${targetSlot}" is not supported. Supported targetSlot values: ${CAMPAIGN_SETUP_IMPORT_TARGET_SLOTS.join(", ")}.`,
    )
  }
  return targetSlot
}

async function resolveCampaignSetupSource(request: RpgImportRequest): Promise<CampaignSetupSource> {
  const hasSourceText = request.sourceText !== undefined
  const hasSourcePath = Boolean(request.sourcePath)

  if (!hasSourceText && !hasSourcePath) {
    throw new Error("campaign_setup_import requires sourceText or sourcePath.")
  }

  const text = hasSourceText ? request.sourceText ?? "" : await readFile(request.sourcePath as string)
  const sourceFileName = request.sourceFileName
    || (request.sourcePath ? getFileName(request.sourcePath) : "inline-campaign-setup.md")
  const sourcePath = request.sourcePath
    ? normalizePath(request.sourcePath)
    : sourceFileName

  return {
    text,
    sourceFileName,
    sourcePath,
    sourceOrigin: hasSourceText ? "sourceText" : "sourcePath",
    sourceTextTakesPriority: hasSourceText && hasSourcePath,
  }
}

function resolveCampaignSetupSlot(
  slotId: CampaignSetupImportTargetSlot,
  source: CampaignSetupSource,
  options: Record<string, unknown> | undefined,
): CampaignSetupSlotDefinition {
  return resolveCampaignSetupImportSlot(slotId, { sourceFileName: source.sourceFileName, options })
}

function buildInitialWarnings(context: CampaignSetupImportContext): string[] {
  const warnings = [
    `campaign_setup_import writes campaign bootstrap material only; it is not ordinary source ingest or runtime update apply.`,
  ]

  if (context.slot.slotId === "current_scene" && !context.explicitBootstrap) {
    warnings.push(
      "current_scene bootstrap requires options.explicitBootstrap === true or options.manualConfirm === true before writing wiki/current-scene/scene_state.md.",
    )
  }

  if (context.slot.slotId !== "player_abilities" && campaignSetupSourceHasAbilityLikeInput(context.source.text)) {
    warnings.push(
      "Input appears to contain player abilities, skills, limits, costs, or availability. Review for wiki/player/abilities.md; campaign_setup_import v0 does not split those details and must not route them to wiki/rules/.",
    )
  }

  if (context.omittedFuturePressure) {
    warnings.push(
      "Input appears to contain future pressure, possible futures, foreshadowing, or untriggered reveals. Stage F keeps that material out of wiki/events/ and review should route it to plot-arcs or outlines as appropriate.",
    )
  }

  return warnings
}

function prepareCampaignSetupTarget(context: CampaignSetupImportContext): CampaignSetupPreparedTarget {
  if (context.slot.slotId === "current_scene" && !context.explicitBootstrap) {
    return {
      content: "",
      skipReason: "Skipped wiki/current-scene/scene_state.md: campaign_setup_import current_scene requires explicitBootstrap or manualConfirm.",
    }
  }

  if (context.slot.slotId === "events_prologue") {
    const happenedText = stripCampaignSetupFuturePressureText(context.source.text).trim()
    if (!happenedText) {
      return {
        content: "",
        skipReason: "Skipped wiki/events/prologue.md: source contains no already-happened prologue facts after future-pressure filtering.",
      }
    }
  }

  return {
    content: buildCanonicalCampaignSetupDoc(context),
  }
}

function buildCanonicalCampaignSetupDoc(context: CampaignSetupImportContext): string {
  const body = canonicalCampaignSetupBody(context)
  const lines = [
    "---",
    `type: ${yamlString(context.slot.contentType)}`,
    `title: ${yamlString(context.slot.title)}`,
    `slot_id: ${yamlString(context.slot.slotId)}`,
    `import_mode: "campaign_setup_import"`,
    `source_file_name: ${yamlString(context.source.sourceFileName)}`,
    `source_path: ${yamlString(context.source.sourcePath)}`,
    `source_anchor: ${yamlString(context.sourceAnchor)}`,
    `source_import_path: ${yamlString(context.rawImportPath)}`,
    `imported_at: ${yamlString(context.importedAt)}`,
    `write_policy: ${yamlString(context.slot.writePolicy)}`,
    `review_policy: ${yamlString(context.slot.reviewPolicy)}`,
    `canonicalization_policy: ${yamlString(context.slot.canonicalizationNote)}`,
    `source_origin: ${yamlString(context.source.sourceOrigin)}`,
    `source_text_takes_priority: ${context.source.sourceTextTakesPriority ? "true" : "false"}`,
    `campaign_bootstrap: true`,
    `explicit_bootstrap: ${context.explicitBootstrap ? "true" : "false"}`,
    "---",
    "",
    `# ${context.slot.title}`,
    "",
    "## Import Boundary",
    "",
    `- Import mode: \`campaign_setup_import\``,
    `- Slot: \`${context.slot.slotId}\``,
    `- Target path: \`${context.slot.targetPath}\``,
    `- Write policy: \`${context.slot.writePolicy}\``,
    `- Review policy: \`${context.slot.reviewPolicy}\``,
    "- This is campaign bootstrap material, not ordinary source ingest and not a completed-turn runtime update.",
    "- Only already-happened setup facts belong in event targets; non-happened guidance remains review-only.",
    "",
    "## Source Anchor",
    "",
    `<!-- ${context.sourceAnchor} -->`,
    `- Raw source import: \`${context.rawImportPath}\``,
    `- Source file: \`${context.source.sourceFileName}\``,
    `- Source path: \`${context.source.sourcePath}\``,
    `- Imported at: \`${context.importedAt}\``,
    "",
    body,
  ]

  return ensureTrailingNewline(lines.join("\n"))
}

function canonicalCampaignSetupBody(context: CampaignSetupImportContext): string {
  const sourceText = normalizeCampaignSourceText(context.source.text)
  const targetText = stripCampaignSetupFuturePressureText(sourceText).trim()

  if (context.slot.slotId === "player_main") {
    return [
      "## Player Setting",
      "",
      targetText || "_No player setup text remained after filtering non-happened guidance._",
      "",
      "## Bootstrap Notes",
      "",
      "- Fixed player slot: `wiki/player/player.md`.",
      "- Do not create arbitrary `wiki/player/*.md` files during campaign setup.",
      "- Ability, skill, limit, cost, and availability details should be reviewed for `wiki/player/abilities.md`, not `wiki/rules/`.",
    ].join("\n")
  }

  if (context.slot.slotId === "player_abilities") {
    return [
      "## Player Abilities",
      "",
      targetText || "_No player ability setup text remained after filtering non-happened guidance._",
      "",
      "## Bootstrap Notes",
      "",
      "- Fixed player slot: `wiki/player/abilities.md`.",
      "- This page is for PC abilities, skills, limits, costs, cooldowns, and current availability.",
      "- Do not route global rule systems here; use `wiki/rules/` for table/world rules.",
    ].join("\n")
  }

  if (context.slot.slotId === "player_inventory") {
    return [
      "## Player Inventory",
      "",
      targetText || "_No player inventory setup text remained after filtering non-happened guidance._",
      "",
      "## Bootstrap Notes",
      "",
      "- Fixed player slot: `wiki/player/inventory.md`.",
      "- This page is for currently held, equipped, stored, consumed, or lost PC items and resources.",
      "- General item lore without current PC ownership belongs in `wiki/items/`.",
    ].join("\n")
  }

  if (context.slot.slotId === "player_goals") {
    return [
      "## Player Goals",
      "",
      targetText || "_No player goal setup text remained after filtering non-happened guidance._",
      "",
      "## Bootstrap Notes",
      "",
      "- Fixed player slot: `wiki/player/goals.md`.",
      "- This page is for PC subjective goals, promises, priorities, obligations, and motivations.",
      "- Shared campaign objective tracking belongs in `wiki/quests/`.",
    ].join("\n")
  }

  if (context.slot.slotId === "player_known_information") {
    return [
      "## Player Known Information",
      "",
      targetText || "_No player knowledge setup text remained after filtering non-happened guidance._",
      "",
      "## Bootstrap Notes",
      "",
      "- Fixed player slot: `wiki/player/known_information.md`.",
      "- This page is for what the PC knows, suspects, misunderstands, or explicitly does not yet know.",
      "- GM-only future reveals must not be written as PC knowledge.",
    ].join("\n")
  }

  if (context.slot.slotId === "current_scene") {
    return [
      "## Current Scene Snapshot",
      "",
      targetText || "_No immediate current-scene text remained after filtering non-happened guidance._",
      "",
      "## Snapshot Boundary",
      "",
      "- Overwrite-only latest scene state for the first playable turn.",
      "- This page is not an event log, route recap, character profile, or long-term memory store.",
    ].join("\n")
  }

  if (context.slot.slotId === "events_prologue") {
    return [
      "## Already Happened Prologue",
      "",
      targetText,
      "",
      "## Event Boundary",
      "",
      "- This prologue entry records only already-happened setup facts.",
      "- Non-happened setup guidance was excluded from event history.",
    ].join("\n")
  }

  if (context.slot.slotId === "main_quest" || context.slot.slotId === "quest") {
    return [
      "## Opening Objective",
      "",
      targetText || "_No quest setup text remained after filtering non-happened guidance._",
      "",
      "## Progress Boundary",
      "",
      "- This quest records an opening, game-recognized objective with blockers and progress boundaries.",
      "- It is not a player TODO list, future event history, or GM-only outline.",
      "- Progress starts at campaign bootstrap; untriggered reveals are not completed events.",
    ].join("\n")
  }

  return [
    "## Initial Relationship",
    "",
    targetText || "_No relationship setup text remained after filtering non-happened guidance._",
    "",
    "## Relationship Boundary",
    "",
    "- This is an initial/base player relationship page.",
    "- Do not write runtime relationship deltas to this file; later play changes belong under `wiki/relationships/runtime/`.",
  ].join("\n")
}

function buildRawSourceAnchorFile(context: CampaignSetupImportContext): string {
  const rawSourceText = normalizeCampaignSourceText(context.source.text, { trim: false })
  const lines = [
    "---",
    `type: "source"`,
    `title: ${yamlString(`Campaign Setup Import Source: ${context.source.sourceFileName}`)}`,
    `import_mode: "campaign_setup_import"`,
    `slot_id: ${yamlString(context.slot.slotId)}`,
    `target_path: ${yamlString(context.slot.targetPath)}`,
    `source_file_name: ${yamlString(context.source.sourceFileName)}`,
    `source_path: ${yamlString(context.source.sourcePath)}`,
    `source_anchor: ${yamlString(context.sourceAnchor)}`,
    `imported_at: ${yamlString(context.importedAt)}`,
    `provenance_kind: "raw_campaign_setup_anchor"`,
    "---",
    "",
    `# Campaign Setup Import Source: ${context.source.sourceFileName}`,
    "",
    "## Provenance",
    "",
    `- Import mode: \`campaign_setup_import\``,
    `- Target slot: \`${context.slot.slotId}\``,
    `- Target path: \`${context.slot.targetPath}\``,
    `- Source origin: \`${context.source.sourceOrigin}\``,
    `- Source text priority: \`${context.source.sourceTextTakesPriority ? "sourceText over sourcePath" : context.source.sourceOrigin}\``,
    `- Explicit bootstrap: \`${context.explicitBootstrap ? "true" : "false"}\``,
    "",
    "## Raw Source Anchor",
    "",
    `<!-- ${context.sourceAnchor}:raw -->`,
    rawSourceText,
  ]

  return ensureTrailingNewline(lines.join("\n"))
}

async function writeCampaignSetupTarget(
  projectPath: string,
  targetPath: string,
  contents: string,
  context: CampaignSetupImportContext,
  options: Record<string, unknown> | undefined,
): Promise<{ ok: true; warning?: string } | { ok: false; reason: string }> {
  const absolutePath = projectRelativePath(projectPath, targetPath)
  const exists = await fileExists(absolutePath)
  if (!exists) {
    await writeProjectRelativeFile(projectPath, targetPath, contents)
    return { ok: true }
  }

  const existing = await readFile(absolutePath)
  if (isEmptyCampaignTemplate(existing) || hasManualOverwriteOption(options) || context.slot.writePolicy === "overwrite") {
    await writeProjectRelativeFile(projectPath, targetPath, contents)
    return { ok: true }
  }

  if (context.slot.writePolicy === "append") {
    await writeProjectRelativeFile(projectPath, targetPath, appendCampaignSetupContent(existing, contents, context))
    return {
      ok: true,
      warning: `Appended campaign_setup_import happened setup facts to existing ${targetPath}; review that no future pressure entered event history.`,
    }
  }

  if (context.slot.writePolicy === "merge") {
    await writeProjectRelativeFile(projectPath, targetPath, mergeCampaignSetupContent(existing, contents, context))
    return {
      ok: true,
      warning: `Merged campaign_setup_import into existing ${targetPath}; review the fixed-slot bootstrap content before play.`,
    }
  }

  return {
    ok: false,
    reason: `Skipped ${targetPath}: existing campaign setup file has meaningful content and Stage F does not silently append/replace it without manualConfirm or allowOverwrite.`,
  }
}

async function writeProjectRelativeFile(
  projectPath: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  assertSafeWikiRelativePath(relativePath)
  const absolutePath = projectRelativePath(projectPath, relativePath)
  await createDirectory(parentDir(absolutePath))
  await writeFile(absolutePath, ensureTrailingNewline(contents))
}

function appendCampaignSetupContent(
  existing: string,
  incoming: string,
  context: CampaignSetupImportContext,
): string {
  const body = stripFrontmatterAndTitle(incoming)
  return ensureTrailingNewline([
    existing.trimEnd(),
    "",
    `<!-- ${context.sourceAnchor}:appended -->`,
    "",
    body.trim(),
  ].join("\n"))
}

function mergeCampaignSetupContent(
  existing: string,
  incoming: string,
  context: CampaignSetupImportContext,
): string {
  const body = stripFrontmatterAndTitle(incoming)
  return ensureTrailingNewline([
    existing.trimEnd(),
    "",
    `<!-- ${context.sourceAnchor}:merged -->`,
    "",
    body.trim(),
  ].join("\n"))
}

function stripFrontmatterAndTitle(content: string): string {
  return content
    .replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "")
    .replace(/^# .*\r?\n+/, "")
    .trim()
}

function isEmptyCampaignTemplate(content: string): boolean {
  const withoutFrontmatter = content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "")
  const withoutComments = withoutFrontmatter.replace(/<!--[\s\S]*?-->/g, "")
  const meaningfulLines = withoutComments
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^#{1,6}\s+/.test(line))

  return meaningfulLines.length === 0
}

function buildRawSourceImportPath(sourceFileName: string, slotId: CampaignSetupImportTargetSlot): string {
  const sourceStem = getFileStem(sourceFileName) || "inline-campaign-setup"
  const safeSourceName = makeQuerySlug(sourceStem)
  return `wiki/sources/imports/${safeSourceName}--campaign_setup--${slotId}.md`
}

function buildSourceAnchor(slotId: CampaignSetupImportTargetSlot, rawImportPath: string): string {
  const anchorId = rawImportPath
    .replace(/^wiki\/sources\/imports\//, "")
    .replace(/\.md$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
  return `campaign_setup_import:${slotId}:${anchorId}`
}

function hasManualOverwriteOption(options: Record<string, unknown> | undefined): boolean {
  return options?.manualConfirm === true || options?.allowOverwrite === true
}

function assertSafeWikiRelativePath(relativePath: string): void {
  const normalized = normalizePath(relativePath)
  if (!normalized.startsWith("wiki/")) {
    throw new Error(`Unsafe campaign_setup_import write path "${relativePath}": path must be under wiki/.`)
  }
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized) || normalized.includes("..")) {
    throw new Error(`Unsafe campaign_setup_import write path "${relativePath}".`)
  }
}

function projectRelativePath(projectPath: string, relativePath: string): string {
  return `${normalizePath(projectPath).replace(/\/+$/, "")}/${normalizePath(relativePath).replace(/^\/+/, "")}`
}

function parentDir(path: string): string {
  const normalized = normalizePath(path)
  const index = normalized.lastIndexOf("/")
  return index > 0 ? normalized.slice(0, index) : "."
}

function resolveImportTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value.trim()) return new Date(value).toISOString()
  if (typeof value === "number") return new Date(value).toISOString()
  return new Date().toISOString()
}

function normalizeCampaignSourceText(
  text: string,
  options: { trim?: boolean } = { trim: true },
): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  return options.trim === false ? normalized : normalized.trim()
}

function buildCampaignSetupReviewItem(
  context: CampaignSetupImportContext,
  reason: "review_import" | "manual_overwrite_required" | "skipped_target",
  detail?: string,
): Record<string, unknown> {
  const title = reason === "manual_overwrite_required"
    ? `Manual confirmation required for ${context.slot.title}`
    : reason === "skipped_target"
      ? `Skipped ${context.slot.title} campaign setup target`
      : `Review imported ${context.slot.title}`

  const description = detail ?? (
    reason === "review_import"
      ? `${context.slot.targetPath} was imported through campaign_setup_import; review bootstrap boundaries before treating it as active play state.`
      : `${context.slot.targetPath} was not written by campaign_setup_import.`
  )

  return {
    type: "manual-confirm",
    title,
    description,
    affectedPages: [context.slot.targetPath, context.rawImportPath],
    searchQueries: [],
    sourceAnchor: context.sourceAnchor,
    writePolicy: context.slot.writePolicy,
    reviewPolicy: context.slot.reviewPolicy,
  }
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`
}

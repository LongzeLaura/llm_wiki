import { createDirectory, fileExists, readFile, writeFile } from "@/commands/fs"
import { getFileName, getFileStem, normalizePath } from "@/lib/path-utils"
import {
  CONTROL_DOC_IMPORT_TARGET_SLOTS,
  isControlDocImportTargetSlot,
  resolveControlDocImportSlot,
  type ControlDocImportSlotDefinition,
  type ControlDocImportTargetSlot,
} from "@/lib/rpg-interactions/control-doc"
import { makeQuerySlug } from "@/lib/wiki-filename"
import type { RpgImportModeSpec, RpgImportRequest, RpgImportResult } from "./types"

export {
  CONTROL_DOC_IMPORT_TARGET_SLOTS,
  getControlDocImportTargetPath,
  type ControlDocImportTargetSlot,
} from "@/lib/rpg-interactions/control-doc"

interface ControlDocSource {
  text: string
  sourceFileName: string
  sourcePath: string
  sourceOrigin: "sourceText" | "sourcePath"
  sourceTextTakesPriority: boolean
}

interface ControlDocImportContext {
  slot: ControlDocImportSlotDefinition
  source: ControlDocSource
  importedAt: string
  rawImportPath: string
  sourceAnchor: string
}

export async function runControlDocImport(
  request: RpgImportRequest,
): Promise<RpgImportResult> {
  const slot = resolveControlDocSlot(request.targetSlot)
  const source = await resolveControlDocSource(request)
  const importedAt = resolveImportTimestamp(request.options?.now)
  const rawImportPath = buildRawSourceImportPath(source.sourceFileName, slot.slotId)
  const sourceAnchor = buildSourceAnchor(slot.slotId, rawImportPath)
  const context: ControlDocImportContext = {
    slot,
    source,
    importedAt,
    rawImportPath,
    sourceAnchor,
  }

  const writtenPaths: string[] = []
  const warnings: string[] = [
    `control_doc_import uses a review/manual-confirm boundary for ${slot.targetPath}; do not treat this as silent runtime overwrite.`,
  ]
  const skipped: string[] = []
  const reviewItems: unknown[] = [
    buildControlDocReviewItem(context, "review_import"),
  ]

  await writeProjectRelativeFile(
    request.projectPath,
    rawImportPath,
    buildRawSourceAnchorFile(context),
  )
  writtenPaths.push(rawImportPath)

  const targetStatus = await canWriteControlTarget(request.projectPath, slot.targetPath, request.options)
  if (targetStatus.ok) {
    await writeProjectRelativeFile(
      request.projectPath,
      slot.targetPath,
      buildCanonicalControlDoc(context),
    )
    writtenPaths.push(slot.targetPath)
  } else {
    skipped.push(slot.targetPath)
    warnings.push(targetStatus.reason)
    reviewItems.push(buildControlDocReviewItem(context, "manual_overwrite_required"))
  }

  return {
    mode: "control_doc_import",
    writtenPaths,
    reviewItems,
    warnings,
    skipped,
  }
}

export const controlDocImportModeSpec: RpgImportModeSpec = {
  mode: "control_doc_import",
  run: runControlDocImport,
}

function resolveControlDocSlot(targetSlot: string | undefined): ControlDocImportSlotDefinition {
  if (!targetSlot) {
    throw new Error("control_doc_import requires targetSlot.")
  }
  if (!isControlDocImportTargetSlot(targetSlot)) {
    throw new Error(
      `control_doc_import targetSlot "${targetSlot}" is not supported. Supported targetSlot values: ${CONTROL_DOC_IMPORT_TARGET_SLOTS.join(", ")}.`,
    )
  }

  return resolveControlDocImportSlot(targetSlot)
}

async function resolveControlDocSource(request: RpgImportRequest): Promise<ControlDocSource> {
  const hasSourceText = request.sourceText !== undefined
  const hasSourcePath = Boolean(request.sourcePath)

  if (!hasSourceText && !hasSourcePath) {
    throw new Error("control_doc_import requires sourceText or sourcePath.")
  }

  const text = hasSourceText ? request.sourceText ?? "" : await readFile(request.sourcePath as string)
  const sourceFileName = request.sourceFileName
    || (request.sourcePath ? getFileName(request.sourcePath) : "inline-control-doc.md")
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

function buildRawSourceImportPath(sourceFileName: string, slotId: ControlDocImportTargetSlot): string {
  const sourceStem = getFileStem(sourceFileName) || "inline-control-doc"
  const safeSourceName = makeQuerySlug(sourceStem)
  return `wiki/sources/imports/${safeSourceName}--${slotId}.md`
}

function buildSourceAnchor(slotId: ControlDocImportTargetSlot, rawImportPath: string): string {
  const anchorId = rawImportPath
    .replace(/^wiki\/sources\/imports\//, "")
    .replace(/\.md$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
  return `control_doc_import:${slotId}:${anchorId}`
}

function buildCanonicalControlDoc(context: ControlDocImportContext): string {
  const body = canonicalControlBody(context)
  const lines = [
    "---",
    `type: "control_doc"`,
    `title: ${yamlString(context.slot.title)}`,
    `slot_id: ${yamlString(context.slot.slotId)}`,
    `import_mode: "control_doc_import"`,
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
    "---",
    "",
    `# ${context.slot.title}`,
    "",
    "## Import Boundary",
    "",
    `- Import mode: \`control_doc_import\``,
    `- Slot: \`${context.slot.slotId}\``,
    `- Target path: \`${context.slot.targetPath}\``,
    `- Write policy: \`${context.slot.writePolicy}\``,
    `- Review policy: \`${context.slot.reviewPolicy}\``,
    "- Canonicalization: faithful normalization only; this is not ordinary lossy source ingest.",
    "- Runtime must not silently overwrite high-risk control files from this import.",
    "",
    "## Source Anchor",
    "",
    `<!-- ${context.sourceAnchor} -->`,
    `- Raw source import: \`${context.rawImportPath}\``,
    `- Source file: \`${context.source.sourceFileName}\``,
    `- Source path: \`${context.source.sourcePath}\``,
    `- Imported at: \`${context.importedAt}\``,
    "",
    "## Canonical Control Text",
    "",
    body,
  ]

  return ensureTrailingNewline(lines.join("\n"))
}

function canonicalControlBody(context: ControlDocImportContext): string {
  const normalized = normalizeControlSourceText(context.source.text)
  if (normalized.length > 0) return normalized

  if (context.slot.slotId === "outline_progress") {
    return [
      "_No imported progress text was provided. This initializes the progress slot for later reviewed runtime merge updates._",
      "",
      "## Current Stage",
      "",
      "- Not started.",
      "",
      "## Completed Beats",
      "",
      "- None yet.",
      "",
      "## Divergence Notes",
      "",
      "- None yet.",
    ].join("\n")
  }

  return "_No source control text was provided._"
}

function buildRawSourceAnchorFile(context: ControlDocImportContext): string {
  const rawSourceText = normalizeControlSourceText(context.source.text, { trim: false })
  const lines = [
    "---",
    `type: "source"`,
    `title: ${yamlString(`Control Doc Import Source: ${context.source.sourceFileName}`)}`,
    `import_mode: "control_doc_import"`,
    `slot_id: ${yamlString(context.slot.slotId)}`,
    `target_path: ${yamlString(context.slot.targetPath)}`,
    `source_file_name: ${yamlString(context.source.sourceFileName)}`,
    `source_path: ${yamlString(context.source.sourcePath)}`,
    `source_anchor: ${yamlString(context.sourceAnchor)}`,
    `imported_at: ${yamlString(context.importedAt)}`,
    `provenance_kind: "raw_control_doc_anchor"`,
    "---",
    "",
    `# Control Doc Import Source: ${context.source.sourceFileName}`,
    "",
    "## Provenance",
    "",
    `- Import mode: \`control_doc_import\``,
    `- Target slot: \`${context.slot.slotId}\``,
    `- Target path: \`${context.slot.targetPath}\``,
    `- Source origin: \`${context.source.sourceOrigin}\``,
    `- Source text priority: \`${context.source.sourceTextTakesPriority ? "sourceText over sourcePath" : context.source.sourceOrigin}\``,
    "",
    "## Raw Source Anchor",
    "",
    `<!-- ${context.sourceAnchor}:raw -->`,
    rawSourceText,
  ]

  return ensureTrailingNewline(lines.join("\n"))
}

async function canWriteControlTarget(
  projectPath: string,
  targetPath: string,
  options: Record<string, unknown> | undefined,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const absolutePath = projectRelativePath(projectPath, targetPath)
  if (!(await fileExists(absolutePath))) return { ok: true }
  if (hasManualConfirmOption(options)) return { ok: true }

  const existing = await readFile(absolutePath)
  if (isEmptyControlTemplate(existing)) return { ok: true }

  return {
    ok: false,
    reason: `Skipped ${targetPath}: existing control file has meaningful content and control_doc_import requires manualConfirm or allowOverwrite before replacing it.`,
  }
}

function hasManualConfirmOption(options: Record<string, unknown> | undefined): boolean {
  return options?.manualConfirm === true || options?.allowOverwrite === true
}

function isEmptyControlTemplate(content: string): boolean {
  const withoutFrontmatter = content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "")
  const withoutComments = withoutFrontmatter.replace(/<!--[\s\S]*?-->/g, "")
  const meaningfulLines = withoutComments
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^#{1,6}\s+/.test(line))

  return meaningfulLines.length === 0
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

function assertSafeWikiRelativePath(relativePath: string): void {
  const normalized = normalizePath(relativePath)
  if (!normalized.startsWith("wiki/")) {
    throw new Error(`Unsafe control_doc_import write path "${relativePath}": path must be under wiki/.`)
  }
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized) || normalized.includes("..")) {
    throw new Error(`Unsafe control_doc_import write path "${relativePath}".`)
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

function normalizeControlSourceText(
  text: string,
  options: { trim?: boolean } = { trim: true },
): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  return options.trim === false ? normalized : normalized.trim()
}

function buildControlDocReviewItem(
  context: ControlDocImportContext,
  reason: "review_import" | "manual_overwrite_required",
): Record<string, unknown> {
  const title = reason === "manual_overwrite_required"
    ? `Manual confirmation required before overwriting ${context.slot.title}`
    : `Review imported ${context.slot.title}`

  const description = reason === "manual_overwrite_required"
    ? `${context.slot.targetPath} already contains meaningful control text. The raw source anchor was saved, but the control file was not replaced.`
    : `${context.slot.targetPath} is a control document imported through ${context.slot.reviewPolicy}; review it before treating it as authoritative runtime control.`

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

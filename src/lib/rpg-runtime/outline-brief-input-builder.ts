import type { RpgKnowledgeScope, RpgNarrativeLine, RpgSchemaSlotId, RpgVisibilityScope } from "@/lib/rpg-wiki-schema"
import {
  buildOutlineBriefCompilerInputFromTurnState,
  createOutlineControlMetadata,
  lineTargetForOutlineControlKind,
} from "./outline-brief-handoff"
import { defaultKnowledgeClaimsForPath } from "./actor-knowledge"
import type {
  ActionResolution,
  OutlineBriefCompilerInput,
  PostActionWorkingState,
  RpgOutlineControlMetadata,
  RecalledMaterial,
  RecallSelection,
  TurnSemanticHandoff,
  WorldTickResult,
  WorldTickVisibleSelection,
} from "./types"
import {
  compactText,
  formatPageEntry,
  normalizeProjectPath,
  readMarkdownDir,
  readRequiredSchemaSlot,
  readSchemaSlotPages,
  type RuntimePage,
} from "./wiki-readers"

export interface BuildOutlineBriefInputFromTurnStateAndWikiInput {
  projectPath: string
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
  turnSemanticHandoff?: TurnSemanticHandoff
  recallSelection: RecallSelection
  recalledMaterials: RecalledMaterial[]
}

export interface BuildOutlineBriefInputFromTurnStateAndWikiResult {
  input: OutlineBriefCompilerInput
  warnings: string[]
}

const MAIN_OUTLINE_SECTION_NAMES = [
  "Runtime Capsule",
  "Campaign Premise",
  "Act Structure",
  "Intended Reveals",
  "Delayed Reveals",
  "Branch Conditions",
  "Must Not Contradict",
] as const

const PROGRESS_SECTION_NAMES = [
  "Runtime Capsule",
  "Current Stage",
  "Completed Beats",
  "Skipped Beats",
  "Delayed Beats",
  "Active Reveal Gates",
  "Current Information Boundary",
  "Divergence Notes",
  "Next Useful Beats",
] as const

const RULE_SLOT_IDS = ["rules_core", "rules_world", "rules_table"] as const satisfies readonly RpgSchemaSlotId[]
const MAX_DIRECT_MATERIALS = 24
const MAX_PAGE_MATERIAL_CHARS = 1400

export async function buildOutlineBriefInputFromTurnStateAndWiki(
  input: BuildOutlineBriefInputFromTurnStateAndWikiInput,
): Promise<BuildOutlineBriefInputFromTurnStateAndWikiResult> {
  const projectPath = normalizeProjectPath(input.projectPath)
  const warnings: string[] = []
  const references = new Set<string>()

  const mainOutline = await readRequiredSchemaSlot(projectPath, "main_outline", warnings, references)
  const outlineProgress = await readRequiredSchemaSlot(projectPath, "outline_progress", warnings, references)
  const rulePages = await readSchemaSlotPages(projectPath, RULE_SLOT_IDS, warnings)
  const plotArcPages = (await readMarkdownDir(projectPath, "plot-arcs")).slice(0, MAX_DIRECT_MATERIALS)
  const relationshipRuntimePages = (await readMarkdownDir(projectPath, "relationships"))
    .filter((page) => page.relativePath.includes("/runtime/"))
    .slice(0, MAX_DIRECT_MATERIALS)

  const directWikiMaterials = [
    ...controlledOutlineMaterials(mainOutline, MAIN_OUTLINE_SECTION_NAMES, "outlineMain"),
    ...controlledOutlineMaterials(outlineProgress, PROGRESS_SECTION_NAMES, "outlineProgress"),
    ...plotArcPages.map((page, index) =>
      pageMaterial(page, {
        sectionId: sectionIdForPage(page, "plotArc", index),
        reason: "Plot-arc base/runtime page read directly for Outline Brief tension fuel.",
        expectedUse: "Bound outline_brief plot-arc pressure through the module-specific wiki reader.",
        lineTarget: "tensionLine",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
      }),
    ),
    ...relationshipRuntimePages.map((page, index) =>
      pageMaterial(page, {
        sectionId: sectionIdForPage(page, "relationshipRuntime", index),
        reason: "Relationship runtime overlay read directly for Outline Brief tension fuel.",
        expectedUse: "Bound outline_brief relationship pressure through the module-specific wiki reader.",
        lineTarget: "tensionLine",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
      }),
    ),
    ...rulePages.map((page, index) =>
      pageMaterial(page, {
        sectionId: sectionIdForPage(page, "rules", index),
        reason: "Rules slot read directly for Outline Brief hard constraints.",
        expectedUse: "Preserve hard rule constraints while compiling outline-aware narration brief.",
        lineTarget: "tensionLine",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
      }),
    ),
  ]

  const derived = buildOutlineBriefCompilerInputFromTurnState({
    ...input,
    recalledMaterials: [...input.recalledMaterials, ...directWikiMaterials],
  })

  return {
    input: {
      ...derived,
      recalledMaterials: input.recalledMaterials,
      knownReferences: dedupeKnownReferences([
        ...derived.knownReferences,
        ...[...references].map((path) => ({
          path,
          reason: "Outline Brief controlled wiki reader reference.",
        })),
      ]),
    },
    warnings,
  }
}

function controlledOutlineMaterials(
  page: RuntimePage,
  sectionNames: readonly string[],
  sectionPrefix: "outlineMain" | "outlineProgress",
): RecalledMaterial[] {
  return sectionNames.flatMap((sectionName) => {
    const content = extractMarkdownSection(page.content, sectionName)
    if (!content) return []
    const sectionId = `${sectionPrefix}.${sectionSlug(sectionName)}`
    const outlineControl = createOutlineControlMetadata({
      path: page.relativePath,
      sectionId,
      content,
      fallback: `Controlled ${sectionName} section read directly for Outline Brief.`,
    })
    return [
      pageMaterial(page, {
        sectionId,
        content,
        reason: `Controlled ${sectionName} section read directly for Outline Brief as ${outlineControl.controlKind} material.`,
        expectedUse:
          "Use as bounded GM control / reveal gate / progress material; lineTarget is only a narration lens fallback, not outline ownership, and future plans must not become happened events.",
        lineTarget: lineTargetForOutlineControlKind(outlineControl.controlKind),
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        outlineControl,
      }),
    ]
  })
}

function pageMaterial(
  page: RuntimePage,
  options: {
    sectionId: string
    reason: string
    expectedUse: string
    lineTarget: RpgNarrativeLine
    visibilityScope: RpgVisibilityScope
    knowledgeScope: RpgKnowledgeScope
    outlineControl?: RpgOutlineControlMetadata
    content?: string
  },
): RecalledMaterial {
  const content = options.content ?? formatPageEntry(page)
  return {
    path: page.relativePath,
    lineTarget: options.lineTarget,
    readMode: "focusedSection",
    priority: "high",
    reason: options.reason,
    expectedUse: options.expectedUse,
    visibilityScope: options.visibilityScope,
    knowledgeScope: options.knowledgeScope,
    knowledgeClaims: defaultKnowledgeClaimsForPath({
      path: page.relativePath,
      visibilityScope: options.visibilityScope,
      knowledgeScope: options.knowledgeScope,
      summary: options.reason,
    }),
    ...(options.outlineControl ? { outlineControl: options.outlineControl } : {}),
    sections: [
      {
        sectionId: options.sectionId,
        readMode: "focusedSection",
        priority: "high",
        reason: options.reason,
        expectedUse: options.expectedUse,
        content: compactText(content, MAX_PAGE_MATERIAL_CHARS),
        warnings: [],
      },
    ],
    warnings: [],
  }
}

function extractMarkdownSection(content: string, heading: string): string {
  const lines = content.split("\n")
  const start = lines.findIndex((line) => headingRegex(heading).test(line.trim()))
  if (start < 0) return ""

  const currentLevel = headingLevel(lines[start])
  const end = lines.findIndex((line, index) => index > start && isHeadingBoundary(line, currentLevel))
  return lines.slice(start, end < 0 ? undefined : end).join("\n").trim()
}

function headingRegex(heading: string): RegExp {
  return new RegExp(`^#{2,6}\\s+${escapeRegExp(heading)}\\s*$`, "i")
}

function headingLevel(line: string): number {
  return line.match(/^#+/)?.[0].length ?? 6
}

function isHeadingBoundary(line: string, currentLevel: number): boolean {
  const level = headingLevel(line)
  return /^#{1,6}\s+/.test(line) && level <= currentLevel
}

function sectionSlug(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
}

function sectionIdForPage(page: RuntimePage, prefix: string, index: number): string {
  return `${prefix}.${page.relativePath.replace(/^wiki\//, "").replace(/\.md$/i, "").replace(/[^a-z0-9]+/gi, ".")}.${index + 1}`
}

function dedupeKnownReferences(
  references: OutlineBriefCompilerInput["knownReferences"],
): OutlineBriefCompilerInput["knownReferences"] {
  const seen = new Set<string>()
  const result: OutlineBriefCompilerInput["knownReferences"] = []
  for (const reference of references) {
    const key = [
      reference.path,
      reference.sectionId ?? "",
      reference.runtimeDeltaId ?? "",
      reference.stableId ?? "",
    ].join("#")
    if (seen.has(key)) continue
    seen.add(key)
    result.push(reference)
  }
  return result
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

import type { RpgKnowledgeScope, RpgSchemaSlotId, RpgVisibilityScope } from "@/lib/rpg-wiki-schema"
import type {
  ActionResolution,
  ForbiddenNarrationConstraint,
  NarrationGeneratorInput,
  NarrationSourceRef,
  NarrationStyleBundle,
  OutlineAwareNarrationBrief,
  PlayerKnowledgeBoundary,
  PostActionWorkingState,
  ProvisionalNarrationHandoff,
  RecalledMaterial,
  RecallSelection,
  TurnSemanticHandoff,
  WorldTickVisibleSelection,
  WorldTickResult,
} from "./types"
import { defaultKnowledgeClaimsForPath } from "./actor-knowledge"
import {
  collectConstraintNotes,
  collectForbiddenContradictions,
  compactText,
  formatPageEntry,
  normalizeProjectPath,
  readRequiredSchemaSlot,
  readSchemaSlotPages,
  type RuntimePage,
} from "./wiki-readers"

export interface BuildNarrationGeneratorInputFromHandoffsInput {
  projectPath: string
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
  turnSemanticHandoff?: TurnSemanticHandoff
  recallSelection: RecallSelection
  recalledMaterials: RecalledMaterial[]
  outlineAwareNarrationBrief: OutlineAwareNarrationBrief
  provisionalNarrationHandoff?: ProvisionalNarrationHandoff
}

export interface BuildNarrationGeneratorInputFromHandoffsResult {
  input: NarrationGeneratorInput
  warnings: string[]
}

const STYLE_SLOT_IDS = [
  "style_narration",
  "style_dialogue",
  "style_forbidden",
] as const satisfies readonly RpgSchemaSlotId[]
const RULE_SLOT_IDS = ["rules_core", "rules_world", "rules_table"] as const satisfies readonly RpgSchemaSlotId[]
const PLAYER_KNOWLEDGE_SLOT_ID = "player_known_information" satisfies RpgSchemaSlotId
const PLAYER_PREFERENCES_SLOT_ID = "memory_player_preferences" satisfies RpgSchemaSlotId
const MAX_RULES = 8
const MAX_RULE_CHARS = 420

export async function buildNarrationGeneratorInputFromHandoffs(
  input: BuildNarrationGeneratorInputFromHandoffsInput,
): Promise<BuildNarrationGeneratorInputFromHandoffsResult> {
  const projectPath = normalizeProjectPath(input.projectPath)
  const warnings: string[] = []
  const references = new Set<string>()

  const stylePages = await readSchemaSlotPages(projectPath, STYLE_SLOT_IDS, warnings)
  const rulePages = await readSchemaSlotPages(projectPath, RULE_SLOT_IDS, warnings)
  const playerKnowledgePage = await readRequiredSchemaSlot(projectPath, PLAYER_KNOWLEDGE_SLOT_ID, warnings, references)
  const playerPreferencesPage = await readRequiredSchemaSlot(projectPath, PLAYER_PREFERENCES_SLOT_ID, warnings, references)

  stylePages.forEach((page) => references.add(page.relativePath))
  rulePages.forEach((page) => references.add(page.relativePath))

  const narrationReferences = buildNarrationReferences({
    ...input,
    readerPages: [...stylePages, ...rulePages, playerKnowledgePage, playerPreferencesPage],
  })
  const allowedKnowledgeRefs = [
    ...narrationReferences.filter((reference) =>
      reference.visibilityScope === "pc_visible" || reference.visibilityScope === "pc_inferred"
    ),
    pageReference(playerKnowledgePage, {
      usePurpose: "narration",
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
      reason: "Explicit player knowledge boundary slot read for narration.",
    }),
  ]

  return {
    input: {
      turnSemanticHandoff: input.turnSemanticHandoff,
      postActionWorkingState: input.postActionWorkingState,
      actionResolution: input.actionResolution,
      worldTickResult: input.worldTickResult,
      visibleSelection: input.visibleSelection,
      outlineAwareNarrationBrief: input.outlineAwareNarrationBrief,
      ...(input.provisionalNarrationHandoff
        ? { provisionalNarrationHandoff: input.provisionalNarrationHandoff }
        : {}),
      recallSelection: input.recallSelection,
      recalledMaterials: input.recalledMaterials,
      styleBundle: buildNarrationStyleBundle({
        submittedActionId: input.postActionWorkingState.submittedAction.id,
        stylePages,
        playerPreferencesPage,
        references: narrationReferences,
      }),
      forbiddenNarrationConstraints: buildForbiddenNarrationConstraints({
        visibleSelection: input.visibleSelection,
        outlineAwareNarrationBrief: input.outlineAwareNarrationBrief,
        provisionalNarrationHandoff: input.provisionalNarrationHandoff,
        styleForbiddenPage: stylePages.find((page) => page.relativePath === "wiki/style/forbidden.md"),
        rulePages,
      }),
      playerKnowledgeBoundary: buildPlayerKnowledgeBoundary(dedupeNarrationRefs(allowedKnowledgeRefs)),
      references: narrationReferences,
      runtimeRefs: [
        ...input.postActionWorkingState.runtimeDeltaRefs,
        ...input.actionResolution.runtimeDeltaRefs,
        ...input.worldTickResult.runtimeDeltaRefs,
        ...(input.provisionalNarrationHandoff?.runtimeDeltaRefs ?? []),
      ],
    },
    warnings,
  }
}

function buildNarrationReferences(input: {
  postActionWorkingState: PostActionWorkingState
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  recalledMaterials: RecalledMaterial[]
  outlineAwareNarrationBrief: OutlineAwareNarrationBrief
  provisionalNarrationHandoff?: ProvisionalNarrationHandoff
  readerPages: RuntimePage[]
}): NarrationSourceRef[] {
  const references: NarrationSourceRef[] = []

  references.push(...input.actionResolution.references.map((reference) => ({
    path: reference.path,
    sectionId: reference.sectionId,
    usePurpose: reference.usePurpose,
    visibilityScope: reference.visibilityScope,
    knowledgeScope: reference.knowledgeScope,
    reason: reference.reason,
  })))
  references.push(...input.worldTickResult.references.map((reference) => ({
    path: reference.path,
    sectionId: reference.sectionId,
    usePurpose: reference.usePurpose,
    visibilityScope: reference.visibility?.visibilityScope,
    knowledgeScope: reference.visibility?.knowledgeScope,
    reason: reference.reason,
  })))
  references.push(...input.postActionWorkingState.references.map((path) => ({
    path,
    usePurpose: "narration" as const,
    reason: "PostActionWorkingState reference selected for same-turn narration continuity.",
  })))
  references.push(...input.recalledMaterials.map((material) => ({
    path: material.path,
    sectionId: material.sections[0]?.sectionId,
    lineTarget: material.lineTarget,
    usePurpose: "recall" as const,
    visibilityScope: material.visibilityScope,
    knowledgeScope: material.knowledgeScope,
    knowledgeClaims: material.knowledgeClaims,
    reason: material.reason,
  })))
  references.push(...input.outlineAwareNarrationBrief.references.map((reference) => ({
    path: reference.path,
    sectionId: reference.sectionId,
    runtimeDeltaId: reference.runtimeDeltaId,
    stableId: reference.stableId,
    lineTarget: reference.lineTarget,
    usePurpose: reference.usePurpose,
    visibilityScope: reference.visibilityScope,
    knowledgeScope: reference.knowledgeScope,
    knowledgeClaims: reference.knowledgeClaims,
    reason: reference.reason,
  })))
  references.push(...(input.provisionalNarrationHandoff?.runtimeDeltaRefs.map((reference) => ({
    path: reference.sourcePath,
    runtimeDeltaId: reference.deltaId,
    lineTarget: reference.narrativeLine,
    usePurpose: "outlineControl" as const,
    reason: reference.summary,
  })) ?? []))
  references.push(...input.readerPages.map((page) => pageReference(page, {
    usePurpose: page.relativePath.startsWith("wiki/rules/") ? "ruleCheck" : "narration",
    visibilityScope: visibilityForReaderPage(page),
    knowledgeScope: knowledgeForReaderPage(page),
    reason: "Narration dedicated style/rules/memory/player-knowledge reader reference.",
  })))

  return dedupeNarrationRefs(references)
}

function buildNarrationStyleBundle(input: {
  submittedActionId: string
  stylePages: RuntimePage[]
  playerPreferencesPage: RuntimePage
  references: NarrationSourceRef[]
}): NarrationStyleBundle {
  const narrationPage = input.stylePages.find((page) => page.relativePath === "wiki/style/narration.md")
  const dialoguePage = input.stylePages.find((page) => page.relativePath === "wiki/style/dialogue.md")
  const forbiddenPage = input.stylePages.find((page) => page.relativePath === "wiki/style/forbidden.md")

  return {
    bundleId: `style-bundle-${input.submittedActionId}`,
    toneRules: pageRules(narrationPage, "Use clear, grounded table narration."),
    dictionRules: pageRules(dialoguePage, "Keep player-facing prose concrete and observable."),
    pacingRules: pageRules(input.playerPreferencesPage, "Respect player preferences without turning them into facts."),
    forbiddenStyleMoves: [
      "Do not make style choices into world, plot, event, or wiki facts.",
      ...pageRules(forbiddenPage, "Do not reveal hidden or GM-only material in player-facing prose."),
    ],
    sourceRefs: input.references.filter((reference) =>
      reference.path.startsWith("wiki/style/") || reference.path === "wiki/memory/player-preferences.md"
    ),
    styleIsNotWorldFact: true,
    styleIsNotPlotFact: true,
  }
}

function buildForbiddenNarrationConstraints(input: {
  visibleSelection: WorldTickVisibleSelection
  outlineAwareNarrationBrief: OutlineAwareNarrationBrief
  provisionalNarrationHandoff?: ProvisionalNarrationHandoff
  styleForbiddenPage?: RuntimePage
  rulePages: RuntimePage[]
}): ForbiddenNarrationConstraint[] {
  return [
    ...input.outlineAwareNarrationBrief.forbiddenNarrationBoundary.map((item) => ({
      constraintId: item.itemId,
      sourcePath: item.sourcePath,
      sectionId: item.sectionId,
      stableId: item.stableId,
      lineTarget: item.lineTarget,
      visibilityScope: item.visibilityScope,
      knowledgeScope: item.knowledgeScope,
      mustNotReveal: [item.reason],
      reason: item.reason,
    })),
    ...input.visibleSelection.parallelLensCandidates.map((candidate) => ({
      constraintId: `parallel-line-not-pc-knowledge-${candidate.sourceId}`,
      lineTarget: "parallelLine" as const,
      visibilityScope: candidate.visibilityScope,
      knowledgeScope: candidate.knowledgeScope,
      mustNotReveal: [candidate.summary],
      reason: "Parallel-line material may be displayed only when policy allows and never becomes PC knowledge.",
    })),
    ...pageForbiddenConstraints(input.styleForbiddenPage ? [input.styleForbiddenPage] : [], "style-forbidden"),
    ...pageForbiddenConstraints(input.rulePages, "rule-hard-constraint"),
    ...(input.provisionalNarrationHandoff?.mustNotReveal.map((revealId) => ({
      constraintId: `provisional-must-not-reveal-${revealId}`,
      lineTarget: "tensionLine" as const,
      visibilityScope: "gm_only" as const,
      knowledgeScope: "gm_only" as const,
      mustNotReveal: [revealId],
      reason: "Same-turn provisional narration handoff hard constraint.",
    })) ?? []),
  ]
}

function pageForbiddenConstraints(pages: RuntimePage[], prefix: string): ForbiddenNarrationConstraint[] {
  return pages.flatMap((page) => {
    const notes = [
      ...collectForbiddenContradictions([page.content]),
      ...collectConstraintNotes([page]),
    ].slice(0, MAX_RULES)

    return notes.map((note, index) => ({
      constraintId: `${prefix}-${slug(page.relativePath)}-${index + 1}`,
      sourcePath: page.relativePath,
      sectionId: sectionIdForPage(page),
      lineTarget: "playerVisibleLine" as const,
      visibilityScope: "gm_only" as const,
      knowledgeScope: "gm_only" as const,
      mustNotReveal: [compactText(note, MAX_RULE_CHARS)],
      reason: "Dedicated narration forbidden/rules reader constraint.",
    }))
  })
}

function buildPlayerKnowledgeBoundary(allowedKnowledgeRefs: NarrationSourceRef[]): PlayerKnowledgeBoundary {
  return {
    boundaryId: "player-knowledge-boundary-narration-generator",
    pcKnowledgePath: "wiki/player/known_information.md",
    allowedKnowledgeRefs,
    forbiddenVisibilityScopes: ["user_visible_pc_unknown", "gm_only", "hidden"],
    parallelLineDoesNotGrantPcKnowledge: true,
    showParallelLineDoesNotGrantPcKnowledge: true,
    notes: [
      "Narration playerFacingText must stay inside PC-visible or PC-inferred material.",
      "parallelLineText display does not write or imply PC knowledge.",
      "wiki/player/known_information.md is the dedicated player knowledge boundary slot.",
    ],
  }
}

function pageReference(
  page: RuntimePage,
  options: {
    usePurpose: NarrationSourceRef["usePurpose"]
    visibilityScope: RpgVisibilityScope
    knowledgeScope: RpgKnowledgeScope
    reason: string
  },
): NarrationSourceRef {
  return {
    path: page.relativePath,
    sectionId: sectionIdForPage(page),
    usePurpose: options.usePurpose,
    visibilityScope: options.visibilityScope,
    knowledgeScope: options.knowledgeScope,
    knowledgeClaims: defaultKnowledgeClaimsForPath({
      path: page.relativePath,
      visibilityScope: options.visibilityScope,
      knowledgeScope: options.knowledgeScope,
      summary: options.reason,
    }),
    reason: options.reason,
  }
}

function pageRules(page: RuntimePage | undefined, fallback: string): string[] {
  if (!page?.content.trim()) return [fallback]
  return formatPageEntry(page)
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter((line) => line && !line.startsWith("#") && line !== "---")
    .slice(0, MAX_RULES)
    .map((line) => compactText(line, MAX_RULE_CHARS))
}

function visibilityForReaderPage(page: RuntimePage): RpgVisibilityScope {
  if (page.relativePath === "wiki/player/known_information.md") return "pc_visible"
  return "gm_only"
}

function knowledgeForReaderPage(page: RuntimePage): RpgKnowledgeScope {
  if (page.relativePath === "wiki/player/known_information.md") return "pc_known"
  return "gm_only"
}

function sectionIdForPage(page: RuntimePage): string {
  return `slot.${page.relativePath.replace(/^wiki\//, "").replace(/\.md$/i, "").replace(/[^a-z0-9]+/gi, ".")}`
}

function dedupeNarrationRefs(references: NarrationSourceRef[]): NarrationSourceRef[] {
  const seen = new Set<string>()
  const result: NarrationSourceRef[] = []
  for (const reference of references) {
    const normalizedPath = reference.path.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "")
    if (!normalizedPath || normalizedPath === "wiki/outlines/main.md" || normalizedPath.startsWith("wiki/runtime/")) {
      continue
    }
    const key = [
      normalizedPath,
      reference.sectionId ?? "",
      reference.runtimeDeltaId ?? "",
      reference.stableId ?? "",
      reference.lineTarget ?? "",
      reference.usePurpose,
    ].join("|")
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ ...reference, path: normalizedPath })
  }
  return result
}

function slug(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "ref"
}

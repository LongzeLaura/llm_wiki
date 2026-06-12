import type {
  ActionResolution,
  OutlineBriefCompilerInput,
  OutlineHardConstraint,
  OutlineKnownReference,
  OutlineSlice,
  OutlineVisibilityBoundary,
  PlotArcTensionFuel,
  PostActionWorkingState,
  RecalledMaterial,
  RecallSelection,
  WorldTickResult,
  WorldTickVisibleSelection,
} from "./types"
import type { RpgKnowledgeScope, RpgRuntimeDeltaRef, RpgVisibilityScope } from "../rpg-wiki-schema"

export interface BuildOutlineBriefCompilerInputFromTurnStateInput {
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
  recallSelection: RecallSelection
  recalledMaterials: RecalledMaterial[]
}

export function buildOutlineBriefCompilerInputFromTurnState(
  input: BuildOutlineBriefCompilerInputFromTurnStateInput,
): OutlineBriefCompilerInput {
  const runtimeRefs = uniqueRuntimeRefs([
    ...input.postActionWorkingState.runtimeDeltaRefs,
    ...input.actionResolution.runtimeDeltaRefs,
    ...input.worldTickResult.runtimeDeltaRefs,
  ])

  return {
    postActionWorkingState: input.postActionWorkingState,
    actionResolution: input.actionResolution,
    worldTickResult: input.worldTickResult,
    visibleSelection: input.visibleSelection,
    recallSelection: input.recallSelection,
    recalledMaterials: input.recalledMaterials,
    pacingState: input.postActionWorkingState.pacingState,
    gapState: input.postActionWorkingState.gapState,
    reactionQueue: input.worldTickResult.reactionQueue,
    visibilityBoundaries: buildVisibilityBoundaries(input.recalledMaterials, input.visibleSelection),
    outlineSlices: buildOutlineSlices(input.recalledMaterials),
    plotArcTensionFuel: buildPlotArcTensionFuel(input.recalledMaterials),
    hardConstraints: buildHardConstraints(input.recalledMaterials),
    runtimeRefs,
    knownReferences: buildKnownReferences(input, runtimeRefs),
  }
}

function buildVisibilityBoundaries(
  recalledMaterials: readonly RecalledMaterial[],
  visibleSelection: WorldTickVisibleSelection,
): OutlineVisibilityBoundary[] {
  const boundaries = new Map<string, OutlineVisibilityBoundary>()

  for (const material of recalledMaterials) {
    const grantsPcKnowledge = grantsPcKnowledgeFromScopes(material.visibilityScope, material.knowledgeScope)
    for (const section of material.sections) {
      addBoundary(boundaries, {
        boundaryId: `visibility.${slug(material.path)}.${slug(section.sectionId)}`,
        lineTarget: material.lineTarget,
        visibilityScope: material.visibilityScope,
        knowledgeScope: material.knowledgeScope,
        grantsPcKnowledge,
        sourcePath: material.path,
        sectionId: section.sectionId,
        reason: grantsPcKnowledge
          ? "Selected recall material may inform PC-visible narration."
          : "Selected recall material must not become PC knowledge.",
      })
    }
  }

  for (const lens of visibleSelection.parallelLensCandidates) {
    addBoundary(boundaries, {
      boundaryId: `visibility.${slug(lens.lensId)}`,
      lineTarget: "parallelLine",
      visibilityScope: lens.visibilityScope,
      knowledgeScope: lens.knowledgeScope,
      grantsPcKnowledge: false,
      reason: "Parallel-line lens is user-visible only and does not grant PC knowledge.",
    })
  }

  return [...boundaries.values()]
}

function buildOutlineSlices(recalledMaterials: readonly RecalledMaterial[]): OutlineSlice[] {
  const slices: OutlineSlice[] = []

  for (const material of recalledMaterials.filter((entry) => isOutlinePath(entry.path))) {
    material.sections.forEach((section, index) => {
      const sliceId = `outline-slice.${slug(material.path)}.${slug(section.sectionId)}.${index + 1}`
      const stableId = `${sliceId}.beat`
      const revealStableId = `${sliceId}.reveal`
      const hasReveal = looksLikeRevealOrForbidden(section.content, section.sectionId)

      slices.push({
        sliceId,
        path: material.path,
        sectionId: section.sectionId,
        title: titleFromPath(material.path, section.sectionId),
        lineTarget: material.lineTarget,
        visibilityScope: material.visibilityScope,
        knowledgeScope: material.knowledgeScope,
        summary: summarizeSection(section.content, section.expectedUse || material.expectedUse),
        beatRefs: [
          {
            refId: `${stableId}.ref`,
            path: material.path,
            sectionId: section.sectionId,
            stableId,
            summary: summarizeSection(section.content, "Outline beat selected by Recall Selector."),
            lineTarget: material.lineTarget,
            visibilityScope: material.visibilityScope,
            knowledgeScope: material.knowledgeScope,
            refType: "beat",
            beatStatus: material.path.endsWith("/progress.md") ? "active" : "planned",
          },
        ],
        revealRefs: hasReveal
          ? [
              {
                refId: `${revealStableId}.ref`,
                path: material.path,
                sectionId: section.sectionId,
                stableId: revealStableId,
                summary: summarizeSection(section.content, "Reveal policy selected by Recall Selector."),
                lineTarget: material.lineTarget,
                visibilityScope: material.visibilityScope,
                knowledgeScope: material.knowledgeScope,
                refType: "reveal",
                revealPolicy: material.visibilityScope === "pc_visible" ? "hint_only" : "delay",
                revealTiming: "Only when the filtered outline brief allows it.",
              },
            ]
          : [],
        branchConditionRefs: [],
        dependencies: [],
        lineTargets: [
          {
            lineTarget: material.lineTarget,
            allowedStableIds: [stableId],
            forbiddenStableIds: hasReveal ? [revealStableId] : [],
            guidance: material.expectedUse || "Use this outline slice only through the filtered narration brief.",
          },
        ],
        revealPolicies: hasReveal
          ? [
              {
                directiveId: `policy.${revealStableId}`,
                stableId: revealStableId,
                policy: material.visibilityScope === "pc_visible" ? "hint_only" : "delay",
                lineTarget: material.lineTarget,
                reason: "First-version deterministic reveal policy derived from recalled outline material.",
              },
            ]
          : [],
        invalidationNotes: [],
      })
    })
  }

  return slices
}

function buildPlotArcTensionFuel(recalledMaterials: readonly RecalledMaterial[]): PlotArcTensionFuel[] {
  const fuel: PlotArcTensionFuel[] = []

  for (const material of recalledMaterials.filter((entry) => isTensionFuelPath(entry.path))) {
    material.sections.forEach((section, index) => {
      const isRelationship = isRelationshipRuntimePath(material.path)
      fuel.push({
        fuelId: `fuel.${slug(material.path)}.${slug(section.sectionId)}.${index + 1}`,
        path: material.path,
        sectionId: section.sectionId,
        plotArcId: isRelationship
          ? `relationship.${slug(material.path.replace(/^wiki\/relationships\/runtime\//, "").replace(/\.md$/i, ""))}`
          : `plotArc.${slug(material.path.replace(/^wiki\/plot-arcs\/(?:runtime\/)?/, "").replace(/\.md$/i, ""))}`,
        summary: summarizeSection(section.content, section.expectedUse || material.expectedUse),
        tensionLineTarget: material.lineTarget === "tensionLine" ? "advance" : "hold",
        pressureSources: [material.reason, section.reason].filter(Boolean),
        relationshipRefs: isRelationship ? [material.path] : [],
        forbiddenResolutions: looksLikeRevealOrForbidden(section.content, section.sectionId)
          ? [summarizeSection(section.content, "Do not resolve this pressure without review.")]
          : [],
      })
    })
  }

  return fuel
}

function buildHardConstraints(recalledMaterials: readonly RecalledMaterial[]): OutlineHardConstraint[] {
  const constraints: OutlineHardConstraint[] = []

  for (const material of recalledMaterials.filter(isHardConstraintMaterial)) {
    material.sections.forEach((section, index) => {
      constraints.push({
        constraintId: `constraint.${slug(material.path)}.${slug(section.sectionId)}.${index + 1}`,
        sourcePath: material.path,
        sectionId: section.sectionId,
        summary: summarizeSection(section.content, section.expectedUse || material.expectedUse),
        appliesToLines: material.visibilityScope === "gm_only"
          ? ["playerVisibleLine", "parallelLine", "tensionLine"]
          : [material.lineTarget],
        mustPreserve: [],
        mustNotReveal: looksLikeRevealOrForbidden(section.content, section.sectionId)
          ? [`${slug(material.path)}.${slug(section.sectionId)}`]
          : [],
      })
    })
  }

  return constraints
}

function buildKnownReferences(
  input: BuildOutlineBriefCompilerInputFromTurnStateInput,
  runtimeRefs: readonly RpgRuntimeDeltaRef[],
): OutlineKnownReference[] {
  const references = new Map<string, OutlineKnownReference>()
  const add = (reference: OutlineKnownReference) => {
    const key = [
      reference.path,
      reference.sectionId ?? "",
      reference.runtimeDeltaId ?? "",
      reference.stableId ?? "",
    ].join("#")
    if (!references.has(key)) references.set(key, reference)
  }

  for (const material of input.recalledMaterials) {
    for (const section of material.sections) {
      add({
        path: material.path,
        sectionId: section.sectionId,
        reason: `Recalled material selected for ${material.lineTarget}.`,
      })
    }
  }
  for (const item of input.recallSelection.selectedItems) {
    for (const section of item.sections) {
      add({
        path: item.path,
        sectionId: section.sectionId,
        reason: "RecallSelection selected section.",
      })
    }
  }
  for (const exclusion of input.recallSelection.exclusions) {
    for (const sectionId of exclusion.sectionIds) {
      add({
        path: exclusion.path,
        sectionId,
        reason: `RecallSelection exclusion boundary: ${exclusion.reason}`,
      })
    }
  }
  for (const reference of input.actionResolution.references) {
    add({
      path: reference.path,
      sectionId: reference.sectionId,
      reason: reference.reason,
    })
  }
  for (const reference of input.worldTickResult.references) {
    add({
      path: reference.path,
      sectionId: reference.sectionId,
      reason: reference.reason,
    })
  }
  for (const path of input.postActionWorkingState.references) {
    add({ path, reason: "PostActionWorkingState reference." })
  }
  for (const runtimeRef of runtimeRefs) {
    add({
      path: runtimeRef.sourcePath,
      runtimeDeltaId: runtimeRef.deltaId,
      reason: runtimeRef.summary,
    })
  }

  return [...references.values()]
}

// These checks are intentionally local to the outline-brief handoff: Recall's helpers
// validate safe read boundaries, while this layer classifies already-recalled material
// into LLM 4 outline/plot-arc/control inputs without changing read policy.
function isHardConstraintMaterial(material: RecalledMaterial): boolean {
  if (/^wiki\/rules\//.test(material.path)) return true
  if (material.path === "wiki/style/forbidden.md") return true
  if (material.path === "wiki/memory/player-preferences.md") return true
  if (!isOutlinePath(material.path)) return false
  return material.sections.some((section) => looksLikeRevealOrForbidden(section.content, section.sectionId))
}

function isOutlinePath(path: string): boolean {
  return /^wiki\/outlines\//.test(path)
}

function isPlotArcPath(path: string): boolean {
  return /^wiki\/plot-arcs(?:\/|$)/.test(path)
}

function isRelationshipRuntimePath(path: string): boolean {
  return /^wiki\/relationships\/runtime\//.test(path)
}

function isTensionFuelPath(path: string): boolean {
  return isPlotArcPath(path) || isRelationshipRuntimePath(path)
}

function grantsPcKnowledgeFromScopes(visibilityScope: RpgVisibilityScope, knowledgeScope: RpgKnowledgeScope): boolean {
  return (
    (visibilityScope === "pc_visible" || visibilityScope === "pc_inferred") &&
    (knowledgeScope === "pc_known" || knowledgeScope === "pc_misunderstanding")
  )
}

function addBoundary(boundaries: Map<string, OutlineVisibilityBoundary>, boundary: OutlineVisibilityBoundary): void {
  if (!boundaries.has(boundary.boundaryId)) boundaries.set(boundary.boundaryId, boundary)
}

function looksLikeRevealOrForbidden(content: string, sectionId: string): boolean {
  const text = `${sectionId}\n${content}`.toLowerCase()
  return /forbid|forbidden|must not|reveal|delayed|delay|hidden|gm-only|gm_only|禁止|不可|揭示|透露/.test(text)
}

function summarizeSection(content: string, fallback: string): string {
  const compact = content.replace(/\s+/g, " ").trim()
  if (!compact) return fallback
  return compact.length > 240 ? `${compact.slice(0, 237)}...` : compact
}

function titleFromPath(path: string, sectionId: string): string {
  const file = path.split("/").pop()?.replace(/\.md$/i, "") || "outline"
  return `${file}: ${sectionId}`
}

function uniqueRuntimeRefs(refs: readonly RpgRuntimeDeltaRef[]): RpgRuntimeDeltaRef[] {
  const byKey = new Map<string, RpgRuntimeDeltaRef>()
  for (const ref of refs) {
    const key = `${ref.deltaId}#${ref.sourcePath}`
    if (!byKey.has(key)) byKey.set(key, ref)
  }
  return [...byKey.values()]
}

function slug(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "ref"
}

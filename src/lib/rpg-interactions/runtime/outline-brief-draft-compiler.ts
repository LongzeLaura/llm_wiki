import type {
  ForbiddenNarrationItem,
  OutlineBriefCompilerInput,
  OutlineBriefCompilerOutput,
  OutlineBriefReference,
  OutlineImpactAffectedRefs,
  OutlineStableRef,
  RegenerationRequest,
  TensionLineUpdateCandidate,
} from "../../rpg-runtime/types"
import type {
  RpgKnowledgeScope,
  RpgNarrativeLine,
  RpgOutlineImpactLevel,
  RpgUsePurpose,
  RpgVisibilityScope,
} from "../../rpg-wiki-schema"
import { validateOutlineBriefCompilerOutput } from "./outline-brief-validation"
import { assertNoForbiddenSoftDraftKeys, stripDerivableDraftKeys } from "./soft-draft-protocol"

const JSON_FENCE_PATTERN = /```(?:json|JSON)?\s*([\s\S]*?)```/i

const LINE_TARGETS = new Set<RpgNarrativeLine>(["playerVisibleLine", "parallelLine", "tensionLine"])
const IMPACT_LEVELS = new Set<RpgOutlineImpactLevel>(["none", "minor", "branch", "major_rewrite_required"])
const PACING_INTENTS = new Set(["hold", "soft_push", "medium", "strong", "scene_cut"])
const MINIMUM_DELTAS = new Set(["none", "minor", "meaningful", "scene_changing"])
const DISPLAY_POLICIES = new Set(["user_visible_pc_unknown", "gm_only", "hidden"])
const UPDATE_KINDS = new Set(["advance", "hold", "reverse", "complicate", "resolve"])

const DERIVABLE_DRAFT_KEYS = new Set([
  "briefId",
  "sourceWorkingStateId",
  "references",
  "reportId",
  "requestId",
  "refId",
  "lineTarget",
  "usePurpose",
  "visibilityScope",
  "knowledgeScope",
  "knowledgeClaims",
])

const FORBIDDEN_SAFETY_KEYS = [
  /^(?:proposedUpdates?|proposedWikiUpdates?|pendingUpdates?|wikiWrites?|wikiWriteProposal|writeProposal|targetPath|targetPaths|strategy|applyUpdates?|acceptedUpdates?)$/i,
  /^(?:narrative|narration|playerNarration|playerFacingText|playerFacingNarration|visibleNarration|parallelLineText|nextActionOptions)$/i,
] as const

export interface OutlineBriefDraftReference {
  path: string
  sectionId?: string
  runtimeDeltaId?: string
  stableId?: string
  reason: string
}

export interface OutlineBriefDraft {
  briefId?: string
  playerFacingBrief: {
    summary: string
    currentSceneFocus: string
    allowedKnowledgeRefs: OutlineBriefDraftReference[]
    immediateReactions: string[]
    clueDirections: string[]
    mustNotRevealStableIds: string[]
  }
  parallelLineBrief: {
    summary: string
    allowedParallelRefs: OutlineBriefDraftReference[]
    parallelBeatFocus: string[]
    displayPolicy: "user_visible_pc_unknown" | "gm_only" | "hidden"
  }
  tensionBriefInput: {
    summary: string
    tensionLineUpdateCandidate?: {
      candidateId?: string
      summary: string
      sourceFuelIds?: string[]
      targetPlotArcIds?: string[]
      updateKind: "advance" | "hold" | "reverse" | "complicate" | "resolve"
      reason: string
    }
    relationshipPressure: string[]
    shouldAdvance: boolean
  }
  pacingDirective: {
    intent: "hold" | "soft_push" | "medium" | "strong" | "scene_cut"
    reason: string
    requiredMovement: string[]
    avoidStagnation: boolean
  }
  campaignDeltaRequirement: {
    required: boolean
    minimumDelta: "none" | "minor" | "meaningful" | "scene_changing"
    reason: string
    candidateSources: string[]
  }
  outlineImpactReport: {
    impactLevel: RpgOutlineImpactLevel
    affected: {
      lines: RpgNarrativeLine[]
      beats: OutlineBriefDraftStableRef[]
      reveals: OutlineBriefDraftStableRef[]
      branchConditions: OutlineBriefDraftStableRef[]
      plotArcs: OutlineBriefDraftStableRef[]
      tensionLine: OutlineBriefDraftStableRef[]
    }
    invalidatedAssumptions: string[]
    reason: string
    requiresRegeneration: boolean
  }
  warnings: string[]
}

type OutlineBriefDraftStableRef = string | { path?: string; sectionId?: string; stableId: string; reason?: string }

interface ReferenceMetadata {
  path: string
  sectionId?: string
  runtimeDeltaId?: string
  stableId?: string
  lineTarget: RpgNarrativeLine
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  knowledgeClaims?: OutlineBriefReference["knowledgeClaims"]
}

interface ReferencePolicy {
  references: ReferenceMetadata[]
  forbiddenPlayerPaths: Set<string>
  forbiddenPlayerPathSections: Set<string>
  forbiddenPlayerStableIds: Set<string>
}

export function parseOutlineBriefDraftJson(output: string): unknown {
  const trimmed = output.trim()
  if (!trimmed) throw new Error("OutlineBriefDraft JSON output is empty.")

  const fenced = JSON_FENCE_PATTERN.exec(trimmed)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  const jsonText = findFirstBalancedJsonObject(candidate)
  if (!jsonText) throw new Error("OutlineBriefDraft must be a JSON object.")
  return JSON.parse(jsonText)
}

export function parseAndValidateOutlineBriefDraft(output: string): OutlineBriefDraft {
  return validateOutlineBriefDraft(parseOutlineBriefDraftJson(output))
}

export function validateOutlineBriefDraft(value: unknown): OutlineBriefDraft {
  assertNoForbiddenSoftDraftKeys(value, FORBIDDEN_SAFETY_KEYS, "OutlineBriefDraft")
  const stripped = stripDerivableDraftKeys(value, DERIVABLE_DRAFT_KEYS, "OutlineBriefDraft")
  assertNoForbiddenDraftKeys(stripped.value)
  const record = expectRecord(stripped.value, "OutlineBriefDraft")
  const playerFacingBrief = expectRecord(record.playerFacingBrief, "OutlineBriefDraft.playerFacingBrief")
  const parallelLineBrief = expectRecord(record.parallelLineBrief, "OutlineBriefDraft.parallelLineBrief")
  const tensionBriefInput = expectRecord(record.tensionBriefInput, "OutlineBriefDraft.tensionBriefInput")
  const pacingDirective = expectRecord(record.pacingDirective, "OutlineBriefDraft.pacingDirective")
  const campaignDeltaRequirement = expectRecord(
    record.campaignDeltaRequirement,
    "OutlineBriefDraft.campaignDeltaRequirement",
  )
  const outlineImpactReport = expectRecord(record.outlineImpactReport, "OutlineBriefDraft.outlineImpactReport")

  const tensionCandidate = tensionBriefInput.tensionLineUpdateCandidate === undefined
    ? undefined
    : validateTensionCandidateDraft(tensionBriefInput.tensionLineUpdateCandidate)

  return {
    playerFacingBrief: {
      summary: readString(playerFacingBrief, "summary", "OutlineBriefDraft.playerFacingBrief.summary"),
      currentSceneFocus: readString(
        playerFacingBrief,
        "currentSceneFocus",
        "OutlineBriefDraft.playerFacingBrief.currentSceneFocus",
      ),
      allowedKnowledgeRefs: readDraftRefs(
        playerFacingBrief,
        "allowedKnowledgeRefs",
        "OutlineBriefDraft.playerFacingBrief.allowedKnowledgeRefs",
      ),
      immediateReactions: readStringArray(
        playerFacingBrief,
        "immediateReactions",
        "OutlineBriefDraft.playerFacingBrief.immediateReactions",
      ),
      clueDirections: readStringArray(playerFacingBrief, "clueDirections", "OutlineBriefDraft.playerFacingBrief.clueDirections"),
      mustNotRevealStableIds: readStringArray(
        playerFacingBrief,
        "mustNotRevealStableIds",
        "OutlineBriefDraft.playerFacingBrief.mustNotRevealStableIds",
      ),
    },
    parallelLineBrief: {
      summary: readString(parallelLineBrief, "summary", "OutlineBriefDraft.parallelLineBrief.summary"),
      allowedParallelRefs: readDraftRefs(
        parallelLineBrief,
        "allowedParallelRefs",
        "OutlineBriefDraft.parallelLineBrief.allowedParallelRefs",
      ),
      parallelBeatFocus: readStringArray(
        parallelLineBrief,
        "parallelBeatFocus",
        "OutlineBriefDraft.parallelLineBrief.parallelBeatFocus",
      ),
      displayPolicy: readEnum<OutlineBriefDraft["parallelLineBrief"]["displayPolicy"]>(
        parallelLineBrief,
        "displayPolicy",
        DISPLAY_POLICIES,
        "OutlineBriefDraft.parallelLineBrief.displayPolicy",
      ),
    },
    tensionBriefInput: {
      summary: readString(tensionBriefInput, "summary", "OutlineBriefDraft.tensionBriefInput.summary"),
      ...(tensionCandidate ? { tensionLineUpdateCandidate: tensionCandidate } : {}),
      relationshipPressure: readStringArray(
        tensionBriefInput,
        "relationshipPressure",
        "OutlineBriefDraft.tensionBriefInput.relationshipPressure",
      ),
      shouldAdvance: readBoolean(tensionBriefInput, "shouldAdvance", "OutlineBriefDraft.tensionBriefInput.shouldAdvance"),
    },
    pacingDirective: {
      intent: readEnum<OutlineBriefDraft["pacingDirective"]["intent"]>(
        pacingDirective,
        "intent",
        PACING_INTENTS,
        "OutlineBriefDraft.pacingDirective.intent",
      ),
      reason: readString(pacingDirective, "reason", "OutlineBriefDraft.pacingDirective.reason"),
      requiredMovement: readStringArray(
        pacingDirective,
        "requiredMovement",
        "OutlineBriefDraft.pacingDirective.requiredMovement",
      ),
      avoidStagnation: readBoolean(
        pacingDirective,
        "avoidStagnation",
        "OutlineBriefDraft.pacingDirective.avoidStagnation",
      ),
    },
    campaignDeltaRequirement: {
      required: readBoolean(
        campaignDeltaRequirement,
        "required",
        "OutlineBriefDraft.campaignDeltaRequirement.required",
      ),
      minimumDelta: readEnum<OutlineBriefDraft["campaignDeltaRequirement"]["minimumDelta"]>(
        campaignDeltaRequirement,
        "minimumDelta",
        MINIMUM_DELTAS,
        "OutlineBriefDraft.campaignDeltaRequirement.minimumDelta",
      ),
      reason: readString(campaignDeltaRequirement, "reason", "OutlineBriefDraft.campaignDeltaRequirement.reason"),
      candidateSources: readStringArray(
        campaignDeltaRequirement,
        "candidateSources",
        "OutlineBriefDraft.campaignDeltaRequirement.candidateSources",
      ),
    },
    outlineImpactReport: validateImpactReportDraft(outlineImpactReport),
    warnings: readStringArray(record, "warnings", "OutlineBriefDraft.warnings"),
  }
}

export function compileOutlineBriefDraftOutput(
  value: unknown,
  input: OutlineBriefCompilerInput,
): OutlineBriefCompilerOutput {
  const draft = validateOutlineBriefDraft(value)
  const policy = buildReferencePolicy(input)
  const playerFacingRefs = draft.playerFacingBrief.allowedKnowledgeRefs.map((ref, index) =>
    compileReference(ref, policy, `OutlineBriefDraft.playerFacingBrief.allowedKnowledgeRefs[${index}]`, {
      lineTarget: "playerVisibleLine",
      usePurpose: "narration",
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
      playerFacing: true,
    }),
  )
  const parallelRefs = draft.parallelLineBrief.allowedParallelRefs.map((ref, index) =>
    compileReference(ref, policy, `OutlineBriefDraft.parallelLineBrief.allowedParallelRefs[${index}]`, {
      lineTarget: "parallelLine",
      usePurpose: "narration",
      visibilityScope: "user_visible_pc_unknown",
      knowledgeScope: "user_only",
      playerFacing: false,
    }),
  )
  const selectedPlotArcFuel = resolveSelectedPlotArcTensionFuel(draft, input)
  const plotArcFuel = compilePlotArcFuelReferences(selectedPlotArcFuel)
  const allReferences = uniqueReferences([...playerFacingRefs, ...parallelRefs, ...plotArcFuel])
  const reportId = `outline-impact-${input.postActionWorkingState.submittedAction.id}`
  const affected = compileAffectedRefs(draft.outlineImpactReport.affected, policy)
  const output: OutlineBriefCompilerOutput = {
    outlineAwareNarrationBrief: {
      briefId: `outline-brief-${input.postActionWorkingState.submittedAction.id}`,
      sourceWorkingStateId: `post-action-working-state-${input.postActionWorkingState.submittedAction.id}`,
      playerFacingBrief: {
        summary: draft.playerFacingBrief.summary,
        currentSceneFocus: draft.playerFacingBrief.currentSceneFocus,
        allowedKnowledge: playerFacingRefs,
        immediateReactions: draft.playerFacingBrief.immediateReactions,
        clueDirections: draft.playerFacingBrief.clueDirections,
        mustNotRevealStableIds: draft.playerFacingBrief.mustNotRevealStableIds,
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
      },
      parallelLineBrief: {
        summary: draft.parallelLineBrief.summary,
        allowedParallelKnowledge: parallelRefs,
        parallelBeatFocus: draft.parallelLineBrief.parallelBeatFocus,
        displayPolicy: draft.parallelLineBrief.displayPolicy,
        grantsPcKnowledge: false,
      },
      tensionBriefInput: {
        summary: draft.tensionBriefInput.summary,
        ...(draft.tensionBriefInput.tensionLineUpdateCandidate
          ? { tensionLineUpdateCandidate: compileTensionCandidate(draft, input, selectedPlotArcFuel) }
          : {}),
        relationshipPressure: draft.tensionBriefInput.relationshipPressure,
        plotArcFuel,
        shouldAdvance: draft.tensionBriefInput.shouldAdvance,
      },
      revealPolicies: input.outlineSlices.flatMap((slice) => slice.revealPolicies),
      forbiddenNarrationBoundary: buildForbiddenNarrationBoundary(input),
      pacingDirective: draft.pacingDirective,
      campaignDeltaRequirement: draft.campaignDeltaRequirement,
      references: allReferences,
    },
    outlineImpactReport: {
      reportId,
      impactLevel: draft.outlineImpactReport.impactLevel,
      affected,
      invalidatedAssumptions: draft.outlineImpactReport.invalidatedAssumptions,
      reason: draft.outlineImpactReport.reason,
      requiresRegeneration: draft.outlineImpactReport.requiresRegeneration,
    },
    warnings: draft.warnings,
  }

  if (
    draft.outlineImpactReport.impactLevel === "major_rewrite_required" &&
    draft.outlineImpactReport.requiresRegeneration
  ) {
    output.regenerationRequest = compileRegenerationRequest(draft, output.outlineImpactReport.reportId, affected, allReferences, input)
  }

  return validateOutlineBriefCompilerOutput(output, input)
}

export function summarizeOutlineBriefDraft(draft: OutlineBriefDraft): unknown {
  return {
    briefId: draft.briefId ?? "(local)",
    allowedKnowledgeRefCount: draft.playerFacingBrief.allowedKnowledgeRefs.length,
    allowedParallelRefCount: draft.parallelLineBrief.allowedParallelRefs.length,
    sourceFuelIdCount: draft.tensionBriefInput.tensionLineUpdateCandidate?.sourceFuelIds?.length ?? 0,
    impactLevel: draft.outlineImpactReport.impactLevel,
    requiresRegeneration: draft.outlineImpactReport.requiresRegeneration,
    warningCount: draft.warnings.length,
  }
}

function compileReference(
  draftRef: OutlineBriefDraftReference,
  policy: ReferencePolicy,
  label: string,
  defaults: {
    lineTarget: RpgNarrativeLine
    usePurpose: RpgUsePurpose
    visibilityScope: RpgVisibilityScope
    knowledgeScope: RpgKnowledgeScope
    playerFacing: boolean
  },
): OutlineBriefReference {
  const metadata = findReferenceMetadata(policy, draftRef)
  if (!metadata && !policy.references.some((ref) => ref.path === draftRef.path)) {
    throw new Error(`Invalid ${label}.path: path is not known from outline brief input.`)
  }
  if (defaults.playerFacing) assertPlayerFacingDraftReferenceAllowed(draftRef, policy, label)
  return {
    path: draftRef.path,
    ...(draftRef.sectionId ? { sectionId: draftRef.sectionId } : {}),
    ...(draftRef.runtimeDeltaId ? { runtimeDeltaId: draftRef.runtimeDeltaId } : {}),
    ...(draftRef.stableId ? { stableId: draftRef.stableId } : {}),
    lineTarget: metadata?.lineTarget ?? defaults.lineTarget,
    usePurpose: defaults.usePurpose,
    visibilityScope: metadata?.visibilityScope ?? defaults.visibilityScope,
    knowledgeScope: metadata?.knowledgeScope ?? defaults.knowledgeScope,
    ...(metadata?.knowledgeClaims?.length ? { knowledgeClaims: metadata.knowledgeClaims } : {}),
    reason: draftRef.reason,
  }
}

function resolveSelectedPlotArcTensionFuel(
  draft: OutlineBriefDraft,
  input: OutlineBriefCompilerInput,
): OutlineBriefCompilerInput["plotArcTensionFuel"] {
  const candidate = draft.tensionBriefInput.tensionLineUpdateCandidate
  if (!candidate) return []

  const fuelById = new Map(input.plotArcTensionFuel.map((fuel) => [fuel.fuelId, fuel]))
  const sourceFuelIds = candidate.sourceFuelIds ?? input.plotArcTensionFuel.map((fuel) => fuel.fuelId)
  const seen = new Set<string>()
  const selected: OutlineBriefCompilerInput["plotArcTensionFuel"] = []

  sourceFuelIds.forEach((fuelId, index) => {
    if (seen.has(fuelId)) return
    const fuel = fuelById.get(fuelId)
    if (!fuel) {
      throw new Error(
        `Invalid OutlineBriefDraft.tensionBriefInput.tensionLineUpdateCandidate.sourceFuelIds[${index}]: fuel id is not known from plotArcTensionFuel.`,
      )
    }
    seen.add(fuelId)
    selected.push(fuel)
  })

  return selected
}

function compilePlotArcFuelReferences(
  selectedFuel: OutlineBriefCompilerInput["plotArcTensionFuel"],
): OutlineBriefReference[] {
  return selectedFuel.map((fuel) => ({
    path: fuel.path,
    sectionId: fuel.sectionId,
    stableId: fuel.fuelId,
    lineTarget: "tensionLine",
    usePurpose: "outlineControl",
    visibilityScope: "gm_only",
    knowledgeScope: "gm_only",
    reason: "Fuel tension-line guidance.",
  }))
}

function buildReferencePolicy(input: OutlineBriefCompilerInput): ReferencePolicy {
  const references: ReferenceMetadata[] = []
  const forbiddenPlayerPaths = new Set<string>()
  const forbiddenPlayerPathSections = new Set<string>()
  const forbiddenPlayerStableIds = new Set<string>()

  const add = (metadata: ReferenceMetadata | undefined) => {
    if (!metadata?.path) return
    references.push(metadata)
  }
  for (const material of input.recalledMaterials) {
    add({
      path: material.path,
      lineTarget: material.lineTarget,
      visibilityScope: material.visibilityScope,
      knowledgeScope: material.knowledgeScope,
      knowledgeClaims: material.knowledgeClaims,
    })
    for (const section of material.sections) {
      add({
        path: material.path,
        sectionId: section.sectionId,
        lineTarget: material.lineTarget,
        visibilityScope: material.visibilityScope,
        knowledgeScope: material.knowledgeScope,
        knowledgeClaims: material.knowledgeClaims,
      })
    }
  }
  for (const slice of input.outlineSlices) {
    add({
      path: slice.path,
      sectionId: slice.sectionId,
      lineTarget: slice.lineTarget,
      visibilityScope: slice.visibilityScope,
      knowledgeScope: slice.knowledgeScope,
      knowledgeClaims: slice.knowledgeClaims,
    })
    if (outlineSliceMustNotEnterPcKnowledge(slice)) {
      forbiddenPlayerPaths.add(slice.path)
      forbiddenPlayerPathSections.add(referenceKey(slice.path, slice.sectionId))
    }
    for (const stableRef of [...slice.beatRefs, ...slice.revealRefs, ...slice.branchConditionRefs]) {
      add({
        path: stableRef.path,
        sectionId: stableRef.sectionId,
        stableId: stableRef.stableId,
        lineTarget: stableRef.lineTarget,
        visibilityScope: slice.visibilityScope,
        knowledgeScope: slice.knowledgeScope,
        knowledgeClaims: slice.knowledgeClaims,
      })
      if (
        outlineSliceMustNotEnterPcKnowledge(slice) ||
        slice.revealPolicies.some((policy) =>
          policy.stableId === stableRef.stableId && policyMustNotEnterPcKnowledge(policy.policy)
        )
      ) {
        forbiddenPlayerStableIds.add(stableRef.stableId)
      }
    }
  }
  for (const fuel of input.plotArcTensionFuel) {
    add({
      path: fuel.path,
      sectionId: fuel.sectionId,
      stableId: fuel.fuelId,
      lineTarget: "tensionLine",
      visibilityScope: "gm_only",
      knowledgeScope: "gm_only",
    })
    add({
      path: fuel.path,
      sectionId: fuel.sectionId,
      stableId: fuel.plotArcId,
      lineTarget: "tensionLine",
      visibilityScope: "gm_only",
      knowledgeScope: "gm_only",
    })
  }
  for (const ref of [
    ...input.runtimeRefs,
    ...input.postActionWorkingState.runtimeDeltaRefs,
    ...input.actionResolution.runtimeDeltaRefs,
    ...input.worldTickResult.runtimeDeltaRefs,
  ]) {
    add({
      path: ref.sourcePath,
      runtimeDeltaId: ref.deltaId,
      lineTarget: "playerVisibleLine",
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
    })
  }
  for (const delta of [
    ...input.visibleSelection.currentSceneVisibleCandidates,
    ...input.visibleSelection.parallelLensCandidates,
    ...input.visibleSelection.tensionCandidates,
  ]) {
    for (const path of delta.affectedPaths) {
      add({
        path,
        lineTarget: delta.narrativeLine,
        visibilityScope: delta.visibilityScope,
        knowledgeScope: delta.knowledgeScope ?? "pc_known",
      })
    }
    for (const ref of delta.runtimeDeltaRefs) {
      add({
        path: ref.sourcePath,
        runtimeDeltaId: ref.deltaId,
        lineTarget: delta.narrativeLine,
        visibilityScope: delta.visibilityScope,
        knowledgeScope: delta.knowledgeScope ?? "pc_known",
      })
    }
  }
  for (const known of input.knownReferences) {
    add({
      path: known.path,
      sectionId: known.sectionId,
      runtimeDeltaId: known.runtimeDeltaId,
      stableId: known.stableId,
      lineTarget: "playerVisibleLine",
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
    })
  }

  return { references, forbiddenPlayerPaths, forbiddenPlayerPathSections, forbiddenPlayerStableIds }
}

function findReferenceMetadata(policy: ReferencePolicy, draftRef: OutlineBriefDraftReference): ReferenceMetadata | undefined {
  return policy.references.find((reference) =>
    reference.path === draftRef.path &&
    (draftRef.sectionId === undefined || reference.sectionId === draftRef.sectionId) &&
    (draftRef.runtimeDeltaId === undefined || reference.runtimeDeltaId === draftRef.runtimeDeltaId) &&
    (draftRef.stableId === undefined || reference.stableId === draftRef.stableId)
  )
}

function assertPlayerFacingDraftReferenceAllowed(
  draftRef: OutlineBriefDraftReference,
  policy: ReferencePolicy,
  label: string,
): void {
  if (policy.forbiddenPlayerPaths.has(draftRef.path)) {
    throw new Error(`Invalid ${label}: GM-only or delayed outline control material cannot enter PC knowledge.`)
  }
  if (draftRef.sectionId && policy.forbiddenPlayerPathSections.has(referenceKey(draftRef.path, draftRef.sectionId))) {
    throw new Error(`Invalid ${label}: GM-only or delayed outline control section cannot enter PC knowledge.`)
  }
  if (draftRef.stableId && policy.forbiddenPlayerStableIds.has(draftRef.stableId)) {
    throw new Error(`Invalid ${label}: forbidden reveal stableId cannot enter PC knowledge.`)
  }
}

function compileAffectedRefs(
  draftAffected: OutlineBriefDraft["outlineImpactReport"]["affected"],
  policy: ReferencePolicy,
): OutlineImpactAffectedRefs {
  return {
    lines: draftAffected.lines,
    beats: draftAffected.beats.map((ref, index) => compileStableRef(ref, policy, `affected.beats[${index}]`)),
    reveals: draftAffected.reveals.map((ref, index) => compileStableRef(ref, policy, `affected.reveals[${index}]`)),
    branchConditions: draftAffected.branchConditions.map((ref, index) =>
      compileStableRef(ref, policy, `affected.branchConditions[${index}]`),
    ),
    plotArcs: draftAffected.plotArcs.map((ref, index) => compileStableRef(ref, policy, `affected.plotArcs[${index}]`)),
    tensionLine: draftAffected.tensionLine.map((ref, index) =>
      compileStableRef(ref, policy, `affected.tensionLine[${index}]`),
    ),
  }
}

function compileStableRef(
  draftRef: OutlineBriefDraftStableRef,
  policy: ReferencePolicy,
  label: string,
): OutlineStableRef {
  const record = typeof draftRef === "string" ? { stableId: draftRef } : draftRef
  const metadata = policy.references.find((ref) =>
    ref.stableId === record.stableId &&
    (record.path === undefined || ref.path === record.path) &&
    (record.sectionId === undefined || ref.sectionId === record.sectionId)
  )
  if (!metadata) {
    throw new Error(`Invalid OutlineBriefDraft.${label}.stableId: stableId is not known from outline brief input.`)
  }
  return {
    refId: `outline-ref-${record.stableId}`,
    path: record.path ?? metadata.path,
    sectionId: record.sectionId ?? metadata.sectionId ?? "unknown-section",
    stableId: record.stableId,
    lineTarget: metadata.lineTarget,
    visibilityScope: metadata.visibilityScope,
    knowledgeScope: metadata.knowledgeScope,
    summary: record.reason ?? "Affected by outline brief draft impact report.",
  }
}

function compileRegenerationRequest(
  draft: OutlineBriefDraft,
  reportId: string,
  affected: OutlineImpactAffectedRefs,
  sourceRefs: OutlineBriefReference[],
  input: OutlineBriefCompilerInput,
): RegenerationRequest {
  return {
    requestId: `regeneration-request-${input.postActionWorkingState.submittedAction.id}`,
    sourceImpactReportId: reportId,
    impactLevel: "major_rewrite_required",
    reason: draft.outlineImpactReport.reason,
    affectedLines: affected.lines.length > 0 ? affected.lines : ["playerVisibleLine"],
    sourceRefs,
    mustPreserve: input.hardConstraints.flatMap((constraint) => constraint.mustPreserve),
    mustRecheck: [
      ...draft.outlineImpactReport.invalidatedAssumptions,
      ...input.outlineSlices.flatMap((slice) => slice.invalidationNotes),
    ],
  }
}

function compileTensionCandidate(
  draft: OutlineBriefDraft,
  input: OutlineBriefCompilerInput,
  selectedFuel: OutlineBriefCompilerInput["plotArcTensionFuel"],
): TensionLineUpdateCandidate {
  const candidate = draft.tensionBriefInput.tensionLineUpdateCandidate
  if (!candidate) throw new Error("Missing tensionLineUpdateCandidate.")
  return {
    candidateId: candidate.candidateId ?? `tension-candidate-${input.postActionWorkingState.submittedAction.id}`,
    summary: candidate.summary,
    sourceFuelIds: selectedFuel.map((fuel) => fuel.fuelId),
    targetPlotArcIds: candidate.targetPlotArcIds ?? selectedFuel.map((fuel) => fuel.plotArcId),
    updateKind: candidate.updateKind,
    reason: candidate.reason,
  }
}

function buildForbiddenNarrationBoundary(input: OutlineBriefCompilerInput): ForbiddenNarrationItem[] {
  return [
    ...input.hardConstraints.map((constraint) => ({
      itemId: `forbidden-${constraint.constraintId}`,
      sourcePath: constraint.sourcePath,
      ...(constraint.sectionId ? { sectionId: constraint.sectionId } : {}),
      lineTarget: constraint.appliesToLines[0] ?? "tensionLine",
      visibilityScope: "gm_only" as const,
      knowledgeScope: "gm_only" as const,
      reason: constraint.summary,
    })),
    ...input.outlineSlices
      .filter(outlineSliceMustNotEnterPcKnowledge)
      .map((slice) => ({
        itemId: `forbidden-${slice.sliceId}`,
        sourcePath: slice.path,
        sectionId: slice.sectionId,
        lineTarget: slice.lineTarget,
        visibilityScope: slice.visibilityScope,
        knowledgeScope: slice.knowledgeScope,
        reason: slice.outlineControl?.boundaryNote ?? slice.summary,
      })),
  ]
}

function uniqueReferences(references: OutlineBriefReference[]): OutlineBriefReference[] {
  const seen = new Set<string>()
  return references.filter((reference) => {
    const key = [reference.path, reference.sectionId ?? "", reference.runtimeDeltaId ?? "", reference.stableId ?? ""].join("|")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function validateTensionCandidateDraft(value: unknown): NonNullable<OutlineBriefDraft["tensionBriefInput"]["tensionLineUpdateCandidate"]> {
  const record = expectRecord(value, "OutlineBriefDraft.tensionBriefInput.tensionLineUpdateCandidate")
  return {
    ...(typeof record.candidateId === "string" && record.candidateId.trim() ? { candidateId: record.candidateId.trim() } : {}),
    summary: readString(record, "summary", "OutlineBriefDraft.tensionBriefInput.tensionLineUpdateCandidate.summary"),
    sourceFuelIds: optionalStringArray(record, "sourceFuelIds", "OutlineBriefDraft.tensionBriefInput.tensionLineUpdateCandidate.sourceFuelIds"),
    targetPlotArcIds: optionalStringArray(
      record,
      "targetPlotArcIds",
      "OutlineBriefDraft.tensionBriefInput.tensionLineUpdateCandidate.targetPlotArcIds",
    ),
    updateKind: readEnum(
      record,
      "updateKind",
      UPDATE_KINDS,
      "OutlineBriefDraft.tensionBriefInput.tensionLineUpdateCandidate.updateKind",
    ) as NonNullable<OutlineBriefDraft["tensionBriefInput"]["tensionLineUpdateCandidate"]>["updateKind"],
    reason: readString(record, "reason", "OutlineBriefDraft.tensionBriefInput.tensionLineUpdateCandidate.reason"),
  }
}

function validateImpactReportDraft(record: Record<string, unknown>): OutlineBriefDraft["outlineImpactReport"] {
  const affected = expectRecord(record.affected, "OutlineBriefDraft.outlineImpactReport.affected")
  return {
    impactLevel: readEnum<RpgOutlineImpactLevel>(
      record,
      "impactLevel",
      IMPACT_LEVELS,
      "OutlineBriefDraft.outlineImpactReport.impactLevel",
    ),
    affected: {
      lines: readArray(affected, "lines", "OutlineBriefDraft.outlineImpactReport.affected.lines")
        .map((line, index) =>
          readEnumValue(line, LINE_TARGETS, `OutlineBriefDraft.outlineImpactReport.affected.lines[${index}]`)
        ),
      beats: readStableRefArray(affected, "beats"),
      reveals: readStableRefArray(affected, "reveals"),
      branchConditions: readStableRefArray(affected, "branchConditions"),
      plotArcs: readStableRefArray(affected, "plotArcs"),
      tensionLine: readStableRefArray(affected, "tensionLine"),
    },
    invalidatedAssumptions: readStringArray(
      record,
      "invalidatedAssumptions",
      "OutlineBriefDraft.outlineImpactReport.invalidatedAssumptions",
    ),
    reason: readString(record, "reason", "OutlineBriefDraft.outlineImpactReport.reason"),
    requiresRegeneration: readBoolean(record, "requiresRegeneration", "OutlineBriefDraft.outlineImpactReport.requiresRegeneration"),
  }
}

function readStableRefArray(record: Record<string, unknown>, key: string): OutlineBriefDraftStableRef[] {
  return readArray(record, key, `OutlineBriefDraft.outlineImpactReport.affected.${key}`).map((entry, index) => {
    if (typeof entry === "string" && entry.trim()) return entry.trim()
    const ref = expectRecord(entry, `OutlineBriefDraft.outlineImpactReport.affected.${key}[${index}]`)
    return {
      ...(typeof ref.path === "string" && ref.path.trim() ? { path: ref.path.trim() } : {}),
      ...(typeof ref.sectionId === "string" && ref.sectionId.trim() ? { sectionId: ref.sectionId.trim() } : {}),
      stableId: readString(ref, "stableId", `OutlineBriefDraft.outlineImpactReport.affected.${key}[${index}].stableId`),
      ...(typeof ref.reason === "string" && ref.reason.trim() ? { reason: ref.reason.trim() } : {}),
    }
  })
}

function readDraftRefs(record: Record<string, unknown>, key: string, label: string): OutlineBriefDraftReference[] {
  return readArray(record, key, label).map((entry, index) => {
    const ref = expectRecord(entry, `${label}[${index}]`)
    return {
      path: readString(ref, "path", `${label}[${index}].path`),
      ...(typeof ref.sectionId === "string" && ref.sectionId.trim() ? { sectionId: ref.sectionId.trim() } : {}),
      ...(typeof ref.runtimeDeltaId === "string" && ref.runtimeDeltaId.trim() ? { runtimeDeltaId: ref.runtimeDeltaId.trim() } : {}),
      ...(typeof ref.stableId === "string" && ref.stableId.trim() ? { stableId: ref.stableId.trim() } : {}),
      reason: readString(ref, "reason", `${label}[${index}].reason`),
    }
  })
}

function assertNoForbiddenDraftKeys(value: unknown, path = "OutlineBriefDraft"): void {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenDraftKeys(entry, `${path}[${index}]`))
    return
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/^(?:outlineAwareNarrationBrief|allowedKnowledge|allowedParallelKnowledge|plotArcFuel|plotArcFuelRefs|sourceRefs|reportId|requestId)$/iu.test(key)) {
      throw new Error(`Invalid OutlineBriefDraft: forbidden canonical key ${path}.${key}.`)
    }
    assertNoForbiddenDraftKeys(child, `${path}.${key}`)
  }
}

function outlineSliceMustNotEnterPcKnowledge(input: OutlineBriefCompilerInput["outlineSlices"][number]): boolean {
  return input.outlineControl?.mustNotRevealTo.includes("pc") === true ||
    input.visibilityScope === "gm_only" ||
    input.visibilityScope === "hidden"
}

function policyMustNotEnterPcKnowledge(policy: string): boolean {
  return policy === "delay" || policy === "forbid" || policy === "gm_only" || policy === "parallel_only"
}

function referenceKey(path: string, sectionId: string): string {
  return `${path}#${sectionId}`
}

function findFirstBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{")
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === "\"") inString = false
      continue
    }
    if (char === "\"") inString = true
    else if (char === "{") depth += 1
    else if (char === "}") {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return null
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an object.`)
  }
  return value as Record<string, unknown>
}

function readString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${label}: must be a non-empty string.`)
  }
  return value.trim()
}

function readStringArray(record: Record<string, unknown>, key: string, label: string): string[] {
  return readArray(record, key, label).map((entry, index) => {
    if (typeof entry !== "string") throw new Error(`Invalid ${label}[${index}]: must be a string.`)
    return entry.trim()
  }).filter(Boolean)
}

function optionalStringArray(record: Record<string, unknown>, key: string, label: string): string[] | undefined {
  if (record[key] === undefined) return undefined
  return readStringArray(record, key, label)
}

function readArray(record: Record<string, unknown>, key: string, label: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}: must be an array.`)
  return value
}

function readBoolean(record: Record<string, unknown>, key: string, label: string): boolean {
  const value = record[key]
  if (typeof value !== "boolean") throw new Error(`Invalid ${label}: must be a boolean.`)
  return value
}

function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T> | ReadonlySet<string>,
  label: string,
): T {
  return readEnumValue(record[key], allowed, label) as T
}

function readEnumValue<T extends string>(value: unknown, allowed: ReadonlySet<T> | ReadonlySet<string>, label: string): T {
  const allowedValues = allowed as ReadonlySet<string>
  if (typeof value !== "string" || !allowedValues.has(value)) {
    throw new Error(`Invalid ${label}: value is not allowed.`)
  }
  return value as T
}

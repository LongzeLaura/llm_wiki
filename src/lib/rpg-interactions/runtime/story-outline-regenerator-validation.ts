import type {
  OutlineRevisionProposal,
  OutlineStableRef,
  OutlineVisibilityBoundary,
  ProvisionalNarrationHandoff,
  ProvisionalOutlinePatch,
  RegenerationSafetyReport,
  StoryOutlineRegeneratorInput,
  StoryOutlineRegeneratorOutput,
} from "../../rpg-runtime/types"
import type {
  RpgKnowledgeScope,
  RpgNarrativeLine,
  RpgRuntimeDeltaRef,
  RpgVisibilityScope,
} from "../../rpg-wiki-schema"
import { normalizeRuntimeDeltaRefsDraft } from "./soft-draft-protocol"

const ALLOWED_LINE_TARGETS = new Set<RpgNarrativeLine>([
  "playerVisibleLine",
  "parallelLine",
  "tensionLine",
])

const PLAYER_KNOWLEDGE_SCOPES = new Set<RpgKnowledgeScope>(["pc_known", "pc_misunderstanding"])
const PLAYER_VISIBILITY_SCOPES = new Set<RpgVisibilityScope>(["pc_visible", "pc_inferred"])
const FORBIDDEN_TO_PC_VISIBILITY = new Set<RpgVisibilityScope>([
  "user_visible_pc_unknown",
  "gm_only",
  "hidden",
])

const FORBIDDEN_OUTPUT_KEYS = [
  {
    pattern:
      /^(?:wikiWrites?|wikiWriteProposal|writeProposal|targetPath|targetPaths|applyUpdates?|acceptedUpdates?|fileContent|fullOutlineText|rawOutline)$/i,
    message: "Story Outline Regenerator must not output wiki writes, file bodies, or direct write targets.",
  },
  {
    pattern:
      /^(?:narration|narrative|playerNarration|playerFacingText|playerFacingNarration|visibleNarration|parallelLineText|nextActionOptions)$/i,
    message: "Story Outline Regenerator must not output player-facing prose or next action options.",
  },
  {
    pattern:
      /^(?:runtimeUpdate|runtimeStateUpdate|runtimeWikiUpdate|proposedUpdate|proposedUpdates|proposedWikiUpdate|proposedWikiUpdates|pendingUpdates)$/i,
    message: "Story Outline Regenerator must not output ordinary runtime updates or ProposedWikiUpdate records.",
  },
  {
    pattern: /^(?:events|eventWrite|eventWrites|eventUpdate|eventUpdates)$/i,
    message: "Story Outline Regenerator must not write future outline plans into events.",
  },
] as const

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "provisionalOutlinePatch",
  "outlineRevisionProposal",
  "regenerationSafetyReport",
  "warnings",
])

export function compileStoryOutlineRegeneratorDraftOutput(
  value: unknown,
  input: StoryOutlineRegeneratorInput,
): StoryOutlineRegeneratorOutput {
  assertNoForbiddenOutputKeys(value)
  assertNoForbiddenPaths(value)
  assertNoUnsafeBoundaryClaims(value)
  const record = expectRecord(value, "StoryOutlineRegeneratorDraft")
  assertOnlyTopLevelKeys(record)

  if (input.outlineImpactReport.impactLevel !== "major_rewrite_required" || !input.outlineImpactReport.requiresRegeneration) {
    throw new Error("Invalid StoryOutlineRegeneratorInput: output can be accepted only for major_rewrite_required regeneration requests.")
  }

  const knownRefs = collectKnownReferences(input)
  const refCatalog = buildStoryRegeneratorReferenceCatalog(input)
  const patchRecord = expectRecord(record.provisionalOutlinePatch, "StoryOutlineRegeneratorDraft.provisionalOutlinePatch")
  const proposalRecord = expectRecord(record.outlineRevisionProposal, "StoryOutlineRegeneratorDraft.outlineRevisionProposal")
  const handoffRecord = expectRecord(
    patchRecord.narrationHandoff ?? {},
    "StoryOutlineRegeneratorDraft.provisionalOutlinePatch.narrationHandoff",
  )
  const proposedRevisionRecord = expectRecord(
    proposalRecord.proposedRevision ?? {},
    "StoryOutlineRegeneratorDraft.outlineRevisionProposal.proposedRevision",
  )
  const safetyRecord = expectRecord(record.regenerationSafetyReport ?? {}, "StoryOutlineRegeneratorDraft.regenerationSafetyReport")

  const patchId = `provisional-outline-patch-${input.regenerationRequest.requestId}`
  const runtimeDeltaRefs = compileRuntimeRefsForDraft(
    patchRecord.runtimeDeltaRefs,
    refCatalog.runtimeRefs,
    input.runtimeRefs.slice(0, 1),
  )
  const affectedOutlineRefs = compileStableRefsForDraft(
    patchRecord.affectedOutlineRefs,
    refCatalog.stableRefs,
    input.regenerationRequest.sourceRefs.flatMap((ref) => ref.stableId ? [ref.stableId] : []),
  )
  const suspendedBeatRefs = compileStableRefsForDraft(
    patchRecord.suspendedBeatRefs,
    refCatalog.stableRefs,
    [],
  )
  const invalidatedBeatRefs = compileStableRefsForDraft(
    patchRecord.invalidatedBeatRefs,
    refCatalog.stableRefs,
    suspendedBeatRefs.map((ref) => ref.stableId),
  )
  const preservedConfirmedFacts = uniqueStrings([
    ...readOptionalStringArrayValue(patchRecord, "preservedConfirmedFacts"),
    ...input.confirmedFacts.map((fact) => fact.factId),
  ])
  const narrativeLines = compileNarrativeLines(patchRecord.narrativeLines, ["playerVisibleLine", "tensionLine"])
  const visibilityBoundary = compileVisibilityBoundariesForDraft(
    patchRecord.visibilityBoundary,
    refCatalog.visibilityBoundaries,
    input.visibilityBoundaries,
    knownRefs,
  )
  const handoffRuntimeRefs = compileRuntimeRefsForDraft(
    handoffRecord.runtimeDeltaRefs,
    refCatalog.runtimeRefs,
    runtimeDeltaRefs,
  )
  const handoffOutlineRefs = compileStableRefsForDraft(
    handoffRecord.outlineRefs,
    refCatalog.stableRefs,
    affectedOutlineRefs.map((ref) => ref.stableId),
  )
  const handoffVisibilityBoundaries = compileVisibilityBoundariesForDraft(
    handoffRecord.visibilityBoundaries,
    refCatalog.visibilityBoundaries,
    visibilityBoundary,
    knownRefs,
  )
  const proposalTargetRefs = compileStableRefsForDraft(
    proposalRecord.targetOutlineRefs,
    refCatalog.stableRefs,
    affectedOutlineRefs.map((ref) => ref.stableId),
  )
  const proposalRuntimeRefs = compileRuntimeRefsForDraft(
    proposalRecord.runtimeDeltaRefs,
    refCatalog.runtimeRefs,
    runtimeDeltaRefs,
  )
  const proposalVisibility = compileVisibilityBoundariesForDraft(
    proposalRecord.visibilityAndKnowledgeScope,
    refCatalog.visibilityBoundaries,
    visibilityBoundary,
    knownRefs,
  )
  const mustNotReveal = uniqueStrings([
    ...readOptionalStringArrayValue(handoffRecord, "mustNotReveal"),
    ...input.forbiddenReveals.flatMap((reveal) => [reveal.revealId, reveal.stableId].filter((entry): entry is string => !!entry)),
  ])
  const nextSceneDirection = readString(
    handoffRecord,
    "nextSceneDirection",
    "StoryOutlineRegeneratorDraft.provisionalOutlinePatch.narrationHandoff.nextSceneDirection",
  )
  const proposedRevisionSummary = readString(
    proposedRevisionRecord,
    "summary",
    "StoryOutlineRegeneratorDraft.outlineRevisionProposal.proposedRevision.summary",
  )
  assertExactString(
    safetyRecord,
    "safetyConclusion",
    "safe",
    "StoryOutlineRegeneratorDraft.regenerationSafetyReport.safetyConclusion",
  )
  const mustPreserveFacts = uniqueStrings([
    ...readOptionalStringArrayValue(handoffRecord, "mustPreserveFacts"),
    ...preservedConfirmedFacts,
  ])
  const proposalMustPreserveFacts = uniqueStrings([
    ...readOptionalStringArrayValue(proposalRecord, "mustPreserveFacts"),
    ...preservedConfirmedFacts,
  ])

  const output: StoryOutlineRegeneratorOutput = {
    provisionalOutlinePatch: {
      patchId,
      sourceRequestId: input.regenerationRequest.requestId,
      scope: "same_turn_only",
      outlineImpactLevel: "major_rewrite_required",
      affectedOutlineRefs,
      suspendedBeatRefs,
      invalidatedBeatRefs,
      preservedConfirmedFacts,
      runtimeDeltaRefs,
      narrativeLines,
      visibilityBoundary,
      narrationHandoff: {
        handoffId: `provisional-narration-handoff-${input.regenerationRequest.requestId}`,
        sourcePatchId: patchId,
        mustFollow: readOptionalStringArrayValue(handoffRecord, "mustFollow"),
        mustPreserveFacts,
        mustNotReveal,
        invalidatedOldBeats: readOptionalStringArrayValue(handoffRecord, "invalidatedOldBeats"),
        nextSceneDirection,
        narrativeLines: compileNarrativeLines(handoffRecord.narrativeLines, narrativeLines),
        visibilityBoundaries: handoffVisibilityBoundaries,
        runtimeDeltaRefs: handoffRuntimeRefs,
        outlineRefs: handoffOutlineRefs,
        grantsPcKnowledgeFromHiddenMaterial: false,
      },
      nonPersistenceBoundary: {
        sameTurnOnly: true,
        writesToWiki: false,
        modifiesMainOutline: false,
        persistedToOutlinesMain: false,
        ordinaryRuntimeUpdate: false,
        acceptedWikiFacts: false,
      },
    },
    outlineRevisionProposal: {
      proposalId: `outline-revision-proposal-${input.regenerationRequest.requestId}`,
      sourceRequestId: input.regenerationRequest.requestId,
      reviewItemKind: "outlineRevision",
      outlineImpactLevel: "major_rewrite_required",
      targetOutlineRefs: proposalTargetRefs,
      invalidatedAssumptions: readOptionalStringArrayValue(proposalRecord, "invalidatedAssumptions"),
      mustPreserveFacts: proposalMustPreserveFacts,
      proposedRevision: {
        summary: proposedRevisionSummary,
        revisedBeats: readOptionalStringArrayValue(proposedRevisionRecord, "revisedBeats"),
        revisedRevealOrder: readOptionalStringArrayValue(proposedRevisionRecord, "revisedRevealOrder"),
        branchAdjustments: readOptionalStringArrayValue(proposedRevisionRecord, "branchAdjustments"),
        futureOnly: true,
      },
      visibilityAndKnowledgeScope: proposalVisibility,
      runtimeDeltaRefs: proposalRuntimeRefs,
      reviewBoundary: {
        reviewItemKind: "outlineRevision",
        reviewBoundary: "independent_pending_review",
        ordinaryRuntimeUpdate: false,
        proposedWikiUpdate: false,
        autoWriteMainOutline: false,
        mainOutlineWritePolicy: "manual_or_review_only",
      },
    },
    regenerationSafetyReport: {
      reportKind: "regenerationSafetyReport",
      safetyConclusion: "safe",
      preservesConfirmedFacts: true,
      futureNotWrittenAsEvent: true,
      forbiddenRevealProtected: true,
      mainOutlineNotDirectlyModified: true,
      provisionalPatchNonPersistent: true,
      proposalReviewBoundary: true,
      ordinaryRuntimeUpdateBoundary: true,
      noWikiWrite: true,
      noPlayerFacingProse: true,
      checkedRuntimeRefs: uniqueStrings([
        ...readOptionalStringArrayValue(safetyRecord, "checkedRuntimeRefs"),
        ...runtimeDeltaRefs.map((ref) => ref.deltaId),
      ]),
      checkedOutlineRefs: uniqueStrings([
        ...readOptionalStringArrayValue(safetyRecord, "checkedOutlineRefs"),
        ...affectedOutlineRefs.map((ref) => ref.stableId),
      ]),
      warnings: readOptionalStringArrayValue(safetyRecord, "warnings"),
    },
    warnings: readOptionalStringArrayValue(record, "warnings"),
  }

  return validateStoryOutlineRegeneratorOutput(output, input)
}

export function validateStoryOutlineRegeneratorOutput(
  value: unknown,
  input: StoryOutlineRegeneratorInput,
): StoryOutlineRegeneratorOutput {
  assertNoForbiddenOutputKeys(value)
  assertNoForbiddenPaths(value)
  const record = expectRecord(value, "StoryOutlineRegeneratorOutput")
  assertOnlyTopLevelKeys(record)

  if (input.outlineImpactReport.impactLevel !== "major_rewrite_required" || !input.outlineImpactReport.requiresRegeneration) {
    throw new Error("Invalid StoryOutlineRegeneratorInput: output can be accepted only for major_rewrite_required regeneration requests.")
  }

  const knownRefs = collectKnownReferences(input)
  const provisionalOutlinePatch = validateProvisionalOutlinePatch(
    record.provisionalOutlinePatch,
    input,
    knownRefs,
  )
  const outlineRevisionProposal = validateOutlineRevisionProposal(
    record.outlineRevisionProposal,
    input,
    knownRefs,
  )
  const regenerationSafetyReport = validateRegenerationSafetyReport(
    record.regenerationSafetyReport,
    knownRefs,
  )
  const warnings = readStringArray(record, "warnings", "StoryOutlineRegeneratorOutput.warnings")

  assertPreservesConfirmedFacts(provisionalOutlinePatch, outlineRevisionProposal, input)
  assertNoForbiddenRevealLeak(provisionalOutlinePatch, outlineRevisionProposal, input)

  return {
    provisionalOutlinePatch,
    outlineRevisionProposal,
    regenerationSafetyReport,
    warnings,
  }
}

function validateProvisionalOutlinePatch(
  value: unknown,
  input: StoryOutlineRegeneratorInput,
  knownRefs: KnownReferenceSet,
): ProvisionalOutlinePatch {
  const record = expectRecord(value, "provisionalOutlinePatch")
  readString(record, "patchId", "provisionalOutlinePatch.patchId")
  const sourceRequestId = readString(record, "sourceRequestId", "provisionalOutlinePatch.sourceRequestId")
  if (sourceRequestId !== input.regenerationRequest.requestId) {
    throw new Error("Invalid provisionalOutlinePatch.sourceRequestId: must match regenerationRequest.requestId.")
  }
  assertExactString(record, "scope", "same_turn_only", "provisionalOutlinePatch.scope")
  assertExactString(
    record,
    "outlineImpactLevel",
    "major_rewrite_required",
    "provisionalOutlinePatch.outlineImpactLevel",
  )
  const affectedOutlineRefs = validateStableRefsArray(
    readArray(record, "affectedOutlineRefs", "provisionalOutlinePatch.affectedOutlineRefs"),
    "provisionalOutlinePatch.affectedOutlineRefs",
    knownRefs,
  )
  const suspendedBeatRefs = validateStableRefsArray(
    readArray(record, "suspendedBeatRefs", "provisionalOutlinePatch.suspendedBeatRefs"),
    "provisionalOutlinePatch.suspendedBeatRefs",
    knownRefs,
  )
  const invalidatedBeatRefs = validateStableRefsArray(
    readArray(record, "invalidatedBeatRefs", "provisionalOutlinePatch.invalidatedBeatRefs"),
    "provisionalOutlinePatch.invalidatedBeatRefs",
    knownRefs,
  )
  const preservedConfirmedFacts = readStringArray(
    record,
    "preservedConfirmedFacts",
    "provisionalOutlinePatch.preservedConfirmedFacts",
  )
  const runtimeDeltaRefs = readArray(
    record,
    "runtimeDeltaRefs",
    "provisionalOutlinePatch.runtimeDeltaRefs",
  ).map((entry, index) => validateRuntimeDeltaRef(entry, index, "provisionalOutlinePatch.runtimeDeltaRefs", knownRefs))
  const narrativeLines = readArray(record, "narrativeLines", "provisionalOutlinePatch.narrativeLines").map(
    (line, index) => readEnumValue(line, ALLOWED_LINE_TARGETS, `provisionalOutlinePatch.narrativeLines[${index}]`),
  )
  const visibilityBoundary = readArray(
    record,
    "visibilityBoundary",
    "provisionalOutlinePatch.visibilityBoundary",
  ).map((entry, index) => validateVisibilityBoundary(entry, index, "provisionalOutlinePatch.visibilityBoundary", knownRefs))
  const narrationHandoff = validateNarrationHandoff(record.narrationHandoff, record.patchId, knownRefs)
  const nonPersistenceBoundary = expectRecord(
    record.nonPersistenceBoundary,
    "provisionalOutlinePatch.nonPersistenceBoundary",
  )
  assertExactBoolean(nonPersistenceBoundary, "sameTurnOnly", true, "provisionalOutlinePatch.nonPersistenceBoundary.sameTurnOnly")
  assertExactBoolean(nonPersistenceBoundary, "writesToWiki", false, "provisionalOutlinePatch.nonPersistenceBoundary.writesToWiki")
  assertExactBoolean(nonPersistenceBoundary, "modifiesMainOutline", false, "provisionalOutlinePatch.nonPersistenceBoundary.modifiesMainOutline")
  assertExactBoolean(nonPersistenceBoundary, "persistedToOutlinesMain", false, "provisionalOutlinePatch.nonPersistenceBoundary.persistedToOutlinesMain")
  assertExactBoolean(nonPersistenceBoundary, "ordinaryRuntimeUpdate", false, "provisionalOutlinePatch.nonPersistenceBoundary.ordinaryRuntimeUpdate")
  assertExactBoolean(nonPersistenceBoundary, "acceptedWikiFacts", false, "provisionalOutlinePatch.nonPersistenceBoundary.acceptedWikiFacts")

  return {
    patchId: String(record.patchId),
    sourceRequestId,
    scope: "same_turn_only",
    outlineImpactLevel: "major_rewrite_required",
    affectedOutlineRefs,
    suspendedBeatRefs,
    invalidatedBeatRefs,
    preservedConfirmedFacts,
    runtimeDeltaRefs,
    narrativeLines,
    visibilityBoundary,
    narrationHandoff,
    nonPersistenceBoundary: {
      sameTurnOnly: true,
      writesToWiki: false,
      modifiesMainOutline: false,
      persistedToOutlinesMain: false,
      ordinaryRuntimeUpdate: false,
      acceptedWikiFacts: false,
    },
  }
}

function validateNarrationHandoff(
  value: unknown,
  expectedPatchId: unknown,
  knownRefs: KnownReferenceSet,
): ProvisionalNarrationHandoff {
  const record = expectRecord(value, "provisionalOutlinePatch.narrationHandoff")
  readString(record, "handoffId", "provisionalOutlinePatch.narrationHandoff.handoffId")
  const sourcePatchId = readString(
    record,
    "sourcePatchId",
    "provisionalOutlinePatch.narrationHandoff.sourcePatchId",
  )
  if (sourcePatchId !== expectedPatchId) {
    throw new Error("Invalid provisionalOutlinePatch.narrationHandoff.sourcePatchId: must match patchId.")
  }
  const mustFollow = readStringArray(record, "mustFollow", "provisionalOutlinePatch.narrationHandoff.mustFollow")
  const mustPreserveFacts = readStringArray(
    record,
    "mustPreserveFacts",
    "provisionalOutlinePatch.narrationHandoff.mustPreserveFacts",
  )
  const mustNotReveal = readStringArray(
    record,
    "mustNotReveal",
    "provisionalOutlinePatch.narrationHandoff.mustNotReveal",
  )
  const invalidatedOldBeats = readStringArray(
    record,
    "invalidatedOldBeats",
    "provisionalOutlinePatch.narrationHandoff.invalidatedOldBeats",
  )
  const nextSceneDirection = readString(
    record,
    "nextSceneDirection",
    "provisionalOutlinePatch.narrationHandoff.nextSceneDirection",
  )
  const narrativeLines = readArray(
    record,
    "narrativeLines",
    "provisionalOutlinePatch.narrationHandoff.narrativeLines",
  ).map((line, index) =>
    readEnumValue(line, ALLOWED_LINE_TARGETS, `provisionalOutlinePatch.narrationHandoff.narrativeLines[${index}]`),
  )
  const visibilityBoundaries = readArray(
    record,
    "visibilityBoundaries",
    "provisionalOutlinePatch.narrationHandoff.visibilityBoundaries",
  ).map((entry, index) =>
    validateVisibilityBoundary(entry, index, "provisionalOutlinePatch.narrationHandoff.visibilityBoundaries", knownRefs),
  )
  const runtimeDeltaRefs = readArray(
    record,
    "runtimeDeltaRefs",
    "provisionalOutlinePatch.narrationHandoff.runtimeDeltaRefs",
  ).map((entry, index) =>
    validateRuntimeDeltaRef(entry, index, "provisionalOutlinePatch.narrationHandoff.runtimeDeltaRefs", knownRefs),
  )
  const outlineRefs = validateStableRefsArray(
    readArray(record, "outlineRefs", "provisionalOutlinePatch.narrationHandoff.outlineRefs"),
    "provisionalOutlinePatch.narrationHandoff.outlineRefs",
    knownRefs,
  )
  assertExactBoolean(
    record,
    "grantsPcKnowledgeFromHiddenMaterial",
    false,
    "provisionalOutlinePatch.narrationHandoff.grantsPcKnowledgeFromHiddenMaterial",
  )

  return {
    handoffId: String(record.handoffId),
    sourcePatchId,
    mustFollow,
    mustPreserveFacts,
    mustNotReveal,
    invalidatedOldBeats,
    nextSceneDirection,
    narrativeLines,
    visibilityBoundaries,
    runtimeDeltaRefs,
    outlineRefs,
    grantsPcKnowledgeFromHiddenMaterial: false,
  }
}

function validateOutlineRevisionProposal(
  value: unknown,
  input: StoryOutlineRegeneratorInput,
  knownRefs: KnownReferenceSet,
): OutlineRevisionProposal {
  const record = expectRecord(value, "outlineRevisionProposal")
  readString(record, "proposalId", "outlineRevisionProposal.proposalId")
  const sourceRequestId = readString(record, "sourceRequestId", "outlineRevisionProposal.sourceRequestId")
  if (sourceRequestId !== input.regenerationRequest.requestId) {
    throw new Error("Invalid outlineRevisionProposal.sourceRequestId: must match regenerationRequest.requestId.")
  }
  assertExactString(record, "reviewItemKind", "outlineRevision", "outlineRevisionProposal.reviewItemKind")
  assertExactString(
    record,
    "outlineImpactLevel",
    "major_rewrite_required",
    "outlineRevisionProposal.outlineImpactLevel",
  )
  const targetOutlineRefs = validateStableRefsArray(
    readArray(record, "targetOutlineRefs", "outlineRevisionProposal.targetOutlineRefs"),
    "outlineRevisionProposal.targetOutlineRefs",
    knownRefs,
  )
  const invalidatedAssumptions = readStringArray(
    record,
    "invalidatedAssumptions",
    "outlineRevisionProposal.invalidatedAssumptions",
  )
  const mustPreserveFacts = readStringArray(
    record,
    "mustPreserveFacts",
    "outlineRevisionProposal.mustPreserveFacts",
  )
  const proposedRevisionRecord = expectRecord(record.proposedRevision, "outlineRevisionProposal.proposedRevision")
  const proposedRevision = {
    summary: readString(proposedRevisionRecord, "summary", "outlineRevisionProposal.proposedRevision.summary"),
    revisedBeats: readStringArray(
      proposedRevisionRecord,
      "revisedBeats",
      "outlineRevisionProposal.proposedRevision.revisedBeats",
    ),
    revisedRevealOrder: readStringArray(
      proposedRevisionRecord,
      "revisedRevealOrder",
      "outlineRevisionProposal.proposedRevision.revisedRevealOrder",
    ),
    branchAdjustments: readStringArray(
      proposedRevisionRecord,
      "branchAdjustments",
      "outlineRevisionProposal.proposedRevision.branchAdjustments",
    ),
    futureOnly: readBoolean(proposedRevisionRecord, "futureOnly", "outlineRevisionProposal.proposedRevision.futureOnly"),
  }
  if (proposedRevision.futureOnly !== true) {
    throw new Error("Invalid outlineRevisionProposal.proposedRevision.futureOnly: proposal must remain future-only.")
  }
  const visibilityAndKnowledgeScope = readArray(
    record,
    "visibilityAndKnowledgeScope",
    "outlineRevisionProposal.visibilityAndKnowledgeScope",
  ).map((entry, index) =>
    validateVisibilityBoundary(entry, index, "outlineRevisionProposal.visibilityAndKnowledgeScope", knownRefs),
  )
  const runtimeDeltaRefs = readArray(
    record,
    "runtimeDeltaRefs",
    "outlineRevisionProposal.runtimeDeltaRefs",
  ).map((entry, index) => validateRuntimeDeltaRef(entry, index, "outlineRevisionProposal.runtimeDeltaRefs", knownRefs))
  const reviewBoundary = expectRecord(record.reviewBoundary, "outlineRevisionProposal.reviewBoundary")
  assertExactString(
    reviewBoundary,
    "reviewItemKind",
    "outlineRevision",
    "outlineRevisionProposal.reviewBoundary.reviewItemKind",
  )
  assertExactString(
    reviewBoundary,
    "reviewBoundary",
    "independent_pending_review",
    "outlineRevisionProposal.reviewBoundary.reviewBoundary",
  )
  assertExactBoolean(
    reviewBoundary,
    "ordinaryRuntimeUpdate",
    false,
    "outlineRevisionProposal.reviewBoundary.ordinaryRuntimeUpdate",
  )
  assertExactBoolean(
    reviewBoundary,
    "proposedWikiUpdate",
    false,
    "outlineRevisionProposal.reviewBoundary.proposedWikiUpdate",
  )
  assertExactBoolean(
    reviewBoundary,
    "autoWriteMainOutline",
    false,
    "outlineRevisionProposal.reviewBoundary.autoWriteMainOutline",
  )
  assertExactString(
    reviewBoundary,
    "mainOutlineWritePolicy",
    "manual_or_review_only",
    "outlineRevisionProposal.reviewBoundary.mainOutlineWritePolicy",
  )

  return {
    proposalId: String(record.proposalId),
    sourceRequestId,
    reviewItemKind: "outlineRevision",
    outlineImpactLevel: "major_rewrite_required",
    targetOutlineRefs,
    invalidatedAssumptions,
    mustPreserveFacts,
    proposedRevision: {
      ...proposedRevision,
      futureOnly: true,
    },
    visibilityAndKnowledgeScope,
    runtimeDeltaRefs,
    reviewBoundary: {
      reviewItemKind: "outlineRevision",
      reviewBoundary: "independent_pending_review",
      ordinaryRuntimeUpdate: false,
      proposedWikiUpdate: false,
      autoWriteMainOutline: false,
      mainOutlineWritePolicy: "manual_or_review_only",
    },
  }
}

function validateRegenerationSafetyReport(
  value: unknown,
  knownRefs: KnownReferenceSet,
): RegenerationSafetyReport {
  const record = expectRecord(value, "regenerationSafetyReport")
  assertExactString(record, "reportKind", "regenerationSafetyReport", "regenerationSafetyReport.reportKind")
  assertExactString(record, "safetyConclusion", "safe", "regenerationSafetyReport.safetyConclusion")
  for (const key of [
    "preservesConfirmedFacts",
    "futureNotWrittenAsEvent",
    "forbiddenRevealProtected",
    "mainOutlineNotDirectlyModified",
    "provisionalPatchNonPersistent",
    "proposalReviewBoundary",
    "ordinaryRuntimeUpdateBoundary",
    "noWikiWrite",
    "noPlayerFacingProse",
  ] as const) {
    assertExactBoolean(record, key, true, `regenerationSafetyReport.${key}`)
  }
  const checkedRuntimeRefs = readStringArray(
    record,
    "checkedRuntimeRefs",
    "regenerationSafetyReport.checkedRuntimeRefs",
  )
  checkedRuntimeRefs.forEach((deltaId) => {
    if (!knownRefs.runtimeDeltaIds.has(deltaId)) {
      throw new Error("Invalid regenerationSafetyReport.checkedRuntimeRefs: runtime ref is not known from input.")
    }
  })
  const checkedOutlineRefs = readStringArray(
    record,
    "checkedOutlineRefs",
    "regenerationSafetyReport.checkedOutlineRefs",
  )
  checkedOutlineRefs.forEach((stableId) => {
    if (!knownRefs.stableIds.has(stableId)) {
      throw new Error("Invalid regenerationSafetyReport.checkedOutlineRefs: outline ref is not known from input.")
    }
  })
  const warnings = readStringArray(record, "warnings", "regenerationSafetyReport.warnings")

  return {
    reportKind: "regenerationSafetyReport",
    safetyConclusion: "safe",
    preservesConfirmedFacts: true,
    futureNotWrittenAsEvent: true,
    forbiddenRevealProtected: true,
    mainOutlineNotDirectlyModified: true,
    provisionalPatchNonPersistent: true,
    proposalReviewBoundary: true,
    ordinaryRuntimeUpdateBoundary: true,
    noWikiWrite: true,
    noPlayerFacingProse: true,
    checkedRuntimeRefs,
    checkedOutlineRefs,
    warnings,
  }
}

function validateStableRefsArray(
  values: unknown[],
  label: string,
  knownRefs: KnownReferenceSet,
): OutlineStableRef[] {
  return values.map((value, index) => validateStableRef(value, `${label}[${index}]`, knownRefs))
}

function validateStableRef(value: unknown, label: string, knownRefs: KnownReferenceSet): OutlineStableRef {
  const record = expectRecord(value, label)
  validatePathAndSection(record, label, knownRefs)
  const stableId = readString(record, "stableId", `${label}.stableId`)
  if (!knownRefs.stableIds.has(stableId)) {
    throw new Error(`Invalid ${label}.stableId: stableId is not known from input outline refs.`)
  }
  return {
    refId: readString(record, "refId", `${label}.refId`),
    path: readString(record, "path", `${label}.path`),
    sectionId: readString(record, "sectionId", `${label}.sectionId`),
    stableId,
    summary: readString(record, "summary", `${label}.summary`),
    lineTarget: readEnum(record, "lineTarget", ALLOWED_LINE_TARGETS, `${label}.lineTarget`),
    visibilityScope: readString(record, "visibilityScope", `${label}.visibilityScope`) as RpgVisibilityScope,
    knowledgeScope: readString(record, "knowledgeScope", `${label}.knowledgeScope`) as RpgKnowledgeScope,
  }
}

function validateVisibilityBoundary(
  value: unknown,
  index: number,
  labelPrefix: string,
  knownRefs: KnownReferenceSet,
) {
  const label = `${labelPrefix}[${index}]`
  const record = expectRecord(value, label)
  if (record.sourcePath !== undefined || record.path !== undefined) validatePathAndSection(record, label, knownRefs)
  const visibilityScope = readString(record, "visibilityScope", `${label}.visibilityScope`) as RpgVisibilityScope
  const knowledgeScope = readString(record, "knowledgeScope", `${label}.knowledgeScope`) as RpgKnowledgeScope
  const grantsPcKnowledge = readBoolean(record, "grantsPcKnowledge", `${label}.grantsPcKnowledge`)
  if (grantsPcKnowledge && (FORBIDDEN_TO_PC_VISIBILITY.has(visibilityScope) || !PLAYER_KNOWLEDGE_SCOPES.has(knowledgeScope))) {
    throw new Error(`Invalid ${label}: hidden, gm_only, parallel-line, or user_visible_pc_unknown material cannot become PC knowledge.`)
  }
  if (PLAYER_VISIBILITY_SCOPES.has(visibilityScope) && !PLAYER_KNOWLEDGE_SCOPES.has(knowledgeScope)) {
    throw new Error(`Invalid ${label}: player-visible material must not carry non-PC knowledge scope.`)
  }
  return {
    boundaryId: readString(record, "boundaryId", `${label}.boundaryId`),
    lineTarget: readEnum(record, "lineTarget", ALLOWED_LINE_TARGETS, `${label}.lineTarget`),
    visibilityScope,
    knowledgeScope,
    grantsPcKnowledge,
    sourcePath: readOptionalString(record, "sourcePath", `${label}.sourcePath`),
    sectionId: readOptionalString(record, "sectionId", `${label}.sectionId`),
    reason: readString(record, "reason", `${label}.reason`),
  }
}

function validateRuntimeDeltaRef(
  value: unknown,
  index: number,
  labelPrefix: string,
  knownRefs: KnownReferenceSet,
): RpgRuntimeDeltaRef {
  const label = `${labelPrefix}[${index}]`
  const record = expectRecord(value, label)
  const deltaId = readString(record, "deltaId", `${label}.deltaId`)
  if (!knownRefs.runtimeDeltaIds.has(deltaId)) {
    throw new Error(`Invalid ${label}.deltaId: runtime delta id is not known from input.`)
  }
  return {
    deltaId,
    sourceStage: readString(record, "sourceStage", `${label}.sourceStage`) as RpgRuntimeDeltaRef["sourceStage"],
    sourcePath: readString(record, "sourcePath", `${label}.sourcePath`),
    summary: readString(record, "summary", `${label}.summary`),
    narrativeLine: readEnum(record, "narrativeLine", ALLOWED_LINE_TARGETS, `${label}.narrativeLine`),
    usePurpose: readString(record, "usePurpose", `${label}.usePurpose`) as RpgRuntimeDeltaRef["usePurpose"],
    happenedStatus: readString(record, "happenedStatus", `${label}.happenedStatus`) as RpgRuntimeDeltaRef["happenedStatus"],
  }
}

function assertPreservesConfirmedFacts(
  provisionalOutlinePatch: ProvisionalOutlinePatch,
  outlineRevisionProposal: OutlineRevisionProposal,
  input: StoryOutlineRegeneratorInput,
): void {
  const patchPreserved = new Set(provisionalOutlinePatch.preservedConfirmedFacts)
  const handoffPreserved = new Set(provisionalOutlinePatch.narrationHandoff.mustPreserveFacts)
  const proposalPreserved = new Set(outlineRevisionProposal.mustPreserveFacts)

  for (const fact of input.confirmedFacts) {
    if (!patchPreserved.has(fact.factId) || !handoffPreserved.has(fact.factId) || !proposalPreserved.has(fact.factId)) {
      throw new Error("Invalid StoryOutlineRegeneratorOutput: every confirmed fact boundary must be explicitly preserved.")
    }
    const unsafeText = [
      ...outlineRevisionProposal.invalidatedAssumptions,
      outlineRevisionProposal.proposedRevision.summary,
      ...outlineRevisionProposal.proposedRevision.revisedBeats,
      ...outlineRevisionProposal.proposedRevision.revisedRevealOrder,
      ...outlineRevisionProposal.proposedRevision.branchAdjustments,
      ...provisionalOutlinePatch.narrationHandoff.invalidatedOldBeats,
    ].join("\n").toLowerCase()
    if (unsafeText.includes(fact.factId.toLowerCase()) || unsafeText.includes(fact.summary.toLowerCase())) {
      throw new Error("Invalid StoryOutlineRegeneratorOutput: confirmed facts must not be rewritten or invalidated.")
    }
  }
}

function assertNoForbiddenRevealLeak(
  provisionalOutlinePatch: ProvisionalOutlinePatch,
  outlineRevisionProposal: OutlineRevisionProposal,
  input: StoryOutlineRegeneratorInput,
): void {
  const safeText = [
    ...provisionalOutlinePatch.narrationHandoff.mustNotReveal,
    ...provisionalOutlinePatch.narrationHandoff.outlineRefs.map((ref) => ref.stableId),
    ...outlineRevisionProposal.targetOutlineRefs.map((ref) => ref.stableId),
  ].join("\n").toLowerCase()
  const unsafeText = [
    ...provisionalOutlinePatch.narrationHandoff.mustFollow,
    provisionalOutlinePatch.narrationHandoff.nextSceneDirection,
    ...outlineRevisionProposal.proposedRevision.revisedBeats,
    ...outlineRevisionProposal.proposedRevision.branchAdjustments,
  ].join("\n").toLowerCase()

  for (const reveal of input.forbiddenReveals) {
    const markers = [reveal.revealId, reveal.stableId].filter(Boolean).map((marker) => marker!.toLowerCase())
    if (markers.some((marker) => unsafeText.includes(marker))) {
      throw new Error("Invalid StoryOutlineRegeneratorOutput: forbidden reveal leaked into actionable or player-facing handoff guidance.")
    }
    if (!markers.some((marker) => safeText.includes(marker))) {
      throw new Error("Invalid StoryOutlineRegeneratorOutput: forbidden reveal boundary must be explicitly protected.")
    }
  }
}

function assertNoForbiddenOutputKeys(value: unknown, path = "StoryOutlineRegeneratorOutput"): void {
  if (value === null || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenOutputKeys(entry, `${path}[${index}]`))
    return
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const forbidden = FORBIDDEN_OUTPUT_KEYS.find((entry) => entry.pattern.test(key))
    const isSafeBoundaryDeclaration =
      path.endsWith(".reviewBoundary")
      && key === "proposedWikiUpdate"
      && child === false
    if (forbidden && !isSafeBoundaryDeclaration) {
      throw new Error(`Invalid StoryOutlineRegeneratorOutput: ${forbidden.message} Forbidden key ${path}.${key}.`)
    }
    assertNoForbiddenOutputKeys(child, `${path}.${key}`)
  }
}

function assertNoForbiddenPaths(value: unknown, path = "StoryOutlineRegeneratorOutput"): void {
  if (value === null || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenPaths(entry, `${path}[${index}]`))
    return
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((key === "path" || key === "sourcePath") && typeof child === "string") {
      const normalized = normalizePath(child)
      if (normalized === "wiki/outlines/main.md") {
        throw new Error("Invalid StoryOutlineRegeneratorOutput: direct wiki/outlines/main.md modification is forbidden.")
      }
      if (normalized.startsWith("wiki/events/")) {
        throw new Error("Invalid StoryOutlineRegeneratorOutput: future outline plans must not be written into events.")
      }
    }
    assertNoForbiddenPaths(child, `${path}.${key}`)
  }
}

function assertOnlyTopLevelKeys(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      throw new Error(`Invalid StoryOutlineRegeneratorOutput.${key}: top-level key is not allowed.`)
    }
  }
}

interface StoryRegeneratorReferenceCatalog {
  runtimeRefs: RpgRuntimeDeltaRef[]
  stableRefs: Map<string, OutlineStableRef>
  visibilityBoundaries: Map<string, OutlineVisibilityBoundary>
}

function buildStoryRegeneratorReferenceCatalog(input: StoryOutlineRegeneratorInput): StoryRegeneratorReferenceCatalog {
  const stableRefs = new Map<string, OutlineStableRef>()
  const addStableRef = (ref: OutlineStableRef) => {
    if (!stableRefs.has(ref.stableId)) stableRefs.set(ref.stableId, ref)
  }
  input.outlineSlices.forEach((slice) => {
    slice.beatRefs.forEach(addStableRef)
    slice.revealRefs.forEach(addStableRef)
    slice.branchConditionRefs.forEach(addStableRef)
  })

  const visibilityBoundaries = new Map<string, OutlineVisibilityBoundary>()
  input.visibilityBoundaries.forEach((boundary) => {
    visibilityBoundaries.set(boundary.boundaryId, boundary)
  })

  const runtimeRefs = uniqueRuntimeRefs([
    ...input.runtimeRefs,
    ...input.postActionWorkingState.runtimeDeltaRefs,
    ...input.confirmedFacts.flatMap((fact) => fact.runtimeDeltaRefs),
  ])

  return { runtimeRefs, stableRefs, visibilityBoundaries }
}

function compileRuntimeRefsForDraft(
  value: unknown,
  inputRefs: readonly RpgRuntimeDeltaRef[],
  fallback: readonly RpgRuntimeDeltaRef[],
): RpgRuntimeDeltaRef[] {
  const refs = normalizeRuntimeDeltaRefsDraft(value, inputRefs)
  return refs.length > 0 ? refs : uniqueRuntimeRefs(fallback)
}

function compileStableRefsForDraft(
  value: unknown,
  stableRefs: ReadonlyMap<string, OutlineStableRef>,
  fallbackStableIds: readonly string[],
): OutlineStableRef[] {
  const ids = readDraftStableIds(value)
  const resolved = ids.map((id) => stableRefs.get(id)).filter((ref): ref is OutlineStableRef => !!ref)
  if (resolved.length > 0) return uniqueStableRefs(resolved)
  return uniqueStableRefs(fallbackStableIds.map((id) => stableRefs.get(id)).filter((ref): ref is OutlineStableRef => !!ref))
}

function readDraftStableIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    if (typeof entry === "string") return entry.trim()
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const stableId = (entry as Record<string, unknown>).stableId
      return typeof stableId === "string" ? stableId.trim() : ""
    }
    return ""
  }).filter(Boolean)
}

function compileVisibilityBoundariesForDraft(
  value: unknown,
  knownBoundaries: ReadonlyMap<string, OutlineVisibilityBoundary>,
  fallback: readonly OutlineVisibilityBoundary[],
  knownRefs: KnownReferenceSet,
): OutlineVisibilityBoundary[] {
  if (!Array.isArray(value)) return [...fallback]
  const result: OutlineVisibilityBoundary[] = []
  for (const [index, entry] of value.entries()) {
    if (typeof entry === "string") {
      const boundary = knownBoundaries.get(entry.trim())
      if (boundary) result.push(boundary)
      continue
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue
    const boundaryId = (entry as Record<string, unknown>).boundaryId
    const known = typeof boundaryId === "string" ? knownBoundaries.get(boundaryId.trim()) : undefined
    result.push(known ?? validateVisibilityBoundary(entry, index, "StoryOutlineRegeneratorDraft.visibilityBoundaries", knownRefs))
  }
  return result.length > 0 ? uniqueVisibilityBoundaries(result) : [...fallback]
}

function compileNarrativeLines(value: unknown, fallback: readonly RpgNarrativeLine[]): RpgNarrativeLine[] {
  if (!Array.isArray(value)) return [...fallback]
  const lines = value.filter((line): line is RpgNarrativeLine =>
    typeof line === "string" && ALLOWED_LINE_TARGETS.has(line as RpgNarrativeLine)
  )
  return lines.length > 0 ? uniqueStrings(lines) as RpgNarrativeLine[] : [...fallback]
}

function readOptionalStringArrayValue(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)
}

function uniqueRuntimeRefs(refs: readonly RpgRuntimeDeltaRef[]): RpgRuntimeDeltaRef[] {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    if (seen.has(ref.deltaId)) return false
    seen.add(ref.deltaId)
    return true
  })
}

function uniqueStableRefs(refs: readonly OutlineStableRef[]): OutlineStableRef[] {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    if (seen.has(ref.stableId)) return false
    seen.add(ref.stableId)
    return true
  })
}

function uniqueVisibilityBoundaries(
  boundaries: readonly OutlineVisibilityBoundary[],
): OutlineVisibilityBoundary[] {
  const seen = new Set<string>()
  return boundaries.filter((boundary) => {
    if (seen.has(boundary.boundaryId)) return false
    seen.add(boundary.boundaryId)
    return true
  })
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function assertNoUnsafeBoundaryClaims(value: unknown, path = "StoryOutlineRegeneratorDraft"): void {
  if (value === null || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoUnsafeBoundaryClaims(entry, `${path}[${index}]`))
    return
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (
      child === true &&
      /^(?:writesToWiki|modifiesMainOutline|persistedToOutlinesMain|ordinaryRuntimeUpdate|acceptedWikiFacts|proposedWikiUpdate|autoWriteMainOutline)$/i.test(key)
    ) {
      throw new Error(`Invalid StoryOutlineRegeneratorDraft: unsafe boundary claim ${path}.${key}.`)
    }
    if (key === "futureOnly" && child === false) {
      throw new Error(`Invalid StoryOutlineRegeneratorDraft: proposed revision must remain future-only at ${path}.${key}.`)
    }
    assertNoUnsafeBoundaryClaims(child, `${path}.${key}`)
  }
}

interface KnownReferenceSet {
  paths: Set<string>
  sectionsByPath: Map<string, Set<string>>
  runtimeDeltaIds: Set<string>
  stableIds: Set<string>
}

function collectKnownReferences(input: StoryOutlineRegeneratorInput): KnownReferenceSet {
  const knownRefs: KnownReferenceSet = {
    paths: new Set(),
    sectionsByPath: new Map(),
    runtimeDeltaIds: new Set(),
    stableIds: new Set(),
  }
  const addPath = (path?: string, sectionId?: string) => {
    if (!path) return
    const normalized = normalizePath(path)
    knownRefs.paths.add(normalized)
    if (sectionId) {
      const sections = knownRefs.sectionsByPath.get(normalized) ?? new Set<string>()
      sections.add(sectionId)
      knownRefs.sectionsByPath.set(normalized, sections)
    }
  }
  const addRuntimeRef = (ref: RpgRuntimeDeltaRef) => {
    addPath(ref.sourcePath)
    knownRefs.runtimeDeltaIds.add(ref.deltaId)
  }
  const addStableRef = (ref: OutlineStableRef) => {
    addPath(ref.path, ref.sectionId)
    knownRefs.stableIds.add(ref.stableId)
  }

  input.recalledMaterials.forEach((material) => {
    addPath(material.path)
    material.sections.forEach((section) => addPath(material.path, section.sectionId))
  })
  input.outlineSlices.forEach((slice) => {
    addPath(slice.path, slice.sectionId)
    slice.beatRefs.forEach(addStableRef)
    slice.revealRefs.forEach(addStableRef)
    slice.branchConditionRefs.forEach(addStableRef)
    slice.dependencies.forEach((dependency) => {
      knownRefs.stableIds.add(dependency.dependencyId)
      dependency.dependsOnStableIds.forEach((stableId) => knownRefs.stableIds.add(stableId))
      dependency.invalidatedByStableIds.forEach((stableId) => knownRefs.stableIds.add(stableId))
    })
  })
  input.plotArcTensionFuel.forEach((fuel) => {
    addPath(fuel.path, fuel.sectionId)
    knownRefs.stableIds.add(fuel.fuelId)
    knownRefs.stableIds.add(fuel.plotArcId)
  })
  input.visibilityBoundaries.forEach((boundary) => {
    addPath(boundary.sourcePath, boundary.sectionId)
    knownRefs.stableIds.add(boundary.boundaryId)
  })
  input.hardConstraints.forEach((constraint) => {
    addPath(constraint.sourcePath, constraint.sectionId)
    knownRefs.stableIds.add(constraint.constraintId)
  })
  input.confirmedFacts.forEach((fact) => {
    fact.sourceRefs.forEach((ref) => {
      addPath(ref.path, ref.sectionId)
      if (ref.runtimeDeltaId) knownRefs.runtimeDeltaIds.add(ref.runtimeDeltaId)
      if (ref.stableId) knownRefs.stableIds.add(ref.stableId)
    })
    fact.runtimeDeltaRefs.forEach(addRuntimeRef)
  })
  input.forbiddenReveals.forEach((reveal) => {
    addPath(reveal.sourcePath, reveal.sectionId)
    knownRefs.stableIds.add(reveal.revealId)
    if (reveal.stableId) knownRefs.stableIds.add(reveal.stableId)
  })
  input.runtimeRefs.forEach(addRuntimeRef)
  input.postActionWorkingState.runtimeDeltaRefs.forEach(addRuntimeRef)
  input.knownReferences.forEach((ref) => {
    addPath(ref.path, ref.sectionId)
    if (ref.runtimeDeltaId) knownRefs.runtimeDeltaIds.add(ref.runtimeDeltaId)
    if (ref.stableId) knownRefs.stableIds.add(ref.stableId)
  })
  input.regenerationRequest.sourceRefs.forEach((ref) => {
    addPath(ref.path, ref.sectionId)
    if (ref.runtimeDeltaId) knownRefs.runtimeDeltaIds.add(ref.runtimeDeltaId)
    if (ref.stableId) knownRefs.stableIds.add(ref.stableId)
  })

  return knownRefs
}

function validatePathAndSection(
  record: Record<string, unknown>,
  label: string,
  knownRefs: KnownReferenceSet,
): void {
  const path =
    typeof record.path === "string"
      ? record.path
      : typeof record.sourcePath === "string"
        ? record.sourcePath
        : ""
  const normalized = normalizePath(path)
  if (!normalized || !knownRefs.paths.has(normalized)) {
    throw new Error(`Invalid ${label}.path: path is not present in input refs.`)
  }
  if (record.sectionId !== undefined) {
    const sectionId = readString(record, "sectionId", `${label}.sectionId`)
    const knownSections = knownRefs.sectionsByPath.get(normalized)
    if (!knownSections?.has(sectionId)) {
      throw new Error(`Invalid ${label}.sectionId: sectionId is not known for path ${path}.`)
    }
  }
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

function readOptionalString(record: Record<string, unknown>, key: string, label: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== "string") {
    throw new Error(`Invalid ${label}: must be a string when provided.`)
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function readStringArray(record: Record<string, unknown>, key: string, label: string): string[] {
  return readArray(record, key, label)
    .map((entry, index) => {
      if (typeof entry !== "string") {
        throw new Error(`Invalid ${label}[${index}]: must be a string.`)
      }
      return entry.trim()
    })
    .filter(Boolean)
}

function readArray(record: Record<string, unknown>, key: string, label: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}: must be an array.`)
  }
  return value
}

function readBoolean(record: Record<string, unknown>, key: string, label: string): boolean {
  const value = record[key]
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${label}: must be a boolean.`)
  }
  return value
}

function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T>,
  label: string,
): T {
  return readEnumValue(record[key], allowed, label)
}

function readEnumValue<T extends string>(value: unknown, allowed: ReadonlySet<T>, label: string): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`Invalid ${label}: value is not allowed.`)
  }
  return value as T
}

function assertExactString(
  record: Record<string, unknown>,
  key: string,
  expected: string,
  label: string,
): void {
  const value = readString(record, key, label)
  if (value !== expected) {
    throw new Error(`Invalid ${label}: must be ${expected}.`)
  }
}

function assertExactBoolean(
  record: Record<string, unknown>,
  key: string,
  expected: boolean,
  label: string,
): void {
  const value = readBoolean(record, key, label)
  if (value !== expected) {
    throw new Error(`Invalid ${label}: must be ${String(expected)}.`)
  }
}

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.?\//, "").replace(/^\/+/, "").replace(/\/+/g, "/").toLowerCase()
}

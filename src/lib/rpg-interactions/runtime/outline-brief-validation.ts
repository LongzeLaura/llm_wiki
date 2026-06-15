import type {
  OutlineAwareNarrationBrief,
  OutlineBriefCompilerInput,
  OutlineBriefCompilerOutput,
  OutlineBriefReference,
  OutlineImpactReport,
  RegenerationRequest,
} from "../../rpg-runtime/types"
import type {
  RpgKnowledgeScope,
  RpgNarrativeLine,
  RpgOutlineImpactLevel,
  RpgUsePurpose,
  RpgVisibilityScope,
} from "../../rpg-wiki-schema"
import { getRpgOutlineImpactLevels } from "../../rpg-wiki-schema"
import { isConcreteNonPcActorRef, validateRpgKnowledgeClaim } from "../../rpg-runtime/actor-knowledge"

const ALLOWED_IMPACT_LEVELS = new Set<RpgOutlineImpactLevel>(getRpgOutlineImpactLevels())

const ALLOWED_LINE_TARGETS = new Set<RpgNarrativeLine>([
  "playerVisibleLine",
  "parallelLine",
  "tensionLine",
])

const ALLOWED_VISIBILITY_SCOPES = new Set<RpgVisibilityScope>([
  "pc_visible",
  "pc_inferred",
  "user_visible_pc_unknown",
  "gm_only",
  "hidden",
])

const ALLOWED_KNOWLEDGE_SCOPES = new Set<RpgKnowledgeScope>([
  "pc_known",
  "pc_misunderstanding",
  "npc_known",
  "user_only",
  "gm_only",
  "unknown_to_pc",
])

const ALLOWED_USE_PURPOSES = new Set<RpgUsePurpose>([
  "actionResolution",
  "worldTick",
  "recall",
  "outlineControl",
  "ruleCheck",
  "narration",
  "writeback",
  "reviewOnly",
  "journalOnly",
])

const PLAYER_FACING_VISIBILITY = new Set<RpgVisibilityScope>(["pc_visible", "pc_inferred"])
const PLAYER_FACING_KNOWLEDGE = new Set<RpgKnowledgeScope>(["pc_known", "pc_misunderstanding"])

const FORBIDDEN_OUTPUT_KEYS = [
  {
    pattern: /^(?:narration|narrative)$/i,
    message: "Outline Brief Compiler must not generate player narration.",
  },
  {
    pattern: /^(?:playerFacingText|parallelLineText|nextActionOptions)$/i,
    message: "Outline Brief Compiler must not generate player prose, parallel prose, or next action options.",
  },
  {
    pattern: /^(?:wikiWrites?|wikiWriteProposal|proposedUpdates?|pendingUpdates?)$/i,
    message: "Outline Brief Compiler must not generate wiki writes or runtime update proposals.",
  },
  {
    pattern: /^(?:outlineRevision|outlineRevisionProposal|provisionalOutlinePatch)$/i,
    message: "Outline Brief Compiler must not generate outline revisions or provisional patches.",
  },
  {
    pattern: /^(?:fullOutlineText|rawOutline|fileContent)$/i,
    message: "Outline Brief Compiler must not include raw file or full outline content.",
  },
] as const

export function validateOutlineBriefCompilerOutput(
  value: unknown,
  input: OutlineBriefCompilerInput,
): OutlineBriefCompilerOutput {
  assertNoForbiddenOutputKeys(value)

  const record = expectRecord(value, "OutlineBriefCompilerOutput")
  assertOnlyTopLevelKeys(record)

  const knownRefs = collectKnownReferences(input)
  const outlineAwareNarrationBrief = validateOutlineAwareNarrationBrief(
    record.outlineAwareNarrationBrief,
    knownRefs,
  )
  const outlineImpactReport = validateOutlineImpactReport(record.outlineImpactReport, knownRefs)
  const warnings = readStringArray(record, "warnings", "OutlineBriefCompilerOutput.warnings")
  const regenerationRequest =
    record.regenerationRequest === undefined
      ? undefined
      : validateRegenerationRequest(record.regenerationRequest, outlineImpactReport, knownRefs)

  if (outlineImpactReport.impactLevel === "major_rewrite_required" && !outlineImpactReport.requiresRegeneration) {
    throw new Error(
      "Invalid OutlineImpactReport.requiresRegeneration: major_rewrite_required must require regeneration.",
    )
  }
  if (outlineImpactReport.impactLevel !== "major_rewrite_required" && outlineImpactReport.requiresRegeneration) {
    throw new Error(
      "Invalid OutlineImpactReport.requiresRegeneration: non-major impact must not require regeneration in this contract version.",
    )
  }
  if (regenerationRequest && outlineImpactReport.impactLevel !== "major_rewrite_required") {
    throw new Error(
      "Invalid regenerationRequest: only major_rewrite_required impact may include a regeneration request.",
    )
  }

  return {
    outlineAwareNarrationBrief,
    outlineImpactReport,
    ...(regenerationRequest ? { regenerationRequest } : {}),
    warnings,
  }
}

function validateOutlineAwareNarrationBrief(
  value: unknown,
  knownRefs: KnownReferenceSet,
): OutlineAwareNarrationBrief {
  const record = expectRecord(value, "outlineAwareNarrationBrief")
  readString(record, "briefId", "outlineAwareNarrationBrief.briefId")
  readString(record, "sourceWorkingStateId", "outlineAwareNarrationBrief.sourceWorkingStateId")

  const playerFacingBrief = expectRecord(
    record.playerFacingBrief,
    "outlineAwareNarrationBrief.playerFacingBrief",
  )
  assertPlayerFacingKnowledgeBoundary(playerFacingBrief)
  readString(playerFacingBrief, "summary", "outlineAwareNarrationBrief.playerFacingBrief.summary")
  readString(
    playerFacingBrief,
    "currentSceneFocus",
    "outlineAwareNarrationBrief.playerFacingBrief.currentSceneFocus",
  )
  readEnum(
    playerFacingBrief,
    "visibilityScope",
    PLAYER_FACING_VISIBILITY,
    "outlineAwareNarrationBrief.playerFacingBrief.visibilityScope",
  )
  readEnum(
    playerFacingBrief,
    "knowledgeScope",
    PLAYER_FACING_KNOWLEDGE,
    "outlineAwareNarrationBrief.playerFacingBrief.knowledgeScope",
  )
  validateReferencesArray(
    readArray(
      playerFacingBrief,
      "allowedKnowledge",
      "outlineAwareNarrationBrief.playerFacingBrief.allowedKnowledge",
    ),
    "outlineAwareNarrationBrief.playerFacingBrief.allowedKnowledge",
    knownRefs,
  )
  readStringArray(
    playerFacingBrief,
    "immediateReactions",
    "outlineAwareNarrationBrief.playerFacingBrief.immediateReactions",
  )
  readStringArray(
    playerFacingBrief,
    "clueDirections",
    "outlineAwareNarrationBrief.playerFacingBrief.clueDirections",
  )
  readStringArray(
    playerFacingBrief,
    "mustNotRevealStableIds",
    "outlineAwareNarrationBrief.playerFacingBrief.mustNotRevealStableIds",
  )

  const parallelLineBrief = expectRecord(
    record.parallelLineBrief,
    "outlineAwareNarrationBrief.parallelLineBrief",
  )
  readString(parallelLineBrief, "summary", "outlineAwareNarrationBrief.parallelLineBrief.summary")
  const grantsPcKnowledge = readBoolean(
    parallelLineBrief,
    "grantsPcKnowledge",
    "outlineAwareNarrationBrief.parallelLineBrief.grantsPcKnowledge",
  )
  if (grantsPcKnowledge !== false) {
    throw new Error("Invalid parallelLineBrief.grantsPcKnowledge: parallelLineBrief must not grant PC knowledge.")
  }
  const displayPolicy = readString(
    parallelLineBrief,
    "displayPolicy",
    "outlineAwareNarrationBrief.parallelLineBrief.displayPolicy",
  )
  if (!["user_visible_pc_unknown", "gm_only", "hidden"].includes(displayPolicy)) {
    throw new Error("Invalid outlineAwareNarrationBrief.parallelLineBrief.displayPolicy: value is not allowed.")
  }
  assertParallelLineDoesNotGrantPcKnowledge(parallelLineBrief)
  validateReferencesArray(
    readArray(
      parallelLineBrief,
      "allowedParallelKnowledge",
      "outlineAwareNarrationBrief.parallelLineBrief.allowedParallelKnowledge",
    ),
    "outlineAwareNarrationBrief.parallelLineBrief.allowedParallelKnowledge",
    knownRefs,
  )
  readStringArray(
    parallelLineBrief,
    "parallelBeatFocus",
    "outlineAwareNarrationBrief.parallelLineBrief.parallelBeatFocus",
  )

  const tensionBriefInput = expectRecord(
    record.tensionBriefInput,
    "outlineAwareNarrationBrief.tensionBriefInput",
  )
  readString(tensionBriefInput, "summary", "outlineAwareNarrationBrief.tensionBriefInput.summary")
  validateReferencesArray(
    readArray(tensionBriefInput, "plotArcFuel", "outlineAwareNarrationBrief.tensionBriefInput.plotArcFuel"),
    "outlineAwareNarrationBrief.tensionBriefInput.plotArcFuel",
    knownRefs,
  )
  readStringArray(
    tensionBriefInput,
    "relationshipPressure",
    "outlineAwareNarrationBrief.tensionBriefInput.relationshipPressure",
  )
  readBoolean(tensionBriefInput, "shouldAdvance", "outlineAwareNarrationBrief.tensionBriefInput.shouldAdvance")

  readArray(record, "revealPolicies", "outlineAwareNarrationBrief.revealPolicies")
  readArray(
    record,
    "forbiddenNarrationBoundary",
    "outlineAwareNarrationBrief.forbiddenNarrationBoundary",
  )
  const pacingDirective = expectRecord(
    record.pacingDirective,
    "outlineAwareNarrationBrief.pacingDirective",
  )
  readString(pacingDirective, "intent", "outlineAwareNarrationBrief.pacingDirective.intent")
  readString(pacingDirective, "reason", "outlineAwareNarrationBrief.pacingDirective.reason")
  readStringArray(
    pacingDirective,
    "requiredMovement",
    "outlineAwareNarrationBrief.pacingDirective.requiredMovement",
  )
  readBoolean(
    pacingDirective,
    "avoidStagnation",
    "outlineAwareNarrationBrief.pacingDirective.avoidStagnation",
  )
  const campaignDeltaRequirement = expectRecord(
    record.campaignDeltaRequirement,
    "outlineAwareNarrationBrief.campaignDeltaRequirement",
  )
  readBoolean(
    campaignDeltaRequirement,
    "required",
    "outlineAwareNarrationBrief.campaignDeltaRequirement.required",
  )
  readString(
    campaignDeltaRequirement,
    "minimumDelta",
    "outlineAwareNarrationBrief.campaignDeltaRequirement.minimumDelta",
  )
  readString(campaignDeltaRequirement, "reason", "outlineAwareNarrationBrief.campaignDeltaRequirement.reason")
  readStringArray(
    campaignDeltaRequirement,
    "candidateSources",
    "outlineAwareNarrationBrief.campaignDeltaRequirement.candidateSources",
  )

  validateReferencesArray(
    readArray(record, "references", "outlineAwareNarrationBrief.references"),
    "outlineAwareNarrationBrief.references",
    knownRefs,
  )
  validateReferenceLikeObjects(record, knownRefs, "outlineAwareNarrationBrief")

  return record as unknown as OutlineAwareNarrationBrief
}

function validateOutlineImpactReport(value: unknown, knownRefs: KnownReferenceSet): OutlineImpactReport {
  const record = expectRecord(value, "outlineImpactReport")
  readString(record, "reportId", "outlineImpactReport.reportId")
  readEnum(record, "impactLevel", ALLOWED_IMPACT_LEVELS, "outlineImpactReport.impactLevel")
  readBoolean(record, "requiresRegeneration", "outlineImpactReport.requiresRegeneration")
  readString(record, "reason", "outlineImpactReport.reason")
  readStringArray(record, "invalidatedAssumptions", "outlineImpactReport.invalidatedAssumptions")

  const affected = expectRecord(record.affected, "outlineImpactReport.affected")
  readArray(affected, "lines", "outlineImpactReport.affected.lines").forEach((line, index) =>
    readEnumValue(line, ALLOWED_LINE_TARGETS, `outlineImpactReport.affected.lines[${index}]`),
  )
  for (const key of ["beats", "reveals", "branchConditions", "plotArcs", "tensionLine"] as const) {
    validateStableRefsArray(
      readArray(affected, key, `outlineImpactReport.affected.${key}`),
      `outlineImpactReport.affected.${key}`,
      knownRefs,
    )
  }
  validateReferenceLikeObjects(record, knownRefs, "outlineImpactReport")

  return record as unknown as OutlineImpactReport
}

function validateRegenerationRequest(
  value: unknown,
  impactReport: OutlineImpactReport,
  knownRefs: KnownReferenceSet,
): RegenerationRequest {
  const record = expectRecord(value, "regenerationRequest")
  readString(record, "requestId", "regenerationRequest.requestId")
  const sourceImpactReportId = readString(
    record,
    "sourceImpactReportId",
    "regenerationRequest.sourceImpactReportId",
  )
  if (sourceImpactReportId !== impactReport.reportId) {
    throw new Error("Invalid regenerationRequest.sourceImpactReportId: must match outlineImpactReport.reportId.")
  }
  const impactLevel = readEnum(
    record,
    "impactLevel",
    new Set<RpgOutlineImpactLevel>(["major_rewrite_required"]),
    "regenerationRequest.impactLevel",
  )
  if (impactLevel !== "major_rewrite_required") {
    throw new Error("Invalid regenerationRequest.impactLevel: must be major_rewrite_required.")
  }
  readString(record, "reason", "regenerationRequest.reason")
  readArray(record, "affectedLines", "regenerationRequest.affectedLines").forEach((line, index) =>
    readEnumValue(line, ALLOWED_LINE_TARGETS, `regenerationRequest.affectedLines[${index}]`),
  )
  validateReferencesArray(
    readArray(record, "sourceRefs", "regenerationRequest.sourceRefs"),
    "regenerationRequest.sourceRefs",
    knownRefs,
  )
  readStringArray(record, "mustPreserve", "regenerationRequest.mustPreserve")
  readStringArray(record, "mustRecheck", "regenerationRequest.mustRecheck")
  validateReferenceLikeObjects(record, knownRefs, "regenerationRequest")

  return record as unknown as RegenerationRequest
}

function validateReferencesArray(
  values: unknown[],
  label: string,
  knownRefs: KnownReferenceSet,
): OutlineBriefReference[] {
  return values.map((value, index) => {
    const reference = validateReference(value, `${label}[${index}]`, knownRefs)
    if (label.includes("playerFacingBrief.allowedKnowledge")) {
      assertPlayerFacingReferenceIsAllowed(reference, `${label}[${index}]`, knownRefs)
    }
    return reference
  })
}

function validateStableRefsArray(values: unknown[], label: string, knownRefs: KnownReferenceSet): void {
  values.forEach((value, index) => {
    const record = expectRecord(value, `${label}[${index}]`)
    validatePathAndSection(record, `${label}[${index}]`, knownRefs)
    const stableId = readString(record, "stableId", `${label}[${index}].stableId`)
    if (!knownRefs.stableIds.has(stableId)) {
      throw new Error(`Invalid ${label}[${index}].stableId: stableId is not known from input outline refs.`)
    }
  })
}

function validateReference(value: unknown, label: string, knownRefs: KnownReferenceSet): OutlineBriefReference {
  const record = expectRecord(value, label)
  validatePathAndSection(record, label, knownRefs)
  if (record.runtimeDeltaId !== undefined) {
    const runtimeDeltaId = readString(record, "runtimeDeltaId", `${label}.runtimeDeltaId`)
    if (!knownRefs.runtimeDeltaIds.has(runtimeDeltaId)) {
      throw new Error(`Invalid ${label}.runtimeDeltaId: runtime delta id is not known from input.`)
    }
  }
  if (record.stableId !== undefined) {
    const stableId = readString(record, "stableId", `${label}.stableId`)
    if (!knownRefs.stableIds.has(stableId)) {
      throw new Error(`Invalid ${label}.stableId: stableId is not known from input outline refs.`)
    }
  }
  readEnum(record, "lineTarget", ALLOWED_LINE_TARGETS, `${label}.lineTarget`)
  readEnum(record, "usePurpose", ALLOWED_USE_PURPOSES, `${label}.usePurpose`)
  readEnum(record, "visibilityScope", ALLOWED_VISIBILITY_SCOPES, `${label}.visibilityScope`)
  const knowledgeScope = readEnum(record, "knowledgeScope", ALLOWED_KNOWLEDGE_SCOPES, `${label}.knowledgeScope`)
  const knowledgeClaims = record.knowledgeClaims === undefined
    ? undefined
    : readArray(record, "knowledgeClaims", `${label}.knowledgeClaims`).map((claim, index) =>
      validateRpgKnowledgeClaim(claim, `${label}.knowledgeClaims[${index}]`),
    )
  if (
    knowledgeScope === "npc_known" &&
    !knowledgeClaims?.some((claim) => claim.holders.some(isConcreteNonPcActorRef))
  ) {
    throw new Error(`Invalid ${label}.knowledgeClaims: npc_known references require concrete npc/faction/group holders.`)
  }
  readString(record, "reason", `${label}.reason`)
  return { ...(record as unknown as OutlineBriefReference), ...(knowledgeClaims ? { knowledgeClaims } : {}) }
}

function assertPlayerFacingReferenceIsAllowed(
  reference: OutlineBriefReference,
  label: string,
  knownRefs: KnownReferenceSet,
): void {
  if (knownRefs.pcForbiddenPaths.has(reference.path)) {
    throw new Error(
      `Invalid ${label}: playerFacingBrief.allowedKnowledge must not include GM-only or delayed outline control material.`,
    )
  }
  if (
    reference.sectionId &&
    knownRefs.pcForbiddenPathSections.has(referenceKey(reference.path, reference.sectionId))
  ) {
    throw new Error(
      `Invalid ${label}: playerFacingBrief.allowedKnowledge must not include GM-only or delayed outline control material.`,
    )
  }
  if (reference.stableId && knownRefs.pcForbiddenStableIds.has(reference.stableId)) {
    throw new Error(
      `Invalid ${label}: playerFacingBrief.allowedKnowledge must not include forbidden reveal or GM-control stableIds.`,
    )
  }
}

function validateReferenceLikeObjects(value: unknown, knownRefs: KnownReferenceSet, label: string): void {
  if (value === null || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateReferenceLikeObjects(entry, knownRefs, `${label}[${index}]`))
    return
  }

  const record = value as Record<string, unknown>
  if (typeof record.path === "string" || typeof record.sourcePath === "string") {
    validatePathAndSection(record, label, knownRefs)
  }

  for (const [key, child] of Object.entries(record)) {
    validateReferenceLikeObjects(child, knownRefs, `${label}.${key}`)
  }
}

function validatePathAndSection(
  record: Record<string, unknown>,
  label: string,
  knownRefs: KnownReferenceSet,
): void {
  const path =
    typeof record.path === "string"
      ? record.path.trim()
      : typeof record.sourcePath === "string"
        ? record.sourcePath.trim()
        : ""
  if (!path) {
    throw new Error(`Invalid ${label}.path: must be a non-empty string.`)
  }
  if (!knownRefs.paths.has(path)) {
    throw new Error(`Invalid ${label}.path: path is not present in input recall materials or runtime refs.`)
  }

  if (record.sectionId !== undefined) {
    const sectionId = readString(record, "sectionId", `${label}.sectionId`)
    const knownSections = knownRefs.sectionsByPath.get(path)
    if (!knownSections?.has(sectionId)) {
      throw new Error(`Invalid ${label}.sectionId: sectionId is not known for path ${path}.`)
    }
  }
}

function assertPlayerFacingKnowledgeBoundary(value: unknown, label = "playerFacingBrief"): void {
  if (value === null || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPlayerFacingKnowledgeBoundary(entry, `${label}[${index}]`))
    return
  }

  const record = value as Record<string, unknown>
  if (record.lineTarget === "parallelLine") {
    throw new Error(`Invalid ${label}: playerFacingBrief must not contain parallelLine material as PC knowledge.`)
  }
  if (typeof record.visibilityScope === "string" && !PLAYER_FACING_VISIBILITY.has(record.visibilityScope as RpgVisibilityScope)) {
    throw new Error(
      `Invalid ${label}.visibilityScope: playerFacingBrief must not contain GM-only, hidden, parallel-only, or user_visible_pc_unknown material as PC knowledge.`,
    )
  }
  if (typeof record.knowledgeScope === "string" && !PLAYER_FACING_KNOWLEDGE.has(record.knowledgeScope as RpgKnowledgeScope)) {
    throw new Error(
      `Invalid ${label}.knowledgeScope: playerFacingBrief must not contain GM-only, user-only, or unknown-to-PC knowledge.`,
    )
  }

  for (const [key, child] of Object.entries(record)) {
    assertPlayerFacingKnowledgeBoundary(child, `${label}.${key}`)
  }
}

function assertParallelLineDoesNotGrantPcKnowledge(value: unknown, label = "parallelLineBrief"): void {
  if (value === null || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertParallelLineDoesNotGrantPcKnowledge(entry, `${label}[${index}]`))
    return
  }

  const record = value as Record<string, unknown>
  if (record.grantsPcKnowledge === true) {
    throw new Error(`Invalid ${label}.grantsPcKnowledge: parallelLine material must not grant PC knowledge.`)
  }
  for (const [key, child] of Object.entries(record)) {
    assertParallelLineDoesNotGrantPcKnowledge(child, `${label}.${key}`)
  }
}

function assertNoForbiddenOutputKeys(value: unknown, path = "OutlineBriefCompilerOutput"): void {
  if (value === null || typeof value !== "object") return

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenOutputKeys(entry, `${path}[${index}]`))
    return
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const forbidden = FORBIDDEN_OUTPUT_KEYS.find((entry) => entry.pattern.test(key))
    if (forbidden) {
      throw new Error(`Invalid OutlineBriefCompilerOutput: ${forbidden.message} Forbidden key ${path}.${key}.`)
    }
    assertNoForbiddenOutputKeys(child, `${path}.${key}`)
  }
}

function assertOnlyTopLevelKeys(record: Record<string, unknown>): void {
  const allowed = new Set([
    "outlineAwareNarrationBrief",
    "outlineImpactReport",
    "regenerationRequest",
    "warnings",
  ])
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new Error(`Invalid OutlineBriefCompilerOutput.${key}: top-level key is not allowed.`)
    }
  }
}

interface KnownReferenceSet {
  paths: Set<string>
  sectionsByPath: Map<string, Set<string>>
  runtimeDeltaIds: Set<string>
  stableIds: Set<string>
  pcForbiddenPaths: Set<string>
  pcForbiddenPathSections: Set<string>
  pcForbiddenStableIds: Set<string>
}

function collectKnownReferences(input: OutlineBriefCompilerInput): KnownReferenceSet {
  const knownRefs: KnownReferenceSet = {
    paths: new Set(),
    sectionsByPath: new Map(),
    runtimeDeltaIds: new Set(),
    stableIds: new Set(),
    pcForbiddenPaths: new Set(),
    pcForbiddenPathSections: new Set(),
    pcForbiddenStableIds: new Set(),
  }

  const addPath = (path?: string, sectionId?: string) => {
    if (!path) return
    knownRefs.paths.add(path)
    if (sectionId) {
      const sections = knownRefs.sectionsByPath.get(path) ?? new Set<string>()
      sections.add(sectionId)
      knownRefs.sectionsByPath.set(path, sections)
    }
  }

  for (const material of input.recalledMaterials) {
    addPath(material.path)
    for (const section of material.sections) addPath(material.path, section.sectionId)
  }
  for (const item of input.recallSelection.selectedItems) {
    addPath(item.path)
    for (const section of item.sections) addPath(item.path, section.sectionId)
  }
  for (const exclusion of input.recallSelection.exclusions) {
    addPath(exclusion.path)
    for (const sectionId of exclusion.sectionIds) addPath(exclusion.path, sectionId)
  }
  for (const slice of input.outlineSlices) {
    addPath(slice.path, slice.sectionId)
    if (outlineSliceMustNotEnterPcKnowledge(slice)) {
      knownRefs.pcForbiddenPaths.add(slice.path)
      knownRefs.pcForbiddenPathSections.add(referenceKey(slice.path, slice.sectionId))
    }
    for (const ref of [...slice.beatRefs, ...slice.revealRefs, ...slice.branchConditionRefs]) {
      addPath(ref.path, ref.sectionId)
      knownRefs.stableIds.add(ref.stableId)
      if (
        outlineSliceMustNotEnterPcKnowledge(slice) ||
        slice.revealPolicies.some((policy) => policy.stableId === ref.stableId && policyMustNotEnterPcKnowledge(policy.policy))
      ) {
        knownRefs.pcForbiddenStableIds.add(ref.stableId)
      }
    }
    for (const dependency of slice.dependencies) {
      knownRefs.stableIds.add(dependency.dependencyId)
      dependency.dependsOnStableIds.forEach((stableId) => knownRefs.stableIds.add(stableId))
      dependency.invalidatedByStableIds.forEach((stableId) => knownRefs.stableIds.add(stableId))
    }
  }
  for (const fuel of input.plotArcTensionFuel) {
    addPath(fuel.path, fuel.sectionId)
    knownRefs.stableIds.add(fuel.fuelId)
    knownRefs.stableIds.add(fuel.plotArcId)
  }
  for (const constraint of input.hardConstraints) {
    addPath(constraint.sourcePath, constraint.sectionId)
    knownRefs.stableIds.add(constraint.constraintId)
  }
  for (const boundary of input.visibilityBoundaries) {
    addPath(boundary.sourcePath, boundary.sectionId)
    knownRefs.stableIds.add(boundary.boundaryId)
  }
  for (const known of input.knownReferences) {
    addPath(known.path, known.sectionId)
    if (known.runtimeDeltaId) knownRefs.runtimeDeltaIds.add(known.runtimeDeltaId)
    if (known.stableId) knownRefs.stableIds.add(known.stableId)
  }
  for (const runtimeRef of [
    ...input.runtimeRefs,
    ...input.postActionWorkingState.runtimeDeltaRefs,
    ...input.actionResolution.runtimeDeltaRefs,
    ...input.worldTickResult.runtimeDeltaRefs,
  ]) {
    addPath(runtimeRef.sourcePath)
    knownRefs.runtimeDeltaIds.add(runtimeRef.deltaId)
  }
  for (const reference of input.actionResolution.references) addPath(reference.path, reference.sectionId)
  for (const reference of input.worldTickResult.references) addPath(reference.path, reference.sectionId)
  for (const reference of input.postActionWorkingState.references) addPath(reference)
  for (const delta of [
    ...input.visibleSelection.currentSceneVisibleCandidates,
    ...input.visibleSelection.parallelLensCandidates,
    ...input.visibleSelection.tensionCandidates,
  ]) {
    delta.affectedPaths.forEach((path) => addPath(path))
    delta.runtimeDeltaRefs.forEach((ref) => {
      addPath(ref.sourcePath)
      knownRefs.runtimeDeltaIds.add(ref.deltaId)
    })
  }

  return knownRefs
}

function outlineSliceMustNotEnterPcKnowledge(input: OutlineBriefCompilerInput["outlineSlices"][number]): boolean {
  if (input.outlineControl?.mustNotRevealTo.includes("pc")) return true
  if (input.visibilityScope === "gm_only" || input.visibilityScope === "hidden") return true
  return false
}

function policyMustNotEnterPcKnowledge(policy: string): boolean {
  return policy === "delay" || policy === "forbid" || policy === "gm_only" || policy === "parallel_only"
}

function referenceKey(path: string, sectionId: string): string {
  return `${path}#${sectionId}`
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

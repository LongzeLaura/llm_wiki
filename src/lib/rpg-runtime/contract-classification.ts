import type { RpgRuntimeDebugStepId } from "./debug-trace"

export type RpgRuntimeContractFieldCategory =
  | "semantic_required"
  | "semantic_optional"
  | "derivable_protocol"
  | "dangerous_forbidden"
  | "persistence_hard_boundary"

export type RpgRuntimeContractErrorCategory =
  | "json_extract_failed"
  | "malformed_json"
  | "loose_scalar_array"
  | "loose_single_object_array"
  | "null_optional_field"
  | "missing_semantic_field"
  | "invalid_semantic_enum"
  | "unsafe_knowledge_boundary"
  | "unknown_reference"
  | "derivable_protocol_omitted"
  | "forbidden_safety_key"
  | "forbidden_persistence_claim"
  | "forbidden_write_target"
  | "compiler_invariant_failed"
  | "canonical_validation_failed"
  | "provider_transport_failure"
  | "blocked_by_previous_failure"

export interface RpgRuntimeContractFieldRule {
  fieldPath: string
  category: RpgRuntimeContractFieldCategory
  description: string
  optionalByDesign?: boolean
  notOptional?: boolean
  errorCategory?: RpgRuntimeContractErrorCategory
}

export interface RpgRuntimeContractStageMatrix {
  stepId: RpgRuntimeDebugStepId
  stageLabel: string
  contractMode: "soft_semantic" | "allowlist_selection" | "hard_persistence" | "deterministic_boundary"
  fields: readonly RpgRuntimeContractFieldRule[]
  defaultErrorCategories: readonly RpgRuntimeContractErrorCategory[]
  notes: readonly string[]
}

export const RPG_RUNTIME_CONTRACT_FIELD_CATEGORIES = [
  "semantic_required",
  "semantic_optional",
  "derivable_protocol",
  "dangerous_forbidden",
  "persistence_hard_boundary",
] as const satisfies readonly RpgRuntimeContractFieldCategory[]

export const RPG_RUNTIME_CONTRACT_ERROR_CATEGORIES = [
  "json_extract_failed",
  "malformed_json",
  "loose_scalar_array",
  "loose_single_object_array",
  "null_optional_field",
  "missing_semantic_field",
  "invalid_semantic_enum",
  "unsafe_knowledge_boundary",
  "unknown_reference",
  "derivable_protocol_omitted",
  "forbidden_safety_key",
  "forbidden_persistence_claim",
  "forbidden_write_target",
  "compiler_invariant_failed",
  "canonical_validation_failed",
  "provider_transport_failure",
  "blocked_by_previous_failure",
] as const satisfies readonly RpgRuntimeContractErrorCategory[]

export const RPG_RUNTIME_CONTRACT_CLASSIFICATION_MATRIX = [
  {
    stepId: "action_resolver",
    stageLabel: "Action Resolver",
    contractMode: "soft_semantic",
    fields: [
      required("parsedIntent", "Model must interpret player intent, actor, target, and goal."),
      required("eventDraft.summary", "Model must summarize the attempted action outcome."),
      required("eventDraft.status", "Model must keep attempted, blocked, and confirmed states separate.", "invalid_semantic_enum"),
      required("feasibility.status", "Model must decide whether the action can proceed.", "invalid_semantic_enum"),
      required("directResults[].summary", "Model must state direct semantic results."),
      required("timeDelta.summary", "Model must estimate the action time basis."),
      optional("costs[]", "Model may identify costs when meaningful."),
      optional("obstacles[]", "Model may identify obstacles when meaningful."),
      optional("progressPotential", "Model may describe unlocks and progress pressure."),
      derivable("resolutionId", "Local compiler can generate the resolution id."),
      derivable("eventDraft.eventId", "Local compiler can generate event ids."),
      derivable("costs[].costId", "Local compiler can generate cost ids."),
      derivable("obstacles[].obstacleId", "Local compiler can generate obstacle ids."),
      derivable("directResults[].resultId", "Local compiler can generate result ids."),
      derivable("runtimeDeltaRefs", "Local compiler can create runtime delta refs from accepted semantic output."),
      optional("referencePaths[]", "Model may provide lightweight wiki paths actually used for action resolution."),
      optional("warnings[]", "Model may provide short warning strings."),
      derivable("references[]", "Local compiler can wrap lightweight referencePaths with metadata."),
      derivable("warnings[].code/severity", "Local compiler can turn warning strings into structured warnings."),
      forbidden("wikiWrites", "Action Resolver must not propose wiki writes."),
      forbidden("narration", "Action Resolver must not generate final narration."),
      forbidden("eventDraft.status=confirmed_happened for attempted-only actions", "Attempted actions must not be silently promoted."),
    ],
    defaultErrorCategories: [
      "json_extract_failed",
      "malformed_json",
      "loose_scalar_array",
      "loose_single_object_array",
      "null_optional_field",
      "missing_semantic_field",
      "invalid_semantic_enum",
      "unsafe_knowledge_boundary",
      "unknown_reference",
      "forbidden_safety_key",
    ],
    notes: ["Non-writeback semantic stage; matrix is observational in this phase."],
  },
  {
    stepId: "world_tick",
    stageLabel: "World Tick",
    contractMode: "soft_semantic",
    fields: [
      required("worldDeltas.*[].summary", "Model must state world response deltas."),
      required("worldDeltas.*[].narrativeLine", "Model must classify player, parallel, or tension line.", "invalid_semantic_enum"),
      required("worldDeltas.*[].happenedStatus", "Model must separate happened, ongoing, and possible-future status.", "invalid_semantic_enum"),
      required("timeAdvance.appliedSummary", "Model must explain applied time advancement."),
      optional("clockUpdates[].reason", "Model may identify clock pressure when relevant."),
      optional("settledOngoingEvents[].summary", "Model may advance ongoing events."),
      optional("informationBroadcast[].informationSummary", "Model may describe NPC/user-visible broadcasts."),
      optional("reactionQueue[].summary", "Model may queue immediate reactions."),
      optional("pacingUpdate.campaignDelta", "Model may describe pacing movement."),
      optional("gapState.summary", "Model may describe gap signals."),
      derivable("tickId", "Local compiler can generate tick ids."),
      derivable("worldDeltas.*[].deltaId", "Local compiler can generate delta ids."),
      derivable("worldDeltas.*[].affectedPaths", "Missing, empty, or blank affected paths mean undeclared draft protocol."),
      derivable("worldDeltas.*[].runtimeDeltaRefs", "Local compiler can derive runtime refs."),
      derivable("worldDeltas.*[].visibility", "Local compiler can expand visibility presets."),
      derivable("worldDeltas.*[].sourcePlayerDeltaIds", "Local compiler can map source player delta ids."),
      derivable("clockUpdates[].timeDeltaBasis", "Local compiler can copy the resolved action time basis."),
      optional("referencePaths[]", "Model may provide lightweight wiki paths used by the world response."),
      optional("warnings[]", "Model may provide short warning strings."),
      derivable("references[]", "Local compiler can wrap lightweight referencePaths with metadata."),
      derivable("warnings[].code/severity", "Local compiler can turn warning strings into structured warnings."),
      forbidden("wikiWrites", "World Tick must not write wiki files."),
      forbidden("nextActionOptions", "World Tick must not generate next player options."),
      forbidden("player-facing hidden or GM-only knowledge grants", "World Tick must not leak hidden knowledge into PC-visible state.", "unsafe_knowledge_boundary"),
    ],
    defaultErrorCategories: [
      "json_extract_failed",
      "malformed_json",
      "loose_scalar_array",
      "loose_single_object_array",
      "null_optional_field",
      "missing_semantic_field",
      "invalid_semantic_enum",
      "unsafe_knowledge_boundary",
      "unknown_reference",
      "derivable_protocol_omitted",
      "forbidden_safety_key",
    ],
    notes: ["affectedPaths, refs, source ids, visibility envelopes, time basis, and default arrays are derivable protocol."],
  },
  {
    stepId: "recall_selector",
    stageLabel: "Recall Selector",
    contractMode: "allowlist_selection",
    fields: [
      required("selectedItems[].path", "Model must choose paths from the local retrieval index.", "unknown_reference"),
      required("selectedItems[].readMode", "Model must choose a supported read mode.", "invalid_semantic_enum"),
      required("selectedItems[].priority", "Model must rank recall usefulness.", "invalid_semantic_enum"),
      optional("selectedItems[].sections[]", "Model may select known sections from the retrieval index."),
      optional("exclusions[]", "Model may explain rejected context."),
      derivable("selectionId", "Local compiler can generate selection ids."),
      derivable("recallBudget", "Local reader owns the effective budget."),
      derivable("recallPolicy", "Local reader owns path and section policy."),
      forbidden("content", "Recall Selector must not fabricate page content."),
      forbidden("wikiWrites", "Recall Selector must not write wiki files."),
    ],
    defaultErrorCategories: ["json_extract_failed", "malformed_json", "missing_semantic_field", "invalid_semantic_enum", "unknown_reference"],
    notes: ["Healthy allowlist plus deterministic reader stage; no canonical expansion needed."],
  },
  {
    stepId: "outline_brief",
    stageLabel: "Outline Brief",
    contractMode: "soft_semantic",
    fields: [
      required("playerFacingBrief.summary", "Model must summarize player-facing focus."),
      required("playerFacingBrief.currentSceneFocus", "Model must select visible scene focus."),
      required("parallelLineBrief.summary", "Model must summarize parallel-line handling."),
      required("tensionBriefInput.summary", "Model must summarize tension use."),
      required("outlineImpactReport.impactLevel", "Model must classify outline impact.", "invalid_semantic_enum"),
      optional("playerFacingBrief.allowedKnowledge[]", "Model may select lightweight allowed refs."),
      optional("parallelLineBrief.allowedParallelKnowledge[]", "Model may select parallel refs."),
      optional("revealPolicies[]", "Model may state reveal constraints."),
      optional("forbiddenNarrationBoundary[]", "Model may list forbidden reveals."),
      optional("regenerationRequest", "Model may request major-regeneration handling only when justified."),
      derivable("briefId", "Local compiler can generate brief ids."),
      derivable("sourceWorkingStateId", "Local compiler can copy the working state id."),
      derivable("references[]", "Local compiler can create full reference envelopes."),
      derivable("outlineImpactReport.reportId", "Local compiler can generate report ids."),
      derivable("regenerationRequest.requestId", "Local compiler can generate request ids."),
      forbidden("player-facing GM-only refs", "GM-only or hidden refs must not become player-facing knowledge.", "unsafe_knowledge_boundary"),
      forbidden("outline overwrite", "Outline Brief must not write wiki/outlines/main.md."),
    ],
    defaultErrorCategories: [
      "malformed_json",
      "json_extract_failed",
      "loose_scalar_array",
      "loose_single_object_array",
      "null_optional_field",
      "missing_semantic_field",
      "invalid_semantic_enum",
      "unsafe_knowledge_boundary",
      "unknown_reference",
      "forbidden_safety_key",
      "compiler_invariant_failed",
      "canonical_validation_failed",
    ],
    notes: ["Existing draft/compiler path remains strict at canonical output; this matrix documents future soft boundary intent."],
  },
  {
    stepId: "story_outline_regenerator",
    stageLabel: "Story Outline Regenerator",
    contractMode: "soft_semantic",
    fields: [
      required("provisionalOutlinePatch.scope", "Model must describe same-turn revision scope.", "invalid_semantic_enum"),
      required("provisionalOutlinePatch.narrationHandoff", "Model must provide same-turn narration constraints."),
      required("outlineRevisionProposal.reason", "Model must explain review-only outline revision."),
      required("regenerationSafetyReport.safetyConclusion", "Model must classify regeneration safety.", "invalid_semantic_enum"),
      optional("outlineRevisionProposal.patchSummary", "Model may summarize proposed future outline changes."),
      optional("warnings", "Model may report caution notes."),
      derivable("provisionalOutlinePatch.patchId", "Local compiler can generate patch ids."),
      derivable("provisionalOutlinePatch.narrationHandoff.handoffId", "Local compiler can generate handoff ids."),
      derivable("outlineRevisionProposal.proposalId", "Local compiler can generate proposal ids."),
      derivable("reviewBoundary", "Local compiler can enforce review-only boundary flags."),
      forbidden("autoWriteMainOutline", "Story Outline Regenerator must not directly overwrite the main outline."),
      forbidden("ordinaryRuntimeUpdate", "Outline revision material must not become ordinary runtime update."),
    ],
    defaultErrorCategories: [
      "malformed_json",
      "json_extract_failed",
      "loose_scalar_array",
      "loose_single_object_array",
      "null_optional_field",
      "missing_semantic_field",
      "invalid_semantic_enum",
      "forbidden_persistence_claim",
      "forbidden_safety_key",
      "compiler_invariant_failed",
      "canonical_validation_failed",
    ],
    notes: ["Low-frequency review path; hard write remains forbidden."],
  },
  {
    stepId: "narration_generator",
    stageLabel: "Narration Generator",
    contractMode: "soft_semantic",
    fields: [
      required("playerFacingText", "Model must produce player-visible prose."),
      required("nextActionOptions[].playerFacingText", "Model must provide usable next choices."),
      required("nextActionOptions[].intent", "Model must classify option intent.", "invalid_semantic_enum"),
      optional("parallelLineText", "Model may show user-visible PC-unknown parallel prose."),
      optional("tensionBrief.summary", "Model may hand off GM/review tension."),
      optional("tensionBrief.*Signals[]", "Model may provide pressure, relationship, or plot-arc signal strings."),
      optional("narrationSelfReport", "Model may summarize pacing/reveal self-report; omission uses local defaults."),
      derivable("displayPolicy", "Local compiler derives display policy from draft prose."),
      derivable("narrationMeta.campaignDelta", "Local compiler defaults campaign movement when omitted."),
      derivable("narrationMeta.narrationId", "Local compiler can generate narration ids."),
      derivable("narrationMeta.playerKnowledgeBoundary", "Local compiler can derive knowledge audit metadata."),
      derivable("references[]", "Local compiler can wrap source refs."),
      derivable("nextActionOptions[].id", "Local compiler can generate option ids."),
      derivable("nextActionOptions[].likelyAffectedPaths", "Local compiler defaults omitted likely paths to an empty list."),
      derivable("nextActionOptions[].sourceRefs", "Local compiler can attach local source refs."),
      forbidden("GM-only prose leak", "Player-facing prose must not reveal hidden or GM-only truth.", "unsafe_knowledge_boundary"),
      forbidden("confirmed event from option-only future", "Next action options must remain possible future.", "forbidden_persistence_claim"),
      forbidden("wikiWrites", "Narration Generator must not write wiki files."),
    ],
    defaultErrorCategories: [
      "malformed_json",
      "json_extract_failed",
      "loose_scalar_array",
      "loose_single_object_array",
      "null_optional_field",
      "missing_semantic_field",
      "invalid_semantic_enum",
      "unsafe_knowledge_boundary",
      "forbidden_safety_key",
      "forbidden_persistence_claim",
    ],
    notes: ["Protect prose quality; metadata is a candidate for later local compilation."],
  },
  {
    stepId: "runtime_update_proposal",
    stageLabel: "Runtime Update Proposal",
    contractMode: "hard_persistence",
    fields: [
      required("proposedWikiUpdates[].targetPath", "Model must choose an explicit legal target path.", "forbidden_write_target"),
      required("proposedWikiUpdates[].strategy", "Model must choose append, merge, overwrite, or review strategy.", "invalid_semantic_enum"),
      required("proposedWikiUpdates[].content", "Model must provide proposed write content."),
      required("proposedWikiUpdates[].happenedStatus", "Model must classify write fact status.", "invalid_semantic_enum"),
      required("proposedWikiUpdates[].reason", "Model must explain why the update should exist."),
      optional("journalEntries[]", "Model may produce audit-only journal notes."),
      optional("skippedDeltas[]", "Model may explain skipped deltas."),
      derivable("proposedWikiUpdates[].id", "Local compiler can generate proposal ids."),
      derivable("proposedWikiUpdates[].sourceDeltas", "Local compiler derives evidence from turn record."),
      derivable("proposedWikiUpdates[].visibility", "Local compiler derives visibility metadata."),
      derivable("proposedWikiUpdates[].knowledgeScope", "Local compiler derives actor knowledge metadata."),
      derivable("proposedWikiUpdates[].validationHints", "Local compiler derives validator hints."),
      derivable("proposalGroups[]", "Local compiler derives grouping metadata."),
      hard("events confirmed-only", "Event writes must only persist confirmed happened facts."),
      hard("actor knowledge boundary", "PC, NPC, user-only, and GM-only knowledge boundaries must be strict."),
      hard("reveal gate boundary", "Delayed or hidden reveal material must not be accepted as PC knowledge."),
      hard("target path policy", "Runtime writes must not target stable/base/control/source paths or wiki/outlines/main.md.", "forbidden_write_target"),
      forbidden("wildcard targetPath", "Target paths must not be glob, category, or wildcard paths.", "forbidden_write_target"),
      forbidden("future as confirmed event", "Future, outline beat, or option-only content must not be persisted as happened fact.", "forbidden_persistence_claim"),
    ],
    defaultErrorCategories: [
      "malformed_json",
      "json_extract_failed",
      "missing_semantic_field",
      "invalid_semantic_enum",
      "unsafe_knowledge_boundary",
      "unknown_reference",
      "forbidden_safety_key",
      "forbidden_persistence_claim",
      "forbidden_write_target",
      "compiler_invariant_failed",
      "canonical_validation_failed",
    ],
    notes: ["Primary and only LLM-facing hard persistence boundary for ordinary wiki write intent."],
  },
  {
    stepId: "runtime_update_validation",
    stageLabel: "Runtime Update Validation",
    contractMode: "deterministic_boundary",
    fields: [
      hard("acceptedUpdates[]", "Only deterministic validation can accept proposed wiki updates."),
      hard("rejectedUpdates[]", "Unsafe updates must be rejected with issues."),
      hard("issues[].code", "Validation issue codes must classify write safety outcomes."),
      hard("targetPath policy", "Final path policy is enforced here before pending staging.", "forbidden_write_target"),
      forbidden("LLM-authored acceptance", "The model must not decide final accepted updates."),
    ],
    defaultErrorCategories: [
      "unsafe_knowledge_boundary",
      "unknown_reference",
      "forbidden_persistence_claim",
      "forbidden_write_target",
      "canonical_validation_failed",
    ],
    notes: ["Deterministic acceptance gate; not a model output contract and not fed by soft semantic handoff directly."],
  },
  {
    stepId: "pending_update_persistence",
    stageLabel: "Pending Update Persistence",
    contractMode: "deterministic_boundary",
    fields: [
      hard("pendingUpdates[]", "Only accepted validated updates are staged."),
      hard("turnJournalEntry", "Turn journal records canonical audit material."),
      hard("pendingUpdateIds[]", "Persistence returns accepted pending ids."),
      forbidden("unvalidated proposals", "Unvalidated soft semantic output must not be staged."),
    ],
    defaultErrorCategories: ["blocked_by_previous_failure", "canonical_validation_failed"],
    notes: ["Deterministic staging gate only; no LLM contract is introduced, and apply_pending remains the final filesystem write gate."],
  },
] as const satisfies readonly RpgRuntimeContractStageMatrix[]

export function getRpgRuntimeContractClassificationMatrix(): readonly RpgRuntimeContractStageMatrix[] {
  return RPG_RUNTIME_CONTRACT_CLASSIFICATION_MATRIX
}

export function getRpgRuntimeContractStageMatrix(
  stepId: RpgRuntimeDebugStepId,
): RpgRuntimeContractStageMatrix {
  const matrix = RPG_RUNTIME_CONTRACT_CLASSIFICATION_MATRIX.find((entry) => entry.stepId === stepId)
  if (!matrix) throw new Error(`Missing RPG runtime contract matrix for step: ${stepId}`)
  return matrix
}

function required(
  fieldPath: string,
  description: string,
  errorCategory: RpgRuntimeContractErrorCategory = "missing_semantic_field",
): RpgRuntimeContractFieldRule {
  return {
    fieldPath,
    category: "semantic_required",
    description,
    notOptional: true,
    errorCategory,
  }
}

function optional(fieldPath: string, description: string): RpgRuntimeContractFieldRule {
  return {
    fieldPath,
    category: "semantic_optional",
    description,
  }
}

function derivable(fieldPath: string, description: string): RpgRuntimeContractFieldRule {
  return {
    fieldPath,
    category: "derivable_protocol",
    description,
    optionalByDesign: true,
    errorCategory: "derivable_protocol_omitted",
  }
}

function forbidden(
  fieldPath: string,
  description: string,
  errorCategory: RpgRuntimeContractErrorCategory = "forbidden_persistence_claim",
): RpgRuntimeContractFieldRule {
  return {
    fieldPath,
    category: "dangerous_forbidden",
    description,
    errorCategory,
  }
}

function hard(
  fieldPath: string,
  description: string,
  errorCategory: RpgRuntimeContractErrorCategory = "canonical_validation_failed",
): RpgRuntimeContractFieldRule {
  return {
    fieldPath,
    category: "persistence_hard_boundary",
    description,
    notOptional: true,
    errorCategory,
  }
}

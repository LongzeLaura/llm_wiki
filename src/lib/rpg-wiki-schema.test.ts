import { describe, expect, it } from "vitest"
import { RPG_CATEGORIES } from "./rpg-categories"
import {
  RPG_DIRECTORY_BOUNDARY_GUIDANCE,
  RPG_FIXED_PLAYER_SLOT_PATHS,
  RPG_FIXED_WORLD_SLOT_PATHS,
  RPG_SCHEMA_SLOTS,
  RPG_WIKI_SCHEMA,
  getRpgActionResolverSlotSemantics,
  getRpgClockStateFields,
  getRpgDirectoryBoundaryGuidance,
  getRpgOutlineImpactLevels,
  getRpgOutlineBriefBoundaryFields,
  getRpgOutlineBriefCompilerSchemaGuidance,
  getRpgOutlineBriefImpactRubricFields,
  getRpgOutlineBriefStableRefFields,
  getRpgOutlineBriefTensionFuelFields,
  getRpgRecallableSectionFields,
  getRpgActionOptionRuntimeFields,
  getRpgNarrationKnowledgeBoundaryPolicy,
  getRpgNarrationMetaFields,
  getRpgNarrationOutputSchema,
  getRpgNarrationStyleHandoffPolicy,
  getRpgOutlineRevisionReviewItemSchema,
  getRpgOutlineRevisionProposalSchema,
  getRpgOutlineRevisionReviewPolicy,
  getRpgPacingUpdateProposalFields,
  getRpgProposalGroupFields,
  getRpgProposedWikiUpdateRuntimeFields,
  getRpgProvisionalOutlinePatchSchema,
  getRpgRegenerationSafetyFields,
  getRpgRuntimeUpdateProposalGuidance,
  getRpgRuntimeUpdateProposalInputSchema,
  getRpgRuntimeUpdateProposalResultSchema,
  getRpgRuntimeUpdateProposalSchemaGuidance,
  getRpgRuntimeUpdateSourceDeltaFields,
  getRpgSkippedRuntimeDeltaFields,
  getRpgTensionBriefFields,
  getRpgReviewItemKinds,
  getRpgRuntimeDeltaRefFields,
  getRpgRuntimePersistenceBoundaryGuidance,
  getRpgRuntimeSharedSchemaGuidance,
  getRpgRuntimeVisibilityFields,
  getRpgRuntimeCrossDirectorySyncGuidance,
  getRpgWorldTickClockFields,
  getRpgWorldTickGapSignalFields,
  getRpgWorldTickInformationBroadcastFields,
  getRpgWorldTickOngoingEventFields,
  getRpgWorldTickPacingStateFields,
  getRpgWorldTickReactionQueueFields,
  getRpgWorldTickSchemaGuidance,
  getRpgWorldTickVisibilityMetaFields,
  getRpgSourceIngestForbiddenTarget,
  getRpgSourceIngestTargetPolicy,
  getRpgStoryOutlineRegeneratorSchemaGuidance,
  getRequiredRpgSchemaSlots,
  getRpgSchemaSlot,
  getRpgSchemaSlotByPath,
  getRpgSchemaSlotsByOwner,
  getRpgWikiSchemaEntry,
  isFixedPlayerSlotPath,
  isRpgSourceIngestAllowedTarget,
  rpgSchemaCategoryIdsMatchRegistry,
} from "./rpg-wiki-schema"

describe("RPG_WIKI_SCHEMA", () => {
  it("keeps schema category ids aligned with the RPG category registry", () => {
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).toEqual(RPG_CATEGORIES.map((category) => category.id))
    expect(RPG_WIKI_SCHEMA).toHaveLength(RPG_CATEGORIES.length)
    expect(RPG_WIKI_SCHEMA.some((entry) => entry.categoryId.includes("runtime"))).toBe(false)
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.path)).not.toContain("runtime/")
    expect(rpgSchemaCategoryIdsMatchRegistry()).toBe(true)
  })

  it("reuses labels and paths from the RPG category registry", () => {
    for (const entry of RPG_WIKI_SCHEMA) {
      const category = RPG_CATEGORIES.find((candidate) => candidate.id === entry.categoryId)
      expect(category).toBeDefined()
      expect(entry.label).toBe(category?.label)
      expect(entry.path).toBe(category?.path)
    }
  })

  it("defines extraction scope, fields, exclusions, granularity, and update strategy", () => {
    for (const entry of RPG_WIKI_SCHEMA) {
      expect(entry.extractionGoal.length).toBeGreaterThan(0)
      expect(entry.fields.length).toBeGreaterThan(0)
      expect(entry.fields.every((field) => field.name && field.description)).toBe(true)
      expect(entry.exclude.length).toBeGreaterThan(0)
      expect(entry.recommendedGranularity.length).toBeGreaterThan(0)
    }
  })

  it("defines the shared runtime schema spine enums and guidance", () => {
    const guidance = getRpgRuntimeSharedSchemaGuidance()
    const combinedGuidance = guidance.guidance.join("\n")

    expect(guidance.narrativeLines).toEqual(expect.arrayContaining([
      "playerVisibleLine",
      "parallelLine",
      "tensionLine",
    ]))
    expect(guidance.usePurposes).toEqual(expect.arrayContaining([
      "actionResolution",
      "worldTick",
      "recall",
      "outlineControl",
      "narration",
      "writeback",
    ]))
    expect(guidance.visibilityScopes).toEqual(expect.arrayContaining([
      "pc_visible",
      "user_visible_pc_unknown",
      "gm_only",
    ]))
    expect(guidance.knowledgeScopes).toEqual(expect.arrayContaining([
      "pc_known",
      "pc_misunderstanding",
    ]))
    expect(guidance.happenedStatuses).toEqual(expect.arrayContaining([
      "confirmed_happened",
      "attempted_not_confirmed",
      "possible_future",
    ]))
    expect(getRpgOutlineImpactLevels()).toContain("major_rewrite_required")
    expect(getRpgReviewItemKinds().map((field) => field.name)).toEqual(expect.arrayContaining([
      "runtimeWikiUpdate",
      "outlineRevision",
    ]))
    expect(combinedGuidance).toContain("current-turn runtime/narration lens targets")
    expect(combinedGuidance).toContain("not outline ownership")
    expect(combinedGuidance).toContain("not a requirement to advance three story lines in parallel")
    expect(combinedGuidance).toContain("playerVisibleLine means")
    expect(combinedGuidance).toContain("parallelLine means")
    expect(combinedGuidance).toContain("tensionLine means")
  })

  it("defines runtime visibility, delta ref, recallable section, and clock fields", () => {
    expect(getRpgRuntimeVisibilityFields().map((field) => field.name)).toEqual(expect.arrayContaining([
      "visibilityScope",
      "knowledgeScope",
      "knowledgeSourceKind",
      "knownBy",
    ]))

    expect(getRpgRuntimeDeltaRefFields().map((field) => field.name)).toEqual(expect.arrayContaining([
      "deltaId",
      "sourceStage",
      "sourcePath",
      "narrativeLine",
      "usePurpose",
      "happenedStatus",
    ]))
    expect(JSON.stringify(getRpgRuntimeDeltaRefFields())).toContain("Current-turn narration lens target")
    expect(JSON.stringify(getRpgClockStateFields())).toContain("does not make the clock an outline axis")

    const recallableSectionFields = getRpgRecallableSectionFields()
    expect(recallableSectionFields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "sectionId",
      "sectionRole",
      "heading",
      "aliases",
      "readModes",
    ]))
    expect(JSON.stringify(recallableSectionFields)).toContain("visibility metadata")

    expect(getRpgClockStateFields().map((field) => field.name)).toEqual(expect.arrayContaining([
      "clockId",
      "clockKind",
      "state",
      "narrativeLine",
      "visibilityScope",
      "sourceDeltas",
    ]))
  })

  it("defines World Tick schema guidance without adding a runtime wiki category", () => {
    const guidance = getRpgWorldTickSchemaGuidance().join("\n")

    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).not.toContain("runtime")
    expect(guidance).toContain("ActionResolution.playerActionDelta")
    expect(guidance).toContain("canonical player-action-only delta")
    expect(guidance).toContain("must not re-adjudicate")
    expect(guidance).toContain("directResults")
    expect(guidance).toContain("write wiki files")
    expect(guidance).toContain("player-facing narration")
    expect(guidance).toContain("worldDeltas.playerVisibleLine")
    expect(guidance).toContain("current-turn runtime/narration lens buckets")
    expect(guidance).toContain("not equal outline axes or synchronized story lines")
    expect(guidance).toContain("low-information turn")
    expect(guidance).toContain("do not invent material just to keep all three lens buckets active")
    expect(guidance).toContain("Parallel-line display is not PC knowledge")
    expect(guidance).toContain("possible_future, intention_only, and attempted_not_confirmed")
    expect(guidance).toContain("Gap signal output is World Tick's first-pass screening only")

    expect(getRpgWorldTickVisibilityMetaFields().map((field) => field.name)).toEqual(expect.arrayContaining([
      "visibilityScope",
      "knowledgeScope",
      "knowledgeSourceKind",
      "knownBy",
      "excludedKnowledgeFor",
      "displayPolicy",
    ]))
    expect(getRpgWorldTickClockFields().map((field) => field.name)).toEqual(expect.arrayContaining([
      "clockId",
      "clockKind",
      "updateKind",
      "previousState",
      "nextState",
      "timeDeltaBasis",
      "happenedStatus",
      "affectedPaths",
    ]))
    expect(getRpgWorldTickOngoingEventFields().map((field) => field.name)).toEqual(expect.arrayContaining([
      "eventId",
      "settlementKind",
      "visibility",
      "happenedStatus",
      "affectedPaths",
      "runtimeDeltaRefs",
    ]))
    expect(getRpgWorldTickInformationBroadcastFields().map((field) => field.name)).toEqual(expect.arrayContaining([
      "broadcastId",
      "informationSummary",
      "sourceActorRefs",
      "recipientRefs",
      "channel",
      "visibility",
    ]))
    expect(getRpgWorldTickReactionQueueFields().map((field) => field.name)).toEqual(expect.arrayContaining([
      "reactionId",
      "actorRef",
      "reactionTiming",
      "triggerDeltaIds",
      "knowledgeBasis",
      "visibility",
    ]))
    expect(getRpgWorldTickPacingStateFields().map((field) => field.name)).toEqual(expect.arrayContaining([
      "previousDebt",
      "nextDebt",
      "pressureChange",
      "campaignDelta",
      "compensationNeeded",
    ]))
    expect(getRpgWorldTickGapSignalFields().map((field) => field.name)).toEqual(expect.arrayContaining([
      "gapSignalId",
      "gapMode",
      "gapImpactCandidate",
      "causalChain",
      "outlineImpactAuthority",
      "happenedStatus",
    ]))
    expect(JSON.stringify(getRpgWorldTickGapSignalFields())).toContain("preliminary screening")
  })

  it("defines Outline-aware Brief Compiler schema guidance without changing slots", () => {
    const guidance = getRpgOutlineBriefCompilerSchemaGuidance()
    const combined = JSON.stringify(guidance)

    expect(RPG_SCHEMA_SLOTS).toHaveLength(22)
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).not.toContain("runtime")
    expect(guidance.impactRubric.map((field) => field.name)).toEqual([
      "none",
      "minor",
      "branch",
      "major_rewrite_required",
    ])
    expect(getRpgOutlineBriefImpactRubricFields().map((field) => field.name)).toContain("branch")
    expect(getRpgOutlineBriefBoundaryFields().map((field) => field.name)).toEqual([
      "playerFacingBrief",
      "parallelLineBrief",
      "tensionBriefInput",
    ])
    expect(getRpgOutlineBriefStableRefFields().map((field) => field.name)).toEqual(expect.arrayContaining([
      "stableId",
      "path",
      "sectionId",
      "dependency",
      "invalidation",
      "lineTarget",
      "revealPolicy",
    ]))
    expect(getRpgOutlineBriefTensionFuelFields().map((field) => field.name)).toEqual(expect.arrayContaining([
      "fuelId",
      "plotArcId",
      "tensionLineTarget",
      "pressureSources",
      "forbiddenResolutions",
    ]))
    expect(combined).toContain("outline beat, reveal, and branch condition refs")
    expect(combined).toContain("dependency")
    expect(combined).toContain("invalidation")
    expect(combined).toContain("line target")
    expect(combined).toContain("reveal policy")
    expect(combined).toContain("playerFacingBrief")
    expect(combined).toContain("parallelLineBrief")
    expect(combined).toContain("tensionBriefInput")
    expect(combined).toContain("tensionLine")
    expect(combined).toContain("plot-arcs/runtime")
  })

  it("defines Story Outline Regenerator schema guidance without changing slots or ordinary categories", () => {
    const slotIdsBefore = RPG_SCHEMA_SLOTS.map((slot) => slot.slotId)
    const categoryIdsBefore = RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)
    const guidance = getRpgStoryOutlineRegeneratorSchemaGuidance()
    const provisionalPatch = getRpgProvisionalOutlinePatchSchema()
    const proposal = getRpgOutlineRevisionProposalSchema()
    const reviewPolicy = getRpgOutlineRevisionReviewPolicy()
    const safetyFields = getRpgRegenerationSafetyFields()
    const combined = JSON.stringify(guidance)

    expect(RPG_SCHEMA_SLOTS).toHaveLength(22)
    expect(RPG_SCHEMA_SLOTS.map((slot) => slot.slotId)).toEqual(slotIdsBefore)
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).toEqual(categoryIdsBefore)
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.path)).not.toContain("runtime/")

    expect(provisionalPatch.map((field) => field.name)).toEqual(expect.arrayContaining([
      "patchId",
      "scope",
      "narrationHandoff",
      "runtimeDeltaRefs",
      "narrativeLines",
      "visibilityBoundary",
      "outlineImpactLevel",
      "nonPersistenceBoundary",
    ]))
    expect(proposal.map((field) => field.name)).toEqual(expect.arrayContaining([
      "proposalId",
      "reviewItemKind",
      "targetOutlineRefs",
      "mustPreserveFacts",
      "proposedRevision",
      "runtimeDeltaRefs",
      "reviewBoundary",
    ]))
    expect(safetyFields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "reportKind",
      "preservesConfirmedFacts",
      "futureNotWrittenAsEvent",
      "forbiddenRevealProtected",
      "provisionalPatchNonPersistent",
      "proposalReviewBoundary",
      "mainOutlineWritePolicy",
    ]))

    expect(reviewPolicy.join("\n")).toContain("independent review/pending")
    expect(reviewPolicy.join("\n")).toContain("not an ordinary runtime update")
    expect(reviewPolicy.join("\n")).toContain("manual_or_review_only")
    expect(combined).toContain("ProvisionalOutlinePatch")
    expect(combined).toContain("same-turn")
    expect(combined).toContain("does not mean wiki/outlines/main.md changed")
    expect(combined).toContain("Step 15 Narration")
    expect(combined).toContain("OutlineRevisionProposal")
    expect(combined).toContain("OutlineRevisionReviewPolicy")
    expect(combined).toContain("RegenerationSafetyReport")
    expect(combined).toContain("reviewItemKind outlineRevision")
    expect(combined).toContain("not runtimeWikiUpdate")
    expect(combined).toContain("RuntimeDeltaRef")
    expect(combined).toContain("NarrativeLine")
    expect(combined).toContain("VisibilityScope")
    expect(combined).toContain("KnowledgeScope")
    expect(combined).toContain("OutlineImpactLevel")
    expect(combined).toContain("wiki/outlines/main.md remains manual_or_review_only")
    expect(combined).toContain("must not be written to events")
    expect(combined).toContain("plot-arcs/runtime")
  })

  it("defines Narration Generator schema guidance without runtime contract or slot changes", () => {
    const slotIdsBefore = RPG_SCHEMA_SLOTS.map((slot) => slot.slotId)
    const categoryIdsBefore = RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)
    const outputSchema = getRpgNarrationOutputSchema()
    const tensionBriefFields = getRpgTensionBriefFields()
    const narrationMetaFields = getRpgNarrationMetaFields()
    const actionOptionFields = getRpgActionOptionRuntimeFields()
    const knowledgePolicy = getRpgNarrationKnowledgeBoundaryPolicy().join("\n")
    const stylePolicy = getRpgNarrationStyleHandoffPolicy().join("\n")
    const combined = [
      JSON.stringify(outputSchema),
      JSON.stringify(tensionBriefFields),
      JSON.stringify(narrationMetaFields),
      JSON.stringify(actionOptionFields),
      knowledgePolicy,
      stylePolicy,
    ].join("\n")

    expect(RPG_SCHEMA_SLOTS).toHaveLength(22)
    expect(RPG_SCHEMA_SLOTS.map((slot) => slot.slotId)).toEqual(slotIdsBefore)
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).toEqual(categoryIdsBefore)
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.path)).not.toContain("wiki/runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.path)).not.toContain("wiki/runtime/")

    expect(outputSchema.map((field) => field.name)).toEqual(expect.arrayContaining([
      "NarrationGeneratorInput",
      "TurnNarration",
      "playerFacingText",
      "parallelLineText",
      "tensionBrief",
      "displayPolicy",
      "narrationMeta",
      "nextActionOptions",
      "references",
      "styleBundle",
      "forbiddenForNarration",
      "playerKnowledgeBoundary",
      "pacingCompliance",
      "provisionalOutlinePatch.narrationHandoff",
      "outlineRevisionProposal",
    ]))
    expect(tensionBriefFields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "relationshipPressure",
      "emotionalPressure",
      "misunderstanding",
      "trust",
      "unresolvedTension",
      "usedPlotArcFuel",
      "carryover",
    ]))
    expect(narrationMetaFields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "timeCompression",
      "sceneTransition",
      "campaignDelta",
      "pacingCompliance",
      "provisionalPatchUsage",
      "revealBoundary",
      "playerKnowledgeBoundary",
    ]))
    expect(actionOptionFields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "expectedTimeCost",
      "likelyClockImpact",
      "visibilityScope",
      "likelyAffectedPaths",
      "isMetaOption",
    ]))

    expect(knowledgePolicy).toContain("parallel line display is not PC knowledge")
    expect(knowledgePolicy).toContain("must not automatically write wiki/player/known_information.md")
    expect(knowledgePolicy).toContain("has priority over ordinary OutlineAwareNarrationBrief")
    expect(knowledgePolicy).toContain("cannot rewrite PostActionWorkingState, WorldTickResult, or ActionResolution")
    expect(knowledgePolicy).toContain("outlineRevisionProposal is not Narration fact material")
    expect(stylePolicy).toContain("styleBundle may affect voice")
    expect(stylePolicy).toContain("must not be promoted into world facts, plot facts, character facts, or events")
    expect(stylePolicy).toContain("forbiddenForNarration")
    expect(combined).toContain("display to the real user does not grant player-character knowledge")
    expect(combined).toContain("not ordinary event fact material")
    expect(combined).toContain("not a wiki slot")
  })

  it("defines LLM 6 Runtime Update Proposal schema guidance without runtime behavior changes", () => {
    const slotIdsBefore = RPG_SCHEMA_SLOTS.map((slot) => slot.slotId)
    const categoryIdsBefore = RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)
    const inputSchema = getRpgRuntimeUpdateProposalInputSchema()
    const resultSchema = getRpgRuntimeUpdateProposalResultSchema()
    const proposedUpdateFields = getRpgProposedWikiUpdateRuntimeFields()
    const sourceDeltaFields = getRpgRuntimeUpdateSourceDeltaFields()
    const skippedDeltaFields = getRpgSkippedRuntimeDeltaFields()
    const pacingFields = getRpgPacingUpdateProposalFields()
    const groupFields = getRpgProposalGroupFields()
    const outlineReviewItemFields = getRpgOutlineRevisionReviewItemSchema()
    const guidance = getRpgRuntimeUpdateProposalGuidance().join("\n")
    const aggregate = getRpgRuntimeUpdateProposalSchemaGuidance()
    const combined = [
      JSON.stringify(aggregate),
      guidance,
    ].join("\n")

    expect(RPG_SCHEMA_SLOTS).toHaveLength(22)
    expect(RPG_SCHEMA_SLOTS.map((slot) => slot.slotId)).toEqual(slotIdsBefore)
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).toEqual(categoryIdsBefore)
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.path)).not.toContain("wiki/runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.path)).not.toContain("wiki/runtime/")

    expect(inputSchema.map((field) => field.name)).toEqual(expect.arrayContaining([
      "RuntimeUpdateProposalInput",
      "postActionWorkingState",
      "actionResolution",
      "worldTickResult",
      "recallAndOutlineHandoff",
      "turnNarration",
      "consistencyValidation",
      "outlineRevisionProposal",
      "allowedTargets",
    ]))
    expect(resultSchema.map((field) => field.name)).toEqual(expect.arrayContaining([
      "RuntimeUpdateProposalResult",
      "proposedWikiUpdates",
      "outlineRevisionReviewItems",
      "journalEntries",
      "skippedDeltas",
      "pacingUpdateProposal",
      "proposalGroups",
      "warnings",
    ]))
    expect(proposedUpdateFields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "sourceDeltas",
      "lineTarget",
      "visibility",
      "knowledgeScope",
      "happenedStatus",
      "confidence",
      "validationHints",
    ]))
    expect(sourceDeltaFields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "deltaId",
      "sourceStage",
      "sourcePath",
      "sourceField",
      "lineTarget",
      "visibility",
      "knowledgeScope",
      "happenedStatus",
      "confidence",
    ]))
    expect(skippedDeltaFields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "deltaId",
      "sourceDeltas",
      "reason",
      "notWrittenBecause",
      "suggestedReview",
      "journalOnly",
    ]))
    expect(pacingFields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "timeDelta",
      "campaignDelta",
      "pacingDebtChange",
      "stagnationRisk",
      "activeClockChanges",
      "nextTurnPacingHint",
      "sourceDeltas",
      "validationHints",
    ]))
    expect(groupFields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "groupId",
      "sourceDeltaIds",
      "targetPaths",
      "reason",
      "requiredTogether",
      "missingCompanionWarnings",
    ]))
    expect(outlineReviewItemFields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "proposalId",
      "reviewItemKind",
      "proposal",
      "sourceDeltas",
      "targetPathPolicy",
      "status",
      "safetyNotes",
    ]))

    expect(combined).toContain("LLM 6 Schema Guidance only defines code-readable schema descriptions")
    expect(combined).toContain("structured fact sources")
    expect(combined).toContain("structured turn delta has priority over generatedNarrative")
    expect(combined).toContain("lineTarget values remain playerVisibleLine, parallelLine, and tensionLine")
    expect(combined).toContain("current-turn narration lens targets")
    expect(combined).toContain("not outline axes")
    expect(combined).toContain("requirement to keep all three story lines advancing")
    expect(JSON.stringify(proposedUpdateFields)).toContain("not outline ownership or a required story axis")
    expect(JSON.stringify(sourceDeltaFields)).toContain("not a persistent outline line")
    expect(combined).toContain("playerFacingText is display evidence only")
    expect(combined).toContain("parallelLineText and user_visible_pc_unknown")
    expect(combined).toContain("must not automatically enter wiki/player/known_information.md")
    expect(combined).toContain("nextActionOptions are candidate future actions")
    expect(combined).toContain("events updates require confirmed_happened")
    expect(combined).toContain("attempted_not_confirmed cannot enter confirmed event")
    expect(combined).toContain("outlineRevisionProposal can only become an independent OutlineRevisionReviewItem")
    expect(combined).toContain("must not be mixed into ordinary ProposedWikiUpdate")
    expect(combined).toContain("must not auto-write wiki/outlines/main.md")
    expect(combined).toContain("Fenced markdown update blocks may remain as compatibility/manual staging protocol")
    expect(combined).toContain("should not rely on fenced blocks as its only protocol")
    expect(combined).not.toContain("RPG_SCHEMA_SLOTS mutation")
  })

  it("defines Action Resolver fixed slot semantics without adding interaction logic", () => {
    const slotSemantics = getRpgActionResolverSlotSemantics()
    const paths = slotSemantics.map((slot) => slot.path)

    expect(paths).toEqual(expect.arrayContaining([
      "wiki/current-scene/scene_state.md",
      "wiki/player/known_information.md",
      "wiki/outlines/progress.md",
      "wiki/rules/",
    ]))

    const combined = JSON.stringify(slotSemantics)
    expect(combined).toContain("active clocks/countdowns")
    expect(combined).toContain("pending reactions")
    expect(combined).toContain("pacing state")
    expect(combined).toContain("pc_known")
    expect(combined).toContain("pc_misunderstanding")
    expect(combined).toContain("branch conditions")
    expect(combined).toContain("success/failure conditions")
    expect(combined).toContain("resource costs")
    expect(combined).toContain("distance")
    expect(combined).toContain("time")
    expect(combined).toContain("perception")
    expect(combined).toContain("stealth")
    expect(combined).toContain("combat")
    expect(combined).toContain("investigation")
  })

  it("defines runtime persistence boundaries outside ordinary wiki categories", () => {
    const boundary = getRpgRuntimePersistenceBoundaryGuidance().join("\n")

    expect(boundary).toContain(".llm-wiki/runtime/")
    expect(boundary).toContain("turn record")
    expect(boundary).toContain("journal")
    expect(boundary).toContain("pending runtime metadata")
    expect(boundary).toContain("not an ordinary extractable RPG wiki category")
    expect(boundary).toContain("not in `wiki/runtime/`")
  })

  it("represents dynamic update boundaries from the schema document", () => {
    const currentScene = getRpgWikiSchemaEntry("current-scene")

    expect(getRpgWikiSchemaEntry("events")?.updateStrategy).toBe("append")
    expect(currentScene?.updateStrategy).toBe("overwrite")
    expect(currentScene?.recommendedGranularity).toContain("current-scene/scene_state.md")
    expect(currentScene?.extractionGoal).toContain("Ordinary source ingest must not generate or update this category")
    expect(currentScene?.extractionGoal).toContain("RPG Play/Runtime apply flow")
    expect(currentScene?.exclude).toContain("Route summaries, flower-viewing ending scenes, or years-later epilogues written into current-scene")
    expect(getRpgWikiSchemaEntry("world")?.updateStrategy).toBe("cautious-merge")
    expect(getRpgWikiSchemaEntry("characters")?.updateStrategy).toBe("merge")
    expect(getRpgWikiSchemaEntry("relationships")?.updateStrategy).toBe("merge")
  })

  it("turns characters into roleplay-ready character operating models", () => {
    const characters = getRpgWikiSchemaEntry("characters")

    expect(characters?.extractionGoal).toContain("roleplay-ready character profiles / character operating models")
    expect(characters?.extractionGoal).toContain("Keep Canon Facts, Reasonable Interpretation, and RP Usage semantically distinct")
    expect(characters?.extractionGoal).toContain("default here unless the source explicitly says they are the current RPG player character")
    expect(characters?.extractionGoal).toContain("Do not collapse route-specific, timeline-specific, or ending-specific states")

    expect(characters?.fields.map((field) => field.name)).toEqual([
      "identity",
      "roleImpression",
      "canonFacts",
      "characterModel",
      "triggersAndReactions",
      "behaviorRules",
      "dialogueStyle",
      "relationshipDynamics",
      "routeAndTimelineVariants",
      "rpgUsage",
      "evidenceAndUncertainty",
    ])

    expect(characters?.fields.find((field) => field.name === "roleImpression")?.description).toContain("## Character Impression")
    expect(characters?.fields.find((field) => field.name === "canonFacts")?.description).toContain("## Canon Facts")
    expect(characters?.fields.find((field) => field.name === "characterModel")?.description).toContain("## Psychological Model")
    expect(characters?.fields.find((field) => field.name === "triggersAndReactions")?.description).toContain("Trauma / stress sources")
    expect(characters?.fields.find((field) => field.name === "triggersAndReactions")?.description).toContain("Defense patterns")
    expect(characters?.fields.find((field) => field.name === "triggersAndReactions")?.description).toContain("Trigger points")
    expect(characters?.fields.find((field) => field.name === "triggersAndReactions")?.description).toContain("Deep Needs")
    expect(characters?.fields.find((field) => field.name === "dialogueStyle")?.description).toContain("## Dialogue Style")
    expect(characters?.fields.find((field) => field.name === "relationshipDynamics")?.description).toContain("## Relationship Dynamics")
    expect(characters?.fields.find((field) => field.name === "routeAndTimelineVariants")?.description).toContain("## Route and Timeline Variants")
    expect(characters?.fields.find((field) => field.name === "rpgUsage")?.description).toContain("## RP Usage")
    expect(characters?.fields.find((field) => field.name === "evidenceAndUncertainty")?.description).toContain("## Evidence and Uncertainty")

    expect(characters?.exclude).toContain("Encyclopedia trivia that is not useful for portrayal or interaction")
    expect(characters?.exclude).toContain("Fate / UBW / HF / ending-specific state collapsed into one universal current-state summary")
    expect(characters?.exclude).toContain("RP-serving interpretation, convenience assumptions, or play advice written as if they were hard canon facts")

    expect(characters?.recommendedGranularity).toContain("roleplay-ready character card")
    expect(characters?.recommendedGranularity).toContain("## Character Impression")
    expect(characters?.recommendedGranularity).toContain("## Canon Facts")
    expect(characters?.recommendedGranularity).toContain("## Reasonable Interpretation")
    expect(characters?.recommendedGranularity).toContain("## Psychological Model")
    expect(characters?.recommendedGranularity).toContain("## RP Usage")
    expect(characters?.recommendedGranularity).toContain("## Evidence and Uncertainty")
  })

  it("keeps the player boundary strict", () => {
    const player = getRpgWikiSchemaEntry("player")

    expect(player?.extractionGoal).toContain("player-created or explicitly declared player character only")
    expect(player?.exclude).toContain("Original/canon characters unless the source explicitly says they are the current RPG player character")
    expect(player?.exclude).toContain("Original protagonists, POV characters, or game-controllable characters treated as player by default")
  })

  it("hardens the events versus plot-arcs boundary for multi-event routes and timelines", () => {
    const events = getRpgWikiSchemaEntry("events")
    const plotArcs = getRpgWikiSchemaEntry("plot-arcs")

    expect(events?.extractionGoal).toContain("discrete, confirmed events")
    expect(events?.exclude).toContain("Route, storyline, timeline, or complete-course pages that span many independent sub-events")
    expect(events?.exclude).toContain("Multi-day or multi-year narrative overviews that should be split or stored under plot-arcs")
    expect(events?.recommendedGranularity).toContain("time or relative-time anchor, place, participants, what happened, and consequences/state change")
    expect(events?.recommendedGranularity).toContain("contains 5+ independent sub-events")

    expect(plotArcs?.extractionGoal).toContain("Multi-event routes, storyline overviews, and long-span timelines belong here")
    expect(plotArcs?.recommendedGranularity).toContain("route")
  })

  it("keeps pressure to emit core locations and factions on a secondary scan", () => {
    const locations = getRpgWikiSchemaEntry("locations")
    const factions = getRpgWikiSchemaEntry("factions")

    expect(locations?.extractionGoal).toContain("secondary scan")
    expect(locations?.recommendedGranularity).toContain("short stub")
    expect(locations?.recommendedGranularity).toContain("limited-source")

    expect(factions?.extractionGoal).toContain("secondary scan")
    expect(factions?.recommendedGranularity).toContain("short stub")
    expect(factions?.recommendedGranularity).toContain("limited-source")
  })

  it("keeps current campaign state in runtime overlays for stable base categories", () => {
    const expectRuntimeOverlayBoundary = (categoryId: "characters" | "locations" | "factions" | "items") => {
      const entry = getRpgWikiSchemaEntry(categoryId)
      const combinedText = [
        entry?.extractionGoal,
        entry?.recommendedGranularity,
        ...(entry?.fields.map((field) => field.description) ?? []),
        ...(entry?.exclude ?? []),
      ].join("\n")

      expect(combinedText).toMatch(/runtime|overlay/)
    }

    expectRuntimeOverlayBoundary("characters")
    expectRuntimeOverlayBoundary("locations")
    expectRuntimeOverlayBoundary("factions")
    expectRuntimeOverlayBoundary("items")
  })

  it("defines the fixed schema slots from the schema slot contract", () => {
    expect(RPG_SCHEMA_SLOTS).toHaveLength(22)
    expect(RPG_SCHEMA_SLOTS.map((slot) => [slot.slotId, slot.path])).toEqual([
      ["world_basic_overview", "wiki/world/basic_overview.md"],
      ["world_history", "wiki/world/history.md"],
      ["world_common_sense", "wiki/world/common_sense.md"],
      ["world_supernatural_presence", "wiki/world/supernatural_presence.md"],
      ["world_social_structure", "wiki/world/social_structure.md"],
      ["main_outline", "wiki/outlines/main.md"],
      ["outline_progress", "wiki/outlines/progress.md"],
      ["rules_core", "wiki/rules/core.md"],
      ["rules_world", "wiki/rules/world.md"],
      ["rules_table", "wiki/rules/table.md"],
      ["style_narration", "wiki/style/narration.md"],
      ["style_dialogue", "wiki/style/dialogue.md"],
      ["style_forbidden", "wiki/style/forbidden.md"],
      ["memory_long_term", "wiki/memory/long-term.md"],
      ["memory_session_notes", "wiki/memory/session-notes.md"],
      ["memory_player_preferences", "wiki/memory/player-preferences.md"],
      ["current_scene", "wiki/current-scene/scene_state.md"],
      ["player_main", "wiki/player/player.md"],
      ["player_abilities", "wiki/player/abilities.md"],
      ["player_inventory", "wiki/player/inventory.md"],
      ["player_goals", "wiki/player/goals.md"],
      ["player_known_information", "wiki/player/known_information.md"],
    ])
    expect(getRequiredRpgSchemaSlots()).toHaveLength(22)
  })

  it("looks up schema slots by id, path, required flag, and owner", () => {
    expect(getRpgSchemaSlot("current_scene")?.path).toBe("wiki/current-scene/scene_state.md")
    expect(getRpgSchemaSlotByPath("WIKI/WORLD/BASIC_OVERVIEW.MD")?.slotId).toBe("world_basic_overview")
    expect(getRpgSchemaSlotByPath("\\wiki\\outlines\\main.md")?.slotId).toBe("main_outline")
    expect(getRpgSchemaSlotByPath("C:/campaign/wiki/outlines/progress.md")?.slotId).toBe("outline_progress")
    expect(getRpgSchemaSlotByPath("WIKI/PLAYER/ABILITIES.MD")?.slotId).toBe("player_abilities")

    expect(getRpgSchemaSlotsByOwner("runtime").map((slot) => slot.slotId)).toEqual([
      "outline_progress",
      "current_scene",
    ])
    expect(getRpgSchemaSlotsByOwner("source_ingest").map((slot) => slot.slotId)).toEqual([
      "world_basic_overview",
      "world_history",
      "world_common_sense",
      "world_supernatural_presence",
      "world_social_structure",
    ])
    expect(getRpgSchemaSlotsByOwner("campaign_setup").map((slot) => slot.slotId)).toEqual([
      "player_main",
      "player_abilities",
      "player_inventory",
      "player_goals",
      "player_known_information",
    ])
  })

  it("marks control files as manual_or_review_only and outline progress as runtime merge", () => {
    for (const slotId of [
      "main_outline",
      "rules_core",
      "rules_world",
      "rules_table",
      "style_narration",
      "style_dialogue",
      "style_forbidden",
      "memory_player_preferences",
    ]) {
      expect(getRpgSchemaSlot(slotId)?.writePolicy).toBe("manual_or_review_only")
      expect(getRpgSchemaSlot(slotId)?.importPolicy).toBe("controlled_canonicalize")
    }

    expect(getRpgSchemaSlot("outline_progress")).toEqual(
      expect.objectContaining({
        owner: "runtime",
        runtimePriority: "high",
        importPolicy: "runtime_apply",
        writePolicy: "merge",
      }),
    )
  })

  it("exposes the fixed player slot path set", () => {
    expect(RPG_FIXED_PLAYER_SLOT_PATHS).toEqual([
      "wiki/player/player.md",
      "wiki/player/abilities.md",
      "wiki/player/inventory.md",
      "wiki/player/goals.md",
      "wiki/player/known_information.md",
    ])
    expect(isFixedPlayerSlotPath("wiki/player/player.md")).toBe(true)
    expect(isFixedPlayerSlotPath("C:/campaign/wiki/player/inventory.md")).toBe(true)
    expect(isFixedPlayerSlotPath("\\wiki\\player\\known_information.md")).toBe(true)
    expect(isFixedPlayerSlotPath("wiki/player/runtime-state.md")).toBe(false)
    expect(isFixedPlayerSlotPath("wiki/player/custom.md")).toBe(false)
  })

  it("exposes the fixed world slot path set", () => {
    expect(RPG_FIXED_WORLD_SLOT_PATHS).toEqual([
      "wiki/world/basic_overview.md",
      "wiki/world/history.md",
      "wiki/world/common_sense.md",
      "wiki/world/supernatural_presence.md",
      "wiki/world/social_structure.md",
    ])
    expect(getRpgSchemaSlotByPath("wiki/world/supernatural_presence.md")?.slotId).toBe("world_supernatural_presence")
  })

  it("defines the D1 quests/player goals/plot-arcs target boundary", () => {
    const playerGoals = getRpgDirectoryBoundaryGuidance("player_goals")
    const quests = getRpgDirectoryBoundaryGuidance("quests")
    const plotArcs = getRpgDirectoryBoundaryGuidance("plot_arcs")

    expect(RPG_DIRECTORY_BOUNDARY_GUIDANCE.map((guidance) => guidance.boundaryId)).toContain("quests")
    expect(playerGoals?.paths).toContain("wiki/player/goals.md")
    expect(playerGoals?.include.join(" ")).toContain("PC subjective goals")
    expect(playerGoals?.exclude.join(" ")).toContain("Quest progress tables")
    expect(playerGoals?.exclude.join(" ")).toContain("Plot pressure")

    expect(quests?.include.join(" ")).toContain("Game-recognized, trackable objectives")
    expect(quests?.include.join(" ")).toContain("completion or failure conditions")
    expect(quests?.exclude.join(" ")).toContain("Purely subjective wishes")
    expect(quests?.exclude.join(" ")).toContain("ordinary player TODO/checklists")

    expect(plotArcs?.include.join(" ")).toContain("Story pressure")
    expect(plotArcs?.include.join(" ")).toContain("foreshadowing")
    expect(plotArcs?.exclude.join(" ")).toContain("Player TODO/checklists")
    expect(plotArcs?.exclude.join(" ")).toContain("possible futures written as already happened")
  })

  it("defines the D1 rules/world boundary", () => {
    const rules = getRpgDirectoryBoundaryGuidance("rules")
    const world = getRpgDirectoryBoundaryGuidance("world")

    expect(rules?.include.join(" ")).toContain("Executable mechanics")
    expect(rules?.include.join(" ")).toContain("success/failure boundaries")
    expect(rules?.exclude.join(" ")).toContain("Stable background prose")

    expect(world?.include.join(" ")).toContain("Background")
    expect(world?.include.join(" ")).toContain("stable setting facts")
    expect(world?.exclude.join(" ")).toContain("Executable mechanics")
    expect(world?.exclude.join(" ")).toContain("resource costs")
  })

  it("defines the D1 style versus character voice boundary", () => {
    const style = getRpgDirectoryBoundaryGuidance("style")
    const characters = getRpgDirectoryBoundaryGuidance("characters")

    expect(style?.include.join(" ")).toContain("Global narration")
    expect(style?.exclude.join(" ")).toContain("Character-specific voice")
    expect(style?.exclude.join(" ")).toContain("catchphrases")
    expect(style?.exclude.join(" ")).toContain("relationship-driven tone changes")

    expect(characters?.include.join(" ")).toContain("character-specific voice")
    expect(characters?.exclude.join(" ")).toContain("relationship-state changes")
    expect(characters?.recommendedGranularity).toContain("characters/runtime/")
  })

  it("defines the D1 characters/relationships boundary", () => {
    const characters = getRpgDirectoryBoundaryGuidance("characters")
    const relationships = getRpgDirectoryBoundaryGuidance("relationships")

    expect(characters?.include.join(" ")).toContain("Stable character identity")
    expect(characters?.exclude.join(" ")).toContain("Full relationship histories")
    expect(characters?.exclude.join(" ")).toContain("permanent character personality")

    expect(relationships?.include.join(" ")).toContain("Stable relationship model")
    expect(relationships?.include.join(" ")).toContain("trust/hostility")
    expect(relationships?.exclude.join(" ")).toContain("Duplicate complete character profiles")
    expect(relationships?.recommendedGranularity).toContain("relationships/runtime/")
  })

  it("defines the D1 items versus player inventory boundary", () => {
    const items = getRpgDirectoryBoundaryGuidance("items")
    const inventory = getRpgDirectoryBoundaryGuidance("player_inventory")

    expect(items?.include.join(" ")).toContain("Item definitions")
    expect(items?.include.join(" ")).toContain("usual holder")
    expect(items?.exclude.join(" ")).toContain("player's current quantity")
    expect(items?.recommendedGranularity).toContain("items/runtime/")

    expect(inventory?.paths).toContain("wiki/player/inventory.md")
    expect(inventory?.include.join(" ")).toContain("Player current holdings")
    expect(inventory?.include.join(" ")).toContain("equipped/backpack")
    expect(inventory?.exclude.join(" ")).toContain("Full item definitions")
  })

  it("defines the D2 runtime cross-directory sync guidance", () => {
    const guidance = getRpgRuntimeCrossDirectorySyncGuidance()
    const combined = JSON.stringify(guidance)

    expect(combined).toContain("current-scene is an overwrite-only latest-moment snapshot")
    expect(combined).toContain("wiki/player/inventory.md")
    expect(combined).toContain("wiki/items/runtime/*.md")
    expect(combined).toContain("wiki/characters/runtime/*.md")
    expect(combined).toContain("wiki/locations/runtime/*.md")
    expect(combined).toContain("wiki/factions/runtime/*.md")
    expect(combined).toContain("wiki/relationships/runtime/*.md")
    expect(combined).toContain("wiki/plot-arcs/runtime/*.md")
    expect(combined).toContain("wiki/outlines/progress.md")
    expect(combined).toContain("base wiki/relationships/*.md")
    expect(combined).toContain("base wiki/plot-arcs/*.md")
    expect(combined).toContain("outlines/main.md")
  })

  it("defines the D2.5 Source Ingest target policy", () => {
    const policy = getRpgSourceIngestTargetPolicy()

    expect(policy.ordinaryTargets).toContain("wiki/sources/")
    expect(policy.ordinaryTargets).toContain("wiki/world/basic_overview.md")
    expect(policy.ordinaryTargets).toContain("wiki/world/history.md")
    expect(policy.ordinaryTargets).toContain("wiki/world/common_sense.md")
    expect(policy.ordinaryTargets).toContain("wiki/world/supernatural_presence.md")
    expect(policy.ordinaryTargets).toContain("wiki/world/social_structure.md")
    expect(policy.ordinaryTargets).toContain("wiki/characters/")
    expect(policy.ordinaryTargets).toContain("wiki/player/player.md")
    expect(policy.ordinaryTargets).toContain("wiki/player/known_information.md")
    expect(policy.ordinaryTargets).toContain("wiki/relationships/")
    expect(policy.structuralTargets).toEqual(["wiki/index.md", "wiki/overview.md", "wiki/log.md"])

    expect(isRpgSourceIngestAllowedTarget("wiki/world/supernatural_presence.md")).toBe(true)
    expect(isRpgSourceIngestAllowedTarget("wiki/world/tide-laws.md")).toBe(false)
    expect(isRpgSourceIngestAllowedTarget("wiki/player/player.md")).toBe(true)
    expect(isRpgSourceIngestAllowedTarget("wiki/player/custom-sheet.md")).toBe(false)
    expect(isRpgSourceIngestAllowedTarget("wiki/index.md")).toBe(true)

    expect(getRpgSourceIngestForbiddenTarget("wiki/rules/core.md")?.recommendedMode).toBe("control_doc_import")
    expect(getRpgSourceIngestForbiddenTarget("wiki/style/narration.md")?.recommendedMode).toBe("control_doc_import")
    expect(getRpgSourceIngestForbiddenTarget("wiki/memory/long-term.md")?.recommendedMode).toBe("control_doc_import")
    expect(getRpgSourceIngestForbiddenTarget("wiki/outlines/main.md")?.recommendedMode).toBe("control_doc_import")
    expect(getRpgSourceIngestForbiddenTarget("wiki/current-scene/scene_state.md")?.recommendedMode).toBe("runtime_update_apply")
    expect(getRpgSourceIngestForbiddenTarget("wiki/characters/runtime/rin.md")?.recommendedMode).toBe("runtime_update_apply")
    expect(getRpgSourceIngestForbiddenTarget("wiki/locations/runtime/harbor.md")?.recommendedMode).toBe("runtime_update_apply")
    expect(getRpgSourceIngestForbiddenTarget("wiki/quests/main.md")?.recommendedMode).toBe("review_only")
  })
})

import type {
  ActionResolution,
  OutlineBriefCompilerOutput,
  OutlineBriefReference,
  PostActionWorkingState,
  RecalledMaterial,
  RecallSelection,
  SubmittedAction,
  TurnNarration,
  WorldTickResult,
  WorldTickVisibleSelection,
  WorldTickVisibilityMeta,
} from "./rpg-runtime/types"
import { buildPostActionWorkingState, selectWorldTickVisibleContent } from "./rpg-runtime/world-tick-working-state"

export function sampleActionResolution(
  action: SubmittedAction = {
    id: "act-1",
    text: "Ask Mira to inspect the canal gate sigil.",
    source: "freeform",
  },
): ActionResolution {
  const deltaRef: ActionResolution["runtimeDeltaRefs"][number] = {
    deltaId: `delta-${action.id}`,
    sourceStage: "actionResolution",
    sourcePath: `.llm-wiki/runtime/turns/${action.id}/action-resolution.json`,
    summary: "The player attempts a cautious sigil inspection with Mira before touching the ward.",
    narrativeLine: "playerVisibleLine",
    usePurpose: "actionResolution",
    happenedStatus: "attempted_not_confirmed",
  }

  return {
    resolutionId: `action-resolution-${action.id}`,
    submittedActionId: action.id,
    parsedIntent: {
      intentKind: "investigate",
      actorRef: "player:Iven",
      targetRefs: ["character:Mira", "location:canal-gate-sigil"],
      actionScope: action.text,
      declaredGoal: "Understand the sigil before committing to the gate action.",
      ambiguityNotes: [],
    },
    eventDraft: {
      eventId: `event-draft-${action.id}`,
      eventType: "investigation_attempt",
      summary: "The player attempts to get Mira's read on the canal-gate sigil.",
      status: "attempted_not_confirmed",
      actorRefs: ["player:Iven"],
      targetRefs: ["character:Mira", "location:canal-gate-sigil"],
      affectedRefs: ["wiki/current-scene/scene_state.md"],
      riskSummary: "The attempt is low risk if the inspection stays quiet.",
      requiredChecks: ["Mira must be able to interpret the sigil under pressure."],
      ambiguityNotes: [],
    },
    feasibility: {
      status: "partially_feasible",
      rationale: "Mira can inspect the sigil, but the cracked mark may leave uncertainty.",
      limitingFactors: ["The sigil is cracked.", "The scene is under patrol pressure."],
      requiredChecks: ["Whether Mira recognizes this exact ward mark."],
      alternativeResults: ["Mira may identify what not to touch without fully solving the ward."],
    },
    costs: [
      {
        costId: `cost-time-${action.id}`,
        kind: "time",
        description: "A careful inspection consumes a few focused minutes.",
        appliesIf: "The player waits for Mira's read instead of touching the sigil immediately.",
      },
    ],
    obstacles: [
      {
        obstacleId: `obstacle-cracked-sigil-${action.id}`,
        severity: "moderate",
        description: "The cracked sigil may only be partially legible.",
        bypassHint: "Combine Mira's read with the lantern key's reaction.",
      },
    ],
    directResults: [
      {
        resultId: `direct-result-inspection-${action.id}`,
        summary: "A cautious sigil read begins; the gate opening is not confirmed.",
        happenedStatus: "attempted_not_confirmed",
        visibilityScope: "pc_visible",
        affectedRefs: ["wiki/current-scene/scene_state.md"],
      },
    ],
    timeDelta: {
      scale: "minutes",
      unit: "minutes",
      min: 2,
      max: 5,
      summary: "The question and inspection take a few focused minutes.",
      reasoning: "Mira needs time to study the cracked mark while patrol pressure remains relevant.",
    },
    progressPotential: {
      level: "medium",
      summary: "The action can reveal safe key-use conditions and advance the gate objective.",
      possibleUnlocks: ["Safe key contact", "Patrol-risk tradeoff"],
      gapTriggerPotential: "minor",
    },
    playerActionDelta: {
      deltaId: `player-action-delta-${action.id}`,
      causedByActionId: action.id,
      scope: "player_action_only",
      positionChanges: [],
      resourceChanges: [],
      inventoryChanges: [],
      conditionChanges: [],
      knowledgeChanges: ["May learn whether the sigil is safe to touch."],
      relationshipSignals: ["The player defers to Mira's expertise."],
      sceneChanges: ["Attention shifts from forcing the gate to interpreting the sigil."],
      interruptedEvents: [],
      exposedInformation: ["Mira may reveal familiarity with canal wards."],
      runtimeDeltaRefs: [deltaRef],
      notes: ["No wiki write, narration, world tick, or reaction queue is included."],
    },
    runtimeDeltaRefs: [deltaRef],
    references: [
      {
        path: "wiki/current-scene/scene_state.md",
        sectionId: "currentScene.summary",
        reason: "Provides the active scene and gate pressure.",
        usePurpose: "actionResolution",
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
      },
      {
        path: "wiki/rules/core.md",
        sectionId: "rules.ward_touch",
        reason: "Constrains ward-touch risk.",
        usePurpose: "ruleCheck",
      },
    ],
    warnings: [],
  }
}

export function sampleWorldTickResult(actionResolution: ActionResolution): WorldTickResult {
  const worldDeltaRef = worldTickDeltaRef("patrol-countdown-advance")
  const parallelDeltaRef = worldTickDeltaRef("watch-captain-order")
  const gapDeltaRef = worldTickDeltaRef("gap-sigil-delay")

  return {
    tickId: `world-tick-${actionResolution.submittedActionId}`,
    sourceActionResolutionId: actionResolution.resolutionId,
    timeAdvance: {
      sourceTimeDelta: actionResolution.timeDelta,
      appliedSummary: "Two to five minutes pass while Mira studies the ward.",
      clockReasoning: "The action resolution timeDelta advances the patrol countdown but does not rejudge the player action.",
    },
    worldDeltas: {
      playerVisibleLine: [
        {
          deltaId: "world-delta-patrol-nearer",
          summary: "The Harbor Watch patrol lights move closer above the canal gate.",
          narrativeLine: "playerVisibleLine",
          visibility: pcVisible(),
          happenedStatus: "confirmed_happened",
          affectedPaths: ["wiki/current-scene/scene_state.md"],
          runtimeDeltaRefs: [worldDeltaRef],
          sourcePlayerDeltaIds: [actionResolution.playerActionDelta.deltaId],
          sourceClockIds: ["clock-harbor-watch-return"],
          knowledgeEffects: ["PC can see patrol light movement, but not the patrol's full plan."],
        },
      ],
      parallelLine: [
        {
          deltaId: "world-delta-watch-captain-order",
          summary: "A watch captain orders a delayed sweep of the lower canal.",
          narrativeLine: "parallelLine",
          visibility: userVisiblePcUnknown(),
          happenedStatus: "confirmed_happened",
          affectedPaths: ["wiki/factions/runtime/harbor-watch.md"],
          runtimeDeltaRefs: [parallelDeltaRef],
          sourcePlayerDeltaIds: [actionResolution.playerActionDelta.deltaId],
          sourceClockIds: ["clock-harbor-watch-return"],
          knowledgeEffects: ["User-visible parallel information does not update PC knowledge."],
        },
      ],
      tensionLine: [
        {
          deltaId: "world-delta-mira-trust-pressure",
          summary: "Mira notices that Iven waited for her expertise instead of forcing the lock.",
          narrativeLine: "tensionLine",
          visibility: gmOnly(),
          happenedStatus: "ongoing",
          affectedPaths: ["wiki/relationships/runtime/player_mira.md"],
          runtimeDeltaRefs: [worldTickDeltaRef("mira-trust-pressure")],
          sourcePlayerDeltaIds: [actionResolution.playerActionDelta.deltaId],
          sourceClockIds: [],
          knowledgeEffects: ["This is a tension signal for later relationship handling, not direct PC knowledge."],
        },
      ],
    },
    clockUpdates: [
      {
        clockId: "clock-harbor-watch-return",
        clockKind: "countdown",
        updateKind: "decrease",
        previousState: "Patrol several minutes away.",
        nextState: "Patrol lights are near enough to pressure the gate decision.",
        amount: 2,
        timeDeltaBasis: actionResolution.timeDelta,
        reason: "The player waits while the countdown remains active.",
        sourcePlayerDeltaIds: [actionResolution.playerActionDelta.deltaId],
        narrativeLine: "playerVisibleLine",
        visibility: pcVisible(),
        happenedStatus: "ongoing",
        affectedPaths: ["wiki/current-scene/scene_state.md"],
        runtimeDeltaRefs: [worldDeltaRef],
      },
    ],
    settledOngoingEvents: [
      {
        eventId: "ongoing-mira-sigil-read",
        settlementKind: "advanced",
        summary: "Mira finishes enough of the sigil read to identify a safe edge.",
        cause: "The player waits through the resolved timeDelta.",
        participantRefs: ["character:Mira"],
        clockUpdateIds: ["clock-harbor-watch-return"],
        narrativeLine: "playerVisibleLine",
        visibility: pcVisible(),
        happenedStatus: "ongoing",
        affectedPaths: ["wiki/current-scene/scene_state.md"],
        runtimeDeltaRefs: [worldTickDeltaRef("ongoing-mira-sigil-read")],
      },
    ],
    informationBroadcast: [
      {
        broadcastId: "broadcast-watch-order",
        informationSummary: "The watch captain's order is heard by nearby Harbor Watch members, not by the PC.",
        sourceActorRefs: ["character:watch-captain"],
        recipientRefs: ["faction:harbor-watch"],
        channel: "spoken order",
        certainty: "confirmed",
        preventsPcKnowledgeLeak: true,
        narrativeLine: "parallelLine",
        visibility: npcKnownUserVisiblePcUnknown(),
        happenedStatus: "confirmed_happened",
        affectedPaths: ["wiki/factions/runtime/harbor-watch.md"],
        runtimeDeltaRefs: [parallelDeltaRef],
      },
    ],
    reactionQueue: [
      {
        reactionId: "reaction-mira-warning",
        actorRef: "character:Mira",
        reactionTiming: "immediate",
        summary: "Mira warns the player to use only the uncracked edge of the key.",
        triggerDeltaIds: ["world-delta-patrol-nearer"],
        knowledgeBasis: ["Mira can see the sigil and hear the patrol lights nearing."],
        priority: "scene_focus",
        narrativeLine: "playerVisibleLine",
        visibility: pcVisible(),
        happenedStatus: "confirmed_happened",
        affectedPaths: ["wiki/current-scene/scene_state.md", "wiki/relationships/runtime/player_mira.md"],
        runtimeDeltaRefs: [worldTickDeltaRef("reaction-mira-warning")],
      },
    ],
    pacingUpdate: {
      updateId: "pacing-gate-pressure",
      previousDebt: "low",
      nextDebt: "none",
      pressureChange: "relieved",
      campaignDelta: "The patrol clock and Mira's warning both move the gate scene forward.",
      compensationNeeded: false,
      narrativeLine: "tensionLine",
      visibility: gmOnly(),
      happenedStatus: "ongoing",
      affectedPaths: ["wiki/current-scene/scene_state.md", "wiki/plot-arcs/runtime/canal-gate.md"],
      runtimeDeltaRefs: [worldTickDeltaRef("pacing-gate-pressure")],
    },
    gapState: {
      gapSignalId: "gap-sigil-delay",
      gapMode: "compress",
      gapImpactCandidate: "minor",
      isPreliminary: true,
      outlineImpactAuthority: "outlineImpactDetector",
      summary: "The short wait creates no authoritative outline change yet.",
      causalChain: ["A short wait advances a countdown but does not replace an outline beat."],
      affectedBeatRefs: ["outline:decode-canal-gate"],
      narrativeLine: "tensionLine",
      visibility: gmOnly(),
      happenedStatus: "possible_future",
      affectedPaths: ["wiki/outlines/progress.md"],
      runtimeDeltaRefs: [gapDeltaRef],
    },
    runtimeDeltaRefs: [worldDeltaRef, parallelDeltaRef, gapDeltaRef],
    references: [
      {
        path: "wiki/current-scene/scene_state.md",
        sectionId: "currentScene.active_clocks",
        reason: "Provides the active patrol countdown.",
        usePurpose: "worldTick",
        visibility: pcVisible(),
      },
      {
        path: "wiki/factions/runtime/harbor-watch.md",
        sectionId: "runtime.current_order",
        reason: "Provides the parallel-line faction movement.",
        usePurpose: "worldTick",
        visibility: userVisiblePcUnknown(),
      },
    ],
    warnings: [],
  }
}

export function sampleVisibleSelection(
  actionResolution: ActionResolution,
  worldTickResult: WorldTickResult,
): WorldTickVisibleSelection {
  return selectWorldTickVisibleContent({ actionResolution, worldTickResult })
}

export function samplePostActionWorkingState(
  submittedAction: SubmittedAction,
  actionResolution: ActionResolution,
  worldTickResult: WorldTickResult,
  visibleSelection: WorldTickVisibleSelection = sampleVisibleSelection(actionResolution, worldTickResult),
): PostActionWorkingState {
  return buildPostActionWorkingState({
    submittedAction,
    actionResolution,
    worldTickResult,
    visibleSelection,
  })
}

export function sampleRecallSelection(
  sourceWorkingStateId = "post-action-working-state-act-1",
  path = "wiki/current-scene/scene_state.md",
  sectionId = "slot.current_scene",
): RecallSelection {
  return {
    selectionId: "recall-selection-act-1",
    sourceWorkingStateId,
    selectedItems: [
      {
        path,
        lineTarget: "playerVisibleLine",
        readMode: "summary",
        priority: "critical",
        reason: "Current scene is needed to ground the post-action narration.",
        expectedUse: "Keep narration aligned with the visible canal gate state.",
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
        sections: [
          {
            sectionId,
            reason: "Scene summary is enough for the next narration handoff.",
            expectedUse: "Ground visible scene continuity.",
            priority: "critical",
          },
        ],
      },
    ],
    exclusions: [
      {
        path: "wiki/outlines/main.md",
        sectionIds: ["slot.main_outline"],
        lineTarget: "tensionLine",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        reason: "Full main outline must not be handed directly to Narration in this stage.",
      },
    ],
    recallBudget: {
      maxItems: 8,
      maxSections: 16,
      maxEstimatedTokens: 6000,
      preferredLineTargets: ["playerVisibleLine", "parallelLine", "tensionLine"],
    },
    recallPolicy: {
      allowFullPageRead: false,
      requireStableSectionIds: true,
      pcKnowledgeBoundaryPath: "wiki/player/known_information.md",
      parallelLineDoesNotGrantPcKnowledge: true,
      notes: ["Fixture selection only plans deterministic local recall reads."],
    },
    warnings: [],
  }
}

export function sampleRecalledMaterials(
  path = "wiki/current-scene/scene_state.md",
  sectionId = "slot.current_scene",
): RecalledMaterial[] {
  return [
    {
      path,
      lineTarget: "playerVisibleLine",
      readMode: "summary",
      priority: "critical",
      reason: "Ground the visible scene.",
      expectedUse: "Narration continuity.",
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
      sections: [
        {
          sectionId,
          readMode: "summary",
          priority: "critical",
          reason: "Scene section selected.",
          expectedUse: "Narration continuity.",
          content: "# Current Scene\n\nThe canal gate is locked.",
          warnings: [],
        },
      ],
      warnings: [],
    },
  ]
}

export function sampleOutlineBriefOutput(
  action: SubmittedAction = {
    id: "act-1",
    text: "Ask Mira to inspect the canal gate sigil.",
    source: "freeform",
  },
): OutlineBriefCompilerOutput {
  const playerRef = sampleOutlinePlayerReference()

  return {
    outlineAwareNarrationBrief: {
      briefId: `outline-brief-${action.id}`,
      sourceWorkingStateId: `post-action-working-state-${action.id}`,
      playerFacingBrief: {
        summary: "Keep the scene focused on Mira's visible sigil read, the lantern key, and patrol pressure.",
        currentSceneFocus: "Mira warns which edge of the sigil is safe while the patrol nears.",
        allowedKnowledge: [playerRef],
        immediateReactions: ["Mira warns the player not to touch the cracked edge."],
        clueDirections: ["The safe edge can be tested without naming any hidden patron."],
        mustNotRevealStableIds: [],
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
      },
      parallelLineBrief: {
        summary: "No parallel-line reveal is required for this minimal fixture.",
        allowedParallelKnowledge: [],
        parallelBeatFocus: [],
        displayPolicy: "user_visible_pc_unknown",
        grantsPcKnowledge: false,
      },
      tensionBriefInput: {
        summary: "Use the patrol clock and Mira's trust as tension input only.",
        relationshipPressure: ["Mira notices the player defers to her expertise under pressure."],
        plotArcFuel: [],
        shouldAdvance: true,
      },
      revealPolicies: [],
      forbiddenNarrationBoundary: [],
      pacingDirective: {
        intent: "medium",
        reason: "The scene should move through the warning instead of stalling.",
        requiredMovement: ["Move the patrol clock or force a key-use decision."],
        avoidStagnation: true,
      },
      campaignDeltaRequirement: {
        required: true,
        minimumDelta: "meaningful",
        reason: "The turn should change the gate decision pressure.",
        candidateSources: ["patrol-countdown-advance"],
      },
      references: [playerRef],
    },
    outlineImpactReport: {
      reportId: `outline-impact-${action.id}`,
      impactLevel: "none",
      affected: {
        lines: [],
        beats: [],
        reveals: [],
        branchConditions: [],
        plotArcs: [],
        tensionLine: [],
      },
      invalidatedAssumptions: [],
      reason: "The action advances pressure without breaking outline order.",
      requiresRegeneration: false,
    },
    warnings: [],
  }
}

export function sampleMajorOutlineBriefOutput(
  action: SubmittedAction = {
    id: "act-1",
    text: "Ask Mira to inspect the canal gate sigil.",
    source: "freeform",
  },
): OutlineBriefCompilerOutput {
  const playerRef = sampleOutlinePlayerReference()
  const output = sampleOutlineBriefOutput(action)
  output.outlineImpactReport = {
    ...output.outlineImpactReport,
    impactLevel: "major_rewrite_required",
    invalidatedAssumptions: ["The gate patron reveal order no longer holds."],
    reason: "The player's resolved action invalidates a future reveal dependency.",
    requiresRegeneration: true,
  }
  output.regenerationRequest = {
    requestId: `regen-request-${action.id}`,
    sourceImpactReportId: output.outlineImpactReport.reportId,
    impactLevel: "major_rewrite_required",
    reason: "Audit-only request for a later Story Outline Regenerator stage.",
    affectedLines: ["playerVisibleLine", "tensionLine"],
    sourceRefs: [playerRef],
    mustPreserve: ["Already generated player-visible facts must stand."],
    mustRecheck: ["Recheck the hidden patron reveal order."],
  }
  return output
}

export function sampleTurnRecordRuntimeParts(
  submittedAction: SubmittedAction,
  options: {
    recallSelection?: RecallSelection
    recalledMaterials?: RecalledMaterial[]
    outlineBriefOutput?: OutlineBriefCompilerOutput
  } = {},
) {
  const actionResolution = sampleActionResolution(submittedAction)
  const worldTickResult = sampleWorldTickResult(actionResolution)
  const visibleSelection = sampleVisibleSelection(actionResolution, worldTickResult)
  const postActionWorkingState = samplePostActionWorkingState(
    submittedAction,
    actionResolution,
    worldTickResult,
    visibleSelection,
  )
  const outlineBriefOutput = options.outlineBriefOutput ?? sampleOutlineBriefOutput(submittedAction)

  return {
    actionResolution,
    worldTickResult,
    visibleSelection,
    postActionWorkingState,
    recallSelection: options.recallSelection ?? sampleRecallSelection(),
    recalledMaterials: options.recalledMaterials ?? [],
    outlineAwareNarrationBrief: outlineBriefOutput.outlineAwareNarrationBrief,
    outlineImpactReport: outlineBriefOutput.outlineImpactReport,
    ...(outlineBriefOutput.regenerationRequest ? { regenerationRequest: outlineBriefOutput.regenerationRequest } : {}),
  }
}

export function sampleTurnNarration(input: {
  playerFacingText?: string
  usedProvisionalPatch?: boolean
  provisionalHandoffId?: string
  provisionalSourcePatchId?: string
} = {}): TurnNarration {
  const usedProvisionalPatch = input.usedProvisionalPatch ?? false

  return {
    playerFacingText:
      input.playerFacingText
      ?? "Mira traces the lowest sigil. When Iven raises the lantern key, one brass tooth glows in answer.",
    parallelLineText: "Above the canal, a watch captain slows the next sweep.",
    tensionBrief: {
      summary: "Patrol pressure and Mira's trust remain active review handoff material.",
      pressureSignals: ["The Harbor Watch patrol is closer."],
      relationshipSignals: ["Mira noticed Iven waited for her expertise."],
      plotArcSignals: ["The canal gate sequence has moved forward."],
      reviewHandoff: "Keep tension as runtime/review context; do not write it as an ordinary event fact.",
      runtimeReviewHandoff: true,
      ordinaryEventFact: false,
      playerFacing: false,
      references: [
        {
          path: "wiki/current-scene/scene_state.md",
          lineTarget: "tensionLine",
          usePurpose: "reviewOnly",
          visibilityScope: "gm_only",
          knowledgeScope: "gm_only",
          reason: "Tension review handoff source.",
        },
      ],
    },
    displayPolicy: {
      showPlayerFacingText: true,
      showParallelLine: true,
      parallelLineGrantsPcKnowledge: false,
      showTensionBriefToPlayer: false,
      tensionBriefIsReviewHandoff: true,
    },
    narrationMeta: {
      narrationId: "turn-narration-sample",
      usedProvisionalPatch,
      respectedMustNotReveal: true,
      followedPacingIntent: "followed",
      timeCompression: "none",
      sceneTransition: "none",
      campaignDelta: "meaningful",
      revealBoundary: "allowed_now",
      playerKnowledgeBoundary: {
        boundaryId: "player-knowledge-boundary-narration-generator",
        pcKnowledgePath: "wiki/player/known_information.md",
        allowedKnowledgeRefs: [
          {
            path: "wiki/current-scene/scene_state.md",
            sectionId: "slot.current_scene",
            lineTarget: "playerVisibleLine",
            usePurpose: "narration",
            visibilityScope: "pc_visible",
            knowledgeScope: "pc_known",
            reason: "Visible scene narration source.",
          },
        ],
        forbiddenVisibilityScopes: ["user_visible_pc_unknown", "gm_only", "hidden"],
        parallelLineDoesNotGrantPcKnowledge: true,
        showParallelLineDoesNotGrantPcKnowledge: true,
        notes: ["Parallel-line display is not PC knowledge."],
      },
      ...(usedProvisionalPatch
        ? {
            provisionalPatchUsage: {
              usedProvisionalPatch: true,
              handoffId: input.provisionalHandoffId,
              sourcePatchId: input.provisionalSourcePatchId,
              followedMustFollow: ["Followed same-turn provisional direction."],
              respectedMustNotReveal: true,
              hardConstraintsApplied: ["Protected provisional mustNotReveal entries."],
              sameTurnOnly: true,
            },
          }
        : {}),
      styleBundleApplied: true,
      styleRemainedNonFact: true,
      warnings: [],
    },
    nextActionOptions: [
      sampleNarrationOption("opt-key", "Touch the lantern key to the lowest sigil.", "use_item", "medium"),
      sampleNarrationOption("opt-talk", "Ask Mira what the glowing brass tooth means.", "talk", "low"),
      sampleNarrationOption("opt-wait", "Wait and listen for movement beyond the canal gate.", "wait", "medium"),
    ],
    references: [
      {
        path: "wiki/current-scene/scene_state.md",
        sectionId: "slot.current_scene",
        lineTarget: "playerVisibleLine",
        usePurpose: "narration",
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
        reason: "Primary player-facing narration source.",
      },
      {
        path: "wiki/player/player.md",
        usePurpose: "narration",
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
        reason: "Player state narration source.",
      },
    ],
    warnings: [],
  }
}

function sampleNarrationOption(
  id: string,
  playerFacingText: string,
  intent: TurnNarration["nextActionOptions"][number]["intent"],
  riskLevel: TurnNarration["nextActionOptions"][number]["riskLevel"],
): TurnNarration["nextActionOptions"][number] {
  return {
    id,
    playerFacingText,
    intent,
    riskLevel,
    likelyAffectedPaths: ["wiki/current-scene/scene_state.md"],
    knowledgeScope: "pc_known",
    visibilityScope: "pc_visible",
    grantsPcKnowledge: false,
    optionOnly: true,
    happenedStatus: "possible_future",
    sourceRefs: [
      {
        path: "wiki/current-scene/scene_state.md",
        lineTarget: "playerVisibleLine",
        usePurpose: "narration",
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
        reason: "Future option source.",
      },
    ],
  }
}

function sampleOutlinePlayerReference(): OutlineBriefReference {
  return {
    path: "wiki/current-scene/scene_state.md",
    sectionId: "slot.current_scene",
    runtimeDeltaId: "patrol-countdown-advance",
    lineTarget: "playerVisibleLine",
    usePurpose: "narration",
    visibilityScope: "pc_visible",
    knowledgeScope: "pc_known",
    reason: "Use the selected current-scene handoff and known runtime delta.",
  }
}

function pcVisible(): WorldTickVisibilityMeta {
  return {
    visibilityScope: "pc_visible",
    knowledgeScope: "pc_known",
    knowledgeSourceKind: "seen",
    knownBy: ["player:Iven"],
    excludedKnowledgeFor: [],
    displayPolicy: "player_visible",
    reason: "The player character can directly perceive this information.",
  }
}

function userVisiblePcUnknown(): WorldTickVisibilityMeta {
  return {
    visibilityScope: "user_visible_pc_unknown",
    knowledgeScope: "user_only",
    knowledgeSourceKind: "parallel_line",
    knownBy: ["user"],
    excludedKnowledgeFor: ["player:Iven"],
    displayPolicy: "user_visible_pc_unknown",
    reason: "This may be shown as a parallel line without becoming PC knowledge.",
  }
}

function npcKnownUserVisiblePcUnknown(): WorldTickVisibilityMeta {
  return {
    visibilityScope: "user_visible_pc_unknown",
    knowledgeScope: "npc_known",
    knowledgeSourceKind: "heard",
    knownBy: ["faction:harbor-watch"],
    excludedKnowledgeFor: ["player:Iven"],
    displayPolicy: "user_visible_pc_unknown",
    reason: "NPCs heard this information, and user display still does not make it PC knowledge.",
  }
}

function gmOnly(): WorldTickVisibilityMeta {
  return {
    visibilityScope: "gm_only",
    knowledgeScope: "gm_only",
    knowledgeSourceKind: "documented",
    knownBy: ["gm"],
    excludedKnowledgeFor: ["player:Iven"],
    displayPolicy: "gm_only",
    reason: "This controls runtime pacing and outline screening rather than PC knowledge.",
  }
}

function worldTickDeltaRef(deltaId: string) {
  return {
    deltaId,
    sourceStage: "worldTick",
    sourcePath: `.llm-wiki/runtime/turns/act-world-tick/world-tick.json#${deltaId}`,
    summary: `World Tick delta ${deltaId}.`,
    narrativeLine: deltaId.includes("watch-captain") ? "parallelLine" : "playerVisibleLine",
    usePurpose: "worldTick",
    happenedStatus: deltaId.startsWith("gap") ? "possible_future" : "ongoing",
  } as const
}

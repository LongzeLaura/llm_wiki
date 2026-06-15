import type {
  RpgGapImpactCandidate,
  RpgBeliefState,
  RpgHappenedStatus,
  RpgKnowledgeActorRef,
  RpgKnowledgeScope,
  RpgKnowledgeSourceKind,
  RpgNarrativeLine,
  RpgOutlineImpactLevel,
  RpgRecallReadMode,
  RpgRevealState,
  RpgReviewItemKind,
  RpgRuntimeDeltaRef,
  RpgUsePurpose,
  RpgVisibilityScope,
} from "../rpg-wiki-schema"
import type { ProposedWikiUpdate, RpgUpdateStrategy } from "./state-extractor"

export interface SubmittedAction {
  id: string
  text: string
  source: "selected_option" | "freeform"
  selectedOptionId?: string
}

export interface RpgActorBeliefState {
  actor: RpgKnowledgeActorRef
  beliefState: RpgBeliefState
  reason: string
}

export interface RpgKnowledgeClaim {
  claimId: string
  summary: string
  truthStatus: "true" | "false" | "partial" | "unknown"
  holders: RpgKnowledgeActorRef[]
  nonHolders: RpgKnowledgeActorRef[]
  beliefStateByActor: RpgActorBeliefState[]
  sourcePath?: string
  sourceEventPath?: string
}

export interface RpgRevealGateRef {
  gateId: string
  truthId: string
  revealState: RpgRevealState
  allowedAudience: RpgKnowledgeActorRef[]
  blockedAudience: RpgKnowledgeActorRef[]
  reason: string
}

export type ActionResolverIntentKind =
  | "attack"
  | "move"
  | "talk"
  | "investigate"
  | "observe"
  | "rescue"
  | "use_item"
  | "wait"
  | "prepare"
  | "mixed"
  | "custom"

export type ActionResolverFeasibilityStatus =
  | "feasible"
  | "partially_feasible"
  | "requires_cost"
  | "blocked"
  | "uncertain"

export type ActionResolverCostKind =
  | "time"
  | "resource"
  | "risk"
  | "position"
  | "relationship"
  | "information"
  | "condition"
  | "other"

export type ActionResolverObstacleSeverity = "minor" | "moderate" | "major" | "hard_block"
export type ActionResolverTimeDeltaScale =
  | "instant"
  | "seconds"
  | "minutes"
  | "tens_of_minutes"
  | "hours"
  | "days"
  | "scene_dependent"
export type ActionResolverTimeUnit = "seconds" | "minutes" | "hours" | "days" | "turns" | "scene"
export type ActionResolverProgressPotentialLevel = "none" | "low" | "medium" | "high" | "major"
export type ActionResolverWarningSeverity = "info" | "warning" | "unsafe_output"

export const ACTION_RESOLVER_DEFAULT_EVENT_STATUS = "attempted_not_confirmed" as const satisfies RpgHappenedStatus

export interface ActionResolverFixedSlotRef {
  path: string
  role: string
  summary: string
  required: boolean
}

export interface ActionResolverRuleExcerpt {
  ruleId: string
  path: string
  excerpt: string
  usePurpose: RpgUsePurpose
}

export interface PreActionSceneSnapshot {
  path: "wiki/current-scene/scene_state.md"
  summary: string
  currentTime?: string
  currentLocation?: string
  visibleSituation: string
  presentCharacters: string[]
  interactableObjects: string[]
  currentDangers: string[]
  locationActionConditions: string[]
  lastTurnSummary?: string
}

export interface PreActionPlayerSnapshot {
  stateSummary: string
  abilities: string[]
  inventory: string[]
  goals: string[]
  knownInformation: string[]
  knownInformationPath: "wiki/player/known_information.md"
  conditionNotes: string[]
}

export interface PreActionClockSummary {
  clockId: string
  label: string
  summary: string
  urgency: "low" | "medium" | "high" | "critical"
  narrativeLine: RpgNarrativeLine
}

export interface PreActionPendingReaction {
  reactionId: string
  actorRef: string
  summary: string
  visibilityScope: RpgVisibilityScope
}

export interface PreActionPacingState {
  summary: string
  pacingDebt?: "none" | "low" | "medium" | "high"
  recentLowProgressTurnCount?: number
  expectedCampaignDelta?: string
}

export interface PreActionOutlineSnapshot {
  progressPath: "wiki/outlines/progress.md"
  currentBeat: string
  adjacentBeats: string[]
  branchConditions: string[]
  progressSummary: string
}

export interface PreActionSnapshot {
  currentScene: PreActionSceneSnapshot
  player: PreActionPlayerSnapshot
  activeClocks: PreActionClockSummary[]
  countdowns: PreActionClockSummary[]
  pendingReactions: PreActionPendingReaction[]
  pacingState: PreActionPacingState
  outlineProgress: PreActionOutlineSnapshot
  rulesExcerpts: ActionResolverRuleExcerpt[]
  references: string[]
}

export interface ActionResolverInput {
  submittedAction: SubmittedAction
  preActionSnapshot: PreActionSnapshot
  relevantRules: ActionResolverRuleExcerpt[]
  fixedSlotRefs: ActionResolverFixedSlotRef[]
  recentTurnSummary?: string
  runtimeRefs: RpgRuntimeDeltaRef[]
}

export interface ParsedPlayerIntent {
  intentKind: ActionResolverIntentKind
  actorRef: string
  targetRefs: string[]
  actionScope: string
  declaredGoal: string
  timeJumpSignal?: string
  ambiguityNotes: string[]
}

export interface ActionResolverEventDraft {
  eventId: string
  eventType: string
  summary: string
  status: RpgHappenedStatus
  confirmationBasis?: string
  actorRefs: string[]
  targetRefs: string[]
  affectedRefs: string[]
  riskSummary: string
  requiredChecks: string[]
  ambiguityNotes: string[]
}

export interface ActionResolverFeasibilityResult {
  status: ActionResolverFeasibilityStatus
  rationale: string
  limitingFactors: string[]
  requiredChecks: string[]
  alternativeResults: string[]
}

export interface ActionResolverCost {
  costId: string
  kind: ActionResolverCostKind
  description: string
  appliesIf: string
}

export interface ActionResolverObstacle {
  obstacleId: string
  severity: ActionResolverObstacleSeverity
  description: string
  bypassHint?: string
}

export interface ActionResolverDirectResult {
  resultId: string
  summary: string
  happenedStatus: RpgHappenedStatus
  visibilityScope: RpgVisibilityScope
  affectedRefs: string[]
}

export interface ActionResolverTimeDelta {
  scale: ActionResolverTimeDeltaScale
  unit: ActionResolverTimeUnit
  min?: number
  max?: number
  summary: string
  reasoning: string
}

export interface ActionResolverProgressPotential {
  level: ActionResolverProgressPotentialLevel
  summary: string
  possibleUnlocks: string[]
  gapTriggerPotential: "none" | "minor" | "branch" | "major"
}

export interface PlayerActionDelta {
  deltaId: string
  causedByActionId: string
  scope: "player_action_only"
  positionChanges: string[]
  resourceChanges: string[]
  inventoryChanges: string[]
  conditionChanges: string[]
  knowledgeChanges: string[]
  relationshipSignals: string[]
  sceneChanges: string[]
  interruptedEvents: string[]
  exposedInformation: string[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
  notes: string[]
}

export interface ActionResolverReference {
  path: string
  sectionId?: string
  reason: string
  usePurpose: RpgUsePurpose
  visibilityScope?: RpgVisibilityScope
  knowledgeScope?: RpgKnowledgeScope
}

export interface ActionResolverWarning {
  code: string
  message: string
  severity: ActionResolverWarningSeverity
}

export interface ActionResolution {
  resolutionId: string
  submittedActionId: string
  parsedIntent: ParsedPlayerIntent
  eventDraft: ActionResolverEventDraft
  feasibility: ActionResolverFeasibilityResult
  costs: ActionResolverCost[]
  obstacles: ActionResolverObstacle[]
  directResults: ActionResolverDirectResult[]
  timeDelta: ActionResolverTimeDelta
  progressPotential: ActionResolverProgressPotential
  playerActionDelta: PlayerActionDelta
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
  references: ActionResolverReference[]
  warnings: ActionResolverWarning[]
}

export type WorldTickClockKind =
  | "worldClock"
  | "countdown"
  | "pacingDebt"
  | "relationshipPressure"
  | "investigationClock"
  | "combatClock"
  | "dangerClock"
  | "ongoingEventClock"

export type WorldTickClockUpdateKind =
  | "advance"
  | "decrease"
  | "pause"
  | "resume"
  | "trigger"
  | "interrupt"
  | "resolve"
  | "reset"
  | "create"
  | "no_change"

export type WorldTickOngoingEventSettlementKind =
  | "advanced"
  | "paused"
  | "triggered"
  | "interrupted"
  | "blocked"
  | "failed"
  | "resolved"
  | "no_change"

export type WorldTickReactionTiming = "immediate" | "delayed" | "parallel" | "tension" | "none"
export type WorldTickPacingDebt = "none" | "low" | "medium" | "high" | "critical"
export type WorldTickPressureChange = "relieved" | "unchanged" | "increased" | "scene_cut_needed"
export type WorldTickGapMode =
  | "none"
  | "skip"
  | "compress"
  | "parallel_line_tick"
  | "relationship_beat"
  | "branching_event"
  | "major_divergence_event"
export type WorldTickWarningSeverity = "info" | "warning" | "unsafe_output"
export type WorldTickDisplayPolicy = "player_visible" | "user_visible_pc_unknown" | "gm_only" | "hidden"

export interface WorldTickVisibilityMeta {
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  knowledgeSourceKind: RpgKnowledgeSourceKind
  knownBy: string[]
  excludedKnowledgeFor: string[]
  displayPolicy: WorldTickDisplayPolicy
  reason: string
}

export interface WorldTickRuntimeReference {
  path: string
  sectionId?: string
  summary: string
  usePurpose: RpgUsePurpose
  visibility?: WorldTickVisibilityMeta
}

export interface WorldTickVisibilityPolicy {
  allowParallelLineDisplay: boolean
  pcKnowledgeBoundaryPath: "wiki/player/known_information.md"
  requireVisibilityMeta: true
  parallelLineDoesNotGrantPcKnowledge: true
  notes: string[]
}

export interface WorldTickActiveClock {
  clockId: string
  label: string
  clockKind: WorldTickClockKind
  currentState: string
  urgency: "low" | "medium" | "high" | "critical"
  narrativeLine: RpgNarrativeLine
  visibility: WorldTickVisibilityMeta
  affectedPaths: string[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
}

export interface WorldTickOngoingEvent {
  eventId: string
  eventRef?: string
  summary: string
  status: Extract<RpgHappenedStatus, "ongoing" | "blocked" | "attempted_not_confirmed" | "possible_future">
  participantRefs: string[]
  clockRefs: string[]
  narrativeLine: RpgNarrativeLine
  visibility: WorldTickVisibilityMeta
  affectedPaths: string[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
}

export interface WorldTickPacingState {
  summary: string
  pacingDebt: WorldTickPacingDebt
  recentLowProgressTurnCount: number
  expectedCampaignDelta?: string
  stalledLines: RpgNarrativeLine[]
  pressureNotes: string[]
  affectedPaths: string[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
}

export interface WorldTickGapSignal {
  gapSignalId: string
  gapMode: WorldTickGapMode
  gapImpactCandidate: RpgGapImpactCandidate
  summary: string
  causalChain: string[]
  affectedBeatRefs: string[]
  affectedPaths: string[]
  visibility: WorldTickVisibilityMeta
  happenedStatus: RpgHappenedStatus
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
}

export interface WorldTickInput {
  submittedAction: SubmittedAction
  actionResolution: ActionResolution
  playerActionDelta: ActionResolution["playerActionDelta"]
  timeDelta: ActionResolution["timeDelta"]
  preActionRefs: WorldTickRuntimeReference[]
  postActionRefs: WorldTickRuntimeReference[]
  activeClocks: WorldTickActiveClock[]
  ongoingEvents: WorldTickOngoingEvent[]
  pacingState: WorldTickPacingState
  gapSignals: WorldTickGapSignal[]
  visibilityPolicy: WorldTickVisibilityPolicy
  runtimeRefs: RpgRuntimeDeltaRef[]
}

export interface WorldTickDeltaBase {
  narrativeLine: RpgNarrativeLine
  visibility: WorldTickVisibilityMeta
  happenedStatus: RpgHappenedStatus
  affectedPaths: string[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
}

export interface WorldTickWorldDelta extends WorldTickDeltaBase {
  deltaId: string
  summary: string
  sourcePlayerDeltaIds: string[]
  sourceClockIds: string[]
  knowledgeEffects: string[]
}

export interface WorldTickTimeAdvance {
  sourceTimeDelta: ActionResolution["timeDelta"]
  appliedSummary: string
  clockReasoning: string
}

export interface WorldTickClockUpdate extends WorldTickDeltaBase {
  clockId: string
  clockKind: WorldTickClockKind
  updateKind: WorldTickClockUpdateKind
  previousState: string
  nextState: string
  amount?: number
  timeDeltaBasis: ActionResolution["timeDelta"]
  reason: string
  sourcePlayerDeltaIds: string[]
}

export interface WorldTickSettledOngoingEvent extends WorldTickDeltaBase {
  eventId: string
  eventRef?: string
  settlementKind: WorldTickOngoingEventSettlementKind
  summary: string
  cause: string
  participantRefs: string[]
  clockUpdateIds: string[]
}

export interface WorldTickInformationBroadcast extends WorldTickDeltaBase {
  broadcastId: string
  informationRef?: string
  informationSummary: string
  sourceActorRefs: string[]
  recipientRefs: string[]
  channel: string
  certainty: "confirmed" | "partial" | "misread" | "unknown"
  preventsPcKnowledgeLeak: boolean
}

export interface WorldTickReactionQueueEntry extends WorldTickDeltaBase {
  reactionId: string
  actorRef: string
  reactionTiming: WorldTickReactionTiming
  summary: string
  triggerDeltaIds: string[]
  knowledgeBasis: string[]
  priority: "low" | "medium" | "high" | "scene_focus"
}

export type WorldTickReactionQueue = WorldTickReactionQueueEntry[]

export interface WorldTickPacingUpdate extends WorldTickDeltaBase {
  updateId: string
  previousDebt: WorldTickPacingDebt
  nextDebt: WorldTickPacingDebt
  pressureChange: WorldTickPressureChange
  campaignDelta: string
  compensationNeeded: boolean
}

export interface WorldTickGapState extends WorldTickDeltaBase {
  gapSignalId: string
  gapMode: WorldTickGapMode
  gapImpactCandidate: RpgGapImpactCandidate
  isPreliminary: true
  outlineImpactAuthority: "outlineImpactDetector"
  summary: string
  causalChain: string[]
  affectedBeatRefs: string[]
}

export interface WorldTickReference {
  path: string
  sectionId?: string
  reason: string
  usePurpose: RpgUsePurpose
  visibility?: WorldTickVisibilityMeta
}

export interface WorldTickWarning {
  code: string
  message: string
  severity: WorldTickWarningSeverity
}

export interface WorldTickResult {
  tickId: string
  sourceActionResolutionId: ActionResolution["resolutionId"]
  timeAdvance: WorldTickTimeAdvance
  worldDeltas: {
    playerVisibleLine: WorldTickWorldDelta[]
    parallelLine: WorldTickWorldDelta[]
    tensionLine: WorldTickWorldDelta[]
  }
  clockUpdates: WorldTickClockUpdate[]
  settledOngoingEvents: WorldTickSettledOngoingEvent[]
  informationBroadcast: WorldTickInformationBroadcast[]
  reactionQueue: WorldTickReactionQueue
  pacingUpdate: WorldTickPacingUpdate
  gapState: WorldTickGapState
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
  references: WorldTickReference[]
  warnings: WorldTickWarning[]
}

export type WorldTickVisibleSelectionSource =
  | "actionResolution.directResult"
  | "worldTick.playerVisibleLine"
  | "worldTick.parallelLine"
  | "worldTick.tensionLine"
  | "worldTick.pacingUpdate"
  | "worldTick.gapState"

export interface WorldTickSelectedVisibleDelta {
  selectionId: string
  source: Extract<WorldTickVisibleSelectionSource, "actionResolution.directResult" | "worldTick.playerVisibleLine">
  sourceId: string
  summary: string
  narrativeLine: "playerVisibleLine"
  visibilityScope: Extract<RpgVisibilityScope, "pc_visible" | "pc_inferred">
  knowledgeScope?: RpgKnowledgeScope
  happenedStatus: RpgHappenedStatus
  affectedPaths: string[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
  grantsPcKnowledge: boolean
}

export interface WorldTickSelectedParallelLens {
  lensId: string
  source: Extract<WorldTickVisibleSelectionSource, "worldTick.parallelLine">
  sourceId: string
  summary: string
  narrativeLine: "parallelLine"
  visibilityScope: Extract<RpgVisibilityScope, "user_visible_pc_unknown">
  knowledgeScope: RpgKnowledgeScope
  happenedStatus: RpgHappenedStatus
  affectedPaths: string[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
  grantsPcKnowledge: false
  pcKnowledgeBoundaryPath: "wiki/player/known_information.md"
}

export interface WorldTickSelectedTensionSignal {
  signalId: string
  source: Extract<
    WorldTickVisibleSelectionSource,
    "worldTick.tensionLine" | "worldTick.pacingUpdate" | "worldTick.gapState"
  >
  sourceId: string
  summary: string
  narrativeLine: RpgNarrativeLine
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  happenedStatus: RpgHappenedStatus
  affectedPaths: string[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
}

export interface WorldTickVisibleSelection {
  currentSceneVisibleCandidates: WorldTickSelectedVisibleDelta[]
  parallelLensCandidates: WorldTickSelectedParallelLens[]
  tensionCandidates: WorldTickSelectedTensionSignal[]
  notes: string[]
}

export interface PostActionWorkingTimeState {
  actionTimeDelta: ActionResolution["timeDelta"]
  worldTickTimeAdvance: WorldTickResult["timeAdvance"]
}

export interface PostActionWorkingState {
  submittedAction: SubmittedAction
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  timeState: PostActionWorkingTimeState
  campaignDelta: string
  pacingState: WorldTickPacingUpdate
  gapState: WorldTickGapState
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
  references: string[]
  warnings: string[]
}

export interface TurnSemanticHandoffEntry {
  source: string
  sourceId: string
  summary: string
  happenedStatus: RpgHappenedStatus
  visibilityScope?: RpgVisibilityScope
  knowledgeScope?: RpgKnowledgeScope
  affectedPaths: string[]
}

export interface TurnSemanticReferenceAllowlistEntry {
  path: string
  reason: string
  lineTarget?: RpgNarrativeLine
  visibilityScope?: RpgVisibilityScope
  knowledgeScope?: RpgKnowledgeScope
}

export interface TurnSemanticHandoff {
  submittedAction: SubmittedAction
  actionOutcome: string
  timeAdvanceSummary: string
  confirmed: TurnSemanticHandoffEntry[]
  attemptedOrBlocked: TurnSemanticHandoffEntry[]
  ongoing: TurnSemanticHandoffEntry[]
  possibleFuture: TurnSemanticHandoffEntry[]
  pcVisible: TurnSemanticHandoffEntry[]
  pcInferred: TurnSemanticHandoffEntry[]
  userVisiblePcUnknown: TurnSemanticHandoffEntry[]
  gmOnlyControl: TurnSemanticHandoffEntry[]
  activeRisks: string[]
  pressureSignals: string[]
  openQuestions: string[]
  candidatePaths: string[]
  referenceAllowlist: TurnSemanticReferenceAllowlistEntry[]
  warnings: string[]
}

export type RecallSelectionPriority = "critical" | "high" | "medium" | "low"

export interface RecallableSection {
  sectionId: string
  sectionRole: string
  heading: string
  aliases: string[]
  lineTargets: RpgNarrativeLine[]
  readModes: RpgRecallReadMode[]
  visibilityScope: RpgVisibilityScope
  knowledgeScope?: RpgKnowledgeScope
  summary?: string
}

export interface RetrievalIndexEntry {
  path: string
  title?: string
  categoryId?: string
  summary: string
  lineTargets: RpgNarrativeLine[]
  visibilityScope: RpgVisibilityScope
  knowledgeScope?: RpgKnowledgeScope
  availableSections: RecallableSection[]
  tags?: string[]
}

export interface RecallBudget {
  maxItems: number
  maxSections: number
  maxEstimatedTokens?: number
  preferredLineTargets: RpgNarrativeLine[]
}

export interface RecallPolicy {
  allowFullPageRead: boolean
  requireStableSectionIds: true
  pcKnowledgeBoundaryPath: "wiki/player/known_information.md"
  parallelLineDoesNotGrantPcKnowledge: true
  notes: string[]
}

export interface RecallSelectedSection {
  sectionId: string
  reason: string
  expectedUse: string
  priority: RecallSelectionPriority
}

export interface RecallSelectedItem {
  path: string
  lineTarget: RpgNarrativeLine
  readMode: RpgRecallReadMode
  priority: RecallSelectionPriority
  reason: string
  expectedUse: string
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  sections: RecallSelectedSection[]
}

export interface RecallExclusion {
  path: string
  sectionIds: string[]
  lineTarget?: RpgNarrativeLine
  visibilityScope?: RpgVisibilityScope
  knowledgeScope?: RpgKnowledgeScope
  reason: string
}

export interface RecallSelectionDraftItem {
  path: string
  readMode: RpgRecallReadMode
  priority: RecallSelectionPriority
  reason: string
  expectedUse: string
  sectionIds: string[]
}

export interface RecallSelectionDraftExclusion {
  path: string
  sectionIds: string[]
  reason: string
}

export interface RecallSelectionDraft {
  selectedItems: RecallSelectionDraftItem[]
  exclusions: RecallSelectionDraftExclusion[]
}

export interface RecallSelection {
  selectionId: string
  sourceWorkingStateId: string
  selectedItems: RecallSelectedItem[]
  exclusions: RecallExclusion[]
  recallBudget: RecallBudget
  recallPolicy: RecallPolicy
  warnings: string[]
}

export interface RecallSelectorInput {
  turnSemanticHandoff?: TurnSemanticHandoff
  postActionWorkingState: PostActionWorkingState
  actionResolution?: ActionResolution
  worldTickResult?: WorldTickResult
  visibleSelection?: WorldTickVisibleSelection
  pacingState?: WorldTickPacingUpdate
  gapState?: WorldTickGapState
  retrievalIndex: RetrievalIndexEntry[]
  recallBudget: RecallBudget
  recallPolicy: RecallPolicy
}

export interface RecalledMaterialSection {
  sectionId: string
  readMode: RpgRecallReadMode
  priority: RecallSelectionPriority
  reason: string
  expectedUse: string
  content: string
  warnings: string[]
}

export interface RecalledMaterial {
  path: string
  lineTarget: RpgNarrativeLine
  readMode: RpgRecallReadMode
  priority: RecallSelectionPriority
  reason: string
  expectedUse: string
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  knowledgeClaims?: RpgKnowledgeClaim[]
  outlineControl?: RpgOutlineControlMetadata
  sections: RecalledMaterialSection[]
  warnings: string[]
}

export interface RecallSelectorHandoff {
  recallSelection: RecallSelection
  recalledMaterials: RecalledMaterial[]
  warnings: string[]
}

export type OutlineBriefRevealPolicy =
  | "allowed_now"
  | "hint_only"
  | "delay"
  | "forbid"
  | "parallel_only"
  | "gm_only"

export type OutlineBriefPacingIntent = "hold" | "soft_push" | "medium" | "strong" | "scene_cut"

export type RpgOutlineControlKind =
  | "gm_truth"
  | "act_structure"
  | "reveal_gate"
  | "branch_condition"
  | "hard_constraint"
  | "progress_marker"

export interface RpgOutlineControlMetadata {
  controlKind: RpgOutlineControlKind
  gmSummary: string
  playerSafeSummary?: string
  actorKnowledgeRefs: RpgKnowledgeActorRef[]
  revealGateRefs: string[]
  mustNotRevealTo: RpgKnowledgeActorRef[]
  boundaryNote: string
}

export interface OutlineStableRef {
  refId: string
  path: string
  sectionId: string
  stableId: string
  summary: string
  lineTarget: RpgNarrativeLine
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
}

export interface OutlineBeatRef extends OutlineStableRef {
  refType: "beat"
  beatStatus: "planned" | "active" | "completed" | "skipped" | "invalidated" | "branch_candidate"
}

export interface OutlineRevealRef extends OutlineStableRef {
  refType: "reveal"
  revealPolicy: OutlineBriefRevealPolicy
  revealTiming: string
}

export interface OutlineBranchConditionRef extends OutlineStableRef {
  refType: "branchCondition"
  conditionStatus: "inactive" | "watching" | "triggered" | "failed" | "invalidated"
}

export interface OutlineDependencyRef {
  dependencyId: string
  dependsOnStableIds: string[]
  invalidatedByStableIds: string[]
  reason: string
}

export interface OutlineLineTargetDirective {
  lineTarget: RpgNarrativeLine
  allowedStableIds: string[]
  forbiddenStableIds: string[]
  guidance: string
}

export interface OutlineSlice {
  sliceId: string
  path: string
  sectionId: string
  title: string
  lineTarget: RpgNarrativeLine
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  outlineControl?: RpgOutlineControlMetadata
  knowledgeClaims?: RpgKnowledgeClaim[]
  revealGateMetadata?: RpgRevealGateRef[]
  summary: string
  beatRefs: OutlineBeatRef[]
  revealRefs: OutlineRevealRef[]
  branchConditionRefs: OutlineBranchConditionRef[]
  dependencies: OutlineDependencyRef[]
  lineTargets: OutlineLineTargetDirective[]
  revealPolicies: OutlineRevealPolicyDirective[]
  invalidationNotes: string[]
}

export interface OutlineRevealPolicyDirective {
  directiveId: string
  stableId: string
  policy: OutlineBriefRevealPolicy
  lineTarget: RpgNarrativeLine
  reason: string
}

export interface PlotArcTensionFuel {
  fuelId: string
  path: string
  sectionId: string
  plotArcId: string
  summary: string
  tensionLineTarget: "advance" | "hold" | "reverse" | "complicate" | "resolve"
  pressureSources: string[]
  relationshipRefs: string[]
  forbiddenResolutions: string[]
}

export interface OutlineHardConstraint {
  constraintId: string
  sourcePath: string
  sectionId?: string
  summary: string
  appliesToLines: RpgNarrativeLine[]
  mustPreserve: string[]
  mustNotReveal: string[]
}

export interface OutlineVisibilityBoundary {
  boundaryId: string
  lineTarget: RpgNarrativeLine
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  grantsPcKnowledge: boolean
  sourcePath?: string
  sectionId?: string
  reason: string
}

export interface OutlineKnownReference {
  path: string
  sectionId?: string
  runtimeDeltaId?: string
  stableId?: string
  reason: string
}

export interface OutlineBriefCompilerInput {
  turnSemanticHandoff?: TurnSemanticHandoff
  postActionWorkingState: PostActionWorkingState
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  recallSelection: RecallSelection
  recalledMaterials: RecalledMaterial[]
  pacingState: WorldTickPacingUpdate
  gapState: WorldTickGapState
  reactionQueue: WorldTickReactionQueue
  visibilityBoundaries: OutlineVisibilityBoundary[]
  outlineSlices: OutlineSlice[]
  plotArcTensionFuel: PlotArcTensionFuel[]
  hardConstraints: OutlineHardConstraint[]
  runtimeRefs: RpgRuntimeDeltaRef[]
  knownReferences: OutlineKnownReference[]
}

export interface OutlineBriefReference {
  path: string
  sectionId?: string
  runtimeDeltaId?: string
  stableId?: string
  lineTarget: RpgNarrativeLine
  usePurpose: RpgUsePurpose
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  knowledgeClaims?: RpgKnowledgeClaim[]
  reason: string
}

export interface PlayerFacingBrief {
  summary: string
  currentSceneFocus: string
  allowedKnowledge: OutlineBriefReference[]
  immediateReactions: string[]
  clueDirections: string[]
  mustNotRevealStableIds: string[]
  visibilityScope: Extract<RpgVisibilityScope, "pc_visible" | "pc_inferred">
  knowledgeScope: Extract<RpgKnowledgeScope, "pc_known" | "pc_misunderstanding">
}

export interface ParallelLineBrief {
  summary: string
  allowedParallelKnowledge: OutlineBriefReference[]
  parallelBeatFocus: string[]
  displayPolicy: "user_visible_pc_unknown" | "gm_only" | "hidden"
  grantsPcKnowledge: false
}

export interface TensionLineUpdateCandidate {
  candidateId: string
  summary: string
  sourceFuelIds: string[]
  targetPlotArcIds: string[]
  updateKind: "advance" | "hold" | "reverse" | "complicate" | "resolve"
  reason: string
}

export interface TensionBriefInput {
  summary: string
  tensionLineUpdateCandidate?: TensionLineUpdateCandidate
  relationshipPressure: string[]
  plotArcFuel: OutlineBriefReference[]
  shouldAdvance: boolean
}

export interface OutlinePacingDirective {
  intent: OutlineBriefPacingIntent
  reason: string
  requiredMovement: string[]
  avoidStagnation: boolean
}

export interface CampaignDeltaRequirement {
  required: boolean
  minimumDelta: "none" | "minor" | "meaningful" | "scene_changing"
  reason: string
  candidateSources: string[]
}

export interface ForbiddenNarrationItem {
  itemId: string
  sourcePath?: string
  sectionId?: string
  stableId?: string
  lineTarget: RpgNarrativeLine
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  reason: string
}

export interface OutlineAwareNarrationBrief {
  briefId: string
  sourceWorkingStateId: string
  playerFacingBrief: PlayerFacingBrief
  parallelLineBrief: ParallelLineBrief
  tensionBriefInput: TensionBriefInput
  revealPolicies: OutlineRevealPolicyDirective[]
  forbiddenNarrationBoundary: ForbiddenNarrationItem[]
  pacingDirective: OutlinePacingDirective
  campaignDeltaRequirement: CampaignDeltaRequirement
  references: OutlineBriefReference[]
}

export interface OutlineImpactAffectedRefs {
  lines: RpgNarrativeLine[]
  beats: OutlineStableRef[]
  reveals: OutlineStableRef[]
  branchConditions: OutlineStableRef[]
  plotArcs: OutlineStableRef[]
  tensionLine: OutlineStableRef[]
}

export interface OutlineImpactReport {
  reportId: string
  impactLevel: RpgOutlineImpactLevel
  affected: OutlineImpactAffectedRefs
  invalidatedAssumptions: string[]
  reason: string
  requiresRegeneration: boolean
}

/**
 * Audit/control handoff from Step 14 only. This records why a later Story
 * Outline Regenerator might be needed; it is not an outlineRevisionProposal,
 * provisionalOutlinePatch, wiki write, or permission to revise outlines/main.md.
 */
export interface RegenerationRequest {
  requestId: string
  sourceImpactReportId: string
  impactLevel: Extract<RpgOutlineImpactLevel, "major_rewrite_required">
  reason: string
  affectedLines: RpgNarrativeLine[]
  sourceRefs: OutlineBriefReference[]
  mustPreserve: string[]
  mustRecheck: string[]
}

export interface StoryOutlineConfirmedFactBoundary {
  factId: string
  summary: string
  sourceRefs: OutlineBriefReference[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
  happenedStatus: Extract<RpgHappenedStatus, "confirmed_happened" | "ongoing">
  mustPreserve: true
}

export interface StoryOutlineForbiddenRevealBoundary {
  revealId: string
  stableId?: string
  sourcePath: string
  sectionId?: string
  lineTarget: RpgNarrativeLine
  visibilityScope: Extract<RpgVisibilityScope, "user_visible_pc_unknown" | "gm_only" | "hidden">
  knowledgeScope: Extract<RpgKnowledgeScope, "npc_known" | "user_only" | "gm_only" | "unknown_to_pc">
  reason: string
}

export interface StoryOutlineRegeneratorInput {
  turnSemanticHandoff?: TurnSemanticHandoff
  postActionWorkingState: PostActionWorkingState
  outlineImpactReport: OutlineImpactReport
  regenerationRequest: RegenerationRequest
  recalledMaterials: RecalledMaterial[]
  outlineSlices: OutlineSlice[]
  plotArcTensionFuel: PlotArcTensionFuel[]
  visibilityBoundaries: OutlineVisibilityBoundary[]
  hardConstraints: OutlineHardConstraint[]
  confirmedFacts: StoryOutlineConfirmedFactBoundary[]
  forbiddenReveals: StoryOutlineForbiddenRevealBoundary[]
  runtimeRefs: RpgRuntimeDeltaRef[]
  knownReferences: OutlineKnownReference[]
}

/**
 * Same-turn hard handoff for Step 15 Narration only. It is runtime/review
 * handoff data, not accepted wiki fact text and not player-facing prose.
 */
export interface ProvisionalNarrationHandoff {
  handoffId: string
  sourcePatchId: string
  mustFollow: string[]
  mustPreserveFacts: string[]
  mustNotReveal: string[]
  invalidatedOldBeats: string[]
  nextSceneDirection: string
  narrativeLines: RpgNarrativeLine[]
  visibilityBoundaries: OutlineVisibilityBoundary[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
  outlineRefs: OutlineStableRef[]
  grantsPcKnowledgeFromHiddenMaterial: false
}

export interface ProvisionalOutlinePatchNonPersistenceBoundary {
  sameTurnOnly: true
  writesToWiki: false
  modifiesMainOutline: false
  persistedToOutlinesMain: false
  ordinaryRuntimeUpdate: false
  acceptedWikiFacts: false
}

/**
 * Same-turn temporary outline patch for runtime handoff only. It does not write
 * `wiki/`, does not modify `wiki/outlines/main.md`, and does not become an
 * accepted wiki fact.
 */
export interface ProvisionalOutlinePatch {
  patchId: string
  sourceRequestId: string
  scope: "same_turn_only"
  outlineImpactLevel: Extract<RpgOutlineImpactLevel, "major_rewrite_required">
  affectedOutlineRefs: OutlineStableRef[]
  suspendedBeatRefs: OutlineStableRef[]
  invalidatedBeatRefs: OutlineStableRef[]
  preservedConfirmedFacts: string[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
  narrativeLines: RpgNarrativeLine[]
  visibilityBoundary: OutlineVisibilityBoundary[]
  narrationHandoff: ProvisionalNarrationHandoff
  nonPersistenceBoundary: ProvisionalOutlinePatchNonPersistenceBoundary
}

export interface OutlineRevisionProposalReviewBoundary {
  reviewItemKind: Extract<RpgReviewItemKind, "outlineRevision">
  reviewBoundary: "independent_pending_review"
  ordinaryRuntimeUpdate: false
  proposedWikiUpdate: false
  autoWriteMainOutline: false
  mainOutlineWritePolicy: "manual_or_review_only"
}

export interface OutlineRevisionProposal {
  proposalId: string
  sourceRequestId: string
  reviewItemKind: Extract<RpgReviewItemKind, "outlineRevision">
  outlineImpactLevel: Extract<RpgOutlineImpactLevel, "major_rewrite_required">
  targetOutlineRefs: OutlineStableRef[]
  invalidatedAssumptions: string[]
  mustPreserveFacts: string[]
  proposedRevision: {
    summary: string
    revisedBeats: string[]
    revisedRevealOrder: string[]
    branchAdjustments: string[]
    futureOnly: true
  }
  visibilityAndKnowledgeScope: OutlineVisibilityBoundary[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
  reviewBoundary: OutlineRevisionProposalReviewBoundary
}

export interface RegenerationSafetyReport {
  reportKind: "regenerationSafetyReport"
  safetyConclusion: "safe"
  preservesConfirmedFacts: true
  futureNotWrittenAsEvent: true
  forbiddenRevealProtected: true
  mainOutlineNotDirectlyModified: true
  provisionalPatchNonPersistent: true
  proposalReviewBoundary: true
  ordinaryRuntimeUpdateBoundary: true
  noWikiWrite: true
  noPlayerFacingProse: true
  checkedRuntimeRefs: string[]
  checkedOutlineRefs: string[]
  warnings: string[]
}

export interface OutlineBriefCompilerOutput {
  outlineAwareNarrationBrief: OutlineAwareNarrationBrief
  outlineImpactReport: OutlineImpactReport
  regenerationRequest?: RegenerationRequest
  warnings: string[]
}

export interface StoryOutlineRegeneratorOutput {
  provisionalOutlinePatch: ProvisionalOutlinePatch
  outlineRevisionProposal: OutlineRevisionProposal
  regenerationSafetyReport: RegenerationSafetyReport
  warnings: string[]
}

export type NarrationRevealBoundary =
  | "allowed_now"
  | "hint_only"
  | "delay"
  | "forbid"
  | "parallel_only"
  | "gm_only"

export type NarrationPacingComplianceStatus =
  | "followed"
  | "partially_followed"
  | "not_applicable"

export interface NarrationSourceRef {
  path: string
  sectionId?: string
  runtimeDeltaId?: string
  stableId?: string
  ref?: string
  lineTarget?: RpgNarrativeLine
  usePurpose: RpgUsePurpose
  visibilityScope?: RpgVisibilityScope
  knowledgeScope?: RpgKnowledgeScope
  knowledgeClaims?: RpgKnowledgeClaim[]
  reason: string
}

export interface NarrationStyleBundle {
  bundleId: string
  toneRules: string[]
  dictionRules: string[]
  pacingRules: string[]
  forbiddenStyleMoves: string[]
  sourceRefs: NarrationSourceRef[]
  styleIsNotWorldFact: true
  styleIsNotPlotFact: true
}

export interface ForbiddenNarrationConstraint {
  constraintId: string
  sourcePath?: string
  sectionId?: string
  stableId?: string
  lineTarget: RpgNarrativeLine
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  mustNotReveal: string[]
  reason: string
}

export interface PlayerKnowledgeBoundary {
  boundaryId: string
  pcKnowledgePath: "wiki/player/known_information.md"
  allowedKnowledgeRefs: NarrationSourceRef[]
  forbiddenVisibilityScopes: Extract<RpgVisibilityScope, "user_visible_pc_unknown" | "gm_only" | "hidden">[]
  parallelLineDoesNotGrantPcKnowledge: true
  showParallelLineDoesNotGrantPcKnowledge: true
  notes: string[]
}

export interface NarrationDisplayPolicy {
  showPlayerFacingText: true
  showParallelLine: boolean
  parallelLineGrantsPcKnowledge: false
  showTensionBriefToPlayer: false
  tensionBriefIsReviewHandoff: true
}

export interface TensionBrief {
  summary: string
  pressureSignals: string[]
  relationshipSignals: string[]
  plotArcSignals: string[]
  reviewHandoff: string
  runtimeReviewHandoff: true
  ordinaryEventFact: false
  playerFacing: false
  references: NarrationSourceRef[]
}

export interface ProvisionalPatchUsageMeta {
  usedProvisionalPatch: boolean
  handoffId?: string
  sourcePatchId?: string
  followedMustFollow: string[]
  respectedMustNotReveal: true
  hardConstraintsApplied: string[]
  sameTurnOnly: true
}

export interface NarrationMeta {
  narrationId: string
  usedProvisionalPatch: boolean
  respectedMustNotReveal: true
  followedPacingIntent: NarrationPacingComplianceStatus
  timeCompression: "none" | "compressed" | "expanded" | "scene_cut"
  sceneTransition: "none" | "soft_transition" | "hard_cut" | "new_scene"
  campaignDelta: "none" | "minor" | "meaningful" | "scene_changing"
  revealBoundary: NarrationRevealBoundary
  playerKnowledgeBoundary: PlayerKnowledgeBoundary
  provisionalPatchUsage?: ProvisionalPatchUsageMeta
  styleBundleApplied: boolean
  styleRemainedNonFact: true
  warnings: string[]
}

export interface RuntimeNarrationActionOption {
  id: string
  playerFacingText: string
  intent: "investigate" | "talk" | "fight" | "move" | "wait" | "use_item" | "custom"
  riskLevel: "low" | "medium" | "high"
  likelyAffectedPaths: string[]
  knowledgeScope: Extract<RpgKnowledgeScope, "pc_known" | "pc_misunderstanding">
  visibilityScope: Extract<RpgVisibilityScope, "pc_visible" | "pc_inferred">
  grantsPcKnowledge: boolean
  optionOnly: true
  happenedStatus: Extract<RpgHappenedStatus, "possible_future" | "intention_only">
  sourceRefs: NarrationSourceRef[]
}

export interface TurnNarration {
  playerFacingText: string
  parallelLineText?: string
  tensionBrief: TensionBrief
  displayPolicy: NarrationDisplayPolicy
  narrationMeta: NarrationMeta
  nextActionOptions: RuntimeNarrationActionOption[]
  references: NarrationSourceRef[]
  warnings: string[]
}

export interface NarrationGeneratorInput {
  turnSemanticHandoff?: TurnSemanticHandoff
  postActionWorkingState: PostActionWorkingState
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  outlineAwareNarrationBrief: OutlineAwareNarrationBrief
  provisionalNarrationHandoff?: ProvisionalNarrationHandoff
  recallSelection: RecallSelection
  recalledMaterials: RecalledMaterial[]
  styleBundle: NarrationStyleBundle
  forbiddenNarrationConstraints: ForbiddenNarrationConstraint[]
  playerKnowledgeBoundary: PlayerKnowledgeBoundary
  references: NarrationSourceRef[]
  runtimeRefs: RpgRuntimeDeltaRef[]
}

export type RuntimeUpdateSourceStage =
  | "turnRecord"
  | "postActionWorkingState"
  | "actionResolution"
  | "worldTickResult"
  | "visibleSelection"
  | "recallSelection"
  | "recalledMaterials"
  | "outlineAwareNarrationBrief"
  | "outlineImpactReport"
  | "provisionalOutlinePatch"
  | "outlineRevisionProposal"
  | "turnNarration"
  | "consistencyValidation"

export type RuntimeUpdateConfidence = "low" | "medium" | "high"
export type RuntimeUpdateReviewPolicy = "pending_review" | "manual_review" | "review_only"
export type RuntimeUpdateWritePolicy = "overwrite" | "append" | "merge" | "forbidden"
export type RuntimeUpdateAllowedTargetKind =
  | "currentScene"
  | "events"
  | "player"
  | "quests"
  | "outlineProgress"
  | "runtimeOverlay"

export interface RuntimeUpdateAllowedTarget {
  targetKind: RuntimeUpdateAllowedTargetKind
  pathPattern: string
  strategy: RpgUpdateStrategy
  description: string
}

export interface RuntimeUpdateWritePolicyRule {
  pathPattern: string
  allowedStrategy: RuntimeUpdateWritePolicy
  reviewPolicy: RuntimeUpdateReviewPolicy
  notes: string[]
}

export interface RuntimeUpdateReviewPolicyRule {
  reviewItemKind: RpgReviewItemKind
  reviewPolicy: RuntimeUpdateReviewPolicy
  ordinaryRuntimeUpdate: boolean
  autoApply: false
  notes: string[]
}

export interface RuntimeUpdateConsistencyValidation {
  validationId: string
  checkedSources: RuntimeUpdateSourceStage[]
  safeToPropose: boolean
  contradictions: string[]
  warnings: string[]
}

export interface RuntimeUpdateSourceDelta {
  deltaId: string
  sourceStage: RuntimeUpdateSourceStage
  sourcePath?: string
  sourceField?: string
  summary: string
  lineTarget: RpgNarrativeLine
  visibility: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  happenedStatus: RpgHappenedStatus
  usePurpose: RpgUsePurpose
  affectedPaths: string[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
  knowledgeClaims: RpgKnowledgeClaim[]
  revealGateRefs: string[]
  revealState?: RpgRevealState
}

export interface RuntimeUpdateValidationHint {
  hintId: string
  severity: "info" | "warning" | "blocker"
  code: string
  message: string
}

export interface RuntimeProposedWikiUpdate extends ProposedWikiUpdate {
  sourceDeltas: RuntimeUpdateSourceDelta[]
  lineTarget: RpgNarrativeLine
  visibility: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  happenedStatus: RpgHappenedStatus
  confidence: RuntimeUpdateConfidence
  validationHints: RuntimeUpdateValidationHint[]
}

export interface SkippedRuntimeDelta {
  skipId: string
  sourceDelta: RuntimeUpdateSourceDelta
  code: string
  reason: string
  reviewPolicy: RuntimeUpdateReviewPolicy
}

export interface PacingUpdateProposal {
  proposalId: string
  sourceDeltaIds: string[]
  previousPacingState?: string
  nextPacingState: string
  timeDeltaSummary: string
  campaignDelta: string
  pacingDebtChange: "decreased" | "unchanged" | "increased" | "scene_cut_needed"
  targetPath: "wiki/current-scene/scene_state.md" | "wiki/outlines/progress.md" | "journal_only"
  reviewPolicy: RuntimeUpdateReviewPolicy
}

export interface ProposalGroup {
  groupId: string
  title: string
  lineTarget: RpgNarrativeLine
  updateIds: string[]
  skippedDeltaIds: string[]
  sourceDeltaIds: string[]
  reason: string
  reviewPolicy: RuntimeUpdateReviewPolicy
}

export interface OutlineRevisionReviewItem {
  reviewItemId: string
  sourceProposalId: string
  sourceRequestId?: string
  reviewItemKind: Extract<RpgReviewItemKind, "outlineRevision">
  outlineImpactLevel: RpgOutlineImpactLevel
  summary: string
  proposedRevisionSummary: string
  targetOutlineRefs: OutlineStableRef[]
  mustPreserveFacts: string[]
  runtimeDeltaRefs: RpgRuntimeDeltaRef[]
  reviewPolicy: Extract<RuntimeUpdateReviewPolicy, "manual_review" | "review_only">
  ordinaryRuntimeUpdate: false
  proposedWikiUpdate: false
  autoWriteMainOutline: false
  warnings: string[]
}

export interface RuntimeUpdateProposalInput {
  turnRecord: {
    submittedAction: SubmittedAction
    generatedNarrative: string
    references: string[]
  }
  postActionWorkingState: PostActionWorkingState
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  recallSelection: RecallSelection
  recalledMaterials: RecalledMaterial[]
  outlineAwareNarrationBrief: OutlineAwareNarrationBrief
  outlineImpactReport: OutlineImpactReport
  provisionalOutlinePatch?: ProvisionalOutlinePatch
  outlineRevisionProposal?: OutlineRevisionProposal
  turnNarration?: TurnNarration
  consistencyValidation: RuntimeUpdateConsistencyValidation
  allowedTargets: RuntimeUpdateAllowedTarget[]
  writePolicy: RuntimeUpdateWritePolicyRule[]
  reviewPolicy: RuntimeUpdateReviewPolicyRule[]
}

export interface RuntimeUpdateProposalResult {
  proposedWikiUpdates: RuntimeProposedWikiUpdate[]
  outlineRevisionReviewItems: OutlineRevisionReviewItem[]
  journalEntries: string[]
  skippedDeltas: SkippedRuntimeDelta[]
  pacingUpdateProposal: PacingUpdateProposal | null
  proposalGroups: ProposalGroup[]
  warnings: string[]
}

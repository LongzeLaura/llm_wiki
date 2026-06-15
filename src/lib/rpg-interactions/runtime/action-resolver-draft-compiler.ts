import {
  ACTION_RESOLVER_DEFAULT_EVENT_STATUS,
  type ActionResolution,
  type ActionResolverInput,
} from "../../rpg-runtime/types"
import type {
  RpgHappenedStatus,
  RpgRuntimeDeltaRef,
  RpgVisibilityScope,
} from "../../rpg-wiki-schema"
import {
  assertNoForbiddenSoftDraftKeys,
  formatSoftDraftLooseCoercionStructuredWarning,
  readArrayLoose,
  readStringArrayLoose,
  stripDerivableDraftKeys,
  type SoftDraftLooseCoercion,
} from "./soft-draft-protocol"

export type ActionResolutionDraft = Record<string, unknown>

const FORBIDDEN_DERIVABLE_KEYS = new Set([
  "resolutionId",
  "submittedActionId",
  "eventId",
  "costId",
  "obstacleId",
  "resultId",
  "deltaId",
  "causedByActionId",
  "runtimeDeltaRefs",
  "references",
])

const FORBIDDEN_SAFETY_KEYS = [
  /^(?:proposedUpdates?|proposedWikiUpdates?|pendingUpdates?|wikiWrites?|wikiWriteProposal|writeProposal|targetPath|targetPaths|strategy|applyUpdates?|acceptedUpdates?)$/i,
  /^(?:narrative|narration|playerNarration|playerFacingText|playerFacingNarration|visibleNarration|parallelLineText|nextActionOptions)$/i,
  /^(?:outlineRevision|outlineRevisionProposal|provisionalOutlinePatch|regenerationRequest|storyOutlineRegeneration)$/i,
] as const

export function compileActionResolutionDraftOutput(
  draftValue: unknown,
  input: ActionResolverInput,
): ActionResolution {
  assertNoForbiddenSoftDraftKeys(draftValue, FORBIDDEN_SAFETY_KEYS, "ActionResolutionDraft")
  const looseCoercions: SoftDraftLooseCoercion[] = []
  const stripped = stripDerivableDraftKeys(draftValue, FORBIDDEN_DERIVABLE_KEYS, "ActionResolutionDraft")
  const draft = expectRecord(stripped.value, "ActionResolutionDraft")
  const actionId = input.submittedAction.id
  const parsedIntentRecord = expectRecord(draft.parsedIntent, "ActionResolutionDraft.parsedIntent")
  const eventDraftRecord = expectRecord(draft.eventDraft, "ActionResolutionDraft.eventDraft")
  const playerActionDeltaRecord = expectRecord(draft.playerActionDelta, "ActionResolutionDraft.playerActionDelta")
  const looseStringArrayOptions = {
    allowNullAsEmpty: true,
    allowStringAsSingle: true,
    coercions: looseCoercions,
  }
  const eventStatus = readOptionalString(eventDraftRecord, "status") as RpgHappenedStatus | undefined
  const canonicalStatus = eventStatus ?? ACTION_RESOLVER_DEFAULT_EVENT_STATUS
  const deltaRef = actionDeltaRef({
    actionId,
    deltaId: `player-action-delta-${slug(actionId)}`,
    summary: readString(eventDraftRecord, "summary", "ActionResolutionDraft.eventDraft.summary"),
    happenedStatus: canonicalStatus,
  })

  const result: ActionResolution = {
    resolutionId: `action-resolution-${slug(actionId)}`,
    submittedActionId: actionId,
    parsedIntent: {
      intentKind: readString(parsedIntentRecord, "intentKind", "ActionResolutionDraft.parsedIntent.intentKind") as ActionResolution["parsedIntent"]["intentKind"],
      actorRef: readString(parsedIntentRecord, "actorRef", "ActionResolutionDraft.parsedIntent.actorRef"),
      targetRefs: readStringArrayLoose(parsedIntentRecord, "targetRefs", "ActionResolutionDraft.parsedIntent.targetRefs", looseStringArrayOptions),
      actionScope: readString(parsedIntentRecord, "actionScope", "ActionResolutionDraft.parsedIntent.actionScope"),
      declaredGoal: readString(parsedIntentRecord, "declaredGoal", "ActionResolutionDraft.parsedIntent.declaredGoal"),
      timeJumpSignal: readOptionalString(parsedIntentRecord, "timeJumpSignal"),
      ambiguityNotes: readStringArrayLoose(parsedIntentRecord, "ambiguityNotes", "ActionResolutionDraft.parsedIntent.ambiguityNotes", looseStringArrayOptions),
    },
    eventDraft: {
      eventId: `event-draft-${slug(actionId)}`,
      eventType: readString(eventDraftRecord, "eventType", "ActionResolutionDraft.eventDraft.eventType"),
      summary: readString(eventDraftRecord, "summary", "ActionResolutionDraft.eventDraft.summary"),
      status: canonicalStatus,
      confirmationBasis: readOptionalString(eventDraftRecord, "confirmationBasis"),
      actorRefs: readStringArrayLoose(eventDraftRecord, "actorRefs", "ActionResolutionDraft.eventDraft.actorRefs", looseStringArrayOptions),
      targetRefs: readStringArrayLoose(eventDraftRecord, "targetRefs", "ActionResolutionDraft.eventDraft.targetRefs", looseStringArrayOptions),
      affectedRefs: readStringArrayLoose(eventDraftRecord, "affectedRefs", "ActionResolutionDraft.eventDraft.affectedRefs", looseStringArrayOptions),
      riskSummary: readString(eventDraftRecord, "riskSummary", "ActionResolutionDraft.eventDraft.riskSummary"),
      requiredChecks: readStringArrayLoose(eventDraftRecord, "requiredChecks", "ActionResolutionDraft.eventDraft.requiredChecks", looseStringArrayOptions),
      ambiguityNotes: readStringArrayLoose(eventDraftRecord, "ambiguityNotes", "ActionResolutionDraft.eventDraft.ambiguityNotes", looseStringArrayOptions),
    },
    feasibility: expectRecord(
      draft.feasibility,
      "ActionResolutionDraft.feasibility",
    ) as unknown as ActionResolution["feasibility"],
    costs: readArrayLoose(draft, "costs", "ActionResolutionDraft.costs", { allowNullAsEmpty: true, coercions: looseCoercions }).map((value, index) => {
      const record = expectRecord(value, `ActionResolutionDraft.costs[${index}]`)
      return {
        costId: `cost-${slug(actionId)}-${index + 1}`,
        kind: readString(record, "kind", `ActionResolutionDraft.costs[${index}].kind`) as ActionResolution["costs"][number]["kind"],
        description: readString(record, "description", `ActionResolutionDraft.costs[${index}].description`),
        appliesIf: readString(record, "appliesIf", `ActionResolutionDraft.costs[${index}].appliesIf`),
      }
    }),
    obstacles: readArrayLoose(draft, "obstacles", "ActionResolutionDraft.obstacles", { allowNullAsEmpty: true, coercions: looseCoercions }).map((value, index) => {
      const record = expectRecord(value, `ActionResolutionDraft.obstacles[${index}]`)
      return {
        obstacleId: `obstacle-${slug(actionId)}-${index + 1}`,
        severity: readString(record, "severity", `ActionResolutionDraft.obstacles[${index}].severity`) as ActionResolution["obstacles"][number]["severity"],
        description: readString(record, "description", `ActionResolutionDraft.obstacles[${index}].description`),
        bypassHint: readOptionalString(record, "bypassHint"),
      }
    }),
    directResults: readArrayLoose(draft, "directResults", "ActionResolutionDraft.directResults", { allowNullAsEmpty: true, coercions: looseCoercions }).map((value, index) => {
      const record = expectRecord(value, `ActionResolutionDraft.directResults[${index}]`)
      return {
        resultId: `direct-result-${slug(actionId)}-${index + 1}`,
        summary: readString(record, "summary", `ActionResolutionDraft.directResults[${index}].summary`),
        happenedStatus: readString(record, "happenedStatus", `ActionResolutionDraft.directResults[${index}].happenedStatus`) as RpgHappenedStatus,
        visibilityScope: readString(record, "visibilityScope", `ActionResolutionDraft.directResults[${index}].visibilityScope`) as RpgVisibilityScope,
        affectedRefs: readStringArrayLoose(record, "affectedRefs", `ActionResolutionDraft.directResults[${index}].affectedRefs`, looseStringArrayOptions),
      }
    }),
    timeDelta: expectRecord(
      draft.timeDelta,
      "ActionResolutionDraft.timeDelta",
    ) as unknown as ActionResolution["timeDelta"],
    progressPotential: expectRecord(
      draft.progressPotential,
      "ActionResolutionDraft.progressPotential",
    ) as unknown as ActionResolution["progressPotential"],
    playerActionDelta: {
      deltaId: deltaRef.deltaId,
      causedByActionId: actionId,
      scope: "player_action_only",
      positionChanges: readStringArrayLoose(playerActionDeltaRecord, "positionChanges", "ActionResolutionDraft.playerActionDelta.positionChanges", looseStringArrayOptions),
      resourceChanges: readStringArrayLoose(playerActionDeltaRecord, "resourceChanges", "ActionResolutionDraft.playerActionDelta.resourceChanges", looseStringArrayOptions),
      inventoryChanges: readStringArrayLoose(playerActionDeltaRecord, "inventoryChanges", "ActionResolutionDraft.playerActionDelta.inventoryChanges", looseStringArrayOptions),
      conditionChanges: readStringArrayLoose(playerActionDeltaRecord, "conditionChanges", "ActionResolutionDraft.playerActionDelta.conditionChanges", looseStringArrayOptions),
      knowledgeChanges: readStringArrayLoose(playerActionDeltaRecord, "knowledgeChanges", "ActionResolutionDraft.playerActionDelta.knowledgeChanges", looseStringArrayOptions),
      relationshipSignals: readStringArrayLoose(playerActionDeltaRecord, "relationshipSignals", "ActionResolutionDraft.playerActionDelta.relationshipSignals", looseStringArrayOptions),
      sceneChanges: readStringArrayLoose(playerActionDeltaRecord, "sceneChanges", "ActionResolutionDraft.playerActionDelta.sceneChanges", looseStringArrayOptions),
      interruptedEvents: readStringArrayLoose(playerActionDeltaRecord, "interruptedEvents", "ActionResolutionDraft.playerActionDelta.interruptedEvents", looseStringArrayOptions),
      exposedInformation: readStringArrayLoose(playerActionDeltaRecord, "exposedInformation", "ActionResolutionDraft.playerActionDelta.exposedInformation", looseStringArrayOptions),
      runtimeDeltaRefs: [deltaRef],
      notes: readStringArrayLoose(playerActionDeltaRecord, "notes", "ActionResolutionDraft.playerActionDelta.notes", looseStringArrayOptions),
    },
    runtimeDeltaRefs: [deltaRef],
    references: readStringArrayLoose(draft, "referencePaths", "ActionResolutionDraft.referencePaths", looseStringArrayOptions)
      .map((path, index) => ({
        path,
        reason: `Referenced by ActionResolutionDraft.referencePaths[${index}].`,
        usePurpose: "actionResolution" as const,
        visibilityScope: undefined,
        knowledgeScope: undefined,
      })),
    warnings: [
      ...readStringArrayLoose(draft, "warnings", "ActionResolutionDraft.warnings", looseStringArrayOptions)
        .map((message, index) => ({
          code: `draft_warning_${index + 1}`,
          message,
          severity: "warning" as const,
        })),
      ...stripped.strippedPaths.map((path) => ({
        code: "derivable_protocol_stripped",
        message: `Ignored derivable draft protocol field ${path}; local compiler generated the canonical value.`,
        severity: "warning" as const,
      })),
      ...looseCoercions.map(formatSoftDraftLooseCoercionStructuredWarning),
    ],
  }

  return result
}

function actionDeltaRef(input: {
  actionId: string
  deltaId: string
  summary: string
  happenedStatus: RpgHappenedStatus
}): RpgRuntimeDeltaRef {
  return {
    deltaId: input.deltaId,
    sourceStage: "actionResolution",
    sourcePath: `.llm-wiki/runtime/turns/${slug(input.actionId)}/action-resolution.json#${input.deltaId}`,
    summary: input.summary,
    narrativeLine: "playerVisibleLine",
    usePurpose: "actionResolution",
    happenedStatus: input.happenedStatus,
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

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== "string") {
    throw new Error(`Invalid ActionResolutionDraft.${key}: must be a string when provided.`)
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function slug(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "action"
}

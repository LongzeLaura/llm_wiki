import {
  defaultRuntimeUpdateReviewPolicy,
  runtimeUpdateTargetRulesToAllowedTargets,
  runtimeUpdateTargetRulesToWritePolicy,
} from "../rpg-interactions/runtime/runtime-update-proposal-validation"
import { getRpgRuntimeUpdateTargetRules, type RpgRuntimeUpdateTargetRule } from "../rpg-interactions/runtime/wiki-update-policy"
import type { RpgTurnRecord } from "./turn-model"
import type { RuntimeUpdateProposalInput } from "./types"

export interface BuildRuntimeUpdateProposalInputOptions {
  allowedTargets?: readonly RpgRuntimeUpdateTargetRule[]
}

export function buildRuntimeUpdateProposalInputFromTurnRecord(
  turnRecord: RpgTurnRecord,
  options: BuildRuntimeUpdateProposalInputOptions = {},
): RuntimeUpdateProposalInput {
  const targetRules = options.allowedTargets ?? getRpgRuntimeUpdateTargetRules()

  return {
    turnRecord: {
      submittedAction: turnRecord.submittedAction,
      generatedNarrative: turnRecord.generatedNarrative,
      references: turnRecord.references,
    },
    postActionWorkingState: turnRecord.postActionWorkingState,
    actionResolution: turnRecord.actionResolution,
    worldTickResult: turnRecord.worldTickResult,
    visibleSelection: turnRecord.visibleSelection,
    recallSelection: turnRecord.recallSelection,
    recalledMaterials: turnRecord.recalledMaterials,
    outlineAwareNarrationBrief: turnRecord.outlineAwareNarrationBrief,
    outlineImpactReport: turnRecord.outlineImpactReport,
    ...(turnRecord.provisionalOutlinePatch ? { provisionalOutlinePatch: turnRecord.provisionalOutlinePatch } : {}),
    ...(turnRecord.outlineRevisionProposal ? { outlineRevisionProposal: turnRecord.outlineRevisionProposal } : {}),
    ...(turnRecord.turnNarration ? { turnNarration: turnRecord.turnNarration } : {}),
    consistencyValidation: {
      validationId: `runtime-update-consistency-${turnRecord.submittedAction.id}`,
      checkedSources: [
        "turnRecord",
        "postActionWorkingState",
        "actionResolution",
        "worldTickResult",
        "visibleSelection",
        "recallSelection",
        "recalledMaterials",
        "outlineAwareNarrationBrief",
        "outlineImpactReport",
        ...(turnRecord.provisionalOutlinePatch ? ["provisionalOutlinePatch" as const] : []),
        ...(turnRecord.outlineRevisionProposal ? ["outlineRevisionProposal" as const] : []),
        ...(turnRecord.turnNarration ? ["turnNarration" as const] : []),
      ],
      safeToPropose: true,
      contradictions: [],
      warnings: [],
    },
    allowedTargets: runtimeUpdateTargetRulesToAllowedTargets(targetRules),
    writePolicy: runtimeUpdateTargetRulesToWritePolicy(targetRules),
    reviewPolicy: defaultRuntimeUpdateReviewPolicy(),
  }
}

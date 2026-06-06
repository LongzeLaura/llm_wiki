import type { RpgNarrationAdapter } from "./narration-adapter"
import { createPendingRpgUpdates, type PendingRpgUpdate } from "./update-staging"
import { extractRpgStateUpdates, type ProposedWikiUpdate } from "./state-extractor"
import { runRpgTurn } from "./turn-orchestrator"
import type { RpgTurnRecord, RpgTurnResult } from "./turn-model"
import type { CompactStoryBrief, SubmittedAction } from "./types"

export interface RunRpgRuntimeTurnFlowInput {
  projectPath: string
  wikiMode: "llmwikirpg"
  submittedAction: SubmittedAction
  narrationAdapter: RpgNarrationAdapter
}

export interface RunRpgRuntimeTurnFlowResult {
  brief: CompactStoryBrief
  turnResult: RpgTurnResult
  turnRecord: RpgTurnRecord
  proposedUpdates: ProposedWikiUpdate[]
  pendingUpdates: PendingRpgUpdate[]
  warnings: string[]
}

export async function runRpgRuntimeTurnFlow(
  input: RunRpgRuntimeTurnFlowInput,
): Promise<RunRpgRuntimeTurnFlowResult> {
  const turn = await runRpgTurn(input)
  const extracted = extractRpgStateUpdates({ turnRecord: turn.turnRecord })
  const pendingUpdates = createPendingRpgUpdates(extracted.proposedUpdates)

  return {
    brief: turn.brief,
    turnResult: turn.turnResult,
    turnRecord: turn.turnRecord,
    proposedUpdates: extracted.proposedUpdates,
    pendingUpdates,
    warnings: [...turn.warnings, ...extracted.warnings],
  }
}

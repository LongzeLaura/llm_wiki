import {
  buildRpgNarrationPrompt,
  type RpgNarrationAdapter,
  validateRpgTurnResult,
} from "../rpg-interactions/runtime"
import { runRpgRuntimePreview } from "./runtime-agent"
import { createRpgTurnRecord, type RpgTurnRecord, type RpgTurnResult } from "./turn-model"
import type { CompactStoryBrief, SubmittedAction } from "./types"

export interface RunRpgTurnInput {
  projectPath: string
  wikiMode: "llmwikirpg"
  submittedAction: SubmittedAction
  narrationAdapter: RpgNarrationAdapter
}

export interface RunRpgTurnResult {
  brief: CompactStoryBrief
  turnResult: RpgTurnResult
  turnRecord: RpgTurnRecord
  warnings: string[]
}

export async function runRpgTurn(input: RunRpgTurnInput): Promise<RunRpgTurnResult> {
  const preview = await runRpgRuntimePreview({
    projectPath: input.projectPath,
    submittedAction: input.submittedAction,
    wikiMode: input.wikiMode,
  })

  const promptInput = { brief: preview.brief }
  const prompt = buildRpgNarrationPrompt(promptInput)
  const turnResult = validateRpgTurnResult(await input.narrationAdapter.generateTurn(prompt, promptInput))
  const turnRecord = createRpgTurnRecord({
    submittedAction: input.submittedAction,
    turnResult,
  })

  return {
    brief: preview.brief,
    turnResult,
    turnRecord,
    warnings: preview.warnings,
  }
}

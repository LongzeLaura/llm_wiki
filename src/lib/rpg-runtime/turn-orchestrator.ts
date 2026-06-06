import { buildRpgNarrationPrompt } from "./narration-prompts"
import type { RpgNarrationAdapter } from "./narration-adapter"
import { validateRpgTurnResult } from "./narration-adapter"
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

  const prompt = buildRpgNarrationPrompt({ brief: preview.brief })
  const turnResult = validateRpgTurnResult(await input.narrationAdapter.generateTurn(prompt))
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

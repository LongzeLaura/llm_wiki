import { compileRpgContext } from "./context-compiler"
import type { RpgRuntimePreviewResult, RunRpgRuntimePreviewInput } from "./types"

export async function runRpgRuntimePreview(input: RunRpgRuntimePreviewInput): Promise<RpgRuntimePreviewResult> {
  if (input.wikiMode !== "llmwikirpg") {
    throw new Error("RPG runtime preview requires wikiMode === \"llmwikirpg\".")
  }

  const { brief, warnings } = await compileRpgContext({
    projectPath: input.projectPath,
    submittedAction: input.submittedAction,
  })

  return {
    submittedAction: input.submittedAction,
    brief,
    warnings,
  }
}

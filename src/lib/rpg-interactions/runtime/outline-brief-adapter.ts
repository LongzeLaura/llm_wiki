import type {
  OutlineBriefCompilerInput,
  OutlineBriefCompilerOutput,
} from "../../rpg-runtime/types"
import type { RpgOutlineBriefPrompt } from "./outline-brief-interaction"
import { validateOutlineBriefCompilerOutput } from "./outline-brief-validation"

export interface RpgOutlineBriefAdapter {
  compileOutlineBrief(
    prompt: RpgOutlineBriefPrompt,
    promptInput: OutlineBriefCompilerInput,
  ): Promise<OutlineBriefCompilerOutput>
}

export function createFixtureOutlineBriefAdapter(
  output: OutlineBriefCompilerOutput,
): RpgOutlineBriefAdapter {
  return {
    async compileOutlineBrief(_prompt, promptInput) {
      return validateOutlineBriefCompilerOutput(output, promptInput)
    },
  }
}

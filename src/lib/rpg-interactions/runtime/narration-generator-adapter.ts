import type { NarrationGeneratorInput, TurnNarration } from "../../rpg-runtime/types"
import { parseRpgNarrationGeneratorOutput, type RpgNarrationGeneratorPrompt } from "./narration-generator-interaction"

export interface RpgNarrationGeneratorAdapter {
  generateNarration(
    prompt: RpgNarrationGeneratorPrompt,
    promptInput: NarrationGeneratorInput,
  ): Promise<TurnNarration>
  generateNarrationRawOutput?(
    prompt: RpgNarrationGeneratorPrompt,
    promptInput: NarrationGeneratorInput,
  ): Promise<string>
  repairNarrationRawOutput?(
    prompt: RpgNarrationGeneratorPrompt,
    promptInput: NarrationGeneratorInput,
  ): Promise<string>
}

export function createFixtureNarrationGeneratorAdapter(
  output: string | TurnNarration,
): RpgNarrationGeneratorAdapter {
  return {
    async generateNarration(_prompt, promptInput) {
      if (typeof output !== "string") return output
      const rawOutput = typeof output === "string" ? output : JSON.stringify(output)
      return parseRpgNarrationGeneratorOutput(rawOutput, promptInput)
    },
  }
}

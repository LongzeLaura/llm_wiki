import type { NarrationGeneratorInput, TurnNarration } from "../../rpg-runtime/types"
import { parseRpgNarrationGeneratorOutput, type RpgNarrationGeneratorPrompt } from "./narration-generator-interaction"

export interface RpgNarrationGeneratorAdapter {
  generateNarration(
    prompt: RpgNarrationGeneratorPrompt,
    promptInput: NarrationGeneratorInput,
  ): Promise<TurnNarration>
}

export function createFixtureNarrationGeneratorAdapter(
  output: string | TurnNarration,
): RpgNarrationGeneratorAdapter {
  return {
    async generateNarration(_prompt, promptInput) {
      const rawOutput = typeof output === "string" ? output : JSON.stringify(output)
      return parseRpgNarrationGeneratorOutput(rawOutput, promptInput)
    },
  }
}

import type { RpgInteractionPrompt } from "../interaction-spec"

export interface RpgRuntimeUpdateInteractionAdapter {
  generateUpdateProposal(prompt: RpgInteractionPrompt): Promise<string>
}

export function createFixtureRuntimeUpdateInteractionAdapter(
  output: string,
): RpgRuntimeUpdateInteractionAdapter {
  return {
    async generateUpdateProposal() {
      return output
    },
  }
}

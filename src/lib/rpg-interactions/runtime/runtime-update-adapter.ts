import type { RpgInteractionPrompt } from "../interaction-spec"
import type { BuildRuntimeUpdateInteractionInput, RuntimeUpdateInteractionResult } from "./runtime-update-interaction"
import { runtimeUpdateInteractionSpec } from "./runtime-update-interaction"

export interface RpgRuntimeUpdateInteractionAdapter {
  generateUpdateProposal(prompt: RpgInteractionPrompt): Promise<string>
}

export interface RpgRuntimeUpdateProposalAdapter {
  generateRuntimeUpdateProposal(input: BuildRuntimeUpdateInteractionInput): Promise<RuntimeUpdateInteractionResult>
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

export function createFixtureRuntimeUpdateProposalAdapter(
  output: string | RuntimeUpdateInteractionResult,
): RpgRuntimeUpdateProposalAdapter {
  return {
    async generateRuntimeUpdateProposal(input) {
      const prompt = runtimeUpdateInteractionSpec.buildPrompt(input)
      void prompt
      const rawOutput = typeof output === "string" ? output : JSON.stringify(output)
      return runtimeUpdateInteractionSpec.parseOutput(rawOutput, input)
    },
  }
}

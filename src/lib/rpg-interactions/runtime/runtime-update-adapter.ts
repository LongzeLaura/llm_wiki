import type { RpgInteractionPrompt } from "../interaction-spec"
import type { BuildRuntimeUpdateInteractionInput, RuntimeUpdateInteractionResult } from "./runtime-update-interaction"
import { runtimeUpdateInteractionSpec } from "./runtime-update-interaction"
import { validateRuntimeUpdateProposalResult } from "./runtime-update-proposal-validation"

export interface RpgRuntimeUpdateInteractionAdapter {
  generateUpdateProposal(prompt: RpgInteractionPrompt): Promise<string>
  repairUpdateProposalRawOutput?(prompt: RpgInteractionPrompt): Promise<string>
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
      if (typeof output !== "string") return validateRuntimeUpdateProposalResult(output, input)
      return runtimeUpdateInteractionSpec.parseOutput(output, input)
    },
  }
}

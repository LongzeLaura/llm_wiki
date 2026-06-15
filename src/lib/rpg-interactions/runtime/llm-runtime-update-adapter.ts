import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat, type RequestOverrides } from "../../llm-client"
import type { RpgInteractionPrompt } from "../interaction-spec"
import type {
  RpgRuntimeUpdateInteractionAdapter,
  RpgRuntimeUpdateProposalAdapter,
} from "./runtime-update-adapter"
import type { BuildRuntimeUpdateInteractionInput } from "./runtime-update-interaction"
import { runtimeUpdateInteractionSpec } from "./runtime-update-interaction"

export interface CreateLlmRpgRuntimeUpdateInteractionAdapterInput {
  llmConfig: LlmConfig
  signal?: AbortSignal
}

export interface LlmRpgRuntimeUpdateInteractionAdapterOptions {
  requestOverrides?: RequestOverrides
  repairRequestOverrides?: RequestOverrides
}

export function createLlmRpgRuntimeUpdateInteractionAdapter(
  input: CreateLlmRpgRuntimeUpdateInteractionAdapterInput,
  options: LlmRpgRuntimeUpdateInteractionAdapterOptions = {},
): RpgRuntimeUpdateInteractionAdapter {
  return {
    async generateUpdateProposal(prompt) {
      return collectRpgRuntimeUpdateOutput(input, options, prompt)
    },
    async repairUpdateProposalRawOutput(prompt) {
      return collectRpgRuntimeUpdateOutput(input, options, prompt, {
        temperature: 0,
        max_tokens: 1800,
        ...options.repairRequestOverrides,
      })
    },
  }
}

export function createLlmRpgRuntimeUpdateProposalAdapter(
  input: CreateLlmRpgRuntimeUpdateInteractionAdapterInput,
  options: LlmRpgRuntimeUpdateInteractionAdapterOptions = {},
): RpgRuntimeUpdateProposalAdapter {
  return {
    async generateRuntimeUpdateProposal(proposalInput: BuildRuntimeUpdateInteractionInput) {
      const prompt = runtimeUpdateInteractionSpec.buildPrompt(proposalInput)
      const output = await collectRpgRuntimeUpdateOutput(input, options, prompt)
      return runtimeUpdateInteractionSpec.parseOutput(output, proposalInput)
    },
  }
}

async function collectRpgRuntimeUpdateOutput(
  input: CreateLlmRpgRuntimeUpdateInteractionAdapterInput,
  options: LlmRpgRuntimeUpdateInteractionAdapterOptions,
  prompt: RpgInteractionPrompt,
  requestOverrides: RequestOverrides | undefined = options.requestOverrides,
): Promise<string> {
  let output = ""
  let streamError: Error | undefined

  try {
    await streamChat(
      input.llmConfig,
      [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt },
      ],
      {
        onToken(token) {
          output += token
        },
        onDone() {},
        onError(error) {
          streamError = error
        },
      },
      input.signal,
      requestOverrides,
    )
  } catch (error) {
    if (input.signal?.aborted) {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG runtime update LLM streaming error: ${message}`)
  }

  if (streamError) {
    throw new Error(`RPG runtime update LLM streaming error: ${streamError.message}`)
  }

  return output
}

import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat, type RequestOverrides } from "../../llm-client"
import type { RpgInteractionPrompt } from "../interaction-spec"
import type { RpgRuntimeUpdateInteractionAdapter } from "./runtime-update-adapter"

export interface CreateLlmRpgRuntimeUpdateInteractionAdapterInput {
  llmConfig: LlmConfig
  signal?: AbortSignal
}

export interface LlmRpgRuntimeUpdateInteractionAdapterOptions {
  requestOverrides?: RequestOverrides
}

export function createLlmRpgRuntimeUpdateInteractionAdapter(
  input: CreateLlmRpgRuntimeUpdateInteractionAdapterInput,
  options: LlmRpgRuntimeUpdateInteractionAdapterOptions = {},
): RpgRuntimeUpdateInteractionAdapter {
  return {
    async generateUpdateProposal(prompt) {
      return collectRpgRuntimeUpdateOutput(input, options, prompt)
    },
  }
}

async function collectRpgRuntimeUpdateOutput(
  input: CreateLlmRpgRuntimeUpdateInteractionAdapterInput,
  options: LlmRpgRuntimeUpdateInteractionAdapterOptions,
  prompt: RpgInteractionPrompt,
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
      options.requestOverrides,
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

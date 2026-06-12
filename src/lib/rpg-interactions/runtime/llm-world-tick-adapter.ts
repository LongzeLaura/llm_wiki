import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat, type RequestOverrides } from "../../llm-client"
import type { RpgWorldTickAdapter } from "./world-tick-adapter"
import {
  parseRpgWorldTickOutput,
  type RpgWorldTickPrompt,
  worldTickInteractionSpec,
} from "./world-tick-interaction"

export interface CreateLlmRpgWorldTickAdapterInput {
  llmConfig: LlmConfig
  signal?: AbortSignal
}

export interface LlmRpgWorldTickAdapterOptions {
  requestOverrides?: RequestOverrides
}

export function createLlmRpgWorldTickAdapter(
  input: CreateLlmRpgWorldTickAdapterInput,
  options: LlmRpgWorldTickAdapterOptions = {},
): RpgWorldTickAdapter {
  return {
    async advanceWorldTick(prompt, promptInput) {
      const output = await collectRpgWorldTickOutput(input, options, prompt)
      if (promptInput) return worldTickInteractionSpec.parseOutput(output, promptInput)
      return parseRpgWorldTickOutput(output)
    },
  }
}

async function collectRpgWorldTickOutput(
  input: CreateLlmRpgWorldTickAdapterInput,
  options: LlmRpgWorldTickAdapterOptions,
  prompt: RpgWorldTickPrompt,
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
    throw new Error(`RPG World Tick LLM streaming error: ${message}`)
  }

  if (streamError) {
    throw new Error(`RPG World Tick LLM streaming error: ${streamError.message}`)
  }

  return output
}

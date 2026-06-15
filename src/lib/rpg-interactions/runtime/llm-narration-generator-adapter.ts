import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat, type RequestOverrides } from "../../llm-client"
import type { RpgNarrationGeneratorAdapter } from "./narration-generator-adapter"
import {
  narrationGeneratorInteractionSpec,
  type RpgNarrationGeneratorPrompt,
} from "./narration-generator-interaction"

export interface CreateLlmRpgNarrationGeneratorAdapterInput {
  llmConfig: LlmConfig
  signal?: AbortSignal
}

export interface LlmRpgNarrationGeneratorAdapterOptions {
  requestOverrides?: RequestOverrides
  repairRequestOverrides?: RequestOverrides
}

export function createLlmRpgNarrationGeneratorAdapter(
  input: CreateLlmRpgNarrationGeneratorAdapterInput,
  options: LlmRpgNarrationGeneratorAdapterOptions = {},
): RpgNarrationGeneratorAdapter {
  return {
    async generateNarration(prompt, promptInput) {
      const output = await collectRpgNarrationGeneratorOutput(input, options, prompt)
      return narrationGeneratorInteractionSpec.parseOutput(output, promptInput)
    },
    async generateNarrationRawOutput(prompt) {
      return collectRpgNarrationGeneratorOutput(input, options, prompt)
    },
    async repairNarrationRawOutput(prompt) {
      return collectRpgNarrationGeneratorOutput(input, options, prompt, {
        temperature: 0,
        max_tokens: 1800,
        ...options.repairRequestOverrides,
      })
    },
  }
}

async function collectRpgNarrationGeneratorOutput(
  input: CreateLlmRpgNarrationGeneratorAdapterInput,
  options: LlmRpgNarrationGeneratorAdapterOptions,
  prompt: RpgNarrationGeneratorPrompt,
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
    throw new Error(`RPG Narration Generator LLM streaming error: ${message}`)
  }

  if (streamError) {
    throw new Error(`RPG Narration Generator LLM streaming error: ${streamError.message}`)
  }

  return output
}

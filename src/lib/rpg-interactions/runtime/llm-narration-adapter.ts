import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat, type RequestOverrides } from "../../llm-client"
import {
  narrationInteractionSpec,
  parseRpgNarrationOutput,
  type BuildRpgNarrationPromptInput,
  type RpgNarrationPrompt,
} from "./narration-interaction"
import type { RpgNarrationAdapter } from "./narration-adapter"

export interface CreateLlmRpgNarrationAdapterInput {
  llmConfig: LlmConfig
  signal?: AbortSignal
}

export interface LlmRpgNarrationAdapterOptions {
  requestOverrides?: RequestOverrides
}

export function createLlmRpgNarrationAdapter(
  input: CreateLlmRpgNarrationAdapterInput,
  options: LlmRpgNarrationAdapterOptions = {},
): RpgNarrationAdapter {
  return {
    async generateTurn(prompt, promptInput) {
      const output = await collectRpgNarrationOutput(input, options, prompt)
      return parseRpgNarrationAdapterOutput(output, promptInput)
    },
  }
}

function parseRpgNarrationAdapterOutput(
  output: string,
  promptInput?: BuildRpgNarrationPromptInput,
) {
  if (promptInput) return narrationInteractionSpec.parseOutput(output, promptInput)
  return parseRpgNarrationOutput(output)
}

async function collectRpgNarrationOutput(
  input: CreateLlmRpgNarrationAdapterInput,
  options: LlmRpgNarrationAdapterOptions,
  prompt: RpgNarrationPrompt,
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
    throw new Error(`RPG narration LLM streaming error: ${message}`)
  }

  if (streamError) {
    throw new Error(`RPG narration LLM streaming error: ${streamError.message}`)
  }

  return output
}

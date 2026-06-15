import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat, type RequestOverrides } from "../../llm-client"
import type { RpgRecallSelectorAdapter } from "./recall-selector-adapter"
import {
  recallSelectorInteractionSpec,
  type RpgRecallSelectorPrompt,
} from "./recall-selector-interaction"

export interface CreateLlmRpgRecallSelectorAdapterInput {
  llmConfig: LlmConfig
  signal?: AbortSignal
}

export interface LlmRpgRecallSelectorAdapterOptions {
  requestOverrides?: RequestOverrides
  repairRequestOverrides?: RequestOverrides
}

export function createLlmRpgRecallSelectorAdapter(
  input: CreateLlmRpgRecallSelectorAdapterInput,
  options: LlmRpgRecallSelectorAdapterOptions = {},
): RpgRecallSelectorAdapter {
  return {
    async selectRecall(prompt, promptInput) {
      const output = await collectRpgRecallSelectorOutput(input, options, prompt)
      return recallSelectorInteractionSpec.parseOutput(output, promptInput)
    },
    async selectRecallRawOutput(prompt) {
      return collectRpgRecallSelectorOutput(input, options, prompt)
    },
    async repairRecallRawOutput(prompt) {
      return collectRpgRecallSelectorOutput(input, options, prompt, {
        temperature: 0,
        max_tokens: 1800,
        ...options.repairRequestOverrides,
      })
    },
  }
}

async function collectRpgRecallSelectorOutput(
  input: CreateLlmRpgRecallSelectorAdapterInput,
  options: LlmRpgRecallSelectorAdapterOptions,
  prompt: RpgRecallSelectorPrompt,
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
    throw new Error(`RPG Recall Selector LLM streaming error: ${message}`)
  }

  if (streamError) {
    throw new Error(`RPG Recall Selector LLM streaming error: ${streamError.message}`)
  }

  return output
}

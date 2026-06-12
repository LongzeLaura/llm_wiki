import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat, type RequestOverrides } from "../../llm-client"
import type { RpgStoryOutlineRegeneratorAdapter } from "./story-outline-regenerator-adapter"
import {
  storyOutlineRegeneratorInteractionSpec,
  type RpgStoryOutlineRegeneratorPrompt,
} from "./story-outline-regenerator-interaction"

export interface CreateLlmRpgStoryOutlineRegeneratorAdapterInput {
  llmConfig: LlmConfig
  signal?: AbortSignal
}

export interface LlmRpgStoryOutlineRegeneratorAdapterOptions {
  requestOverrides?: RequestOverrides
}

export function createLlmRpgStoryOutlineRegeneratorAdapter(
  input: CreateLlmRpgStoryOutlineRegeneratorAdapterInput,
  options: LlmRpgStoryOutlineRegeneratorAdapterOptions = {},
): RpgStoryOutlineRegeneratorAdapter {
  return {
    async regenerateOutline(prompt, promptInput) {
      const output = await collectRpgStoryOutlineRegeneratorOutput(input, options, prompt)
      return storyOutlineRegeneratorInteractionSpec.parseOutput(output, promptInput)
    },
  }
}

async function collectRpgStoryOutlineRegeneratorOutput(
  input: CreateLlmRpgStoryOutlineRegeneratorAdapterInput,
  options: LlmRpgStoryOutlineRegeneratorAdapterOptions,
  prompt: RpgStoryOutlineRegeneratorPrompt,
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
    throw new Error(`RPG Story Outline Regenerator LLM streaming error: ${message}`)
  }

  if (streamError) {
    throw new Error(`RPG Story Outline Regenerator LLM streaming error: ${streamError.message}`)
  }

  return output
}

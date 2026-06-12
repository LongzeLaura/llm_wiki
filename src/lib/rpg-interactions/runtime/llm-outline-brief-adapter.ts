import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat, type RequestOverrides } from "../../llm-client"
import type { RpgOutlineBriefAdapter } from "./outline-brief-adapter"
import {
  outlineBriefInteractionSpec,
  type RpgOutlineBriefPrompt,
} from "./outline-brief-interaction"

export interface CreateLlmRpgOutlineBriefAdapterInput {
  llmConfig: LlmConfig
  signal?: AbortSignal
}

export interface LlmRpgOutlineBriefAdapterOptions {
  requestOverrides?: RequestOverrides
}

export function createLlmRpgOutlineBriefAdapter(
  input: CreateLlmRpgOutlineBriefAdapterInput,
  options: LlmRpgOutlineBriefAdapterOptions = {},
): RpgOutlineBriefAdapter {
  return {
    async compileOutlineBrief(prompt, promptInput) {
      const output = await collectRpgOutlineBriefOutput(input, options, prompt)
      return outlineBriefInteractionSpec.parseOutput(output, promptInput)
    },
  }
}

async function collectRpgOutlineBriefOutput(
  input: CreateLlmRpgOutlineBriefAdapterInput,
  options: LlmRpgOutlineBriefAdapterOptions,
  prompt: RpgOutlineBriefPrompt,
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
    throw new Error(`RPG Outline Brief LLM streaming error: ${message}`)
  }

  if (streamError) {
    throw new Error(`RPG Outline Brief LLM streaming error: ${streamError.message}`)
  }

  return output
}

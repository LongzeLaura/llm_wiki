import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat, type RequestOverrides } from "../../llm-client"
import {
  actionResolverInteractionSpec,
  parseRpgActionResolverOutput,
  type RpgActionResolverPrompt,
} from "./action-resolver-interaction"
import type { RpgActionResolverAdapter } from "./action-resolver-adapter"

export interface CreateLlmRpgActionResolverAdapterInput {
  llmConfig: LlmConfig
  signal?: AbortSignal
}

export interface LlmRpgActionResolverAdapterOptions {
  requestOverrides?: RequestOverrides
  repairRequestOverrides?: RequestOverrides
}

export function createLlmRpgActionResolverAdapter(
  input: CreateLlmRpgActionResolverAdapterInput,
  options: LlmRpgActionResolverAdapterOptions = {},
): RpgActionResolverAdapter {
  return {
    async resolveAction(prompt, promptInput) {
      const output = await collectRpgActionResolverOutput(input, options, prompt)
      if (promptInput) return actionResolverInteractionSpec.parseOutput(output, promptInput)
      return parseRpgActionResolverOutput(output)
    },
    async resolveActionRawOutput(prompt) {
      return collectRpgActionResolverOutput(input, options, prompt)
    },
    async repairActionResolutionRawOutput(prompt) {
      return collectRpgActionResolverOutput(input, options, prompt, {
        temperature: 0,
        max_tokens: 1800,
        ...options.repairRequestOverrides,
      })
    },
  }
}

async function collectRpgActionResolverOutput(
  input: CreateLlmRpgActionResolverAdapterInput,
  options: LlmRpgActionResolverAdapterOptions,
  prompt: RpgActionResolverPrompt,
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
    throw new Error(`RPG Action Resolver LLM streaming error: ${message}`)
  }

  if (streamError) {
    throw new Error(`RPG Action Resolver LLM streaming error: ${streamError.message}`)
  }

  return output
}

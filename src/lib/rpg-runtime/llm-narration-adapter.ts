import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat, type RequestOverrides } from "../llm-client"
import type { RpgNarrationPrompt } from "./narration-prompts"
import type { RpgNarrationAdapter } from "./narration-adapter"
import { validateRpgTurnResult } from "./narration-adapter"
import type { RpgTurnResult } from "./turn-model"

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
    async generateTurn(prompt) {
      const output = await collectRpgNarrationOutput(input, options, prompt)
      const parsed = parseRpgTurnResultJson(output)
      try {
        return validateRpgTurnResult(parsed)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`RPG narration adapter received invalid RpgTurnResult: ${message}`)
      }
    },
  }
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

  if (output.trim().length === 0) {
    throw new Error("RPG narration adapter received empty LLM output.")
  }

  return output
}

function parseRpgTurnResultJson(output: string): unknown {
  const jsonText = extractJsonObjectText(output)

  if (!jsonText) {
    throw new Error("RPG narration adapter could not find a JSON object in LLM output.")
  }

  try {
    return JSON.parse(jsonText) as RpgTurnResult
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`RPG narration adapter failed to parse RpgTurnResult JSON: ${message}`)
  }
}

function extractJsonObjectText(output: string): string | null {
  const fenced = extractFencedJsonCandidate(output)
  if (fenced !== null) {
    const fencedObject = findFirstBalancedJsonObject(fenced)
    if (fencedObject !== null) return fencedObject
  }

  return findFirstBalancedJsonObject(output)
}

function extractFencedJsonCandidate(output: string): string | null {
  const jsonFence = /```json\s*([\s\S]*?)```/i.exec(output)
  if (jsonFence) return jsonFence[1]

  const genericFence = /```\s*([\s\S]*?)```/.exec(output)
  return genericFence?.[1] ?? null
}

function findFirstBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{")
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === "\\") {
        escaped = true
      } else if (char === "\"") {
        inString = false
      }
      continue
    }

    if (char === "\"") {
      inString = true
      continue
    }

    if (char === "{") {
      depth += 1
    } else if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, index + 1)
      }
    }
  }

  return null
}

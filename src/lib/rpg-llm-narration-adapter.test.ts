import { afterEach, describe, expect, it, vi } from "vitest"
import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat } from "./llm-client"
import {
  createLlmRpgNarrationAdapter,
  type RpgNarrationPrompt,
} from "./rpg-interactions/runtime"
import {
  type CompactStoryBrief,
  type RpgTurnResult,
} from "./rpg-runtime"

vi.mock("./llm-client", () => ({
  streamChat: vi.fn(),
}))

const streamChatMock = vi.mocked(streamChat)

afterEach(() => {
  streamChatMock.mockReset()
})

describe("LLM RPG Narration Adapter", () => {
  it("turns an RPG narration prompt into system and user messages", async () => {
    const signal = new AbortController().signal
    const requestOverrides = { temperature: 0.2, max_tokens: 1200 }
    mockStreamOutput(JSON.stringify(sampleTurnResult()))

    await createLlmRpgNarrationAdapter({ llmConfig: sampleLlmConfig(), signal }, { requestOverrides }).generateTurn(
      samplePrompt(),
    )

    expect(streamChatMock).toHaveBeenCalledWith(
      sampleLlmConfig(),
      [
        { role: "system", content: "System narration instructions." },
        { role: "user", content: "User compact story brief." },
      ],
      expect.objectContaining({
        onToken: expect.any(Function),
        onDone: expect.any(Function),
        onError: expect.any(Function),
      }),
      signal,
      requestOverrides,
    )
  })

  it("parses pure JSON output into a valid RpgTurnResult", async () => {
    const turnResult = sampleTurnResult()
    mockStreamOutput(JSON.stringify(turnResult))

    await expect(generateFromMockedStream()).resolves.toEqual(turnResult)
  })

  it("parses fenced JSON output", async () => {
    const turnResult = sampleTurnResult({ narrative: "The sigil answers from inside a fenced block." })
    mockStreamOutput(["```json\n", JSON.stringify(turnResult, null, 2), "\n```"])

    await expect(generateFromMockedStream()).resolves.toEqual(turnResult)
  })

  it("parses a JSON object surrounded by short explanatory text", async () => {
    const turnResult = sampleTurnResult({ narrative: "The answer sits between two bits of prose." })
    mockStreamOutput(["Here is the turn result:\n\n", JSON.stringify(turnResult), "\n\nDone."])

    await expect(generateFromMockedStream()).resolves.toEqual(turnResult)
  })

  it("reports empty LLM output clearly", async () => {
    mockStreamOutput("")

    await expect(generateFromMockedStream()).rejects.toThrow(/empty LLM output/i)
  })

  it("reports missing JSON object clearly", async () => {
    mockStreamOutput("I cannot produce the requested structure.")

    await expect(generateFromMockedStream()).rejects.toThrow(/could not find a JSON object/i)
  })

  it("reports invalid JSON syntax clearly", async () => {
    mockStreamOutput('{ "narrative": "Broken", "nextActionOptions": }')

    await expect(generateFromMockedStream()).rejects.toThrow(/failed to parse RpgTurnResult JSON/i)
  })

  it("routes malformed RpgTurnResult JSON through validateRpgTurnResult", async () => {
    mockStreamOutput(
      JSON.stringify({
        narrative: "This has too few options.",
        nextActionOptions: [],
        references: [],
      }),
    )

    await expect(generateFromMockedStream({ brief: sampleBrief() })).rejects.toThrow(
      /RPG narration interaction received invalid RpgTurnResult/i,
    )
  })

  it("reports streaming errors clearly", async () => {
    streamChatMock.mockImplementationOnce(async (_config, _messages, callbacks) => {
      callbacks.onError(new Error("model offline"))
    })

    await expect(generateFromMockedStream()).rejects.toThrow(/LLM streaming error: model offline/i)
  })
})

async function generateFromMockedStream(promptInput?: { brief: CompactStoryBrief }): Promise<RpgTurnResult> {
  return createLlmRpgNarrationAdapter({ llmConfig: sampleLlmConfig() }).generateTurn(samplePrompt(), promptInput)
}

function mockStreamOutput(output: string | string[]): void {
  const chunks = Array.isArray(output) ? output : [output]
  streamChatMock.mockImplementationOnce(async (_config, _messages, callbacks) => {
    for (const chunk of chunks) callbacks.onToken(chunk)
    callbacks.onDone()
  })
}

function samplePrompt(): RpgNarrationPrompt {
  return {
    systemPrompt: "System narration instructions.",
    userPrompt: "User compact story brief.",
  }
}

function sampleLlmConfig(): LlmConfig {
  return {
    provider: "openai",
    apiKey: "test-key",
    model: "test-model",
    ollamaUrl: "http://localhost:11434",
    customEndpoint: "",
    maxContextSize: 204800,
  }
}

function sampleBrief(): CompactStoryBrief {
  return {
    submittedAction: {
      id: "freeform-1",
      text: "Check the glowing sigil before opening the gate.",
      source: "freeform",
    },
    currentScene: "Iven and Mira face the canal gate.",
    playerState: "Iven carries a brass lantern key.",
    hardFacts: [],
    activeConstraints: [],
    presentCharacters: [],
    relationshipTensions: [],
    activePlotPressure: [],
    outlineNotes: [],
    activeQuests: [],
    relevantLocations: [],
    relevantFactions: [],
    relevantItems: [],
    styleRules: [],
    ruleNotes: [],
    memoryNotes: [],
    forbiddenContradictions: [],
    references: ["wiki/current-scene/scene_state.md"],
  }
}

function sampleTurnResult(overrides: Partial<RpgTurnResult> = {}): RpgTurnResult {
  return {
    narrative: "Mira studies the sigil while the lantern key warms in Iven's palm.",
    nextActionOptions: [
      {
        id: "opt-touch-key",
        playerFacingText: "Touch the lantern key to the lowest sigil.",
        intent: "use_item",
        riskLevel: "medium",
        likelyAffectedPaths: ["wiki/current-scene/scene_state.md", "wiki/items/runtime/lantern-key.md"],
      },
      {
        id: "opt-ask-mira",
        playerFacingText: "Ask Mira what the glowing tooth means.",
        intent: "talk",
        riskLevel: "low",
        likelyAffectedPaths: ["wiki/relationships/iven-mira.md"],
      },
      {
        id: "opt-force-gate",
        playerFacingText: "Force the canal gate before the patrol returns.",
        intent: "fight",
        riskLevel: "high",
        likelyAffectedPaths: ["wiki/current-scene/scene_state.md", "wiki/events/session-03.md"],
      },
    ],
    references: ["wiki/current-scene/scene_state.md", "wiki/player/player.md"],
    ...overrides,
  }
}

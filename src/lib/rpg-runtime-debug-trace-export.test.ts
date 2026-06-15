import { describe, expect, it } from "vitest"
import {
  buildRpgRuntimeDebugTraceExportFileName,
  serializeRpgRuntimeDebugTraceForExport,
} from "./rpg-runtime/debug-trace-export"
import type { RpgRuntimeDebugTrace } from "./rpg-runtime/debug-trace"

describe("RPG runtime debug trace export", () => {
  it("serializes a versioned payload with exportedAt and trace", () => {
    const trace = sampleTrace("trace-one")

    const serialized = serializeRpgRuntimeDebugTraceForExport(trace, "2026-06-13T00:00:00.000Z")
    const payload = JSON.parse(serialized)

    expect(serialized.endsWith("\n")).toBe(true)
    expect(payload).toMatchObject({
      version: 1,
      exportedAt: "2026-06-13T00:00:00.000Z",
      trace: {
        traceId: "trace-one",
        submittedActionText: "Inspect the sigil.",
        steps: [
          {
            formatRecoveryApplied: true,
            localRepairOperations: ["removed_trailing_commas"],
            repairRetryAttempted: false,
          },
        ],
      },
    })
  })

  it("builds a safe JSON filename from the trace id", () => {
    expect(buildRpgRuntimeDebugTraceExportFileName(sampleTrace("rpg-runtime-trace-turn/with:key*"))).toBe(
      "rpg-runtime-trace-turn-with-key.json",
    )
    expect(buildRpgRuntimeDebugTraceExportFileName(sampleTrace("///"))).toBe("rpg-runtime-trace-trace.json")
  })

  it("redacts sensitive keys without mutating the in-memory trace", () => {
    const trace = {
      ...sampleTrace("sensitive-trace"),
      apiKey: "openai-key",
      nested: {
        authorization: "Bearer secret",
        headers: { "x-api-key": "secret" },
        token: "session-token",
        estimatedTokens: 42,
      },
      steps: [
        {
          ...sampleTrace("sensitive-trace").steps[0],
          password: "hunter2",
        },
      ],
    } as unknown as RpgRuntimeDebugTrace & {
      apiKey: string
      nested: {
        authorization: string
        headers: Record<string, string>
        token: string
        estimatedTokens: number
      }
    }

    const payload = JSON.parse(serializeRpgRuntimeDebugTraceForExport(trace, "2026-06-13T00:00:00.000Z"))

    expect(payload.trace.apiKey).toBe("[redacted]")
    expect(payload.trace.nested.authorization).toBe("[redacted]")
    expect(payload.trace.nested.headers).toBe("[redacted]")
    expect(payload.trace.nested.token).toBe("[redacted]")
    expect(payload.trace.nested.estimatedTokens).toBe(42)
    expect(payload.trace.steps[0].password).toBe("[redacted]")
    expect(trace.apiKey).toBe("openai-key")
    expect(trace.nested.headers).toEqual({ "x-api-key": "secret" })
  })
})

function sampleTrace(traceId: string): RpgRuntimeDebugTrace {
  return {
    traceId,
    turnId: "turn-1",
    submittedActionId: "action-1",
    submittedActionText: "Inspect the sigil.",
    status: "succeeded",
    startedAt: "2026-06-13T00:00:00.000Z",
    endedAt: "2026-06-13T00:00:01.000Z",
    steps: [
      {
        stepId: "action_resolver",
        label: "Action Resolver",
        kind: "llm_interaction",
        status: "succeeded",
        inputSections: [],
        promptSections: [],
        validationSections: [],
        handoffSections: [],
        warnings: [],
        formatRecoveryApplied: true,
        localRepairOperations: ["removed_trailing_commas"],
        looseCoercions: [
          {
            label: "ActionResolutionDraft.playerActionDelta.notes",
            message: "ActionResolutionDraft.playerActionDelta.notes: accepted a string as a single-item string array.",
          },
        ],
        repairRetryAttempted: false,
        repairRetrySucceeded: false,
      },
    ],
    warnings: [],
  }
}

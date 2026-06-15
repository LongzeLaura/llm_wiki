import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createFixtureNarrationGeneratorAdapter,
  createFixtureOutlineBriefAdapter,
  createFixtureRecallSelectorAdapter,
  createFixtureRuntimeUpdateInteractionAdapter,
  createFixtureWorldTickAdapter,
  type RpgActionResolverAdapter,
} from "./rpg-interactions/runtime"
import { buildRuntimeFormattingAuditReport } from "./rpg-runtime/formatting-audit"
import {
  createRpgRuntimeDebugSection,
  createRpgRuntimeDebugTraceStore,
  type RpgRuntimeDebugTrace,
} from "./rpg-runtime/debug-trace"
import { runRpgRuntimeTurnFlow } from "./rpg-runtime/runtime-controller"
import type { SubmittedAction } from "./rpg-runtime/types"
import { RPG_SCHEMA_SLOTS } from "./rpg-wiki-schema"
import {
  sampleActionResolution,
  sampleOutlineBriefOutput,
  sampleRecallSelection,
  sampleTurnNarration,
  sampleWorldTickResult,
} from "./rpg-runtime-test-fixtures"
import { createTempProject, writeFileRaw } from "@/test-helpers/fs-temp"

vi.mock("@/commands/fs", async () => {
  const { realFs } = await import("@/test-helpers/fs-temp")
  return realFs
})

interface Ctx {
  tmp: { path: string; cleanup: () => Promise<void> }
}

let ctx: Ctx | undefined

afterEach(async () => {
  if (ctx) {
    await ctx.tmp.cleanup()
    ctx = undefined
  }
})

describe("RPG runtime formatting audit", () => {
  it("builds an audit report from a successful mocked full-flow trace", async () => {
    const trace = await runSuccessfulMockedTrace("audit-success")
    const report = buildRuntimeFormattingAuditReport({ realTrace: trace })

    expect(report.realTraceId).toBe(trace.traceId)
    expect(report.runtimeFormattingAudit.map((row) => row.stepId)).toEqual(trace.steps.map((step) => step.stepId))
    expect(report.runtimeFormattingAudit.every((row) => row.measurementKind === "real")).toBe(true)
    expect(report.runtimeFormattingAudit.every((row) => row.state === "executed")).toBe(true)

    const actionResolver = report.runtimeFormattingAudit.find((row) => row.stepId === "action_resolver")
    expect(actionResolver?.areaTotals.promptChars).toBeGreaterThan(0)
    expect(actionResolver?.areaTotals.inputAssemblyChars).toBeGreaterThan(0)
    expect(actionResolver?.topPromptSections.length).toBeGreaterThan(0)
    expect(actionResolver?.topInputAssemblyContributors.length).toBeGreaterThan(0)
    expect(actionResolver?.formatRecovery.formatRecoveryApplied).toBe(false)
    expect(report.formatRecoveryMetrics.find((row) => row.stepId === "action_resolver")?.traceCount).toBe(1)
  })

  it("compares a failed real trace with a synthetic full-flow trace without faking real later-step costs", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-audit-failed-real") }
    await writeTurnFixture(ctx.tmp.path)
    const submittedAction = sampleSubmittedAction("audit-failed-real")
    const store = createRpgRuntimeDebugTraceStore()
    const actionResolverAdapter: RpgActionResolverAdapter = {
      async resolveAction() {
        return sampleActionResolution(submittedAction)
      },
      async resolveActionRawOutput() {
        return "{\"resolutionId\":\"bad-action\"}"
      },
    }

    await expect(
      runRpgRuntimeTurnFlow({
        projectPath: ctx.tmp.path,
        submittedAction,
        wikiMode: "llmwikirpg",
        actionResolverAdapter,
        worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
        recallSelectorAdapter: createFixtureRecallSelectorAdapter(
          sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
        ),
        outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
        narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
        updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
        debugTraceSink: store,
      }),
    ).rejects.toThrow(/invalid|expected|required/i)

    const failedTrace = store.getLastTrace()
    const syntheticTrace = await runSuccessfulMockedTrace("audit-synthetic")
    const report = buildRuntimeFormattingAuditReport({
      realTrace: failedTrace,
      syntheticTrace,
    })

    const realAction = report.runtimeFormattingAudit.find(
      (row) => row.measurementKind === "real" && row.stepId === "action_resolver",
    )
    const realWorldTick = report.runtimeFormattingAudit.find(
      (row) => row.measurementKind === "real" && row.stepId === "world_tick",
    )
    const syntheticWorldTick = report.runtimeFormattingAudit.find(
      (row) => row.measurementKind === "synthetic" && row.stepId === "world_tick",
    )

    expect(realAction?.state).toBe("failed")
    expect(realAction?.failureFrontier).toBe("draft_validation_failure")
    expect(realWorldTick?.state).toBe("blocked_by_previous_failure")
    expect(realWorldTick?.areaTotals.promptChars).toBe(0)
    expect(syntheticWorldTick?.state).toBe("synthetic")
    expect(syntheticWorldTick?.areaTotals.promptChars).toBeGreaterThan(0)
    expect(report.notes.join("\n")).toContain("Synthetic rows")
  })

  it("sorts top prompt and input assembly contributors by character count", () => {
    const store = createRpgRuntimeDebugTraceStore()
    store.startTrace({ submittedAction: sampleSubmittedAction("audit-sort") })
    store.startStep("world_tick")
    store.addStepSection("world_tick", "promptSections", debugSection("short-prompt", "Short", "short"))
    store.addStepSection("world_tick", "promptSections", debugSection("long-prompt", "Long", "x".repeat(80)))
    store.addStepSection("world_tick", "inputSections", debugSection("medium-input", "Medium", "x".repeat(20)))
    store.addStepSection("world_tick", "inputSections", debugSection("long-input", "Long", "x".repeat(40)))
    store.finishStep("world_tick")
    store.finishTrace("succeeded")

    const row = buildRuntimeFormattingAuditReport({
      realTrace: store.getLastTrace(),
      topContributorLimit: 2,
    }).runtimeFormattingAudit.find((entry) => entry.stepId === "world_tick")

    expect(row?.topPromptSections.map((section) => section.sectionId)).toEqual(["long-prompt", "short-prompt"])
    expect(row?.topInputAssemblyContributors.map((section) => section.sectionId)).toEqual(["long-input", "medium-input"])
  })

  it("classifies parse and validation failure frontiers", () => {
    const parseTrace = failedSingleStepTrace("runtime_update_proposal", "not json", "parse")
    const validationTrace = failedSingleStepTrace("narration_generator", "Invalid TurnNarration.playerFacingText", "validation")

    const parseRow = buildRuntimeFormattingAuditReport({ realTrace: parseTrace }).runtimeFormattingAudit.find(
      (row) => row.stepId === "runtime_update_proposal",
    )
    const validationRow = buildRuntimeFormattingAuditReport({ realTrace: validationTrace }).runtimeFormattingAudit.find(
      (row) => row.stepId === "narration_generator",
    )

    expect(parseRow?.failureFrontier).toBe("mechanical_format_failure")
    expect(validationRow?.failureFrontier).toBe("canonical_validation_failure")
  })

  it("includes per-step format recovery summaries and aggregate metrics", () => {
    const recoveredTrace = recoveredSingleStepTrace("audit-recovered")
    const failedRetryTrace = failedRepairRetryTrace("audit-retry-failed")
    const report = buildRuntimeFormattingAuditReport({
      realTrace: recoveredTrace,
      syntheticTrace: failedRetryTrace,
    })

    const recoveredRow = report.runtimeFormattingAudit.find(
      (row) => row.traceId === recoveredTrace.traceId && row.stepId === "action_resolver",
    )
    const failedRetryRow = report.runtimeFormattingAudit.find(
      (row) => row.traceId === failedRetryTrace.traceId && row.stepId === "action_resolver",
    )
    const metrics = report.formatRecoveryMetrics.find((row) => row.stepId === "action_resolver")

    expect(recoveredRow?.formatRecovery).toMatchObject({
      formatRecoveryApplied: true,
      localRepairOperations: ["removed_trailing_commas"],
      looseCoercionCount: 1,
      repairRetryAttempted: false,
    })
    expect(failedRetryRow?.formatRecovery).toMatchObject({
      repairRetryAttempted: true,
      repairRetrySucceeded: false,
      repairRetryFailureSummary: "RPG Action Resolver 交互解析 JSON 失败：Unexpected token",
    })
    expect(metrics).toMatchObject({
      traceCount: 2,
      formatRecoveryAppliedCount: 1,
      localRepairOperationCount: 1,
      looseCoercionCount: 1,
      repairRetryAttemptedCount: 1,
      repairRetrySucceededCount: 0,
      repairRetryFailedCount: 1,
    })
  })
})

async function runSuccessfulMockedTrace(id: string): Promise<RpgRuntimeDebugTrace> {
  const tmp = await createTempProject(`rpg-runtime-${id}`)
  try {
    await writeTurnFixture(tmp.path)
    const submittedAction = sampleSubmittedAction(id)
    const store = createRpgRuntimeDebugTraceStore()

    await runRpgRuntimeTurnFlow({
      projectPath: tmp.path,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter(submittedAction),
      worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(
        sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
      ),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleEmptyRuntimeUpdateProposalOutput()),
      debugTraceSink: store,
    })

    return store.getLastTrace()!
  } finally {
    await tmp.cleanup()
  }
}

function failedSingleStepTrace(
  stepId: "runtime_update_proposal" | "narration_generator",
  message: string,
  phase: "parse" | "validation",
): RpgRuntimeDebugTrace {
  const store = createRpgRuntimeDebugTraceStore()
  store.startTrace({ submittedAction: sampleSubmittedAction(`audit-${stepId}-${phase}`) })
  store.startStep(stepId)
  store.addStepSection(stepId, "rawOutput", debugSection(`${stepId}-raw`, "Raw", message))
  store.failStep(stepId, new Error(message), phase)
  store.finishTrace("failed")
  return store.getLastTrace()!
}

function recoveredSingleStepTrace(id: string): RpgRuntimeDebugTrace {
  const store = createRpgRuntimeDebugTraceStore()
  store.startTrace({ submittedAction: sampleSubmittedAction(id) })
  store.startStep("action_resolver")
  store.recordStepLocalJsonRecovery("action_resolver", {
    operations: ["removed_trailing_commas"],
    changed: true,
  })
  store.recordStepLooseCoercions("action_resolver", [
    {
      code: "loose_draft_coercion",
      message: "ActionResolutionDraft.playerActionDelta.notes: accepted a string as a single-item string array.",
      severity: "warning",
    },
  ])
  store.finishStep("action_resolver")
  store.finishTrace("succeeded")
  return store.getLastTrace()!
}

function failedRepairRetryTrace(id: string): RpgRuntimeDebugTrace {
  const store = createRpgRuntimeDebugTraceStore()
  store.startTrace({ submittedAction: sampleSubmittedAction(id) })
  store.startStep("action_resolver")
  store.recordStepRepairRetry("action_resolver", {
    attempted: true,
    succeeded: false,
    failureSummary: "RPG Action Resolver 交互解析 JSON 失败：Unexpected token",
  })
  store.failStep("action_resolver", new Error("RPG Action Resolver 交互解析 JSON 失败：Unexpected token"), "parse")
  store.finishTrace("failed")
  return store.getLastTrace()!
}

function debugSection(sectionId: string, title: string, content: string) {
  return createRpgRuntimeDebugSection({
    sectionId,
    title,
    sourceKind: "runtime_handoff",
    sourceLabel: "test",
    contentType: "text",
    content,
  })
}

function sampleSubmittedAction(id: string): SubmittedAction {
  return {
    id,
    text: "Ask Mira to inspect the canal gate sigil before I use the lantern key.",
    source: "freeform",
  }
}

function sampleActionResolverAdapter(submittedAction: SubmittedAction): RpgActionResolverAdapter {
  return {
    async resolveAction() {
      return sampleActionResolution(submittedAction)
    },
  }
}

function sampleEmptyRuntimeUpdateProposalOutput(): string {
  return JSON.stringify({
    proposedWikiUpdates: [],
    outlineRevisionReviewItems: [],
    journalEntries: [],
    skippedDeltas: [],
    pacingUpdateProposal: null,
    warnings: [],
  })
}

async function writeTurnFixture(projectPath: string): Promise<void> {
  await Promise.all(
    RPG_SCHEMA_SLOTS.map((slot) =>
      writeFileRaw(`${projectPath}/${slot.path}`, `# ${slot.slotId}\n\nTest fixture slot.`),
    ),
  )
  await writeFileRaw(
    `${projectPath}/wiki/current-scene/scene_state.md`,
    "# Current Scene\n\nIven and Mira are beneath the River Port, facing a locked canal gate.",
  )
  await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Iven\n\nSmuggler-mage carrying a brass lantern key.")
}

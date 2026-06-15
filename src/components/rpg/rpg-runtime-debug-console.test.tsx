import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  RpgRuntimeDebugConsole,
  selectRpgRuntimeDebugConsoleExportTrace,
} from "./rpg-runtime-debug-console"
import {
  createRpgRuntimeDebugSection,
  createRpgRuntimeDebugTraceStore,
  type RpgRuntimeDebugTrace,
} from "@/lib/rpg-runtime/debug-trace"

describe("RpgRuntimeDebugConsole", () => {
  it("disables export when there is no current or last trace", () => {
    const html = renderToStaticMarkup(
      <RpgRuntimeDebugConsole currentTrace={null} lastTrace={null} onExportTrace={() => undefined} />,
    )

    expect(html).toContain("导出")
    expect(html).toContain("aria-label=\"导出 trace JSON\"")
    expect(html).toContain("disabled")
  })

  it("renders top-level debug rows collapsed by default", () => {
    const trace = sampleTrace()

    const html = renderToStaticMarkup(
      <RpgRuntimeDebugConsole currentTrace={null} lastTrace={trace} />,
    )

    expect(html).toContain("调试控制台")
    expect(html).toContain("上一次 trace")
    expect(html).toContain("行动裁定")
    expect(html).toContain("提示词：")
    expect(html).not.toContain("open=\"\"")
    expect(html).not.toContain("格式恢复：")
  })

  it("renders nested sections when a step and section are expanded", () => {
    const trace = sampleTrace()

    const html = renderToStaticMarkup(
      <RpgRuntimeDebugConsole
        currentTrace={trace}
        lastTrace={null}
        defaultExpandedStepIds={["action_resolver"]}
        defaultExpandedSectionIds={["action_resolver:prompt"]}
      />,
    )

    expect(html).toContain("当前 trace")
    expect(html).toContain("open=\"\"")
    expect(html).toContain("输入组装")
    expect(html).toContain("系统提示词")
    expect(html).toContain("原始输出")
    expect(html).toContain("{&quot;resolutionId&quot;:&quot;debug&quot;}")
  })

  it("renders export, persistence controls, and persisted trace summaries", () => {
    const trace = sampleTrace()

    const html = renderToStaticMarkup(
      <RpgRuntimeDebugConsole
        currentTrace={null}
        lastTrace={trace}
        onExportTrace={() => undefined}
        persistencePolicy={{ enabled: true, maxTraces: 10 }}
        onPersistencePolicyChange={() => undefined}
        persistedTraces={[trace]}
        selectedPersistedTraceId={trace.traceId}
        onSelectPersistedTrace={() => undefined}
        onClearSaved={() => undefined}
      />,
    )

    expect(html).toContain("导出")
    expect(html).toContain("持久化")
    expect(html).toContain("保留数量")
    expect(html).toContain("清除已保存")
    expect(html).toContain("已保存 trace")
    expect(html).toContain(trace.traceId)
    expect(html).toContain("查看")
  })

  it("renders the repair retry toggle off by default and checked when enabled", () => {
    const defaultHtml = renderToStaticMarkup(
      <RpgRuntimeDebugConsole currentTrace={null} lastTrace={null} />,
    )
    const enabledHtml = renderToStaticMarkup(
      <RpgRuntimeDebugConsole
        currentTrace={null}
        lastTrace={null}
        repairRetryEnabled
        onRepairRetryEnabledChange={() => undefined}
      />,
    )

    expect(defaultHtml).toContain("修复重试")
    expect(defaultHtml).not.toContain("checked=\"\"")
    expect(enabledHtml).toContain("修复重试")
    expect(enabledHtml).toContain("checked=\"\"")
  })

  it("exports the selected persisted trace when that is the displayed trace", () => {
    const lastTrace = sampleTrace("last-trace")
    const selectedPersistedTrace = sampleTrace("persisted-trace")

    expect(selectRpgRuntimeDebugConsoleExportTrace({
      currentTrace: null,
      selectedPersistedTrace,
      lastTrace: null,
    })).toBe(selectedPersistedTrace)
    expect(selectRpgRuntimeDebugConsoleExportTrace({
      currentTrace: null,
      selectedPersistedTrace,
      lastTrace,
    })).toBe(selectedPersistedTrace)
  })

  it("renders compact format recovery summary only when recovery is present", () => {
    const trace = sampleTraceWithFormatRecovery()

    const html = renderToStaticMarkup(
      <RpgRuntimeDebugConsole
        currentTrace={null}
        lastTrace={trace}
        defaultExpandedStepIds={["action_resolver"]}
        defaultExpandedSectionIds={["action_resolver:formatRecovery"]}
      />,
    )

    expect(html).toContain("格式恢复：本地修复 1 / 宽松转换 1 / 重试成功 0 / 重试失败 1")
    expect(html).toContain("修复重试失败")
    expect(html).toContain("removed_trailing_commas")
    expect(html).toContain("ActionResolutionDraft.playerActionDelta.notes")
    expect(html).toContain("RPG Action Resolver 交互解析 JSON 失败")
  })
})

function sampleTrace(traceId = "debug-turn"): RpgRuntimeDebugTrace {
  const store = createRpgRuntimeDebugTraceStore()
  store.startTrace({
    submittedAction: {
      id: traceId,
      text: "Inspect the sigil.",
      source: "freeform",
    },
  })
  store.startStep("action_resolver")
  store.addStepSection(
    "action_resolver",
    "inputSections",
    createRpgRuntimeDebugSection({
      sectionId: "input",
      title: "输入组装",
      sourceKind: "local_input_builder",
      sourceLabel: "buildActionResolverInputFromWiki",
      contentType: "json",
      content: "{\"submittedAction\":\"Inspect the sigil.\"}",
    }),
  )
  store.addStepSection(
    "action_resolver",
    "promptSections",
    createRpgRuntimeDebugSection({
      sectionId: "system",
      title: "系统提示词",
      sourceKind: "fixed_prompt",
      sourceLabel: "systemPrompt",
      contentType: "text",
      content: "Resolve the action.",
    }),
  )
  store.addStepSection(
    "action_resolver",
    "rawOutput",
    createRpgRuntimeDebugSection({
      sectionId: "raw",
      title: "原始输出",
      sourceKind: "llm_output",
      sourceLabel: "adapter",
      contentType: "json",
      content: "{\"resolutionId\":\"debug\"}",
    }),
  )
  store.finishStep("action_resolver")
  store.finishTrace("succeeded")
  const trace = store.getLastTrace()
  if (!trace) throw new Error("Expected sample trace.")
  return trace
}

function sampleTraceWithFormatRecovery(): RpgRuntimeDebugTrace {
  const store = createRpgRuntimeDebugTraceStore()
  store.startTrace({
    submittedAction: {
      id: "debug-format-recovery",
      text: "Inspect the sigil.",
      source: "freeform",
    },
  })
  store.startStep("action_resolver")
  store.recordStepLocalJsonRecovery("action_resolver", {
    operations: ["removed_trailing_commas"],
    changed: true,
  })
  store.recordStepLooseCoercions("action_resolver", [
    "loose_draft_coercion: ActionResolutionDraft.playerActionDelta.notes: accepted a string as a single-item string array.",
  ])
  store.recordStepRepairRetry("action_resolver", {
    attempted: true,
    succeeded: false,
    failureSummary: "RPG Action Resolver 交互解析 JSON 失败：Unexpected token",
  })
  store.failStep("action_resolver", new Error("RPG Action Resolver 交互解析 JSON 失败：Unexpected token"), "parse")
  store.finishTrace("failed")
  const trace = store.getLastTrace()
  if (!trace) throw new Error("Expected sample recovery trace.")
  return trace
}

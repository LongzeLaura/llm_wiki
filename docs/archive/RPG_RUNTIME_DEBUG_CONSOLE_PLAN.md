# RPG Runtime 调试控制台计划

## 目标

构建一个专用的 Runtime 调试控制台，将运行时实时进度、逐步 prompt、LLM 原始输出、解析结果、校验结果、警告、耗时和预估 token 数统一汇总到一个可检查的界面中。

这个控制台用于在游玩过程中测试和调试 runtime 行为。它应当能够让人一眼看出当前正在运行哪个 runtime 阶段、哪个阶段失败了、发送了什么 prompt、返回了什么输出，以及哪些数据正在传递给下一个阶段。

## 当前实施状态

截至 2026-06-13，本计划的 Phase 1、Phase 2、Phase 3、Phase 4 和 Phase 5 已完成首版落地。

已完成内容：

- 新增浏览器安全的 runtime debug trace 数据模型和会话内存 store，入口位于 `src/lib/rpg-runtime/debug-trace.ts`。
- 新增 `estimatePromptTokens()`，采用 `mixed-char-estimate-v1` 估算公式，仅用于 Debug Console 展示，不影响 runtime 行为。
- 为 `runRpgTurn()` / `runRpgRuntimeTurnFlow()` 接入可选 `debugTraceSink`，按 runtime 一级阶段实时记录状态、时间、prompt、raw output、parsed output、validation、warnings 和失败摘要。
- 当前已覆盖一级阶段：`action_resolver`、`world_tick`、`recall_selector`、`outline_brief`、可选/跳过的 `story_outline_regenerator`、`narration_generator`、`runtime_update_proposal`、确定性的 `runtime_update_validation`、`pending_update_persistence`。
- 本地 input builder 仍归入所属阶段的 `Input Assembly` / `Handoff / Next Input` 分区，没有作为独立顶层模块展示。
- Prompt 捕获已升级为 Phase 3 范围内的结构化 `debugSections`。LLM adapter 继续使用原始 `systemPrompt` / `userPrompt` 字符串；Debug Console trace 优先展示语义化 prompt 分段，并保留粗粒度 `System Prompt` / `User Prompt` 作为非结构化 prompt fallback。
- Trace 细节已升级到 Phase 4 范围：parsed output 保留完整 JSON 并补充摘要 section；validation success / warnings / parse 或 validation failure 分开记录；本地 builder 增加 `Wiki Inputs / Source Paths`；重要 handoff 增加摘要。
- 新增 `src/components/rpg/rpg-runtime-debug-console.tsx`，并在 `RpgRuntimePanel` 中增加 `Play / Debug` 入口；Debug Console 读取当前运行 trace 和最近一次 trace，并支持手动清空。
- 新增 `src/lib/rpg-runtime/debug-trace-export.ts`，支持单条 trace JSON 手动导出，导出 payload 为 `{ version: 1, exportedAt, trace }`，文件名为 `rpg-runtime-trace-${safeTraceId}.json`，并递归遮蔽敏感 key：`apiKey`、`authorization`、`headers`、`secret`、`token`、`password`。
- 新增 `src/lib/rpg-runtime/debug-trace-persistence-client.ts`，支持将最近 N 条 trace 显式保存到 `${normalizedProjectPath}/.llm-wiki/runtime/debug-traces/`，读取 saved traces，以及只清空该目录下的 trace JSON 文件。
- Debug Console 新增 `Export`、`Persist`、`Retention 5 / 10 / 20`、saved traces 列表和 `Clear Saved`。最近 N 条持久化默认关闭，只有用户显式打开 `Persist` 后才保存完成态 trace。
- debug trace 仍不会写入 `wiki/`，不会改变 runtime 行为、wiki 写入策略、pending review / apply 边界，也不会触发 pending update apply。

实现中记录的基线差异：

- 计划预期 raw output 可在 orchestrator / adapter 边界捕获；实际代码中多数已有 RPG LLM adapter 原本只返回 parsed object。因此本次在 RPG adapter 接口上增加可选 raw-output 方法，并在真实 LLM adapter 中实现，避免把 trace 首选埋入低层通用 LLM client。
- pending queue 的 `savePendingUpdates` 当前由 `submitRpgRuntimePanelAction()` 在 `runRpgRuntimeTurnFlow()` 返回后执行。因此 `pending_update_persistence` step 同时记录 controller 内的 staging / journal persistence，以及 panel helper 追加的 pending queue 保存 handoff。

本次验证结果：

- `npm.cmd run typecheck` 通过。
- `npx.cmd vitest run src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-runtime-debug-trace-export.test.ts src/lib/rpg-runtime-debug-trace-persistence-client.test.ts src/components/rpg/rpg-runtime-debug-console.test.tsx src/components/rpg/rpg-runtime-panel.test.tsx` 通过：5 个测试文件，36 个测试。
- `npm.cmd run test:mocks` 通过：135 个测试文件，1702 个测试。
- 曾尝试通过 Vite 和 in-app Browser 做页面级验证，但 Browser runtime 被当前 Windows sandbox 的进程创建权限边界阻止；未完成浏览器目视验证。

## 当前基线

当前 runtime 已经有一条较清晰的实现链路，但调试控制台不应把每个内部 helper 都显示成一级模块。一级模块应优先对应用户真正关心的 runtime 阶段：

1. `action_resolver`
2. `world_tick`
3. `recall_selector`
4. `outline_brief`
5. 可选的 `story_outline_regenerator`
6. `narration_generator`
7. `runtime_update_proposal`
8. 确定性的 runtime update 校验
9. 待处理更新的暂存与持久化

`buildActionResolverInputFromWiki()`、`buildWorldTickInputFromWiki()`、`buildPostActionWorkingState()`、`buildRecallSelectorInputFromTurnStateAndWiki()`、`createRecallSelectorHandoff()`、`buildOutlineBriefInputFromTurnStateAndWiki()` 和 `buildNarrationGeneratorInputFromHandoffs()` 这类内部 helper 不应作为一级模块和 LLM 阶段并列展示。它们应被收纳到所属 runtime 阶段的输入组装、本地结果或 handoff 分区里。例如，`buildActionResolverInputFromWiki()` 只应作为 `action_resolver` 的输入来源展示，而不是成为 `action_resolver` 之前的单独顶层行。

当前 UI 只会展示粗粒度的 `Running turn...` 状态、最终 runtime 错误、警告和 pending updates。Runtime prompt 虽然已经通过 `RpgInteractionSpec` 以 `systemPrompt` / `userPrompt` 字符串存在，但目前没有结构化的 prompt 分段元数据，没有逐步的实时 trace，也没有可用于检查原始 LLM 输出或解析/校验失败的 UI。

## 产品形态

应新增一个专用的 Runtime 调试控制台视图，而不是把调试数据硬塞进现有 play 页面。这个控制台可以通过 RPG runtime 区域中的 tab、分栏路由或显式 debug 按钮进入，但主调试界面必须足够宽，以便检查 prompt 和 JSON。

默认视图应是一组折叠的 runtime 模块列表。每个模块行展示：

- 步骤标签，例如 `action_resolver`
- 状态：`pending`、`running`、`streaming`、`parsing`、`validating`、`succeeded`、`failed`、`skipped` 或 `aborted`
- 时间信息：开始时间、结束时间、持续时长
- prompt 预估：字符数与预估 token 数
- 输出预估：若可用则展示字符数与预估 token 数
- 来源摘要：固定 prompt、玩家行动、wiki 快照、runtime handoff、上一步输出，或确定性的本地 builder
- 失败时的失败摘要

展开某个模块后，应展示默认折叠的嵌套分区：

- `Input Assembly`
- `Prompt`
- `Raw Output`
- `Parsed Output`
- `Validation`
- `Warnings`
- `Handoff / Next Input`

Prompt 分区还应进一步拆成有意义的子分段，例如对 `action_resolver` 可以拆为：

- `System Fixed Prompt`
- `Submitted Action`
- `Pre-Action Snapshot`
- `Relevant Rules`
- `Fixed Slot Refs`
- `Recent Turn Summary`
- `Runtime Refs`

每个嵌套分区应展示：

- 来源类型
- 已知时的来源标签或路径
- 字符数
- 预估 token 数
- 折叠状态下的内容预览

## 预估 Token 计数

首版实现应使用预估 token 数。当前代码库中没有用于 prompt 计量的真实 LLM tokenizer 依赖。现有 tokenizer 是用于搜索/相关性的 tokenizer，而不是面向具体 provider 的 LLM tokenizer。

首版估算器：

- 单独统计 CJK 字符，因为它们通常比英文文本占用更多 token。
- 对非 CJK 可见字符使用字符到 token 的近似换算。
- 额外加入少量 role/message 封装开销。

建议的 helper 契约：

```ts
estimatePromptTokens(text: string): {
  chars: number
  estimatedTokens: number
  method: "mixed-char-estimate-v1"
}
```

建议公式：

```ts
estimatedTokens = ceil(cjkChars * 1.1 + nonCjkChars / 4 + messageOverhead)
```

这个数字只用于调试和比较，不能被视为权威的 provider budget，也不能用于静默截断 prompt。

## Trace 数据模型

在 runtime 域下引入一个浏览器安全的 runtime trace 模型。第一版可以先将 trace 保存在内存中，并在当前会话期间暴露给 UI。

建议结构：

```ts
interface RpgRuntimeDebugTrace {
  traceId: string
  turnId: string
  submittedActionId: string
  submittedActionText: string
  status: "running" | "succeeded" | "failed" | "aborted"
  startedAt: string
  endedAt?: string
  activeStepId?: string
  steps: RpgRuntimeDebugStep[]
  warnings: string[]
  error?: RpgRuntimeDebugError
}

interface RpgRuntimeDebugStep {
  stepId: string
  label: string
  kind: "llm_interaction" | "deterministic_validation" | "persistence"
  status: "pending" | "running" | "streaming" | "parsing" | "validating" | "succeeded" | "failed" | "skipped" | "aborted"
  startedAt?: string
  endedAt?: string
  durationMs?: number
  inputSections: RpgRuntimeDebugSection[]
  promptSections: RpgRuntimeDebugSection[]
  rawOutput?: RpgRuntimeDebugSection
  parsedOutput?: RpgRuntimeDebugSection
  validationSections: RpgRuntimeDebugSection[]
  handoffSections: RpgRuntimeDebugSection[]
  warnings: string[]
  error?: RpgRuntimeDebugError
}

interface RpgRuntimeDebugSection {
  sectionId: string
  title: string
  sourceKind: "fixed_prompt" | "player_input" | "wiki_file" | "runtime_handoff" | "llm_output" | "local_input_builder" | "local_result" | "validation"
  sourceLabel: string
  contentType: "text" | "json" | "markdown"
  content: string
  chars: number
  estimatedTokens: number
  tokenMethod: "mixed-char-estimate-v1"
}
```

这个数据模型不应引入 legacy/default 项目 fallback 或旧路径兼容。它仅服务于 RPG runtime 路径。

## Prompt 分段埋点

当前 prompt API 只返回：

```ts
interface RpgInteractionPrompt {
  systemPrompt: string
  userPrompt: string
}
```

对 LLM 调用而言，应保持这个对接线层面的 shape 不变，但增加可选的调试元数据：

```ts
interface RpgInteractionPrompt {
  systemPrompt: string
  userPrompt: string
  debugSections?: RpgPromptDebugSection[]
}
```

Prompt builder 初期可以先填充粗粒度分段，而不改变最终 prompt 文本。例如，`action_resolver` 可以先从以下部分开始：

- 固定 system prompt
- 提交的 action
- action 前快照
- 相关规则
- 固定 slot 引用
- 最近回合摘要
- runtime 引用

后续阶段可以让 `world_tick`、`recall_selector`、`outline_brief`、`narration_generator` 和 `runtime_update_proposal` 也达到同样的细粒度。

## Runtime 埋点边界

不要一开始就把 trace 埋到低层 LLM client 里。真正有用的领域名称都在更高层，例如 `action_resolver`、`world_tick`、`recall_selector` 等。应先对 runtime orchestrator 和 interaction adapter 做埋点。

Orchestrator 应为以下事件发出 trace：

- 输入组装开始 / 成功 / 失败，并归属到对应的一级 runtime 阶段
- prompt 已构建
- LLM 请求开始
- 收到 LLM streaming token
- LLM 原始输出完成
- 解析开始 / 成功 / 失败
- 校验开始 / 成功 / 失败
- handoff 已构建
- 持久化开始 / 成功 / 失败

UI 应在 turn 运行过程中根据这些事件实时更新。如果 LLM 调用前的输入组装失败，所属一级阶段应显示为失败，并在 `Input Assembly` 分区展示明确错误。例如，`buildActionResolverInputFromWiki()` 失败时，应标记 `action_resolver` 失败，而不是创建一个单独的顶层 builder 行。如果某一步失败，之前已完成的所有步骤仍然可检查，后续步骤保持 `pending` 或 `skipped`。

## 持久化策略

Phase 1-4 的第一版只将 trace 保存在内存中。Phase 5 已增加单条 trace 手动导出，以及最近 N 条 trace 的显式 opt-in 持久化。Runtime 调试数据可能包含完整 prompt、wiki 摘录、原始 LLM 输出、隐藏的 GM 大纲材料以及玩家输入，因此持久化必须保持用户显式开启，不能静默写入。

当前已实现的持久化/导出方式：

- 允许手动将单条 trace 导出为 JSON。
- 将最近 N 条 trace 存储在 `.llm-wiki/runtime/debug-traces/`，但默认关闭，必须由用户在 Debug Console 中显式打开 `Persist`。
- retention 目前是当前 panel session state，不写入全局 Settings 或项目配置；选项为 5 / 10 / 20。
- 导出/持久化会脱敏 API key、authorization、headers、secret、token、password；不做 provider tokenizer、不压缩、不截断 prompt/raw output。

后续仍可考虑：

- 增加一个项目设置，用于跨会话记住 debug trace 保留策略。

不要把 debug trace 写进 `wiki/`。Debug trace 是 runtime 元数据，不是 wiki 正史、不是 source material，也不是 runtime apply state。

## UI 方案

新增一个独立的调试控制台组件，较可能位于 `src/components/rpg/` 下，并与当前的 play 面板和 pending updates 面板分离。

建议的首版布局：

- 顶部工具栏：当前 trace 状态、提交的 action、trace id、清空按钮
- 左列或全宽列表：折叠的步骤行
- 展开的步骤主体：用于 prompt/output/parsed/validation/handoff 的嵌套折叠区
- JSON 分区使用可滚动的等宽字体块渲染，并带复制按钮
- text/markdown 分区默认用预格式化文本渲染，以保留精确的 prompt 文本

避免卡片中再套装饰性卡片。应使用紧凑行、边框、折叠区和稳定高度，避免超长 prompt 把页面撑坏。

## 分阶段实现

### Phase 1 - 最小可用实时 Trace

状态：已完成首版实现。当前实现满足本阶段的内存 trace、一级阶段事件、粗粒度 prompt/raw output 捕获、失败归属和测试覆盖要求。仍保留 Phase 3 之前的粗粒度 prompt 分区，不在本阶段拆分语义化 prompt 子段。

实现 trace 模型、内存内 trace store，以及 orchestrator 步骤事件。

范围：

- 添加 debug trace 类型和 token 估算 helper。
- 为 `runRpgTurn()` / `runRpgRuntimeTurnFlow()` 增加可选的 `debugObserver` 或 `traceSink`。
- 为每个一级 runtime 阶段发出 start/success/failure 事件。
- 将本地 input builder 的输出、warnings 和失败记录到所属阶段的 `Input Assembly` 分区，而不是把本地 builder 显示成顶层模块。
- 以两个分区的形式捕获粗粒度 prompt 文本：`systemPrompt` 和 `userPrompt`。
- 捕获 LLM interaction 的原始输出以及 parse/validation 错误。
- 添加测试，证明 `action_resolver` 失败时会把该步骤标记为 failed，并让后续步骤保持 pending/skipped。

验收标准：

- 当一次 runtime turn 失败时，UI 能准确显示失败发生在哪一步。
- 内部 helper 失败应归属到所属 runtime 阶段，例如 `action_resolver / Input Assembly`。
- 已完成或失败的 LLM 步骤，其 prompt 和原始输出都可见。
- token 数以预估值形式展示。
- 不改变 wiki 写入策略或 runtime 输出行为。

### Phase 2 - 专用 Debug Console UI

状态：已完成首版实现。当前实现提供独立 `RpgRuntimeDebugConsole` 组件，并从 `RpgRuntimePanel` 的 `Play / Debug` 视图入口读取当前/最近 trace。浏览器级人工验证尚未完成，原因是当前环境的 in-app Browser runtime 被 Windows sandbox 进程创建权限阻止。

新增 debug console 视图，并将其接到当前 runtime panel 状态上。

范围：

- 新增 `RpgRuntimeDebugConsole` 组件。
- 增加从 RPG runtime 区域打开它的方式，且不压缩现有 play panel。
- 渲染默认折叠的模块行，展示状态、耗时、字符数和预估 token。
- 渲染默认折叠的嵌套分区，用于展示 prompt、raw output、parsed output、validation 和 handoff。
- 在一个 turn 完成后保留最后一条 trace，直到下一次 turn 开始或用户手动清空。

验收标准：

- 在 turn 运行期间，活动模块会实时变化。
- 失败后，已完成和失败的模块细节仍可继续检查。
- 成功后，每个 LLM interaction 都可以被展开检查。

### Phase 3 - 结构化 Prompt 分段

状态：已完成首版实现。当前 runtime LLM prompt builder 已输出语义化 `debugSections`，并通过测试确认这些 sections 可以重组为最终 `systemPrompt` / `userPrompt` 字符串。

升级 runtime prompt builder，使其暴露具有语义的 `debugSections`。

范围：

- 为 `RpgInteractionPrompt` 扩展可选的 `debugSections`。
- 添加 section helper，让 prompt 文本和 debug sections 由同一份源值生成。
- 从 `action_resolver` 开始，然后覆盖 `world_tick`、`recall_selector`、`outline_brief`、`narration_generator` 和 `runtime_update_proposal`。
- 每个 prompt 子分段都记录来源类型、来源标签、字符数、预估 token 数和内容。

验收标准：

- `action_resolver` prompt 不再只是 `systemPrompt` / `userPrompt`；它可以按固定 prompt、提交 action、快照、规则、refs 和 runtime refs 进行检查。
- 所有 runtime LLM 步骤最终都具备相近的 prompt 分段粒度。
- 最终 prompt 字符串保持 byte-for-byte 一致，或在有意修改时配套测试。

### Phase 4 - 输出、校验与 Handoff 细节

状态：已完成首版实现。Trace 在 Phase 4 开始记录 parsed output 摘要、validation success/warnings/failure、wiki 输入证据和关键 handoff 摘要；当时 debug trace 仍只保存在内存中，Phase 5 已在下一节增加显式导出和默认关闭的 opt-in 持久化。

让每个模块不仅能检查 prompt，还能真正用于根因分析。

范围：

- 为每个 LLM 步骤捕获解析后的 JSON 摘要。
- 将校验警告和校验失败信息分别作为独立分区捕获。
- 捕获步骤之间的重要 handoff 摘要。
- 对本地 builder，捕获其读取过的相关 wiki 路径和返回的 warnings。

验收标准：

- 如果 narration 缺失，trace 能显示问题究竟出在 prompt 构建、LLM 输出、解析、校验，还是下游 update proposal。
- 如果 prompt 过大，控制台能显示是哪一段主导了估算体积。
- 如果 wiki 上下文不对，控制台能显示使用了哪些来自 wiki 的输入分段。

### Phase 5 - 可选持久化与导出

状态：已完成首版实现。当前实现提供单条 trace JSON 手动导出，以及默认关闭、用户显式打开后才启用的最近 N 条 trace 持久化；持久化路径固定为 `.llm-wiki/runtime/debug-traces/`，不会写入 `wiki/`。

为 trace 增加显式 opt-in 的持久化/导出能力。

范围：

- 增加单条 trace JSON 的手动导出。
- 可选地将最近 N 条 trace 持久化到 `.llm-wiki/runtime/debug-traces/`。
- 增加清空/保留策略控制。
- 保持 debug trace 不进入 `wiki/`。

验收标准：

- 用户可以分享单条失败 trace 进行调试，而不必手动复制很多 UI 面板。
- 持久化必须是显式的，不能静默创建新的 wiki 内容。

## 推荐的第一阶段

如果实现窗口中等，建议把 Phase 1 和 Phase 2 一起做。这样能立刻带来测试价值：实时步骤状态、粗粒度 prompt、原始输出，以及精确的失败位置。

如果需要把实现做得更小，可以先只做 Phase 1。它会先建立数据主干和测试覆盖，而不必立即承诺最终 UI 细节。

不要一开始就对所有 runtime 模块做结构化 prompt 分段重构。那项工作确实有价值，但范围更宽，等 trace 模型和 UI 外壳先存在之后，会更容易安全推进。

## 测试策略

在做广泛集成测试之前，先补充聚焦测试：

- token 估算器能处理英文、中文、混合文本、空文本和 JSON
- trace 事件能保持步骤顺序
- 成功的 mocked runtime turn 会记录所有预期步骤
- 失败的 mocked `action_resolver` 会记录 failed step，且不会隐藏 prompt/raw output
- 失败的 parse 或 validation 会记录 raw output 以及 parser/validator error
- debug console 能渲染默认折叠状态和展开后的嵌套分区
- debug trace export 能生成 versioned payload、安全文件名，并在不修改内存 trace 的前提下遮蔽敏感 key
- debug trace persistence client 能保存/读取 `.llm-wiki/runtime/debug-traces/`、按 retention 删除旧 trace、忽略坏 JSON、并且不写入或清理 `wiki/`
- Debug Console / Runtime Panel 能证明默认不持久化，只有用户打开 `Persist` 后才保存完成态 trace

尽可能复用现有的 mocked runtime adapter tests。第一版实现不要求真实 LLM 测试。

## 非目标

- 首版不引入 provider-specific tokenizer 依赖。
- 不使用 debug trace 去改变 runtime 行为。
- 不允许 debug UI 绕过 pending/review/apply 边界。
- 不把 debug trace 写入 `wiki/`。
- 不增加 default/legacy 项目兼容、迁移 fallback 或旧路径保留。
- 不在 trace 中存储 API keys、headers 或传输层 secrets。

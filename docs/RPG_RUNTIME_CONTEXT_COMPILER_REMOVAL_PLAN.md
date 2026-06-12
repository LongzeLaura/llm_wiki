# RPG Runtime Context Compiler Removal Plan

## 当前执行状态

- 阶段 A：已完成。`docs/RPG_WIKI_SCHEMA.md` 和当前架构文档不再把 `context_compiler` 作为目标 runtime 模块；旧实现明确称为 `legacy_context_compiler_v0` / `legacy_compact_brief_builder`。
- 阶段 B：已完成。`runRpgTurn()` 现在先通过 `buildActionResolverInputFromWiki()` 构建 `ActionResolverInput` 并调用 `action_resolver`，之后才临时调用 `runRpgRuntimePreview()` / `legacy_context_compiler_v0` 供未迁移下游使用。
- 阶段 C：已完成。`runRpgTurn()` 现在通过 `buildWorldTickInputFromWiki()` 构建 `WorldTickInput`，`world_tick` 不再从 `CompactStoryBrief` / `runRpgRuntimePreview()` / `compileRpgContext()` 获取输入。
- 阶段 D：已完成。`runRpgTurn()` 现在通过 `buildRecallSelectorInputFromTurnStateAndWiki()` 构建 `RecallSelectorInput` 和 retrieval index，`recall_selector` 不再消费 `CompactStoryBrief`。
- 阶段 E：已完成。`runRpgTurn()` 现在通过 `buildOutlineBriefInputFromTurnStateAndWiki()` 构建 `OutlineBriefCompilerInput`，`outline_brief` 不再通过 `CompactStoryBrief` / legacy preview 获取 outline、plot-arc、relationship 或 rules 材料。
- 阶段 F：已完成。`runRpgTurn()` 现在通过 `buildNarrationGeneratorInputFromHandoffs()` 构建 `NarrationGeneratorInput`，`narration_generator` 不再通过 `CompactStoryBrief` 获取 style、rules、memory、forbidden 或 player knowledge boundary。
- 阶段 G：已完成。正式 `runRpgTurn()` 和 runtime controller result surface 已不再包含 `brief`；`runRpgTurn()` 不再调用 `runRpgRuntimePreview()` / `compileRpgContext()`；生产 runtime 路径不再使用 `CompactStoryBrief`。旧 `context-compiler.ts` / `runtime-agent.ts` 已删除，而不是作为 debug helper 保留。`runtime_update_proposal` 仍未拆，本阶段没有扩大该范围。

## 背景

本计划启动时，runtime 主流程仍然真实接入了旧的确定性 context compiler：

```text
wiki files
-> compileRpgContext()
-> CompactStoryBrief
-> action_resolver / world_tick / recall_selector / outline_brief / narration_generator
```

这条链路当时存在于实现中，不是 fallback，也不是未接入残留：

- `src/lib/rpg-runtime/context-compiler.ts` 提供 `compileRpgContext()`
- `src/lib/rpg-runtime/runtime-agent.ts` 的 `runRpgRuntimePreview()` 调用 `compileRpgContext()`
- `src/lib/rpg-runtime/turn-orchestrator.ts` 的 `runRpgTurn()` 先调用 `runRpgRuntimePreview()`，再从 `CompactStoryBrief` 构建后续模块输入

阶段 G 完成后，上述旧文件和主流程调用已删除。但它与新的 runtime 目标架构冲突的原因仍保留在此作为设计记录：玩家输入行动后，不应再先进入一个总装式 `CompactStoryBrief`。`action_resolver`、`world_tick`、`recall_selector`、`outline_brief`、`story_outline_regenerator` 和 `narration_generator` 应分别拥有自己的输入构建和读取边界，完全替代旧 context compiler。

`story_outline_regenerator` 当前不直接消费 `CompactStoryBrief`；它由 `outline_brief` 在重大偏离时通过 `outlineBriefInput`、`outlineImpactReport` 和 `regenerationRequest` 条件触发。但只要 `outline_brief` 的上游仍来自 `CompactStoryBrief` 链路，`story_outline_regenerator` 就仍然间接受旧总装层影响。因此拆除目标包括清除直接和间接的 `CompactStoryBrief` 依赖。

## 目标

移除正式 runtime turn flow 中的中心化 `compileRpgContext() -> CompactStoryBrief` 依赖。

目标链路应改为：

```text
submitted action
-> buildActionResolverInputFromWiki()
-> action_resolver
-> buildWorldTickInputFromWiki()
-> world_tick
-> buildPostActionWorkingState()
-> buildRecallSelectorInputFromTurnStateAndWiki()
-> recall_selector
-> createRecallSelectorHandoff()
-> buildOutlineBriefInputFromTurnStateAndWiki()
-> outline_brief
-> optional story_outline_regenerator
-> buildNarrationGeneratorInputFromHandoffs()
-> narration_generator
-> runtime_update_proposal
-> review / pending / apply
```

其中每个 `*FromWiki()` / `*FromTurnStateAndWiki()` helper 都是确定性本地读取层，但它们只服务对应模块，不能重新形成一个全局 context compiler 或 `CompactStoryBrief`。

## 非目标

- 不新增 `wiki/runtime/` 普通目录。
- 不把 runtime 中间产物写入普通 wiki 页面。
- 不恢复旧 default / legacy 项目的兼容路径。
- 不用一个新的“大 brief”替代 `CompactStoryBrief`。
- 不让 `narration_generator` 直接任意读 wiki 文件。
- 不绕过 pending / review / apply 边界写 wiki。

## 设计原则

1. 玩家行动后第一个 LLM runtime 模块是 `action_resolver`。
2. 每个 runtime 模块只读取本模块需要的目录和 section。
3. 模块输入 builder 可以共享底层小工具，例如安全读文件、slot 读取、overlay 合并、section 选择、引用归一化；但不能共享一个总装上下文对象。
4. `world_tick` 消费 `ActionResolution` 和行动后状态，不重新裁判玩家行动。
5. `outline_brief` 消费 recall handoff、outline slices、plot-arc / relationship tension fuel 和 world tick 结果，不直接生成正文或 wiki update。
6. `narration_generator` 只消费前置 handoff、style bundle、forbidden constraints 和 player knowledge boundary，不直接读任意 wiki。
7. `runtime_update_proposal` 从结构化 turn state 和 source deltas 生成 pending proposal，不从单段正文倒推事实。

## 阶段计划

### 阶段 A：文档和命名边界修正（已完成）

目标：先让文档不再把 `context_compiler` 当成未来 runtime 模块。

建议改动：

- 更新 `docs/RPG_WIKI_SCHEMA.md`：
  - 删除目录矩阵和信息流矩阵中的 `context_compiler` 模块行。
  - 将相关读者改为具体模块：`action_resolver`、`world_tick`、`recall_selector`、`outline_brief`、`narration_generator`、`runtime_update_proposal`。
  - 增加说明：当前 `compileRpgContext()` 是待拆除的 v0 总装层，不是目标架构。
- 更新架构文档中 `Context Compiler v1` 的描述：
  - 不再规划一个新的中心化 Context Compiler v1。
  - 改为规划 `module input builders` / `runtime handoff readers`。

验收：

- `docs/RPG_WIKI_SCHEMA.md` 不再把 `context_compiler` 列为 runtime 模块。
- 文档明确写出 `CompactStoryBrief` 是待删除的 v0 artifact。

### 阶段 B：拆出 Action Resolver 输入读取（已完成）

目标：`action_resolver` 不再从 `CompactStoryBrief` 构建输入。

建议新增：

- `src/lib/rpg-runtime/action-resolver-input-builder.ts`
- `buildActionResolverInputFromWiki(projectPath, submittedAction)`

读取范围：

- `wiki/current-scene/scene_state.md`
  - 当前时间地点
  - 在场人物
  - 可交互对象
  - 可见线索
  - active clocks / countdowns
  - pending reactions
  - pacing state
- 固定 `wiki/player/*.md`
  - `player.md`
  - `abilities.md`
  - `inventory.md`
  - `goals.md`
  - `known_information.md`
- 固定 `wiki/rules/*.md`
  - `core.md`
  - `world.md`
  - `table.md`
- 与行动文本和当前场景相关的：
  - `characters/*.md` + `characters/runtime/*.md`
  - `locations/*.md` + `locations/runtime/*.md`
  - `items/*.md` + `items/runtime/*.md`
  - `factions/*.md` + `factions/runtime/*.md`
  - `quests/*.md`

替换点：

- 删除或停止使用 `buildActionResolverInputFromBrief()`
- `runRpgTurn()` 改为直接调用 `buildActionResolverInputFromWiki()`

完成记录：

- 新增 `src/lib/rpg-runtime/action-resolver-input-builder.ts`，直接读取 `wiki/current-scene/scene_state.md`、固定 `wiki/player/*.md`、固定 `wiki/rules/*.md`、相关 `characters/locations/items/factions` base + runtime overlay 和 `quests/*.md`。
- 新增 `src/lib/rpg-runtime/wiki-readers.ts`，把安全读盘、slot 读取、base/runtime overlay 分组、token scoring 和摘录 helpers 从旧 compiler 中拆为小型 reader 工具。
- `src/lib/rpg-runtime/turn-orchestrator.ts` 的 `runRpgTurn()` 已停止在 action resolver 前调用 `runRpgRuntimePreview()`；旧 preview 只在 action resolver 之后临时服务 `world_tick` / `recall_selector` / `narration_generator` 等未迁移下游。
- `buildActionResolverInputFromBrief()` 暂时保留为旧 helper，但 `rg --encoding utf-8 -n "buildActionResolverInputFromBrief\\(" src/lib` 只剩定义，没有生产调用点。

验收：

- `runRpgTurn()` 在 action resolver 前不调用 `runRpgRuntimePreview()`
- action resolver 测试证明输入来自具体目录，而不是 `CompactStoryBrief`

### 阶段 C：拆出 World Tick 输入读取

目标：`world_tick` 不再从 `CompactStoryBrief` 构建输入。

建议新增：

- `src/lib/rpg-runtime/world-tick-input-builder.ts`
- `buildWorldTickInputFromWiki(projectPath, submittedAction, actionResolution, preActionSnapshot)`

读取范围：

- `ActionResolution`
- action resolver 的 pre/post action snapshot
- `wiki/current-scene/scene_state.md`
- `wiki/events/*.md`
- `wiki/relationships/runtime/*.md`
- `wiki/plot-arcs/runtime/*.md`
- `wiki/quests/*.md`
- 与行动影响路径相关的 `characters/locations/factions/items/runtime/*.md`
- `wiki/outlines/progress.md`
- 必要的 rules hard constraints

替换点：

- 删除或停止使用 `buildWorldTickInputFromBrief()`

完成记录：

- 新增 `src/lib/rpg-runtime/world-tick-input-builder.ts`。
- `buildWorldTickInputFromWiki()` 直接读取 `wiki/current-scene/scene_state.md`、`wiki/events/*.md`、`wiki/relationships/runtime/*.md`、`wiki/plot-arcs/runtime/*.md`、`wiki/quests/*.md`、相关 `characters/locations/factions/items` base + runtime overlay、`wiki/outlines/progress.md` 和固定 `wiki/rules/*.md`。
- `runRpgTurn()` 已将 `buildWorldTickInputFromBrief(preview.brief, actionResolution)` 替换为 `buildWorldTickInputFromWiki({ projectPath, submittedAction, actionResolution, preActionSnapshot })`。
- `buildWorldTickInputFromBrief()` 暂时保留为旧 helper 定义，但不再被生产 `runRpgTurn()` 调用。

验收：

- `world_tick` 输入只依赖 `ActionResolution`、turn state 和自己的 wiki reader。
- `CompactStoryBrief` 不再出现在 World Tick 输入链路。

### 阶段 D：拆出 Recall Selector 输入读取

目标：`recall_selector` 基于 action/world tick 后的 turn state 自己构建 retrieval index，而不是消费 `CompactStoryBrief`。

建议新增或改造：

- `src/lib/rpg-runtime/recall-selector-input-builder.ts`
- `buildRecallSelectorInputFromTurnStateAndWiki(projectPath, turnState)`

读取范围：

- `PostActionWorkingState`
- `ActionResolution`
- `WorldTickResult`
- `WorldTickVisibleSelection`
- 当前 scene refs
- affected paths
- recent accepted events
- relevant sources as provenance
- lightweight retrieval index

验收：

- `buildRecallSelectorInputFromTurnState()` 不再需要 `brief`
- recall selector 的 retrieval index 来自 turn state + wiki readers

完成记录：

- 新增 `src/lib/rpg-runtime/recall-selector-input-builder.ts`。
- `buildRecallSelectorInputFromTurnStateAndWiki()` 从 `PostActionWorkingState`、`ActionResolution`、`WorldTickResult`、`WorldTickVisibleSelection` 和专用 wiki reader 构建 `RecallSelectorInput`。
- retrieval index 现在包含 schema slot metadata、当前 scene、affected paths、recent events、sources provenance refs、相关 base + runtime overlay、quests 和 outline progress。
- `runRpgTurn()` 已将 `buildRecallSelectorInputFromTurnState({ brief: preview.brief, ... })` 替换为 `buildRecallSelectorInputFromTurnStateAndWiki(...)`。
- `buildRecallSelectorInputFromTurnState({ brief })` 暂时保留为旧 helper/test 覆盖对象，但不再被生产 `runRpgTurn()` 调用。
- `runRpgRuntimePreview()` 调用已后移到 `recall_selector` 和 `createRecallSelectorHandoff()` 之后，目前只继续服务尚未迁移的 `narration_generator` style/forbidden legacy brief 路径以及结果中的临时 `RunRpgTurnResult.brief`。

### 阶段 E：拆出 Outline Brief 输入读取（已完成）

目标：`outline_brief` 自己读取 outline/progress/plot-arc/relationship 材料，不通过 `CompactStoryBrief`。

建议新增或改造：

- `src/lib/rpg-runtime/outline-brief-input-builder.ts`
- `buildOutlineBriefInputFromTurnStateAndWiki(projectPath, turnState, recalledMaterials)`

读取范围：

- `wiki/outlines/main.md` 的受控切片
  - Act Structure
  - Intended Reveals
  - Delayed Reveals
  - Branch Conditions
  - Must Not Contradict
- `wiki/outlines/progress.md`
  - Current Stage
  - Completed Beats
  - Divergence Notes
  - Next Useful Beats
- `wiki/plot-arcs/*.md`
- `wiki/plot-arcs/runtime/*.md`
- `wiki/relationships/runtime/*.md`
- recall handoff
- world tick gap/pacing/reaction queue

验收：

- `outline_brief` 输入不依赖 `brief.outlineNotes` 或 `brief.activePlotPressure`
- outline slices 有稳定 refs / section ids / reveal policy / invalidation metadata

完成记录：

- 新增 `src/lib/rpg-runtime/outline-brief-input-builder.ts`。
- `buildOutlineBriefInputFromTurnStateAndWiki()` 从 `PostActionWorkingState`、`ActionResolution`、`WorldTickResult`、`WorldTickVisibleSelection`、`RecallSelection`、`RecalledMaterial[]` 和专用 wiki reader 构建 `OutlineBriefCompilerInput`。
- reader 读取 `wiki/outlines/main.md` 的受控切片：`Runtime Capsule`、`Act Structure`、`Intended Reveals`、`Delayed Reveals`、`Branch Conditions`、`Must Not Contradict`。
- reader 读取 `wiki/outlines/progress.md` 的受控切片：`Runtime Capsule`、`Current Stage`、`Completed Beats`、`Divergence Notes`、`Next Useful Beats`。
- reader 读取 `wiki/plot-arcs/*.md`、`wiki/plot-arcs/runtime/*.md`、`wiki/relationships/runtime/*.md` 和固定 `wiki/rules/core.md`、`wiki/rules/world.md`、`wiki/rules/table.md`，并将这些材料分类进 `outlineSlices`、`plotArcTensionFuel`、`hardConstraints` 和 `knownReferences`。
- `plotArcTensionFuel` 现在可接收 `relationships/runtime` 的关系张力燃料。
- `runRpgTurn()` 已将 `buildOutlineBriefCompilerInputFromTurnState(...)` 替换为 `await buildOutlineBriefInputFromTurnStateAndWiki(...)`。
- `buildOutlineBriefCompilerInputFromTurnState()` 暂时保留为旧 helper / 内部分类复用点，但不再被生产 `runRpgTurn()` 直接调用。

### 阶段 F：拆出 Narration 输入和 style / forbidden handoff（已完成）

目标：`narration_generator` 不再从 `CompactStoryBrief` 获取 style/rules/memory/forbidden material。

建议新增或改造：

- `src/lib/rpg-runtime/narration-input-builder.ts`
- `buildNarrationGeneratorInputFromHandoffs(projectPath, turnState, outlineBriefOutput, recalledMaterials, provisionalHandoff?)`

读取范围：

- 前置模块 handoff
- `wiki/style/narration.md`
- `wiki/style/dialogue.md`
- `wiki/style/forbidden.md`
- `wiki/memory/player-preferences.md`
- 必要 rules hard constraints
- player knowledge boundary

替换点：

- 删除 `buildNarrationStyleBundle(input.brief, references)` 对 `CompactStoryBrief` 的依赖
- `buildForbiddenNarrationConstraints()` 不再依赖 brief-derived forbidden contradictions

验收：

- 生产 `runRpgTurn()` 不再调用 `buildNarrationGeneratorInputFromTurnState({ brief })`
- narration input 中的 style/forbidden/player knowledge 都来自明确 reader 或前置 handoff

完成记录：

- 新增 `src/lib/rpg-runtime/narration-input-builder.ts`。
- `buildNarrationGeneratorInputFromHandoffs()` 从 `PostActionWorkingState`、`ActionResolution`、`WorldTickResult`、`WorldTickVisibleSelection`、`RecallSelection`、`RecalledMaterial[]`、`OutlineAwareNarrationBrief` 和可选 `ProvisionalNarrationHandoff` 构建 `NarrationGeneratorInput`。
- reader 只读取固定 style / memory / rules / player knowledge slot：`wiki/style/narration.md`、`wiki/style/dialogue.md`、`wiki/style/forbidden.md`、`wiki/memory/player-preferences.md`、`wiki/rules/core.md`、`wiki/rules/world.md`、`wiki/rules/table.md`、`wiki/player/known_information.md`。
- `styleBundle` 来自 dedicated style / player-preferences reader，不再来自 `brief.styleRules`。
- `forbiddenNarrationConstraints` 来自 outline brief boundary、parallel-line handoff、style forbidden、rules hard constraints 和 optional provisional narration handoff，不再来自 brief-derived forbidden material。
- `playerKnowledgeBoundary` 来自 allowed refs 和 `wiki/player/known_information.md`。
- `runRpgTurn()` 已将 `buildNarrationGeneratorInputFromTurnState({ brief: preview.brief, ... })` 替换为 `await buildNarrationGeneratorInputFromHandoffs(...)`。
- `buildNarrationGeneratorInputFromTurnState({ brief })` 暂时保留为 legacy helper / 阶段 G 清理候选，但不再被生产 `runRpgTurn()` 调用。
- `runRpgRuntimePreview()` 已从 outline/narration 上游移除，并后移到 narration 完成后，仅为临时 result surface 的 `brief` 补值。

### 阶段 G：移除 CompactStoryBrief 主流程

目标：正式 runtime turn flow 中没有 `CompactStoryBrief`。

建议改动：

- `RunRpgTurnResult` 删除 `brief`
- `runRpgTurn()` 删除 `runRpgRuntimePreview()` 调用
- 删除或隔离：
  - `CompileRpgContextInput`
  - `CompactStoryBrief`
  - `RpgRuntimePreviewResult`
  - `compileRpgContext()`
  - `runRpgRuntimePreview()`
- 如果 UI 仍需要 preview：
  - 改成 debug-only / audit-only helper
  - 不参与 `runRpgTurn()` 主链路
  - 不叫 context compiler

验收：

- `rg --encoding utf-8 "CompactStoryBrief|compileRpgContext|runRpgRuntimePreview|buildActionResolverInputFromBrief|buildWorldTickInputFromBrief" src` 在生产 runtime 路径中无命中。
- 测试覆盖每个模块 input builder。
- `runRpgTurn()` 的第一步是构建 `ActionResolverInput` 并调用 `action_resolver`。

完成记录：

- `RunRpgTurnResult` 已删除 `brief` 字段。
- `runRpgTurn()` 已删除 narration 后的 `runRpgRuntimePreview()` 调用，正式 runtime turn flow 不再调用 `compileRpgContext()`。
- `RunRpgRuntimeTurnFlowResult` 已删除 `brief` 字段；controller result 不再转发旧 brief surface。
- `src/lib/rpg-runtime/context-compiler.ts` 和 `src/lib/rpg-runtime/runtime-agent.ts` 已删除；legacy preview / context compiler 没有作为 debug-only helper 保留。
- `src/lib/rpg-runtime/types.ts` 已删除 `CompileRpgContextInput`、`RunRpgRuntimePreviewInput`、`CompactStoryBrief` 和 `RpgRuntimePreviewResult`。
- `src/lib/rpg-runtime/index.ts` 已停止导出 `compileRpgContext` / `runRpgRuntimePreview`。
- `src/lib/rpg-runtime/turn-orchestrator.ts` 已删除 `buildActionResolverInputFromBrief()`、`buildWorldTickInputFromBrief()` 和 `buildNarrationGeneratorInputFromTurnState({ brief })`。
- `src/lib/rpg-runtime/recall-selector-handoff.ts` 的轻量 turn-state retrieval helper 已去掉 brief 输入和 brief reference indexing。
- `action_resolver`、`world_tick`、`recall_selector`、`outline_brief`、`narration_generator` 继续分别通过自己的 input builder / handoff builder 供给。
- 验证通过：
  - `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-story-outline-regenerator.test.ts src/lib/rpg-runtime-update-proposal.test.ts`（7 files, 102 tests）
  - `npm.cmd run typecheck`
  - `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx`（1 file, 15 tests）
  - `rg --encoding utf-8 "runRpgRuntimePreview\\(|compileRpgContext\\(|CompactStoryBrief|buildActionResolverInputFromBrief\\(|buildWorldTickInputFromBrief\\(|buildNarrationGeneratorInputFromTurnState\\(" src/lib/rpg-runtime src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts` 无命中。
- 未做范围：
  - 没有新增 `wiki/runtime/`
  - 没有新增 legacy/default 兼容或 fallback
  - 没有绕过 pending / review / apply
  - 没有把 `runtime_update_proposal` 改成从单段正文倒推事实
  - 没有 git commit / git push

## 预期受影响文件

主要生产代码：

- `src/lib/rpg-runtime/context-compiler.ts`
- `src/lib/rpg-runtime/runtime-agent.ts`
- `src/lib/rpg-runtime/turn-orchestrator.ts`
- `src/lib/rpg-runtime/types.ts`
- `src/lib/rpg-runtime/recall-selector-handoff.ts`
- `src/lib/rpg-runtime/outline-brief-handoff.ts`
- `src/lib/rpg-runtime/runtime-update-proposal-handoff.ts`
- `src/lib/rpg-runtime/index.ts`

可能受影响 UI / controller：

- `src/lib/rpg-runtime/runtime-controller.ts`
- `src/components/rpg/rpg-runtime-panel.tsx`
- runtime panel / pending update 相关测试

测试：

- `src/lib/rpg-runtime-controller.test.ts`
- `src/lib/rpg-turn-orchestrator.test.ts`
- `src/lib/rpg-action-resolver.test.ts`
- `src/lib/rpg-world-tick-*.test.ts`
- `src/lib/rpg-recall-selector*.test.ts`
- `src/lib/rpg-outline-brief.test.ts`
- `src/lib/rpg-narration-generator.test.ts`
- `src/lib/rpg-runtime-update-proposal.test.ts`

文档：

- `docs/RPG_WIKI_SCHEMA.md`
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

## 风险

- 一次性删除 `CompactStoryBrief` 会影响面很大，容易让 runtime controller、UI preview、turn record 和测试同时失效。
- 当前很多 helper 仍以 brief 为中间对象，直接删除会导致输入 builder 缺少统一引用和 warning 聚合。
- 如果每个模块 input builder 各自读盘，需要小心重复读取、预算膨胀和引用不一致。
- 必须保证拆分后没有形成新的隐性大 brief。

## 推荐执行顺序

1. 先改文档，冻结目标架构和禁止新增中心化 compiler。
2. 先拆 action resolver 输入，因为它是玩家行动后的第一模块，也是最能体现目标架构的边界。
3. 再拆 world tick 输入，使行动裁判和世界推进完全脱离 brief。
4. 再拆 recall / outline / narration，因为它们可以逐步从 turn state 和 handoff 接管材料。
5. 最后删除 `CompactStoryBrief` 类型和 `compileRpgContext()` 主流程调用。

## 完成定义

当以下条件全部满足时，拆除完成：

- 正式 `runRpgTurn()` 不调用 `runRpgRuntimePreview()` 或 `compileRpgContext()`。
- 正式 runtime turn result 不再包含 `brief`。
- 生产 runtime 路径不再使用 `CompactStoryBrief`。
- `action_resolver`、`world_tick`、`recall_selector`、`outline_brief`、`narration_generator` 都有自己的 input builder / handoff builder。
- 每个 input builder 的读取目录、section、输出字段和禁止边界都有 focused tests。
- 文档不再把 `context_compiler` 列为目标 runtime 模块。

# llmWikiRPG 下一步架构实施路线

## 结论

当前 **Stage 6.15: Runtime Update Validation v1** 已完成。下一步不应直接跳到 **Outline Impact Detector**，而应继续把已经形成的 runtime 纵切补成上下文与写回契约一致的稳定闭环。

Stage 1 到 Stage 5 已经形成了“单回合到待确认更新”的内存链路：

```text
SubmittedAction
  -> CompactStoryBrief
  -> RpgNarrationPrompt
  -> RpgTurnResult
  -> RpgTurnRecord
  -> ProposedWikiUpdate[]
  -> PendingRpgUpdate[]
```

Stage 5 已经确保 proposed / pending updates 只能来自 completed `RpgTurnRecord`，不会从未选择的 `nextActionOptions` 抽取事实，也不会读取或写入 wiki 文件。

Stage 6 已经建立受控的运行时写回边界：只允许已经 `accepted` 的 `PendingRpgUpdate` 按策略写入动态 runtime 路径，同时继续拒绝 stable/manual/base/legacy 路径。

Stage 6.8 已经把 Stage 5/6 的 pending/apply 边界接入 RPG runtime UI：用户可以逐条审阅 pending updates，显式 accept/reject，并手动 apply accepted updates；UI 仍然只通过 `applyRpgPendingUpdates()` 写回，且不会自动接受、自动应用或绕过 write policy。

Stage 6.9 已经建立最小统一交互协议层：`src/lib/rpg-interactions/` 现在包含通用 `RpgInteractionSpec`、第一版 `runtimeUpdateInteractionSpec`，以及可复用的 runtime update target policy。现有 extractor 与 write policy 已共享同一套 `validateRpgRuntimeUpdateTarget()` 规则。

Stage 6.10 已经把 Stage 6.9 的 runtime update interaction 接入 controller 链路：`runRpgRuntimeTurnFlow()` 通过注入的 update interaction adapter 生成 update proposal output，再经 `runtimeUpdateInteractionSpec.parseOutput()` 转成 `ProposedWikiUpdate[]` 并进入 pending staging。Redundancy Cleanup Phase 4 已移除未注入 adapter 时从 narration 中解析 `rpg-wiki-update` block 的过渡路径。

Stage 6.11 已经把 RPG runtime 中与 LLM 交互的 narration prompt/parse contract 收拢到 `src/lib/rpg-interactions/`：`narrationInteractionSpec` 负责 narration prompt 构造和 `RpgTurnResult` JSON 解析/校验，旧 `buildRpgNarrationPrompt()` 路径保留为兼容 wrapper；同时新增真实 runtime update LLM adapter，并让 UI 默认注入 dedicated runtime update interaction adapter。

Stage 6.12 已经把 `wiki/quests/` 明确为 objective tracking / runtime merge 目录，并对齐 bootstrap、turn references、context compiler、runtime update target policy、write policy、UI type/display 和文档契约。

Stage 6.15 已经在 runtime update proposal 进入 pending 前增加本地 path-aware validation：不新增第二轮 LLM 校验，不把 validator 结果反馈给 LLM 重试，只让 accepted proposals 进入可审阅 pending queue；rejected / warning issues 会进入 controller result 和 runtime journal 审计信息。

下一步不应该先做大纲重写，也不应该大规模迁移 ingest。更优先的小步是继续硬化现有 runtime 闭环：增强 runtime merge 语义，再升级 context compiler。完成这些后，再进入关系/张力推导、outline impact detection、outline regeneration 和整项目审计。

## 当前执行状态

已完成：

1. Stage 1 `RPG Runtime Agent v0 / Context Compiler v0`：`runRpgRuntimePreview()` / `compileRpgContext()` 只读编译 wiki 上下文为 `CompactStoryBrief`。
2. Stage 2 `RPG Turn Model`：`createRpgTurnRecord()` 从 `SubmittedAction + RpgTurnResult` 形成 completed `RpgTurnRecord`，并排除未选择的 `nextActionOptions`。
3. Stage 3 `Narration Prompt Builder`：`buildRpgNarrationPrompt()` 从 `CompactStoryBrief` 构建 narration prompt。
4. Stage 4 `RPG Play Panel v0`：独立 RPG play UI 组件和 play-panel state helper 已存在。
5. Stage 4.5 `Runtime Turn Orchestrator + Narration Adapter`：`runRpgTurn()`、`RpgNarrationAdapter`、`createFixtureNarrationAdapter()`、`validateRpgTurnResult()` 已串起单回合纵切。
6. Stage 5 `State Update Extractor + Pending Updates`：`extractRpgStateUpdates()`、`createPendingRpgUpdates()`、`acceptPendingRpgUpdate()`、`rejectPendingRpgUpdate()` 已建立纯内存状态更新提案与 pending update 暂存边界。
7. Stage 6 `Runtime Write Policy`：`applyRpgPendingUpdates()` 已建立显式写回边界，只应用 accepted pending updates，并继续拒绝 stable/manual/base/legacy 路径。
8. Stage 6.8 `Pending RPG Updates Review + Apply UI v0`：`PendingRpgUpdatesPanel` 与 `RpgRuntimePanel` 已支持逐条审阅、accept/reject、手动 apply accepted updates，并显示 applied/skipped/warnings。
9. Stage 6.9 `RPG Interaction Contract v0`：`src/lib/rpg-interactions/` 已提供统一 interaction spec 骨架、runtime update interaction spec，以及共享 runtime update target policy；现有 extractor/write-policy 已复用该 policy。
10. Stage 6.10 `Runtime Update Interaction Controller Integration v0`：`runRpgRuntimeTurnFlow()` 已支持注入 `RpgRuntimeUpdateInteractionAdapter`，通过 `runtimeUpdateInteractionSpec` 生成 proposed/pending updates；Redundancy Cleanup Phase 4 后 adapter 已成为必填。该阶段仍不写 wiki、不自动 apply、不接 UI 自动化。
11. Stage 6.11 `RPG LLM Interaction Boundary Consolidation v0`：`src/lib/rpg-interactions/` 已接管 narration prompt/parse contract，真实 runtime update LLM adapter 已存在，UI 默认提交路径会注入 dedicated runtime update interaction adapter；Redundancy Cleanup Phase 4 后 controller 不再保留 narration-block fallback。该阶段仍不写 wiki、不自动 accept/reject、不自动 apply，也不实现 Stage 7/8/9。
12. Stage 6.12 `Runtime Contract Alignment v0`：`wiki/quests/` 已选定为 objective tracking / runtime merge 目录；context compiler 读取 quests 并写入 `CompactStoryBrief.activeQuests`，turn references 允许 quest paths，runtime update target policy / extractor / write policy 只允许 `wiki/quests/*.md` 使用 `merge`，UI type/display 与前后端 bootstrap 文案保持一致。

近期阶段：

13. Stage 6.13 `Runtime Persistence v0`：已完成。持久化 turn records、pending updates、accept/reject/apply 结果，避免刷新或重开项目后丢失审阅队列。
14. Stage 6.14 `Runtime Apply Refresh + UI Reliability v0`：已完成。apply accepted updates 后刷新 current-scene、文件树和相关 UI 状态，并显示 affected paths / applied / skipped / warnings。
15. Stage 6.15 `Runtime Update Validation v1`：已完成。不新增第二轮 LLM 校验；在单次 runtime update proposal 输出后，通过更强 prompt/contract 和本地 path-aware lint 阻止明显违规内容进入可接受的 pending queue，并将 rejected / warning validation summary 保留在 controller result 和 runtime journal 中。
16. Stage 6.16 `Runtime Merge Semantics v1`：把当前 append-style merge 升级为 section-aware merge，降低 player、relationships、plot-arcs 和 runtime overlays 的旧状态污染。
17. Stage 6.17 `Context Compiler v1`：升级为多轮 LLM 参与的上下文编译链路，至少包含 recall/synthesis pass 与 narration-brief pass，并可在必要时增加 retrieval-planning pass。
18. Stage 7 `Relationship/Tension Deriver v0`：导入后推导隐式关系、张力、冲突和剧情钩子，并进入 review/pending。
19. Stage 8 `Outline Impact Detector v0`：在持久化和校验更稳定后，检测 accepted/applied runtime updates 是否冲击既有 plot arcs。
20. Stage 9 `Story Outline Regenerator v0`：仅在 major outline impact 后生成可审阅的大纲修订提案。
21. Stage 10 `Project Audit / Evaluation v1`：检查错误路由、状态污染、未选选项污染、越权写入和真实模型长回合稳定性。

## 当前前提

- 项目模式只支持 `llmwikirpg`。
- legacy/default 项目不是当前产品路径。
- 不自动删除磁盘上的 legacy 目录。
- `wiki/sources/` 仍是 RPG 证据层，不是 runtime 状态写回目标。
- `wiki/current-scene/scene_state.md` 是 RPG Play/Runtime apply 链路拥有的当前快照；ordinary source ingest 不生成、不更新 `current-scene`，也不把它作为 `needed_categories` 目标。
- ordinary source ingest 只能写 `sources`、`world`、`characters`、`player`、`locations`、`factions`、`items`、`plot-arcs`、`events`、`relationships` 以及已明确允许的辅助目录；如果来源描述正史场景，应路由到这些非 `current-scene` 目录。
- `characters`、`locations`、`factions`、`items` 的 base 页保存稳定设定，对应 `runtime/` overlay 保存游玩中变化。
- Stage 5 的 `PendingRpgUpdate` 是 Stage 6 的输入边界。
- Stage 6 已完成，只能应用 `status: "accepted"` 的 pending updates。
- `status: "pending"` 和 `status: "rejected"` 的 updates 在 Stage 6 中保持不写入。
- Stage 6.8 已完成，UI 只允许用户显式 accept/reject，并且只有手动点击 apply accepted updates 时才调用 `applyRpgPendingUpdates()`。
- Stage 6.8 不允许 UI 直接写 stable/manual/base/legacy 路径；这些路径仍由 Stage 6 write policy 再次拒绝。
- Stage 6.9 已完成，runtime update target policy 已抽到 `src/lib/rpg-interactions/wiki-update-policy.ts`，并被 extractor/write-policy 复用。
- Stage 6.9 只建立 runtime update interaction spec，不调用真实 LLM，不自动接入 `runRpgRuntimeTurnFlow()`，不写 wiki，不实现 relationship derivation / outline impact / outline regeneration。
- Stage 6.10 已解决 narration 与 update proposal 的 controller 边界不一致：narration 继续负责玩家可见叙事和候选选项，runtime update interaction 负责从 completed turn record 生成 `ProposedWikiUpdate[]`。
- Stage 6.10 的未注入 adapter 过渡路径已在 Redundancy Cleanup Phase 4 移除；`runRpgRuntimeTurnFlow()` 现在要求 dedicated runtime update interaction adapter。
- Stage 6.11 已把 narration prompt/parse contract 移入 `src/lib/rpg-interactions/narration-interaction.ts`，旧 `src/lib/rpg-runtime/narration-prompts.ts` 仅保留兼容 wrapper。
- Stage 6.11 已新增 `createLlmRpgRuntimeUpdateInteractionAdapter()`，它只调用真实 LLM 并返回 raw update proposal text，不解析、不写 wiki、不处理 pending 状态。
- Stage 6.11 已让 RPG runtime UI 默认创建并注入 dedicated runtime update interaction adapter；测试依赖仍可注入 fixture adapter 绕过真实 LLM。
- Stage 6.11 的 controller narration-block fallback 已在 Redundancy Cleanup Phase 4 移除；仍不自动 accept/reject/apply pending updates。
- Stage 6.12 已选择 `wiki/quests/` 作为 objective tracking 目录：它进入 context compiler、turn references、runtime update target policy 和 write policy；runtime 只能对 `wiki/quests/*.md` 提出或应用 `merge`，不得 `overwrite` / `append`，也不得影响 `style`、`rules`、`sources`、`memory` 或 stable/base/legacy 路径的拒绝规则。
- Outline impact detection 应推迟到 runtime contract、persistence、apply refresh、update validation、merge semantics 和 context compiler v1 之后；第一版仍应保持只读检测，不自动改写 `plot-arcs/`，也不自动触发大纲再生成。
- 未选择的 `nextActionOptions` 不是已发生事实，不能进入 write policy、events、current-scene、relationships 或 plot-arcs。

## 分阶段路线

### 阶段 1：RPG Runtime Agent v0 / Context Compiler v0（已完成）

目标：建立一轮游玩的只读运行时上下文编译地基。

已实现位置：

```text
src/lib/rpg-runtime/types.ts
src/lib/rpg-runtime/context-compiler.ts
src/lib/rpg-runtime/runtime-agent.ts
src/lib/rpg-runtime/index.ts
src/lib/rpg-runtime.test.ts
```

核心行为：

- 接收 `SubmittedAction`。
- 校验 `wikiMode === "llmwikirpg"`。
- 固定读取 `wiki/current-scene/scene_state.md`。
- 固定读取 `wiki/player/` 中的当前玩家状态。
- 优先读取近期 `wiki/events/`、活跃 `wiki/plot-arcs/`、相关 `wiki/relationships/`。
- 根据玩家行动检索相关 `characters/`、`locations/`、`factions/`、`items/`。
- 读取 `wiki/style/`、`wiki/rules/`、`wiki/memory/` 中的手动控制内容。
- 支持 base page + runtime overlay 的组合读取，例如 `wiki/characters/tohsaka-rin.md` + `wiki/characters/runtime/tohsaka-rin.md`。
- 忽略 legacy 目录。
- 剥离未选择的下一步行动选项，避免把 future candidates 当作事实。
- 只读，不产生剧情，不生成选项，不提取状态，不写回 wiki。

### 阶段 2：RPG Turn Model（已完成）

目标：让项目拥有独立于普通 chat message 的 RPG 回合数据结构。

已实现位置：

```text
src/lib/rpg-runtime/turn-model.ts
src/lib/rpg-turn-model.test.ts
```

核心类型：

```ts
interface SubmittedAction {
  id: string
  text: string
  source: "selected_option" | "freeform"
  selectedOptionId?: string
}

interface RpgActionOption {
  id: string
  playerFacingText: string
  intent: "investigate" | "talk" | "fight" | "move" | "wait" | "use_item" | "custom"
  riskLevel: "low" | "medium" | "high"
  likelyAffectedPaths: string[]
}

interface RpgTurnResult {
  narrative: string
  nextActionOptions: RpgActionOption[]
  references: string[]
}

interface RpgTurnRecord {
  submittedAction: SubmittedAction
  generatedNarrative: string
  references: string[]
}
```

关键规则：

- `RpgTurnRecord = SubmittedAction + generatedNarrative + references`。
- `nextActionOptions` 是下一轮候选输入，不属于已经发生的事实。
- 未选择的 option 不允许进入 `events/`、`current-scene/`、`relationships/`、`plot-arcs/`。
- references 会稳定清理、去重、排序，并过滤 legacy 路径。

### 阶段 3：Narration Prompt Builder（已完成）

目标：基于 `CompactStoryBrief` 构建玩家可见剧情和下一步行动选项的 narration prompt。

已实现位置：

```text
src/lib/rpg-runtime/narration-prompts.ts
src/lib/rpg-narration-prompts.test.ts
```

核心行为：

- 输入 `CompactStoryBrief`。
- 使用 `brief.submittedAction` 作为本轮唯一已提交行动。
- 输出 `{ systemPrompt, userPrompt }`。
- 要求未来模型输出 `RpgTurnResult` 形状。
- 要求生成 3 到 5 个下一步行动选项。
- 明确要求模型不要把候选选项写成已发生事实。
- 明确后续状态抽取只能基于 `SubmittedAction + generated narrative`。
- 不读写 wiki，不调用真实 LLM，不生成 pending updates。

### 阶段 4：RPG Play Panel v0（已完成）

目标：从普通 wiki QA chat 中分离出最小游玩界面。

已实现位置：

```text
src/components/rpg/rpg-play-panel.tsx
src/components/rpg/current-scene-panel.tsx
src/components/rpg/action-options-panel.tsx
src/components/rpg/turn-narrative-panel.tsx
src/components/rpg/index.ts
src/lib/rpg-runtime/play-panel-state.ts
src/lib/rpg-play-panel-state.test.ts
```

界面最小能力：

- 展示当前场景。
- 展示上一轮剧情输出。
- 展示下一步行动选项。
- 允许玩家选择选项或自由输入行动。
- 将选项选择构造成 `source: "selected_option"` 的 `SubmittedAction`。
- 将自由输入构造成 `source: "freeform"` 的 `SubmittedAction`。
- 保持未选择 options 的 future candidate 语义。
- 不写 wiki，不生成 pending updates，不抽取状态。

### 阶段 4.5：Runtime Turn Orchestrator + Narration Adapter（已完成）

目标：把 Stage 1 到 Stage 4 串成最小可运行单回合纵切。

已实现位置：

```text
src/lib/rpg-runtime/turn-orchestrator.ts
src/lib/rpg-runtime/narration-adapter.ts
src/lib/rpg-turn-orchestrator.test.ts
```

核心链路：

```text
SubmittedAction
  -> CompactStoryBrief
  -> RpgNarrationPrompt
  -> RpgTurnResult
  -> RpgTurnRecord
```

核心行为：

- `runRpgTurn()` 调用现有 runtime/context compiler 读取 wiki 上下文。
- 调用 `buildRpgNarrationPrompt()` 构建 narration prompt。
- 通过注入的 `RpgNarrationAdapter` 获取 `RpgTurnResult`。
- `validateRpgTurnResult()` 校验 adapter 输出。
- 调用 `createRpgTurnRecord()` 形成 completed turn record。
- 未选择的 `nextActionOptions` 不进入 `RpgTurnRecord`。
- 不写 wiki，不生成 pending updates，不接入真实 LLM。

### 阶段 5：State Update Extractor + Pending Updates（已完成）

目标：从完成的一轮中提取状态变更，但先进入待确认区。

已实现位置：

```text
src/lib/rpg-runtime/state-extractor.ts
src/lib/rpg-runtime/update-staging.ts
src/lib/rpg-state-extractor.test.ts
src/lib/rpg-update-staging.test.ts
```

核心链路：

```text
RpgTurnRecord
  -> extractRpgStateUpdates()
  -> ProposedWikiUpdate[]
  -> createPendingRpgUpdates()
  -> PendingRpgUpdate[]
```

关键规则：

- 只从 `RpgTurnRecord` 抽取。
- 事实来源只能是 `SubmittedAction + generatedNarrative + references`。
- 不从 `RpgTurnResult.nextActionOptions` 抽取。
- 使用显式 `rpg-wiki-update` fenced block 作为第一版确定性抽取机制。
- pending updates 默认状态为 `pending`。
- accept/reject helper 只改变内存状态，不写 wiki。
- proposed updates 限制在 runtime-safe target paths。

### 阶段 6：Runtime Write Policy（已完成）

目标：建立运行时写回权限边界。

Stage 6 只应用显式传入且已经 `accepted` 的 pending updates。它不自动挂入 `runRpgTurn()`，不自动挂入 UI，不自动接受 pending updates。

建议位置：

```text
src/lib/rpg-runtime/write-policy.ts
src/lib/rpg-write-policy.test.ts
```

已实现位置：

```text
src/lib/rpg-runtime/write-policy.ts
src/lib/rpg-write-policy.test.ts
```

已实现核心行为：

- `applyRpgPendingUpdates()` 只应用 `PendingRpgUpdate.status === "accepted"`。
- `pending` / `rejected` updates 返回 skipped，不写 wiki。
- Stage 6 会再次校验 path + strategy，不信任 Stage 5 输入。
- 所有实际写入限制在 `projectPath/wiki/...` 内。
- `current-scene` overwrite，`events` append/create，动态页和 runtime overlays 第一版采用保守 append-style merge。
- forbidden paths 返回 skipped/warnings，不写文件。
- 未自动接入 `runRpgTurn()`、UI、ingest、真实 LLM、大纲再生成或关系推导。

允许写入：

| 路径 | 策略 | 行为 |
|---|---|---|
| `wiki/current-scene/scene_state.md` | `overwrite` | 覆盖为 update content |
| `wiki/events/*.md` | `append` | 文件不存在则创建；存在则追加 update content |
| `wiki/player/*.md` | `merge` | 第一版可采用保守 append/section append |
| `wiki/relationships/*.md` | `merge` | 第一版可采用保守 append/section append |
| `wiki/plot-arcs/*.md` | `merge` | 第一版可采用保守 append/section append |
| `wiki/characters/runtime/*.md` | `merge` | 写 runtime overlay，不写 base page |
| `wiki/locations/runtime/*.md` | `merge` | 写 runtime overlay，不写 base page |
| `wiki/factions/runtime/*.md` | `merge` | 写 runtime overlay，不写 base page |
| `wiki/items/runtime/*.md` | `merge` | 写 runtime overlay，不写 base page |

禁止写入：

| 路径 | 原因 |
|---|---|
| `wiki/world/` | 稳定世界设定 |
| `wiki/rules/` | 手动规则 |
| `wiki/style/` | 手动文风与变量 |
| `wiki/sources/` | 证据层，不是 runtime 状态 |
| base `wiki/characters/*.md` | 稳定角色模型 |
| base `wiki/locations/*.md` | 稳定地点信息 |
| base `wiki/factions/*.md` | 稳定阵营信息 |
| base `wiki/items/*.md` | 稳定物品信息 |
| legacy llm_wiki 目录 | 已移除的产品路径 |
| `runtime/context_pack.md` / `runtime/turn_log.md` / `runtime/unresolved_threads.md` | 不在 Stage 6 first pass 范围 |

### 阶段 6.8：Pending RPG Updates Review + Apply UI v0（已完成）

目标：把 Stage 6.6/6.7 已经暴露到 UI 的 `PendingRpgUpdate[]` 变成可审阅、可确认、可手动应用的用户流程。

已实现位置：

```text
src/components/rpg/pending-rpg-updates-panel.tsx
src/components/rpg/rpg-runtime-panel.tsx
src/components/rpg/index.ts
src/components/rpg/pending-rpg-updates-panel.test.tsx
src/components/rpg/rpg-runtime-panel.test.tsx
```

已实现核心行为：

- `PendingRpgUpdatesPanel` 显示每条 pending update 的 `targetPath`、`strategy`、`status`、`reason`、`content` 和 `references`。
- 用户必须逐条显式点击 accept 或 reject；UI 不自动 accept pending updates。
- `RpgRuntimePanel` 使用已有的 `acceptPendingRpgUpdate()` / `rejectPendingRpgUpdate()` 更新本地 review 状态，不污染 `PendingRpgUpdate` 核心类型。
- `Apply accepted` 只在存在 accepted updates 时启用。
- 手动 apply 时，UI 只把 `status: "accepted"` 的 updates 传给 `applyRpgPendingUpdates({ projectPath, updates })`。
- `pending` / `rejected` updates 不传入 apply，不写 wiki。
- apply 结果显示最近一次 `appliedUpdates`、`skippedUpdates` 和 `warnings`。
- 已 applied 的 updates 从本地 review 列表移除；skipped updates 保留并显示跳过原因。
- Stage 6.8 不绕过 write policy，不直接写文件，不从 `nextActionOptions` 抽取事实。
- Stage 6.8 不实现 outline impact detection、outline regeneration、relationship/tension derivation 或 Stage 7-9 行为。

### 阶段 6.9：RPG Interaction Contract v0（已完成）

目标：建立最小统一交互协议层，先服务 runtime state update extraction，并把 runtime update target policy 从 extractor/write-policy 的重复逻辑中抽出。

已实现位置：

```text
src/lib/rpg-interactions/interaction-spec.ts
src/lib/rpg-interactions/runtime-update-interaction.ts
src/lib/rpg-interactions/wiki-update-policy.ts
src/lib/rpg-interactions/index.ts
src/lib/rpg-interactions.test.ts
```

已实现核心行为：

- 新增 `RpgInteractionSpec<TInput, TOutput>`、`RpgInteractionPrompt` 和 `RpgInteractionKind`，作为后续 runtime update、relationship derivation、outline impact、outline regeneration 等交互的统一描述骨架。
- 新增 `runtimeUpdateInteractionSpec`，输入 completed `RpgTurnRecord`，构建独立的状态更新提案 prompt。
- runtime update prompt 明确事实来源只能是 `submittedAction + generatedNarrative + references`，不允许从未选择的 `nextActionOptions` 抽取事实。
- runtime update prompt 明确 LLM 只能提出更新，不得声称已经写入 wiki；输出协议第一版继续使用 `rpg-wiki-update` fenced block。
- 新增 `getRpgRuntimeUpdateTargetRules()` 和 `validateRpgRuntimeUpdateTarget()`，集中表达 runtime-safe target paths 与 strategy 要求。
- 共享 target policy 覆盖 `current-scene` overwrite、`events` append、`player` / `relationships` / `plot-arcs` merge，以及 `characters` / `locations` / `factions` / `items` 的 `runtime/` overlay merge。
- `extractRpgStateUpdates()` 和 `applyRpgPendingUpdates()` 已复用共享 target policy，避免 extractor 和 write policy 各自维护一份 allowlist。

明确未实现：

- Stage 6.9 不调用真实 LLM。
- Stage 6.9 不自动接入 `runRpgRuntimeTurnFlow()`。
- Stage 6.9 不修改 UI。
- Stage 6.9 不调用 `applyRpgPendingUpdates()`。
- Stage 6.9 不写 wiki 文件。
- Stage 6.9 不实现 relationship derivation、outline impact detection、outline regeneration 或 Stage 7-9 行为。

验证命令：

```powershell
npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-narration-prompts.test.ts
npm.cmd run typecheck
```

### 阶段 6.10：Runtime Update Interaction Controller Integration v0（已完成）

目标：把 Stage 6.9 的 `runtimeUpdateInteractionSpec` 接入 runtime controller 链路，修正 narration prompt 不生成 update proposal 但 controller 仍从 narrative 提取 update block 的职责不一致。

已实现位置：

```text
src/lib/rpg-interactions/runtime-update-adapter.ts
src/lib/rpg-interactions/index.ts
src/lib/rpg-runtime/runtime-controller.ts
src/lib/rpg-runtime-controller.test.ts
src/lib/rpg-interactions.test.ts
```

已实现核心链路：

```text
SubmittedAction
  -> CompactStoryBrief
  -> RpgNarrationPrompt
  -> RpgTurnResult
  -> RpgTurnRecord
  -> RuntimeUpdateInteraction
  -> ProposedWikiUpdate[]
  -> PendingRpgUpdate[]
```

已实现行为：

- 新增 `RpgRuntimeUpdateInteractionAdapter`，用于接收 `RpgInteractionPrompt` 并返回原始 update proposal 输出字符串。
- 新增 `createFixtureRuntimeUpdateInteractionAdapter()`，测试中不调用真实 LLM。
- 从 `src/lib/rpg-interactions/index.ts` 导出新增 adapter 类型和 fixture helper。
- `RunRpgRuntimeTurnFlowInput` 已在 Redundancy Cleanup Phase 4 收敛为必填 `updateInteractionAdapter`。
- `runRpgRuntimeTurnFlow()` 会先完成现有 `runRpgTurn()`，得到 completed `RpgTurnRecord`，再用 `runtimeUpdateInteractionSpec.buildPrompt({ turnRecord })` 构建 prompt。
- controller 调用必填的 `updateInteractionAdapter.generateUpdateProposal(prompt)` 得到 raw output 后，用 `runtimeUpdateInteractionSpec.parseOutput(output, { turnRecord })` 转成 `ProposedWikiUpdate[]` 和 warnings。
- controller 继续用 `createPendingRpgUpdates()` 生成默认 `status: "pending"` 的 pending updates。
- 未传入 update interaction adapter 的过渡路径已移除；`extractRpgStateUpdates()` 保留为 `runtimeUpdateInteractionSpec.parseOutput()` 使用的 interaction output parser。
- 测试已确认：当 update interaction adapter 存在时，controller 使用 interaction 输出而不是 narration narrative 中的 update block。
- 测试已确认：narration 输出不包含 `rpg-wiki-update` block 时，interaction 输出仍可生成 pending updates。
- 测试已确认：非法 interaction target path 会返回 warnings，且不产生对应 proposed/pending update。
- 测试已确认：update interaction prompt 只从 completed turn record 构建，不包含未选择 `nextActionOptions` 的文本。
- 测试已确认：controller 仍不自动 accept/reject/apply pending updates，不写 wiki，不调用真实 LLM。

未实现且本阶段不得实现：

- 不自动调用真实 LLM。
- 不写 wiki。
- 不调用 `applyRpgPendingUpdates()`。
- 不自动 accept/reject pending updates。
- 不修改 UI。
- 不修改 ingest。
- 不实现 outline impact detection、outline regeneration 或 relationship derivation。
- 不迁移 narration 到 `rpg-interactions` 通用层，除非只做类型兼容所需的极小改动。
- 不执行 `git commit` / `git push`。

验证命令：

```powershell
npx.cmd vitest run src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-narration-prompts.test.ts
npm.cmd run typecheck
```

当前验证状态：

- 指定 Vitest 命令通过：7 test files / 65 tests。
- `npm.cmd run typecheck` 通过。

### 阶段 6.11：RPG LLM Interaction Boundary Consolidation v0（已完成）

目标：把 RPG runtime 中与 LLM 交互的 prompt / adapter / parse 边界统一收拢到 `src/lib/rpg-interactions/`，为后续 narration、runtime update、outline impact、outline regeneration、relationship derivation 使用同一套 interaction contract 做准备。

已实现位置：

```text
src/lib/rpg-interactions/interaction-spec.ts
src/lib/rpg-interactions/narration-interaction.ts
src/lib/rpg-interactions/llm-runtime-update-adapter.ts
src/lib/rpg-interactions/index.ts
src/lib/rpg-runtime/narration-prompts.ts
src/lib/rpg-runtime/llm-narration-adapter.ts
src/lib/rpg-runtime/narration-adapter.ts
src/lib/rpg-runtime/turn-orchestrator.ts
src/components/rpg/rpg-runtime-panel.tsx
src/lib/rpg-interactions.test.ts
src/lib/rpg-llm-narration-adapter.test.ts
src/lib/rpg-runtime-controller.test.ts
src/components/rpg/rpg-runtime-panel.test.tsx
```

已实现核心链路：

```text
SubmittedAction
  -> CompactStoryBrief
  -> NarrationInteraction
  -> RpgTurnResult
  -> RpgTurnRecord
  -> RuntimeUpdateInteraction
  -> ProposedWikiUpdate[]
  -> PendingRpgUpdate[]
```

已实现行为：

- `RpgInteractionKind` 已扩展 `"narration"`。
- 新增 `narrationInteractionSpec`，负责 narration prompt 构造和 LLM 输出 parse。
- `narrationInteractionSpec.buildPrompt({ brief })` 承接原 `buildRpgNarrationPrompt()` 的 prompt 逻辑。
- `narrationInteractionSpec.parseOutput(output, input)` 支持 fenced JSON、裸 JSON、短 prose 包裹 JSON，并通过 `validateRpgTurnResult()` 校验输出。
- `src/lib/rpg-runtime/narration-prompts.ts` 保留旧导出路径，作为薄 wrapper 委托给 `narrationInteractionSpec.buildPrompt()`。
- `createLlmRpgNarrationAdapter()` 仍负责真实 `streamChat()` 调用，但不再持有 JSON extraction / validation 主逻辑，输出解析委托给 narration interaction boundary。
- 新增 `createLlmRpgRuntimeUpdateInteractionAdapter()`，用于把 `RpgInteractionPrompt` 发送给真实 LLM 并返回 raw text。
- runtime update LLM adapter 不解析 proposal、不写 wiki、不 accept/reject pending、不调用 `applyRpgPendingUpdates()`。
- `RpgRuntimePanelDependencies` 新增 `createUpdateInteractionAdapter`。
- `submitRpgRuntimePanelAction()` 默认同时创建 narration adapter 和 runtime update interaction adapter，并把 `updateInteractionAdapter` 传给 `runRpgRuntimeTurnFlow()`。
- controller 中未注入 `updateInteractionAdapter` 时的 narration-block fallback 已在 Redundancy Cleanup Phase 4 移除；adapter 现在是必填运行时依赖。
- UI 默认路径现在使用 dedicated runtime update interaction，不再要求 narration 输出 `rpg-wiki-update` block 才能产生 pending updates。

未实现且本阶段不得实现：

- 不实现 Stage 7 outline impact detector。
- 不实现 Stage 8 outline regeneration。
- 不实现 Stage 9 relationship/tension derivation。
- 不新增 wiki 写入路径。
- 不修改 ingest 流程。
- 不自动 accept/reject pending updates。
- 不自动调用 `applyRpgPendingUpdates()`。
- 不移除 legacy fallback。
- 不执行 `git commit` / `git push`。

验证命令：

```powershell
npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-runtime-controller.test.ts src/components/rpg/rpg-runtime-panel.test.tsx
npm.cmd run typecheck
```

当前验证状态：

- 指定 Vitest 命令通过：5 test files / 66 tests。
- `npm.cmd run typecheck` 通过。
- Stage 6.11 完成状态已确认：narration prompt/parse contract、真实 runtime update LLM adapter、UI 默认 update-interaction 注入和 controller legacy fallback 均已记录；本阶段未引入新的 wiki 写入路径、自动 apply、ingest 改动或 Stage 7/8/9 行为。

### Stage 6.11 后的交互模块化判断

结论：Stage 6.11 已完成 narration prompt/parse contract 的集中整理，但这不意味着下一步应直接进入大纲检测。当前更大的风险已经从“没有 runtime 纵切”变成“runtime 纵切可运行但尚未足够持久、可审计、契约一致”。因此未来路线应先补齐 Stage 6.x 的 runtime 稳定闭环，再进入 relationship derivation、outline impact 和 outline regeneration。

- `narration`：Stage 6.11 已迁移 prompt/parse contract 到 `narrationInteractionSpec`。`rpg-runtime` 继续负责 `runRpgTurn()` 编排、`RpgNarrationAdapter` 抽象和 completed turn record 创建；旧 `buildRpgNarrationPrompt()` 入口保持兼容 wrapper。
- `runtime update`：Stage 6.10/6.11 已把 update proposal 从 narration 中拆出，Stage 6.13 已补上 runtime metadata 持久化；后续仍需要内容级校验、section-aware merge 和 apply 后 UI 状态刷新，否则后续大纲判断会建立在不稳定状态上。
- `context compiler`：当前 v0 已能读取关键 RPG 目录，但下一步应利用 selected option、`likelyAffectedPaths`、accepted recent events、runtime overlays 和 objective/quest 信息升级检索与预算，而不是继续只靠轻量关键词命中。
- `relationship derivation`：可以采用 interaction spec 表达“推导候选关系/张力”的协议，但 derivation 的事实过滤、confidence、review/staging、写回策略不应放进 `rpg-interactions`。它们应留在 `src/lib/rpg-derivation/` 或 runtime review 边界。
- `outline impact`：第一版仍应放在 `src/lib/rpg-runtime/outline-impact.ts`，保持只读、启发式、无真实 LLM。但它应排在 runtime persistence、validation、merge semantics 和 context compiler v1 之后。
- `outline regeneration`：本质更像 LLM-backed content regeneration，适合设计为 interaction spec。但 write/apply/review 边界仍应留在 runtime/write policy 一侧，`rpg-interactions` 只负责 prompt、adapter、parseOutput。
- `src/lib/rpg-interactions/` 的定位应保持为交互协议层：定义 prompt shape、adapter contract、parse output、共享 target policy。它不应承载文件读取、wiki 写入、pending 状态流转、UI 行为或大型业务编排。

建议顺序：继续完成 Stage 6.14 到 Stage 6.17 的 runtime 稳定化，再做 relationship/tension derivation，然后做 outline impact detector，最后做 outline regeneration 和整项目审计。不要为了“模块化”提前迁移 detector、regenerator、deriver 的非交互业务边界。

### 阶段 6.12：Runtime Contract Alignment v0（已完成）

目标：对齐 runtime 目录、引用、context compiler、write policy 和文档契约，先解决当前已暴露的边界漂移。

已选择的产品语义：

- `wiki/quests/` 是 objective tracking 目录，用于目标、任务、阻碍、完成状态和已接受的运行时目标变化。
- `quests` 不是 stable/manual/base 目录，但 runtime 只能使用 `merge`；`overwrite` 和 `append` 均拒绝。
- `quests` 进入 context compiler v0 的固定读取范围，写入 `CompactStoryBrief.activeQuests` 并进入 narration prompt。
- `quests` 可作为 turn references 和 `likelyAffectedPaths` 的合法 RPG path；legacy references 继续过滤。
- `quests` 不绕过 shared target policy，不影响 `style`、`rules`、`sources`、`memory`、stable/base 或 legacy path 的拒绝规则。

已实现位置：

```text
src/lib/rpg-runtime/types.ts
src/lib/rpg-runtime/context-compiler.ts
src/lib/rpg-interactions/narration-interaction.ts
src/lib/rpg-interactions/wiki-update-policy.ts
src/lib/rpg-runtime/turn-model.ts
src/lib/rpg-runtime/state-extractor.ts
src/lib/rpg-runtime/write-policy.ts
src/lib/project-mode.ts
src-tauri/src/commands/project.rs
src/lib/wiki-page-types.ts
src/lib/wiki-type-style.ts
```

已实现核心行为：

- Context Compiler v0 读取 `wiki/quests/*.md`，剥离未选择 action-option 文本，并把 quest pages 格式化到 `brief.activeQuests`。
- Quest pages 会加入 `brief.references`，同时 legacy dirs 继续被忽略。
- Shared runtime update target policy 新增 `wiki/quests/*.md | merge`，并由 extractor 和 write policy 复用。
- `validateRpgRuntimeUpdateTarget("wiki/quests/main.md", "merge")` 通过；`overwrite` / `append` 对 quests 失败。
- `wiki/style/`、`wiki/rules/`、`wiki/sources/`、`wiki/memory/`、base `characters/locations/factions/items` 和 legacy dirs 仍失败。
- Runtime update prompt 通过 shared target policy 自动列出 quests allowed rule，并继续强调只从 completed `RpgTurnRecord` 生成 proposed updates。
- Narration prompt 增加 `Active Quests` brief section。
- UI/type/display 文件已经识别 `quests`，本阶段保持 UI 设计不变并补充 focused type/style coverage。
- TypeScript bootstrap 与 Rust bootstrap 均创建 `wiki/quests`，文案统一为 objective tracking / manual-runtime merge。
- 未实现 runtime persistence、apply 后 UI refresh、runtime update semantic validation、section-aware merge、Context Compiler v1、relationship derivation、outline impact、outline regeneration 或真实 LLM 调用。

当前验证状态：

- 指定 Stage 6.12 Vitest 命令通过：10 test files / 102 tests。
- 额外 narration 回归通过：2 test files / 16 tests。
- `npm.cmd run typecheck` 通过。
- Stage 6.12 完成状态已确认：`wiki/quests/` 已在 runtime 读取、references、update target policy、write policy、prompt、UI type/display、bootstrap 文案和文档契约中对齐；legacy/default 支持未恢复，stable/manual/base/legacy 写入拒绝仍有效。

### 阶段 6.13：Runtime Persistence v0（已完成）

目标：让 runtime turn records、pending updates、accept/reject/apply 结果可恢复、可审计。

已实现位置：

```text
src/lib/rpg-runtime/runtime-persistence.ts
src/lib/rpg-runtime/runtime-controller.ts
src/components/rpg/rpg-runtime-panel.tsx
src/lib/rpg-runtime-persistence.test.ts
src/lib/rpg-runtime-controller.test.ts
src/components/rpg/rpg-runtime-panel.test.tsx
```

已实现核心行为：

- 使用 `.llm-wiki/runtime/` 作为内部 runtime 元数据目录，不写入 `wiki/` 正史。
- `turn-records.jsonl` 追加记录每轮 completed turn snapshot。
- `pending-updates.json` 覆盖保存当前 review queue，并保留 `pending` / `accepted` / `rejected` 状态。
- `apply-results.jsonl` 追加记录用户手动 apply 的结果摘要。
- 缺失 runtime metadata 返回空 pending queue；损坏 pending JSON 返回 warning + 空队列，不使 UI 崩溃。
- `runRpgRuntimeTurnFlow()` 支持可注入 turn journal persistence。默认纯 controller 路径仍不强制写文件。
- turn journal entry 记录 timestamp、`submittedAction`、`turnResult`、`turnRecord`、`proposedUpdates`、`pendingUpdateIds`、warnings，以及 proposal source；Redundancy Cleanup Phase 4 后 proposal source 固定为 `interaction`。
- RPG runtime panel 启动时恢复 pending queue；新回合产生 pending updates 后保存 queue；accept/reject 后保存 queue；apply accepted 后保存剩余 queue 并追加 apply journal。
- 已应用的 wiki 更新仍以 wiki 文件为事实来源，runtime journal 仅用于审计和恢复。

未实现范围：

- 不实现 apply 后 current-scene / 文件树 / graph / UI refresh。
- 不实现 runtime update semantic validation v1。
- 不实现 section-aware merge。
- 不实现 Context Compiler v1。
- 不实现 relationship/tension derivation。
- 不实现 outline impact / outline regeneration。
- 不调用真实 LLM，不修改 ingest，不改变 `wiki/quests/` Stage 6.12 语义。

当前验证状态：

- 指定 Stage 6.13/Stage 6 回归通过：7 test files / 61 tests。
- 项目模式、wiki type、runtime、turn-model、interaction 回归通过：6 test files / 65 tests。
- `npm.cmd run typecheck` 通过。

### 阶段 6.14：Runtime Apply Refresh + UI Reliability v0（已完成）

状态：已完成。

目标：让用户 apply accepted updates 后，运行界面和项目状态立即反映已接受事实。

重点：

- 如果应用了 `wiki/current-scene/scene_state.md` overwrite，Play 面板应重新读取并显示新场景。
- apply 后刷新文件树、搜索/图谱相关状态，至少触发已有项目文件 reload。
- 显示本次 affected paths、applied/skipped/warnings，并保留未处理 pending updates。
- 继续禁止自动 accept、自动 apply 或绕过 write policy。

完成说明：

- `RpgRuntimePanel` 已在手动 apply 后从 apply result 计算 affected paths。
- 如果实际 applied 结果包含 `wiki/current-scene/scene_state.md` overwrite，面板会重新读取 canonical current-scene 并更新 Play/Runtime 显示。
- apply 后复用现有项目文件状态入口刷新 file tree，并 bump `dataVersion`，让 graph/search 等相关状态沿用现有刷新信号。
- `PendingRpgUpdatesPanel` 已显示 affected paths、applied、skipped 和 warnings。
- pending/rejected 继续保留；accepted 但 skipped 的 update 不会静默丢失。
- write policy 仍是唯一写 wiki 边界；没有自动 accept、自动 apply 或直接 UI 写 wiki。

### 阶段 6.15：Runtime Update Validation v1

状态：已完成。

目标：在 update proposal 进入 pending 前增加内容级校验，但不新增第二轮 LLM 交互。

完成说明：

- 已新增 `src/lib/rpg-interactions/runtime-update-validation.ts` 作为纯 TypeScript path-aware validator。
- `runRpgRuntimeTurnFlow()` 已在 `ProposedWikiUpdate[]` 转成 `PendingRpgUpdate[]` 前调用 validator。
- 只有 accepted updates 会进入 `createPendingRpgUpdates()`；rejected updates 不进入可 accept 的 pending queue。
- warning-only updates 可以进入 pending，但 warning issues 会保留在 controller result 和 runtime turn journal 的 validation summary 中。
- runtime update prompt/contract 已明确单轮生成自检边界；未新增第二轮 LLM 调用、retry loop 或 validator-to-LLM 反馈。
- 未改变 `applyRpgPendingUpdates()` 写入权限，未自动 accept/reject/apply，未自动写 wiki，未修改 ordinary ingest 主流程。

设计决策：

- Stage 6.15 不做“LLM 二次审核”或“再问一次模型确认是否违规”。
- 仍然只保留当前 runtime update interaction 的一次 LLM 生成。
- 在生成 update proposal 的 prompt / output contract 中加入更明确的目录语义限制。
- 在 `runtimeUpdateInteractionSpec.parseOutput()` 或 pending staging 前增加本地、确定性、path-aware lint。
- lint 命中明显违规时，该 proposal 返回 warnings/review/skipped，不进入可由用户 accept 的 pending update。
- 该阶段接受启发式误差，不追求完整语义判定；风险由 prompt 约束、本地 lint、人工 review 和 write policy 共同承担。

重点：

- `events` 只允许确认发生的事件，不允许未来计划或候选行动。
- `current-scene` 只保存即时快照，不允许长期世界观、完整角色卡或事件流水。
- `plot-arcs` 允许 unresolved/future pressure，但不能伪造已发生事件。
- `relationships` 应记录关系变化和张力，不重复完整角色设定。
- validation 失败应返回 warnings/review/skipped，而不是生成可接受的 pending update。

建议实现位置：

```text
src/lib/rpg-interactions/runtime-update-validation.ts
src/lib/rpg-interactions/runtime-update-interaction.ts
src/lib/rpg-runtime/runtime-controller.ts
src/lib/rpg-runtime/update-staging.ts
src/lib/rpg-runtime/types.ts
src/lib/rpg-runtime-controller.test.ts
src/lib/rpg-runtime-update-validation.test.ts
```

建议接口：

```ts
export type RpgRuntimeUpdateValidationSeverity = "warning" | "reject"

export interface RpgRuntimeUpdateValidationIssue {
  severity: RpgRuntimeUpdateValidationSeverity
  code: string
  message: string
  targetPath: string
}

export interface RpgRuntimeUpdateValidationResult {
  acceptedUpdates: ProposedWikiUpdate[]
  rejectedUpdates: Array<{
    update: ProposedWikiUpdate
    issues: RpgRuntimeUpdateValidationIssue[]
  }>
  warnings: string[]
}

export function validateRpgRuntimeUpdateProposals(
  updates: ProposedWikiUpdate[],
): RpgRuntimeUpdateValidationResult
```

具体规则：

- `wiki/events/*.md`：
  - reject 明显未来计划、候选选项、下一步建议、可能行动、伏笔猜测、未选择 option 文本。
  - reject `Possible Futures`、`Next Actions`、`Foreshadowing`、`候选行动`、`未来可能` 等标题或等价内容。
  - 允许已发生事实、即时后果和明确完成的行动结果。
- `wiki/current-scene/scene_state.md`：
  - reject 长期世界观、完整角色卡、完整时间线、事件流水、路线回顾、多个历史事件列表。
  - reject 明显过长的 snapshot；第一版可以使用保守长度阈值和标题关键词。
  - 允许当前位置、在场角色、即时危险、玩家当前状态、可见线索、下一刻压力。
- `wiki/plot-arcs/*.md`：
  - 允许 unresolved pressure、open question、possible future、conflict pressure。
  - reject 把 possible/future 语言写入 `Confirmed Facts` 或用已发生语气描述未发生事件。
  - reject 将未选择候选行动写成已经发生。
- `wiki/relationships/*.md`：
  - 允许关系变化、信任/怀疑/张力、误会、秘密压力、触发条件。
  - reject 完整人物简介、角色卡、长 biography、能力设定、外貌资料重复。
- `wiki/player/*.md`、`wiki/quests/*.md`、runtime overlays：
  - warning 或 reject 明显事件流水、完整设定页、候选行动污染。
  - 保持第一版轻量，不扩大到复杂矛盾检测。

Controller / staging 行为：

- validator 应在 `ProposedWikiUpdate[]` 转成 `PendingRpgUpdate[]` 前运行。
- 通过 lint 的 update 才进入 `createPendingRpgUpdates()`。
- reject 的 update 不进入 pending queue，但其 issue 应进入 controller warnings 或 review-like summary，供 UI/日志展示。
- warning-only update 可以进入 pending，但 warning 必须保留在 controller result / journal 中。
- 不改变 `applyRpgPendingUpdates()` 的 write policy；write policy 仍是最后写入边界。
- 不自动 accept、reject、apply，也不写 wiki。

Prompt / contract 调整：

- 更新 runtime update interaction prompt，明确：一次生成内必须自检目录语义，不要输出会被本地 lint 拒绝的 proposal。
- 在 output contract 中强调 `events`、`current-scene`、`plot-arcs`、`relationships` 的边界。
- 不把 validator 结果反馈给 LLM 重试。



### 阶段 6.16：Runtime Merge Semantics v1

状态：已由 `docs/RPG_MERGE_PROMPT_REDESIGN.md` 后续执行覆盖完成，不再需要单独作为下一阶段执行。当前实现已通过 `mergeRpgSections()` 覆盖 ordinary page merge 与 accepted runtime `merge` 写入，支持 `player`、`quests`、`relationships`、`plot-arcs` 和 runtime overlays 的 section-aware merge；`events` 仍保持 append/create，`current-scene` 仍保持 overwrite。后续应先进入阶段 6.17a，补齐 runtime context schema contract，再进入阶段 6.17。

目标：把当前 append-style merge 升级为 section-aware merge，降低旧状态污染。

重点：

- 对 `player`、`relationships`、`plot-arcs`、runtime overlays 支持动态区块替换。
- 优先替换 `## Current State`、`## Runtime State`、`## Latest Accepted State` 等明确动态区块。
- 对无法结构化合并的内容，追加到 `## Runtime Update Log` 或等价历史区块。
- 保持 `events` append/create 和 `current-scene` overwrite 语义不变。

### 阶段 6.17a：Runtime Context Schema Contract

状态：阶段 A 已在文档层冻结契约；代码可读 schema helper 尚未实现。

目标：在实现 Context Compiler v1 前，先让 runtime context schema contract 明确依赖 `docs/RPG_WIKI_SCHEMA.md` 中冻结的 import mode 与固定 schema slot 契约。Context Compiler 后续读取优先级、缺文件 warning、runtime overlay 组合和 manual-control 保护都应以这些固定 slot 为基础，而不是绑定临时文件名、隐式目录约定或旧路径 fallback。

阶段 A 已冻结的四类 mode：

```text
source_ingest
control_doc_import
campaign_setup_import
runtime_update_apply
```

阶段 A 已冻结的固定 slot：

```text
wiki/outlines/main.md
wiki/outlines/progress.md
wiki/rules/core.md
wiki/rules/world.md
wiki/rules/table.md
wiki/style/narration.md
wiki/style/dialogue.md
wiki/style/forbidden.md
wiki/memory/long-term.md
wiki/memory/session-notes.md
wiki/memory/player-preferences.md
wiki/current-scene/scene_state.md
wiki/player/player.md
wiki/player/abilities.md
wiki/player/inventory.md
wiki/player/goals.md
wiki/player/known_information.md
```

原则：

- 固定 slot 是 Context Compiler 读取优先级、runtime context allowlist 和后续 import target policy 的基础。
- 缺失固定 slot 是全新 `llmWikiRPG` 项目结构不完整 warning 或可修复结构提示，不是 legacy fallback 场景。
- 本阶段只冻结文档契约，不新增 `src/lib/rpg-import/`，不实现 code-readable schema helper，不改 Context Compiler 代码。
- 不改变现有 runtime write policy，不扩大自动写入范围。
- `rules/`、`style/`、`memory/player-preferences.md`、`outlines/main.md` 默认 `manual_or_review_only`。
- `style`、`rules`、`memory` 中的用户控制块和硬规则优先级高于大纲指导。

必须敲定的 runtime context schema contract：

1. 大纲 / 剧情指导材料：

```text
wiki/outlines/main.md
wiki/outlines/progress.md
wiki/plot-arcs/*.md
wiki/plot-arcs/runtime/*.md
```

推荐 section：

```md
## Runtime Capsule
## Current Stage
## Dramatic Question
## Intended Pressure
## Next Useful Beats
## Delayed Reveals
## Branch Conditions
## Must Not Contradict
## Possible Futures
## Confirmed Facts
```

约定：

- `wiki/outlines/main.md` 是全局主线入口和作者/GM 侧剧情指导 slot，默认 manual/review-only，不由 runtime 每轮直接改写。
- `wiki/outlines/progress.md` 是 runtime progress slot，可由 `runtime_update_apply` 通过 pending/review merge 更新。
- `plot-arcs/*.md` 保存初始/稳定剧情弧结构、冲突、压力、伏笔和推进条件。
- `plot-arcs/runtime/*.md` 保存游玩中剧情弧状态变化，不直接改写 base `plot-arcs/*.md`。
- `Current Stage`、`Dramatic Question`、`Intended Pressure`、`Next Useful Beats` 应进入第二轮 Context Brief Compiler 的 outline slice。
- `Delayed Reveals` 和 `Must Not Contradict` 是高优先级约束，不应被 narration generator 随意揭露或改写。
- `Possible Futures` 只能作为可能发展，不得被编译成已发生事件。

2. 规则材料：

```text
wiki/rules/core.md
wiki/rules/world.md
wiki/rules/table.md
```

约定：

- `core.md` 放系统级跑团规则、判定边界、公平 DM 原则。
- `world.md` 放世界观硬规则、能力边界、文化/时代约束。
- `table.md` 放桌面流程、玩家输入解释、互动边界和安全/偏好规则。
- 三个固定 rules slot 默认 manual/review-only，ordinary source ingest 和 runtime apply 不静默改写。
- 固定文件不存在时记录新项目结构不完整 warning；后续实现不得把缺失解释为旧项目兼容 fallback。

3. 文风材料：

```text
wiki/style/narration.md
wiki/style/dialogue.md
wiki/style/forbidden.md
```

约定：

- `narration.md` 放叙述风格、节奏、视角、镜头和语言偏好。
- `dialogue.md` 放台词风格、角色声口保护、对话禁忌。
- `forbidden.md` 放禁用词、禁用句式、硬 gate、反套路规则。
- `{{setvar::...}}`、禁用词、hard gate 和用户显式控制块不可被普通压缩丢弃。
- 三个固定 style slot 默认 manual/review-only，ordinary source ingest 和 runtime apply 不静默改写。

4. 长期记忆 / 手动控制：

```text
wiki/memory/long-term.md
wiki/memory/session-notes.md
wiki/memory/player-preferences.md
```

约定：

- `long-term.md` 放跨场景长期事实、长期主题、用户希望长期保留的记忆。
- `session-notes.md` 放当前游玩 session 的人工备注和 DM 侧提醒。
- `player-preferences.md` 放玩家偏好、避雷、节奏倾向和交互习惯。
- `player-preferences.md` 默认 manual/review-only，ordinary source ingest 和 runtime apply 不静默改写。
- `memory` 默认只读进入 Context Compiler，不作为 runtime 自动写入目标；需要修改时走 control_doc_import 或人工审阅。

5. 运行时当前状态、固定玩家文件和任务：

```text
wiki/current-scene/scene_state.md
wiki/events/*.md
wiki/player/player.md
wiki/player/abilities.md
wiki/player/inventory.md
wiki/player/goals.md
wiki/player/known_information.md
wiki/quests/*.md
wiki/relationships/*.md
wiki/relationships/runtime/*.md
wiki/characters/runtime/*.md
wiki/locations/runtime/*.md
wiki/factions/runtime/*.md
wiki/items/runtime/*.md
```

约定：

- `current-scene/scene_state.md` 是 overwrite 快照，固定 critical 优先级读取；它不累计历史。
- `events/*.md` 是 append/create 历史事实层，只记录已经发生的事件；未来剧情、候选行动和未选择选项不得进入。
- `player/` 只允许固定五个文件；Campaign Setup Import 可初始化，Runtime Update Apply 只能在固定文件内 merge。
- `player`、`quests`、`relationships/runtime`、`plot-arcs/runtime` 和其他 runtime overlays 应优先读取 `Runtime Capsule`、`Current State`、`Latest Accepted State`、`Progress`、`Triggers` 等 runtime-facing sections。
- base `characters/locations/factions/items/relationships/plot-arcs` 保存稳定设定；runtime overlays 保存游玩中变化。
- `relationships/runtime/` 与 `plot-arcs/runtime/` 是 runtime overlay，不直接改 base 页。

6. 召回纪要 / 回合摘要：

```text
wiki/memory/turn-memos/*.md       // 可选后续落盘目录
runtime persistence turn journal  // 当前可用来源
```

约定：

- 第一版可以先从 runtime persistence 的 completed turn records / journal summary 读取，不强制立刻新增 `turn-memos` 落盘目录。
- 若未来新增 `wiki/memory/turn-memos/*.md`，每条纪要应有稳定 id、时间/turn 范围、涉及人物/地点/任务/plot arc 的索引字段或 capsule。
- Context Compiler 的召回轮优先读取 memo index/capsule，不应每轮扫描几百轮原始全文。

建议修改位置：

```text
docs/RPG_WIKI_SCHEMA.md
docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md
```

实现范围：

- 文档层明确 runtime context schema contract。
- 不实现 code-readable schema metadata/helper；该 helper 留给后续阶段。
- 不实现 Context Compiler v1 的 LLM 召回/brief 交互。
- 不实现 narration generator 改动。
- 不实现 outline impact detector 或 outline regeneration。
- 不改变 write policy、pending updates、runtime apply 或 ordinary ingest 写入策略。
- 不新增 `src/lib/rpg-import/`。
- 不新增或修改测试。

验收标准：

- `docs/RPG_WIKI_SCHEMA.md` 明确记录 runtime context contract。
- Context Compiler 所需的固定入口文件、缺文件 warning 和推荐 section 名称有清晰契约。
- 大纲材料、规则材料、文风材料、memory、current runtime state、turn memo 的读取优先级被记录。
- 固定 schema slots、固定 player 文件集合、`outlines/main.md` vs `outlines/progress.md`、base/runtime overlay 边界被记录。
- 全新项目固定文件、slot 路径和缺文件 warning 行为被记录，不再作为旧项目兼容 fallback 处理。
- 未改变后续 Stage 6.17 / Stage 7 / Stage 8 / Stage 9 的实现边界。

### 阶段 6.17：Context Compiler v1

详细方案见 `docs/CONTEXT_COMPILER_REDESIGN_PLAN.md`。本节只保留路线级摘要。

目标：把 Context Compiler v0 的确定性上下文拼装升级为可测试、可预算、固定两轮 LLM interaction 的上下文编译链路，让 runtime narration 在每轮生成前获得短而明确的运行时 brief，并让大纲材料被编译成本回合可执行的剧情推进压力。Context Compiler v1 的重点不是普通摘要，而是让系统能依据玩家行动、当前状态和未来大纲自主推进战役。

核心链路：

```text
SubmittedAction + recent turns + runtime anchors
  -> local candidate preparation
  -> LLM 1: Recall Selector / Memory Routing
  -> local read selected wiki materials
  -> LLM 2: Outline-aware Plot Advancement Brief Compiler
  -> narration generator input
```

必须实现：

- 第一轮 LLM 只做召回选择，输出 memo id、wiki path、runtime path、plot arc / quest / relationship path、priority、reason 和 exclusions，不输出长篇剧情总结。
- 第二轮 LLM 做 outline-aware plot advancement brief 编译，输入第一轮选中的实际材料、current-scene、固定 player slots、quests、relationships base + runtime overlays、plot-arcs base + runtime overlays、rules slots、memory slots 和 active outline slice，输出给 narration generator 的短 brief、导演判断和剧情推进义务。
- 第二轮必须输出本回合 campaign delta：至少说明 `thisTurnMustChange`、`pacingIntent`、`advancementStrength`、`pressureMove`、`revealPolicy` 和 `playerAgencyRule`，让 narration 不只是回应玩家，还要让世界产生可观察的推进。
- 大纲材料必须显式进入第二轮 brief，读取当前 schema slot 与章节语义：`wiki/outlines/main.md` 提供 Campaign Premise、Act Structure、Intended Reveals、Delayed Reveals、Branch Conditions、Must Not Contradict；`wiki/outlines/progress.md` 提供 Current Stage、Completed Beats、Divergence Notes、Next Useful Beats；active `plot-arcs/*.md` + `plot-arcs/runtime/*.md` 提供核心问题、当前阶段、未解决悬念、冲突结构、推进条件和 runtime beat 变化。
- selected option 的 `intent`、`riskLevel`、`likelyAffectedPaths` 必须作为强检索信号；freeform action 必须走本地候选准备和召回选择。
- `rules_core` / `rules_world` / `rules_table` 可进入 Context Compiler 判断行动边界；`style_narration` / `style_dialogue` 默认直达 narration generator，不由 Context Compiler 改写为二手文风摘要；`style_forbidden`、`memory_player_preferences`、`{{setvar::...}}`、禁用词和 hard gate 必须作为高优先级控制材料保留。
- LLM 只能选择或总结 runtime context allowlist 内的材料；实际读取、path validation、去重、排序、预算裁剪和 fallback 都必须由本地代码完成。
- 第一版必须支持注入式 adapter 和 fixture adapter；测试不依赖真实 LLM。
- LLM 失败时必须 fallback 到 v0 deterministic context compilation，并返回 warnings。
- 第一版不降级为 1 次 LLM，也不升级为 3 次 LLM；召回冲突、模糊输入和大纲偏离压力必须在固定两轮内通过 unresolved questions、warnings、branch allowance、do-not-railroad 和 must-not-contradict guidance 表达。

不得实现：

- 不生成玩家可见 narration，不生成 next action options，不预写完整 NPC 台词。
- 不提取或写入 wiki update，不创建 pending updates，不自动 accept/apply。
- 不把未选择的 `nextActionOptions` 当作已发生事实。
- 不让 LLM 自行决定读取任意磁盘路径；所有 wiki 读取必须经过 runtime context allowlist 和 path normalization。
- 不改变 Stage 6.15 runtime update validation 或 Stage 6.16 merge/write semantics。
- 不在 Context Compiler 阶段正式生成或应用大纲修订；大纲修订仍应在 narration 后、相关 runtime updates 被 accepted/applied 后进入 review proposal 流程。

建议实现位置：

```text
src/lib/rpg-interactions/context-compiler/
  recall-interaction.ts
  brief-interaction.ts
  context-compiler-adapter.ts
  index.ts
src/lib/rpg-runtime/context-compiler.ts
src/lib/rpg-runtime/context-retrieval.ts
src/lib/rpg-context-compiler.test.ts
src/lib/rpg-context-compiler-interactions.test.ts
```

验收标准：

- Context Compiler v1 默认支持两轮 LLM interaction：Recall Selector 与 Outline-aware Plot Advancement Brief Compiler。
- 每个正式叙事回合固定执行两轮 LLM interaction；LLM failure fallback 到 v0 deterministic compilation 不计为普通降级模式。
- 第二轮输出必须比召回材料短，并明确面向 narration generator，不面向玩家；如果 `thisTurnMustChange` 为空，应视为 brief 质量不足。
- fixture tests 覆盖 selected option、freeform action、likelyAffectedPaths、quests/objectives、recent accepted events、runtime overlays、outlines/main + outlines/progress guidance、plot-arcs base + runtime guidance、manual control blocks、campaign delta、pacingIntent、revealPolicy、固定两轮调用、LLM failure fallback 和未选择 option 污染防护。
- 更新 `docs/CURRENT_STATE.md` 与 `docs/IMPLEMENTATION_LOG.md`。

### 阶段 7：Relationship/Tension Deriver v0

目标：实现导入后的隐式关系与张力推导。

建议位置：

```text
src/lib/rpg-derivation/relationship-deriver.ts
src/lib/rpg-derivation/tension-deriver.ts
src/lib/rpg-derivation/derivation-review.ts
```

要点：

- 从 `characters/`、`events/`、`plot-arcs/`、`world/`、`dialogue corpus` 中推导隐式关系。
- 生成 `relationships/` 和 `plot-arcs/` 的候选更新。
- 使用 `source_kind: derived`、`confidence`、`derived_from` 标记。
- 默认进入 review/staging，避免把模型推测伪装成原作事实。

### 阶段 8：Outline Impact Detector v0

目标：检测玩家行动和已接受/已应用 runtime updates 是否显著冲击既有剧情大纲。

建议位置：

```text
src/lib/rpg-runtime/outline-impact.ts
```

需要检测的重大偏离：

- 关键角色死亡、失踪、背叛或提前加入。
- 阵营关系改变。
- 秘密提前揭露。
- 关键地点不可用。
- 关键物品被毁、转移、提前获得。
- 玩家行动让现有剧情大纲继续推进会显得强行。
- 关系张力已经变化，旧大纲无法自然承接。

第一版仍应只读、启发式、无真实 LLM，不自动改写 `plot-arcs/`。

### 阶段 9：Story Outline Regenerator v0

目标：当出现重大偏离时，生成未来剧情大纲修订提案。

建议位置：

```text
src/lib/rpg-runtime/outline-regenerator.ts
```

关键规则：

- 已发生事件不能被改写。
- 新大纲必须解释为什么故事转向。
- 新大纲应保留角色冲突、作品张力和长期主题。
- 不能为了回到原剧情而无视玩家行动造成的后果。
- 输出应进入 review/pending，不自动覆盖 `plot-arcs/`。

### 阶段 10：Project Audit / Evaluation v1

目标：系统性检查最终架构验收项。

重点：

- 检查 legacy 目录污染、未选择选项污染、events/plot-arcs/current-scene 混淆。
- 检查 runtime 越权写入、base page 被 runtime 改写、角色卡结构漂移。
- 增加真实模型 smoke benchmark：导入资料、运行多回合、审阅并应用更新、检查 wiki 状态。
- 输出可操作的 audit report，而不是只依赖 mock tests。

## Stage 6 详细执行计划（已完成记录）

### 建议接口

可以按代码实际情况微调命名，但建议保持 Stage 6 边界清晰：

```ts
export interface ApplyRpgPendingUpdatesInput {
  projectPath: string
  updates: PendingRpgUpdate[]
}

export interface AppliedRpgUpdate {
  id: string
  targetPath: string
  strategy: RpgUpdateStrategy
  status: "applied"
}

export interface SkippedRpgUpdate {
  id: string
  targetPath: string
  reason: string
}

export interface ApplyRpgPendingUpdatesResult {
  appliedUpdates: AppliedRpgUpdate[]
  skippedUpdates: SkippedRpgUpdate[]
  warnings: string[]
}

export function applyRpgPendingUpdates(input: ApplyRpgPendingUpdatesInput): Promise<ApplyRpgPendingUpdatesResult>
```

如果现有测试习惯更适合纯策略校验，也可以拆成：

```ts
validateRpgRuntimeWriteTarget(update): result
applyRpgPendingUpdates(input): Promise<ApplyRpgPendingUpdatesResult>
```

### Scope

必须实现：

- 新增 `src/lib/rpg-runtime/write-policy.ts`。
- 新增 `src/lib/rpg-write-policy.test.ts`。
- 从 `src/lib/rpg-runtime/index.ts` 导出 Stage 6 类型和 helper。
- 只应用 `PendingRpgUpdate.status === "accepted"` 的更新。
- 对 `pending` / `rejected` 更新返回 skipped 结果，不写文件。
- 再次校验 targetPath 与 strategy，即使 Stage 5 已过滤，也不能信任输入。
- `overwrite` 只用于 `wiki/current-scene/scene_state.md`。
- `append` 只用于 `wiki/events/*.md`。
- `merge` 只用于 `player`、`relationships`、`plot-arcs` 和 runtime overlays。
- 写入前创建必要父目录。
- 所有实际写入都必须限制在 `projectPath/wiki/...` 内。
- 更新 `docs/CURRENT_STATE.md`。
- 更新 `docs/IMPLEMENTATION_LOG.md`。

不得实现：

- 不自动接入 `runRpgTurn()`。
- 不自动接入 RPG Play Panel。
- 不自动接受 pending updates。
- 不实现真实 LLM 调用。
- 不实现 relationship deriver。
- 不实现 outline impact / regeneration。
- 不修改 ingest 流程。
- 不复用普通 wiki QA chat 作为 RPG runtime。
- 不从 `RpgTurnResult.nextActionOptions` 抽取或写入事实。
- 不写 stable/manual/base/legacy 路径。
- 不执行 `git commit` / `git push`。

### 测试要求

新增测试至少覆盖：

- `accepted` current-scene update 会 overwrite `wiki/current-scene/scene_state.md`。
- `accepted` event update 会 append 或 create `wiki/events/*.md`。
- `accepted` player / relationships / plot-arcs / runtime overlay update 会以 merge 语义写入。
- `pending` update 不写入。
- `rejected` update 不写入。
- legacy 路径被拒绝。
- stable/manual 路径 `world` / `style` / `rules` / `sources` 被拒绝。
- base `characters` / `locations` / `factions` / `items` 页被拒绝。
- strategy/path 不匹配时拒绝写入。
- 写入 helper 不读取或使用 `nextActionOptions`。
- Stage 1/2/3/4/4.5/5 回归测试仍通过。

建议验证命令：

```powershell
npx.cmd vitest run src/lib/rpg-write-policy.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts
npm.cmd run typecheck
```

### 完成标准

- 存在独立 Stage 6 runtime write policy 边界。
- 只能显式应用 accepted pending updates。
- pending/rejected updates 不写 wiki。
- allowed paths 按策略写入。
- forbidden paths 被拒绝并记录 skipped/warnings。
- Stage 6 不自动挂入 turn orchestrator 或 UI。
- Stage 6 不接入真实 LLM、不实现大纲/关系推导。
- `docs/CURRENT_STATE.md` 与 `docs/IMPLEMENTATION_LOG.md` 已更新。
- 指定测试与 typecheck 通过。
- 未执行 commit / push。

## 推荐执行顺序

1. Stage 1 `RPG Runtime Agent v0 / Context Compiler v0`：已完成。
2. Stage 2 `RPG Turn Model`：已完成。
3. Stage 3 `Narration Prompt Builder`：已完成。
4. Stage 4 `RPG Play Panel v0`：已完成。
5. Stage 4.5 `Runtime Turn Orchestrator + Narration Adapter`：已完成。
6. Stage 5 `State Update Extractor + Pending Updates`：已完成。
7. Stage 6 `Runtime Write Policy`：已完成。
8. Stage 6.8 `Pending RPG Updates Review + Apply UI v0`：已完成。
9. Stage 6.9 `RPG Interaction Contract v0`：已完成。
10. Stage 6.10 `Runtime Update Interaction Controller Integration v0`：已完成。
11. Stage 6.11 `RPG LLM Interaction Boundary Consolidation v0`：已完成。
12. Stage 6.12 `Runtime Contract Alignment v0`：已完成。
13. Stage 6.13 `Runtime Persistence v0`：已完成。
14. Stage 6.14 `Runtime Apply Refresh + UI Reliability v0`：已完成。
15. Stage 6.15 `Runtime Update Validation v1`：已完成。
16. Stage 6.16 `Runtime Merge Semantics v1`。
17. Stage 6.17 `Context Compiler v1`。
18. Stage 7 `Relationship/Tension Deriver v0`。
19. Stage 8 `Outline Impact Detector v0`。
20. Stage 9 `Story Outline Regenerator v0`。
21. Stage 10 `Project Audit / Evaluation v1`。

这个顺序的理由是：当前系统已经具备单回合 runtime 纵切和 pending/write/review 边界，下一步瓶颈不再是“缺少大纲检测模块”，而是“runtime merge 语义和上下文编译仍需继续稳定”。在 Stage 6.15 已完成 runtime update validation 后，继续把 merge semantics 和 context compiler v1 补齐，再做关系/张力推导、大纲冲击检测和大纲再生成，能减少后续基于不稳定状态做判断导致的返工。

## 近期验收标准

完成到 Stage 5 后，已经可以做到：

- 创建 `llmwikirpg` 项目。
- 导入资料并得到 RPG wiki 条目。
- 从 `current-scene` 开始一次游玩。
- 玩家输入行动。
- 系统编译 wiki 上下文为 `CompactStoryBrief`。
- 通过 narration adapter 获得玩家可见剧情和下一步行动选项。
- 系统形成不含未选择 options 的 `RpgTurnRecord`。
- 从 `RpgTurnRecord` 中抽取候选状态变更。
- 将变更放入 pending updates。
- pending updates 默认为待确认。
- 未选择的 options 不污染 pending updates。
- 不写 wiki，不应用 pending updates。

完成 Stage 6 后，应当可以做到：

- 只显式应用 accepted pending updates。
- pending/rejected updates 不写 wiki。
- 只允许写入动态栏目。
- 阻止 runtime 修改稳定设定、文风、规则、证据层和 base entity pages。
- 阻止 runtime 写入 legacy llm_wiki 目录。

完成 Stage 6.8 后，应当可以做到：

- UI 中审阅本回合生成的 pending updates。
- 用户逐条 accept/reject pending updates。
- 用户手动 apply accepted updates。
- apply 结果显示 applied/skipped/warnings。
- pending/rejected updates 不通过 UI 写入 wiki。
- 写回仍然只通过 `applyRpgPendingUpdates()`。

完成 Stage 6.9 后，应当可以做到：

- `src/lib/rpg-interactions/` 提供统一 interaction spec 骨架。
- runtime state update extraction 有独立的 prompt/spec 表达。
- allowed runtime update target policy 可被 extractor、write policy 和后续 outline/derivation 复用。
- narration、controller、UI、真实 LLM 和 wiki 写回行为未被自动改写。

完成 Stage 6.10 后，应当可以做到：

- runtime controller 能通过注入的 update interaction adapter 生成 update proposal output。
- `runtimeUpdateInteractionSpec.parseOutput()` 将 interaction output 转成 `ProposedWikiUpdate[]`。
- narration 不再需要把 `rpg-wiki-update` block 塞进玩家可见 narrative 才能产生 pending updates。
- 未注入 update interaction adapter 时，controller 保留 legacy narration-block extraction 过渡路径。
- pending updates 仍默认 `pending`，不自动 accept/reject/apply，不写 wiki。
- 指定 controller / interactions / extractor / staging / write-policy / orchestrator / prompt 测试与 typecheck 已通过。

完成 Stage 6.11 后，应当可以做到：

- narration 的 prompt/parse contract 已进入 `src/lib/rpg-interactions/narration-interaction.ts`。
- `buildRpgNarrationPrompt()` 旧导出路径仍可用，并委托给 `narrationInteractionSpec.buildPrompt()`。
- 真实 narration adapter 仍只负责 `streamChat()`，输出解析通过 narration interaction boundary。
- runtime update 的真实 LLM adapter 已进入 `src/lib/rpg-interactions/llm-runtime-update-adapter.ts`，并只返回 raw text。
- RPG runtime UI 默认提交路径会注入 dedicated runtime update interaction adapter。
- controller legacy narration-block extraction 仍作为未注入 adapter 时的 fallback 暂存。
- pending updates 仍进入 pending staging，不自动 accept/reject/apply，不写 wiki。
- Stage 7/8/9 仍未实现。

完成 Stage 6.12 后，应当可以做到：

- `wiki/quests/` 已明确为 objective tracking / runtime merge 目录。
- Bootstrap、docs、reference allowlist、context compiler、runtime update target policy、write policy 和 UI type/display 对 quests 的处理一致。
- Context compiler 能读取 `wiki/quests/*.md` 并把目标/任务信息放进 `CompactStoryBrief.activeQuests` 和 narration prompt。
- Runtime update proposal 可以生成 `wiki/quests/*.md` merge pending update，write policy 可以应用 accepted quests merge update。
- Quests 的 `overwrite` / `append` 会失败，stable/manual/base/legacy 写入拒绝仍有效。
- 未选择 `nextActionOptions` 仍不进入事实、pending updates 或 write policy。

完成全部阶段后，应当可以做到：

- 一轮一轮推进 RPG。
- 每轮更新当前场景、事件、玩家状态、目标进度、关系状态和 runtime overlays。
- runtime turn records、pending updates、accept/reject/apply 结果可恢复、可审计。
- accepted updates 进入更可靠的内容级校验和 section-aware merge，不持续污染动态状态页。
- context compiler 能利用 selected option、likelyAffectedPaths、recent accepted events、runtime overlays 和 objective/quest 信息。
- 通过关系/张力推导补足原资料中隐含但对游玩重要的冲突和互动压力。
- 检测重大剧情偏离。
- 必要时生成可审阅的后续剧情大纲修订提案。
- 用整项目审计检查错误路由、状态污染、未选选项污染、越权写入和真实模型长回合稳定性。

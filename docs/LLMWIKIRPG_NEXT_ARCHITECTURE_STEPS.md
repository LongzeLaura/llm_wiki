# llmWikiRPG 下一步架构实施路线

## 结论

当前 **Stage 6.8: Pending RPG Updates Review + Apply UI v0** 已完成。下一步最应该实现的是 **Stage 7: Outline Impact Detector**。

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

下一步不应该直接跳到大纲重写、关系推导或 UI 自动应用，而应先建立只读的大纲影响检测器：基于 completed turn record 与 accepted/applied runtime updates 判断本轮是否对既有 `plot-arcs/` 造成 `none` / `minor` / `major` 级别冲击。

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

下一步：

9. Stage 7 `Outline Impact Detector`：检测 accepted/applied runtime updates 是否对既有 plot arcs 造成重大偏离。

后续：

10. Stage 8 `Story Outline Regenerator`。
11. Stage 9 `Relationship/Tension Deriver`。

## 当前前提

- 项目模式只支持 `llmwikirpg`。
- legacy/default 项目不是当前产品路径。
- 不自动删除磁盘上的 legacy 目录。
- `wiki/sources/` 仍是 RPG 证据层，不是 runtime 状态写回目标。
- `characters`、`locations`、`factions`、`items` 的 base 页保存稳定设定，对应 `runtime/` overlay 保存游玩中变化。
- Stage 5 的 `PendingRpgUpdate` 是 Stage 6 的输入边界。
- Stage 6 已完成，只能应用 `status: "accepted"` 的 pending updates。
- `status: "pending"` 和 `status: "rejected"` 的 updates 在 Stage 6 中保持不写入。
- Stage 6.8 已完成，UI 只允许用户显式 accept/reject，并且只有手动点击 apply accepted updates 时才调用 `applyRpgPendingUpdates()`。
- Stage 6.8 不允许 UI 直接写 stable/manual/base/legacy 路径；这些路径仍由 Stage 6 write policy 再次拒绝。
- Stage 7 应保持只读检测，不自动改写 `plot-arcs/`，也不自动触发 Stage 8 大纲再生成。
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

### 阶段 7：Outline Impact Detector

目标：检测玩家行动和本轮剧情是否显著冲击原剧情大纲。

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

建议输出：

```ts
interface OutlineImpactResult {
  severity: "none" | "minor" | "major"
  affectedPlotArcPaths: string[]
  reason: string
}
```

### 阶段 8：Story Outline Regenerator

目标：当出现重大偏离时，自动修订未来剧情大纲。

建议位置：

```text
src/lib/rpg-runtime/outline-regenerator.ts
```

输入：

- 当前 `plot-arcs/`。
- 已发生 `events/`。
- 当前 `current-scene/`。
- 相关 `characters/` 与 runtime overlays。
- 相关 `relationships/` 和张力条目。
- `OutlineImpactResult`。

关键规则：

- 已发生事件不能被改写。
- 新大纲必须解释为什么故事转向。
- 新大纲应保留角色冲突、作品张力和长期主题。
- 不能为了回到原剧情而无视玩家行动造成的后果。

### 阶段 9：Relationship/Tension Deriver

目标：实现导入后的隐式关系与张力推导。

建议位置：

```text
src/lib/rpg-derivation/relationship-deriver.ts
src/lib/rpg-derivation/tension-deriver.ts
src/lib/rpg-derivation/derivation-review.ts
```

要点：

- 从 `characters/`、`events/`、`plot-arcs/`、`world/`、`dialogue corpus` 中推导隐式关系。
- 写入 `relationships/` 和 `plot-arcs/`。
- 使用 `source_kind: derived`、`confidence`、`derived_from` 标记。
- 默认进入 review/staging，避免把模型推测伪装成原作事实。

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
9. Stage 7 `Outline Impact Detector`：下一步。
10. Stage 8 `Story Outline Regenerator`。
11. Stage 9 `Relationship/Tension Deriver`。

这个顺序的理由是：先让系统能稳定读出一轮游玩所需的上下文，再生成剧情和 completed turn record，再从 completed turn record 抽取待确认状态更新，随后处理写回权限，最后处理大纲再规划和隐式张力推导。这样每一步都有可测试的独立价值，不会一开始就把 runtime、UI、写回、推导和大纲重写混在一起。

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

完成全部阶段后，应当可以做到：

- 一轮一轮推进 RPG。
- 每轮更新当前场景、事件、玩家状态、关系状态和 runtime overlays。
- 检测重大剧情偏离。
- 必要时自动修订后续剧情大纲。
- 通过关系/张力推导补足原资料中隐含但对游玩重要的冲突和互动压力。

## 可直接发给 Codex 新窗口的 Stage 7 计划

````text
你在 `c:\Users\Administrator\Documents\Works\Chem\worktrees\llm_wiki_rpg` 工作。

目标：实现 Stage 7：Outline Impact Detector。

请先阅读：

- `AGENTS.md`
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/RPG_DYNAMIC_UPDATE_STRATEGY.md`
- `src/lib/rpg-runtime/types.ts`
- `src/lib/rpg-runtime/turn-model.ts`
- `src/lib/rpg-runtime/state-extractor.ts`
- `src/lib/rpg-runtime/update-staging.ts`
- `src/lib/rpg-runtime/write-policy.ts`
- `src/lib/rpg-runtime/index.ts`
- existing RPG runtime tests under `src/lib/*rpg*.test.ts`

背景：

- Stage 1 到 Stage 4.5 已完成 `SubmittedAction -> CompactStoryBrief -> RpgNarrationPrompt -> RpgTurnResult -> RpgTurnRecord`。
- Stage 5 已完成 `RpgTurnRecord -> ProposedWikiUpdate[] -> PendingRpgUpdate[]` 的纯内存边界。
- Stage 6 已完成显式 runtime write policy：只应用 accepted pending updates，并只写允许的 runtime/dynamic 路径。
- Stage 7 的目标不是重写大纲，而是建立只读检测边界：判断本轮已完成行动和 accepted/applied runtime updates 是否对既有 `plot-arcs/` 造成重大偏离。

必须实现：

- 新增 `src/lib/rpg-runtime/outline-impact.ts`
- 新增 `src/lib/rpg-outline-impact.test.ts`
- 从 `src/lib/rpg-runtime/index.ts` 导出 Stage 7 类型和 helper
- 更新 `docs/CURRENT_STATE.md`
- 更新 `docs/IMPLEMENTATION_LOG.md`

建议接口：

```ts
export type RpgOutlineImpactSeverity = "none" | "minor" | "major"

export interface DetectRpgOutlineImpactInput {
  projectPath: string
  turnRecord: RpgTurnRecord
  updates: PendingRpgUpdate[]
}

export interface RpgOutlineImpactSignal {
  severity: Exclude<RpgOutlineImpactSeverity, "none">
  targetPath: string
  reason: string
}

export interface OutlineImpactResult {
  severity: RpgOutlineImpactSeverity
  affectedPlotArcPaths: string[]
  reason: string
  signals: RpgOutlineImpactSignal[]
  warnings: string[]
}

export function detectRpgOutlineImpact(input: DetectRpgOutlineImpactInput): Promise<OutlineImpactResult>
```

行为要求：

- Stage 7 必须只读，不写 wiki。
- 只分析 `PendingRpgUpdate.status === "accepted"` 的 updates；`pending` 和 `rejected` 必须忽略。
- 事实来源只能是 completed `RpgTurnRecord` 与 accepted updates 的 `content` / `targetPath` / `references`。
- 不从 `RpgTurnResult.nextActionOptions` 抽取或判断事实。
- 可读取 `wiki/plot-arcs/*.md` 用于识别受影响大纲；缺失目录应返回 warning，而不是失败。
- `affectedPlotArcPaths` 应稳定排序、去重，只包含 `wiki/plot-arcs/*.md`。
- 第一版可以采用保守启发式，不调用真实 LLM：
  - `major`：关键角色死亡/失踪/背叛/提前加入；关键秘密提前揭露；关键地点不可用；关键物品被毁/转移/提前获得；阵营关系大幅改变；本轮内容明确让既有 plot arc 无法自然承接。
  - `minor`：关系张力、玩家状态、角色 runtime overlay、地点/物品/阵营状态发生变化，但没有足够证据表明大纲被破坏。
  - `none`：没有 accepted updates，或 accepted updates 只包含普通事件/current-scene 快照且无大纲冲击信号。
- 如果 accepted update 直接写入 `wiki/plot-arcs/*.md`，该路径应进入 `affectedPlotArcPaths`。
- 如果 update references 或 turn references 指向 `wiki/plot-arcs/*.md`，也应进入 `affectedPlotArcPaths`。
- 如果无法定位具体 plot arc，但存在 `major` 信号，`severity` 仍应为 `major`，`affectedPlotArcPaths` 可以为空，并用 reason/warnings 说明。

不得实现：

- 不自动接入 `runRpgTurn()`
- 不自动接入 UI
- 不自动调用 `applyRpgPendingUpdates()`
- 不写入或修改 `wiki/plot-arcs/`
- 不实现 Stage 8 outline regeneration
- 不实现 relationship deriver
- 不调用真实 LLM
- 不修改 ingest 流程
- 不从 `RpgTurnResult.nextActionOptions` 抽取或写入事实
- 不执行 `git commit` / `git push`

新增测试至少覆盖：

- no accepted updates -> `severity: "none"`，不写文件。
- accepted普通 event/current-scene update 无重大信号 -> `severity: "none"` 或按实现说明保持无大纲影响。
- accepted relationship/player/runtime overlay update 有轻微信号 -> `severity: "minor"`。
- accepted update 含关键角色死亡/失踪/背叛 -> `severity: "major"`。
- accepted update 含关键物品 destroyed / lost / transferred 或关键地点 unavailable -> `severity: "major"`。
- accepted update 直接影响 `wiki/plot-arcs/*.md` 时返回 affected plot arc path。
- pending/rejected updates 被忽略。
- helper 不使用 `nextActionOptions`。
- helper 只读，不写 wiki 文件。
- Stage 1/2/3/4/4.5/5/6 回归仍通过。

建议验证命令：

```powershell
npx.cmd vitest run src/lib/rpg-outline-impact.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts
npm.cmd run typecheck
```

完成标准：

- Stage 7 outline impact detector 独立存在。
- 只读检测 accepted updates 对 plot arcs 的影响。
- pending/rejected 不参与影响判断。
- 能输出 `none` / `minor` / `major` severity。
- 能返回稳定的 `affectedPlotArcPaths`、signals、warnings。
- 不写 wiki、不自动重写大纲、不接 UI、不调用 LLM。
- 文档 `docs/CURRENT_STATE.md` 与 `docs/IMPLEMENTATION_LOG.md` 已更新。
- 指定测试与 typecheck 通过。
- 未执行 commit / push。
````

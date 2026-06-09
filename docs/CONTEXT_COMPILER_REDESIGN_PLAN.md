# Context Compiler 改造方案

## 目标

Context Compiler 的目标不是把 wiki 内容做普通摘要，而是在每轮玩家行动后、正式生成玩家可见剧情前，把 RPG 运行时知识库编译成一份短而有方向的 narration context brief。

它需要同时解决四件事：

- 从长期 wiki、回合纪要、当前状态和大纲中召回本轮真正相关的信息。
- 压缩几百轮对话带来的历史负担，避免 narration prompt 越来越胖。
- 让 `plot-arcs` / 大纲材料显式指导本轮剧情推进，而不是只靠当前状态自然闲聊。
- 保持 runtime 边界：不写 wiki、不生成 pending update、不把未选择选项当作事实。

## 推荐交互次数

默认 Context Compiler 每个正式叙事回合使用两次 LLM 交互：

```text
Local candidate preparation
  -> LLM 1: Recall Selector / Memory Routing
  -> Local read selected materials
  -> LLM 2: Outline-aware Context Brief Compiler
  -> Narration Generator
```

可降级为一次：

- selected option 已提供明确 `likelyAffectedPaths`。
- 当前回合延续同一场景，没有新 NPC、地点、任务、物品或大纲节点。
- 相关 capsule 很新，候选材料少于预算。

可升级为三次：

- 玩家输入高度模糊，例如“我去找上次那个人”。
- 本地索引和第一轮召回结果冲突。
- 多条剧情线、关系线或任务线同时交叉。
- 本轮可能严重冲击现有大纲。

第三次不应默认启用。它更适合作为 `Retrieval Repair / Outline Impact Probe`，用于澄清检索意图或提前提醒 narration generator 不要强行维护旧大纲。

## 第 0 步：本地候选准备

不调用 LLM。

输入：

- `SubmittedAction`。
- selected option 的 `intent`、`riskLevel`、`likelyAffectedPaths`。
- 当前 `wiki/current-scene/scene_state.md`。
- `wiki/player/*.md`。
- active `wiki/quests/*.md`。
- active `wiki/relationships/*.md`。
- runtime overlays。
- 最近 1-3 轮完整 turn records。
- 最近 accepted/applied updates 摘要。
- stable wiki capsule index。
- memo / turn journal index。
- `style`、`rules`、`memory` 的固定入口文件和 capsule。

输出：

- 候选 wiki path 列表。
- 候选 memo id 列表。
- 固定必带材料。
- 初始 token 预算。
- path allowlist validation warnings。

目标：

- 用确定性逻辑缩小候选范围。
- 固定带入 current-scene、player、硬规则和用户控制块。
- 禁止 LLM 决定任意读取磁盘路径。

## 第一轮：Recall Selector / Memory Routing

这一轮对应 SillyTavern “召回”任务，但 llmWikiRPG 不应只输出纪要编码，而应同时召回 wiki path、memo id、关系线、任务线和大纲线。

输入：

- stable wiki capsule index，不是所有 wiki 全文。
- memo / turn journal capsule index，不是几百轮原始全文。
- current-scene / player / quests / relationships 的短 runtime anchors。
- 最近 1-3 轮剧情。
- 本轮玩家输入。
- selected option metadata。
- 检索预算规则。

输出建议：

```ts
export interface RpgRecallSelection {
  memoIds: Array<{
    id: string
    priority: "must" | "useful" | "fallback"
    reason: string
  }>
  stableWikiPaths: Array<{
    path: string
    priority: "must" | "useful" | "fallback"
    reason: string
  }>
  runtimePaths: Array<{
    path: string
    priority: "must" | "useful" | "fallback"
    reason: string
  }>
  relationshipPaths: string[]
  questPaths: string[]
  plotArcPaths: string[]
  eventPaths: string[]
  exclusions: Array<{
    idOrPath: string
    reason: string
  }>
  unresolvedQuestions: string[]
}
```

目标：

- 决定本轮应该读取哪些历史记忆和 wiki 页面。
- 输出 ID / path / priority / reason，不输出长篇剧情总结。
- 通过 `exclusions` 避免召回已过期、已被后续事件覆盖或只是名字相似的旧材料。

预算建议：

- `memoIds <= 12`。
- `stableWikiPaths <= 8`。
- `runtimePaths <= 8`。
- relationships / quests / plot-arcs / events 合计不超过 12。
- 超预算时优先保留 `must`，丢弃 `fallback`。

本地后处理：

- 校验 path 是否存在。
- 校验 path 是否在 runtime context allowlist 内。
- 去重、排序、裁剪。
- 按 priority 读取完整内容、runtime sections 或 capsule。

## 第二轮：Outline-aware Context Brief Compiler

第二轮不是普通摘要器，而是把召回材料、当前状态和大纲意图编译成下一轮 narration generator 的导演提示。

输入分组：

1. 当前回合锚点：

- `SubmittedAction`。
- selected option metadata。
- 最近 1-3 轮 narration / turn summary。
- current-scene。
- player 当前状态。

2. 第一轮召回后的实际材料：

- selected memo contents。
- selected stable wiki pages / sections。
- selected runtime overlays。
- selected relationships。
- selected quests。
- selected events。

3. 大纲材料：

- active `plot-arcs`。
- `wiki/plot-arcs/main-outline.md`，如果存在。
- current arc objective。
- dramatic question。
- intended pressure。
- next useful beats。
- delayed reveals。
- branch conditions。
- must-not-contradict constraints。

4. 文风 / 规则 / 记忆硬约束：

- `wiki/style/narration.md`。
- `wiki/style/dialogue.md`。
- `wiki/style/forbidden.md`。
- `wiki/rules/core.md`。
- `wiki/rules/world.md`。
- `wiki/rules/table.md`。
- `wiki/memory/long-term.md`。
- `wiki/memory/session-notes.md`。
- `wiki/memory/player-preferences.md`。
- `{{setvar::...}}` 控制块。

5. 可选 outline impact risk：

- affected plot arc paths。
- risk reason。
- player action 可能造成的 branch pressure。

输出建议：

```ts
export interface RpgNarrationContextBrief {
  briefText: string
  mustRespectFacts: string[]
  currentSceneState: string[]
  playerActionInterpretation: string[]
  outlineGuidance: {
    activeArc: string
    currentStage: string
    dramaticQuestion: string
    thisTurnPurpose: string
    pressureToAdvance: string[]
    beatsToOffer: string[]
    hooksToSurface: string[]
    hooksToKeepHidden: string[]
    branchAllowance: string[]
    doNotRailroad: string[]
  }
  npcGuidance: Array<{
    name: string
    currentKnowledge: string[]
    motiveNow: string
    relationshipPressure: string[]
    likelyReaction: string
    voiceReminder: string
  }>
  questGuidance: string[]
  relationshipGuidance: string[]
  sceneTools: string[]
  styleAndRuleConstraints: string[]
  forbiddenAssumptions: string[]
  sourcePaths: string[]
  warnings: string[]
}
```

目标：

- 生成给 narration generator 的短 brief，而不是玩家可见剧情。
- 显式说明本轮大纲意图：推进什么压力、浮出哪些钩子、暂时隐藏哪些秘密。
- 允许玩家行动改变大纲走向，不允许为了维护旧大纲否定玩家行动。
- 压缩原始材料，保留 source paths。

预算建议：

- 普通回合：800-1500 tokens。
- 复杂回合：1500-2500 tokens。
- 重大剧情节点：不超过 3500 tokens。

超过预算时，应优先触发 capsule 更新或延后材料，而不是把完整 wiki 原文塞给 narration generator。

## 第三轮可选能力

第三轮不应常规使用，也不应直接取代后置 Outline Impact Detector。

可选用途：

1. `Retrieval Repair / Disambiguation`：

- 当玩家输入模糊或召回结果冲突时，重新判断要读取哪条线。

2. `Pre-narration Outline Impact Probe`：

- 在 narration 前判断玩家行动是否可能严重冲击现有大纲。
- 输出给 narration generator 的提醒：不要强行维护旧大纲、哪些后果需要诚实承接。

建议输出：

```ts
export interface RpgPreNarrationOutlineProbe {
  impactRisk: "none" | "minor" | "major"
  affectedPlotArcPaths: string[]
  pressurePoints: string[]
  narratorGuidance: string[]
  mustNotForceOriginalOutline: string[]
  possibleBranches: string[]
}
```

边界：

- 不在 Context Compiler 阶段正式改写大纲。
- 不生成 `plot-arcs` 更新。
- 不写 wiki。
- 不创建 pending updates。

正式大纲修订仍应发生在 narration 生成后，并最好等待相关 runtime updates 被 accepted/applied 后，再生成可审阅 outline revision proposal。

## 长篇几百轮的压缩策略

Context Compiler 不能每轮重新总结全部历史。它需要依赖多层 capsule：

- `scene capsule`：当前场景即时状态。
- `player capsule`：玩家状态、能力、物品、关系阶段。
- `quest capsule`：目标、进度、阻塞点。
- `relationship capsule`：信任、张力、秘密、误会、触发条件。
- `npc runtime capsule`：NPC 当前认知、状态、下一步动向。
- `arc capsule`：伏笔、未决悬念、可能冲突。
- `turn-log capsule`：每 5-10 轮滚动压缩一次。

第一版可以先读取 runtime persistence 的 completed turn records / journal summary，不强制新增 `wiki/memory/turn-memos/*.md`。但设计上应保留 memo id / turn range / related paths 的索引接口。

## 运行时边界

Context Compiler 不得：

- 生成玩家可见 narration。
- 生成 next action options。
- 提取或写入 wiki update。
- 创建 pending updates。
- 自动 accept/apply。
- 把未选择的 `nextActionOptions` 当作事实。
- 让 LLM 绕过 path allowlist 读取任意文件。
- 改变 Stage 6.15 runtime update validation。
- 改变 Stage 6.16 merge/write semantics。

LLM 失败时必须有 deterministic fallback：

- 使用 Context Compiler v0 的固定读取规则。
- 保留 current-scene、player、rules/style/memory、active quests、recent events。
- 返回 warnings。

## 建议实现顺序

1. Stage 6.17a：补 runtime context schema contract。
2. 新增本地 context retrieval / candidate preparation helper。
3. 新增 recall interaction spec 和 fixture adapter。
4. 新增 outline-aware brief interaction spec 和 fixture adapter。
5. 将 `compileRpgContext()` 升级为可注入 adapter 的 v1 流程。
6. 保留 v0 deterministic fallback。
7. 用 fixture tests 覆盖 selected option、freeform action、likelyAffectedPaths、quests、relationships、plot-arcs、runtime overlays、manual control blocks、LLM failure fallback 和未选择 option 污染防护。


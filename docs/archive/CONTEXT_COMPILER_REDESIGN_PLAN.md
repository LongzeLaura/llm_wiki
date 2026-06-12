# Context Compiler 改造方案

## 目标

Context Compiler 的目标不是把 wiki 内容做普通摘要，而是在每轮玩家行动后、正式生成玩家可见剧情前，把 RPG 运行时知识库编译成一份短而有方向的 narration context brief。它更核心的价值，是让系统能在玩家不主动编造剧情的情况下，依据玩家行动、当前状态和未来大纲，自主推动战役向前发展。

它需要同时解决六件事：

- 从长期 wiki、回合纪要、当前状态和大纲中召回本轮真正相关的信息。
- 压缩几百轮对话带来的历史负担，避免 narration prompt 越来越胖。
- 让 `plot-arcs` / 大纲材料显式指导本轮剧情推进，而不是只靠当前状态自然闲聊。
- 把未来大纲编译成本回合可执行的剧情推进义务，让每轮至少产生一个有意义的 campaign delta。
- 替代传统 AI roleplay 的全量设定注入，让 narration 只接收本回合需要的世界切片，而不是整份世界书。
- 保持 runtime 边界：不写 wiki、不生成 pending update、不把未选择选项当作事实。

Context Compiler 不是低配 narration。第一轮对应作家 / DM 大脑的“回忆”：这次行动应该想起哪些人物、事件、关系、伏笔和规则。第二轮对应作家 / DM 大脑的“临场判断”：这些记忆和大纲意味着本回合故事必须往哪里轻推一下、哪些秘密不能提前揭示、哪些压力应该浮出、哪些分支应允许玩家改变。

## 正式交互次数

Context Compiler 每个正式叙事回合固定使用两次 LLM 交互：

```text
Local candidate preparation
  -> LLM 1: Recall Selector / Memory Routing
  -> Local read selected materials
  -> LLM 2: Outline-aware Plot Advancement Brief Compiler
  -> Narration Generator
```

第一版不按回合复杂度降级到 1 次，也不升级到 3 次。`likelyAffectedPaths`、同场景延续、候选材料很少等情况只能影响本地候选准备和预算裁剪，不能跳过 Recall Selector。模糊输入、召回冲突或大纲冲击风险也只能通过两轮内的 warnings / unresolvedQuestions / brief guidance 表达，不在 Context Compiler v1 中临时加第三轮。

LLM 失败时仍必须 fallback 到 deterministic v0 compilation，但这是故障兜底，不是正式叙事回合的“1 次交互模式”。后续如果需要 retrieval repair、pre-narration outline impact probe 或 outline revision，应作为独立阶段/独立 interaction 接入，而不是塞回 Context Compiler v1 的常规链路。

两轮的分工必须保持清晰：

- 第一轮只决定“应该读什么”，不输出长篇剧情总结。
- 第二轮只决定“本回合应该如何推进”，不生成玩家可见正文、不预写台词、不生成下一步选项。
- Narration generator 才负责把 brief 写成玩家可见剧情与候选行动。
- 如果第二轮只是在重新排版召回材料，它就是冗余；它必须输出 narration 不应在落笔时临场承担的导演判断和剧情推进义务。

## 替代全量设定注入：设定可用性系统

传统 AI roleplay 常见做法是在 narration 时注入尽可能多的世界书、角色卡、规则和剧情资料。llmWikiRPG 不应沿用这个方向。narration generator 不需要“知道整个世界”，它只需要知道本回合该使用的世界切片、硬约束和推进意图。

Context Compiler v1 用一套设定可用性系统替代全量设定注入：

```text
全量设定注入
  -> 固定硬上下文
  -> capsule index
  -> 相关设定召回
  -> 导演 / 推进 brief
  -> source path 引用
  -> 后置状态写回
```

这套系统分别解决传统全量注入试图一次性解决的三个问题：

- 防遗忘：通过固定硬上下文、current-scene、player、quests、rules、forbidden style 和 player preferences 保留每轮必须在场的信息。
- 防矛盾：通过 `mustRespectFacts`、`forbiddenAssumptions`、`mustNotContradict`、runtime overlays 和 source paths 约束 narration。
- 防抓错重点：通过 Recall Selector 和 Plot Advancement Brief Compiler 决定本回合真正相关的设定、关系、伏笔和剧情压力。

### 固定硬上下文

以下材料不应依赖普通召回命中，而应作为每轮最低运行时上下文：

- `SubmittedAction`。
- `wiki/current-scene/scene_state.md`。
- 固定 player slots。
- active quests / objectives。
- `rules_core` 以及本回合相关的 `rules_world` / `rules_table`。
- `style_forbidden`、禁用词、hard gate 和用户显式控制块。
- `memory_player_preferences`。
- 最近 1-3 轮 completed turn records 或其可靠 capsule。

这些材料相当于 DM 桌面上始终摊开的资料。它们可以被压缩和结构化，但不能因为检索未命中而消失。

### Capsule-first 设定读取

稳定设定页、角色页、地点页、势力页、物品页、关系页和剧情弧页应优先通过 `Runtime Capsule` 进入 Context Compiler，而不是默认把全文交给 narration。

推荐每个 runtime-facing 页面都逐步具备：

```md
## Runtime Capsule

- 一句话定位：
- 对玩家行动的意义：
- 关键约束：
- 可触发钩子 / 压力点：
- 扮演 / 氛围提示：
- 不要误写成：
```

当本轮只需要背景定位时，读取 capsule 即可；只有当玩家行动直接触及该设定、冲突或规则细节时，才读取更完整的相关 section。Context Compiler 的预算裁剪应优先保留 capsule、硬约束、runtime overlay 和与本回合行动直接相关的 section，而不是保留完整百科正文。

### Narration 的知识边界

Narration generator 的知识边界应是：

- 可以自由发挥表达、节奏、镜头和玩家可见叙事。
- 必须遵守 brief 中的 fixed hard context、mustRespectFacts、forbiddenAssumptions、controlGuidance、plotAdvancement 和 outlineGuidance。
- 应优先使用 `sourcePaths` 中列出的材料作为本回合依据。
- 不应把未召回的稳定设定主动拉成本回合核心依据，除非该设定属于固定硬上下文或 narration prompt 的直达控制材料。
- 不应为了填补空白而发明世界事实、NPC 知识、地点状态、物品能力或已发生事件。

这不是要求 narration 只能机械复述 brief。相反，Context Compiler 负责把“需要知道什么”提前编译清楚，让 narration 把能力用在写作、表演、节奏和选项生成上，而不是在一大坨设定里临场检索。

### 后置写回形成长期记忆

全量设定注入还常被用来弥补模型对长期历史的不可靠记忆。llmWikiRPG 应通过后置状态写回替代这件事：

- 已发生事实进入 `events`。
- 当前即时状态覆盖 `current-scene`。
- 玩家变化合并进固定 player slots。
- 任务变化合并进 `quests`。
- NPC、地点、势力、物品的战役状态写入对应 `runtime/` overlay。
- 关系和剧情弧变化写入 `relationships/runtime/` 与 `plot-arcs/runtime/`。

下一轮 Context Compiler 读取的是 wiki 的运行时状态，而不是期待 narration 记住上一轮发生了什么。这样设定不会靠越来越大的 prompt 留在模型上下文里，而是通过 Markdown runtime knowledge base 持续沉淀。

## 第 0 步：本地候选准备

不调用 LLM。

输入：

- `SubmittedAction`。
- selected option 的 `intent`、`riskLevel`、`likelyAffectedPaths`。
- 当前 `wiki/current-scene/scene_state.md`。
- 固定 player slots：`wiki/player/player.md`、`wiki/player/abilities.md`、`wiki/player/inventory.md`、`wiki/player/goals.md`、`wiki/player/known_information.md`。
- 固定 outline slots：`wiki/outlines/main.md`、`wiki/outlines/progress.md`。
- active `wiki/quests/*.md`。
- active `wiki/relationships/*.md` + `wiki/relationships/runtime/*.md`。
- active `wiki/plot-arcs/*.md` + `wiki/plot-arcs/runtime/*.md`。
- characters / locations / factions / items 的 base + runtime overlays。
- 最近 1-3 轮完整 turn records。
- 最近 accepted/applied updates 摘要。
- stable wiki capsule index。
- memo / turn journal index。
- control slots index：`rules/*`、`style/*`、`memory/*` 固定入口文件及 capsule。

输出：

- 候选 wiki path 列表。
- 候选 memo id 列表。
- 固定必带材料。
- 初始 token 预算。
- path allowlist validation warnings。

目标：

- 用确定性逻辑缩小候选范围。
- 固定带入 current-scene、player、outline slots、规则硬约束和用户控制块索引。
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

## 第二轮：Outline-aware Plot Advancement Brief Compiler

第二轮不是普通摘要器，而是把召回材料、当前状态和大纲意图编译成下一轮 narration generator 的导演提示与剧情推进约束。

它要回答的核心问题不是“这些材料怎么总结”，而是：

- 玩家这一步之后，世界应该如何向前动一下？
- 本回合至少应该产生哪一个 campaign delta？
- 当前大纲中哪个 beat、压力、伏笔或关系张力最适合被轻推到前景？
- 哪些 reveal 只能暗示，不能直接揭露？
- 哪些旧大纲可以被玩家行动改变，哪些长期约束不能违反？
- 哪些材料只是背景，不应抢占本回合正文中心？

输入分组：

1. 当前回合锚点：

- `SubmittedAction`。
- selected option metadata。
- 最近 1-3 轮 narration / turn summary。
- current-scene。
- player 当前状态。

2. 第一轮召回后的实际材料：

- selected memo contents。
- selected stable wiki capsules / sections。
- selected runtime overlays。
- selected relationships base pages + runtime overlays。
- selected quests。
- selected events。

3. 大纲材料：

- `main_outline` slot：`wiki/outlines/main.md`。
  - `Runtime Capsule`：本轮最需要保留的作者/GM 侧指导。
  - `Campaign Premise`：战役核心前提。
  - `Act Structure`：章节 / 幕结构。
  - `Intended Reveals`：计划揭示的真相和节奏。
  - `Delayed Reveals`：暂时不能提前揭示的信息。
  - `Branch Conditions`：玩家行动可能改变路线的条件。
  - `Must Not Contradict`：后续不能违反的长期约束。
- `outline_progress` slot：`wiki/outlines/progress.md`。
  - `Runtime Capsule`：本轮最需要保留的当前进度。
  - `Current Stage`：当前处于哪一幕 / 哪个章节 / 哪个 beat。
  - `Completed Beats`：已完成、跳过、提前或延后的 beat。
  - `Divergence Notes`：玩家路线相对主线大纲的偏离。
  - `Next Useful Beats`：下一步最自然承接的 beat。
- active `plot-arcs/*.md` + `plot-arcs/runtime/*.md`。
  - `核心问题` / `未解决悬念`：形成 brief 中的 dramatic question。
  - `当前阶段`：形成 active arc stage。
  - `冲突结构` / `推进条件` / `后续推进建议`：形成 intended pressure、beatsToOffer 和 branchAllowance。
  - runtime overlay 中的 triggered / skipped / advanced / delayed beat：用于避免把旧大纲当成不可偏离事实。

4. Control slots / runtime control inputs：

- `rules_core`、`rules_world`、`rules_table`：可以进入 Context Compiler，用于判断行动边界、能力/资源限制、成功失败条件和不可违反规则。
- `style_narration`、`style_dialogue`：默认不由 Context Compiler 摘要成二手文风；它们应作为 narration generator 的直达控制材料或 source path 引用。
- `style_forbidden`：可作为 hard gate 输入 Context Compiler，并且必须直达 narration generator。
- `memory_player_preferences`：玩家长期偏好、安全边界和体验要求，权威高于普通 memory，应作为 hard control 输入。
- `memory_long_term`：跨场景长期提示和摘要，可供 Recall Selector / Brief Compiler 使用，但不能压过 `events`、`quests`、runtime overlays 等具体事实目录。
- `memory_session_notes`：近期会话笔记、人工备注、待整理材料；只作为低权威辅助材料。
- `{{setvar::...}}`、禁用词、hard gate 和用户显式控制块：不得被普通压缩丢弃，应作为 control block pass-through。

5. 本地 risk signals：

- affected plot arc paths。
- branch pressure reason。
- player action 可能造成的 outline divergence。

输出建议：

```ts
export interface RpgNarrationContextBrief {
  briefText: string
  mustRespectFacts: string[]
  currentSceneState: string[]
  playerActionInterpretation: string[]
  knowledgeBoundary: {
    alwaysOnContext: string[]
    recalledSettingSlice: string[]
    capsuleOnlyPaths: string[]
    expandedSectionPaths: string[]
    sourcePathPolicy: string[]
    doNotInvent: string[]
  }
  plotAdvancement: {
    pacingIntent:
      | "advance"
      | "pressure"
      | "reveal_hint"
      | "complicate"
      | "consolidate"
      | "transition"
    advancementStrength: "micro" | "medium" | "strong"
    thisTurnMustChange: string
    beatToApproach: string
    pressureMove: string
    revealPolicy: string
    doNotResolveYet: string[]
    playerAgencyRule: string
  }
  outlineGuidance: {
    activeArcPaths: string[]
    currentStage: string
    dramaticQuestion: string
    thisTurnPurpose: string
    pressureToAdvance: string[]
    beatsToOffer: string[]
    hooksToSurface: string[]
    hooksToKeepHidden: string[]
    branchAllowance: string[]
    mustNotContradict: string[]
    doNotRailroad: string[]
  }
  controlGuidance: {
    ruleConstraints: string[]
    playerPreferenceConstraints: string[]
    hardGates: string[]
    stylePassThroughPaths: string[]
    memoryHints: string[]
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
  forbiddenAssumptions: string[]
  sourcePaths: string[]
  warnings: string[]
}
```

目标：

- 生成给 narration generator 的短 brief，而不是玩家可见剧情。
- 显式说明本轮剧情推进义务：本回合必须改变什么、推进什么压力、浮出哪些钩子、暂时隐藏哪些秘密。
- 把未来大纲转化为本回合可执行的推进压力，而不是把未来大纲当作已经发生的事实。
- 允许玩家行动改变大纲走向，不允许为了维护旧大纲否定玩家行动。
- 明确本回合的知识边界：哪些材料是固定硬上下文、哪些设定被召回、哪些路径只读 capsule、哪些路径需要展开 section、哪些空白不得由 narration 发明。
- 不把全局文风改写成 Context Compiler 的二手摘要；文风固定 slot 以 pass-through path / control input 的形式交给 narration generator。
- 压缩原始材料，保留 source paths。
- 让 narration 既回应玩家行动，也让世界产生主动性；避免传统 AI roleplay 中“玩家不编剧情，剧情就停住”的问题。

第二轮不得：

- 预写最终 narrative。
- 预写完整 NPC 台词。
- 生成 `nextActionOptions`。
- 把 `style_narration` / `style_dialogue` 改写成二手文风摘要。
- 把大纲未来内容写成已发生事实。
- 为了推进大纲而否定玩家已经提交的合理行动。

预算建议：

- 普通回合：800-1500 tokens。
- 复杂回合：1500-2500 tokens。
- 重大剧情节点：不超过 3500 tokens。

超过预算时，应优先触发 capsule 更新或延后材料，而不是把完整 wiki 原文塞给 narration generator。

## 剧情推进与节奏策略

Context Compiler v1 的默认原则是：每个正式叙事回合都应产生至少一个 campaign delta。这个 delta 不一定立刻写入 wiki，但 narration 应该让它在正文中发生，后续 runtime update 才有可抽取的状态变化。

campaign delta 分三档：

| 档位 | 含义 | 示例 |
|---|---|---|
| `micro` | 轻微推进，适合观察、闲聊、谨慎行动或低风险回合。 | 新线索、NPC 态度细微变化、危险逼近、资源轻微消耗、伏笔从背景浮出一点。 |
| `medium` | 明确推进，适合连续低推进后、玩家主动调查/谈判/移动/施压后。 | 任务阶段变化、NPC 主动行动、关系升级/降级、场景转折、敌对势力反应。 |
| `strong` | 重大推进，只在条件满足或玩家高风险行动后使用。 | 重大 reveal、战斗爆发、路线分歧、章节切换、关键 NPC 立场改变。 |

第一版不实现用户可调的“剧情推进速率”参数，但第二轮 brief 应保留 pacing 字段。默认策略：

- 普通回合至少 `micro` 推进。
- 连续 2-3 个低推进回合后，应倾向引入 `medium` 压力，除非当前场景明确处于休整 / 结算状态。
- `strong` 推进必须有玩家行动、当前状态、规则或大纲条件支撑，不能为了刺激而硬触发。
- 玩家选择等待、观察或回避时，世界仍可推进压力，但不能把玩家未做的行动写成已发生事实。
- 推进剧情不等于强行推进大纲；如果玩家行动合理地偏离旧路线，第二轮应给出 `branchAllowance` 和 `doNotRailroad` 指示。

大纲在第二轮中的形态不是剧本，而是推进资源：

- `Current Stage` 判断当前处于哪个章节 / beat。
- `Next Useful Beats` 提供可自然靠近的下一步。
- `Branch Conditions` 判断玩家行动是否足以触发分支。
- `Delayed Reveals` 和 `Must Not Contradict` 控制不能提前说破的内容。
- `plot-arcs` 的核心问题、未解决悬念和推进条件形成本回合的 dramatic question、pressureMove 和 hooksToSurface。

第二轮输出必须让 narration 明确知道“这一回合不能只漂亮回应，还要让什么发生变化”。如果 `thisTurnMustChange` 为空，这一轮 brief 应视为质量不足。

## 非目标：第三轮和大纲修订

Context Compiler v1 不实现第三轮 `Retrieval Repair / Disambiguation` 或 `Pre-narration Outline Impact Probe`。模糊输入、召回冲突和大纲偏离压力必须在固定两轮链路内通过 `unresolvedQuestions`、warnings、`branchAllowance`、`doNotRailroad` 和 `mustNotContradict` 表达。

后续如果需要正式的 retrieval repair、outline impact detector 或 outline revision proposal，应在 Context Compiler 之后作为独立 interaction / 独立阶段实现：

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
- 保留 current-scene、固定 player slots、outline slots、rules slots、style hard gates / pass-through paths、memory player preferences、active quests、recent events 和 runtime overlays。
- 返回 warnings。

## 建议实现顺序

1. 基于已完成的 fixed schema slot / import mode / overlay resolver 口径，确认 `compileRpgContext()` 的 v0 deterministic fallback 仍可运行。
2. 新增本地 context retrieval / candidate preparation helper，并把 path allowlist、slot-first reads、base + runtime overlay 组合留在本地代码。
3. 在 `src/lib/rpg-interactions/context-compiler/` 新增 recall interaction spec、parser、fixture adapter，并注册 interaction kind。
4. 在 `src/lib/rpg-interactions/context-compiler/` 新增 outline-aware plot advancement brief interaction spec、parser、fixture adapter，并注册 interaction kind。
5. 将 `compileRpgContext()` 升级为可注入 adapter 的 v1 固定两轮流程。
6. 保留 v0 deterministic fallback，但只作为 LLM failure fallback，不作为普通 1 次交互模式。
7. 用 fixture tests 覆盖 selected option、freeform action、likelyAffectedPaths、quests、relationships、plot-arcs、runtime overlays、manual control blocks、campaign delta、pacingIntent、revealPolicy、LLM failure fallback、固定两轮调用和未选择 option 污染防护。

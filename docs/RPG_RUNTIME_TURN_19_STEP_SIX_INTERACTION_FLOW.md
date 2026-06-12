# RPG Runtime 回合流程：19 步 / 最小 6 次 LLM 交互 / 重大大纲偏离 7 次

本文记录一个更细的 RPG Runtime turn flow。常规回合按最小 6 次 LLM 交互计算，但保留 19 个职责边界；当 Outline Impact Detector 判定本回合造成重大大纲偏离时，在第 14 步和第 15 步之间插入条件步骤 14.5，额外调用 Story Outline Regenerator，因此重大偏离回合为 7 次 LLM 交互。核心原则是：行动解析前只做最小上下文读取；行动后先形成 working state，再做总召回；最终 wiki 写回必须经过 proposal / pending / review / apply 边界。

## 交互总览

| LLM 轮次 | 覆盖步骤 | 作用 |
|---|---|---|
| LLM 1 | 2-5 | Action Resolver：解析意图、事件草案、可行性、`timeDelta`、`progressPotential` 和直接结果。 |
| LLM 2 | 7-10 | World Tick + Reaction：根据 `timeDelta`、pacing debt 和世界时钟推进玩家可见线、平行线、情感/张力线，结算倒计时、广播情报、生成反应队列。 |
| LLM 3 | 13 | Recall Selector：基于行动后 working state 做总召回。 |
| LLM 4 | 14 | Outline-aware Brief Compiler + Outline Impact Detector：按三线、pacing policy 和关键节点真空期过滤大纲，生成给叙事器的短指导，并检测本轮是否冲击大纲。 |
| 条件 LLM +1 | 14.5 | Story Outline Regenerator：仅在重大大纲偏离时触发，生成本轮临时生效的 provisional outline patch 和可审阅的大纲修订提案。 |
| LLM 5 | 15 | Narration Generator：根据 brief 或 provisional outline patch 生成玩家可见正文、平行线正文、情感/张力摘要与下一步选项，并执行必要的时间压缩或场景切换。 |
| LLM 6 | 17 | Runtime Update Proposal：生成三线和节奏时钟对应的 wiki 更新提案，进入 pending/review。 |

常规回合跳过第 14.5 步，仍是 6 次 LLM 交互。第 14.5 步如果触发，虽然发生在玩家可见叙事之前，但不改变基础轮次命名；实现日志中可以记为 `LLM 4b`、`conditional outline regeneration` 或 `LLM +1`。

## Schema 改造计划记录

本节记录围绕各轮 LLM 交互讨论出的 schema 改造需求。它不是一次性实现清单，而是后续逐轮讨论时用于对照 `docs/RPG_WIKI_SCHEMA.md`、code-readable schema 和 runtime prompt 的设计备忘。每一轮新增需求都应说明：现有 schema 是否足够、缺口在哪里、哪些内容应落入 wiki 固定 slot、哪些内容只属于运行时交互契约或 `.llm-wiki/runtime/` 元数据。

### Schema 实施策略：共享骨架 + 模块推进

当前更稳妥的实现策略不是先把 6 / 7 轮 runtime schema 一次性全部改完，也不是完全按模块临场补字段，而是先落一层最小共享 schema 骨架，再按照 Action Resolver、World Tick + Reaction、Recall Selector、Outline-aware Brief Compiler、Narration Generator、Runtime Update Proposal 的顺序逐模块推进。

先做共享骨架的目的，是避免后续各模块重复定义同义字段或产生软冲突。第一步只应落地跨模块必然复用的契约，包括：

- `NarrativeLine`、`UsePurpose`、`VisibilityScope`、`KnowledgeScope`、`KnowledgeSourceKind`、`HappenedStatus`、`RuntimeDeltaRef`。
- `timeDelta`、pacing、clock / countdown、gap / outline impact 的基础字段和枚举边界。
- 普通 `wiki/` 持久事实层、runtime overlay、`outlines/` 控制层、turn record / journal / `.llm-wiki/runtime/` 中间产物之间的边界。
- `current-scene/scene_state.md`、`player/known_information.md`、`outlines/progress.md`、`rules/` 在 Action Resolver 前置快照中的最低语义要求。
- 所有新增到 `wiki/` 页面的 runtime-facing 可检索区块，都必须同步定义稳定的 section 语义。自然语言标题只能作为展示标题或别名；机器检索、`retrievalIndex`、`RecallSelection` 和本地读取层必须依赖稳定的 `sectionId` / `sectionRole` / `readMode` / visibility metadata，而不是依赖标题文本猜测。

这一步不应把所有 LLM 2-6 的字段一次性实现成完整代码，也不应提前修改所有 runtime prompt。共享骨架只负责给后续模块提供稳定词汇、落点和禁止越界规则。特别需要在这一阶段处理一个已知文档冲突：旧 `docs/RPG_WIKI_SCHEMA.md` 仍描述普通 `runtime/` wiki 目录，而本流程要求每轮中间产物进入 turn record / journal / `.llm-wiki/runtime/`，不要把 `runtime/` 当作普通可抽取 wiki category。

共享骨架之后，第一个真正落地模块应是 Action Resolver。原因是 Action Resolver 是后续所有 runtime 模块的事实入口：如果它不能稳定产出玩家意图、事件草案、可行性、直接结果、`timeDelta` 和 `progressPotential`，后续 World Tick、Narration 和 Runtime Update Proposal 都会被迫从叙事正文里倒推事实。第一版实现应把当前流程从：

```ts
preview -> narration -> turnRecord -> update proposal
```

推进到：

```ts
preview -> actionResolution -> narration -> turnRecord -> update proposal
```

这一版仍不急着实现 World Tick。`ActionResolution` 先作为 narration prompt 的硬约束输入，并写入 turn record / runtime journal，降低叙事器自行裁判和后续 update proposal 从正文倒推事实的风险。World Tick + Reaction 等后续模块再消费这个稳定的 `ActionResolution`，逐步把流程推进到完整 19 步。

建议将接下来的实现阶段拆成五个小阶段：

1. **Schema Spine 小阶段**：更新 `docs/RPG_WIKI_SCHEMA.md` 和 `src/lib/rpg-wiki-schema.ts`，只补共享 runtime 契约、Action Resolver 必需固定 slot 语义，以及普通 wiki 与 `.llm-wiki/runtime/` 的边界。
2. **Action Resolver Contract 小阶段**：新增 `ActionResolverInput`、`PreActionSnapshot`、`ActionResolution`、`PlayerActionDelta` 等类型，输出只结算玩家行动本身，不推进世界、不写 wiki、不生成玩家可见正文。
3. **Action Resolver Interaction 小阶段**：新增 Action Resolver interaction spec、adapter、parser / validator。prompt 必须强制返回结构化 JSON，并强调玩家行动是 attempt，不是自动成功事件；`eventDraft.status` 默认 `attempted_not_confirmed`；可行性、代价、阻碍、直接结果、`timeDelta`、`progressPotential`、references 和 warnings 必须分开。
4. **Orchestrator 接入小阶段**：让 `runRpgTurn` 先调用 Action Resolver，再把 `ActionResolution` 作为 Narration Generator 的约束输入，同时把它保存进 turn record / journal。此阶段仍保留现有 runtime update proposal 边界，不引入 World Tick。
5. **测试小阶段**：补 Action Resolver parser / validator 测试、prompt 边界测试、orchestrator fixture 测试、turn record / journal 持久化测试，并确认 update proposal 仍不能从未选择 option、未确认尝试或 `attempted_not_confirmed` 草案中抽取已发生事实。

因此，后续实现口径是：先共享骨架，再 Action Resolver 边搭建边改对应 schema；不要先做全量 schema 大工程，也不要让单个模块私自发明未来模块也会使用的基础字段。

#### Schema Spine 小阶段实现记录（2026-06-10）

第 1 个小阶段 **Schema Spine 小阶段** 已完成。本轮只落地共享 runtime schema spine 和边界说明，没有推进后续 2-5 小阶段。

已实现内容：

- `docs/RPG_WIKI_SCHEMA.md` 新增 Runtime Schema Spine / 运行时共享契约，明确普通 `wiki/`、runtime overlay、turn record / journal / `.llm-wiki/runtime/` 的边界。
- 移除旧文档中把 `runtime/context_pack.md`、`runtime/turn_log.md`、`runtime/unresolved_threads.md` 当作普通推荐 wiki 目录的表述；这些现在属于非普通 wiki category 的运行时中间产物边界。
- `src/lib/rpg-wiki-schema.ts` 新增 code-readable 共享契约和 getter，包括 `NarrativeLine`、`UsePurpose`、`VisibilityScope`、`KnowledgeScope`、`KnowledgeSourceKind`、`HappenedStatus`、`RuntimeDeltaRef`、`RecallableSection`、`GapImpactCandidate`、`OutlineImpactLevel`、`ReviewItemKind`、runtime persistence boundary guidance，以及 Action Resolver 前置固定 slot 语义。
- `src/lib/rpg-wiki-schema.test.ts` 已覆盖：`RPG_WIKI_SCHEMA` 仍不包含 runtime category；新增 runtime spine 枚举 / 字段包含核心值；`RuntimeDeltaRef`、`RecallableSection`、Action Resolver 固定 slot 和 `.llm-wiki/runtime/` 边界可被机器读取。
- 已验证 `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts`、`npm.cmd run typecheck` 和两条 UTF-8 `rg` 文本检查。

未实现内容保持不变：本轮没有新增 `ActionResolverInput` / `ActionResolution` 类型，没有实现 Action Resolver interaction、parser、adapter、prompt、orchestrator 接入、World Tick、runtime prompt、新 LLM 调用或 UI。

这里的 5 个小阶段不是完整 19 步 runtime 回合流程的全部实现。它们只把 Action Resolver 作为第一条可执行纵向链路接入到现有 runtime，从 `preview -> narration -> turnRecord -> update proposal` 推进到 `preview -> actionResolution -> narration -> turnRecord -> update proposal`，并为后续 World Tick + Reaction、Recall Selector、Outline-aware Brief Compiler、Narration Generator、Runtime Update Proposal 等模块提供稳定前置基础。完整 19 步 / 6 或 7 次 LLM 回合流程仍需要后续模块继续分阶段实现。

#### Action Resolver Contract + Interaction 小阶段实现记录（2026-06-10）

第 2 个小阶段 **Action Resolver Contract 小阶段** 和第 3 个小阶段 **Action Resolver Interaction 小阶段** 已完成。本轮只建立 Action Resolver 的独立类型契约、interaction spec、adapter、parser / validator 和聚焦测试；没有把 Action Resolver 接入 `runRpgTurn` 主流程。

已实现内容：

- `src/lib/rpg-runtime/types.ts` 新增 `ActionResolverInput`、`PreActionSnapshot`、`ActionResolution`、`PlayerActionDelta`、`ActionResolverEventDraft`、`ActionResolverTimeDelta`、`ActionResolverProgressPotential` 等类型。
- 新增 `ACTION_RESOLVER_DEFAULT_EVENT_STATUS = "attempted_not_confirmed"`，使普通玩家行动默认保持为 attempt，而不是自动成为已确认发生事件。
- `src/lib/rpg-interactions/runtime/action-resolver-interaction.ts` 新增 Action Resolver prompt/spec 和 JSON parser，要求模型返回严格 `ActionResolution` JSON。
- `src/lib/rpg-interactions/runtime/action-resolver-validation.ts` 新增本地 validator，检查 `eventDraft.status`、`timeDelta`、`progressPotential`、feasibility / costs / obstacles / directResults 分离、references / warnings 分离，以及禁止 wiki write proposal、player-facing narration、World Tick / Reaction 输出污染。
- `src/lib/rpg-interactions/runtime/action-resolver-adapter.ts` 和 `llm-action-resolver-adapter.ts` 新增 fixture adapter 与 LLM adapter；adapter 只调用 interaction 并返回结构化 `ActionResolution`。
- `src/lib/rpg-interactions/interaction-spec.ts`、`registry.ts` 和 runtime exports 注册 `action_resolver` interaction，供后续阶段发现和接入。
- `src/lib/rpg-action-resolver.test.ts` 覆盖合法 JSON 解析、默认 `attempted_not_confirmed`、缺 `timeDelta`、缺 `progressPotential`、非法 `eventDraft.status`、不安全 `confirmed_happened`、wiki write proposal 污染、player-facing narration 污染、World Tick / Reaction 字段污染、prompt 边界文本、adapter 行为，以及不修改 `RPG_SCHEMA_SLOTS` / runtime category 边界。

未实现内容保持后续阶段边界：本轮没有修改 `runRpgTurn`、Narration Generator、Runtime Update Proposal、World Tick + Reaction、Recall Selector、Outline-aware Brief Compiler、wiki writer / apply、UI 或 `RPG_SCHEMA_SLOTS`。

已验证：

- `npx.cmd vitest run src/lib/rpg-action-resolver.test.ts src/lib/rpg-interactions.test.ts` 通过。
- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

#### Orchestrator 接入 + 测试小阶段实现记录（2026-06-10）

第 4 个小阶段 **Orchestrator 接入小阶段** 和第 5 个小阶段 **测试小阶段** 已完成。本轮把已实现的 Action Resolver 接入现有 RPG turn runtime，但仍然只推进到第一版纵向链路：

```ts
preview -> actionResolution -> narration -> turnRecord -> update proposal
```

已实现内容：

- `runRpgTurn` 新增 `actionResolverAdapter` 输入，并在 Narration Generator 前调用 Action Resolver。
- 新增本地 `buildActionResolverInputFromBrief()`，只从现有 `CompactStoryBrief` / preview 数据构造最小 `ActionResolverInput`；没有新增总召回、outline compiler 或额外文件读取流程。
- `BuildRpgNarrationPromptInput` 新增 `actionResolution`，Narration Generator prompt 明确把 `ActionResolution` 作为行动裁判结果。
- Narration prompt 新增硬边界：不得改写 `ActionResolution.eventDraft.status`；`attempted_not_confirmed` 不得被叙事器擅自写成 confirmed happened；叙事器只能呈现 Action Resolver 已允许的直接结果、成本、阻碍、不确定性、可行性、`timeDelta` 和 `progressPotential`；仍不得生成 wiki write proposal；仍不得把 `nextActionOptions` 当成已发生事实。
- `RpgTurnRecord` 新增 `actionResolution` 字段；`createRpgTurnRecord()` 接收并保存它，同时继续过滤 legacy references。
- Turn record references 现在合并 Narration references 与 `actionResolution.references[].path`，但未选择的 `nextActionOptions` 仍不进入 record 事实边界。
- runtime journal entry 新增 `actionResolution`，仍只进入 `.llm-wiki/runtime/turn-records.jsonl` 边界，不写入 `wiki/`。
- Runtime Update Proposal 保持 first-version 边界，只读取 `submittedAction + generatedNarrative + references`；prompt 新增说明：journal/audit `actionResolution` 不是 confirmed factual source，且 `attempted_not_confirmed` eventDraft 不得被抽成 confirmed happened event。
- RPG runtime panel 只新增 Action Resolver adapter 创建与传递；没有 UI 改动。
- 测试覆盖：orchestrator 调用顺序、narration prompt 中的 `attempted_not_confirmed` / `timeDelta` / `progressPotential` / feasibility / cost / obstacle / direct result、turn record 保存 `actionResolution` 且不保存未选择 options 为事实、runtime journal 保存 `actionResolution`、Runtime Update Proposal 不消费 `attempted_not_confirmed` eventDraft 毒丸文本、Action Resolver parser / validator 继续通过、`RPG_WIKI_SCHEMA` runtime category 边界不变。

未实现内容保持后续阶段边界：本轮没有实现 World Tick + Reaction、Recall Selector、Outline-aware Brief Compiler、完整 19 步 working state、Narration Generator 大改、Runtime Update Proposal 大改、wiki writer / apply 改造、UI 改造、project skeleton 改造，也没有新增或删除 `RPG_SCHEMA_SLOTS`。

已验证：

- `npx.cmd vitest run src/lib/rpg-action-resolver.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts` 通过。
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` 通过。
- 额外相关验证 `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx src/lib/rpg-state-extractor.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-import/runtime-update-apply.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

#### World Tick Schema + Contract 小阶段计划记录（2026-06-10）

Action Resolver 纵向链路完成后，下一步应进入 **World Tick Schema + Contract 小阶段**，但本阶段先只建立 LLM 2 的 schema、类型契约、interaction spec、parser / validator 和聚焦测试，不急着把 World Tick 接入 `runRpgTurn` 主流程。接入主流程、合并 working state、Recall Selector、Outline-aware Brief Compiler、Narration Generator 三线改造和 Runtime Update Proposal 重构都留到后续小阶段。

本阶段先明确一个关键设计决策：`ActionResolution.playerActionDelta` 是 Action Resolver / LLM 填写的权威玩家行动增量，也就是 canonical player-action-only delta。`directResults` 是给叙事器、人类审阅和 prompt 约束使用的行动裁判解释；`playerActionDelta` 是给 World Tick、working state 和后续结构化流程使用的机器状态输入。后续流程不再由本地代码从 `directResults` 二次派生另一份 canonical delta，也不让本地代码重判“行动是否成功”“门是否已经打开”“资源是否已经消耗”等语义结果。

本地 TypeScript 代码仍可以做确定性结构和边界检查，例如必填字段、枚举值、`scope: "player_action_only"`、引用形状、禁止 wiki write proposal、禁止 player-facing narration、禁止 World Tick / Reaction 输出污染、禁止把场外自然推进混入 `playerActionDelta`。但本地 validator 不负责用 `directResults` 改写或修复 `playerActionDelta`；一致性责任主要压在 Action Resolver prompt、Action Resolver 输出契约和相关测试上。

因此 LLM 2 的职责边界应写成：

```text
Action Resolver owns player-action-only adjudication.
ActionResolution.playerActionDelta is the canonical player-action delta.
World Tick consumes playerActionDelta as-is.
World Tick must not reinterpret or re-adjudicate the player action.
World Tick only advances offscreen/world/reaction effects during the resolved timeDelta.
```

建议本小阶段的实现计划是：

1. [已实现] 更新 `docs/RPG_WIKI_SCHEMA.md` 和 `src/lib/rpg-wiki-schema.ts`，补充 World Tick 需要的 clock / countdown、ongoing event、information broadcast、reaction queue、visibility meta、pacing state 和 gap signal 语义边界。
2. [已实现] 在 `src/lib/rpg-runtime/types.ts` 新增 `WorldTickInput`、`WorldTickResult`、`WorldTickVisibilityMeta`、clock update、settled ongoing event、information broadcast、reaction queue、pacing update、gap state 等类型；`WorldTickInput` 直接消费 `ActionResolution` 与 `ActionResolution.playerActionDelta`。
3. [已实现] 新增 `world-tick-interaction` spec、fixture adapter、LLM adapter、parser / validator。prompt 必须声明 World Tick 不重判玩家行动、不写 wiki、不生成玩家可见正文，只推进行动耗时区间内的世界时钟、进行中事件、信息传播和角色反应。
4. [已实现] Validator 只做结构和边界校验：必须有 `timeAdvance`、三线 `worldDeltas`、`clockUpdates`、`settledOngoingEvents`、`informationBroadcast`、`reactionQueue`、`pacingUpdate`、`gapState`、references 和 warnings；所有 delta 必须带 visibility / knowledge / happenedStatus / affectedPaths；禁止 wiki write、narration、nextActionOptions、outline revision、Recall Selector 输出污染。
5. [本阶段范围已覆盖] 聚焦测试覆盖 prompt 边界、parser / validator 成功与失败路径、adapter 行为、registry 暴露、`playerActionDelta` canonical 口径、World Tick 不重新解释玩家行动、可能未来不能写成已发生事实、平行线展示不等于 PC 知识。
6. [已满足独立运行证明] 本阶段完成后只证明 World Tick contract 可独立运行；下一小阶段再把 `WorldTickResult` 写入 turn record / runtime journal，并实现本地第 11-12 步的 visible selection 与 working state 合并。

实现情况更新（2026-06-10）：本次已完成上述计划第 3、4 项，并补齐第 5 项在本阶段范围内的聚焦测试与第 6 项“独立运行证明”。新增 `world_tick` interaction spec、prompt builder、bare/fenced JSON parser、fixture adapter、LLM adapter 和 `validateWorldTickResult()`；已注册 `RpgInteractionKind` / registry / runtime exports。Prompt 已锁定 `ActionResolution.playerActionDelta` canonical 口径、禁止重判玩家行动、禁止从 `directResults` 派生 canonical facts、禁止 wiki write / narration / nextActionOptions / Recall Selector 输出 / outline revision，并强调平行线展示不等于 PC knowledge。Validator 只做结构和边界校验，检查顶层必填字段、三线 `worldDeltas` 和所有 delta-like 对象的 visibility / knowledge / happenedStatus / affectedPaths / runtimeDeltaRefs，同时递归拒绝 wiki write、narration、next action、outline revision 和 Recall Selector 污染。已验证 `npx.cmd vitest run src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` 和 `npm.cmd run typecheck` 通过。仍未接入 `runRpgTurn`，未写 turn record / runtime journal，未实现 working state merge、Recall Selector、Outline Brief、Narration 三线重构、Runtime Update Proposal 重构、wiki writer / apply 或 UI。

#### World Tick Orchestrator + Working State Handoff 小阶段实现记录（2026-06-10）

本小阶段已完成 World Tick 接入后的本地承接，实现范围止步于本地第 11-12 步，没有进入 Recall Selector。当前 runtime turn flow 已从：

```ts
preview -> actionResolution -> narration -> turnRecord -> update proposal
```

推进为：

```ts
preview -> actionResolution -> worldTickResult -> visibleSelection -> postActionWorkingState -> narration -> turnRecord -> update proposal
```

已实现内容：

- `runRpgTurn` 新增 `worldTickAdapter`，在 Action Resolver 后、Narration 前调用 `world_tick` interaction。
- 新增 `buildWorldTickInputFromBrief()`，只从 `CompactStoryBrief`、validated `ActionResolution`、同一个 `ActionResolution.playerActionDelta` 和 resolved `timeDelta` 构造最小 `WorldTickInput`；没有新增 Recall Selector、outline compiler 或额外文件读取。
- `src/lib/rpg-runtime/types.ts` 新增 `WorldTickVisibleSelection`、`WorldTickSelectedVisibleDelta`、`WorldTickSelectedParallelLens`、`WorldTickSelectedTensionSignal` 和 `PostActionWorkingState`。
- 新增 `src/lib/rpg-runtime/world-tick-working-state.ts`，导出 `selectWorldTickVisibleContent()` 和 `buildPostActionWorkingState()`。
- visible selection 的第一版确定性规则：`ActionResolution.directResults` 与 `worldDeltas.playerVisibleLine` 中 `pc_visible` / `pc_inferred` 进入当前场景可见候选；`worldDeltas.parallelLine` 中 `user_visible_pc_unknown` 进入 parallel lens candidates，并固定 `grantsPcKnowledge: false`；`worldDeltas.tensionLine`、`pacingUpdate` 和 `gapState` 进入 tension candidates。
- working state 合并 `ActionResolution.runtimeDeltaRefs`、`WorldTickResult.runtimeDeltaRefs`、action/world tick references、action/world tick warnings、`timeState`、`campaignDelta`、`pacingState` 和 `gapState`。`campaignDelta` 优先来自 `worldTickResult.pacingUpdate.campaignDelta`，为空时记录 warning。
- `RpgTurnRecord` 保存 `worldTickResult`、`visibleSelection`、`postActionWorkingState`，runtime journal 同步保存这些结构化中间产物，仍位于 `.llm-wiki/runtime/turn-records.jsonl` 边界。
- Narration prompt 新增 structured handoff 约束：必须服从 `PostActionWorkingState`，不得改写 `WorldTickResult`，不得把 `parallelLine` / `user_visible_pc_unknown` 变成 PC knowledge，不得发明新的 World Tick events / clocks / broadcasts / reactions / gap events / pacing changes，不得写 wiki。
- Runtime Update Proposal prompt 仅补充 journal/audit 边界说明：`worldTickResult` / `visibleSelection` / `postActionWorkingState` 不能被直接转换为未审阅 wiki writes，平行线仍不能自动进入 `wiki/player/known_information.md`。
- RPG runtime panel 只创建并传递 LLM World Tick adapter，没有 UI 展示变化。

未实现内容保持后续阶段边界：本轮没有实现 Recall Selector / LLM 3、Outline-aware Brief Compiler / LLM 4、Story Outline Regenerator、Narration Generator 三线重构、Runtime Update Proposal 重构、wiki writer / apply 改造、UI 改造、普通 `wiki/runtime` category，也没有修改 `RPG_SCHEMA_SLOTS`。

已验证：

- `npx.cmd vitest run src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-working-state.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` 通过。
- `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx` 通过。
- `npm.cmd run typecheck` 通过。

#### Recall Selector Contract + Interaction + Validator + Tests 小阶段实现记录（2026-06-10）

本小阶段已完成 LLM 3 / 第 13 步的第一段独立契约建设：只建立 Recall Selector 类型、interaction、parser / validator、adapter、registry 和聚焦测试，没有接入 `runRpgTurn`，也没有实现 deterministic file-read allowlist。

已实现内容：

- `src/lib/rpg-runtime/types.ts` 新增 `RecallSelectorInput`、`RetrievalIndexEntry`、`RecallableSection`、`RecallSelection`、`RecallSelectedItem`、`RecallExclusion`、`RecallBudget` 和 `RecallPolicy`。
- `RecallSelectorInput` 明确消费已完成的 `PostActionWorkingState`，并可携带 `actionResolution`、`worldTickResult`、`visibleSelection`、`pacingState`、`gapState`、`retrievalIndex`、`recallBudget` 和 `recallPolicy`。
- 新增 `recall_selector` interaction spec、prompt builder、bare/fenced JSON parser、fixture adapter、LLM adapter 和 `validateRecallSelection()`。
- Prompt 已锁定边界：Recall Selector 基于行动后的 `PostActionWorkingState`，不是旧 `current-scene` 粗召回；只能输出 recall plan / allowlist；不能读取文件、不能生成叙事、不能写 wiki、不能生成 update proposal、不能生成 Outline-aware Brief / Outline Impact / Outline Regeneration / Story Outline Regenerator 输出，也不能进入 LLM 4。
- Prompt 要求 `selectedItems.sections` 使用稳定 `sectionId`，不能只写自然语言标题；每个 selected item 必须标记 `lineTarget`、visibility / knowledge boundary、priority、reason 和 `expectedUse`；exclusions 必须说明已知 path / section 的排除原因。
- Validator 只做确定性结构和边界校验：必填字段、selected path 必须来自传入 `retrievalIndex`、selected `sectionId` 必须存在于对应 `RetrievalIndexEntry.availableSections`、`lineTarget` / `readMode` / priority / visibility / knowledge 合法、exclusions 引用已知 path / section。
- Validator 递归拒绝污染字段：`narration`、`playerFacingText`、`parallelLineText`、`nextActionOptions`、`wikiWrites`、`wikiWriteProposal`、`proposedUpdates`、`pendingUpdates`、`recalledMaterials` full text、`outlineBrief`、`outlineImpactReport`、`outlineRevision`、`outlineRevisionProposal`、`provisionalOutlinePatch`、`regenerationRequest`。
- Validator 拒绝把 `parallelLine` / `user_visible_pc_unknown` 材料标为 PC knowledge。
- 已注册 `RpgInteractionKind` / registry / runtime exports，`recall_selector` 的 stage 为 `runtime_recall_selector`。
- 新增 `src/lib/rpg-recall-selector.test.ts`，覆盖 prompt 边界、bare/fenced parser、合法 selection、非法 path / sectionId / heading-only section / lineTarget / readMode / priority、PC knowledge 泄漏、污染字段、fixture adapter、LLM adapter streaming + parser、registry 暴露、未接入 `runRpgTurn`、未修改 `RPG_SCHEMA_SLOTS`、未新增普通 `wiki/runtime` category。

未实现内容保持后续阶段边界：仍未接入 `runRpgTurn`，仍未实现 deterministic file-read allowlist，仍未实现 recalledMaterials 文件读取，仍未实现 Outline-aware Brief Compiler / LLM 4，仍未实现 Story Outline Regenerator，仍未实现 Narration Generator 三线重构，仍未实现 Runtime Update Proposal 重构，仍未修改 wiki writer / apply / UI，仍未新增普通 `wiki/runtime` category，仍未修改 `RPG_SCHEMA_SLOTS`。

已验证：

- `npx.cmd vitest run src/lib/rpg-recall-selector.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

#### Recall Selector Orchestrator + Deterministic File-read Allowlist 小阶段实现记录（2026-06-11）

本小阶段已完成第二小阶段：把第一小阶段已有的 `recall_selector` 接入 runtime turn flow，并新增 deterministic local reader 读取 allowlist 材料。当前 runtime turn flow 已推进为：

```ts
preview -> actionResolver -> worldTick -> visibleSelection -> postActionWorkingState -> recallSelector -> deterministic recalledMaterials handoff -> narration -> turnRecord
```

已实现内容：

- `runRpgTurn` 新增可注入 `recallSelectorAdapter`，在 `postActionWorkingState` 之后、Narration 之前调用 `recall_selector`。
- 新增 `src/lib/rpg-runtime/recall-selector-handoff.ts`，导出 `buildRecallSelectorInputFromTurnState()`、`buildRetrievalIndexFromTurnState()`、`createRecallSelectorHandoff()` 和 `readRecalledMaterials()`。
- retrieval index builder 从 schema slots、runtime overlay paths、`CompactStoryBrief.references`、`PostActionWorkingState.references`、`actionResolution.references`、`worldTickResult.references`、visible selection / working state affected paths 构造轻量 `RetrievalIndexEntry[]`，不包含完整文件正文。
- `availableSections` 第一版使用稳定 `sectionId`；缺少 section metadata 的来源使用 `synthetic.whole`，并记录 warning 说明第一版限制。
- deterministic reader 只读取 `RecallSelection.selectedItems` 允许的 path，验证 path 存在于 retrieval index，验证 selected `sectionId` 属于 `RetrievalIndexEntry.availableSections`，并遵守 whole-path 与 section-level exclusions。
- reader 保持 project root / wiki path 安全边界：拒绝 `..`、绝对路径、隐藏路径和普通 `wiki/runtime` 路径；本阶段只读安全 `wiki/` path。
- section slicing 尚未完整实现时，`summary` / `focusedSection` 受控降级为 capped excerpt 并记录 warning；`wiki/outlines/main.md` full-page read 会被截断，避免把完整主大纲交给 Narration。
- `src/lib/rpg-runtime/types.ts` 新增 `RecalledMaterial`、`RecalledMaterialSection` 和 `RecallSelectorHandoff`。`RecallSelection` 是 allowlist plan；`recalledMaterials` 是 deterministic local read result。
- `RpgTurnRecord` 和 runtime journal 现在保存 `recallSelection` / `recalledMaterials`，仍只进入 `.llm-wiki/runtime/` 边界，不写普通 `wiki/`。
- Narration prompt 只补最小边界：Recall material 是 filtered handoff，不是完整 outline authority；不得把 GM-only / parallelLine / `user_visible_pc_unknown` 材料当成 PC knowledge；不得把 `RecallSelection` / `recalledMaterials` 当成 wiki writes；不得执行 Outline-aware Brief Compiler、Outline Impact 或 Outline Regeneration。
- Runtime Update Proposal 仍不得直接把未审阅 `RecallSelection` / `recalledMaterials` 当作 wiki write source；本阶段只补 prompt / validation 测试边界，没有重构 Runtime Update Proposal。
- RPG runtime panel 只创建并传递 LLM Recall Selector adapter，没有新增 UI 展示。

未实现内容保持后续阶段边界：仍未实现 Outline-aware Brief Compiler / LLM 4，仍未实现 Story Outline Regenerator，仍未实现 Narration Generator 三线重构，仍未实现 Runtime Update Proposal 重构，仍未修改 wiki writer / apply / UI，仍未新增普通 `wiki/runtime` category，仍未修改 `RPG_SCHEMA_SLOTS`。

已验证：

- `npx.cmd vitest run src/lib/rpg-recall-selector.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

### 共享 Runtime Schema 统一约定

本节统一 7 轮 schema 建议中重复出现、容易产生软冲突的概念。后续 LLM 1-6 和条件 LLM +1 的局部 schema 建议都应服从本节；如果局部字段名与本节相近，应优先复用共享类型，而不是重新定义同义字段。

#### 事实来源与持久化优先级

运行时事实按以下优先级解释：

1. 已接受并 apply 的 wiki 状态是跨回合权威事实来源。
2. 当前回合的 `preActionSnapshot` 是本回合行动前冻结视图，后续判断不能中途读取半更新 wiki 来覆盖它。
3. `ActionResolution`、`WorldTickResult`、`workingState`、`TurnNarration` 和 `RuntimeUpdateProposalResult` 是当前回合结构化中间产物，先进入 turn record / `.llm-wiki/runtime` / journal。
4. 只有第 17 步生成的 accepted pending updates 才能在第 18 步 apply 到 `wiki/`。
5. `outlines/main.md` 不因 runtime 普通更新改变；只有独立 accepted `outlineRevision` 才能通过专门流程修改它。

同一事实如果同时出现在结构化 delta 和叙事文本中，以结构化 delta 为事实依据，叙事文本只作为展示证据。叙事器不得把未在 `workingState` 或上游结果中确认的新事件提升为事实。

#### 可检索 Section 语义硬规则

后续任何 schema 改造只要新增可被 Recall Selector、Context Compiler、Brief Compiler 或 Runtime Update Proposal 读取的 wiki 页面区块，就必须同时注册稳定 section 语义。新增一个 `## 自然语言标题` 但没有机器可识别的 `sectionId` / `sectionRole`，不视为完成 schema 改造。

`sectionId` 是跨语言、跨标题调整、跨 prompt 版本仍保持稳定的机器引用键，例如 `character.behavior_rules`、`currentScene.active_clocks`、`outline.branch_conditions`。`sectionRole` 是受控语义角色，例如 `behaviorRules`、`dialogueStyle`、`currentRuntimeState`、`activePressure`、`branchConditions`。`heading` 可以是中文、英文或项目自定义标题，但它只是显示层或解析别名，不能作为唯一检索语义。

建议所有可召回页面在 metadata 或固定索引中暴露：

```ts
RecallableSection = {
  sectionId,
  sectionRole,
  heading,
  aliases,
  lineTargets,
  visibilityTags,
  temporalScope,
  authorityLevel,
  readModes,
  summaryPolicy
}
```

`availableSections` 应由 `RecallableSection[]` 组成；`RecallSelection.selectedItems.sections` 和 `RecallExclusion.sections` 应引用 `sectionId`，本地读取层再把 `sectionId` 解析到当前 markdown 标题、frontmatter block 或固定 slot。这样页面可以越来越丰富，但每轮上下文仍能按条目/片段读取，而不是被迫整页注入。

#### 共享基础类型

三线叙事和用途标签分开表达，避免把 `outlineControl` 或 `ruleCheck` 误当成叙事线：

```ts
NarrativeLine =
  | "playerVisibleLine"
  | "parallelLine"
  | "tensionLine"

UsePurpose =
  | "actionResolution"
  | "worldTick"
  | "recall"
  | "outlineControl"
  | "ruleCheck"
  | "narration"
  | "writeback"
  | "reviewOnly"
  | "journalOnly"
```

可见性和知识边界分开表达。平行线展示给现实用户/GM，不等于 PC 获得知识：

```ts
VisibilityScope =
  | "pc_visible"
  | "pc_inferred"
  | "user_visible_pc_unknown"
  | "gm_only"
  | "hidden"

KnowledgeScope =
  | "pc_known"
  | "pc_misunderstanding"
  | "npc_known"
  | "user_only"
  | "gm_only"
  | "unknown_to_pc"

KnowledgeSourceKind =
  | "seen"
  | "heard"
  | "told"
  | "inferred"
  | "documented"
  | "memory"
  | "parallel_line"
  | "misread"
  | "unknown"
```

事件状态统一为 `happenedStatus`。`events/` 只接收 `confirmed_happened` 及其直接后果；其他状态只能进入 current-scene、runtime overlay、review、journal 或 skipped delta：

```ts
HappenedStatus =
  | "attempted_not_confirmed"
  | "confirmed_happened"
  | "ongoing"
  | "blocked"
  | "failed"
  | "possible_future"
  | "intention_only"
  | "misunderstanding"
```

每个可被后续引用的运行时变化都应有 `RuntimeDeltaRef`，供 LLM 6 追溯 source delta，而不是从正文倒推：

```ts
RuntimeDeltaRef = {
  deltaId,
  sourceStage:
    | "actionResolution"
    | "worldTick"
    | "recallSelection"
    | "outlineBrief"
    | "outlineRegeneration"
    | "turnNarration"
    | "consistencyValidation",
  sourcePath,
  summary,
  narrativeLine,
  usePurpose,
  happenedStatus
}
```

#### Clock / pacing 统一落点

`current-scene/scene_state.md` 只保存下一轮必须知道的 clock / pacing 快照摘要，例如当前最紧迫的 countdown、pacing debt 和下一轮节奏提醒；它不保存完整 clock 历史。

长期 clock 的权威状态保存到对应 runtime overlay：

- 情感/戏剧张力推进、主压力节奏、关系/冲突大纲：优先进入 `tensionLine` 的持久 slot，建议新增 `wiki/outlines/tension-line.md`；第一版也可暂存于 `wiki/outlines/progress.md` 的 `Tension Line Progress` 区块。
- 剧情、支线、伏笔、章节压力素材：`plot-arcs/runtime/*.md` 只保存可被 `tensionLine` 取材的压力源、伏笔、未解冲突和 clock candidate，不再作为长期剧情结构的权威层。
- 关系张力、误会、信任压力：`relationships/runtime/*.md`
- NPC、地点、阵营、物品自己的持续状态：对应 `characters/locations/factions/items/runtime/*.md`

当前回合的 clock delta、pacing delta 和 `campaignDelta` 先保存在 `WorldTickResult` / `workingState` / turn journal；第 17 步再决定哪些进入 pending wiki update。

#### Knowledge / visibility 统一规则

所有会影响知识边界的结构统一使用 `VisibilityScope`、`KnowledgeScope`、`KnowledgeSourceKind` 和 `knownBy`。`informationBroadcast`、`playerKnowledgeChanges`、`playerKnowledgeBoundary`、`knowledgeScope` 都是同一知识模型在不同阶段的视图。

`player/known_information.md` 只写 `pc_known` 或 `pc_misunderstanding`。`user_visible_pc_unknown`、`parallel_line`、`gm_only` 和 `unknown_to_pc` 可以进入 turn journal、平行线展示记录、runtime overlay 或 review note，但不能自动进入 PC 知识。

#### Gap / outline impact 统一枚举

World Tick 只能输出初步 `gapImpactCandidate`，用于表示本轮 runtime delta 可能影响大纲：

```ts
GapImpactCandidate = "none" | "minor" | "branch" | "major"
```

第 14 步 `OutlineImpactReport` 才是是否触发第 14.5 步的权威判断：

```ts
OutlineImpactLevel = "none" | "minor" | "branch" | "major_rewrite_required"
```

映射规则是：`gapImpactCandidate: "major"` 不等于已经需要重写，只表示 LLM 4 必须重点检测；只有 `OutlineImpactLevel: "major_rewrite_required"` 才能触发 Story Outline Regenerator。

#### Outlines / tensionLine / plot-arcs 边界

`outlines/progress.md` 记录“当前游玩相对作者/GM 大纲的位置”，包括当前 beat、完成/跳过/提前/延后/失效 beat、branch condition 触发、偏离说明、临时补丁已被叙事采用的事实、待审 outline revision 引用。

`tensionLine` 升级为和玩家可见线、平行线并行的长期情感/张力推进大纲。它回答“当前故事的情感、关系、冲突压力和戏剧张力应如何推进”，包括核心 tension question、当前 tension beat、压力来源、关系/阵营裂痕、情绪债务、误会/信任节奏、张力 clock、近期应推进或暂缓的 tension move。建议新增固定 slot `wiki/outlines/tension-line.md`；若阶段范围暂不新增固定文件，可先在 `wiki/outlines/progress.md` 下维护 `## Tension Line Progress`。

`plot-arcs/` 和 `plot-arcs/runtime/*.md` 从“长期剧情结构权威层”降级为 `tensionLine`、Outline-aware Brief Compiler 和 Recall Selector 可取用的剧情原料库。它们记录伏笔、未解决问题、冲突素材、压力源、可触发条件、相关角色/地点/物品/阵营和 possible tension fuel；当事件改变情感/戏剧推进方向时，后续应由 tensionLine compiler 从 `plot-arcs` 取材，编写新的 `tensionLine` 状态，而不是让 `plot-arcs` 自己承担长期推进大纲。

`plot-arcs/runtime/*.md` 仍可以记录 active clocks、未解决冲突、branch state、reveal pacing 和角色/阵营/地点状态导致的推进条件，但这些字段是“原料与候选压力”，不是最终导演层推进权威。它不能替代 `tensionLine`，不能替代 `outlineRevisionProposal`，也不能把未来大纲修订写成已发生事实。

#### Outline revision 与普通 update 分离

第 14.5 步的 `outlineRevisionProposal` 不是 `ProposedWikiUpdate`。第 17 步只能把它包装成独立 review item：

```ts
ReviewItemKind =
  | "runtimeWikiUpdate"
  | "outlineRevision"
  | "manualControlChange"
```

普通 runtime update 不能写 `outlines/main.md`。`outlineRevision` 未接受前不能改变后续 Context Compiler 的权威大纲，只能作为 review/pending 项、journal 项或 `outlines/progress.md` 中的引用存在。

#### TensionLine 与关系写回边界

`WorldTickResult.tensionLine` 不只是本回合观测摘要，而是本回合对长期 `tensionLine` 推进大纲的候选修改：哪些张力 beat 被推进、暂停、反转、加压或释放，哪些 `plot-arcs` 原料被采用，哪些关系事实触发了新的 tension move。`TurnNarration.tensionBrief` 是叙事器对这条推进线的本回合表达和摘要，不能凭空新增关系事实或长期张力方向。

第 17 步只有在 `tensionBrief` 能追溯到 `RuntimeDeltaRef`、`workingState` 或已召回的 `plot-arcs` / `relationships` 原料时，才可生成 `relationships/runtime`、`plot-arcs/runtime` 或 `tensionLine` 更新。关系事实写入 `relationships/runtime`；伏笔和压力源补充写入 `plot-arcs/runtime`；长期张力推进方向写入 `wiki/outlines/tension-line.md` 或 `outlines/progress.md#Tension Line Progress`。

#### Next action options 边界

增强版 `nextActionOptions` 可以包含 `expectedTimeCost`、`likelyClockImpact`、`visibilityScope`、`likelyAffectedPaths` 和 `isMetaOption`，但它们仍然只是候选行动。未选择 option 不得进入 `events/`、`current-scene/`、`player/known_information.md`、`relationships/runtime`、`plot-arcs/runtime` 或 outline progress。

#### 后续实现口径

后续在 `src/lib/rpg-wiki-schema.ts` 和 runtime 类型中应优先新增共享 guidance / shared types，例如 `RPG_RUNTIME_SHARED_SCHEMA_GUIDANCE`、`RPG_RUNTIME_VISIBILITY_FIELDS`、`RPG_RUNTIME_DELTA_REF_FIELDS`、`RPG_CLOCK_STATE_FIELDS`、`RPG_TENSION_LINE_SCHEMA`、`RPG_PLOT_ARC_TENSION_FUEL_FIELDS`、`RPG_OUTLINE_IMPACT_LEVELS`、`RPG_REVIEW_ITEM_KIND_FIELDS`。各轮 interaction spec 只引用这些公共契约，再补充本轮特有字段。

### LLM 1：Action Resolver 所需 schema

当前 `docs/RPG_WIKI_SCHEMA.md` 可以支撑一个很粗的行动解析：它已经定义了 `current-scene`、固定 `player/` slot、`rules/`、`outlines/progress.md`、角色/地点/物品/关系/剧情弧 runtime overlay 等基础材料。但它还不足以稳定完成第 2-5 步要求的复杂 Action Resolver，因为现有 schema 更偏向“wiki 页面如何保存”，尚未定义“行动前裁判上下文”和“行动解析结果”的结构化契约。

优先结论是：不要把 `runtime/` 新增为普通 wiki category。代码中的运行时审阅、turn records 和 pending updates 已经放在 `.llm-wiki/runtime/`，而 wiki 目录仍应保持事实层、状态层和控制层边界。Action Resolver 需要的短期裁判结果应先作为运行时交互对象保存到 turn record / journal，而不是直接写入 `wiki/`。

第一步应增强现有固定 slot 的必备语义：

- `wiki/current-scene/scene_state.md` 应明确包含行动前快照所需章节：当前时间与地点、在场人物、玩家可见局势、上一轮摘要、可交互对象、地点行动条件、当前危险、active clocks / countdowns、pending reactions、pacing state。
- `wiki/player/known_information.md` 应补充知识边界字段：玩家角色已知事实、现实用户/GM 可见但 PC 未知的信息、信息来源、误解、未确认推测、不可从平行线自动转入玩家知识的内容。
- `wiki/outlines/progress.md` 应补充行动解析需要的相邻大纲信息：当前 stage / beat、相邻关键 beat、branch conditions、当前是否处于关键节点真空期、已完成/跳过/提前/延后 beat。
- `rules/` 应强调可执行行动边界：行动成功/失败条件、资源代价、距离/时间/感知/隐蔽/战斗/调查约束，而不是只保存世界观解释。
- `plot-arcs/runtime/`、`relationships/runtime/`、`characters/runtime/`、`locations/runtime/`、`factions/runtime/`、`items/runtime/` 可以保存持续性运行时状态，但不应承担每轮临时裁判草案。

随后应在 schema 文档和代码可读 schema 中新增 Action Resolver 交互契约。建议输入结构是：

```ts
ActionResolverInput = {
  submittedAction,
  preActionSnapshot: {
    currentScene,
    currentTime,
    currentLocation,
    visibleSituation,
    lastTurnSummary,
    presentCharacters,
    playerState,
    playerAbilities,
    playerInventory,
    playerKnownInformation,
    actionAffordances,
    relevantHardRules,
    activeClocks,
    pendingCountdowns,
    pendingReactions,
    pacingState,
    currentOutlineStage,
    adjacentBeats,
    branchConditions
  }
}
```

建议输出结构是：

```ts
ActionResolution = {
  intentAnalysis: {
    primaryIntent,
    secondaryIntents,
    actionType,
    targetEntities,
    targetLocation,
    scope,
    timeJumpSignal,
    pronounResolution,
    ambiguities
  },
  eventDraft: {
    status: "attempted_not_confirmed",
    eventType,
    actor,
    targets,
    affectedObjects,
    estimatedDuration,
    risks,
    requiredChecks,
    assumptions
  },
  feasibility: {
    result: "feasible" | "partially_feasible" | "blocked" | "requires_cost",
    blockers,
    costs,
    alternativeDirectResults,
    ruleReferences
  },
  directResult: {
    successDegree,
    immediateConsequences,
    resourceChanges,
    exposureChanges,
    sceneChanges,
    playerKnowledgeChanges
  },
  pacing: {
    timeDelta,
    progressPotential,
    stagnationSignal,
    campaignDeltaCandidate
  },
  gapSignal: {
    mayTriggerGapEvent,
    reasons,
    affectedFutureBeats
  },
  references,
  warnings
}
```

该输出仍只结算玩家行动本身。世界时钟、平行线推进、倒计时结算和角色反应队列属于 LLM 2；叙事文风、镜头和玩家可见正文属于 LLM 5；wiki 写回提案属于 LLM 6。Action Resolver 不应写 wiki，也不应把玩家尝试自动写成已发生事件。

实现顺序建议是：

1. 先更新 `docs/RPG_WIKI_SCHEMA.md`，补充上述固定 slot 章节、知识边界、pacing / clock / adjacent beat 语义。
2. 再在 `src/lib/rpg-wiki-schema.ts` 增加 code-readable guidance，例如 `RPG_ACTION_RESOLVER_CONTEXT_GUIDANCE`、`RPG_ACTION_RESOLUTION_SCHEMA`、`RPG_PACING_STATE_FIELDS`、`RPG_VISIBILITY_BOUNDARY_FIELDS`。
3. 然后新增 Action Resolver 类型和 interaction spec，再让 `runRpgTurn` 从“直接 narration”改成“action resolution -> working delta -> 后续流程”。
4. 最后把 `ActionResolution` 存入 turn record / runtime journal，供 LLM 2、LLM 5 和 LLM 6 使用，避免后续步骤只能从正文倒推事实。

### LLM 2：World Tick + Reaction 所需 schema

LLM 2 覆盖第 7-10 步，职责是根据 LLM 1 的行动解析结果、玩家行动直接增量和行动耗时，推进同一时间区间内的世界时钟、进行中事件、信息传播和角色反应。它不负责写玩家可见正文，也不直接提出 wiki 更新；它输出的是行动后的世界增量，供本地第 11-12 步合并为 working state。

当前 `docs/RPG_WIKI_SCHEMA.md` 已经有若干可用基础：`current-scene` 可以保存当前局势，`plot-arcs/runtime/` 可以保存剧情压力素材，`relationships/runtime/` 可以保存关系张力，`characters/runtime/` / `locations/runtime/` / `factions/runtime/` / `items/runtime/` 可以保存长期运行时状态，`player/known_information.md` 可以保存玩家知识。本阶段进一步要求 `tensionLine` 承担长期情感/戏剧张力推进大纲职责，而 `plot-arcs/runtime` 只提供压力源、伏笔和 clock candidate。现有契约还不足以稳定支撑 World Tick + Reaction，因为它需要处理“尚在推进但未完成”的世界过程，以及谁知道什么、谁根据什么做出反应。

优先结论仍然是：不要把 LLM 2 的每轮输出直接写入普通 `wiki/runtime/` category，也不要让它绕过 review/apply 写 wiki。World Tick 的本轮输出应先成为 `WorldTickResult`，进入 working state / turn record / runtime journal；只有第 17 步 Runtime Update Proposal 才把其中可持久化的事实、状态、clock 变化和反应队列转成 pending wiki 更新。

LLM 2 需要的主要 schema 缺口如下：

- 缺少 active clocks / countdowns 的标准结构。现有 `plot-arcs/runtime/` 和 `current-scene` 能描述压力素材，但没有统一字段记录 clock id、当前格数、总格数、触发条件、暂停/推进/完成/失败、关联角色/地点/阵营/plot arc、玩家是否知道这个 clock，以及该 clock 是否只是 tensionLine 可取用的 candidate。
- 缺少 ongoing events / pending countdowns 的边界。`events/` 只适合已发生事实，`plot-arcs/` 适合剧情压力，但“正在发生、尚未完成、可被玩家打断或改变方向”的事件还没有清晰落点。
- 缺少 information broadcast schema。第 9 步要求判断哪些角色通过目击、听闻、推断、被告知、误判或完全不知道来获得信息；现有 schema 没有统一表达 `knownBy`、`sourceOfKnowledge`、`reliability`、`whenKnown`、`isPlayerCharacterKnowledge`。
- 缺少 reaction queue schema。角色页有常见反应模式，关系页有张力，但没有运行时反应队列的结构化字段来区分立即反应、延迟反应、平行线反应、情感/张力反应和无反应理由。
- 缺少三线 world delta 的持久边界。`playerVisibleLine`、`parallelLine`、`tensionLine` 已在流程文档中定义，但 `RPG_WIKI_SCHEMA.md` 还没有要求每条 world delta 标记可见性、知情来源、是否 PC 知识、是否已发生、可写回目标。
- 缺少 pacing debt 的持久位置。LLM 2 需要根据最近低进展回合数、`pacingDebt`、`stagnationRisk` 和是否已产生 `campaignDelta` 来决定是否主动推进世界，但这些字段目前没有稳定 schema 落点。

应优先增强这些现有位置：

- `wiki/current-scene/scene_state.md` 应增加或明确 `Active Clocks And Countdowns`、`Ongoing Events`、`Pending Reactions`、`Pacing State`、`Visibility Boundaries`。这里只保存下一轮必须知道的当前快照，不保存完整历史。
- `wiki/plot-arcs/runtime/*.md` 应增加标准 clock / pressure candidate 字段，用于记录可被 `tensionLine` 取用的主线压力素材、支线倒计时、伏笔触发条件、已触发/跳过/提前/延后 beat 原料；长期情感/戏剧推进判断不由这里直接决定。
- `wiki/relationships/runtime/*.md` 应增加 relationship pressure、tension clock、pending emotional reaction、misunderstanding / trust shift 的运行时字段。
- `wiki/characters/runtime/*.md` 应增加当前知情状态、短期意图、位置、可行动资源、下一步倾向和被触发的反应。
- `wiki/factions/runtime/*.md` 应增加阵营当前行动、警戒度、资源调动、计划 clock、信息渠道和对玩家/NPC 事件的响应状态。
- `wiki/locations/runtime/*.md` 应增加地点危险、封锁、警报、可见痕迹、可交互状态和同一时间段内发生的地点变化。
- `wiki/items/runtime/*.md` 应增加物品当前持有者、位置、状态、消耗、封印、损坏或被使用后的持续后果。
- `wiki/player/known_information.md` 应明确 PC 知识与现实用户/GM 可见信息的分离，尤其是平行线展示不能自动成为 PC 知识。

建议新增非落盘的 World Tick 交互输入：

```ts
WorldTickInput = {
  preActionSnapshot,
  actionResolution,
  playerActionDelta,
  pacingStateBefore,
  activeClocks,
  pendingCountdowns,
  ongoingEvents,
  presentCharacters,
  relevantOffscreenActors,
  relevantLocations,
  relevantFactions,
  relationshipPressure,
  plotArcRuntimeState,
  outlinePosition,
  gapSignal,
  visibilityBoundaries
}
```

建议输出结构是：

```ts
WorldTickResult = {
  timeAdvance,
  worldDeltas: {
    playerVisibleLine,
    parallelLine,
    tensionLine
  },
  clockUpdates,
  settledOngoingEvents,
  informationBroadcast,
  reactionQueue,
  pacingUpdate,
  gapState,
  references,
  warnings
}
```

其中 `worldDeltas`、`settledOngoingEvents`、`informationBroadcast` 和 `reactionQueue` 中的每个条目都应至少带有：

```ts
WorldTickVisibilityMeta = {
  lineTarget,
  visibility,
  knowledgeSource,
  knownBy,
  isPlayerCharacterKnowledge,
  happenedStatus,
  affectedPaths
}
```

LLM 2 输出的 `happenedStatus` 必须区分已发生事实、正在进行状态、可能未来、误判和纯反应意向。已发生事实可以在后续进入 `events` pending；正在进行状态更适合 current-scene 或 runtime overlay；可能未来和反应意向不能写成 `events`。

实现顺序建议是：

1. 先执行 **World Tick Schema + Contract 小阶段**：更新 `docs/RPG_WIKI_SCHEMA.md`，补充 clock / countdown、ongoing event、information broadcast、reaction queue、visibility meta、pacing state 和 gap signal 的语义边界。
2. 再在 `src/lib/rpg-wiki-schema.ts` 增加 code-readable guidance，例如 `RPG_WORLD_TICK_CONTEXT_GUIDANCE`、`RPG_WORLD_TICK_RESULT_SCHEMA`、`RPG_CLOCK_STATE_FIELDS`、`RPG_INFORMATION_BROADCAST_FIELDS`、`RPG_REACTION_QUEUE_FIELDS`。
3. 然后新增 World Tick + Reaction 类型和 interaction spec，使它消费 `ActionResolution` 与权威的 `ActionResolution.playerActionDelta`，输出 `WorldTickResult`。本地代码不从 `directResults` 派生另一份 canonical delta，也不让 World Tick 重新裁判玩家行动。
4. 本小阶段只补 parser / validator、fixture / LLM adapter、registry 和聚焦测试；validator 只做结构和边界检查，不用 `directResults` 改写 `playerActionDelta`。
5. 下一小阶段再把 `WorldTickResult` 纳入 turn record / runtime journal，并让本地第 11-12 步从中选择玩家可见内容、平行线镜头和行动后 working state。

### LLM 3：Recall Selector 所需 schema

LLM 3 覆盖第 13 步，职责不是生成叙事，也不是总结剧情，而是基于行动后的 `working state` 决定本轮接下来应该读取哪些 wiki 路径、哪些 section、哪些 runtime overlay，以及这些材料分别服务哪条叙事线或控制边界。它输出的是 recall plan / allowlist，实际文件读取仍由本地代码按安全规则执行。

当前 `docs/RPG_WIKI_SCHEMA.md` 能支持目录级粗召回：它知道 `characters/`、`locations/`、`relationships/`、`plot-arcs/`、`rules/`、`outlines/` 等目录各自存什么。但它还不足以稳定支撑行动后总召回，因为 Recall Selector 需要的是可索引、可预算、可过滤、可解释的召回契约，而不仅是“某类信息应该放在哪个目录”。

优先结论是：Recall Selector 不应直接读取完整 wiki，也不应把完整文件内容交给 LLM 先看再决定。它应先消费一个本地构造的轻量 `retrievalIndex`，再输出本轮允许读取的 path / section / readMode / lineTarget。这样可以避免把 GM 大纲、平行线秘密、路线变体或无关长文直接暴露给后续叙事层。

LLM 3 需要的主要 schema 缺口如下：

- 缺少强制的 `Runtime Capsule` 契约。现有文档建议 runtime-facing 页面包含短摘要，但还没有变成稳定字段；没有 capsule 时，Recall Selector 很容易退回按文件名或全文关键词粗搜。
- 缺少页面级 recall metadata。schema 定义了“页面存什么”，但没有统一定义页面如何被召回，例如 aliases、相关角色、相关地点、相关阵营、相关物品、相关 plot arc、temporalScope、authorityLevel、visibilityTags、lastUpdated。
- 缺少 section-level 召回能力。现有 schema 推荐了章节结构，但没有统一的 stable `sectionId` / controlled `sectionRole`，导致召回只能读整页，不能精确选择 `Behavior Rules`、`Dialogue Style`、`Current Runtime State`、`Active Pressure` 等局部材料。后续新增到 wiki 页面的可检索区块必须先定义稳定 section 语义，不能只新增一组自然语言标题。
- 缺少三线召回边界。`playerVisibleLine`、`parallelLine`、`tensionLine` 已在流程中定义，但 schema 还没有要求 recall plan 标记材料可服务哪条线、禁止进入哪条线。
- 缺少 negative recall / exclusions 契约。Recall Selector 不只要说明“读什么”，还要说明“不要读什么、不要给哪条线用、哪些材料只用于第 14 步控制判断”。
- 缺少 working-state anchor schema。第 13 步必须基于行动后 `working state` 召回，但现有 schema 还没有标准化 `affectedEntities`、`affectedPaths`、`changedClocks`、`triggeredReactions`、`knowledgeChanges`、`gapEvent.relatedActors`、`gapEvent.affectedFutureBeats` 等召回锚点。

应优先增强这些现有位置和页面约定：

- runtime-facing wiki 页面应有稳定 `## Runtime Capsule`，说明本页对当前 runtime 最重要的信息、适用场景、禁止误用点和关键引用对象。
- 主要页面应支持 recall metadata，可用 frontmatter 或固定章节表达：`aliases`、`entities`、`locations`、`factions`、`items`、`plotArcs`、`visibilityTags`、`temporalScope`、`authorityLevel`、`lastUpdated`、`availableSections`。
- `availableSections` 不能只是标题字符串列表。每个可召回 section 都应包含稳定 `sectionId`、受控 `sectionRole`、当前 markdown `heading`、可接受标题别名、可服务的 `lineTargets`、visibility / temporal / authority metadata 和允许的 `readModes`；自然语言标题变化不应破坏召回语义。
- `characters/` 与 `characters/runtime/` 应让行为规则、对白风格、当前状态、短期意图和知情状态可按 section 精确召回。
- `relationships/` 与 `relationships/runtime/` 应让当前张力、误解、秘密、信任变化和推进条件可按 section 精确召回。
- `outlines/tension-line.md` 或 `outlines/progress.md#Tension Line Progress` 应作为情感/张力推进大纲被精确召回，向第 14 步暴露当前 tension beat、压力节奏、关系/阵营裂痕、张力 clock、近期应推进或暂缓的 tension move。
- `plot-arcs/` 与 `plot-arcs/runtime/` 应让当前压力源、未解问题、clock、branch condition、reveal policy、runtime beat 变化和 possible tension fuel 可按 section 精确召回；它们给 `tensionLine` 提供素材，不直接替代 `tensionLine` 的推进判断。
- `outlines/main.md`、`outlines/tension-line.md` 与 `outlines/progress.md` 应区分完整 GM 控制材料、情感/张力推进大纲、相邻 beat、delayed reveal、branch condition 和当前进度；Recall Selector 可以选择给第 14 步读取，但不应把完整大纲直接交给第 15 步。
- `player/known_information.md`、三线 visibility meta 和 information broadcast 应共同提供召回过滤依据，防止平行线材料污染玩家可见线。

建议新增非落盘的 Recall Selector 输入：

```ts
RecallSelectorInput = {
  workingState,
  actionResolution,
  worldTickResult,
  selectedVisibleContent,
  selectedParallelLens,
  pacingState,
  gapState,
  outlinePosition,
  retrievalIndex,
  recallBudget,
  recallPolicy
}
```

其中 `retrievalIndex` 不应包含完整正文，而应是本地预先构造的轻量索引：

```ts
RetrievalIndexEntry = {
  path,
  category,
  title,
  aliases,
  runtimeCapsule,
  entities,
  locations,
  factions,
  items,
  plotArcs,
  visibilityTags,
  temporalScope,
  authorityLevel,
  lastUpdated,
  availableSections: RecallableSection[]
}
```

`availableSections` 条目建议结构化为：

```ts
RecallableSection = {
  sectionId,
  sectionRole,
  heading,
  aliases,
  lineTargets,
  visibilityTags,
  temporalScope,
  authorityLevel,
  readModes,
  summaryPolicy
}
```

建议输出结构是：

```ts
RecallSelection = {
  selectedItems: [
    {
      path,
      sections,
      priority,
      reason,
      lineTarget,
      visibility,
      readMode,
      expectedUse
    }
  ],
  requiredButMissing,
  exclusions,
  budgetNotes,
  warnings
}
```

其中 `sections` 应引用 `RecallableSection.sectionId`，而不是直接引用当前 markdown 标题。标题可在本地解析层作为 fallback / alias 使用，但不能成为 LLM 输出的唯一定位方式。

`lineTarget` 建议至少支持：

```ts
RecallLineTarget =
  | "playerVisibleLine"
  | "parallelLine"
  | "tensionLine"
  | "outlineControl"
  | "ruleCheck"
```

`exclusions` 应能表达负向召回约束：

```ts
RecallExclusion = {
  path,
  sections,
  reason,
  forbiddenFor
}
```

实现顺序建议是：

1. 先更新 `docs/RPG_WIKI_SCHEMA.md`，把 `Runtime Capsule`、recall metadata、section-level recall、stable `sectionId` / controlled `sectionRole`、visibility / temporalScope / authorityLevel、negative recall 和 working-state anchor 作为 schema 契约补进去；只新增自然语言标题而没有 section identity 的区块不算完成。
2. 再在 `src/lib/rpg-wiki-schema.ts` 增加 code-readable guidance，例如 `RPG_RECALL_INDEX_FIELDS`、`RPG_RECALLABLE_SECTION_FIELDS`、`RPG_RECALL_SELECTOR_INPUT_SCHEMA`、`RPG_RECALL_SELECTION_SCHEMA`、`RPG_RECALL_VISIBILITY_POLICY`。
3. 然后新增 Recall Selector 类型和 interaction spec，让它消费 `workingState` 与轻量 `retrievalIndex`，输出 `RecallSelection`。
4. 最后让本地读取层只读取 `RecallSelection.selectedItems` 允许的 path / section，并把读取结果交给第 14 步 Outline-aware Brief Compiler；第 15 步仍不直接读取完整大纲或未过滤平行线材料。

#### Recall Selector 近期实现拆分建议（2026-06-10）

World Tick 接入和本地 Step 11-12 working state handoff 完成后，下一步进入 LLM 3 / 第 13 步时仍应继续小步推进，不要一次把 Recall Selector、文件读取、Outline-aware Brief Compiler 和 Narration handoff 全部接入主流程。建议拆成两个独立小阶段：

**第一小阶段：Recall Selector Contract + Interaction + Validator + Tests**

目标是先把 LLM 3 的结构化契约独立建立起来，并证明它可以在不读完整 wiki、不接入主 turn flow 的情况下稳定运行。

范围建议：

1. 在 `src/lib/rpg-runtime/types.ts` 或相邻 runtime 模块中新增最小类型：
   - `RecallSelectorInput`
   - `RetrievalIndexEntry`
   - `RecallableSection`（若已有 code-readable shape，应复用同一语义）
   - `RecallSelection`
   - `RecallSelectedItem`
   - `RecallExclusion`
   - `RecallBudget`
   - `RecallPolicy`
2. `RecallSelectorInput` 必须消费刚完成的 `PostActionWorkingState`，并可携带 `actionResolution`、`worldTickResult`、`visibleSelection`、`pacingState`、`gapState`、`retrievalIndex`、`recallBudget`、`recallPolicy`。
3. 新增 `recall_selector` interaction spec / prompt / parser / validator / fixture adapter / LLM adapter。
4. Prompt 必须强调：
   - Recall Selector 基于行动后的 `PostActionWorkingState`，不是基于旧 current-scene 粗召回。
   - 只能输出 recall plan / allowlist，不能读取文件、不能生成叙事、不能写 wiki、不能生成 update proposal。
   - `selectedItems.sections` 必须引用 stable `sectionId`，不能只引用自然语言标题。
   - 必须标记 `lineTarget`、visibility / knowledge boundary、priority、reason、expectedUse 和 exclusions。
   - `parallelLine` / `user_visible_pc_unknown` 材料不得被标为 PC knowledge。
5. Validator 只做确定性结构和边界校验：
   - 必填字段存在。
   - selected path / section 必须来自传入的 `retrievalIndex`。
   - sectionId 必须存在于对应 `RetrievalIndexEntry.availableSections`。
   - lineTarget、readMode、priority、visibility / knowledge 字段合法。
   - forbidden pollution 字段（narration、wiki write、proposedUpdates、recalledMaterials full text、outline regeneration 等）必须拒绝。
6. 注册 `recall_selector` 到 RPG interaction registry。
7. 补聚焦测试覆盖 prompt 边界、parser / validator 成功与失败路径、fixture adapter、LLM adapter streaming/parse、registry 暴露、sectionId 约束、negative recall、平行线不授予 PC knowledge、未接主流程、未改 `RPG_SCHEMA_SLOTS`、未新增普通 `wiki/runtime` category。

本小阶段不应接入 `runRpgTurn` 主流程，不应实现本地文件读取 allowlist，不应实现 Outline-aware Brief Compiler / LLM 4，不应把召回材料交给 Narration，也不应修改 wiki writer / apply / UI。

**第二小阶段：Recall Selector Orchestrator 接入 + Deterministic File-read Allowlist**

目标是在第一小阶段的契约稳定后，把 Recall Selector 接入 runtime turn flow，并由本地 deterministic reader 按 allowlist 读取材料，作为第 14 步的前置 handoff；仍不实现 LLM 4。

范围建议：

1. 在 `runRpgTurn` 或紧邻 orchestrator 的薄层中新增可注入 `recallSelectorAdapter`。
2. 在 `postActionWorkingState` 之后、Narration 之前调用 Recall Selector，但仅形成 `RecallSelection` 和本地 `recalledMaterials` handoff；不要进入 Outline-aware Brief Compiler。
3. 新增本地 retrieval index builder 的最小版本，优先从已知 schema slots、runtime overlay paths、brief references、working state affectedPaths / references 构造轻量 `RetrievalIndexEntry[]`；不得把完整文件正文塞进 `retrievalIndex`。
4. 新增 deterministic file-read allowlist helper：
   - 只读取 `RecallSelection.selectedItems` 允许的 path。
   - 只读取允许的 `sectionId` / readMode；第一版如果 section slicing 尚不完整，应明确降级为 summary / whole-file readMode 的受控路径，并记录 warning。
   - 必须保持 project root / wiki path 安全边界。
   - 不读取 `exclusions` 禁止的 path / section。
   - 不把完整 `outlines/main.md` 直接交给 Narration。
5. 将 `RecallSelection` 和本地读取到的 `recalledMaterials` 保存到 turn record / runtime journal，仍在 `.llm-wiki/runtime/` 边界，不写普通 `wiki/`。
6. Narration prompt 在本小阶段最多新增审计边界说明：Recall material is filtered handoff / not full outline authority；不要做 Narration 三线重构。
7. Runtime Update Proposal 仍不得直接把未审阅 RecallSelection / recalledMaterials 当作 wiki write source。
8. 补测试覆盖：
   - 调用顺序：Action Resolver -> World Tick -> working state -> Recall Selector -> deterministic read handoff -> Narration。
   - Recall Selector 基于 `PostActionWorkingState`。
   - 本地 reader 只读取 allowlist path / section。
   - exclusions 生效。
   - 平行线和 GM-only 召回不污染 PC knowledge。
   - turn record / runtime journal 保存 `RecallSelection` / `recalledMaterials`。
   - 未接 LLM 4 / Outline-aware Brief Compiler。
   - 不改 wiki writer / apply / UI。
   - 不改 `RPG_SCHEMA_SLOTS`，不新增普通 `wiki/runtime` category。

本小阶段完成后，下一阶段才进入 `Outline-aware Brief Compiler + Outline Impact Detector` 的类型契约、interaction、validator 和 tests。

### LLM 4：Outline-aware Brief Compiler + Outline Impact Detector 所需 schema

LLM 4 覆盖第 14 步，职责是把 `working state`、召回材料、规则、反应队列、pacing、gap 状态和大纲切片压缩成给第 15 步叙事器使用的安全 brief，同时判断本轮是否冲击旧大纲、是否需要触发第 14.5 步 Story Outline Regenerator。它是导演层与大纲检测层，不负责写玩家可见正文，也不直接改写 `outlines/main.md`。

当前 `docs/RPG_WIKI_SCHEMA.md` 已经定义了 `outlines/main.md`、`outlines/progress.md`、`plot-arcs/` 和 `plot-arcs/runtime/` 的基本边界：未来大纲和揭示顺序属于 `outlines/`，已发生事实属于 `events/`，而本阶段进一步把 `tensionLine` 提升为情感/戏剧张力推进大纲，`plot-arcs` 降级为可被 `tensionLine` 取材的伏笔、冲突、压力源和可能发展素材。但这些契约还不足以稳定支撑 Outline-aware Brief Compiler + Outline Impact Detector，因为第 14 步需要同时判断事件大纲 beat、reveal、branch condition 是否仍然成立，以及情感/张力大纲是否需要根据本轮事实和 `plot-arcs` 原料改写方向，并把完整控制材料过滤成三线可用 brief。

优先结论是：LLM 4 可以读取经过 Recall Selector 允许的大纲切片，但第 15 步 Narration Generator 不应直接读取完整 `outlines/main.md`。LLM 4 输出给第 15 步的内容必须按 `playerFacingBrief`、`parallelLineBrief`、`tensionBriefInput` 和禁止事项拆开；若检测到重大偏离，它应输出 `outlineImpactReport` 与 `regenerationRequest`，交给第 14.5 步处理，而不是假装旧大纲仍可照常推进。

第 14 步也应继续按小阶段推进，不应一次性把 LLM 4 的完整 schema、主流程接入、Narration Generator handoff、Story Outline Regenerator 触发和写回链路全部完成。建议拆成两个独立小阶段：

**第一小阶段：Outline-aware Brief Compiler Contract + Interaction + Validator + Tests**

目标是建立 LLM 4 / 第 14 步的最小可运行契约，让它能独立消费行动后的 working state 与 Recall Selector handoff，输出结构化的 narration brief 与 outline impact 判断；本阶段不接入 `runRpgTurn` 主流程，不触发第 14.5 步，不改 Narration Generator 三线输出。

范围建议：

1. 更新 `docs/RPG_WIKI_SCHEMA.md` 和 `src/lib/rpg-wiki-schema.ts` 的 code-readable guidance，补充 Outline-aware Brief Compiler 所需的最小 schema 语义：
   - outline beat / reveal / branch condition 的稳定 id、依赖、失效条件、line target、reveal policy。
   - outline impact rubric：`none`、`minor`、`branch`、`major_rewrite_required`。
   - line-specific brief 边界：`playerFacingBrief`、`parallelLineBrief`、`tensionBriefInput`。
   - tensionLine 与 plot-arc fuel 的最小语义，但不要一次性重构全部 `outlines/` / `plot-arcs/` 落盘结构。
2. 在 runtime 类型中新增最小非落盘契约，建议包括：
   - `OutlineBriefCompilerInput`
   - `OutlineSlice`
   - `OutlineAwareNarrationBrief`
   - `OutlineImpactReport`
   - `RegenerationRequest`
   - 必要的 reveal / impact / pacing / tensionLine candidate 子类型。
3. 新增 Outline-aware Brief Compiler + Outline Impact Detector interaction spec、prompt builder、bare/fenced JSON parser、fixture adapter、LLM adapter 和 validator。
4. Prompt 边界必须明确：
   - 输入中的 `recalledMaterials` 是 Recall Selector 过滤后的 handoff，不是完整大纲权威。
   - 只能输出 brief / impact report / optional regeneration request。
   - 不生成玩家正文、`nextActionOptions`、wiki writes、runtime update proposals、outline revision proposal 或 provisional outline patch。
   - 不把 GM-only、parallelLine、`user_visible_pc_unknown` 材料变成 PC knowledge。
   - 不直接读取文件；文件读取只发生在前一阶段 deterministic reader。
5. Validator 至少检查：
   - 顶层结构和必填字段。
   - `impactLevel` / `requiresRegeneration` 一致性。
   - `RegenerationRequest` 只在 `major_rewrite_required` 或明确需要再生时出现。
   - `playerFacingBrief` 不含 PC 不应知道的信息。
   - `parallelLineBrief` 不授予 PC knowledge。
   - 禁止污染字段：narration 正文、wiki writes、proposedUpdates、pendingUpdates、outlineRevision、outlineRevisionProposal、provisionalOutlinePatch、完整 outline 原文等。
6. 注册 interaction / exports，但不接入 `runRpgTurn`。
7. 补聚焦测试覆盖 prompt 边界、parser / validator 成功与失败路径、fixture adapter、LLM adapter streaming/parse、registry 暴露、Recall handoff 输入边界、重大偏离只产生 `RegenerationRequest` 而不执行 14.5、不改 `RPG_SCHEMA_SLOTS`、不新增普通 `wiki/runtime` category。

本小阶段完成后，应能独立证明 LLM 4 的 contract / interaction 可运行；但 turn flow 仍停留在 Recall Selector handoff 后直接进入当前 Narration 的状态。

#### Outline-aware Brief Compiler Contract + Interaction + Validator + Tests 小阶段实现记录（2026-06-11）

第一小阶段已完成。本轮只建立 LLM 4 / 第 14 步的 contract、interaction、validator、adapter、registry export 和聚焦测试，没有接入 `runRpgTurn` 主流程。

已实现内容：

- `docs/RPG_WIKI_SCHEMA.md` 补充 Outline-aware Brief Compiler 最小 schema 语义：outline beat / reveal / branch condition 稳定 id、dependency / invalidation / line target / reveal policy、outline impact rubric、`playerFacingBrief` / `parallelLineBrief` / `tensionBriefInput` 三线边界，以及 `tensionLine` 与 plot-arc fuel 的最小语义。
- `src/lib/rpg-wiki-schema.ts` 新增 code-readable Outline Brief guidance、impact rubric fields、brief boundary fields、stable ref fields、tension fuel fields 和 getter；未修改 `RPG_SCHEMA_SLOTS`，未新增普通 `wiki/runtime` category。
- `src/lib/rpg-runtime/types.ts` 新增最小非落盘 LLM 4 类型：`OutlineBriefCompilerInput`、`OutlineSlice`、`OutlineAwareNarrationBrief`、`OutlineImpactReport`、`RegenerationRequest`，以及 stable ref、reveal policy、pacing directive、tensionLine update candidate、forbidden narration item、visibility boundary、hard constraint 等子类型。
- 新增 `src/lib/rpg-interactions/runtime/outline-brief-interaction.ts`、`outline-brief-validation.ts`、`outline-brief-adapter.ts`、`llm-outline-brief-adapter.ts`。
- 新增 interaction kind `outline_brief`，registry stage 为 `runtime_outline_brief_compiler`，并通过 runtime exports 暴露。
- Prompt 明确 LLM 4 是 Outline-aware Brief Compiler + Outline Impact Detector；`recalledMaterials` 是 Recall Selector 过滤后的 handoff，不是完整大纲权威；只输出 `outlineAwareNarrationBrief`、`outlineImpactReport`、optional `regenerationRequest` 和 `warnings`；不生成玩家正文、`nextActionOptions`、wiki writes、runtime update proposal、outline revision proposal、provisional patch；不触发 Story Outline Regenerator；不把 GM-only / parallelLine / `user_visible_pc_unknown` 材料变成 PC knowledge；不直接读取文件；不改变 `ActionResolution`、`WorldTickResult`、`PostActionWorkingState`、`RecallSelection` 或 `recalledMaterials`。
- Parser 支持 bare JSON 和 fenced JSON。
- Validator 检查顶层结构、必填字段、合法 `impactLevel`、`requiresRegeneration` 一致性、`regenerationRequest` 出现条件、forbidden pollution 字段、player-facing PC knowledge 泄漏、`parallelLineBrief.grantsPcKnowledge: false`，以及 references 只能引用输入中已知的 recalled material path / `sectionId` 或 runtime ref。
- `src/lib/rpg-outline-brief.test.ts` 覆盖 schema guidance、prompt 边界、filtered handoff 文本、bare/fenced parse、合法输出、非法 impact/regeneration/pollution/knowledge/ref、fixture adapter、LLM adapter streaming 后 parse/validate、registry 暴露、未接入 `runRpgTurn`、未触发 Story Outline Regenerator、未改 wiki writer / apply / UI、未改 `RPG_SCHEMA_SLOTS`、未新增普通 `wiki/runtime` category。

未实现内容保持后续阶段边界：仍未接入 `runRpgTurn`，仍未在真实 turn flow 调用 LLM 4，仍未实现 Story Outline Regenerator / 第 14.5 步，仍未做 Narration Generator 三线重构，仍未重构 Runtime Update Proposal，仍未修改 wiki writer / apply / UI，仍未新增普通 `wiki/runtime` category，仍未修改 `RPG_SCHEMA_SLOTS`。

已验证：

- `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

**第二小阶段：Outline-aware Brief Compiler Orchestrator 接入 + Narration Brief Handoff**

目标是在第一小阶段契约稳定后，把 LLM 4 接入 `runRpgTurn`，让 Narration 只接收经过 LLM 4 过滤的 brief / impact handoff；仍不实现 Story Outline Regenerator，不做 Narration Generator 三线重构，不重构 Runtime Update Proposal。

范围建议：

1. 在 `runRpgTurn` 或紧邻 orchestrator 的薄层中新增可注入 `outlineBriefCompilerAdapter`。
2. 在 deterministic `recalledMaterials` handoff 之后、Narration 之前调用 Outline-aware Brief Compiler。
3. 构造最小 `OutlineBriefCompilerInput`：
   - `postActionWorkingState`
   - `actionResolution`
   - `worldTickResult`
   - `visibleSelection`
   - `recallSelection`
   - `recalledMaterials`
   - pacing / gap / reaction queue
   - visibility boundaries
   - 从 recalled materials 派生的 `outlineSlices` / `plotArcTensionFuel` / hard constraints metadata。
4. 将 `OutlineAwareNarrationBrief`、`OutlineImpactReport` 和 optional `RegenerationRequest` 保存到 `RpgTurnRecord` 与 runtime journal，仍只在 `.llm-wiki/runtime/` 边界。
5. Narration prompt 只做最小 handoff 改造：
   - 读取 LLM 4 输出的 filtered brief。
   - 不直接读取完整 `outlines/main.md`。
   - 不把 `outlineImpactReport` / `RegenerationRequest` 当成玩家正文或 wiki write。
   - 如果 `requiresRegeneration` 为 true，本阶段只记录 warning / audit handoff，不实际调用第 14.5 步。
6. Runtime Update Proposal 只补 journal/audit 边界说明：LLM 4 handoff 不是 accepted wiki facts，也不是 outline revision proposal；不要直接转写为普通 wiki updates。
7. 补测试覆盖：
   - 调用顺序：Action Resolver -> World Tick -> working state -> Recall Selector -> deterministic read handoff -> Outline Brief Compiler -> Narration。
   - LLM 4 输入基于 `PostActionWorkingState`、`RecallSelection` 和 deterministic `recalledMaterials`。
   - Narration 接收 filtered brief，而不是完整 `outlines/main.md`。
   - major impact 只进入 `OutlineImpactReport` / `RegenerationRequest` 和 journal，不触发 Story Outline Regenerator。
   - turn record / runtime journal 保存 LLM 4 handoff。
   - GM-only / parallelLine / `user_visible_pc_unknown` 仍不污染 PC knowledge。
   - 不改 wiki writer / apply / UI。
   - 不改 `RPG_SCHEMA_SLOTS`，不新增普通 `wiki/runtime` category。

本小阶段完成后，下一阶段才考虑条件第 14.5 步 Story Outline Regenerator 的类型契约、interaction、validator 和 tests；仍不应直接进入 Narration Generator 三线重构或 Runtime Update Proposal 重构。

LLM 4 需要的主要 schema 缺口如下：

- `outlines/main.md` 结构还不够机器可判定。现有文档有 Act Structure、Intended Reveals、Delayed Reveals、Branch Conditions、Must Not Contradict，但缺少稳定 `beatId`、`revealId`、`branchConditionId`、依赖关系、失效条件、可推迟/可跳过/不可跳过标记、对应叙事线。
- 缺少 outline impact rubric。流程文档提出 `normal` / `branch` / `major` 或 `major_rewrite_required`，但 schema 尚未定义什么是轻微偏离、可自然吸收分支、需要更新 `outlines/progress.md` 的偏离、必须触发第 14.5 步的重大重写。
- 缺少 line-specific brief schema。现有实现中的综合 brief 容易把玩家可见线、平行线、张力线、大纲控制信息混在一起；第 14 步需要明确拆成 `playerFacingBrief`、`parallelLineBrief`、`tensionBriefInput`。
- 缺少 reveal policy / forbidden reveal schema。`Delayed Reveals` 仍偏人读文本，无法稳定表达某个 reveal 当前是否允许、允许出现在什么线、禁止出现在什么线、最早触发条件是什么、泄露风险是什么。
- 缺少 machine-readable `tensionLine` 持久契约。LLM 4 需要知道当前 tension beat、情感/关系压力、张力 clock、误会/信任节奏、应推进或暂缓的 tension move，以及本轮哪些事实要求重写 tensionLine。
- `plot-arcs/runtime`、`tensionLine` 与 `outlines/progress` 的联动不够。LLM 4 需要知道哪些 `plot-arcs` 原料被本轮事实激活、哪些 tension beat 应推进/暂停/反转、哪些 runtime 变化触发了 branch condition、提前/延后/跳过/失效了哪些 beat、破坏了哪些 reveal 顺序。
- 缺少 contradiction / dependency schema。LLM 4 要判断旧大纲是否还能成立，需要知道旧 beat 依赖哪些事实，本轮新事实破坏了哪些前提，以及角色、地点、物品、阵营状态变化如何影响后续安排。
- 缺少 brief handoff 边界。输出给叙事器的 brief 必须明确哪些可写入玩家正文，哪些只给平行线，哪些只给张力摘要，哪些只是禁止事项，哪些是大纲控制信息且不能直接写成已发生事实。

应优先增强这些现有位置：

- `wiki/outlines/main.md` 应为关键 beat、reveal、branch condition 提供稳定 id，并记录 `dependsOn`、`invalidatedBy`、`lineTarget`、`revealPolicy`、`canSkip`、`canDelay`、`mustPreserve`、`mustNotContradict`。
- `wiki/outlines/tension-line.md` 应作为长期情感/戏剧张力推进大纲，记录核心 tension question、当前 tension beat、张力 clock、关系/阵营裂痕、误会/信任节奏、压力来源、正在取用的 `plot-arcs` 原料、近期应推进/暂缓/避免的 tension move；第一版也可以先作为 `wiki/outlines/progress.md#Tension Line Progress` 区块实现。
- `wiki/outlines/progress.md` 应记录当前 beat、已完成 beat、已跳过 beat、已提前 beat、已延后 beat、已失效 beat、触发的 branch condition、当前 divergence notes、下一步可自然承接 beat。
- `wiki/plot-arcs/runtime/*.md` 应增加 tension fuel / outline impact hints，例如 affectedBeatIds、affectedRevealIds、triggeredBranchConditionIds、pressureLevel、runtimeFactDependencies、possibleDivergence、usableTensionFuel、activatedConflictSource、candidateTensionMove。它们提供原料和候选压力，不直接决定长期 tensionLine。
- `wiki/relationships/runtime/*.md`、`wiki/characters/runtime/*.md`、`wiki/locations/runtime/*.md`、`wiki/factions/runtime/*.md`、`wiki/items/runtime/*.md` 应能暴露会影响大纲成立性的关键变化，例如角色死亡/离场/改变态度/知道秘密、地点封锁、关键物品损坏或转移、阵营资源变化。
- `style/forbidden.md`、`rules/`、`memory/player-preferences.md` 和显式控制块应能作为 brief 的硬约束输入，但不应被叙事器误写成世界事实。

建议新增非落盘的 Outline-aware Brief Compiler 输入：

```ts
OutlineBriefCompilerInput = {
  workingState,
  actionResolution,
  worldTickResult,
  recallSelection,
  recalledMaterials,
  pacingState,
  gapState,
  reactionQueue,
  visibilityBoundaries,
  outlineSlices,
  tensionLineOutline,
  plotArcTensionFuel,
  plotArcRuntimeState,
  rulesAndHardConstraints,
  styleConstraints,
  forbiddenContradictions
}
```

`outlineSlices` 应是经过 Recall Selector 选择的大纲切片，而不是完整大纲原文：

```ts
OutlineSlice = {
  path,
  section,
  beatIds,
  revealIds,
  branchConditionIds,
  lineTarget,
  visibility,
  authorityLevel,
  reason
}
```

其中 `section` 应优先引用 Recall Selector 已选择的 `RecallableSection.sectionId`；如果为了展示或人工审阅保留 markdown 标题，应单独作为 heading / label，不应替代机器可追踪的 section identity。

`tensionLineOutline` 是经过 Recall Selector 选择的情感/张力大纲切片，可来自 `wiki/outlines/tension-line.md` 或 `outlines/progress.md#Tension Line Progress`。`plotArcTensionFuel` 是从 `plot-arcs` / `plot-arcs/runtime` 召回的可取材压力源，不能直接替代 tensionLine 判断。`tensionLineUpdateCandidate` 只表示第 14 步建议本回合如何推进、改写或暂缓 tensionLine，真正写回仍必须经过第 17 步 proposal / pending / review。

正常情况下建议输出结构是：

```ts
OutlineAwareNarrationBrief = {
  playerFacingBrief,
  parallelLineBrief,
  tensionBriefInput,
  tensionLineUpdateCandidate,
  pacingDirective,
  campaignDeltaRequirement,
  revealPolicy,
  forbiddenForNarration,
  nextUsefulFocus,
  references
}
```

同时应输出大纲影响检测：

```ts
OutlineImpactReport = {
  impactLevel: "none" | "minor" | "branch" | "major_rewrite_required",
  affectedLines,
  affectedBeats,
  affectedReveals,
  affectedBranchConditions,
  affectedPlotArcs,
  affectedTensionLine,
  invalidatedAssumptions,
  reason,
  requiresRegeneration
}
```

如果 `requiresRegeneration` 为 true，还应输出：

```ts
RegenerationRequest = {
  confirmedFacts,
  invalidatedOutlineParts,
  mustPreserve,
  mustNotReveal,
  affectedFutureBeats,
  requestedPatchScope
}
```

实现顺序建议是：

1. 先执行 **第一小阶段：Outline-aware Brief Compiler Contract + Interaction + Validator + Tests**。这一阶段可以同步补最小 schema guidance、runtime 类型、interaction、parser / validator、adapter、registry 和聚焦测试，但不接入主流程。
2. 再执行 **第二小阶段：Outline-aware Brief Compiler Orchestrator 接入 + Narration Brief Handoff**。这一阶段才把 LLM 4 放入 `runRpgTurn`，让第 15 步只读取经过 LLM 4 过滤后的 narration brief；如果出现 `RegenerationRequest`，只保存到 turn record / runtime journal，不调用第 14.5 步。
3. 第二小阶段完成后，才进入条件第 14.5 步 Story Outline Regenerator 的 contract / interaction 阶段。
4. Story Outline Regenerator 稳定后，再考虑 Narration Generator 三线重构和 Runtime Update Proposal 重构。

#### Outline-aware Brief Compiler Orchestrator 接入 + Narration Brief Handoff 小阶段实现记录（2026-06-11）

第二小阶段已完成。本轮把 LLM 4 / 第 14 步接入主流程，但仍未实现或触发第 14.5 步 Story Outline Regenerator。

当前 runtime turn flow 已推进为：

```ts
preview -> actionResolver -> worldTick -> visibleSelection -> postActionWorkingState -> recallSelector -> deterministic recalledMaterials handoff -> outlineBriefCompiler -> narration -> turnRecord
```

已实现内容：

- `runRpgTurn` 新增可注入 `outlineBriefCompilerAdapter`，在 deterministic `recalledMaterials` handoff 之后、Narration 之前调用既有 `outline_brief` interaction。
- 新增本地薄层 `buildOutlineBriefCompilerInputFromTurnState()`，只消费已存在的 `postActionWorkingState`、`actionResolution`、`worldTickResult`、`visibleSelection`、`recallSelection`、deterministic `recalledMaterials`、pacing state、gap state、reaction queue 和 runtime refs；不读取额外文件，不让 LLM 4 直接读文件。
- 第一版确定性派生已覆盖：从 recalled `wiki/outlines/*` 生成 `outlineSlices`；从 recalled `wiki/plot-arcs/*` / `wiki/plot-arcs/runtime/*` 生成 `plotArcTensionFuel`；从 recalled `wiki/rules/*`、`wiki/style/forbidden.md`、`wiki/memory/player-preferences.md` 和 reveal / forbidden-like outline sections 生成 `hardConstraints`；同时生成 `visibilityBoundaries`、`runtimeRefs` 和 `knownReferences`。
- `RpgTurnRecord` 和 runtime journal 现在保存 `outlineAwareNarrationBrief`、`outlineImpactReport` 和 optional `regenerationRequest`，仍只在 `.llm-wiki/runtime/` 边界。
- 当 `outlineImpactReport.requiresRegeneration === true` 时，本阶段只记录 warning / audit handoff，并保存 optional `regenerationRequest`；不会调用 Story Outline Regenerator，不会生成 `provisionalOutlinePatch`，不会生成 `outlineRevisionProposal`。
- Narration prompt 现在接收 LLM 4 filtered `OutlineAwareNarrationBrief`，并明确：必须遵守 filtered brief；不直接读取完整 `outlines/main.md`；`outlineImpactReport` / `regenerationRequest` 是 audit / control handoff，不是玩家正文、不是 wiki write；`playerFacingBrief` 不能泄漏 GM-only / hidden / parallelLine-only / `user_visible_pc_unknown`；`parallelLineBrief.grantsPcKnowledge: false` 必须保持；`tensionBriefInput` 是张力输入，不是玩家正文，也不是已发生事件。
- Runtime Update Proposal prompt 只补边界说明：LLM 4 handoff 是 journal / audit / control handoff；`outlineAwareNarrationBrief`、`outlineImpactReport`、`regenerationRequest` 不是 accepted wiki facts，不能直接转写为普通 wiki updates；`regenerationRequest` 不是 `outlineRevisionProposal`。
- RPG runtime panel 仅新增 adapter wiring，没有新增 UI 控件或展示。
- `runtime_update_apply` 的 turn record clone / guard 已同步保留 LLM 4 handoff 字段。

仍未实现 / 未改动：

- 未实现或触发 Story Outline Regenerator / 第 14.5 步。
- 未调用任何 outline regeneration adapter。
- 未生成 `provisionalOutlinePatch`。
- 未生成 `outlineRevisionProposal`。
- 未做 Narration Generator 三线重构。
- 未重构 Runtime Update Proposal 解析、target rules、apply 或 pending 流程。
- 未修改 wiki writer / apply 行为。
- 未新增 UI 展示。
- 未新增普通 `wiki/runtime` category。
- 未修改 `RPG_SCHEMA_SLOTS`。
- 没有 commit / push。

已验证：

- `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` 通过。
- `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx` 通过。
- `npx.cmd vitest run src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-write-policy.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

### 条件 LLM +1：Story Outline Regenerator 所需 schema

条件 LLM +1 覆盖第 14.5 步，只在第 14 步已经输出 `major_rewrite_required` 时触发。它不是普通大纲续写器，也不是事后把剧情强行拉回旧路线的修正器；它的职责是在已确认事实优先的前提下，同时生成本回合立即生效的临时导演补丁和可审阅的大纲修订提案。

当前 `docs/RPG_WIKI_SCHEMA.md` 已经规定 `outlines/main.md` 是作者/GM 侧权威大纲，默认 `manual_or_review_only`；`outlines/progress.md` 可以由 runtime 在 pending/review 边界内记录相对大纲的位置、跳过/提前/延后 beat 和偏离说明。但它还不足以稳定支撑第 14.5 步，因为现有 schema 还没有把“同回合临时补丁”和“未来大纲修订提案”拆成两个结构化对象，也没有定义它们与事实层、progress、review 和 `outlines/main.md` 的关系。

优先结论是：Story Outline Regenerator 必须双轨输出。第一轨是 `provisionalOutlinePatch`，不落盘、不代表 `outlines/main.md` 已修改，但在本回合对第 15 步 Narration Generator 是硬约束。第二轨是 `outlineRevisionProposal`，作为独立大纲审阅项进入 review/pending，不能混入普通 runtime update，也不能在未接受前改变后续权威大纲。

条件 LLM +1 需要的主要 schema 缺口如下：

- 缺少大纲修订提案的专属 schema。现有 schema 提到玩家偏离后可审阅的大纲修订提案，但没有定义 proposal id、变更原因、事实依据、建议修改的 beat / reveal / branch condition、风险、审阅状态和目标路径策略。
- 缺少 provisional patch 的 schema。流程文档要求它本回合立即生效，但 schema 尚未定义它必须包含哪些旧 beat 暂停/失效、哪些新事实必须承认、哪些安排不得继续推进、哪些 reveal 仍不能泄露、给第 15 步的硬约束是什么。
- 缺少“已确认事实不可被修订覆盖”的输入结构。Regenerator 必须服从 `confirmedFacts` / `immutableFacts`，不能为了修大纲抹掉刚刚结算的 runtime fact、已接受事件、玩家已知事实或已归档状态。
- 缺少 outline revision review boundary。现有写入策略知道 `outlines/main.md` 是 `manual_or_review_only`，但还没有专门规定 outline revision proposal 必须作为独立 review item、普通 runtime update 不能静默修改主大纲、未接受 proposal 不改变后续权威大纲。
- 缺少 proposal 与 progress 的分离。`outlines/progress.md` 可以记录本轮偏离、旧 beat 被临时暂停/失效、临时补丁已被叙事采用；未来大纲修改建议应进入 `outlineRevisionProposal`，不能在 progress 中伪装成已发生事实或已接受大纲。
- 缺少 reveal-preservation / theme-preservation 字段。Regenerator 不应只重排事件，还必须保留主题、长期冲突、关系张力、不可提前揭示的信息和必须延续的角色矛盾。
- 缺少第 15 步 handoff schema。`provisionalOutlinePatch` 必须能转换成叙事器可执行的硬约束，而不是松散参考文本。

应优先增强这些现有位置和审阅边界：

- `wiki/outlines/main.md` 继续保持权威大纲位置，只能在独立大纲修订 proposal 被接受后通过专门流程更新。
- `wiki/outlines/progress.md` 应记录本轮重大偏离、受影响 beat、临时暂停/失效 beat、provisional patch 已被叙事采用的事实、以及待审阅 outline revision proposal 的引用；它不应把未来修订方案写成已发生事实。
- `wiki/plot-arcs/runtime/*.md` 可记录运行时剧情线因重大偏离产生的新压力、未解决冲突和 branch state，但不应替代 `outlineRevisionProposal`。
- `.llm-wiki/runtime` / turn record 应保存 `provisionalOutlinePatch`、`outlineRevisionProposal`、`RegenerationSafetyReport` 与第 16 步校验结果，供审计和后续 review 使用。
- review/pending 模型应区分普通 runtime update 与 outline revision proposal；后者不能由第 17 步普通更新提案静默合并到 `outlines/main.md`。

建议新增非落盘的 Story Outline Regenerator 输入：

```ts
StoryOutlineRegeneratorInput = {
  workingState,
  actionResolution,
  worldTickResult,
  recallSelection,
  recalledOutlineSlices,
  recalledPlotArcRuntime,
  outlineProgress,
  outlineImpactReport,
  regenerationRequest,
  gapState,
  confirmedFacts,
  immutableFacts,
  mustPreserveThemes,
  mustPreserveTensions,
  visibilityBoundaries,
  revealPolicy,
  reviewPolicy
}
```

建议第一轨输出结构是：

```ts
ProvisionalOutlinePatch = {
  patchId,
  scope,
  affectedLines,
  invalidatedBeats,
  suspendedBeats,
  mustAcknowledgeFacts,
  mustFollow,
  mustNotFollow,
  mustNotReveal,
  nextNaturalDirections,
  lineSpecificConstraints,
  narrationHandoff
}
```

其中 `narrationHandoff` 应把第 15 步必须执行的硬约束拆清楚：

```ts
ProvisionalNarrationHandoff = {
  mustInclude,
  mustAvoid,
  playerFacingLimits,
  parallelLineLimits,
  tensionLineLimits,
  sceneDirection
}
```

建议第二轨输出结构是：

```ts
OutlineRevisionProposal = {
  proposalId,
  summary,
  reason,
  confirmedFactBasis,
  proposedChanges,
  affectedBeats,
  affectedReveals,
  affectedBranchConditions,
  preservedThemes,
  preservedConflicts,
  risks,
  reviewNotes,
  targetPathPolicy
}
```

还应输出安全检查摘要：

```ts
RegenerationSafetyReport = {
  doesNotRewriteConfirmedFacts,
  doesNotPromoteFutureToEvents,
  doesNotLeakForbiddenReveals,
  doesNotDirectlyModifyMainOutline,
  warnings
}
```

实现顺序建议是：

1. 先更新 `docs/RPG_WIKI_SCHEMA.md`，补充 `ProvisionalOutlinePatch`、`OutlineRevisionProposal`、`OutlineRevisionReviewPolicy`、`RegenerationSafetyReport` 的语义边界。
2. 增强 `outlines/progress.md` 契约，使它能记录重大偏离、临时补丁采用情况和待审阅 proposal 引用，但不把未来修订写成事实。
3. 再在 `src/lib/rpg-wiki-schema.ts` 增加 code-readable guidance，例如 `RPG_PROVISIONAL_OUTLINE_PATCH_SCHEMA`、`RPG_OUTLINE_REVISION_PROPOSAL_SCHEMA`、`RPG_OUTLINE_REVISION_REVIEW_POLICY`、`RPG_REGENERATION_SAFETY_FIELDS`。
4. 然后新增 Story Outline Regenerator 类型和 interaction spec，让它消费 `OutlineImpactReport` 与 `RegenerationRequest`，输出 `ProvisionalOutlinePatch`、`OutlineRevisionProposal` 和 `RegenerationSafetyReport`。
5. 最后让第 15 步只接收 `provisionalOutlinePatch.narrationHandoff` 中允许的硬约束；`outlineRevisionProposal` 只进入独立 review/pending，不参与本回合事实写回，也不自动修改 `outlines/main.md`。

下一轮任务进度确认清单应按更小步执行，避免把 schema、interaction 和 orchestrator 条件接入混成一次大改：

1. [已完成] 补 `docs/RPG_WIKI_SCHEMA.md` 的第 14.5 步 schema：`ProvisionalOutlinePatch`、`OutlineRevisionProposal`、`OutlineRevisionReviewPolicy`、`RegenerationSafetyReport`，并明确 `outlines/main.md`、`outlines/progress.md`、`plot-arcs/runtime`、review/pending 和 `.llm-wiki/runtime` 的边界。本轮已完成 schema 文档边界更新，确认 `provisionalOutlinePatch` 只同轮临时生效且不落盘，`outlineRevisionProposal` 只进入独立 review/pending，`outlines/main.md` 仍为 `manual_or_review_only`。
2. [已完成] 补 `src/lib/rpg-wiki-schema.ts` 的 code-readable schema guidance，不新增普通 `wiki/runtime` category，不修改 `RPG_SCHEMA_SLOTS`，优先复用既有 `NarrativeLine`、visibility / knowledge、`RuntimeDeltaRef`、`OutlineImpactLevel` 和 review item 语义。本轮已新增 `RPG_PROVISIONAL_OUTLINE_PATCH_SCHEMA`、`RPG_OUTLINE_REVISION_PROPOSAL_SCHEMA`、`RPG_OUTLINE_REVISION_REVIEW_POLICY`、`RPG_REGENERATION_SAFETY_FIELDS` 及对应 getter，并用聚焦测试确认未新增普通 category、未修改 `RPG_SCHEMA_SLOTS`。
3. [已完成] 新增 runtime 类型：`StoryOutlineRegeneratorInput`、`ProvisionalOutlinePatch`、`ProvisionalNarrationHandoff`、`OutlineRevisionProposal`、`RegenerationSafetyReport`，并把它们限定为 runtime / review handoff，不作为已接受 wiki 事实。本轮类型层明确 `provisionalOutlinePatch` 只同轮临时生效、不写回 `wiki/`、不代表 `wiki/outlines/main.md` 已修改；`outlineRevisionProposal` 是 independent review/pending，不是普通 `ProposedWikiUpdate` 或 ordinary runtime update。
4. [已完成] 新增 Story Outline Regenerator interaction spec、parser / validator、fixture adapter、LLM adapter 和聚焦测试；validator 会拒绝 wiki write、玩家正文 / `nextActionOptions`、普通 runtime update、直接修改 `outlines/main.md`、把未来方案写成 `events`、改写已确认事实、泄露 forbidden reveal、把 hidden / gm_only / parallelLine-only / `user_visible_pc_unknown` 变成 PC knowledge、越界 refs、非法 top-level shape，以及 `provisionalOutlinePatch` 落盘声明或 `outlineRevisionProposal` 使用 ordinary runtime update / `runtimeWikiUpdate` review kind。
5. [已完成] 最后再接入 orchestrator 条件调用：只有 LLM 4 输出 `impactLevel: "major_rewrite_required"`、`requiresRegeneration: true`、存在 `regenerationRequest` 且注入 `storyOutlineRegeneratorAdapter` 时才调用第 14.5 步。`provisionalOutlinePatch.narrationHandoff` 只作为本轮第 15 步 Narration 的硬约束；`outlineRevisionProposal` 只保存为独立 review/pending audit 字段，不混入普通 runtime update，也不自动写回 `outlines/main.md`。本轮没有推进后续 LLM 5 Narration Generator schema redesign，也没有推进 Runtime Update Proposal 重构。

### LLM 5：Narration Generator 所需 schema

LLM 5 覆盖第 15 步，是本流程中第一轮真正生成玩家可见正文的交互。它的职责是把第 14 步给出的 `OutlineAwareNarrationBrief`，或第 14.5 步给出的 `ProvisionalOutlinePatch.narrationHandoff`，表达成可展示叙事、平行线叙事、张力摘要和下一步行动选项。它不应再做行动裁判，不应推进新的世界事实，不应改写大纲，也不应从未过滤的完整 wiki 或 `outlines/main.md` 中临时找材料。

当前实现里的 `RpgTurnResult` 只有 `narrative`、`nextActionOptions` 和 `references`，更像单段故事文本输出。这个结构不足以支撑三线叙事、平行线展示开关、张力摘要、pacing compliance、provisional patch 服从校验和下一轮 Action Resolver 所需的行动选项元数据。

优先结论是：Narration Generator 的输出必须从单一 narrative 升级为三线、可校验、可回写辅助的结构。它可以负责文风、节奏、镜头、对白、时间压缩和玩家可读体验，但它只能呈现已经由 `workingState`、`WorldTickResult`、`OutlineAwareNarrationBrief` 或 `ProvisionalOutlinePatch` 确认的内容。它不能在第 15 步临时发明新的重大事实、真空期事件、NPC 知识、大纲修订或玩家已经知道的秘密。

LLM 5 需要的主要 schema 缺口如下：

- 输出模型太窄。单一 `narrative` 无法区分玩家可见正文、平行线正文、张力摘要、展示策略、时间压缩、场景切换、是否使用 provisional patch、是否服从 reveal 限制。
- 缺少 narration handoff schema。第 14 步的 `playerFacingBrief` / `parallelLineBrief` / `tensionBriefInput` 和第 14.5 步的 `narrationHandoff` 需要明确优先级与消费方式；`provisionalOutlinePatch.narrationHandoff` 应高于普通 brief，但任何 handoff 都不能改写 `workingState`。
- 缺少 player knowledge boundary 输出字段。模型应明确玩家角色知道什么、现实用户/GM 可见但 PC 不知道什么、平行线是否展示、下一轮 PC 是否允许利用这些信息。
- 缺少结构化 `tensionBrief`。情感/关系/误会/信任变化不能只是一段氛围描写；它应表达第 14 步 `tensionLineUpdateCandidate` 在本回合如何被叙事化，否则第 17 步难以判断是否应更新 `tensionLine`、`relationships/runtime` 或 `plot-arcs/runtime` 原料。
- 缺少 pacing compliance 输出。第 16 步需要检查叙事是否体现了 `pacingIntent`、`campaignDeltaRequirement`、时间压缩、scene cut 和本轮实际变化，而不是又退回原地低信息量对话。
- 缺少增强版 `nextActionOptions`。下一轮 Action Resolver 需要知道选项的大致耗时、可能影响的 clock、可见性范围、风险和相关 wiki path，而不仅是 intent / risk。
- 缺少 style schema 的 runtime handoff 边界。`style/narration.md`、`style/dialogue.md`、`style/forbidden.md`、角色页 `Dialogue Style` 和关系页当前语气约束都可能影响叙事，但它们的优先级、适用范围和禁止事项需要明确。

应优先增强这些现有位置和交互边界：

- `wiki/style/narration.md` 应明确全局叙事人称、节奏、镜头、描写密度、时间压缩和场景切换规则。
- `wiki/style/dialogue.md` 应明确全局对白原则，但角色专属说话方式仍应来自 `characters/*.md` 或 `characters/runtime/*.md` 的对应 section。
- `wiki/style/forbidden.md` 应作为 Narration Generator 的硬约束输入，禁止越界泄露、违禁描写、禁用词和用户不希望出现的叙事习惯。
- `wiki/player/known_information.md` 应与 `displayPolicy.showParallelLine` 明确分离：平行线展示给现实用户不等于 PC 知道，不得自动进入玩家知识。
- `wiki/relationships/runtime/*.md` 应能接收结构化 `tensionBrief` 中的信任变化、误解、未说出口情绪、关系压力和后续推进限制。
- `wiki/outlines/tension-line.md` 或 `outlines/progress.md#Tension Line Progress` 应能接收已审阅的 tensionLine 推进结果，例如本回合推进的 tension beat、采用的 plot-arc 原料、下一步应加压或暂缓的 tension move。
- `wiki/current-scene/scene_state.md` 在后续写回时只应记录当前玩家可见/可知状态和必要承接，不应把平行线正文当作 PC 已知现场状态。

建议新增非落盘的 Narration Generator 输入：

```ts
NarrationGeneratorInput = {
  workingState,
  outlineAwareNarrationBrief,
  provisionalOutlinePatchHandoff,
  actionResolution,
  worldTickResult,
  selectedVisibleContent,
  selectedParallelLens,
  reactionQueue,
  pacingDirective,
  campaignDeltaRequirement,
  revealPolicy,
  styleBundle,
  forbiddenForNarration,
  outputContract
}
```

`provisionalOutlinePatchHandoff` 只有第 14.5 步触发时存在；若存在，它对叙事方向、must include / must avoid / must not reveal 的约束优先于普通 narration brief。`styleBundle` 应只影响表达方式，不能把风格偏好提升为世界事实。

建议输出结构是：

```ts
TurnNarration = {
  playerFacingText,
  parallelLineText,
  tensionBrief,
  nextActionOptions,
  displayPolicy,
  narrationMeta,
  references
}
```

`displayPolicy` 应至少包含：

```ts
NarrationDisplayPolicy = {
  showParallelLine,
  showTensionBriefToUser,
  hideReason
}
```

`tensionBrief` 应结构化，而不是只输出一段情绪散文：

```ts
TensionBrief = {
  relationshipDeltas,
  emotionalPressure,
  misunderstandings,
  trustChanges,
  unresolvedTension,
  publicVsPrivateFeelings,
  reflectedTensionLineMove,
  usedPlotArcFuel,
  proposedTensionLineCarryover
}
```

`narrationMeta` 应让第 16 步可以校验叙事服从情况：

```ts
NarrationMeta = {
  timeCompressionUsed,
  sceneTransition,
  reflectedCampaignDelta,
  followedPacingIntent,
  usedProvisionalPatch,
  respectedMustNotReveal,
  playerKnowledgeBoundary
}
```

增强版 `nextActionOptions` 建议是：

```ts
RpgActionOption = {
  id,
  playerFacingText,
  intent,
  riskLevel,
  likelyAffectedPaths,
  expectedTimeCost,
  likelyClockImpact,
  visibilityScope,
  isMetaOption
}
```

实现顺序建议是：

1. 先更新 `docs/RPG_WIKI_SCHEMA.md`，补充 narration handoff、三线输出、display policy、tension brief、pacing compliance、player knowledge boundary 和增强版 next action option 的语义边界。
2. 再在 `src/lib/rpg-wiki-schema.ts` 增加 code-readable guidance，例如 `RPG_NARRATION_OUTPUT_SCHEMA`、`RPG_TENSION_BRIEF_FIELDS`、`RPG_NARRATION_META_FIELDS`、`RPG_ACTION_OPTION_RUNTIME_FIELDS`、`RPG_NARRATION_KNOWLEDGE_BOUNDARY_POLICY`。
3. 然后修改 `RpgTurnResult` / narration interaction spec，把单一 `narrative` 输出升级为 `TurnNarration`，并让第 16 步能逐字段校验。
4. 最后让第 17 步 Runtime Update Proposal 基于 `TurnNarration`、`workingState` 和已通过校验的 `narrationMeta` 生成 pending updates，而不是继续从单段 narrative 中猜测事实。

#### LLM 5 / Narration Generator 三阶段拆分计划（2026-06-11）

为了避免把 schema、interaction、orchestrator 和后续 Runtime Update Proposal 重构混成一次大改，LLM 5 / Narration Generator 按三阶段推进。每个阶段都应独立执行、独立验证，并在完成后更新 `docs/CURRENT_STATE.md` 与 `docs/IMPLEMENTATION_LOG.md`。

**第 1 阶段：Schema Guidance 阶段**

目标是只补文档与 code-readable guidance，不修改 runtime 主流程、不改 `RpgTurnResult`、不接入新的 Narration 输出。

范围：

- 更新 `docs/RPG_WIKI_SCHEMA.md`，补充 LLM 5 的 narration handoff、三线输出、display policy、tension brief、pacing compliance、player knowledge boundary、style handoff 和增强版 next action option 语义边界。
- 更新 `src/lib/rpg-wiki-schema.ts`，新增 code-readable guidance，例如 `RPG_NARRATION_OUTPUT_SCHEMA`、`RPG_TENSION_BRIEF_FIELDS`、`RPG_NARRATION_META_FIELDS`、`RPG_ACTION_OPTION_RUNTIME_FIELDS`、`RPG_NARRATION_KNOWLEDGE_BOUNDARY_POLICY`、`RPG_NARRATION_STYLE_HANDOFF_POLICY`。
- 增加或更新聚焦 schema 测试，证明这些 guidance 可读取、字段完整、边界明确。
- 不修改 `RPG_SCHEMA_SLOTS`，除非后续单独阶段明确决定新增固定 slot；本阶段默认不新增普通 `wiki/runtime` category。
- 不改 `runRpgTurn`、Narration adapter、wiki writer/apply、UI 或 Runtime Update Proposal。

完成标准：

- `docs/RPG_WIKI_SCHEMA.md` 和 `src/lib/rpg-wiki-schema.ts` 明确 `TurnNarration`、`NarrationDisplayPolicy`、`TensionBrief`、`NarrationMeta`、增强版 `RpgActionOption`、style handoff 与 knowledge boundary 的字段和边界。
- 文档明确 `provisionalOutlinePatch.narrationHandoff` 高于普通 `OutlineAwareNarrationBrief`，但不能改写 `workingState`，不能授予 PC hidden / gm_only / `user_visible_pc_unknown` 知识。
- 文档明确 `outlineRevisionProposal` 不是 Narration 输入事实，不能被写成已发生事件或玩家知识。

**第 2 阶段：Runtime Types + Interaction Contract 阶段**

目标是新增 LLM 5 的 runtime 类型、prompt/input/output contract、parser / validator / adapters 和聚焦测试，但仍不接入 `runRpgTurn` 主流程。

范围：

- 在 `src/lib/rpg-runtime/types.ts` 增加 `NarrationGeneratorInput`、`TurnNarration`、`NarrationDisplayPolicy`、`TensionBrief`、`NarrationMeta`、增强版 `RpgActionOption` 等 runtime-only 类型。
- 在 `src/lib/rpg-interactions/runtime/` 新增或升级 Narration Generator interaction spec，使其输出 `TurnNarration`，并明确消费 `PostActionWorkingState`、`ActionResolution`、`WorldTickResult`、`WorldTickVisibleSelection`、`OutlineAwareNarrationBrief`、可选 `provisionalNarrationHandoff`、recalled materials、style bundle、forbidden narration constraints。
- 增加 parser / validator，验证：
  - 输出必须区分 `playerFacingText`、`parallelLineText`、`tensionBrief`、`displayPolicy`、`narrationMeta`、`nextActionOptions`、`references`。
  - 玩家可见正文不能泄露 parallelLine / hidden / gm_only / `user_visible_pc_unknown`。
  - `parallelLineText` 不授予 PC knowledge，是否展示由 `displayPolicy.showParallelLine` 控制。
  - `tensionBrief` 是结构化 tension handoff，不是普通事件事实或玩家正文。
  - `narrationMeta.usedProvisionalPatch`、`respectedMustNotReveal`、`followedPacingIntent` 等字段可供第 16 步校验。
  - 不输出 wiki writes、ordinary runtime updates、`ProposedWikiUpdate`、`outlineRevisionProposal`、`provisionalOutlinePatch`、完整 outline 或 `outlines/main.md` 内容。
- 新增 fixture adapter 与 LLM adapter，确保 LLM 输出走 parser + validator。
- 更新 registry / exports，但记录为 contract 层；除非本阶段另行明确，不接入 `runRpgTurn`。

完成标准：

- Narration Generator contract 可独立运行，prompt 边界、parser、validator、fixture adapter、LLM adapter 和 registry 暴露都有测试覆盖。
- 测试确认 `RPG_SCHEMA_SLOTS` 未改变、未新增普通 `wiki/runtime` category、未修改 wiki writer/apply/UI。
- 测试确认非法 narration 输出会被 validator 拒绝，尤其是 PC knowledge 泄漏、未来候选写成事实、普通 update 污染和 outline revision 污染。

**第 3 阶段：Orchestrator 接入 + Turn Record Handoff 阶段**

目标是把新的 LLM 5 contract 接入 runtime turn flow，使 `runRpgTurn` 使用 `TurnNarration`，并把必要字段保存到 runtime / review handoff，但不进入 LLM 6 Runtime Update Proposal 重构。

范围：

- 修改 `runRpgTurn`，让流程保持：

```ts
actionResolver -> worldTick -> recallSelector -> deterministicReadHandoff -> outlineBriefCompiler -> optional storyOutlineRegenerator -> narration
```

- 构建 deterministic `NarrationGeneratorInput`，只复用本轮已有 `workingState`、`ActionResolution`、`WorldTickResult`、`WorldTickVisibleSelection`、`RecallSelection`、`recalledMaterials`、`OutlineAwareNarrationBrief`、可选 `provisionalOutlinePatch.narrationHandoff`、visibility / knowledge / reveal / style boundaries。
- Narration 必须在第 14.5 触发时服从 `provisionalOutlinePatch.narrationHandoff`；未触发时仍服从 `OutlineAwareNarrationBrief`。
- 更新 `RpgTurnRecord` / runtime journal，保存 `turnNarration`、`displayPolicy`、`tensionBrief`、`narrationMeta` 和增强版 `nextActionOptions` 中需要给下一轮 Action Resolver / review / audit 使用的字段。
- 保留旧 `generatedNarrative` 或兼容渲染字段时，只作为展示/过渡输出，不作为新增 legacy/default 架构约束；不要为旧项目设计迁移或旧路径 fallback。
- 不在本阶段重构 Runtime Update Proposal；第 17 步仍可暂时使用既有保守 pending update 逻辑，直到 LLM 6 阶段重构。
- 不修改 wiki writer/apply，不自动写 wiki，不自动应用 pending updates，不改 UI 展示。

测试要求：

- Narration 调用顺序为 `... -> outlineBriefCompiler -> optional storyOutlineRegenerator -> narration`。
- 非 Step 14.5 回合 Narration 收到 `OutlineAwareNarrationBrief`，不收到 provisional handoff。
- Step 14.5 回合 Narration 收到 `provisionalOutlinePatch.narrationHandoff`，并在 `narrationMeta.usedProvisionalPatch` / `respectedMustNotReveal` 中反映。
- `playerFacingText` 不包含 parallelLine-only / hidden / gm_only / `user_visible_pc_unknown` 泄漏。
- `parallelLineText` 不写入 PC knowledge；`displayPolicy.showParallelLine` 只控制展示，不改变事实层。
- `tensionBrief` 保存为 runtime/review handoff，不直接变成 ordinary wiki update。
- `outlineRevisionProposal` 不进入 Narration fact material，不进入 ordinary runtime update，不自动写 `outlines/main.md`。
- 不写 wiki 文件，不修改 writer/apply/UI，不修改 `RPG_SCHEMA_SLOTS`，不新增普通 `wiki/runtime` category。

下一轮任务进度确认清单应按更小步执行：

1. [已完成] LLM 5 / Narration Generator 第 1 阶段：Schema Guidance。只更新 `docs/RPG_WIKI_SCHEMA.md`、`src/lib/rpg-wiki-schema.ts` 和聚焦 schema 测试，记录 `TurnNarration`、display policy、tension brief、narration meta、增强版 action options、style handoff、knowledge boundary 与 provisional handoff 优先级。本轮只完成 schema / guidance，未进入 runtime types、interaction contract、orchestrator 接入或 Runtime Update Proposal 重构。
2. [已完成] LLM 5 / Narration Generator 第 2 阶段：Runtime Types + Interaction Contract。已新增 runtime-only 类型、独立 `narration_generator` interaction spec、parser / validator、fixture adapter、LLM adapter、registry / exports 和聚焦测试；本阶段只证明 contract 可独立运行，未接入 `runRpgTurn` 主流程，未修改 writer/apply/UI，未修改 `RPG_SCHEMA_SLOTS`，未新增普通 `wiki/runtime` category。
3. [已完成] LLM 5 / Narration Generator 第 3 阶段：Orchestrator 接入 + Turn Record Handoff。已把新的 `narration_generator` contract 接入 `runRpgTurn`，新增 deterministic `NarrationGeneratorInput` handoff builder，并保存 `turnNarration`、`displayPolicy`、`tensionBrief`、`narrationMeta`、enhanced `nextActionOptions`、`references` 等 runtime / review handoff 字段。非 Step 14.5 回合只接收 `OutlineAwareNarrationBrief` 且 `usedProvisionalPatch: false`；Step 14.5 回合只把 `provisionalOutlinePatch.narrationHandoff` 作为 Narration hard constraint，并要求 `usedProvisionalPatch: true`、`respectedMustNotReveal: true`。`generatedNarrative` 仅作为由 `turnNarration.playerFacingText` 派生的展示 / LLM 6 过渡字段。本阶段未进入 Runtime Update Proposal / LLM 6 重构，未修改 writer/apply/UI，未修改 `RPG_SCHEMA_SLOTS`，未新增普通 `wiki/runtime` category。

### LLM 6：Runtime Update Proposal 所需 schema

LLM 6 覆盖第 17 步，职责是根据已经结算并通过第 16 步一致性校验的 `workingState` 与 `TurnNarration`，生成可审阅的 wiki 更新提案，进入 pending/review。它不负责应用更新，不应绕过本地 validator / review / apply 边界，也不应把未审核的大纲修订、候选行动或平行线秘密静默写入事实层。

当前实现已经有第一版 `runtimeUpdateInteractionSpec` 和 `ProposedWikiUpdate`，但输入主要是 `submittedAction`、`generatedNarrative` 和 `references`，输出主要是 fenced markdown update block。这在旧的单段 narration 流程里是安全保守的，但在前五轮都改成结构化交互后会变得过窄：第 17 步仍会被迫从正文倒推事实，而不是从 `ActionResolution`、`WorldTickResult`、`TurnNarration`、`tensionBrief`、`pacingUpdate`、`gapState` 和 outline impact 结构中生成更新。

优先结论是：Runtime Update Proposal 应从“叙事文本抽取器”升级为“结构化事实 delta 到 pending update 的提案生成器”。叙事正文仍是展示证据之一，但事实源应以已结算且已校验的 `workingState` 和各轮结构化结果为准。所有输出都只是 proposal；最终是否写入 wiki 仍由本地 validator、review/pending 和 apply 决定。

LLM 6 需要的主要 schema 缺口如下：

- 输入事实源太窄。现有 prompt 只允许使用 `submittedAction + generatedNarrative + references`，无法表达 Action Resolver 的直接结果、World Tick 的 clock / reaction / broadcast、三线归属、结构化 tension brief、pacing update、gap event、provisional patch 采用情况和 outline impact。
- `ProposedWikiUpdate` 缺少 line / visibility / knowledge 字段。三线写回必须知道该更新来自玩家可见线、平行线还是张力线，PC 是否知道，现实用户是否看到，是否允许写入 `player/known_information.md`。
- 缺少 source delta 引用。每条 update 应能追溯到 `actionResolution.directResult`、`worldTickResult.clockUpdates`、`worldTickResult.informationBroadcast`、`turnNarration.tensionBrief`、`gapState.gapEvent` 等结构化来源，而不仅是引用 wiki path。
- 缺少 pacing / clock 更新 proposal schema。第 17 步需要提案更新实际 `timeDelta`、active clocks、campaign delta、pacing debt、stagnation risk 和下一轮节奏提醒，但现有 proposal 没有专门字段标明这些状态类型。
- 缺少 outline revision review item schema。第 14.5 步产生的 `outlineRevisionProposal` 必须作为独立大纲审阅项进入 review/pending，不能混入普通 `ProposedWikiUpdate`，更不能直接写 `outlines/main.md`。
- 缺少 skipped delta / no-op reporting。如果某些 delta 不应写 wiki，例如平行线展示但 PC 不知道、轻微情绪压力不构成持久变化、候选行动不是事实、未来大纲修订尚未接受，LLM 6 应显式说明跳过原因。
- 缺少 proposal group / cross-directory sync schema。复杂回合中 current-scene、events、characters/runtime、relationships/runtime、plot-arcs/runtime、tensionLine slot、outlines/progress 可能是同一事实的不同落点；proposal 本身应能表达它们属于同一组，并区分“关系事实”“plot-arc 原料”和“长期 tensionLine 推进”。
- fenced block 协议更适合 markdown 兼容输出，不适合完整结构化 pipeline。后续可以保留 fenced block 作为兼容层，但新流程更适合 JSON 化 proposal result，再由本地代码渲染成 review items。

应优先增强这些现有位置和写回边界：

- `wiki/current-scene/scene_state.md` 只写最新玩家可见/可知快照和必要承接，不保存完整历史，不把平行线正文当作 PC 已知现场状态。
- `wiki/events/*.md` 只写 confirmed happened events 和直接后果；未来计划、候选行动、未审核大纲修订、推测和伏笔建议不能写成事件。
- `wiki/player/known_information.md` 只写 PC 已知信息、误解和已通过可见性边界的信息；平行线展示给现实用户不等于 PC 知道。
- `wiki/relationships/runtime/*.md` 接收结构化 `tensionBrief` 中可持久化的信任、误解、冲突、秘密、未说出口压力和关系推进限制。
- `wiki/outlines/tension-line.md` 或 `outlines/progress.md#Tension Line Progress` 接收已审阅的长期 tensionLine 推进结果：当前 tension beat、张力 clock、采用的 plot-arc 原料、应加压/暂缓/避免的 tension move、下一轮 tension focus。
- `wiki/plot-arcs/runtime/*.md` 接收 runtime pressure、active clocks、branch state、reveal pacing、未解决冲突、剧情推进条件和 possible tension fuel；它是素材层，不直接承载长期 tensionLine 权威。
- `wiki/outlines/progress.md` 接收相对大纲位置、已完成/跳过/提前/延后/失效 beat、偏离记录、临时补丁采用事实和待审 outline proposal 引用。
- `wiki/outlines/main.md` 仍只能由独立 accepted outline revision 通过专门流程更新，普通 runtime update 不得写入。

建议新增 Runtime Update Proposal 输入：

```ts
RuntimeUpdateProposalInput = {
  workingState,
  actionResolution,
  worldTickResult,
  recallSelection,
  outlineAwareNarrationBrief,
  tensionLineUpdateCandidate,
  provisionalOutlinePatch,
  outlineRevisionProposal,
  turnNarration,
  consistencyValidation,
  acceptedDisplayPolicy,
  previousSnapshotRefs,
  allowedTargets,
  writePolicy,
  reviewPolicy
}
```

建议输出结构是：

```ts
RuntimeUpdateProposalResult = {
  proposedWikiUpdates,
  outlineRevisionReviewItems,
  journalEntries,
  skippedDeltas,
  pacingUpdateProposal,
  proposalGroups,
  warnings
}
```

增强版普通 wiki update 建议是：

```ts
ProposedWikiUpdate = {
  id,
  targetPath,
  strategy,
  reason,
  content,
  sourceTurnId,
  references,
  sourceDeltas,
  lineTarget,
  visibility,
  knowledgeScope,
  happenedStatus,
  confidence,
  validationHints
}
```

独立大纲审阅项建议是：

```ts
OutlineRevisionReviewItem = {
  proposalId,
  title,
  proposal,
  sourceTurnId,
  reviewPolicy,
  targetPathPolicy,
  status: "pending"
}
```

被跳过的运行时增量也应结构化：

```ts
SkippedRuntimeDelta = {
  deltaId,
  reason,
  notWrittenBecause,
  suggestedReview
}
```

pacing / clock 更新提案建议拆成单独结构，方便落到 current-scene、plot-arcs/runtime 或 `.llm-wiki/runtime`：

```ts
PacingUpdateProposal = {
  timeDelta,
  campaignDelta,
  pacingDebtChange,
  stagnationRisk,
  activeClockChanges,
  nextTurnPacingHint
}
```

同一事实的多路径写回建议用 proposal group 表达：

```ts
ProposalGroup = {
  groupId,
  sourceDeltaIds,
  targetPaths,
  reason,
  requiredTogether,
  missingCompanionWarnings
}
```

实现顺序建议是：

1. 先更新 `docs/RPG_WIKI_SCHEMA.md`，补充 Runtime Update Proposal 的输入事实源、三线写回边界、source delta、pacing / clock proposal、outline revision review item、skipped delta 和 proposal group 语义。
2. 再在 `src/lib/rpg-wiki-schema.ts` 增加 code-readable guidance，例如 `RPG_RUNTIME_UPDATE_PROPOSAL_INPUT_SCHEMA`、`RPG_RUNTIME_UPDATE_PROPOSAL_RESULT_SCHEMA`、`RPG_PROPOSED_WIKI_UPDATE_RUNTIME_FIELDS`、`RPG_RUNTIME_UPDATE_SOURCE_DELTA_FIELDS`、`RPG_OUTLINE_REVISION_REVIEW_ITEM_SCHEMA`、`RPG_SKIPPED_RUNTIME_DELTA_FIELDS`、`RPG_PACING_UPDATE_PROPOSAL_FIELDS`、`RPG_PROPOSAL_GROUP_FIELDS`。
3. 然后修改 `ProposedWikiUpdate`、runtime update interaction spec 和 parser，使其支持结构化 JSON 输出；fenced markdown block 可以作为兼容协议保留，但不应是新流程唯一协议。
4. 最后让本地 validator 使用 `lineTarget`、`visibility`、`knowledgeScope`、`happenedStatus`、`sourceDeltas` 和 `proposalGroups` 做更强校验，再把 accepted proposals staged 为 pending updates。

#### LLM 6 分阶段实现跟踪计划（2026-06-11）

在 LLM 5 / Narration Generator 已接入并完成 cleanup 后，下一步可以开始 **LLM 6：Runtime Update Proposal**。但本轮应按小阶段推进，不应一次性修改 writer / apply / UI，也不应让 LLM 6 绕过 pending / review / apply 边界。

当前代码不是空白模块：已经存在 `runtimeUpdateInteractionSpec`、`ProposedWikiUpdate`、fenced markdown update block parser、deterministic runtime update validator、pending staging 和 runtime journal 记录。LLM 6 的实现方向应是升级这条现有链路，而不是推倒重写。目标是把它从“从单段叙事文本抽取 wiki update block”升级为“从结构化 turn delta 生成可审阅 pending proposal”。

关键前置判断：

- 可以开始 LLM 6，因为 LLM 5 已经把 `TurnNarration`、`tensionBrief`、`narrationMeta`、`displayPolicy` 和 enhanced `nextActionOptions` 保存进 turn record / runtime journal。
- 改造前的 LLM 6 只把 `submittedAction + generatedNarrative + references` 当作事实源；这是旧单段 narration 流程下的保守设计，已经不足以消费 `ActionResolution`、`WorldTickResult`、`PostActionWorkingState`、`OutlineAwareNarrationBrief`、`TurnNarration` 和 Step 14.5 的审计输出。阶段 4 + 5 已把主 runtime flow 切到结构化 `RuntimeUpdateProposalInput`。
- Step 16 目前没有独立完整模块。LLM 6 第一版可以先引入最小 `consistencyValidation` handoff，基于现有 `validateTurnNarration()`、`narrationMeta`、provisional patch usage 和 pacing / reveal meta 生成；完整 Step 16 后续再强化。
- `outlineRevisionProposal` 只能作为独立 review / pending item 进入审阅边界，不能混入普通 `ProposedWikiUpdate`，不能自动写入 `wiki/outlines/main.md`。
- fenced markdown block 协议可以保留给手动导入或兼容 staged apply，但主 runtime flow 应转向结构化 JSON result。

分阶段任务清单：

1. [已完成] **LLM 6 Schema Guidance 阶段**：已更新 `docs/RPG_WIKI_SCHEMA.md`、`src/lib/rpg-wiki-schema.ts` 和聚焦 schema tests，补充 `RuntimeUpdateProposalInput`、`RuntimeUpdateProposalResult`、增强版 `ProposedWikiUpdate`、`sourceDeltas`、`lineTarget`、`visibility`、`knowledgeScope`、`happenedStatus`、`SkippedRuntimeDelta`、`PacingUpdateProposal`、`ProposalGroup`、`OutlineRevisionReviewItem` 等语义。本阶段只做 schema / code-readable guidance，没有接 orchestrator，没有改 runtime update prompt/parser、validator/pending staging、writer/apply 或 UI。
2. [已完成] **Runtime Types + JSON Contract 阶段**：已新增 LLM 6 runtime-only 类型、JSON parser / validator、fixture adapter、LLM adapter、registry / exports 和聚焦 contract tests。`RuntimeUpdateProposalInput` 可从 current turn 的 `turnRecord`、`postActionWorkingState`、`actionResolution`、`worldTickResult`、`visibleSelection`、`recallSelection`、`recalledMaterials`、`outlineAwareNarrationBrief`、`outlineImpactReport`、optional `provisionalOutlinePatch` / `outlineRevisionProposal`、`turnNarration`、最小 `consistencyValidation`、allowed targets、write policy 和 review policy 构造。`RuntimeUpdateProposalResult` 输出 `proposedWikiUpdates`、`outlineRevisionReviewItems`、`journalEntries`、`skippedDeltas`、`pacingUpdateProposal`、`proposalGroups` 和 `warnings`。本阶段只做 contract-layer 结构和边界校验，没有进入 pending staging / apply。
3. [已完成] **Interaction Spec 改造阶段**：已升级 `runtimeUpdateInteractionSpec` prompt。Prompt 不再声明事实源只限 `submittedAction + generatedNarrative + references`，而是明确优先消费已结算结构化事实源；`playerFacingText` / `generatedNarrative` 只是展示证据；`parallelLineText` / `user_visible_pc_unknown` 不能自动写入 `wiki/player/known_information.md`；`nextActionOptions` 仍是候选未来行动；`attempted_not_confirmed` 不能进入 confirmed `events`；`outlineRevisionProposal` 只能作为独立 review item；ordinary updates 必须携带 `sourceDeltas`、`lineTarget`、`visibility`、`knowledgeScope`、`happenedStatus`、`confidence` 和 `validationHints`。
4. [已完成] **Validator + Pending Staging 阶段**：已扩展本地 structured validator，使 `lineTarget`、`visibility`、`knowledgeScope`、`happenedStatus`、`sourceDeltas`、`proposalGroups` 参与校验。`wiki/events/*.md` 必须来自 confirmed happened source delta；`wiki/player/known_information.md` 必须来自 PC 已知或明确误解，不能从 `parallelLineText` / `user_visible_pc_unknown` 自动写入；runtime overlay update 必须能追溯到 affectedPaths 命中目标的 source delta；`SkippedRuntimeDelta` 进入 journal / review 提示但不进入 pending wiki update；`outlineRevisionReviewItems` 走独立审阅边界，不走普通 runtime update apply。
5. [已完成] **Orchestrator 接入阶段**：已新增 deterministic `buildRuntimeUpdateProposalInputFromTurnRecord()`，并让 `runRpgRuntimeTurnFlow()` 主流程走 `turnRecord -> RuntimeUpdateProposalInput -> runtime_update_proposal interaction -> structured validation -> ordinary pending updates + independent outline review items + journal audit`。本阶段仍不自动 apply，不改 `wiki/outlines/main.md`，不新增普通 `wiki/runtime` category。

建议测试覆盖：

- `src/lib/rpg-wiki-schema.test.ts`：确认 LLM 6 schema guidance 可机器读取，且不新增普通 `wiki/runtime` category，不修改 `RPG_SCHEMA_SLOTS`。
- 新增或扩展 LLM 6 聚焦测试：覆盖 JSON parser / validator / adapter、registry 暴露、prompt 边界、source delta 追踪、三线可见性与 PC knowledge 边界、pacing / clock proposal、proposal group、skipped delta、outline revision 独立 review item。
- `src/lib/rpg-runtime-controller.test.ts`：确认 structured proposal 进入 pending，rejected proposal 被跳过并产生日志警告，skipped delta / pacing proposal / proposal groups 进入 runtime journal。
- `src/lib/rpg-import/runtime-update-apply.test.ts`：确认旧 fenced block staging 路径仍可用于手动导入或兼容 staged apply，但不再是主 runtime flow 的唯一协议。
- 回归毒丸：`attempted_not_confirmed`、未选择 `nextActionOptions`、PC 未知的平行线、future plan、foreshadowing、未接受的 `outlineRevisionProposal` 都不能进入 confirmed wiki facts 或 `events`。

阶段 1 实现记录（2026-06-11）：本轮完成 LLM 6 Schema Guidance 阶段。`docs/RPG_WIKI_SCHEMA.md` 已补 Runtime Update Proposal 的输入事实源、输出边界、增强版 `ProposedWikiUpdate`、source delta、skipped delta、pacing proposal、proposal group、独立 outline revision review item 和 fenced block 兼容定位。`src/lib/rpg-wiki-schema.ts` 已新增对应 code-readable guidance 常量与 getter；`src/lib/rpg-wiki-schema.test.ts` 已覆盖机器可读性、PC knowledge / events / outline 边界、fenced block 非唯一主协议、未修改 `RPG_SCHEMA_SLOTS`、未新增普通 `wiki/runtime` category。

阶段 2 + 阶段 3 实现记录（2026-06-11）：本轮完成 LLM 6 Runtime Types + JSON Contract 与 Interaction Spec 改造。`src/lib/rpg-runtime/types.ts` 已新增 `RuntimeUpdateProposalInput`、`RuntimeUpdateProposalResult`、`RuntimeProposedWikiUpdate`、`RuntimeUpdateSourceDelta`、`SkippedRuntimeDelta`、`PacingUpdateProposal`、`ProposalGroup`、`OutlineRevisionReviewItem`、最小 `RuntimeUpdateConsistencyValidation` 以及 allowed target / write policy / review policy helper shape。`runtimeUpdateInteractionSpec` 现在以结构化 JSON result 为主协议，优先消费 current-turn 结构化事实源，并保留旧 `rpg-wiki-update` fenced markdown block 作为兼容 fallback。新增 parser / validator 只做结构和边界检查，不进入 pending staging；新增结构化 fixture / LLM adapter 通过 `buildPrompt` + `parseOutput` 路径返回 `RuntimeUpdateProposalResult`。当时阶段 4 和阶段 5 尚未实现；后续记录见下一段。

阶段 4 + 阶段 5 实现记录（2026-06-11）：本轮完成 LLM 6 Validator + Pending Staging 与 Orchestrator 接入。`validateRuntimeUpdateProposalResult()` 现在校验 source delta 对 events、player knowledge、runtime overlay affectedPaths、pacing source ids、proposal group update / skipped / source refs 的支撑关系；ordinary pending updates 仍只来自通过 structured parser 和 deterministic runtime validator 的 `proposedWikiUpdates`。新增 `buildRuntimeUpdateProposalInputFromTurnRecord()`，主 controller 先构造结构化输入再调用 `runtime_update_proposal`，并把 `skippedDeltas`、`proposalGroups`、`pacingUpdateProposal`、`outlineRevisionReviewItems` 和 proposal journal entries 汇总到 controller result 与 runtime journal audit。旧 fenced `rpg-wiki-update` block 仍保留为 manual / compat staging fallback；本阶段未自动 apply，未修改 writer/apply/UI，未修改 `RPG_SCHEMA_SLOTS`，未新增普通 `wiki/runtime` category，也未自动写 `wiki/outlines/main.md`。

## 三线叙事与平行线开关

本流程在不增加基础 LLM 次数的前提下，把大纲推进和叙事输出拆成三条线：

- `playerVisibleLine`：玩家角色当前亲历、能观察、能被告知或能合理推断的内容。第 15 步默认展示给玩家的正文和下一步选项必须来自这一线。
- `parallelLine`：玩家角色不可见的幕后、敌方、次要角色、远处地点或同一时间段发生的其他事件线。平行线默认也生成叙事，但由展示开关控制是否向用户显示。
- `tensionLine`：和玩家可见线、平行线并行的情感/张力推进大纲，负责长期维护情感、关系、误解、信任、敌意、暧昧、心理压力、阵营裂痕和戏剧张力如何推进。它可以从 `plot-arcs` / `plot-arcs/runtime` 取用伏笔、冲突、未解决问题和压力源作为原料，编写新的 tension beat 或 tension move；`plot-arcs` 不再作为长期剧情结构权威层，而是 tensionLine 和 outline brief 可召回的剧情素材层。

`tensionLine` 应优先拥有持久控制 slot：`wiki/outlines/tension-line.md`。如果当前阶段不新增固定文件，可以先使用 `wiki/outlines/progress.md` 中的 `## Tension Line Progress` 作为过渡落点。它的更新仍必须经过第 17-18 步 proposal / pending / review / apply，不能由第 15 步叙事器直接改写。

建议第 15 步输出至少包含：

```ts
turnNarration = {
  playerFacingText,
  parallelLineText,
  tensionBrief,
  nextActionOptions,
  displayPolicy: {
    showParallelLine
  }
}
```

`showParallelLine` 只控制现实用户或 GM 是否看到 `parallelLineText`，不改变玩家角色的知情状态。即使平行线被展示，也不能自动写入 `player/known_information.md`，也不能让玩家角色在后续行动中默认知道这些内容。玩家角色必须通过目击、调查、他人告知、情报渠道或其他已结算方式，才能把平行线信息转入玩家可知事实。

平行线隐藏时仍可参与 world tick、反应队列、turn journal、pending/review 和后续召回；隐藏只影响展示，不代表幕后世界停止推进。所有三线输出都应带有可见性、知情来源和是否可写回的边界，避免当前状态、历史事件、未来大纲和玩家知识互相污染。

## 时间推进与停滞预防

本流程必须显式防止 AI roleplay 常见的停滞问题：一轮对话不等于游戏内一分钟，正式回合也不应因为玩家没有主动推进而无限停在同一句对话、同一表情或同一场景余味里。

除非玩家明确选择停留、等待、复盘、闲聊、细聊感情或要求慢节奏互动，否则每个正式回合都应至少产生一个 `campaignDelta`。这个 delta 可以来自玩家可见线、平行线或情感/张力线，形式包括时间推进、事件推进、危险升级、线索出现、资源变化、位置变化、NPC 主动行动、敌方计划推进、关系变化、误会加深、倒计时减少或场景阶段转换。

建议每轮维护以下 pacing 状态：

```ts
pacingState = {
  timeDelta,
  campaignDelta,
  pacingIntent,
  stagnationRisk,
  pacingDebt,
  activeClocks
}
```

`timeDelta` 由行动类型和叙事需要决定，而不是由对话轮数决定。战斗中的一招可能只经过数秒；一次交涉通常经过数分钟到十几分钟；搜索房间、治疗、准备、等待、赶路、调查或潜伏可以自然推进数十分钟、数小时，甚至更久。玩家输入“观察一下”“继续看看”“等对方反应”时，如果没有新信息目标，系统应优先推进时钟、反应、平行线或张力线，而不是原地复述。

`pacingIntent` 可使用 `hold`、`micro`、`medium`、`strong`、`scene_cut` 等级。`hold` 只适用于玩家明确要求停顿或当前高张力瞬间必须细分的情况；常规回合至少应是 `micro`；连续低信息量回合后应提升到 `medium` 或 `scene_cut`；玩家行动、倒计时、危险或大纲条件足够强时才使用 `strong`。

`stagnationRisk` / `pacingDebt` 用于检测空转。若连续 2-3 个正式回合只产生低信息量对话、无状态变化、无新线索、无关系变化、无时钟推进，则系统必须通过至少一条线主动推进：NPC 打断沉默、倒计时触发、敌方计划前进一步、远处事件留下痕迹、当前场景自然收束、平行线展示或隐藏推进、情感/张力发生明确变化。阈值可以配置，但第一版应把 2-3 轮作为推荐范围。

慢节奏不是错误，空转才是错误。若玩家明确选择细聊、暧昧、心理试探、沉默陪伴或审讯拉扯，游戏内时间可以只过很短，但 `tensionLine` 必须有可记录变化，例如信任上升、误会加深、边界松动、NPC 暴露弱点、情绪压力累计或关系选项改变。只有用户或 GM 明确要求完全暂停时，才允许没有 `campaignDelta`。

进行中事件和敌方计划应尽量以 clock / countdown 表示，例如仪式还有 3 格完成、追兵还有 2 格抵达、NPC 耐心还有 1 格耗尽、误会再拖 2 回合会固化。玩家不行动时，世界时钟仍然推进；世界不应默认等玩家开口才继续存在。

## 关键节点真空期与弹性事件

原作或 GM 大纲往往只定义关键节点、章节 beat、揭示顺序和重要冲突，不会填满全部可游玩时间线。两个关键节点之间的真空期不应默认视为空白，也不应只能用低破坏性日常事件填缝；它是 RPG runtime 中的弹性模拟时间段，可以跳过、压缩、推进平行线，也可以生成会改变大纲走向的原创事件。

真空期事件的限制不是“低破坏性”，而是：

- 因果成立：必须来自玩家行动、角色动机、地点条件、敌方计划、active clock、平行线推进、关系压力或 pacing pressure。
- 信息边界清楚：NPC 不能全知，玩家不可见信息不能自动进入玩家知识。
- 后果可落地：一旦事件通过结算、叙事校验和 review/apply，它就进入事实层，旧大纲必须让位。
- 大纲适配明确：如果事件导致旧 beat、reveal、branch condition 或后续关键节点不再成立，应触发 Outline Impact Detector，必要时进入第 14.5 步。
- 未来不伪装成历史：不能把尚未发生的未来大纲、可能性或修订提案写成 `events`。

建议显式维护 gap 状态：

```ts
gapState = {
  betweenBeats,
  gapMode,
  gapEvent,
  gapImpactLevel,
  affectedFutureBeats
}
```

`gapMode` 可以是 `skip`、`compress`、`parallel_line_tick`、`relationship_beat`、`branching_event` 或 `major_divergence_event`。其中 `branching_event` 和 `major_divergence_event` 都允许改变后续大纲，不需要事前取得大纲许可；它们只需要在发生前满足 runtime 因果和可见性约束，发生后进入大纲冲击检测与修订流程。

关键原则是：大纲修订不是事件发生前的许可，而是事件发生后的适配。真空期事件先作为 runtime 事实被合理结算；若它冲击大纲，第 14 步负责识别影响，第 14.5 步负责生成同回合临时补丁和可审阅修订提案。通过第 15-18 步的玩家可见叙事、review 和 apply 后，事件事实优先于旧大纲。

固定跳过仍然允许，但不应作为默认。玩家明确要求“直接到晚上”“跳到约定时间”“休息到明天”时，可以压缩或跳过；如果存在 active clock、pacing debt、关系压力、敌方行动、玩家主动调查或大纲前置铺垫需求，则系统应优先考虑平行线推进、关系 beat、branching event 或 major divergence event。

## 大纲分支保证

大纲修订不能只作为第 15 步的参考资料。重大偏离分支必须把 Story Outline Regenerator 的输出拆成两个层级：

- `provisionalOutlinePatch`：本回合立即生效的临时导演约束，用来硬性约束第 15 步叙事。它不落盘，不代表 `outlines/main.md` 已经被修改，但第 15 步必须服从。
- `outlineRevisionProposal`：可审阅的大纲修订提案，进入 pending/review 或等价审阅队列。它不能被普通 runtime update 静默合并到 `outlines/main.md`。

第 15 步不得直接读取完整新大纲或把修订提案当作已发生事实。第 16 步必须校验玩家可见叙事、平行线叙事和情感/张力摘要是否分别服从 `provisionalOutlinePatch`，并确认玩家可见线没有泄露平行线；若失败，不能展示给玩家，也不能进入第 17 步，必须回到第 15 步重写。

## 19 步流程

### 0. 冻结行动前快照（本地）

玩家输入后立即冻结当前 wiki 和 runtime metadata，不允许中途写回。快照代表行动前一刻的世界状态，包括时间、地点、current-scene、玩家状态、在场人物、进行中事件、倒计时、反应队列和最近回合摘要。后续所有判断都引用这个快照，避免流程中途读到半更新状态。

### 1. 构造最小行动解析上下文（本地）

从快照中读取解析行动必需的信息，而不是做总召回。上下文应包含当前场景、玩家位置与能力、在场人物、地点可行动条件、上一轮叙事摘要、正在倒计时的事件、玩家已知事实、相关硬规则、当前 pacing debt、最近低进展回合数、活跃 world clocks、当前大纲阶段和相邻关键 beat。目标是让行动解析站稳脚跟，同时避免旧 current-scene 过早污染后续召回。

### 2. 解析玩家输入意图（LLM 1）

Action Resolver 先判断玩家真正想尝试什么，而不是默认玩家已经成功。它要解析目标对象、动作类型、指代词、行动范围、时间跳跃信号，以及这是攻击、移动、交涉、观察、救援、调查、等待还是混合行动。不确定处必须显式列出，不能悄悄补成事实。

### 3. 生成行动事件草案（LLM 1）

在同一次 Action Resolver 输出中，把自然语言行动转换成结构化事件草案。草案记录事件类型、起点、目标、可能影响对象、预估耗时、风险、需要检查的条件和歧义点。它仍只是“玩家尝试”，不是已发生事实，也不产生 wiki 写回。

### 4. 验证行动可行性（LLM 1）

继续由 Action Resolver 判断行动可行、部分可行、失败，还是需要代价。判断依据来自玩家状态、距离、能力、资源、场景危险、世界规则和正在发生的事件。若行动不可直接完成，应输出阻碍和可成立的替代结果，而不是强行让玩家成功或完全无效。

### 5. 确定耗时与直接结果（LLM 1）

Action Resolver 将模糊耗时压成 `timeDelta` 区间，例如数秒、数分钟、数小时或数天，并给出行动的直接结果、成功程度、即时代价、资源消耗、暴露信息、现场变化和 `progressPotential`。这里仍只结算玩家行动本身；并行世界事件要等下一轮 world tick 统一推进。

`timeDelta` 不能默认为“一轮一分钟”。如果玩家行动本身是等待、搜索、交涉、赶路、治疗、准备、调查或观察，Action Resolver 应明确判断这段行动自然消耗多少时间。若玩家输入低信息量且没有明确推进目标，应标记 `progressPotential` 较低，供后续 pacing debt 和 world tick 使用。

当玩家行动发生在两个关键 beat 之间时，Action Resolver 还应标记是否可能触发真空期事件：玩家是否主动调查、伏击、结盟、泄露秘密、改变路线、拖延时间、提前接触某个角色或打断某个 clock。这只是触发可能性，不代表事件已经发生。

### 6. 生成玩家行动增量（本地）

Action Resolver 输出的 `ActionResolution.playerActionDelta` 是权威玩家行动增量，只记录玩家行动直接造成的变化，例如位置改变、物品消耗、伤势、关系触发、敌人被打断、秘密暴露或剧情节点被改写。该 delta 是 working state 输入，不直接写 wiki，也不包含场外自然推进。

本地代码只做确定性结构和边界检查，例如必填字段、枚举值、`scope: "player_action_only"`、引用形状，以及禁止 wiki write、叙事正文、World Tick / Reaction 输出污染；不从 `directResults` 二次派生另一份 canonical delta，也不根据 `directResults` 重判或改写 `playerActionDelta`。如果 Action Resolver 的解释文本和 `playerActionDelta` 存在语义不一致，后续 World Tick 仍以 `playerActionDelta` 作为机器状态输入；一致性应通过 Action Resolver prompt、输出契约和测试来约束。

### 7. 推进行动期间的世界时钟（LLM 2）

World Tick 根据行动实际耗时、pacing debt 和活跃 world clocks 推进同一时间区间内的其他事件。短时间只推进现场反应和即时危险；数小时可推进移动、侦察、联络和准备；数天则允许配角线、敌方计划、资源变化和地点状态自然发展。它必须受快照和既有动机约束，并把变化归入 `playerVisibleLine`、`parallelLine` 或 `tensionLine`。平行线可以在玩家视角之外推进，但不能因此自动成为玩家已知事实。

如果最近回合已经出现停滞，World Tick 应优先推进至少一个 clock、反应、危险、线索、远处事件或关系压力。玩家不主动推进时，世界仍然可以通过倒计时、NPC 主动行动和平行线自然前进。

如果当前处于两个关键 beat 之间，World Tick 同时承担 Gap / Vacuum Detector 的前半段职责：判断这段时间应 `skip`、`compress`、推进 `parallel_line_tick` / `relationship_beat`，还是生成 `branching_event` / `major_divergence_event`。原创真空期事件可以改变后续大纲，但必须先在这里按角色位置、动机、情报来源、资源和 clock 约束结算为 runtime delta，不能留到第 15 步由叙事器凭空编造。

### 8. 结算进行中事件（LLM 2）

World Tick 检查旧快照中的倒计时和悬置事件是否被玩家行动打断、延后、完成、失败或改向。例如追击、仪式、救援路程、调查进度、黑影吞噬或封锁升级，都要在新时间点得到状态。每个结算结果都应标记所属叙事线、可见性、知情来源和 clock 变化。可能未来和已发生事实必须分开。

倒计时不是装饰字段。只要行动耗时、玩家等待、场景拖延或 pacing debt 积累到阈值，相关 clock 就应减少、触发、暂停或改向，并把原因写入 working state。

若本轮生成或触发了真空期事件，World Tick 必须输出 `gapEvent` 和 `gapImpactLevel`。`gapEvent` 记录事件成因、参与者、发生地点、已发生结果、玩家是否可见、影响到的未来 beat；`gapImpactLevel` 可以是 normal / branch / major。此处只认定 runtime 事实和初步影响，不直接改写 `outlines/main.md`。

### 9. 广播本轮事件（LLM 2）

同一轮判断哪些角色知道本轮事件，并区分亲眼看到、间接感知、事后得知、误判和完全不知道。角色不能全知反应，只能根据自己的位置、感官、情报渠道、立场和已有误会行动。广播结果会限制后续反应队列与叙事可见性。平行线是否向用户展示，不等于玩家角色或现场 NPC 已经收到该情报。

### 10. 生成角色反应队列（LLM 2）

World Tick 为相关角色生成简短反应，分为立即反应、延迟反应、平行线反应、情感/张力反应和无明显反应。每个角色只保留一条核心反应，避免所有人同时抢戏。反应必须标记可见性和知情来源，平行线反应不能自动变成玩家可知事实。

当 pacing debt 较高时，反应队列应允许 NPC 主动打断、提出要求、离场、暴露情绪、推进计划或把沉默变成后果。角色反应不应永远停留在“看着玩家等待下一句话”。

### 11. 选择当前场景可见内容与平行线镜头（本地）

本地策略从玩家行动结果和反应队列中挑选当前最该展示的玩家可见内容。优先现场人物、直接后果、关键代价、危险变化和戏剧张力；玩家不可见变化在玩家可见线中只保留可见痕迹或提示，不摊开幕后全貌。

同一步还可以选择本轮平行线镜头：哪些幕后、敌方、次要角色或远处事件值得生成 `parallelLineText`。`displayPolicy.showParallelLine` 只决定该平行线镜头是否在 UI 中展示，不改变事实、不改变玩家角色知识，也不影响后续写回审阅边界。

如果玩家可见线本轮缺少足够变化，本地策略应检查是否由平行线或情感/张力线承担 `campaignDelta`。若三条线都没有变化，应提高 `stagnationRisk`，并在第 14 步要求更强的 pacing intent。

### 12. 合并行动后 working state（本地）

把行动前快照、玩家行动 delta、世界时钟 delta、倒计时结算、情报广播和反应队列合并为行动后 working state。合并时检查时间、地点、人物状态、因果顺序、三线归属、可见性、`timeDelta`、clock 变化和 pacing debt 是否一致。这个状态是召回锚点，但还不是持久化 wiki。

working state 应显式记录本轮候选 `campaignDelta` 和 `gapState`。如果没有可识别 delta，必须记录停滞原因和下一步需要补偿的 pacing pressure，而不是把空回合当作正常推进。若存在 `gapEvent`，working state 必须保留它的因果链、可见性、影响对象和初步大纲影响，供第 13-14 步召回与检测使用。

### 13. 行动后总召回（LLM 3）

Recall Selector 必须基于行动后 working state 召回，而不是基于旧 current-scene。它选择本轮三线叙事真正需要的 wiki path、memo、事件、关系、任务、tensionLine 大纲、plot-arc 原料、规则、runtime overlay、active clocks、pacing history、相邻关键 beat、branch conditions 和 gapEvent 相关角色/地点/阵营材料，并说明 priority、reason、lineTarget、visibility 和 exclusions。实际读文件仍由本地 allowlist 执行。

### 14. 生成叙事器指导并检测大纲冲击（LLM 4）

Outline-aware Brief Compiler 把 working state、召回材料、大纲、规则、反应队列、pacing state、gapState 和可见性边界压缩成给叙事器的短提示。它按 `playerVisibleLine`、`parallelLine` 和 `tensionLine` 过滤大纲材料，说明当前场景重点、应展示的张力、人物即时反应、禁止越界的信息、不得在玩家可见线揭露的平行线内容、下一步可引导玩家注意的线索、本回合必须产生的 `campaignDelta` 和 `pacingIntent`。其中 `tensionLine` 是长期情感/张力推进大纲，Brief Compiler 应根据 working state、relationships/runtime 和 `plot-arcs` 原料判断本回合 tensionLine 是否应推进、暂缓、反转或重写，并输出 `tensionLineUpdateCandidate`。完整大纲只在这一层被读取和过滤；第 15 步不应直接读取完整 `outlines/main.md`。

第 14 步的 brief 应把输出边界拆清楚：`playerFacingBrief` 只包含玩家角色可见或可合理推断的内容；`parallelLineBrief` 包含可生成平行线叙事的幕后推进；`tensionBriefInput` 汇总 tensionLine 当前推进目标、关系/误解/信任变化、压力源和可采用的 plot-arc 原料。三者可以互相影响，但不能混成同一份无可见性标记的叙事提示。

第 14 步还必须做停滞判断。如果玩家没有明确要求暂停，而最近 2-3 个正式回合缺少实质变化，brief 不得继续给出纯反应式、低信息量、原地等待的叙事指导。它应选择 `medium`、`strong` 或 `scene_cut` 级别的 `pacingIntent`，并指定至少一个要推进的 clock、线索、关系压力、NPC 行动、平行线事件或场景阶段转换。

同一轮 LLM 内部同时承担 Gap / Vacuum Detector 后半段与 Outline Impact Detector 职责。它要判断本轮 working state 是否只是正常进度、轻微偏离、可自然吸收的分支，还是已经导致 `major_rewrite_required`。检测输出应至少标记 gapMode、gapEvent、gapImpactLevel、受影响的 line、beat、reveal、branch condition、plot arc、旧大纲不再成立的原因，以及是否需要触发第 14.5 步。单条情感/张力线的轻微变化通常不应触发全局重写；跨线依赖断裂、玩家可见线与平行线互相矛盾、核心 reveal 顺序失效、或真空期事件使后续关键 beat 不再因果成立时，才更可能进入重大偏离分支。

如果没有重大偏离，第 14 步直接产出最终 narration brief。如果存在重大偏离，第 14 步不应假装旧大纲仍可照常推进，而应产出 `outlineImpactReport` 和 `regenerationRequest`，交给第 14.5 步生成临时大纲补丁与修订提案。

### 14.5 条件：生成临时大纲补丁与大纲修订提案（LLM +1）

只有当第 14 步输出 `major_rewrite_required` 时，才调用 Story Outline Regenerator。它输入行动后 working state、已召回的大纲切片、plot-arcs/runtime overlay、outline progress、impact report、gapEvent / gapImpactLevel、必须保留的主题/张力和不可改写的已发生事实。

Story Outline Regenerator 必须同时输出两个对象。第一个是 `provisionalOutlinePatch`，作为本回合立即生效的导演约束，至少包括受影响的叙事线、暂停或失效的旧 beat、必须承认的新事实、不得继续推进的旧安排、仍不能揭露的信息、下一幕自然承接方向和第 15 步必须遵守的 `mustFollow` / `mustNotReveal`。第二个是 `outlineRevisionProposal`，作为可审阅的大纲修订提案，解释故事为什么转向、哪些未来安排需要调整、哪些主题和角色冲突应保留。

`provisionalOutlinePatch` 不写回 wiki，但第 15 步必须服从它。补丁应分别说明玩家可见线、平行线和情感/张力线的约束，避免为了修一条线而无意重写全部大纲。`outlineRevisionProposal` 也不能直接覆盖 `outlines/main.md`；它只能作为独立 review item / pending proposal，在第 16 步叙事校验通过后再由本地流程放入审阅边界。两者都不能改写已发生事件，不能把未来方案写成 `events`，也不能让普通 runtime update 静默修改 `outlines/main.md`。

### 15. 生成玩家可见叙事、平行线叙事与张力摘要（LLM 5）

Narration Generator 根据 brief 写出 `playerFacingText`、`parallelLineText`、`tensionBrief` 和 `nextActionOptions`。它可以负责文风、节奏、镜头、对白和悬念，但不能改写已结算的 working state，不能让角色知道自己不知道的事，也不能把未选择选项、未来计划或平行线推测写成既成事实。

`playerFacingText` 是玩家角色真正看到、听到、感受到或可合理推断的正文。`parallelLineText` 是同一回合内玩家角色不可见的幕后或远处叙事，默认生成，但是否向用户展示由 `displayPolicy.showParallelLine` 控制。`tensionBrief` 是本轮情感/关系/戏剧张力的结构化摘要，可以供 GM、review 和后续 update proposal 使用，不必直接作为玩家可见正文展示。

Narration Generator 可以根据 `pacingIntent` 合理压缩时间、收束场景或切换镜头，例如“接下来的十分钟里……”“当你们抵达时……”“谈话拖到走廊灯光暗下……”“与此同时，另一边……”。它不应默认每轮只承接一句对白后的下一秒；如果 brief 要求 `scene_cut`，叙事应把时间跳跃、场景转换和新的可行动局面写清楚。

如果本轮存在 `gapEvent`，Narration Generator 只能呈现已经在 World Tick / working state 中结算过的事件及其后果。它可以写出事件的戏剧效果、镜头节奏和玩家可见选择点，但不能在第 15 步临时发明新的重大真空期事件，也不能为了把故事拉回旧大纲而抹平已结算偏离。

如果第 14.5 步触发，第 15 步必须把 `provisionalOutlinePatch` 视为硬约束，而不是可选参考。它不得继续推进已暂停的旧 beat，不得遗漏 `mustFollow`，不得在玩家可见线泄露 `mustNotReveal`，也不得把 `outlineRevisionProposal` 中的未来安排写成已经发生的事实。叙事器仍然不直接读取完整新大纲，只读取经过 Regenerator 过滤后的本轮 handoff。

### 16. 校验叙事一致性（本地，重大回合可选 LLM）

默认用本地校验检查叙事是否违反 working state、可见性、引用路径和禁止假设。校验必须区分 `playerFacingText`、`parallelLineText` 和 `tensionBrief`：玩家可见正文不能泄露平行线；平行线正文不能伪造未结算事实；情感/张力摘要不能把心理推测写成公开事实。重大剧情、战斗、长时间跳跃或多线并行时，可以追加一轮 LLM consistency judge，但不计入最小六次流程。若校验失败，应要求重写叙事，而不是直接写 wiki。

校验还应检查 pacing compliance：叙事是否体现了 brief 要求的 `timeDelta`、`campaignDelta` 和 `pacingIntent`。如果连续停滞后 brief 要求推进，而第 15 步仍只输出低信息量对话或原地等待，应判为失败并回到第 15 步重写。

对于真空期事件，校验重点不是“是否偏离大纲”，而是偏离是否由合理因果产生：角色是否能到场、是否知道相关信息、动机是否成立、资源是否足够、clock 是否支持、可见性是否正确、是否把未来安排伪装成已发生事实。若事件合理但冲击大纲，应进入或维持第 14.5 分支，而不是强制删掉事件。

如果第 14.5 步触发，本地校验必须额外检查叙事是否服从 `provisionalOutlinePatch`：是否继续推进了已暂停旧 beat，是否遗漏必须承认的新事实，是否违反 reveal 限制，是否把未来修订提案伪装成已发生事实。只有通过这一门禁后，玩家可见正文、平行线正文、张力摘要和大纲修订提案才可以进入后续展示与 review 边界；失败时回到第 15 步重写。

### 17. 生成 wiki 更新提案并进入 review（LLM 6 + 本地）

Runtime Update Proposal 根据已结算 working state 和实际叙事生成 wiki 更新提案，覆盖 current-scene、events、player、relationships/runtime、plot-arcs/runtime、tensionLine slot、reaction-queue 和日志。随后本地 validator 将合法更新放入 pending/review；本轮 LLM 不直接落盘。

三线写回边界必须分开：玩家可见线中已发生且玩家知道的变化可以更新 current-scene、events、player known information 和相关 runtime overlays；平行线中已发生的幕后事件可以作为带可见性标记的 pending event、reaction-queue 或 turn journal 项进入 review，但不能因为 `showParallelLine` 打开就自动写入玩家已知信息；情感/张力线优先生成 tensionLine slot 更新，同时把具体关系事实写入 relationships/runtime，把新增或激活的剧情压力素材写入 plot-arcs/runtime，只有真正发生了可离散记录的行动时才进入 events。

Runtime Update Proposal 还应生成 pacing 相关更新：本轮实际 `timeDelta`、已完成或减少的 clock、产生的 `campaignDelta`、是否降低或增加 `pacingDebt`、以及下一轮需要注意的停滞风险。若本轮没有产生可审阅 delta，proposal 必须显式说明原因，不能静默把空转写成正常进展。

如果本轮产生 `gapEvent`，Runtime Update Proposal 应把已发生事实和大纲影响分开：离散已发生事件进入 `events` pending；当前后果进入 current-scene 或 runtime overlays；关系事实进入 relationships/runtime；压力素材进入 plot-arcs/runtime；长期情感/张力推进变化进入 tensionLine slot；相对大纲的位置、跳过/提前/失效 beat 和偏离说明进入 `outlines/progress.md` pending；对 `outlines/main.md` 的未来修订只能作为独立 `outlineRevisionProposal`。

如果本回合生成了 `outlineRevisionProposal`，它应作为独立大纲审阅项进入 review/pending，而不是混入普通 runtime update。普通 runtime update 仍不得写 `outlines/main.md`；它最多在既有规则允许下更新 `outlines/progress.md`，记录当前相对大纲的位置、偏离说明和本轮临时补丁已被叙事采用的事实。

### 18. 应用已接受更新并归档回合（本地）

只有用户或规则允许的 accepted updates 才会通过 apply 写回 wiki。写回应更新 current-scene、events、runtime overlays、pending queue、turn journal、active clocks 和 pacing state，并保留旧快照作为事件链来源。被拒绝或未审核的提案不能改变世界状态，也不能污染下一轮召回。

如果用户或规则明确接受了独立大纲修订项，才允许通过大纲修订流程更新 `outlines/main.md` 或等价控制层文件。未接受的大纲修订提案不能改变后续 Context Compiler 的权威大纲；已经通过第 15-16 步的玩家可见叙事、平行线叙事和已接受 gapEvent，则按各自可见性和审阅结果作为事实来源进入本轮归档。`showParallelLine` 的展示选择也应归档，但它只表示用户界面显示偏好，不表示玩家角色获得了对应知识。已接受的真空期事件事实优先于旧大纲；后续 Context Compiler 必须以事实层和 outline progress 为准，而不是强行回到旧关键节点。


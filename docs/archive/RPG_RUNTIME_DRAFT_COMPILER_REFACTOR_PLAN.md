# RPG Runtime Draft/Compiler Refactor Plan

## 当前状态

本计划用于记录 World Tick 之后，是否以及如何把其它 runtime LLM 阶段也改成 `Draft -> local compiler -> strict canonical validator`。

截至 2026-06-14：

- `world_tick` 已完成首个 draft/compiler 改造：LLM 输出轻量 `WorldTickDraft`，本地 `compileWorldTickDraftOutput()` 补齐 `tickId`、空数组、visibility、`runtimeDeltaRefs`、`timeDeltaBasis`、`pacingUpdate` 和 `gapState` 默认字段，最终仍调用严格 `validateWorldTickResult()`。
- `recall_selector` 已经是轻量 allowlist 输出：模型只选择路径、section、readMode、priority 与边界元数据；确定性 reader 再读取 `recalledMaterials`。
- `outline_brief` 已完成 Phase 1 draft/compiler 改造：LLM 输出轻量 `OutlineBriefDraft`，本地 compiler 补齐 `sourceWorkingStateId`、完整 `OutlineBriefReference` envelope、impact report ID、major-rewrite-only regeneration request 和固定知识边界，最终仍调用严格 `validateOutlineBriefCompilerOutput()`。
- `runtime_update_proposal` 已完成 Phase 2 draft/compiler 改造：LLM 输出轻量 `RuntimeUpdateProposalDraft`，本地 compiler 生成 proposal/group/skip IDs、`sourceDeltas`、visibility、actor knowledge、reveal gates、validation hints 和 review metadata，最终仍调用 canonical validator 并进入 deterministic pending validation。
- Story Outline Regenerator 与 Narration Generator 已做过 prompt contract 展开，但仍不是 draft/compiler 架构。

本计划已完成最高优先级的 Phase 1 / Phase 2；后续 Phase 3+ 仍是候选改造方向。

## 背景判断

World Tick 适合 draft/compiler，是因为它混合了两类职责：

1. 语义职责：本轮世界如何响应、哪些 delta 存在、节奏是否推进。
2. 协议职责：生成稳定 ID、补空数组、补 visibility envelope、补 runtime refs、补 canonical 默认字段。

语义职责适合交给 LLM；协议职责更适合本地确定性 compiler。

Outline Brief 和 Runtime Update Proposal 当前也有同样问题。尤其 `OutlineBriefReference` 的完整字段并不是模型真正需要“创作”的内容，大多数都可以从 `recalledMaterials`、`knownReferences`、`runtimeRefs`、`outlineSlices` 和本地 visibility/knowledge policy 派生。让模型手写这些字段会增加 prompt 体积和失败率。

## 与 Recall Slimming 的关系

之前的 recall 瘦身主要收窄两件事：

- 哪些 wiki 页面 / section 会进入 recall allowlist。
- deterministic reader 实际读取多少 wiki 正文。

它没有自动瘦掉后续阶段的输出协议，也不会自动压缩每个阶段自己的 handoff 展开。

因此 Outline Brief prompt 仍然可能很大，原因包括：

- Outline Brief 不只消费 `recalledMaterials`，还会消费 `postActionWorkingState`、`actionResolution`、`worldTickResult`、`visibleSelection`、`recallSelection`、`outlineSlices`、`plotArcTensionFuel`、`hardConstraints`、`runtimeRefs`、`knownReferences`。
- `outlineSlices` 会把已召回的大纲材料重新加工为 GM control / reveal gate / progress marker 元数据，包含 stable ids、reveal policies、line target fallback、dependencies 和 invalidation notes。
- `knownReferences` / `runtimeRefs` 为 validator 提供合法引用集合，但也增加了 prompt 结构体体积。
- 当前 prompt contract 仍要求模型输出完整 `OutlineBriefReference[]`，而不是只输出轻量引用选择。

所以 recall slimming 减少的是 wiki 正文噪声；draft/compiler 改造要减少的是模型输出协议负担和 prompt contract 负担。两者互补，不是同一个层面。

## 总体目标

将适合的 runtime LLM 阶段改为：

```text
LLM semantic draft
-> deterministic local compiler
-> existing strict canonical validator
-> existing orchestrator handoff
```

目标不是放宽协议，而是把协议补齐移到本地：

- LLM 输出更短、更贴近语义决策。
- 本地 compiler 负责稳定 ID、引用归一化、visibility / knowledge 派生、runtime refs、默认空数组、固定布尔边界、review boundary。
- canonical validator 继续作为最终验收，不被绕过。
- Debug trace 同时记录 raw draft、compiled canonical output、validation result。

## 非目标

- 不增加 legacy/default 项目兼容、迁移 fallback 或旧路径保留。
- 不做 silent fallback，不吞掉协议错误。
- 不把 compiler 做成“修坏 JSON 的 repair/sanitizer”。Draft 必须有明确 schema；compiler 只从合法 draft 和已知输入确定性生成 canonical output。
- 不在 validator 内静默补默认值；默认值补齐发生在 compiler，之后仍走严格 validator。
- 不跳过 pending / review / apply 边界。
- 不把未来大纲、GM-only truth 或 parallelLine-only 内容自动写入 PC knowledge。

## 设计原则

1. **LLM 只做语义选择。** 让模型判断剧情、节奏、可见信息、写回意图；不要让模型手写可本地派生的 envelope 字段。
2. **compiler 只做确定性编译。** 输入必须来自 draft 和本阶段已知 handoff，不从文件系统额外偷读。
3. **canonical type 不急着改。** 优先新增 draft type 和 compiler，保留现有 canonical output 类型与 validator。
4. **validator 保持严格。** compiler 输出必须通过现有 `validate*()`。
5. **错误显性化。** draft 缺必需语义字段时直接报错；不要补一个看似合理但掩盖模型越界的值。
6. **引用只允许来自 known refs。** Draft 中的 path / sectionId / stableId / runtimeDeltaId 必须能在本阶段 input 里找到。
7. **先做高频高失败阶段。** 优先 Outline Brief 和 Runtime Update Proposal；低频或 prose-heavy 阶段后置。

## 阶段优先级

### Phase 0 - Contract Audit + Trace Baseline

目标：先冻结各阶段当前失败模式、prompt 体积和可本地派生字段。

范围：

- 审计所有 runtime LLM 阶段的 prompt contract、parser、validator 和 trace 输出。
- 从真实 debug trace 中记录各阶段 prompt chars、raw output chars、失败字段、重复 handoff 区域。
- 列出每个 canonical output 中哪些字段属于：
  - LLM 语义判断
  - 本地可派生
  - 固定边界字段
  - 必须显式拒绝或校验的危险字段

验收：

- 每个阶段都有“是否适合 draft/compiler”的明确结论。
- 不修改 runtime 行为。

### Phase 0 Audit Result - 2026-06-14

本次 Phase 0 已完成只读 contract audit / trace baseline。结论直接写回本计划，供 Phase 1+ 继续使用。本阶段没有修改 runtime 行为、prompt、parser、validator、orchestrator handoff、wiki 写回、pending/review/apply 边界、fallback、parser repair 或 legacy/default 兼容。

#### Trace baseline

可读真实 trace：

`C:\Users\Administrator\Documents\Works\Chem\test1\rpgtest7\.llm-wiki\runtime\debug-traces\rpg-runtime-trace-rpg-action-1-mqder6fw.json`

这是一份旧 contract 失败 trace，可作为“为什么需要 draft/compiler”的基线，不代表当前 `world_tick` draft compiler 后的新成功 trace。

| step | status | prompt chars | raw output chars | input chars | validation chars | failure phase / message |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `action_resolver` | succeeded | 37,559 | 3,868 | 37,529 | 4,778 | none |
| `world_tick` | failed | 67,581 | 4,687 | 76,811 | 157 | validation: `Invalid WorldTickResult.clockUpdates: must be an array.` |
| `recall_selector` | pending | 0 | 0 | 0 | 0 | blocked by `world_tick` failure |
| `outline_brief` | pending | 0 | 0 | 0 | 0 | blocked by `world_tick` failure |
| `story_outline_regenerator` | pending | 0 | 0 | 0 | 0 | blocked by `world_tick` failure |
| `narration_generator` | pending | 0 | 0 | 0 | 0 | blocked by `world_tick` failure |
| `runtime_update_proposal` | pending | 0 | 0 | 0 | 0 | blocked by `world_tick` failure |

Prompt source distribution in the same trace:

- `action_resolver`: fixed prompt 4,446 chars; player input 78 chars; wiki file sections 33,007 chars; runtime handoff 28 chars. Largest repeated/noisy area was `preActionSnapshot` at 27,889 chars.
- `world_tick`: fixed prompt 7,928 chars; player input 99 chars; runtime handoff 9,293 chars; wiki file sections 50,261 chars. Largest areas were `preActionRefs` at 38,988 chars and `ongoingEvents` at 11,251 chars.
- Later stages have no real prompt/output numbers in this trace because execution stopped at `world_tick`.

#### Stage audit table

| stage | current contract | trace coverage | Phase 0 conclusion |
| --- | --- | --- | --- |
| `action_resolver` | LLM outputs canonical `ActionResolution`; `parseRpgActionResolverOutput()` / `validateActionResolution()` enforce the shape. | Full prompt/raw/parsed/validation coverage in `turn-orchestrator.ts`; old trace succeeded. | 暂不建议整体改造。只评估 ID/reference 局部 compiler。 |
| `world_tick` | Current code already accepts lightweight `WorldTickDraft`, compiles with `compileWorldTickDraftOutput()`, then calls strict `validateWorldTickResult()`. | Old trace captured canonical-output failure on missing `clockUpdates`; current draft/compiler exists to remove that mechanical failure. | 已完成 draft/compiler。后续只需保持 trace 能区分 raw draft、compiled output 和 canonical validation。 |
| `recall_selector` | LLM outputs lightweight `RecallSelection` allowlist; deterministic handoff reads `recalledMaterials`. | No real post-world-tick coverage in available trace. | 已是轻量 allowlist。不需要整体 draft/compiler。 |
| `outline_brief` | LLM still outputs canonical `OutlineBriefCompilerOutput`; `validateOutlineBriefCompilerOutput()` requires full `OutlineBriefReference` envelopes and actor knowledge metadata. | No real prompt/output numbers in available trace; separate real failure已记录为 simplified reference 缺 `lineTarget` / `usePurpose` / `visibilityScope` / `knowledgeScope`。 | 强烈适合。进入 Phase 1。 |
| `story_outline_regenerator` | Conditional LLM output is canonical `StoryOutlineRegeneratorOutput`; validator requires patch/proposal IDs, fixed review/non-persistence boundaries, safety booleans and refs. | No real prompt/output numbers in available trace; only major rewrite path runs it. | 局部适合，但后置到 Phase 4。误编译风险高于 Outline Brief。 |
| `narration_generator` | LLM outputs canonical `TurnNarration`; prose and metadata currently mixed in one output. | No real prompt/output numbers in available trace. | 局部适合。优先 reference/meta compiler，不整体替换 prose output。 |
| `runtime_update_proposal` | LLM outputs near-canonical `RuntimeUpdateProposalResult`; `validateRuntimeUpdateProposalResult()` plus deterministic pending validation enforce write boundaries. | Recorded by `runtime-controller.ts`, but no real prompt/output numbers in available trace because earlier stage failed. | 强烈适合。进入 Phase 2。 |

#### Field classification by stage

`action_resolver`

- LLM 语义判断：`parsedIntent`、`eventDraft` 的行动裁定与状态、`feasibility`、`costs`、`obstacles`、`directResults`、`timeDelta`、`progressPotential`、`playerActionDelta` 的语义内容。
- 本地可派生：`resolutionId`、`eventId`、cost/obstacle/result/delta IDs、reference envelope 的 `usePurpose` / `visibilityScope` / `knowledgeScope` 候选。
- 固定边界字段：不得输出 player-facing narration、World Tick/reaction 内容、wiki write proposal；`eventDraft.status` 缺省仍按现有逻辑处理为 `attempted_not_confirmed`。
- 危险字段必须拒绝/校验：`confirmed_happened` 没有 `confirmationBasis`、把尝试行为写成已发生事件、把 update proposal 或 narration 混进 Action Resolution。

`world_tick`

- LLM 语义判断：本轮世界响应、世界 delta 摘要、时钟是否变化、进行中事件是否结算、信息是否广播、NPC/环境反应、节奏和 gap 语义。
- 本地可派生：`tickId`、空数组、delta IDs、完整 visibility、`runtimeDeltaRefs`、`timeDeltaBasis`、`pacingUpdate` 和 `gapState` 默认 canonical 字段、部分 affected path。
- 固定边界字段：`playerVisibleLine` / `parallelLine` / `tensionLine` 只是 narration lens；draft 不应手写内部 canonical-only envelope。
- 危险字段必须拒绝/校验：forbidden draft keys、非法 `happenedStatus` / `knowledgeScope`、把 GM/hidden/parallel-only 信息授予 PC、引用不存在的 path / section / runtime delta。

`recall_selector`

- LLM 语义判断：从 retrieval index 中选择哪些 path/section、`readMode`、priority、选择/排除理由。
- 本地可派生：实际读取正文、`recalledMaterials`、section body 裁剪、handoff summary。
- 固定边界字段：recall budget、read policy、allowlist 范围由 input policy 决定。
- 危险字段必须拒绝/校验：选择 retrieval index 外 path/section、使用 wildcard/glob、在 policy 不允许时 full-page read、把 `parallelLine` / user-visible-PC-unknown 材料声明为 PC knowledge。

`outline_brief`

- LLM 语义判断：player-facing brief 摘要与当前 scene focus、哪些已知引用可用于叙事、parallel/tension brief 语义、pacingDirective、campaignDeltaRequirement、outlineImpactReport 的影响判断。
- 本地可派生：`sourceWorkingStateId`、`OutlineBriefReference` 的 `lineTarget` / `usePurpose` / `visibilityScope` / `knowledgeScope` / `knowledgeClaims`、`outlineImpactReport.reportId`、`regenerationRequest` ID 和引用 envelope。
- 固定边界字段：`parallelLineBrief.grantsPcKnowledge` 必须为 `false`；只有 `major_rewrite_required` 且 `requiresRegeneration === true` 才允许 regeneration request。
- 危险字段必须拒绝/校验：GM-only / hidden / delayed reveal 进入 player-facing knowledge、unknown path / sectionId / stableId / runtimeDeltaId、把 future outline beat 写成已发生事实。

`story_outline_regenerator`

- LLM 语义判断：受影响 outline refs、暂停/失效 beat、必须保留事实、未来 revised beats、reveal order、branch adjustments、next scene direction。
- 本地可派生：patch/proposal/handoff IDs、`nonPersistenceBoundary`、`reviewBoundary`、safety report 固定布尔值、visibility boundaries envelope、runtime refs。
- 固定边界字段：只在 major rewrite path 运行；provisional patch same-turn only；outline revision 是独立 review item，不是普通 runtime update。
- 危险字段必须拒绝/校验：直接写 `wiki/outlines/main.md`、生成普通 wiki update、把未来修订写入 `events`、泄露 forbidden reveal 或 hidden/GM material、重写 confirmed facts。

`narration_generator`

- LLM 语义判断：`playerFacingText`、可选 `parallelLineText`、语气/节奏/对话/描写、next action option 的玩家可读文本与意图。
- 本地可派生：`narrationMeta.narrationId`、source refs、player knowledge boundary audit、provisional patch usage、next action option IDs / sourceRefs、`tensionBrief` 的固定非事实边界。
- 固定边界字段：tension brief 不应作为普通事件事实展示；provisional outline patch 只能 same-turn 使用。
- 危险字段必须拒绝/校验：player-facing prose 包含 GM-only / hidden truth、parallel line 授予 PC knowledge、把 tension/style/meta 写成 wiki fact、伪造未授权 source refs。

`runtime_update_proposal`

- LLM 语义判断：本轮是否需要写回、目标 `targetPath`、写入策略、内容、reason、语义层面的 happened status / confidence / risk notes、跳过 delta 的理由。
- 本地可派生：proposal/group IDs、从 `turnRecord` / `worldTickResult` / `visibleSelection` / `outlineAwareNarrationBrief` / `recalledMaterials` 编译 `sourceDeltas`、`lineTarget`、visibility、knowledge claims、reveal gates、validation hints、write/review policy。
- 固定边界字段：ordinary update 禁写 `wiki/outlines/main.md`；pending/review/apply 边界保持独立；deterministic `validateRpgRuntimeUpdateProposals()` 仍是 staging 前验收。
- 危险字段必须拒绝/校验：events 非 confirmed-only、NPC-only/GM-only 写入 player known info、NPC holder 不匹配、relationship information gap 缺 holder/non-holder 或 belief 差异、reveal progress 缺 reveal gate/state、wildcard/glob/category path。

#### Phase 0 implementation notes

- Trace 结构已经能记录 `inputSections`、`promptSections`、`rawOutput`、`parsedOutput`、`validationSections` 和 `handoffSections`。前六个 runtime LLM stage 主要由 `turn-orchestrator.ts` 记录；`runtime_update_proposal` 由 `runtime-controller.ts` 记录。
- Draft/compiler 阶段后续应扩展 trace，而不是替换现有 trace：保留 raw draft、parsed draft、compiler input summary、compiled canonical output summary、canonical validation result 和 compiler warnings。
- Phase 1 不应复用旧 canonical parse failure 作为 fallback 成功路径；`OutlineBriefDraft` 应有明确 schema，draft validation 失败必须显性报错。

### Phase 1 - Outline Brief Draft/Compiler

优先级：最高。

目标：把 `outline_brief` 从直接输出 canonical `OutlineBriefCompilerOutput` 改为输出轻量 `OutlineBriefDraft`，本地编译为 canonical `OutlineBriefCompilerOutput`。

建议 draft 输出只保留模型需要决定的语义：

```json
{
  "briefId": "string",
  "playerFacingBrief": {
    "summary": "string",
    "currentSceneFocus": "string",
    "allowedKnowledgeRefs": [
      { "path": "string", "sectionId": "string", "reason": "string" }
    ],
    "immediateReactions": ["string"],
    "clueDirections": ["string"],
    "mustNotRevealStableIds": ["string"]
  },
  "parallelLineBrief": {
    "summary": "string",
    "allowedParallelRefs": [],
    "parallelBeatFocus": ["string"],
    "displayPolicy": "user_visible_pc_unknown | gm_only | hidden"
  },
  "tensionBriefInput": {
    "summary": "string",
    "tensionLineUpdateCandidate": "optional semantic object",
    "relationshipPressure": ["string"],
    "plotArcFuelRefs": [
      { "path": "string", "sectionId": "string", "reason": "string" }
    ],
    "shouldAdvance": "boolean"
  },
  "pacingDirective": {
    "intent": "hold | soft_push | medium | strong | scene_cut",
    "reason": "string",
    "requiredMovement": ["string"],
    "avoidStagnation": "boolean"
  },
  "campaignDeltaRequirement": {
    "required": "boolean",
    "minimumDelta": "none | minor | meaningful | scene_changing",
    "reason": "string",
    "candidateSources": ["string"]
  },
  "outlineImpactReport": {
    "impactLevel": "none | minor | branch | major_rewrite_required",
    "affected": "semantic refs only",
    "invalidatedAssumptions": ["string"],
    "reason": "string",
    "requiresRegeneration": "boolean"
  },
  "warnings": ["string"]
}
```

本地 compiler 负责：

- 补 `sourceWorkingStateId`。
- 将 `allowedKnowledgeRefs`、`allowedParallelRefs`、`plotArcFuelRefs`、`references` 编译成完整 `OutlineBriefReference`：
  - `lineTarget`
  - `usePurpose`
  - `visibilityScope`
  - `knowledgeScope`
  - `knowledgeClaims`
  - `reason`
- 基于 `knownReferences`、`recalledMaterials`、`outlineSlices`、`runtimeRefs` 校验引用来源。
- 防止 GM-only / hidden / delayed reveal 进入 `playerFacingBrief.allowedKnowledge`。
- 保证 `parallelLineBrief.grantsPcKnowledge` 固定为 `false`。
- 补 `outlineImpactReport.reportId`。
- 只有当 `impactLevel === "major_rewrite_required"` 且 `requiresRegeneration === true` 时，才允许编译 `regenerationRequest`。
- 最后调用 `validateOutlineBriefCompilerOutput()`。

测试：

- prompt 明确要求 `OutlineBriefDraft`，不再要求模型手写完整 `OutlineBriefReference`。
- trace 中的简化 reference draft 可以编译为合法 canonical output。
- GM-only outline slice 被放进 player-facing refs 时 compiler/validator 拒绝。
- unknown path / sectionId / stableId / runtimeDeltaId 被拒绝。
- canonical validator 仍能拒绝 compiler bug。

### Phase 2 - Runtime Update Proposal Draft/Compiler

优先级：高。

目标：让 LLM 输出轻量 `RuntimeUpdateProposalDraft`，本地 compiler 生成完整 `RuntimeUpdateProposalResult`。

建议 draft 输出聚焦：

- 本轮哪些 wiki 文件需要 proposal。
- 每个 proposal 的 `targetPath`、`strategy`、`reason`、`content`。
- 引用哪些 `runtimeDeltaIds` / source refs。
- 语义层面的 happened status、confidence、risk notes。
- 哪些 delta 跳过，以及跳过原因。

本地 compiler 负责：

- 生成 proposal IDs / group IDs。
- 从 `turnRecord`、`worldTickResult`、`visibleSelection`、`outlineAwareNarrationBrief` 和 `recalledMaterials` 编译完整 `sourceDeltas`。
- 补 `lineTarget`、`visibility`、`knowledgeScope`、`knowledgeClaims`、`revealGateRefs`、`validationHints`。
- 按 target path 派生或校验 write policy。
- 强制 `wiki/outlines/main.md` 普通写回禁区。
- 强制 events confirmed-only、player known boundary、NPC holder boundary、relationship information gap boundary。
- 最后调用现有 `validateRuntimeUpdateProposalResult()` 和 deterministic pending-stage validation。

测试：

- 低信息 draft 能生成空 proposal arrays，而不是空输出 no-op。
- PC knowledge、NPC knowledge、relationship gap、plot-arc reveal progress 的边界继续被拒绝不安全写回。
- 模型不能通过 draft 直接伪造完整 `sourceDeltas` 来绕过本地 compiler。

### Phase 1/2 Implementation Result - 2026-06-14

Phase 1 与 Phase 2 已按本计划落地。实现保持 canonical handoff 类型不变，LLM raw output 路径改为 draft contract，本地 compiler 只从合法 draft 和本阶段输入确定性派生 canonical output，最终仍通过既有 strict validators。

#### Phase 1 completed

- 新增 `src/lib/rpg-interactions/runtime/outline-brief-draft-compiler.ts`，定义 `OutlineBriefDraft`、draft parser/validator 与 `compileOutlineBriefDraftOutput()`。
- `outline-brief-interaction.ts` 的 prompt contract 已改为 `Outline Brief Draft Generator + Outline Impact Detector`，不再要求模型手写完整 `OutlineBriefCompilerOutput` 或完整 `OutlineBriefReference`。
- compiler 负责补 `sourceWorkingStateId`、完整 `OutlineBriefReference` envelope、`outlineImpactReport.reportId`、固定 `parallelLineBrief.grantsPcKnowledge: false` 边界，以及 major rewrite 且 requires regeneration 时才生成的 `regenerationRequest`。
- draft validation 会拒绝 canonical-only 字段和未知 refs；GM-only、hidden、delayed reveal、parallelLine-only refs 不得进入 player-facing PC knowledge。
- `turn-orchestrator` trace 已记录 raw draft、parsed draft summary、compiled canonical summary 与 canonical validation result。

#### Phase 2 completed

- 新增 `src/lib/rpg-interactions/runtime/runtime-update-draft-compiler.ts`，定义 `RuntimeUpdateProposalDraft`、draft parser/validator 与 canonical compile path。
- `runtime-update-interaction.ts` 的 prompt contract 已改为 `Runtime Update Proposal Draft`，不再要求模型手写 `sourceDeltas`、actor knowledge envelope、reveal gates 或 validation hints。
- compiler 负责生成 proposal/group/skip IDs，并从 `turnRecord`、`postActionWorkingState`、`actionResolution`、`worldTickResult`、`visibleSelection`、`outlineAwareNarrationBrief`、`recalledMaterials` 和 `turnNarration` 派生 canonical `sourceDeltas`、visibility、knowledge metadata、reveal gates 与 validation hints。
- draft validation 会拒绝模型伪造 canonical `sourceDeltas`、`visibility`、`knowledgeScope`、`knowledgeClaims`、`revealGateRefs`、`validationHints`、`proposalGroups` 等字段。
- `runtime-controller` trace 已记录 raw draft、parsed draft summary、compiled `RuntimeUpdateProposalResult` summary、canonical validation 与 `validateRpgRuntimeUpdateProposals()` 结果。
- `runtime-update-apply` 保持 pending import / staging 的 canonical proposal parser，不把已验收 proposal JSON 混入 LLM draft parser。

#### Validation result

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-import/runtime-update-apply.test.ts --exclude='**/*.real-llm.test.ts'` passed: 7 files, 140 tests.
- `npm.cmd run test:mocks` passed: 138 files, 1738 tests.
- `npm test -- ...` was not used for final validation because this PowerShell environment blocks `npm.ps1`; `npm.cmd` is the working command form.

#### Remaining risks / follow-up

- 真实 runtime trace 还需要用 Phase 1/2 新协议再跑一轮，确认 outline/update 阶段不再因机械 envelope 缺字段失败。
- Outline Brief compiler 与 validator 仍有少量引用可见性/知识边界判断重复，后续可按 Phase 6 抽取共享 helper。
- Runtime Update compiler 的 source delta 派生仍应在更多真实局面下扩展 fixture，尤其是 relationship information gap、NPC holder 与 reveal progress 的组合场景。
- 本次没有新增 legacy/default 兼容、旧路径保留、fallback、repair sanitizer、validator 放宽或 broken-JSON 修复路径。

### Phase 3 - Narration Generator Reference/Meta Compiler

优先级：中。

目标：保留 narration prose 由 LLM 输出，但把部分机械 metadata 改为本地编译。

适合本地化的字段：

- `narrationMeta` 中的 source refs、knowledge boundary audit、provisional patch usage。
- `playerKnowledgeBoundary.allowedKnowledgeRefs` 的完整引用 envelope。
- `tensionBrief` 的固定非事实边界布尔值。
- `nextActionOptions` 的 ID 生成和 source refs。

不适合本地化的字段：

- 玩家可读叙事正文。
- 语气、节奏、对话、描写细节。

建议做法：

- 第一版不强行把整个 `NarrationGeneratorOutput` 改为 draft。
- 先增加 `NarrationMetadataDraft` 或 `NarrationReferenceDraft`，只减少引用和 meta 字段的模型负担。

验收：

- narration prose 行为不变。
- 引用 envelope 不再要求模型重复手写。
- player-facing prose 仍不能包含 GM-only / hidden truth。

### Phase 4 - Story Outline Regenerator Draft/Compiler

优先级：中低，且只在 Phase 1 稳定后进行。

原因：

- Story Outline Regenerator 低频触发，只在 major rewrite 时运行。
- 它的安全边界很强，很多 fixed booleans 和 review boundary 字段适合本地补齐。
- 但它涉及 outline revision proposal，误编译风险较高。

建议：

- 让 LLM 输出语义层面的 provisional patch draft：
  - affected stable ids
  - suspended / invalidated beats
  - preserved facts
  - revised future beats
  - revised reveal order
  - branch adjustments
  - next scene direction
- 本地 compiler 补：
  - patch/proposal IDs
  - nonPersistenceBoundary
  - reviewBoundary
  - safety report fixed booleans
  - visibility boundaries
  - runtime refs
- 最后调用 `validateStoryOutlineRegeneratorOutput()`。

验收：

- 非 major rewrite 输入仍不能接受 regenerator output。
- 不能写完整 outline 文本。
- 不能生成 ordinary runtime update proposal。
- 不能自动写 `wiki/outlines/main.md`。

### Phase 5 - Action Resolver Partial Draft Review

优先级：中低。

Action Resolver 也有 ID、refs、warnings 等可本地补齐字段，但它的核心 output 大多是语义裁定：

- parsed intent
- event draft
- feasibility
- costs
- obstacles
- direct results
- time delta
- progress potential
- player action delta

这些字段不像 World Tick / Outline Brief reference envelope 那样明显机械。因此不建议立即大改。

可选后续：

- 只把 `resolutionId`、`eventId`、`costId`、`obstacleId`、`resultId`、`deltaId` 这类 ID 改为本地生成。
- references 可以由模型输出轻量 refs，本地补 usePurpose / visibility / knowledge scope。
- 保留 `validateActionResolution()` 严格验收。

验收：

- 不降低行动裁定的可解释性。
- 不把 attempted_not_confirmed 静默改成 confirmed_happened。

### Phase 6 - Shared Compiler Utilities

目标：避免每个阶段重复实现引用编译和 visibility 派生。

建议新增共享小工具，而不是新增中心化 runtime compiler：

- `compileKnownOutlineBriefReference()`
- `compileKnownNarrationSourceRef()`
- `compileRuntimeUpdateSourceDeltaFromRuntimeRef()`
- `resolveKnownReferenceKey()`
- `deriveReferenceVisibility()`
- `assertPlayerFacingReferenceAllowed()`
- `assertNoUnknownDraftReference()`

边界：

- 这些 helper 只处理小型 protocol envelope。
- 不读取文件。
- 不聚合全局上下文。
- 不形成新的 `CompactStoryBrief` 或中心化 context compiler。

## 需要保留的严格失败

Draft/compiler 不应修复这些错误：

- LLM 输出不是 JSON。
- draft 关键语义字段缺失，例如 summary、reason、targetPath、content。
- 引用了 input 中不存在的 path / sectionId / stableId / runtimeDeltaId。
- 把 GM-only / hidden / delayed reveal 放进 player-facing knowledge。
- 把 possible_future / outline beat 写成 confirmed event。
- 把 NPC-only / GM-only knowledge 写进 `wiki/player/known_information.md`。
- 试图输出 wildcard/glob/category path。
- 试图直接写 `wiki/outlines/main.md` 普通 update。

## 调试 Trace 要求

每个 draft/compiler 阶段应在 debug trace 中展示：

- raw draft output
- parsed draft output
- compiler input summary
- compiled canonical output summary
- canonical validation success / failure
- compiler warnings

失败信息应区分：

- parse failure
- draft validation failure
- compiler failure
- canonical validation failure
- unsafe boundary rejection

## 推荐执行顺序

1. Phase 0：做一次 contract audit 和真实 trace baseline。
2. Phase 1：先改 Outline Brief，因为当前真实失败就在这里，且机械引用字段最多。
3. Phase 2：再改 Runtime Update Proposal，因为写回边界重、重复 metadata 多、风险高。
4. Phase 3：对 Narration Generator 做引用/meta 层瘦身，不急着改 prose output。
5. Phase 4：在 major rewrite 路径稳定后再改 Story Outline Regenerator。
6. Phase 5：最后评估 Action Resolver 是否只做局部 ID/reference compiler。
7. Phase 6 可穿插进行，但必须保持为小 helper，不变成新的中心化 context compiler。

## 完成定义

当以下条件满足时，本计划可视为完成：

- Outline Brief 与 Runtime Update Proposal 至少完成 draft/compiler 化。
- 所有 compiler 输出仍通过现有 strict canonical validators。
- Debug trace 能同时检查 draft 和 compiled output。
- prompt contract 不再要求模型手写可本地派生的大量 envelope 字段。
- 没有新增 legacy/default 兼容、fallback、repair sanitizer 或旧路径保留。
- 真实 runtime trace 中不再出现因缺少机械引用字段导致的 outline/update 阶段失败。

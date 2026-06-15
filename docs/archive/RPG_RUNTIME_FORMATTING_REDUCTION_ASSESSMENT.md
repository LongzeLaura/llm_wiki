# RPG Runtime Formatting Reduction Assessment

## 背景

2026-06-14 的真实 runtime debug trace 再次暴露 World Tick 阶段失败：LLM 返回的 `WorldTickDraft` 中 `affectedPaths` 是空数组，draft compiler 没有把它视为“未声明”，最终 canonical validator 要求非空数组并中断整回合。

这个问题不应只被看作单点字段 bug。它是当前 runtime 结构不稳定的一个缩影：项目为了让各阶段输出更可控，逐步给 Action Resolver、World Tick、Recall Selector、Outline Brief、Narration Generator、Runtime Update Proposal 等阶段增加了结构化协议、prompt contract、parser、compiler 和 validator。短期看，这提高了可审计性；长期看，它也带来了明显副作用。

## 当前症状

### 1. 协议本身消耗大量 token

近期 trace 显示，World Tick 已经从旧 contract 的约 67k prompt chars 降到约 32k prompt chars，但仍然很重。最大块并不是返回 JSON 的格式说明，而是阶段间结构化 handoff 被反复展开：

- `preActionRefs` 约 14k chars。
- 完整 `ActionResolution` 约 4.5k chars。
- `postActionRefs` 约 4.3k chars。
- `ongoingEvents`、`gapSignals`、`pacingState` 等继续以结构化块进入 prompt。

这说明问题不只是“输出 JSON schema 太长”，还包括“把内部 AST 式状态直接外泄给模型作为阶段输入”。

### 2. 校验成本和失败面过高

当前 runtime 多数 LLM 阶段都会在本阶段之后立刻 parse + validate；部分 draft/compiler 路径还会经历：

```text
raw LLM output
-> draft parse / draft validation
-> deterministic compiler
-> canonical validation
-> orchestrator 再次 canonical validation
```

这种结构非常利于工程调试，但也扩大了失败面。任何一个非关键机械字段，例如 ID、空数组、引用 envelope、visibility 元数据，都可能阻断整回合。

### 3. LLM 被迫充当严格协议实现者

LLM 擅长语义判断、叙事组织、模糊信息整合和风险解释；它不擅长稳定地产生大量精确协议 envelope。让模型手写完整 canonical object，本质上是在把它当成接口实现器使用。

项目已经通过 `Draft -> local compiler -> strict canonical validator` 缓解了这个问题，但目前严格 canonical 仍然分布在过多非写回阶段，导致协议只是后移，并没有真正从中间语义流程里消失。

## 格式化协议分层

当前 runtime 的格式化需求应拆成三类。

### A. 必要安全协议

这类必须严格，尤其集中在 wiki 写回边界：

- `events` 只能写 confirmed happened。
- PC knowledge 不能混入 GM-only / NPC-only / user-only 材料。
- runtime 不能写 stable/base/control/source 路径。
- future、outline beat、未选选项、possible future 不能写成事实。
- actor knowledge、reveal gate、relationship information gap 需要明确边界。

这些协议应该保留 hard validator，并且应主要位于 `runtime_update_proposal -> pending validation -> apply/write policy`。

### B. 工程便利协议

这类不应由 LLM 手写，适合本地 deterministic compiler：

- `tickId`、`deltaId`、proposal/group/skip IDs。
- `runtimeDeltaRefs`。
- 完整 visibility envelope。
- `sourceDeltas`。
- reference metadata。
- `timeDeltaBasis`。
- 默认空数组。
- 可从 input 推导的 `affectedPaths`。

这类字段缺失或空数组，在 draft 层应视为“未声明”，由 compiler 补齐，而不是作为模型失败处理。

### C. 中间语义协议

这类需要结构化，但不一定需要 canonical 级别严格：

- Action Resolver 的意图、风险、代价、障碍、直接结果、时间消耗。
- World Tick 的世界响应、NPC/环境反应、节奏推进、gap signal。
- Outline Brief 的叙事聚焦、可用知识、节奏指令、大纲影响判断。
- Narration 的玩家可见正文、可选幕后镜头、下一步行动选项。

这些阶段的目标是产生可供下一阶段使用的语义材料，而不是写入 wiki。它们应使用 soft semantic contract：JSON 可解析、关键语义字段存在、安全边界不越界即可；机械字段不应成为 hard fail。

## 阶段评估

### Action Resolver

仍需要结构化，因为后续依赖行动裁定、时间、风险和玩家行动 delta。但完整 canonical 输出偏重。

建议：

- 保留语义结构。
- 将 `resolutionId`、`eventId`、cost/obstacle/result/delta IDs 本地生成。
- references / runtime refs 可改为轻量引用，由本地补 envelope。
- 不把 `attempted_not_confirmed` 静默改成 `confirmed_happened`。

### World Tick

当前仍偏重。World Tick 是非写回阶段，本质是“世界响应语义草稿”，不应该暴露太多 canonical delta 协议。

建议：

- 继续收窄 `WorldTickDraft`，只保留 summary、line、visibility preset、happened status、业务反应等语义字段。
- `affectedPaths`、runtime refs、完整 visibility、source ids、time basis 全部由 compiler 处理。
- draft 中字段缺失、空数组或空字符串若属于可派生字段，应视为未声明。
- 只有非 JSON、关键 summary 缺失、安全边界越界、非法 enum 等才 hard fail。

### Recall Selector

当前 allowlist + deterministic reader 模式比较健康。

建议：

- 保持模型只选 path / section / readMode / priority。
- 继续由本地 reader 读取正文并执行 path / section / budget policy。
- 不需要进一步 canonical 化。

### Outline Brief

draft/compiler 方向正确，但输入与 handoff 仍可能过重。

建议：

- LLM 只判断叙事聚焦、可用引用、节奏、campaign delta、outline impact。
- reference envelope、visibility、knowledge claims、report IDs 继续本地化。
- player-facing refs 的 GM-only / hidden / delayed reveal 拒绝应保留 hard fail。
- 减少把完整 `worldTickResult`、`postActionWorkingState`、`knownReferences` 大对象原样塞入 prompt，改为语义摘要和 allowlist。

### Story Outline Regenerator

低频且安全边界强。适合局部 draft/compiler，但不应优先。

建议：

- 只在 major rewrite path 运行。
- LLM 输出语义修订草稿。
- patch/proposal IDs、non-persistence boundary、review boundary、安全布尔值由本地补。
- 继续禁止自动写 `wiki/outlines/main.md`。

### Narration Generator

过度结构化风险最高。它的核心价值是玩家可见叙事和下一步选项，而不是 metadata。

建议：

- 优先保护 prose 生成质量。
- `narrationMeta`、source refs、knowledge boundary audit、provisional patch usage 可本地生成或弱校验。
- player-facing prose 泄漏 GM-only / hidden truth 应 hard fail；普通 meta 缺字段不应毁掉可用叙事。

### Runtime Update Proposal

这是最适合严格协议的阶段，因为它连接 wiki 写回。

建议：

- 保留 strict validator、target policy、actor knowledge boundary、reveal gate boundary 和 pending-stage validation。
- 这里才是 hard persistence contract 的核心。
- LLM 仍只输出轻量写回意图；sourceDeltas、visibility、knowledge metadata、validation hints 继续由 compiler 派生。

## 建议的新运行时协议策略

### 1. 分离 Soft Semantic Contract 与 Hard Persistence Contract

非写回阶段使用 soft semantic contract：

- 必须可解析。
- 必须包含关键语义字段。
- 不得包含 forbidden output，如 wiki write、outline overwrite、player-facing 泄漏等。
- 可派生字段缺失或空值由 compiler 处理。
- 非关键 meta 问题进入 warnings。

写回阶段使用 hard persistence contract：

- targetPath / strategy / content / happenedStatus 必须合法。
- knowledge、visibility、reveal、actor holder、write policy 必须严格。
- 不安全 proposal 必须跳过、拒绝或进入 review，而不是吞掉。

### 2. 阶段间传递语义 handoff packet

不要把完整 canonical object 原样塞进下一阶段 prompt。应为每个阶段生成面向 LLM 的短 handoff packet，例如：

- 本轮行动做了什么。
- 已确认发生什么。
- PC 当前可见/可推断什么。
- 用户可见但 PC 未知的幕后信号是什么。
- 还有哪些压力、风险、未解决问题。
- 哪些 wiki paths 是候选上下文。

完整 canonical object 可以保存在 turn record / debug trace /本地 controller 中，但不应默认进入下一个 LLM prompt。

### 3. 将可派生字段声明为 draft optional-by-design

对以下字段建立统一规则：draft 中缺失、空数组、空字符串都表示“模型未声明”，compiler 使用本地默认或输入推导：

- IDs。
- affected paths。
- source ids。
- runtime refs。
- visibility envelope。
- reference metadata。
- default arrays。

这不是 fallback，也不是 repair；这是 draft contract 的正常语义。

### 4. Trace 继续保留，但要增加体积画像

debug trace 应继续记录 raw draft、parsed draft、compiled canonical 和 validation result。但还应自动记录：

- 每个 step 的 prompt chars / input chars / raw output chars / validation chars。
- top prompt sections。
- top input assembly contributors。
- 本轮 hard fail 属于 parse、draft validation、compiler、canonical validation、write safety 哪一类。

这样后续不只知道“哪里错”，也能知道“哪里重”。

## 保留 hard fail 的边界

减少非必要格式化不等于放松安全边界。以下错误仍应 hard fail 或进入严格拒绝：

- 输出不是 JSON，且该阶段明确要求 JSON。
- 缺少关键语义字段，例如 action summary、world delta summary、targetPath、content。
- 引用 input 中不存在的 path / section / stable id / runtime delta。
- GM-only / hidden / delayed reveal 进入 PC-facing knowledge。
- future / possible future / next action option 写成 confirmed event。
- NPC-only / GM-only knowledge 写入 `wiki/player/known_information.md`。
- wildcard / glob / category path 作为写回 target。
- 普通 runtime update 试图写 `wiki/outlines/main.md` 或 stable/base/control/source 路径。

## 推荐后续阶段

下面的阶段不是简单 bugfix 队列，而是把前文的“新运行时协议策略”和“格式化协议分层”落到工程边界的路线。当前还没有能跑完整流程的真实 trace，因此第一步不能假设已经有完整样本；它应先审计 failure frontier，再用 mock/full-fixture trace 补足结构体积画像。

### Phase A - Failure-Frontier Formatting Audit

目标：先回答“流程死在哪里，死前已经付出了多少格式化成本”，而不是等待一个完整成功 trace。

范围：

- 对现有失败 trace 统计已执行阶段的 prompt / input assembly / raw output / parsed output / validation chars。
- 记录每个已执行阶段的 top prompt sections 与 top input assembly contributors。
- 对 pending 阶段明确标记为 `blocked_by_previous_failure` / `unknown_real_model_cost`，不得伪造真实数据。
- 用 mock adapter 或 fixture adapter 跑一条结构完整的 full-flow trace，只用于测量本地 prompt assembly 和 handoff 展开体积；该结果必须标注为 synthetic，不得当作真实模型表现。
- 为每个阶段记录 failure frontier：parse failure、draft validation failure、compiler failure、canonical validation failure、write safety failure、provider/transport failure。

产物：

- 一份 `runtime_formatting_audit` 表，按 step 记录真实已执行数据、synthetic 结构数据、blocked/unknown 状态和 top contributors。
- 一个后续瘦身优先级排序：先处理真实 failure frontier，再处理 synthetic trace 中确认的结构性大块。

### Phase B - Runtime Contract Classification Matrix

目标：把“必要安全协议 / 工程便利协议 / 中间语义协议”变成可执行的阶段矩阵，而不是停留在原则层。

范围：

- 为每个 runtime LLM 阶段列出字段分类：
  - `semantic_required`：LLM 必须决定，缺失应 hard fail。
  - `semantic_optional`：LLM 可给，缺失可继续。
  - `derivable_protocol`：由本地 compiler 补齐，LLM 缺失或空值不算错。
  - `dangerous_forbidden`：LLM 输出即拒绝。
  - `persistence_hard_boundary`：只有写回阶段才需要严格验证。
- 明确哪些字段在 draft 层采用 optional-by-design 规则：缺失、空数组、空字符串都表示“未声明”，由 compiler 使用本地输入推导。
- 明确哪些字段不允许 optional-by-design：例如 summary、targetPath、content、关键 happened status、写回安全边界。

产物：

- 每个阶段一张 contract matrix。
- 一组统一命名的错误类别：`missing_semantic_field`、`unsafe_knowledge_boundary`、`unknown_reference`、`derivable_protocol_omitted`、`forbidden_persistence_claim` 等。

### Phase C - Soft/Hard Validation Boundary Design

目标：把 validator 从“所有阶段都像写库一样严格”改成分层验证。

范围：

- 定义 soft semantic validation：
  - 用于 Action Resolver、World Tick、Outline Brief、Narration 等非写回阶段。
  - 检查 JSON 可解析、关键语义字段存在、核心 enum 合法、没有 forbidden output、没有知识泄漏。
  - 对可派生协议字段缺失或空值给 compiler，不直接 hard fail。
- 定义 hard persistence validation：
  - 用于 Runtime Update Proposal、pending validation、apply/write policy。
  - 检查 target path、write strategy、knowledge claims、actor holders、reveal gates、events confirmed-only、stable/control/source 禁写等。
- 定义 canonical object 的用途：
  - turn record / debug trace /本地 controller 内部审计可以保留完整 canonical。
  - 下一个 LLM prompt 默认不消费完整 canonical，而消费 compact semantic handoff。

产物：

- 一份 validation boundary design：哪些阶段使用 soft validation，哪些阶段使用 hard validation，哪些错误会中断回合，哪些错误只进入 warnings/review。

### Phase D - World Tick Contract Containment

目标：先处理当前真实 failure frontier，同时验证新的分层策略能否减少 World Tick 的中间协议脆弱性。

范围：

- 将 `affectedPaths`、runtime refs、source ids、完整 visibility envelope、time basis 等 WorldTickDraft 字段正式归类为 `derivable_protocol`。
- 在 draft compiler 中把这些字段的缺失、空数组、空字符串统一解释为“未声明”。
- 收窄 World Tick prompt：LLM 只输出本轮世界响应、delta summary、line target、visibility preset、happened status、reaction/broadcast/clock 语义。
- 减少下游对完整 `WorldTickResult` 的 prompt 依赖，改为生成 World Tick semantic handoff summary。
- 保留 hard fail：非 JSON、缺 summary、非法 enum、把 hidden/GM-only 授予 PC、输出 wiki write 或 next action options。

产物：

- 一个更窄的 `WorldTickDraft` contract。
- 一个 `WorldTickSemanticHandoff` 或等价摘要结构。
- 用失败 trace 回放确认当前 `affectedPaths: []` 类型问题不再阻断非写回阶段。

### Phase E - Compact Semantic Handoff Layer

目标：兑现“减少阶段间完整 canonical object 进入 prompt”的核心承诺。

范围：

- 为每个阶段生成面向下游 LLM 的短 handoff packet：
  - player action summary。
  - confirmed / attempted / blocked / possible future 的分离摘要。
  - PC-visible / PC-inferred / user-visible-PC-unknown / GM-only 的摘要边界。
  - active risks、pressure、open questions、candidate paths。
  - 不超过预算的 references allowlist。
- 保留完整 canonical object 在 turn record / trace 中，但 prompt 默认只拿 handoff packet。
- 为 handoff packet 设置 section budget 与 top contributor trace。

产物：

- 一组 `*SemanticHandoff` builder。
- Prompt assembly 中减少完整 `ActionResolution`、`WorldTickResult`、`PostActionWorkingState` 的直接展开。

### Phase F - Stage-Specific Compiler Slimming

目标：逐步把可派生协议字段从 LLM 输出责任中移出。

优先级：

1. Action Resolver 局部 compiler：
   - 本地生成 IDs。
   - references / runtime refs 改为轻量 draft。
   - 保留行动裁定语义结构。
2. Narration metadata/reference compiler：
   - 保护 `playerFacingText` 的 prose 质量。
   - 本地生成 narration meta、source refs、knowledge audit、action option ids/sourceRefs。
   - prose 泄漏安全边界仍 hard fail，普通 meta 缺失不应毁掉可用叙事。
3. Outline Brief 输入瘦身：
   - 在已完成 draft/compiler 的基础上，减少完整 known refs / outline slices / working state 展开。
   - 只给模型可选引用和必要边界摘要。
4. Story Outline Regenerator 后置：
   - 低频路径，只在 major rewrite 稳定后再做。

产物：

- 每个阶段只承担真正需要 LLM 决策的语义字段。
- compiler 负责 IDs、envelope、refs、default arrays 和本地可推导字段。

### Phase G - Persistence Boundary Consolidation

目标：把 hard validator 的重点收敛到真正改变 wiki 的边界。

范围：

- Runtime Update Proposal 继续使用 hard persistence contract。
- pending validation / apply / write policy 成为最终安全门。
- 非写回阶段产生的 warnings、unsafe signals、unknown refs 可以进入 turn audit 或 review signal，但不自动写 wiki。
- 明确禁止把 soft semantic output 直接提升为 accepted wiki fact。

产物：

- 写回边界成为唯一必须 canonical-complete 的产品路径。
- 非写回阶段减少因机械字段失败而中断整回合的概率。

## 总结

当前项目的问题不是“不该结构化”，而是“结构化过头，并且把写回级别的严格性扩散到了太多中间语义阶段”。

更稳的方向是：

```text
LLM 做语义决策
-> 本地 compiler 做协议补齐
-> 中间阶段使用 soft semantic validation
-> 写回边界使用 hard persistence validation
-> turn record/debug trace 保存完整 canonical 审计材料
```

严格性应该集中在真正会改变 wiki 状态的地方。非写回阶段应追求语义稳定、边界清晰和可恢复，而不是让每一个机械字段都成为中断整回合的理由。

# RPG Runtime-Oriented Ingest Plan

## 目标

llmWikiRPG 的 ingest 不应把网络资料、原作设定、剧情梗概、人物台词整理成普通百科，而应把它们编译成可用于 RPG 运行时的知识。

最终导入结果应该服务以下能力：

- 辅助 NPC 扮演，保持角色说话、行动、反应和边界稳定。
- 辅助玩家行动，让场景里有可调查、可交涉、可移动、可使用、可冒险的对象。
- 辅助剧情推进，保留冲突、伏笔、压力、误解、秘密和后续推进条件。
- 辅助状态更新，区分稳定设定、已发生事件、当前状态、未来可能性和推导内容。
- 辅助沉浸感，保留风格、感官锚点、场景氛围和对白质感。

核心原则：

> ingest 不应问：这段资料里有什么设定值得保存？
>
> ingest 应该问：这段资料里有什么能让下一回合更好玩、更沉浸、更一致、更有张力？

## 当前问题

当前 ingest 的主要问题不是目录不够多，也不是模型总结能力不够，而是目标函数仍然偏向百科整理。

主要症状：

- 生成的 wiki 条目太长，运行时检索后会把大量低价值信息塞进上下文。
- 来源文本很大，但真正能服务 roleplay 的信息很少。
- 网络资料常包含大量版本信息、剧情复述、粉丝标签、背景介绍、台词堆叠和百科 trivia。
- characters 已经向角色操作模型靠拢，但仍可能过于冗杂。
- world、locations、factions、items、events、plot-arcs、relationships 仍容易生成普通 wiki 式摘要。
- 角色关系、剧情张力、可行动场景钩子和风格规则没有被稳定抽成运行时优先信息。

因此，后续 ingest 改造应从生成更完整页面，转向筛出更高价值的 RPG 运行信号。

## 总体方案

未来 ingest 应改成三层：

| 层 | 作用 | 输出 |
|---|---|---|
| 来源证据层 | 记录资料来源、摘要、可信度、冲突和证据边界 | wiki/sources/ |
| RP 信号层 | 从大文本中筛出能影响扮演、行动、张力、状态和文风的高价值信号 | 中间结构或 review |
| 运行条目层 | 生成短、准、可用于回合上下文的 RPG 页面 | characters、locations、relationships 等 |

不要把来源材料直接压缩成目标页面。应先把来源材料压缩成 RP 信号，再由高价值信号生成目标页面。

## RP 信号筛选

Stage 1 分析不应只输出候选对象和目录，还应输出 roleplay utility 信号。

建议中间结构：

```text
RpgIngestSignal
- kind: portrayal_rule | dialogue_style | behavior_boundary | scene_affordance | relationship_tension | plot_pressure | world_constraint | action_hook | state_change | style_rule | noise
- targetPath: optional target wiki path
- summary: short signal summary
- rpUse: why this helps roleplay or runtime generation
- evidence: source-backed evidence summary
- utilityScore: 0 to 5
- confidence: high | medium | low
- canonStatus: canon | inferred_for_play | uncertain
```

评分建议：

| 分数 | 含义 | 处理 |
|---|---|---|
| 0 | 噪声，和 RPG 运行无关 | 丢弃 |
| 1 | 仅有出处价值 | 只进入 sources |
| 2 | 弱信号或不确定信号 | 进入证据、待确认或 review |
| 3 | 可用页面内容 | 可进入目标页正文 |
| 4 | 强运行时信号 | 应进入 Runtime Capsule |
| 5 | 关键硬约束或高价值扮演规则 | 高优先级进入 capsule、rules、style 或角色操作规则 |

筛选问题：

- 这条信息会改变 NPC 怎么说话、怎么行动、怎么防御、怎么升级冲突吗？
- 这条信息会限制玩家能做什么、不能做什么、做了会有什么代价吗？
- 这条信息能变成场景钩子、线索、危险、资源、可交互物或行动入口吗？
- 这条信息会影响信任、依赖、误解、竞争、恐惧、愧疚、吸引或控制吗？
- 这条信息能防止模型写崩原作设定、关系节奏或角色边界吗？
- 这条信息是否只是发售版本、百科介绍、粉丝标签、声优信息、路线流水或 trivia？

只有高价值信号才应进入运行条目层。

## Runtime Capsule

所有非 sources 的 RPG 页面都应逐步引入 Runtime Capsule，并放在页面靠前位置。

推荐结构：

```md
## Runtime Capsule

- 一句话定位：
- 对玩家行动的意义：
- 关键约束：
- 可触发钩子 / 压力点：
- 扮演 / 氛围提示：
- 不要误写成：
```

运行时上下文编译器应优先读取 Runtime Capsule，只有在强相关且预算足够时才读取完整页面。

这样即使页面因为证据和人工整理变长，运行时也不会默认读取整页。

## 目录目标重写

每个目录都要从百科条目改成运行时组件。

| 目录 | 避免 | 应该抽取 |
|---|---|---|
| world | 大段世界观百科 | 行动限制、社会规则、常识、禁忌、风险、氛围 |
| locations | 地点介绍 | 场景卡：感官锚点、入口、危险、线索、可交互物、常见在场角色 |
| factions | 组织百科 | 势力压力源：目标、资源、反应阈值、杠杆、玩家触发后果 |
| items | 道具设定罗列 | 用法、代价、限制、持有者、风险、线索价值、剧情功能 |
| events | 原作路线复述 | 已确认发生的事件、造成的状态变化、谁知道、留下什么后果 |
| plot-arcs | 原作剧情总览 | 未解决问题、冲突压力、揭示节奏、推进条件、不能提前解决的内容 |
| relationships | 人物关系介绍 | 信任、张力、依赖、误解、秘密、升级/降级触发器 |
| characters | 人物传记 | NPC 操作模型：欲望、恐惧、触发点、行为边界、对白规则、RP 用法 |
| style | 原文摘录 | 可执行文风规则、对白节奏、禁用写法、叙事基调 |
| rules | 世界解释散文 | 硬规则、代价、成功/失败边界、平衡约束 |

## 角色页继续压缩

characters 虽已优化，但仍要避免变成长篇人物百科。

角色页应优先保留：

- 如何第一眼读出这个角色。
- 角色在剧情中的功能和压迫感。
- 角色如何判断风险。
- 角色如何隐藏脆弱。
- 角色在被逼问、被帮助、被背叛、被挑衅时如何反应。
- 角色不会做什么，哪些边界不能随便跨越。
- 角色说话的节奏、称呼、回避方式、情绪变化和禁用写法。
- 玩家什么行动会增加信任、降低信任、触发防御或推进关系。

推荐结构：

```md
## Runtime Capsule
- 第一印象：
- 默认立场：
- 当前可用于互动的核心张力：
- 不可违背的行为边界：
- 玩家最可能触发的反应：

## Canon Facts
- 只保留会影响扮演的一线事实。

## Psychological Model
- 如何判断风险：
- 如何隐藏脆弱：
- 如何自我防御：
- 为什么接受或拒绝帮助：

## Behavior Rules
- 如果玩家示弱，通常会：
- 如果玩家逼问秘密，通常会：
- 如果局势失控，优先会：

## Dialogue Style
- 句子节奏：
- 礼貌等级：
- 回避方式：
- 典型短句：
- 禁止写法：

## Relationship Levers
- 增加信任的行为：
- 降低信任的行为：
- 触发防御的行为：
- 需要铺垫后才能发生的变化：

## Evidence and Uncertainty
- 直接证据：
- 合理推断：
- 路线差异：
```

对白语料不要大段复制。应抽成说话节奏、称呼习惯、回避话题、情绪变化和少量短示例。

## 页面长度预算

只靠 prompt 说简洁不够，需要明确预算。预算不是硬解析限制，而是质量目标。超过预算时应触发 review、压缩或 distill。

建议初始预算：

| 页面类型 | 建议正文长度 |
|---|---:|
| sources | 1000 到 2000 中文字，可因证据需要略长 |
| characters | 1800 到 3000 中文字 |
| relationships | 600 到 1200 中文字 |
| locations | 600 到 1200 中文字 |
| factions | 800 到 1500 中文字 |
| items | 500 到 1000 中文字 |
| events | 400 到 900 中文字 |
| plot-arcs | 800 到 1500 中文字 |
| Runtime Capsule | 300 到 800 中文字 |

目标不是让所有页面同样短，而是让 runtime-facing 内容短、准、可控。

## 长来源处理

长来源不应被 chunk 成普通摘要后直接生成页面。那会保留太多原始资料结构，导致百科式输出。

推荐流程：

```text
长来源
  -> 分块
  -> 每块抽取 RpgIngestSignal[]
  -> 全局去重
  -> 按目标对象合并等价信号
  -> 按 RPG utility 评分排序
  -> 只用高价值信号生成目标页面
  -> 低价值信号进入 sources 或 review
```

这一步的核心是显式承认 ingest 是有损编译。丢掉无用信息不是失败，而是为了运行时质量。

## Post-Ingest Distiller

已有长页面不必全部重新导入。可以增加一个后处理工具，将长页面压缩成 runtime-facing 页面。

推荐流程：

```text
现有 wiki 页面
  -> 判断页面类型
  -> 提取 roleplay-useful signals
  -> 生成或更新 Runtime Capsule
  -> 压缩低价值百科段落
  -> 保留来源、证据和不确定性
  -> 作为 review proposal 暂存
```

Distiller 默认应进入 review，不应静默覆盖用户手工整理的页面。

## 关系与张力推导边界

关系与张力不应完全塞进普通 ingest。普通 ingest 负责 source-supported 的稳定材料，导入后再由独立 deriver 推导隐式关系和剧情张力。

Deriver 应从 characters、events、plot-arcs、dialogue signals 和 source notes 中推导：

- 信任、依赖、吸引、竞争、恐惧、愧疚、控制、义务。
- 未说出口的信息、误解、秘密和信息不对称。
- 哪些关系变化需要铺垫，不能突然发生。
- 玩家哪些行动会压迫、修复或解锁关系。
- 哪些冲突不应过快解决。

推导内容必须显式标注为 inferred_for_play，默认进入 review，不应伪装成原作事实。

## Context Compiler 配合

即使 ingest 页面变好，如果 runtime 仍默认读取整页，长页面问题仍会回来。

Context Compiler 应优先读取：

1. current-scene/scene_state.md。
2. player 当前状态。
3. 相关 relationships 的 Runtime Capsule。
4. 相关 plot-arcs 的当前阶段、未解问题和压力点。
5. 相关角色的 Runtime Capsule、Behavior Rules、Dialogue Style、Relationship Levers。
6. 相关地点的可交互物、危险、线索和感官锚点。
7. 相关阵营、物品的限制和后果。
8. style、rules、memory 中的高优先级控制块。
9. 只有在强相关且预算足够时，才读取完整页面证据段。

Runtime Capsule 是 ingest 与 runtime 之间的关键契约。

## 质量 Lint

应增加 ingest 后质量检查，只产生 warning 和 review，不做破坏性自动重写。

建议检查：

- 页面超过目录长度预算。
- 非 sources 页面缺少 Runtime Capsule。
- 页面没有 action hook、roleplay constraint、state impact 或 tension signal。
- locations 页面像普通地点介绍，而不是场景卡。
- factions 页面缺少 agenda、pressure、resources 或 reaction threshold。
- items 页面缺少 use、cost、limits、holder 或 plot function。
- events 页面包含未来计划或路线级剧情复述。
- plot-arcs 页面把未来可能性写成已发生事实。
- relationships 页面重复完整角色设定。
- characters 页面包含长篇事件流水而不是角色操作模型。
- 页面含有发售版本、声优、粉丝标签、无 RP 用途 trivia 等低价值百科信息。

## 建议实施顺序

该计划可以作为一个独立的 ingest-quality track 小步实施。

建议顺序：

1. Runtime Capsule Prompt Contract v0：修改 RPG page guidance，让非 sources 页面包含 Runtime Capsule、软预算和 RP utility gate。
2. Directory Roleplay Contract v0：强化非角色目录的 roleplay-facing contract，重点是 actionability、hooks、constraints、tension。
3. Ingest Quality Lint v0：增加长度、缺 capsule、缺行动性、路线漂移、低价值百科信息等 warning/review。
4. Long Source Signal Extraction v0：引入 RpgIngestSignal 风格的长来源分块抽取和全局合并。
5. Post-Ingest Distiller v0：为已有长页面生成压缩提案，默认进入 review。
6. Context Capsule Retrieval v0：让 runtime 优先读取 Runtime Capsule 和角色操作段落，而不是整页。
7. Relationship/Tension Deriver v0：从角色、事件、剧情线和对白信号中生成可审阅的关系/张力推导。

## 验收标准

当以下行为成立时，ingest 质量改造才算达到目标：

- 导入大型来源后，不再默认生成普通百科式长页面。
- 大多数 runtime-facing 页面包含 Runtime Capsule。
- 页面超预算会触发 review 或压缩，而不是静默增长。
- characters 像 NPC 操作模型，而不是人物传记。
- locations 像可运行场景卡，而不是地点百科。
- factions 像势力压力源，而不是组织介绍。
- items 像可使用、有代价、有风险的剧情物件，而不是道具百科。
- events 只记录已发生事实和后果，不记录未来建议。
- plot-arcs 记录未解压力和未来约束，不伪造已发生事件。
- relationships 记录张力和变化触发器，不重复角色介绍。
- runtime 可以优先使用短 capsule 编译上下文，避免整页污染。

## 最终原则

不要因为信息存在于来源中就保存它。

只有当信息能让 RPG 运行更沉浸、更一致、更可行动、更有张力时，才应进入 runtime-facing wiki 页面。

其余内容应进入 sources、review，或被作为噪声丢弃。


## 具体计划

### 第一阶段 Codex 执行 Prompt

状态：已完成（2026-06-06）。

完成范围：
- 已修改 `src/lib/prompts/rpg-ingest.ts`，让 RPG Stage 1 输出来源运行时价值画像、候选对象 `runtime_utility` 评分、`canon_status`，以及自然语言 `RP Runtime Signals` 小节。
- 已修改 `src/lib/prompts/rpg-page-guidance.ts`，让非 source RPG 页面优先生成 `Runtime Capsule`，加入页面软预算和 Stage 1 utility gate，并将各目录 contract 改为运行时导向。
- 已更新 `src/lib/ingest.prompt.test.ts` 中与本阶段 prompt 文案相关的断言。
- 已更新 `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 记录本阶段完成状态。

已验证：
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts`
- `npx.cmd vitest run src/lib/rpg-smoke.test.ts src/lib/rpg-extraction-validation.test.ts`
- `npm.cmd run typecheck`

未做范围：
- 未实现长来源分块信号合并、post-ingest distiller、quality lint、context compiler retrieval、Relationship/Tension Deriver。
- 未修改 writer、parser、runtime controller、UI 或真实 LLM 调用路径。
- 未执行 `git commit` 或 `git push`。

以下为第一阶段原执行 prompt，作为历史记录保留。

### 后续阶段

第一阶段之后再做：

第二阶段：Ingest Quality Lint v0

状态：已完成（2026-06-06）。

完成范围：
- 已修改 `src/lib/rpg-extraction-validation.ts`，在现有 `validateRpgExtraction()` ingest lint / review 入口中加入 RPG runtime-oriented 检查。
- 已实现非 source runtime-facing RPG 页面 `## Runtime Capsule` 缺失检查，以及 Runtime Capsule 弱运行时价值检查。
- 已实现目录软预算和 Runtime Capsule 软预算 warning/review，不截断、不压缩、不改写用户页面。
- 已实现低价值百科噪声检查，覆盖发售/版本/平台、声优/配音、粉丝标签、trivia、生日、血型、身高、体重等无 RP 用途信息；`wiki/sources/` 和 evidence/source-like section 不作为 runtime-facing 噪声误报对象。
- 已强化动态语义 lint：`wiki/events/` 继续检查 route/timeline-like 页面，并新增未来计划、可能发展、伏笔、玩家选择建议、推进条件检查；`wiki/plot-arcs/` 新增未来可能性写成已发生事实检查；`wiki/current-scene/` 普通 ingest 禁写边界现在同时透出 warning 和 review item。
- 已加入 review item 去重，避免同一路径同一类问题重复进入 review surface。
- 已更新 `src/lib/rpg-extraction-validation.test.ts`，覆盖缺 capsule、weak capsule、超预算、百科噪声、events 未来材料、plot-arcs future-as-fact、current-scene warning 可见性、source 页面不误报。
- 已更新 `src/lib/rpg-smoke.test.ts` 的最小集成断言，确认 lint review item 会经由现有 ingest flow 进入 review store。
- 已更新 `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 记录本阶段完成状态。

已验证：
- `npx.cmd vitest run src/lib/rpg-extraction-validation.test.ts`
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/rpg-extraction-validation.test.ts`
- `npm.cmd run typecheck`

未做范围：
- 未实现 Long Source Signal Extraction。
- 未实现 Post-Ingest Distiller。
- 未实现 Context Capsule Retrieval。
- 未实现 Relationship/Tension Deriver。
- 未自动改写、压缩、accept/reject/apply 页面。
- 未阻塞 `wiki/sources/` 来源摘要写入。
- 未修改 writer 真实写入策略、runtime controller、UI 或真实 LLM 调用路径。
- 未执行 `git commit` 或 `git push`。

目标：
- 把第一阶段 prompt 约束里已经出现的 Runtime Capsule、长度预算、RP utility gate，变成导入后的可检查 warning/review。
- 只产出 review item 或 warning，不自动改写用户页面，不阻塞来源摘要写入。

建议改动：
- 在现有 ingest lint / review 机制中新增 RPG runtime-oriented 检查。
- 检测非 sources 页面是否缺少 `## Runtime Capsule`，或 capsule 只是百科摘要而没有行动钩子、约束、张力、状态影响、扮演规则、氛围提示之一。
- 检测页面是否明显超出目录软预算；超出时建议压缩到 Runtime Capsule + 关键证据，而不是静默接受长百科页。
- 检测低价值百科噪声：发售信息、声优信息、粉丝标签、trivia、路线流水、无 RP 用途设定。
- 检测动态语义错位：`events` 写入未来计划 / 可能性，`plot-arcs` 把未来可能写成已发生，ordinary ingest 试图写入 runtime-owned `current-scene`。

验收：
- 针对缺 capsule、超预算、events/plot-arcs 混淆、百科噪声分别有 fixture 或单元测试。
- lint 结果进入现有 review surface；不会自动覆盖已有页面。

第三阶段：Long Source Signal Extraction v0

状态：已完成（2026-06-06）。

完成范围：
- 已新增 `src/lib/rpg-ingest-signals.ts`，实现 `RpgIngestSignal` 类型、fenced `## RP Runtime Signals JSON` parser、normalizer、全局去重/合并、以及 `## Structured RP Runtime Signals` consolidated context 生成。
- 已修改 `src/lib/ingest.ts`，让长来源分块分析在保留现有 `Chunk Analysis` / `Updated Global Digest` 能力的同时，逐块抽取结构化 signals；checkpoint 升级为 v2 并保存 signals，旧 checkpoint 会安全忽略并重新分析。
- 已实现 utility 分流：3-5 分 signals 作为 Stage 2 非 source 页面核心材料，4-5 分标记为 `Runtime Capsule` 优先，2 分进入 REVIEW 或 `Evidence and Uncertainty`，0-1 分只保留为 source-only / ignored noise。
- 已修改 `src/lib/prompts/rpg-page-guidance.ts`，让 Stage 2 将 `## Structured RP Runtime Signals` 作为长来源页面生成 gate，禁止低分 signals 生成非 source 页面，并避免把长剧情/路线复述压成一篇 `wiki/events/` 长页。
- 已新增/更新测试：`src/lib/rpg-ingest-signals.test.ts` 和 `src/lib/ingest.prompt.test.ts`，覆盖 normalizer、去重/聚合、分流 context、长剧情梗概、metadata/trivia 高噪声、chunk prompt、Stage 2 structured-signal gating。

已验证：
- `npx.cmd vitest run src/lib/rpg-ingest-signals.test.ts`
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts`
- `npx.cmd vitest run src/lib/rpg-extraction-validation.test.ts src/lib/rpg-smoke.test.ts`
- `npm.cmd run typecheck`

未做范围：
- 未实现 Post-Ingest Distiller。
- 未实现 Context Capsule Retrieval。
- 未实现 Relationship/Tension Deriver。
- 未自动 accept/reject/apply review。
- 未真实 LLM 长来源端到端验证。
- 未执行 `git commit` 或 `git push`。

目标：
- 将第一阶段 prompt 中的 `RP Runtime Signals` 从自然语言小节升级为代码可识别的中间结构，解决长来源被一次性总结成百科长页的问题。
- 让长来源按块抽取、去重、合并，再按 utility 生成目标页面。

建议改动：
- 新增或扩展 `RpgIngestSignal` 类型，字段至少包括 `kind`、`targetPath`、`summary`、`rpUse`、`evidence`、`utilityScore`、`confidence`、`canonStatus`。
- 长来源处理流程改为：分块 -> 每块抽取 signals -> 全局去重 -> 按 target/object 聚合 -> 只把 3-5 分信号交给 Stage 2 生成页面。
- `runtime_utility` 0-1 的信号默认只进入 sources / ignored noise；2 分进入 REVIEW 或 Evidence and Uncertainty；4-5 分优先进入 Runtime Capsule。
- 保留第一阶段 prompt 字段作为模型输出提示，但后续由 parser/normalizer 对结构化信号做最小校验。

验收：
- 长剧情梗概不会默认生成一篇超长事件页，而是拆成 plot-arcs、离散 confirmed events 和 review。
- 大量 trivia / metadata 的来源可以被判定为 high noise，并只保留 source summary 或 review。

第四阶段：Post-Ingest Distiller v0

状态：已完成（2026-06-06）。

完成范围：
- 已新增 `src/lib/rpg-post-ingest-distiller.ts`，实现纯 TypeScript 内部服务 `distillRpgWikiPage()`、`distillRpgWikiPages()` 和 `createRpgDistillReviewItems()`。
- 已按 `wiki/<category>/...` 识别 `characters`、`locations`、`events`、`plot-arcs`、`relationships` 五类 runtime-facing 页面；`wiki/sources/` 作为证据层不做 runtime-facing distill，仅返回 skipped proposal 和 warning。
- distill proposal 已包含 `targetPath`、`category`、`originalLength`、`hasRuntimeCapsule`、`candidateRuntimeCapsule`、`roleplaySignals`、`keepSections`、`compressSections`、`moveToEvidenceSections`、`needsHumanConfirmation`、`proposalMarkdown`、`warnings`。
- proposal markdown 已明确列出建议保留、建议压缩、建议移动到 sources/evidence、需要人工确认、候选 `Runtime Capsule`、roleplay signals 和 warnings，并声明 REVIEW/proposal-only 安全边界。
- 已实现 v0 确定性启发式：保留角色扮演规则/对白/边界、地点 affordance/危险/线索/感官锚点、已发生事件后果、剧情压力/推进条件、关系信任/张力/秘密/触发器；标记长传记、路线/时间线复述、重复证据、低价值 metadata/trivia、events 未来计划/伏笔、plot-arcs future-as-fact 为压缩、证据迁移或人工确认。
- 已新增 `src/lib/rpg-post-ingest-distiller.test.ts`，覆盖 `characters`、`locations`、`events`、`plot-arcs`、`relationships` 五类样例输出、纯函数不写回原文件、以及 review/proposal 生成 affected page 和 Inspect/Dismiss 选项。

已验证：
- `npx.cmd vitest run src/lib/rpg-post-ingest-distiller.test.ts`
- `npx.cmd vitest run src/lib/rpg-ingest-signals.test.ts src/lib/rpg-extraction-validation.test.ts`
- `npm.cmd run typecheck`

未做范围：
- 未静默写回、覆盖、删除或压缩原 wiki 页面。
- 未写入 `.llm-wiki/review.json`。
- 未自动 accept/reject/apply review。
- 未实现 Context Capsule Retrieval。
- 未实现 Relationship/Tension Deriver。
- 未修改 runtime controller、UI、Tauri 命令或真实文件写入路径。
- 未删除 legacy `entities`、`concepts`、`sources` 功能。
- 未执行 `git commit` 或 `git push`。

目标：
- 对已经存在的长 RPG 页面提供 runtime-facing 压缩提案，而不是要求全部重新导入。
- 保护用户手工整理内容，默认只生成 REVIEW/proposal。

建议改动：
- 新增 distill 命令或内部服务，输入单个 wiki 页面或一组页面。
- 识别页面目录类型，抽取 roleplay-useful signals，生成/更新候选 `Runtime Capsule`。
- 标记可压缩段落：长传记、路线流水、重复证据、无运行时用途 metadata。
- proposal 中明确列出保留、压缩、移动到 sources/evidence、需要人工确认的内容。

验收：
- distiller 不静默写回原文件。
- 对 characters、locations、events、plot-arcs、relationships 至少各有一个样例输出。

第五阶段：Context Capsule Retrieval v0

状态：已完成（2026-06-06）。

完成范围：
- 已修改 `src/lib/rpg-runtime/context-compiler.ts`，让 `compileRpgContext()` 在非 `wiki/sources/` 页面进入 `CompactStoryBrief` 前先执行 section-aware runtime extraction。
- 已实现基础 `##` / `###` Markdown 分段读取，优先读取 `Runtime Capsule`，再按目录读取关键运行时段落；没有 runtime-facing 段落时才回退到现有 compact 整页逻辑。
- 已覆盖 characters、locations、relationships、plot-arcs、events、player、world/factions/items/quests/memory/style/rules 等目录的运行时段落优先级。
- 已保留 `wiki/sources/` reference-only 行为，sources 只进入 references，不进入 `hardFacts` 或 prompt 正文。
- 已保留 current-scene 和 player 的高优先级、base page + `runtime/` overlay 组合语义，以及 `stripUnchosenActionOptions()` 对未选择行动选项的过滤。
- 已更新 `src/lib/rpg-runtime.test.ts`，覆盖角色/地点/关系 runtime 段落优先于静态百科或 evidence 毒丸文本、sources reference-only、高优先级当前状态、overlay 组合和未选择行动选项过滤。
- 已更新 `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 记录本阶段完成状态。

已验证：
- `npx.cmd vitest run src/lib/rpg-runtime.test.ts`
- `npx.cmd vitest run src/lib/rpg-runtime.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-runtime-controller.test.ts`
- `npm.cmd run typecheck`

未做范围：
- 未修改 ingest 写入流程、runtime write policy、runtime controller 语义或 UI。
- 未写入、压缩、重写或自动 distill 任何 wiki 页面。
- 未新增真实 LLM 调用。
- 未实现第六阶段 Relationship/Tension Deriver。
- 未执行 `git commit` 或 `git push`。

目标：
- 让 runtime context compiler 优先读取短 capsule 和运行时段落，避免仍然把整页塞进上下文。
- 把 ingest 产物真正接到跑团回合上下文选择策略上。

建议改动：
- context compiler 读取非 sources 页面时，优先截取 `Runtime Capsule`，再按目录读取关键运行时段落。
- characters 优先读取 Runtime Capsule、Behavior Rules、Dialogue Style、Relationship Levers。
- locations 优先读取 scene hooks、interactables、risks、clues、sensory anchors。
- relationships / plot-arcs 优先读取当前张力、触发器、未解问题、推进条件。
- 只有强相关且预算足够时，才读取 Evidence / Canon Facts 或完整页面。

验收：
- 同一批 wiki 页面下，runtime prompt 中整页正文占比下降，capsule/运行时段落占比上升。
- 当前场景、玩家状态、关系张力和相关角色规则的优先级高于静态百科段落。

第六阶段：Relationship/Tension Deriver v0

状态：已完成（2026-06-07）。

完成范围：
- 已新增 `src/lib/rpg-relationship-tension-deriver.ts`，实现纯 TypeScript proposal-only deriver：`deriveRpgRelationshipTensions()` 和 `createRpgRelationshipDeriverReviewItems()`。
- deriver 支持从 RPG wiki pages、`RpgIngestSignal[]` 和 source notes 中生成 trust、tension、secret、misunderstanding、dependency、conflict_pressure 提案。
- proposal 输出包含 `targetPath`、`targetKind`、`derivationKind`、`participants`、`canonStatus`、`confidence`、`evidence`、`rationale`、`playerTriggers`、`unresolvedBoundaries`、`mergePatchMarkdown` / `proposalMarkdown` 和 `warnings`。
- relationship proposal 采用合并式 delta，不重复完整角色介绍；plot-arc proposal 聚焦未解冲突压力、升级条件和不能提前解决的边界。
- 所有推导结论均保持 `inferred_for_play` 或 `uncertain`；直接证据、source notes 和 canon-marked signals 只作为 evidence summary，不提升为 canon facts。
- 参与者或证据不足时生成 warning / review-only proposal，不伪造确定关系页。
- 已新增 `src/lib/rpg-relationship-tension-deriver.test.ts` 覆盖本阶段要求的 proposal-only、canon 边界、关系合并、plot-arc pressure、source notes / signals 证据和 review-only 行为。

已验证：
- `npx.cmd vitest run src/lib/rpg-relationship-tension-deriver.test.ts`
- `npx.cmd vitest run src/lib/rpg-post-ingest-distiller.test.ts src/lib/rpg-ingest-signals.test.ts src/lib/rpg-extraction-validation.test.ts`
- `npm.cmd run typecheck`

未做范围：
- 未接入普通 ingest 自动写入路径。
- 未静默写入 `wiki/relationships/` 或 `wiki/plot-arcs/`。
- 未写入 canon facts。
- 未修改 runtime controller、UI、Tauri command 或 write policy。
- 未新增真实 LLM 调用。
- 未执行 `git commit` 或 `git push`。

目标：
- 从 characters、events、plot-arcs、dialogue signals 和 source notes 中推导隐式关系、秘密、误解和冲突压力。
- 明确区分 `canon` 和 `inferred_for_play`，避免把推导伪装成原作事实。

建议改动：
- 新增独立 deriver，不放进普通 ingest 主流程的自动写入路径。
- 输出默认进入 REVIEW，目标可以是 `wiki/relationships/`、相关 `plot-arcs` 或 review-only proposal。
- 推导内容应包含证据来源、推导理由摘要、置信度、可用于玩家行动的触发器、不能提前解决的边界。
- 对关系变化采用合并更新，不重复完整角色介绍。

验收：
- 能从角色行为和事件后果中提出可审阅的 trust/tension/secret/misunderstanding 变化。
- 所有非直接证据内容都标记为 `inferred_for_play`，并且默认不静默写入 canon facts。

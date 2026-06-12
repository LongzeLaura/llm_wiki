下面这份可以直接作为 `docs/RPG_WIKI_SCHEMA.md` 的第一版内容，用来约束 llmWikiRPG 每个目录“到底抽什么、不抽什么、以什么粒度存”。

---

# llmWikiRPG Wiki 目录抽取定义 v0.1

## 总体原则

`wiki/` 不是简单存剧情文本，而是把原始设定、角色卡、剧情记录、玩家行动和模型输出，压缩成**可检索、可维护、可重新编译上下文的结构化剧情知识库**。

每个条目都应尽量包含：

```md
# 标题

## 简述
一句话概括该条目的作用。

## 已知事实
- 稳定、明确、可被后续剧情引用的信息。

## 当前状态
- 会随着剧情推进变化的信息。

## 相关条目
- [[characters/xxx]]
- [[locations/xxx]]
- [[events/xxx]]

## 来源
- 来自哪个原始设定、角色卡、对话轮次或事件记录。

## 待确认 / 矛盾点
- 信息不完整、存在冲突、需要后续确认的内容。
```

其中：

* **事实**：来自原始设定、角色卡、已发生剧情。
* **状态**：会随游戏推进变化。
* **推测**：模型根据上下文合理推断，但不能当成铁设定。
* **伏笔**：尚未解决，但后续应该推进。
* **禁忌**：不允许模型违反的硬约束。

## v0.2 抽取质量修复说明

这份 schema 在 v0.1 之后承担了两层职责：

1. 继续定义 RPG wiki 每个目录“应该存什么、不应该存什么”。
2. 为 v0.2 的真实抽取质量修复提供明确的语义边界。

需要特别说明：

- v0.1 的 smoke test 只能证明目录路由、写入策略和少量 helper 行为成立，不能证明真实 LLM 在语义分类上已经稳定。
- v0.2 的重点不是重写架构，而是在当时实现边界内修复真实抽取里最常见的语义分类错误；新的后续方案不再默认考虑旧项目兼容。

当前这些问题主要靠 prompt/schema 修复：

- `player/` 与 `characters/` 的硬边界
- `events/` 与 `plot-arcs/` 的离散事件边界
- `concepts/` 与角色 trope/tag/trivia 的边界
- `locations/` / `factions/` 的二次抽取压力
- 角色页向可扮演结构靠拢的章节要求

当前这些问题除了 prompt/schema 之外，还有额外检测：

- `current-scene/` 不仅有 prompt/schema 限制，还有写入前的动态来源校验
- `player/` 误收原作角色、路线型 `events/`、trope 型 `concepts/`、以及明显漏掉 `locations/` / `factions/` 的情况，会在 `llmwikirpg` `autoIngest` 中触发轻量 warning/review

当前这些检测仍然是“发现问题并提示”，而不是全自动修复：

- 可疑 `wiki/player/` 页面不会被自动改写回 `characters/`
- 路线型 `wiki/events/` 不会被自动拆分成多个离散事件
- trope/tag 型 `wiki/concepts/` 不会被自动并回角色页
- `locations/` / `factions/` 漏抽只会提醒，不会凭空补造条目

因此，v0.2 的结论应理解为：

- 真实抽取里的主要语义错误现在有了更清晰的生成约束
- 最危险的几类输出现在有了轻量校验
- 但这还不是一个已经完成真实模型质量标定的终局方案

---

## Import Mode 与固定 Schema Slot 契约

本节冻结当前 RPG import / apply 的文档契约，并应与 code-readable schema helper、ordinary ingest target policy、项目骨架和测试保持同步。后续实现变更这些边界时，应同时更新本节。

### Import / Apply Mode

| mode | 语义 | 典型输入 | 允许目标路径 | 禁止路径 / 禁止行为 | 写入策略边界 |
|---|---|---|---|---|---|
| `source_ingest` | 普通来源资料导入；有损编译器，把来源材料压缩成 runtime-useful wiki 页面。 | 原作设定、角色分析、人物百科、剧情梗概、对白语料、世界书、网络资料。 | `wiki/sources/`、固定 `wiki/world/*.md` slot、`wiki/characters/`、`wiki/locations/`、`wiki/factions/`、`wiki/items/`、`wiki/plot-arcs/`、`wiki/events/`、`wiki/relationships/`；只有来源明确声明当前 PC 时，才可写固定 `wiki/player/*.md` slot。 | 不写任意新增 `wiki/world/<custom>.md`；不写 `wiki/current-scene/`；不写 `wiki/rules/`、`wiki/style/`、`wiki/memory/`、`wiki/outlines/main.md` 或 `wiki/outlines/progress.md`；不把未来大纲、可能发展或候选行动写入 `events`；不把原作主角默认写入 `player`；不写 legacy `entities`、`concepts`、`queries` 等旧目录。 | 走 ordinary ingest 的安全写入边界；对固定 world/player slot 只能合并到既有 slot，不新增、不删除任意 `wiki/world/*.md` 或 `wiki/player/*.md` 文件。 |
| `control_doc_import` | 控制文档导入；保真规范化器，保护用户显式控制语义。 | 主线大纲、章节安排、揭示顺序、跑团规则、世界规则、桌规、文风要求、禁用词、hard gate、玩家偏好、长期提示、会话笔记。 | 固定控制 slot：`wiki/outlines/main.md`、`wiki/outlines/progress.md`、`wiki/rules/core.md`、`wiki/rules/world.md`、`wiki/rules/table.md`、`wiki/style/narration.md`、`wiki/style/dialogue.md`、`wiki/style/forbidden.md`、`wiki/memory/long-term.md`、`wiki/memory/session-notes.md`、`wiki/memory/player-preferences.md`；可另存 `wiki/sources/imports/<source>.md` 作为 raw source anchor。 | 不写 `wiki/current-scene/`；不写 `events`；不把 `Possible Futures` 或未来 reveal 当作已发生事实；不丢弃 `{{setvar::...}}`、禁用词、hard gate 或用户显式控制块；不把规则、文风、偏好当作剧情状态。 | 默认 `manual_or_review_only`；只做结构化、frontmatter、section 规范化、wikilink enrichment 和必要 runtime-facing section 补齐。 |
| `campaign_setup_import` | 战役初始化导入；开局状态 bootstrap，把 PC、序章事实、初始目标、初始关系和当前场景分层落位。 | 玩家角色设定、初始能力、背包、已知信息、开局目标、初始关系、已发生序章、游戏开始时当前场景、开局地点和在场人物。 | 固定 player slot、`wiki/current-scene/scene_state.md`、`wiki/events/prologue.md`、`wiki/quests/*.md`、`wiki/relationships/*.md`、`wiki/outlines/main.md`、`wiki/outlines/progress.md`、`wiki/plot-arcs/*.md`、`wiki/locations/runtime/*.md`、`wiki/items/runtime/*.md`。 | 不把开场场景混入 `source_ingest`；不把未来剧情写入 `events`；不把玩家能力拆入 `rules/`；不把 NPC 当前状态写入 base `characters/*.md`；不新增或删除任意 player 文件。 | `current-scene` 显式 bootstrap/overwrite；固定 player slot merge；序章事件 append/create；大纲和规则类内容仍按 review/manual 边界处理。 |
| `runtime_update_apply` | 游玩中状态写回；runtime apply，不是文件导入，只应用已确认发生的回合结果。 | 已完成 RPG 回合记录、玩家已提交行动、已生成正文、已确认 references、accepted pending updates。 | `wiki/current-scene/scene_state.md`、`wiki/events/*.md`、固定 `wiki/player/*.md`、`wiki/quests/*.md`、`wiki/outlines/progress.md`、`wiki/relationships/runtime/*.md`、`wiki/plot-arcs/runtime/*.md`、`wiki/characters/runtime/*.md`、`wiki/locations/runtime/*.md`、`wiki/factions/runtime/*.md`、`wiki/items/runtime/*.md`。 | 不写 `wiki/sources/`、`wiki/world/`、`wiki/rules/`、`wiki/style/`、`wiki/memory/`、`wiki/outlines/main.md`、base `characters/locations/factions/items`、base `relationships/*.md`、base `plot-arcs/*.md` 或 legacy 目录；不写候选行动、未选择选项、未来可能和未确认推测。 | 只能通过 pending/review/apply 边界；`current-scene` overwrite；`events` append/create；player、quests、outline progress 和 runtime overlays merge。 |

### 固定 Schema Slots

这些 slot 是全新 `llmWikiRPG` 项目的固定入口文件，也是后续 module-specific input builders / runtime handoff readers 的读取优先级和 import target policy 的基础。缺失固定 slot 表示新项目结构不完整，应产生 warning 或可修复结构提示；这不是旧项目迁移、legacy fallback 或旧路径保留场景。

| slotId | path | owner | requiredForNewProject | runtimePriority | importPolicy | writePolicy |
|---|---|---|---|---|---|---|
| `world_basic_overview` | `wiki/world/basic_overview.md` | `source_ingest` | true | high | `ordinary_ingest` | `merge` |
| `world_history` | `wiki/world/history.md` | `source_ingest` | true | normal | `ordinary_ingest` | `merge` |
| `world_common_sense` | `wiki/world/common_sense.md` | `source_ingest` | true | normal | `ordinary_ingest` | `merge` |
| `world_supernatural_presence` | `wiki/world/supernatural_presence.md` | `source_ingest` | true | normal | `ordinary_ingest` | `merge` |
| `world_social_structure` | `wiki/world/social_structure.md` | `source_ingest` | true | normal | `ordinary_ingest` | `merge` |
| `main_outline` | `wiki/outlines/main.md` | `control_doc` | true | high | `controlled_canonicalize` | `manual_or_review_only` |
| `outline_progress` | `wiki/outlines/progress.md` | `runtime` | true | high | `runtime_apply` | `merge` |
| `rules_core` | `wiki/rules/core.md` | `control_doc` | true | critical | `controlled_canonicalize` | `manual_or_review_only` |
| `rules_world` | `wiki/rules/world.md` | `control_doc` | true | high | `controlled_canonicalize` | `manual_or_review_only` |
| `rules_table` | `wiki/rules/table.md` | `control_doc` | true | high | `controlled_canonicalize` | `manual_or_review_only` |
| `style_narration` | `wiki/style/narration.md` | `control_doc` | true | high | `controlled_canonicalize` | `manual_or_review_only` |
| `style_dialogue` | `wiki/style/dialogue.md` | `control_doc` | true | high | `controlled_canonicalize` | `manual_or_review_only` |
| `style_forbidden` | `wiki/style/forbidden.md` | `control_doc` | true | critical | `controlled_canonicalize` | `manual_or_review_only` |
| `memory_long_term` | `wiki/memory/long-term.md` | `control_doc` | true | normal | `controlled_canonicalize` | `manual_or_review_only` |
| `memory_session_notes` | `wiki/memory/session-notes.md` | `control_doc` | true | reference | `controlled_canonicalize` | `manual_or_review_only` |
| `memory_player_preferences` | `wiki/memory/player-preferences.md` | `control_doc` | true | critical | `controlled_canonicalize` | `manual_or_review_only` |
| `current_scene` | `wiki/current-scene/scene_state.md` | `runtime` | true | critical | `runtime_apply` | `overwrite` |
| `player_main` | `wiki/player/player.md` | `campaign_setup` | true | critical | `campaign_bootstrap` | `merge` |
| `player_abilities` | `wiki/player/abilities.md` | `campaign_setup` | true | high | `campaign_bootstrap` | `merge` |
| `player_inventory` | `wiki/player/inventory.md` | `campaign_setup` | true | high | `campaign_bootstrap` | `merge` |
| `player_goals` | `wiki/player/goals.md` | `campaign_setup` | true | high | `campaign_bootstrap` | `merge` |
| `player_known_information` | `wiki/player/known_information.md` | `campaign_setup` | true | high | `campaign_bootstrap` | `merge` |

`owner` 表示该 slot 的主要语义拥有者；显式的 `campaign_setup_import` 或 `control_doc_import` 可以初始化对应 slot，但后续 runtime 写回仍必须遵守该 slot 的 `writePolicy` 和 mode 禁止路径。

### 固定 `world/` 文件集合

`wiki/world/` 固定包含以下文件：

```text
wiki/world/basic_overview.md
wiki/world/history.md
wiki/world/common_sense.md
wiki/world/supernatural_presence.md
wiki/world/social_structure.md
```

约定：

- `world/basic_overview.md`：世界核心前提、时代、主要舞台、类型基调、整体氛围。
- `world/history.md`：世界历史、公开过去、历史背景和已确定的大事件；不记录当前战役回合事件。
- `world/common_sense.md`：普通人默认知道的常识、习俗、禁忌、日常社会认知和公共知识。
- `world/supernatural_presence.md`：超自然、科技、怪异、神秘体系在世界中的存在方式和可见呈现；可执行规则进入 `rules/`。
- `world/social_structure.md`：社会结构、制度、阶层、法律、经济、公共权力结构和广义组织方式；具体组织进入 `factions/`。
- import framework 不应新增或删除任意 `wiki/world/*.md`；额外 world 子主题应合并进上述固定 slot。

### 固定 `player/` 文件集合

`wiki/player/` 固定包含以下文件：

```text
wiki/player/player.md
wiki/player/abilities.md
wiki/player/inventory.md
wiki/player/goals.md
wiki/player/known_information.md
```

约定：

- `player/player.md`：PC 身份、背景、稳定设定、当前状态摘要。
- `player/abilities.md`：玩家能力、技能、限制、代价、熟练度、当前可用性；不拆到 `rules/`。
- `player/inventory.md`：玩家当前持有、数量、装备状态、消耗状态。
- `player/goals.md`：玩家/PC 的主观目标、愿望、承诺、个人动机。
- `player/known_information.md`：玩家已知信息、误解、只对玩家可见或玩家尚不知道的信息边界。
- import framework 和 runtime apply 不应新增或删除 `wiki/player/*.md`；额外 player 子主题应合并进上述固定 slot。

### `outlines/main.md` 与 `outlines/progress.md`

`outlines/main.md` 是作者/GM 侧主线大纲、章节结构、揭示顺序和未来剧情指导，默认 `manual_or_review_only`，不被 runtime 每轮直接改写。

`outlines/progress.md` 是当前游玩过程相对大纲的位置记录，可由 `runtime_update_apply` 在 pending/review 边界内 merge 更新，用来记录当前处于哪一幕、哪些 beat 已完成/跳过/提前/延后、下一步自然承接哪个 beat。

未来剧情、分支条件和 delayed reveal 可以存在于 `outlines/main.md`，但不能被写入 `events`。已发生事实进入 `events`；相对大纲的进度进入 `outlines/progress.md`。

### Base / Runtime Overlay 边界

base 页保存初始/稳定结构，runtime overlay 保存本战役游玩中持续变化：

```text
characters/*.md              + characters/runtime/*.md
locations/*.md               + locations/runtime/*.md
factions/*.md                + factions/runtime/*.md
items/*.md                   + items/runtime/*.md
relationships/*.md           + relationships/runtime/*.md
plot-arcs/*.md               + plot-arcs/runtime/*.md
```

Module-specific input builders / runtime handoff readers 读取时先读 base，再叠加 runtime overlay，得到当前战役视角。overlay 是分层读取/组织模型；merge 是更新单个目标文件的写入策略。`runtime_update_apply` 不直接改写 base `relationships/*.md` 或 base `plot-arcs/*.md`，关系和剧情弧的运行时变化写入对应 `runtime/` overlay。

## 阶段读写矩阵

本节只描述 `wiki/` 持久目录在各阶段的可改动范围和可读取范围。运行时中间产物、turn record、runtime journal、pending metadata、LLM input/output contract 和 `.llm-wiki/runtime/` 不属于普通 wiki category；它们可以引用 `wiki/`，但不能作为 `wiki/runtime/` 页面被普通 ingest 写入。

Runtime-only 类型契约、字段枚举和各 LLM step 的 JSON schema 应放在对应 runtime/interaction 文档或代码类型中维护；本文件只保留目录级 schema、落点、读写边界和跨目录语义。

### 阶段 / 模块名称

- `source_ingest`：普通来源导入，把原始资料压缩到 source/world/base entity/event/relationship/plot-arc 等目录。
- `control_doc_import`：控制文档导入，规范化大纲、规则、文风、长期记忆和 raw source anchor。
- `campaign_setup_import`：战役初始化导入，写入 PC、开局场景、序章、初始目标、初始关系和开局 runtime overlay。
- `manual_or_review`：用户手动编辑，或用户明确接受 review / pending item 后的受控写入。所有目录都可改动，故省略
- `post_ingest_derivation`：导入后的派生整理，如关系、张力、capsule、索引或摘要；默认产出待审结果，不能绕过 review 直接写控制层。
- `recall_selector`：召回选择模块，只从已索引/已编译材料中筛选本轮相关材料，不直接写 `wiki/`。
- `action_resolver`：行动裁判模块，读取当前场景、PC、规则和相关对象；不直接写 `wiki/`。
- `world_tick`：世界推进 / reaction 模块，读取行动结果、当前状态和相关 overlay；不直接写 `wiki/`。
- `outline_brief`：Outline-aware Brief Compiler，读取大纲切片、进度、剧情弧、关系张力和召回材料；不直接写 `wiki/`。
- `story_outline_regenerator`：重大偏离时的大纲修订提案模块，只产出临时 handoff 或独立 outline review item；不自动改写 `wiki/outlines/main.md`。
- `narration_generator`：叙事生成模块，读取前置 handoff、召回材料、style bundle 和可见性边界；不直接读任意 `wiki/` 文件，也不直接写 `wiki/`。
- `runtime_update_proposal`：写回提案模块，读取结构化回合 delta、引用材料和允许目标策略，生成 pending/review proposal；不直接落盘。
- `runtime_update_apply`：用户接受 pending 后的实际写回，只写允许的 runtime apply 目标。

当前代码中仍存在的 `compileRpgContext()` / `CompactStoryBrief` 应称为 `legacy_context_compiler_v0` 或 `legacy_compact_brief_builder`。它是待拆除实现，不是目标 runtime 模块；正式 runtime 目标不是新建 `Context Compiler v1`，而是拆成 module-specific input builders / runtime handoff readers。

### 目录矩阵

| 目录 / 文件 | 可改动阶段 | 可读取阶段 / runtime 模块 | 写读边界 |
|---|---|---|---|
| `wiki/sources/` | `source_ingest`、`control_doc_import` raw anchor | `recall_selector`、`runtime_update_proposal` 引用审计、`post_ingest_derivation` | 来源证据层；runtime 模块只引用 provenance，不把 sources 当作当前状态权威。 |
| 固定 `wiki/world/*.md` slot | `source_ingest`、受审 `post_ingest_derivation` | `recall_selector`、`world_tick`、`outline_brief`、`narration_generator` 通过 handoff、`runtime_update_proposal` 引用审计 | 固定五 slot；runtime apply 不写 world，不新增 `world/<custom>.md`。 |
| `wiki/characters/*.md` | `source_ingest`、受审 `post_ingest_derivation` | `recall_selector`、`action_resolver`、`world_tick`、`outline_brief`、`narration_generator` 通过 handoff、`runtime_update_proposal` | base 角色页保存稳定画像和长期可扮演信息；游玩变化进入 `characters/runtime/`。 |
| `wiki/characters/runtime/*.md` | `runtime_update_apply` | `recall_selector`、`action_resolver`、`world_tick`、`outline_brief`、`runtime_update_proposal` | 只保存已审阅的本战役角色状态 overlay；不是每轮临时工作区。 |
| 固定 `wiki/player/*.md` slot | `campaign_setup_import`、`runtime_update_apply`；`source_ingest` 仅限来源明确声明当前 PC | `recall_selector`、`action_resolver`、`world_tick`、`outline_brief`、`narration_generator` 通过 handoff、`runtime_update_proposal` | 固定五 slot；不自由新增 player 页面。`known_information.md` 只接收 PC 已知或 PC 误解。 |
| `wiki/locations/*.md` | `source_ingest`、受审 `post_ingest_derivation` | `recall_selector`、`action_resolver`、`world_tick`、`outline_brief`、`runtime_update_proposal` | base 地点页保存稳定地理、权限和可互动结构；当前封锁、破坏、可达性进入 runtime overlay。 |
| `wiki/locations/runtime/*.md` | `campaign_setup_import`、`runtime_update_apply` | `recall_selector`、`action_resolver`、`world_tick`、`outline_brief`、`runtime_update_proposal` | 记录本战役地点当前状态、临时危险、封锁、在场线索或开放路径。 |
| `wiki/factions/*.md` | `source_ingest`、受审 `post_ingest_derivation` | `recall_selector`、`action_resolver`、`world_tick`、`outline_brief`、`runtime_update_proposal` | base 组织页保存稳定目标、资源、结构和边界；当前行动、损耗、立场变化进入 runtime overlay。 |
| `wiki/factions/runtime/*.md` | `runtime_update_apply` | `recall_selector`、`action_resolver`、`world_tick`、`outline_brief`、`runtime_update_proposal` | 记录本战役组织状态，不改写 base faction 设定。 |
| `wiki/items/*.md` | `source_ingest`、受审 `post_ingest_derivation` | `recall_selector`、`action_resolver`、`world_tick`、`runtime_update_proposal` | base 物品页保存稳定来源、能力、限制和规则关联；持有、损坏、消耗进入 player 或 runtime overlay。 |
| `wiki/items/runtime/*.md` | `campaign_setup_import`、`runtime_update_apply` | `recall_selector`、`action_resolver`、`world_tick`、`runtime_update_proposal` | 记录本战役物品当前位置、状态、归属、消耗和临时效果。 |
| `wiki/relationships/*.md` | `source_ingest`、`campaign_setup_import`、受审 `post_ingest_derivation` | `recall_selector`、`world_tick`、`outline_brief`、`narration_generator` 通过 tension handoff、`runtime_update_proposal` | base 关系页保存初始或稳定关系结构；游玩中的信任、误解、张力变化进入 `relationships/runtime/`。 |
| `wiki/relationships/runtime/*.md` | `runtime_update_apply` | `recall_selector`、`world_tick`、`outline_brief`、`narration_generator` 通过 tension handoff、`runtime_update_proposal` | 记录已发生或已审阅的关系变化；轻微情绪压力不足以落盘时留在 journal/review。 |
| `wiki/plot-arcs/*.md` | `source_ingest`、`campaign_setup_import`、受审 `post_ingest_derivation` | `recall_selector`、`outline_brief`、`world_tick` 作为 tension/gap 材料、`narration_generator` 通过 handoff、`runtime_update_proposal` | 保存伏笔、冲突、可能发展和推进方向；不得伪造成已发生事件。 |
| `wiki/plot-arcs/runtime/*.md` | `runtime_update_apply` | `recall_selector`、`outline_brief`、`world_tick`、`narration_generator` 通过 handoff、`runtime_update_proposal` | 保存本战役已审阅的 branch state、压力、未解决张力和偏离影响。 |
| `wiki/outlines/main.md` | `control_doc_import`、`campaign_setup_import` 初始主线；接受 `story_outline_regenerator` 的独立 review item 后才可受控改动 | `outline_brief`、`story_outline_regenerator`、`narration_generator` 仅通过 handoff、`runtime_update_proposal` 引用审计 | 作者/GM 控制层；runtime 普通写回不直接改主线大纲。 |
| `wiki/outlines/progress.md` | `control_doc_import`、`campaign_setup_import`、`runtime_update_apply` | `recall_selector`、`action_resolver` 当前目标背景、`world_tick` pacing/gap、`outline_brief`、`story_outline_regenerator`、`runtime_update_proposal` | 记录相对大纲进度、已完成/跳过/失效 beat 和偏离说明；不把未来修订写成事实。 |
| `wiki/events/*.md` | `source_ingest`、`campaign_setup_import` 序章、`runtime_update_apply` | `recall_selector`、`world_tick` 历史约束、`outline_brief`、`narration_generator` 通过 handoff、`runtime_update_proposal` | 只写 confirmed happened 事件；候选行动、未确认尝试和未来计划不得进入 events。 |
| `wiki/current-scene/scene_state.md` | `campaign_setup_import`、`runtime_update_apply` | `recall_selector`、`action_resolver`、`world_tick`、`outline_brief`、`narration_generator` 通过 handoff、`runtime_update_proposal` | 覆盖式当前快照；不保存完整历史，历史进入 events。 |
| `wiki/quests/*.md` | `campaign_setup_import`、`runtime_update_apply` | `recall_selector`、`action_resolver`、`world_tick`、`outline_brief`、`narration_generator` 通过 handoff、`runtime_update_proposal` | 记录玩家当前目标、任务状态和可行动目标；不是大纲未来安排的替代物。 |
| 固定 `wiki/style/*.md` slot | `control_doc_import` | `recall_selector`、`narration_generator` 通过 `styleBundle`、`outline_brief` 的 reveal/style 边界、`runtime_update_proposal` 引用审计 | 表达方式和禁用表达层；不提升为世界事实、事件事实或 PC knowledge。 |
| 固定 `wiki/rules/*.md` slot | `control_doc_import` | `recall_selector`、`action_resolver`、`world_tick`、`narration_generator` 通过 hard constraints、`runtime_update_proposal` 引用审计 | 可执行裁判边界；不存玩家个人能力，PC 能力进入 `player/abilities.md`。 |
| 固定 `wiki/memory/*.md` slot | `control_doc_import` | `recall_selector`、`narration_generator` 通过 preference/session handoff、`runtime_update_proposal` 引用审计 | 长期提示、会话笔记和玩家偏好；不作为已发生剧情或规则事实自动写回。 |

Runtime 模块的直接输出默认进入本轮 handoff、turn record、journal 或 pending/review。只有 `runtime_update_apply` 在用户接受 pending 后可以落盘到允许目标；`action_resolver`、`world_tick`、`outline_brief`、`story_outline_regenerator`、`narration_generator` 和 `runtime_update_proposal` 都不能绕过 review/apply 直接写 `wiki/`。

### 阶段 / 模块信息流矩阵

本表从阶段视角描述“输入从哪里来、输出到哪里去”。它不替代上面的目录矩阵；目录矩阵定义目录权限，本表定义阶段 / 模块的信息流。表中 section 名称是 schema 级推荐落点，实际页面可以使用等价标题，但应保留相同语义。

| 阶段 / 模块 | 输入信息来源 | 输出去向 / 输出内容 | 边界 |
|---|---|---|---|
| `source_ingest` | 原始来源文本；用户提供的 source metadata；已有 `wiki/sources/*` 的来源摘要、影响目录、可信度 / 优先级和冲突信息；已有 base 页的 `## 来源` / `## 待确认 / 矛盾点` 用于合并判断。 | 写入 `wiki/sources/<source>.md` 的来源名称、类型、摘要、影响目录、可信度和冲突；写入固定 `wiki/world/*.md` 的稳定事实、常识、历史或社会结构；写入 base `characters/*.md` 的 `## 核心定位`、`## 静态设定`、`## 性格与行为模式`、`## 说话方式`、`## 能力与限制`、`## 行为边界`、`## 剧情钩子`、`## 来源与待确认`；写入 base `locations/factions/items/*.md`、base `relationships/*.md`、`plot-arcs/*.md` 的核心问题 / 未解决悬念 / 冲突结构、`events/*.md` 的已发生时间 / 参与者 / 地点 / 结果；明确 PC 来源才可写固定 `player/*.md`。 | 不能写 `current-scene`、控制层、runtime overlay 或任意 `wiki/world/<custom>.md`；不能把未来可能写成 event；不能把原作角色默认写成 PC。 |
| `control_doc_import` | 用户显式控制文档：主线大纲、章节安排、揭示顺序、规则、桌规、文风要求、禁用词、长期记忆、玩家偏好；可读取已有 `outlines/main.md` 的 `## Runtime Capsule` / `## Act Structure` / `## Must Not Contradict`、`outlines/progress.md` 的当前进度、rules/style/memory 固定 slot 的冲突点用于合并。 | 写入 `wiki/outlines/main.md` 的 `## Runtime Capsule`、`## Campaign Premise`、`## Act Structure`、`## Intended Reveals`、`## Delayed Reveals`、`## Branch Conditions`、`## Must Not Contradict`；写入 `wiki/outlines/progress.md` 的 `## Current Stage`、`## Completed Beats`、`## Divergence Notes`、`## Next Useful Beats`；写入 `rules/*.md` 的成功/失败条件、资源代价、时间距离、能力限制、硬约束；写入 `style/*.md` 的 narration/dialogue/forbidden；写入 `memory/*.md` 的 long-term/session-notes/player-preferences；可生成 `wiki/sources/imports/<source>.md` raw anchor。 | 不写已发生事件、不写当前场景、不把规则/风格/偏好当作剧情事实；未来 reveal 只能留在 outline/control 层。 |
| `campaign_setup_import` | 玩家角色卡；初始能力、背包、已知信息、目标；开局场景；序章事实；初始关系；开局地点 / 物品状态；可读取 world/rules/style/outlines 的开局约束和 forbidden reveal。 | 写入固定 `player/player.md` 的身份、背景、稳定设定、当前状态摘要；写入 `player/abilities.md` 的能力、限制、代价、当前可用性；写入 `player/inventory.md` 的持有物、数量、装备/消耗状态；写入 `player/goals.md` 的主观目标、承诺、动机；写入 `player/known_information.md` 的 PC 已知事实和 PC 误解；写入 `current-scene/scene_state.md` 的当前时间地点、在场人物、可交互对象、可见线索、下一轮必须承接；写入 `events/prologue.md`、`quests/*.md` 的目标 / 状态 / 下一步可行动作、`relationships/*.md`、`outlines/main.md` / `progress.md` 的开局段、`plot-arcs/*.md`、必要的 `locations/runtime/*.md` 和 `items/runtime/*.md`。 | 只做开局 bootstrap；不把 NPC 当前状态写进 base character；不新增 player 子页；不把未来剧情写进 events。 |
| `manual_or_review` | 用户直接编辑；用户接受的 pending / review item；用户提供的修订说明；相关页面当前内容、目标 section、冲突点和 review 风险说明。 | 所有 `wiki/` 持久目录都可由用户显式改动；review apply 只写该 review item 声明的 target path / target section / strategy，并应保留 reason、source references、风险说明和用户接受记录。 | 这是权限入口，不是自动模块。自动流程不得借 `manual_or_review` 名义绕过用户确认。 |
| `post_ingest_derivation` | 已写入的 `sources`、world/base entity/event/relationship/plot-arc 页面；来源引用；轻量 lint / graph / capsule 输入；重复、冲突和遗漏信号；可读取 entity 页的 `## 相关条目`、`## 来源`、`## 待确认 / 矛盾点`，relationship 页的关系定位 / 当前张力，plot-arc 页的未解决悬念 / 冲突结构。 | 默认输出 review/pending；接受后可补充 `relationships/*.md` 的关系定位、关系历史、当前张力、后续推进限制；补充 `plot-arcs/*.md` 的核心问题、未解决悬念、冲突结构；补充角色/地点/组织/物品页的 `## 相关条目`、`## 待确认 / 矛盾点`、summary/capsule；可更新索引或非 wiki metadata。 | 不能自动写控制层；不能把派生推测当作 confirmed event；高风险派生必须走 review。 |
| `recall_selector` | module-specific recall reader / 检索索引；玩家行动文本；当前场景 entities；近期 events；source refs；允许读取的 section metadata。优先读取 scene 状态、PC 能力/知识、规则硬约束、相关角色当前状态、地点可达性、关系张力、plot-arc pressure、outline progress。 | 输出非落盘 `RecallSelection` / `recalledMaterials` handoff；每条 material 应带 path、sectionId / heading、summary、reason、lineTarget、visibility、readMode、confidence；可写 journal 审计；不写 wiki。 | 只筛选，不解释新事实；不直接读取 forbidden/GM-only 给 PC 可见线，除非 handoff 标明 visibility。 |
| `action_resolver` | 玩家提交行动；`buildActionResolverInputFromWiki()` 直接读取 `current-scene` 的在场人物 / 可交互对象 / 可见线索 / active clocks；固定 player slot 的能力限制 / 资源 / 库存 / PC knowledge；`rules/core.md`、`rules/world.md`、`rules/table.md` 的成功失败条件和代价；相关角色/地点/物品/faction base + runtime 当前状态；quests 当前目标。 | 输出非落盘 `ActionResolution` / `PostActionWorkingState` 初稿到 turn record / journal，并交给 `world_tick` 和 `runtime_update_proposal`。输出内容包括行动是否可行、判定依据、直接结果、代价、阻碍、`timeDelta`、`playerActionDelta`、`progressPotential`、需要确认的问题。 | 不写 wiki；不推进 NPC 世界反应；不从 `CompactStoryBrief` 派生输入；不把尝试但未确认的行动写成 happened event。 |
| `world_tick` | `ActionResolution`、`PostActionWorkingState`；current-scene 的 active clocks / pending reactions / pacing state；相关 runtime overlay；events 最近后果和历史约束；relationships/runtime 当前张力；plot-arcs/runtime unresolved pressure；quests 状态；outline progress；rules hard constraints。 | 输出非落盘 `WorldTickResult` 到 turn record / journal，并交给 `outline_brief`、`narration_generator`、`runtime_update_proposal`。输出内容包括 worldDeltas、clockUpdates、settledOngoingEvents、informationBroadcast、reactionQueue、pacingUpdate、gapSignal、affectedPaths、visibility / knowledge / happenedStatus。 | 不重新裁判玩家行动；不生成正文；不写 wiki；ongoing/possible_future 不得直接变成 confirmed event。 |
| `outline_brief` | context / recall handoff；`outlines/main.md` 受控切片中的 Act Structure / Intended Reveals / Delayed Reveals / Branch Conditions / Must Not Contradict；`outlines/progress.md` 的 Current Stage / Completed Beats / Divergence Notes / Next Useful Beats；plot-arcs base/runtime 的未解决悬念和冲突结构；relationships/runtime 当前张力；WorldTick pacing/gap；events 已发生约束；style/rules/memory 边界。 | 输出非落盘 `OutlineAwareNarrationBrief`、outlineImpactReport 和 narration handoff，不写 wiki。输出内容包括 playerFacingBrief、parallelLineBrief、tensionBriefInput、revealPolicy、mustNotReveal、outlineImpactLevel；必要时输出 regeneration request，说明受影响线、失效 beat/reveal/branch refs、必须保留事实和需要重检的控制点。 | 不生成玩家正文；不生成 update proposal；不改 `outlines/main.md`；非重大偏离不得触发大纲重写。 |
| `story_outline_regenerator` | 只有 `outline_brief` 判定重大偏离时才读取：已发生 events、current-scene、player 状态、outline slices、progress、plot-arcs/runtime、受影响 reveal / beat / branch refs、safety constraints。 | 输出非落盘 provisional outline handoff 和独立 outline review item；review item 可提出 `outlines/main.md` 的 Act Structure / Intended Reveals / Delayed Reveals / Branch Conditions / Must Not Contradict 修订建议，以及 `outlines/progress.md` 的 Divergence Notes / Next Useful Beats 更新建议；同时输出 safety report、受影响 refs、保留事实、拒绝方案；用户接受后才可能改 `outlines/main.md` 或相关控制层。 | 不能自动写主线大纲；不能改已确认事实；未来方案不能进入 events；未接受 proposal 不能被当作事实材料。 |
| `narration_generator` | `PostActionWorkingState`、`ActionResolution`、`WorldTickResult`、RecallSelection/recalledMaterials、OutlineAwareNarrationBrief、可选 provisional handoff、style/narration、style/dialogue、style/forbidden、rules hard constraints、forbiddenForNarration、playerKnowledgeBoundary。 | 输出非落盘 `TurnNarration` 到 turn record / journal，并交给 `runtime_update_proposal`。输出内容包括 playerFacingText、parallelLineText、tensionBrief、displayPolicy、narrationMeta、nextActionOptions、references；其中 playerFacingText 是 PC 可见正文，parallelLineText 是用户可见但 PC 未知镜头，tensionBrief 是关系/情感/剧情压力 handoff。 | 不直接读取任意 wiki 文件；不裁判行动；不推进世界；不写 wiki；parallelLineText 不授予 PC knowledge；nextActionOptions 不是事实。 |
| `runtime_update_proposal` | 完整 turn record；ActionResolution；WorldTickResult；TurnNarration；consistency validation；references；allowedTargets / writePolicy / reviewPolicy；当前目标页面的相关 sections 用于定位 merge/append/overwrite，如 `current-scene` 当前快照字段、`events` confirmed happened 事件段、`player/*` 当前状态/能力/库存/目标/已知信息、`quests` 状态和下一步、runtime overlay 当前状态 / 张力 / branch state、`outlines/progress` Current Stage / Completed Beats / Divergence Notes / Next Useful Beats。 | 输出 pending/review proposal、journal entries、skippedDeltas、pacingUpdateProposal、proposalGroups、outlineRevisionReviewItems，不直接落盘。每条普通 proposal 应带 targetPath、strategy、reason、sourceDeltas、references、visibility、knowledgeScope、happenedStatus、confidence。 | 只提案不 apply；不能扩展 allowedTargets；`events` 要求 confirmed_happened；player knowledge 只接收 PC known / misunderstanding；outline main 修订必须是独立 review item。 |
| `runtime_update_apply` | 用户接受的 pending updates；本地 validator 结果；目标文件当前内容；write policy；proposal sourceDeltas 和 references；目标 section 的当前文本。 | 实际写入 `current-scene/scene_state.md` 的覆盖式当前快照；写入 `events/*.md` 的 append/create confirmed event；merge 固定 `player/*.md`、`quests/*.md`、`outlines/progress.md` 和各类 `*/runtime/*.md`；写入 apply journal / audit，并保留来源、turn id、references 和 review 接受痕迹。 | 不能写 sources/world/rules/style/memory/outlines/main/base entity/base relationship/base plot-arcs；不能 apply rejected / skipped delta；不能把未确认或未来内容写成事实。 |

# 目录定义


## `sources/`

### 定义

存放所有原始输入材料的来源摘要，包括原始设定、角色卡、世界书、导入文本、模组说明、历史对话、玩家补充说明等。

`sources/` 的作用不是直接参与剧情生成，而是作为**证据来源层**，用于追溯“某个设定从哪里来”。

### 需要抽取的信息

包括：

* 来源名称
* 来源类型
  例如：角色卡、世界书、原作设定、用户补充、历史对话、模组文本
* 来源摘要
* 该来源主要包含哪些信息
* 该来源影响哪些目录
  例如影响 `characters/`、`world/`、`rules/`
* 来源可信度 / 优先级
* 是否为硬设定
* 是否存在与其他来源冲突的内容

### 不应放入的信息

不要在这里详细维护角色状态、剧情事件、地点状态。
`sources/` 只记录“信息来自哪里”，不负责承载最终整理后的设定。

### 推荐页面粒度

每个原始文件、角色卡、世界书条目、重要导入文本对应一个页面。

示例：

```text
sources/tohsaka_rin_character_card.md
sources/fate_worldbook_magic_system.md
sources/user_custom_setting_001.md
```

---

## `world/`

### 定义

存放世界观层面的稳定设定，包括世界结构、历史背景、社会常识、文化、时代背景、技术水平、超自然存在、公共认知等。

`world/` 是固定 slot 目录，不是自由多页目录。普通 Source Ingest 只能写入五个固定文件，不能新增 `world/<custom>.md`。

`world/` 回答的问题是：

> 这个世界是什么样的？普通人如何理解这个世界？故事发生在怎样的大环境中？

### 需要抽取的信息

包括：

* 世界基本背景
* 时代与地理范围
* 普通社会规则
* 历史大事件
* 常识性设定
* 世界中的主要超自然 / 科技 / 神秘体系
* 社会组织方式
* 重要历史人物或历史传说
* 普通人与特殊群体之间的认知差异
* 世界整体氛围
  例如：现代都市、黑暗奇幻、末世、赛博朋克、校园异能

### 不应放入的信息

不要放具体战斗规则、能力数值、角色个人状态。
这些应放入：

* `rules/`
* `characters/`
* `player/`

### 推荐页面粒度

第一版固定使用以下文件集合：

```text
world/basic_overview.md
world/history.md
world/common_sense.md
world/supernatural_presence.md
world/social_structure.md
```

额外世界观主题必须合并进最接近的固定 slot；如果无法自然合并，通常说明它应进入 `rules/`、`locations/`、`factions/`、`plot-arcs/` 或 `sources/`。

推荐拆分：

* `basic_overview.md`：世界核心前提、时代、主要舞台、类型基调、整体氛围。
* `history.md`：世界历史、公开过去、历史背景和已确定的大事件；不记录当前战役回合事件。
* `common_sense.md`：普通人默认知道的常识、习俗、禁忌、日常社会认知和公共知识。
* `supernatural_presence.md`：超自然、科技、怪异、神秘体系在世界中的存在方式和可见呈现；可执行规则进入 `rules/`。
* `social_structure.md`：社会结构、制度、阶层、法律、经济、公共权力结构和广义组织方式；具体组织进入 `factions/`。

### 与旧 `concepts/` 路径的切分边界

如果代码中仍存在旧 `concepts/` 路径，RPG 模式下也只应把以下内容独立写入 `concepts/`；后续新方案不应为了旧项目兼容继续扩展这个路径：

* 魔术体系
* 能力机制
* 世界观术语
* 规则性概念
* 可被多角色 / 多事件引用的设定概念

不要把以下内容独立写入 `concepts/`：

* 萌点
* 外号
* 社区标签
* 性格标签
* trivia
* 主要只描述单个角色的贫穷、傲娇、电气白痴等特征

这类信息应合并进对应角色页，优先落在：

* `## 性格与行为模式`
* `## 特征与缺陷`
* `## 日常习惯`
* `## 可用于扮演的细节`

示例：

* 错误：`concepts/贫穷-萌点.md`
* 正确：合并进 `characters/远坂凛.md`
* 错误：`concepts/电气白痴.md`
* 正确：合并进 `characters/远坂凛.md`
* 正确：`concepts/虚数属性.md`
* 正确：`concepts/投影魔术.md`
* 正确：`world/圣杯战争.md`

---

## `characters/`

### 定义

存放非玩家角色的信息，包括角色静态设定和动态状态。
原作角色、原作主角、视觉小说可操控角色、故事 POV 角色、动画/游戏既有角色，默认都属于 `characters/`，除非来源文本明确声明他们是当前 RPG 的玩家角色。

`characters/` 回答的问题是：

> 这个角色是谁？他/她有什么背景、性格、能力、目标？当前处于什么状态？

### 需要抽取的信息

角色页应尽量写成“可直接拿来扮演”的结构，不只是百科介绍。建议至少覆盖以下维度：

* `## 核心定位`
  这个角色在故事中的作用、戏剧功能、常见出场位、对局势的杠杆点。
* `## 静态设定`
  身份、外貌、年龄、种族、背景、价值观、长期目标、组织归属、与世界观/地点/物品的稳定关联。
* `## 性格与行为模式`
  性格特征、决策习惯、触发点、偏好、忌讳、日常习惯、常见反应模式。
* `## 说话方式`
  记录具体语言风格，如常用措辞、句子长短、礼貌等级、口头禅、避谈话题、说话节奏。
  不要只写“傲娇”“温柔”这类抽象标签。
* `## 能力与限制`
  能力、技能、资源、专长、使用代价、弱点、盲区、硬限制。
* `## 行为边界`
  这是关键字段。明确写出角色不会做什么、不会跨越哪些底线、会坚持什么承诺，以及什么条件下这些边界会被打破。
* `## 多状态快照`
  当来源覆盖不同路线、不同时间点、不同阵营立场、不同结局状态时，要分开记录。
  不要把 True End 或某条路线后期状态当成唯一“当前状态”。
* `## 与其他角色的交互模式`
  记录其对常见角色/群体的典型互动方式，例如保护、操控、试探、服从、挑衅、依赖、权威压制。
* `## 当前状态`
  当前所在地、身体状态、心理状态、当前目标、掌握信息、近期重要变化。
* `## 与当前PC交互规则`
  只有存在当前 PC 时才填写。记录其对当前 PC 的态度、信任、合作边界、冲突触发点、会答应什么、会拒绝什么。
  如果当前没有明确 PC，这一节应省略，或明确写“未建立当前 PC 关系”。
* `## 剧情钩子`
  该角色还能推动哪些冲突、秘密、张力、交易、揭露或关系变化。
* `## 来源与待确认`
  记录路线来源、时间点来源、冲突说法、仍待确认的事实、以及不能直接下结论的推断。

另外：

* 角色相关的萌点、绰号、习惯、缺点、小癖好等信息，如果值得保留，应并入角色页的 `## 性格与行为模式`、`## 特征与缺陷`、`## 日常习惯`、`## 可用于扮演的细节` 等角色内章节，而不是拆成 `concepts/`。

### 不应放入的信息

不要在角色页中完整记录所有事件流水。
事件经过应放入 `events/`，角色页只保留“这个事件对角色造成的状态变化”。
不要因为角色是原作主角、玩家视角角色、路线主角或可操控角色，就把它误写进 `player/`。
如果当前没有明确 PC，不要编造“与玩家相关”段；可省略，或明确写“未建立当前 PC 关系”。
不要把不同路线/不同时间点/不同结局下的状态揉成一个统一版本，尤其不要把后期结局状态直接当成当前时间线的既成事实。

### 推荐页面粒度

每个重要角色一个页面。

示例：

```text
characters/tohsaka_rin.md
characters/emiya_shirou.md
characters/saber.md
characters/caster.md
```

### 推荐结构

```md
# 角色名

## 核心定位
这个角色在故事中的作用。

## 静态设定
- 身份：
- 背景：
- 长期目标：
- 组织归属：

## 性格与行为模式
- 性格：
- 行为模式：
- 触发点：
- 日常习惯：

## 说话方式
- 常用措辞：
- 礼貌等级：
- 口头禅：
- 避谈话题：

## 能力与限制
- 能力：
- 资源：
- 代价：
- 弱点：

## 行为边界
- 不会做什么：
- 不会跨越的底线：
- 会坚持的承诺：
- 可能失守的条件：

## 多状态快照
- 路线 / 时间点 A：
- 路线 / 时间点 B：

## 与其他角色的交互模式
- 对角色 A：
- 对角色 B：
- 对组织 / 群体：

## 当前状态
- 位置：
- 身体状态：
- 心理状态：
- 当前目标：
- 掌握信息：

## 与当前PC交互规则（如已建立）
- 对当前 PC 的态度：
- 信任度：
- 依赖程度：
- 冲突点：
- 潜在张力：

如果当前没有明确 PC，这一节可以省略，或写“未建立当前 PC 关系”。

## 剧情钩子
- 该角色身上可推进的剧情点。

## 来源与待确认
- 来自哪条路线 / 哪个时间点：
- 哪些结论仍待确认：
- 哪些说法彼此冲突：
```

---

## `player/`

### 定义

`player/` 只存放当前 RPG 玩家创建或被明确声明为玩家扮演的角色，是玩家在世界中的投影。
除非来源文本明确说明“这是当前 RPG 的玩家角色 / PC / 自定义角色 / SI / OC / 用户扮演角色”，否则禁止写入 `player/`。
原作角色、原作主角、视觉小说可操控角色、故事 POV 角色、动画/游戏既有角色，默认全部属于 `characters/`。
例如：卫宫士郎、远坂凛、间桐樱等原作角色默认是 `characters/` 中的 NPC/角色，不是 `player/`。

`player/` 回答的问题是：

> 玩家是谁？有什么能力、资源、关系、目标？玩家已经造成了哪些世界状态变化？

### 需要抽取的信息

包括：

* 玩家角色姓名 / 代称
* 身份设定
* 玩家背景
* 能力体系
* 已知技能
* 装备与背包
* 当前状态
* 当前所在地
* 与主要角色的关系
* 当前目标
* 长期目标
* 玩家承诺过的事情
* 玩家造成的关键影响
* 玩家掌握但其他人不知道的信息
* 玩家不知道但角色知道的信息
* 玩家当前剧情权限
  例如是否能进入某地点、是否被某组织信任

### 不应放入的信息

不要把所有玩家发言完整复制进来。
玩家发言流水和每轮中间产物应放入 turn record、runtime journal 或 `.llm-wiki/runtime/`，这里只维护被剧情承认的状态和结果。

### 推荐页面粒度

第一版固定使用以下文件集合：

```text
player/player.md
player/abilities.md
player/inventory.md
player/goals.md
player/known_information.md
```

不允许由 import/runtime 在 `player/` 下自由新增或删除其他文件；额外子主题应合并进这些固定 slot。

---

## `locations/`

### 定义

存放地点、场景、区域、空间关系和地点状态。

`locations/` 回答的问题是：

> 这个地点在哪里？有什么结构？谁在这里？发生过什么？当前是否安全？

### 需要抽取的信息

包括：

* 地点名称
* 地点类型
  例如：城市、学校、住宅、房间、地下设施、异空间
* 所属区域
* 空间结构
* 相邻地点
* 可进入条件
* 常驻角色
* 重要物品
* 历史事件
* 当前状态
* 危险等级
* 氛围
* 隐藏信息
* 可触发剧情

### 不应放入的信息

不要在地点页记录完整剧情。
地点页只记录“这个地点因为事件发生了什么变化”。

### 推荐页面粒度

重要地点一个页面。大型地点可以拆子地点。

二次抽取要求：

* 在角色、事件、关系已经识别后，再回扫这些已识别内容，补抽其中反复出现或具有剧情作用的地点。
* 即使来源只提供名称和少量作用，也不要漏掉核心地点；允许先建立短条目，并标注“待补充”或“来源有限”。
* 不要为了补全地点页而臆造地理、历史或隐藏细节。

示例：

```text
locations/fuyuki_city.md
locations/emiya_house.md
locations/emiya_house_living_room.md
locations/school.md
locations/ryuudou_temple.md
```

---

## `factions/`

### 定义

存放组织、阵营、势力、团体及其关系。

`factions/` 回答的问题是：

> 这个世界有哪些势力？它们想要什么？彼此是什么关系？玩家和它们有什么关系？

### 需要抽取的信息

包括：

* 组织名称
* 组织类型
  例如：魔术协会、家族、军队、教会、黑帮、学院、秘密组织
* 核心目标
* 行动原则
* 重要成员
* 资源
* 影响范围
* 敌对势力
* 同盟势力
* 对玩家态度
* 当前行动
* 内部矛盾
* 与主线剧情的关系

### 不应放入的信息

不要把某个角色的全部个人信息放在阵营页。
阵营页只记录该角色作为组织成员时的身份和作用。

### 推荐页面粒度

每个主要组织一个页面。

二次抽取要求：

* 在角色、事件、关系已经识别后，再回扫这些已识别内容，补抽其中反复出现或具有剧情作用的家族、组织、阵营、学校、教会、魔术机构和隐秘势力。
* 即使来源只提供名称、立场或少量剧情作用，也不要漏掉核心组织；允许先建立短条目，并标注“待补充”或“来源有限”。
* 不要为了补全阵营页而臆造成员名单、历史、资源或议程细节。

示例：

```text
factions/mage_association.md
factions/holy_church.md
factions/tohsaka_family.md
```

---

## `items/`

### 定义

存放物品、装备、关键道具、消耗品、线索物、剧情道具。

`items/` 回答的问题是：

> 这个物品是什么？有什么能力？谁持有？对剧情有什么作用？

### 需要抽取的信息

包括：

* 物品名称
* 类型
  例如：武器、礼装、钥匙、文件、药剂、线索、遗物
* 外观
* 功能
* 使用条件
* 副作用
* 当前持有者
* 当前所在地
* 来源
* 历史归属
* 与角色 / 地点 / 事件的关联
* 是否为关键道具
* 是否已损坏、消耗、丢失
* 后续可触发剧情

### 不应放入的信息

不要把角色能力全部放入物品页。
如果物品只是能力的一部分，可以在角色页和物品页互相链接。

### 推荐页面粒度

重要物品单独建页，普通物品可以合并到背包页。

示例：

```text
items/azoth_sword.md
items/magic_gem.md
items/player_inventory.md
```

---

## `plot-arcs/`

### 定义

存放运行时剧情弧状态，包括支线、角色线、伏笔、冲突、悬念、压力、阻碍和待推进剧情。

`plot-arcs/` 回答的问题是：

> 当前故事结构里有哪些未解决问题？哪些矛盾、伏笔和压力需要推进？

这是 llmWikiRPG 中非常关键的目录，用于解决“跑了很多轮之后主线散掉”的问题。
但 `plot-arcs/` 不是作者/GM 侧完整大纲目录；主线大纲、章节安排、揭示顺序和未来剧情指导应放入 `outlines/`。

### 需要抽取的信息

包括：

* 剧情线名称
* 剧情线类型
  例如：主线、支线、角色线、感情线、调查线、战斗线、阴谋线
* 当前阶段
* 已发生节点
* 未解决问题
* 关键冲突
* 关键角色
* 关键地点
* 关键道具
* 伏笔
* 推进条件
* 可能的发展方向
* 不能违反的剧情约束
* 推荐的下一步推进方式

### 不应放入的信息

不要存放完整主线大纲、章节总纲、未来剧情蓝图或 GM 剧透笔记。
这类作者侧控制材料应进入 `outlines/`。
不要把已经发生的每一轮细节都塞进来。
已发生事件应进入 `events/`，`plot-arcs/` 只维护剧情结构和推进方向。
如果一个页面更像“某条路线”“剧情线”“完整经过”或跨很多天/多年的叙事结构，也应优先放入 `plot-arcs/`，而不是作为单一 event。

### 推荐页面粒度

每条重要剧情线一个页面。

示例：

```text
plot-arcs/main_arc.md
plot-arcs/caster_conflict.md
plot-arcs/rin_relationship_arc.md
plot-arcs/player_power_mystery.md
```

### 推荐结构

```md
# 剧情线名称

## 核心问题
这条剧情线最终要回答什么问题？

## 当前阶段
当前剧情推进到哪里。

## 已发生关键节点
- 节点 1
- 节点 2

## 未解决悬念
- 悬念 1
- 悬念 2

## 冲突结构
- 玩家 vs 敌人
- 角色 A vs 角色 B
- 角色内心冲突

## 后续推进建议
- 近期可以推进什么
- 中期可以爆发什么
- 暂时不要提前揭示什么
```

---

## `outlines/`

### 定义

存放作者/GM 侧剧情大纲、章节结构、揭示顺序、未来剧情指导、不可提前揭露的信息和长期节奏控制。

`outlines/` 回答的问题是：

> 这场战役原本打算如何展开？哪些内容应在什么节奏下揭示？玩家偏离后，大纲应该如何被审阅式修订？

`outlines/` 属于控制层，不是已发生事实层，也不是运行时状态层。它可以指导 `outline_brief`、`story_outline_regenerator` 和 narration handoff，但不能被当成已经发生的事件。

### 需要抽取的信息

包括：

* 主线大纲
* 章节 / 幕结构
* 关键揭示顺序
* 未来剧情指导
* 暂时不能揭露的真相
* 分支条件
* 必须保留的主题、冲突和长期张力
* 玩家偏离后可审阅的大纲修订提案

### 不应放入的信息

不要把每轮已经发生的事实写入 `outlines/`。
已发生事实进入 `events/`。
不要把普通未解决伏笔和运行时压力都塞进大纲。
运行时剧情弧状态进入 `plot-arcs/`。

### 推荐页面粒度

第一版推荐固定主线和进度入口：

```text
outlines/main.md
outlines/progress.md
```

后续可以按战役复杂度拆分：

```text
outlines/act_1.md
outlines/reveal_schedule.md
outlines/branch_conditions.md
```

### 推荐结构

```md
# 主线大纲

## Runtime Capsule
- 本轮 module-specific outline / narration handoff 最需要保留的大纲指导。

## Campaign Premise
- 战役核心前提。

## Act Structure
- 第一幕：
- 第二幕：
- 第三幕：

## Intended Reveals
- 应在何时揭示什么。

## Delayed Reveals
- 暂时不能提前揭示什么。

## Branch Conditions
- 什么玩家行动会改变后续路线。

## Must Not Contradict
- 后续修订也不能违反的长期约束。
```

`outlines/progress.md` 推荐记录：

```md
# 大纲进度

## Runtime Capsule
- 本轮 module-specific outline / narration handoff 最需要保留的当前进度。

## Current Stage
- 当前处于哪一幕 / 哪个章节 / 哪个 beat。

## Completed Beats
- 已完成、跳过、提前或延后的 beat。

## Divergence Notes
- 玩家路线相对主线大纲的偏离。

## Next Useful Beats
- 下一步最自然承接的 beat。
```

---

## `events/`

### 定义

存放已经发生的事件，按时间线记录。

`events/` 回答的问题是：

> 到目前为止，发生过什么？谁做了什么？造成了什么结果？

这是事实层，不能随便改写。

### 需要抽取的信息

包括：

* 事件时间
* 事件地点
* 参与角色
* 玩家行动
* NPC 行动
* 事件经过摘要
* 事件结果
* 造成的状态变化
* 新增信息
* 新增伏笔
* 影响到的角色关系
* 影响到的地点 / 物品 / 阵营
* 对主线的影响

每个离散 event 至少要能回答：

* 时间或相对时间锚点是什么
* 地点在哪里
* 参与者是谁
* 具体发生了什么
* 造成了什么后果 / 状态变化

### 不应放入的信息

不要在事件页中写未来剧情建议。
未来推进应放入 `plot-arcs/`、`outlines/` 控制层或 `.llm-wiki/runtime/` 的待审 runtime metadata；不能写成已发生事件。

以下内容不能作为单一 `events/` 页面：

* 标题含“路线”“剧情线”“时间线”“完整经过”
* 跨越很多天 / 很多年
* 包含 5 个以上相互独立的子事件
* 更像叙事结构、路线概览或剧情总览，而不是一次发生的事件

遇到上述情况时：

* 要么改放入 `plot-arcs/`
* 要么拆成多个 `events/` 文件

例如：

* “Heaven's Feel 路线”不应作为单一 event
* “樱被过继到间桐家”可以作为 discrete event
* “柳洞寺决战”可以作为 discrete event

### 推荐页面粒度

可以按“每轮一个事件”或“每个剧情段落一个事件”。
但前提仍然是：每个页面都应对应一次离散发生的事件，而不是整条路线或完整时间线。

第一版推荐：

```text
events/timeline.md
events/event_001.md
events/event_002.md
```

其中 `timeline.md` 维护总时间线，单独事件页维护详细摘要。

---

## `current-scene/`

### 定义

存放当前场景状态，是每一轮剧情生成最直接需要的上下文。

`current-scene/` 回答的问题是：

> 当前这一刻，玩家在哪里？谁在场？气氛如何？危险是什么？下一句应该接什么？

这是高频更新目录。

### 需要抽取的信息

包括：

* 当前时间
* 当前地点
* 当前场景
* 在场人物
* 每个人的位置
* 每个人的身体状态
* 每个人的情绪状态
* 当前正在发生的事情
* 玩家刚刚做了什么
* NPC 刚刚说了什么 / 做了什么
* 场景气氛
* 当前危险
* 可交互物品
* 可见线索
* 当前叙事焦点
* 下一轮生成时必须承接的内容
* active clocks / countdowns 摘要
* pending reactions
* pacing state

### 不应放入的信息

不要在这里保存长期世界观、完整人物设定、完整事件历史。
这里只保留“当前场景必需信息”。
普通文件输入（`setting_encyclopedia`、`plot_character_analysis`、`canon_narrative`、`dialogue_corpus`）默认不能生成 `current-scene/`。
普通 ingest 不生成、不更新 `wiki/current-scene/scene_state.md`，也不应把 `current-scene` 放入 `needed_categories`。
`current-scene` 是 RPG Play/Runtime apply 链路拥有的当前快照；只有 runtime 专用写回路径在用户接受 pending update 后可以覆盖该文件。
如果普通来源描述了某个正史场景、结局、回忆或团录片段，应按语义写入 `events/`、`plot-arcs/`、`locations/`、`characters/`、`relationships/`、`player/`、`world/` 或 `sources/`，不能当作 live current scene。

### 推荐页面粒度

第一版可以只用：

```text
current-scene/scene_state.md
```

旧文档中出现过拆成多个文件的构想，但当前第一版实现固定使用单一快照文件：

```text
current-scene/state.md
current-scene/participants.md
current-scene/immediate_context.md
```

这些路径目前不作为默认输出目标。

---

## `relationships/`

### 定义

存放角色之间的关系、情感张力、信任、冲突、依赖、误解和隐性矛盾。

`relationships/` 回答的问题是：

> 角色之间现在是什么关系？这种关系有什么张力？后续如何影响剧情？

### 需要抽取的信息

包括：

* 关系双方
* 关系类型
  例如：同盟、敌对、暧昧、师徒、主从、竞争、互相利用、保护、怀疑
* 当前信任程度
* 当前亲密程度
* 当前冲突点
* 已发生的关系变化
* 重要共同经历
* 未说出口的信息
* 误解
* 依赖关系
* 情感张力
* 后续可推进方向
* 禁止突变的关系约束
  例如：不能突然从陌生变成恋人，必须有过渡

### 不应放入的信息

不要重复角色完整设定。
角色页记录“这个角色是谁”，关系页记录“角色之间发生了什么关系变化”。

### 推荐页面粒度

重要关系一对一建页。

示例：

```text
relationships/player_rin.md
relationships/rin_shirou.md
relationships/player_saber.md
relationships/rin_caster.md
```

### 推荐结构

```md
# A 与 B 的关系

## 当前关系定位
一句话概括。

## 关系历史
- 第一次重要互动
- 关系变化节点

## 当前张力
- 信任：
- 冲突：
- 依赖：
- 误解：
- 未说出口的情绪：

## 后续推进限制
- 不能突然发生的变化。
- 需要铺垫的变化。

## 可推进方向
- 短期：
- 中期：
- 长期：
```

---

## `style/`

### 定义

存放文风、叙事口吻、输出格式、节奏控制、禁忌内容和角色扮演风格要求。

`style/` 回答的问题是：

> 模型应该用什么风格写？哪些写法要避免？剧情节奏应该如何控制？

### 需要抽取的信息

包括：

* 总体文风
* 叙事人称
* 语言风格
* 对话风格
* 描写重点
* 节奏要求
* 情绪基调
* 战斗描写风格
* 日常描写风格
* 感情线推进风格
* 禁止事项
* 不希望出现的模型坏习惯
* 输出格式要求
* 全局对白原则
* 原作风格参考

### 不应放入的信息

不要在这里放世界观事实和剧情事件。
`style/` 是“怎么写”，不是“写什么”。
不要把单个角色专属口癖、称呼习惯、礼貌等级或回避话题提升为全局 `style/`；这类信息应进入 `characters/*.md` 或 `relationships/*.md`。

### 推荐页面粒度

第一版固定包括：

```text
style/narration.md
style/dialogue.md
style/forbidden.md
```

---

## `rules/`

### 定义

存放世界规则、战斗规则、能力规则、魔术规则、行动判定规则等。

`rules/` 回答的问题是：

> 这个世界中什么能发生，什么不能发生？能力如何生效？战斗和行动如何判定？

### 需要抽取的信息

包括：

* 世界底层规则
* 能力体系规则
* 魔术 / 异能 / 科技规则
* 战斗规则
* 伤害与恢复规则
* 资源消耗规则
* 行动成功 / 失败条件
* 信息获取规则
* 隐蔽 / 潜入 / 侦查规则
* 角色能力限制
* 玩家能力限制
* 禁止破坏平衡的行为
* 模型不能随意改写的硬规则

### 与 `world/` 的区别

`world/` 记录“这个世界是什么样”。
`rules/` 记录“这个世界如何运作”。

例如：

* `world/`：魔术师隐藏在现代社会中。
* `rules/`：魔术需要魔力、术式、媒介，过度使用会造成身体负担。

### 推荐页面粒度

第一版固定包括：

```text
rules/core.md
rules/world.md
rules/table.md
```

更细的规则主题可以在固定文件内分节维护；玩家个人能力、技能、限制和当前可用性应进入 `player/abilities.md`，不拆到 `rules/`。

Action Resolver 读取 `rules/` 时，需要的是可执行裁判边界：行动成功/失败条件、资源代价、距离、时间、感知、隐蔽、战斗、调查、能力限制和硬约束。纯世界观解释应进入 `world/`，不要把规则页写成只有背景说明、却无法支持行动判定的资料页。

---

# 运行时中间产物边界

运行时短上下文、回合记录、pending update、outline revision proposal、skipped delta、校验结果和待审 runtime metadata 不属于普通 `wiki/` 抽取目录。它们应保存在 turn record、runtime journal 或 `.llm-wiki/runtime/` 下，作为可追溯、可审阅、可丢弃或可 apply 的运行时工作产物。

这些产物可以引用 `wiki/` 中的持久事实、当前快照、runtime overlay 和控制层进度，也可以在 review/apply 后生成对 `wiki/current-scene/scene_state.md`、`wiki/events/`、`wiki/player/`、`wiki/outlines/progress.md` 或各类 `wiki/*/runtime/` overlay 的更新；但它们本身不是 `wiki/runtime/` 页面，也不应被普通 ingest 当作推荐输出目标。

如果需要记录尚未解决的伏笔、悬念、待推进压力或未来修订，优先使用 `plot-arcs/`、`outlines/progress.md`、对应 runtime overlay 或 `.llm-wiki/runtime/` pending metadata，并保留 `HappenedStatus` / visibility / knowledge metadata；不要把这些内容写成 `events/` 里的既成事实。

---

# 第一版推荐的抽取优先级

为了先做出能跑的版本，不需要一开始把所有目录都做得很复杂。推荐优先级如下：

## 第一优先级：直接影响每轮生成

```text
current-scene/
characters/
player/
relationships/
outlines/
plot-arcs/
style/
rules/
```

这些决定“下一轮能不能接得住”。

## 第二优先级：长期一致性

```text
world/
locations/
items/
factions/
events/
```

这些决定“跑 100 轮以后会不会崩”。

## 第三优先级：证据追溯

```text
sources/
```

这些决定“以后能不能查清楚设定从哪里来”。

---

# 各目录之间的边界总结

```text
sources/           信息从哪里来
world/             世界是什么样
rules/             世界如何运作
characters/        NPC 是谁，现在怎样
player/            玩家是谁，现在怎样
locations/         地点是什么，现在怎样
factions/          势力是谁，彼此怎样
items/             物品是什么，谁持有
events/            已经发生了什么
outlines/          作者/GM 侧未来大纲和揭示节奏
plot-arcs/         剧情正在往哪里走
relationships/     角色关系如何变化
current-scene/     当前这一刻发生在什么状态下
style/             应该怎么写
```

---

# 最核心的一句话

这一版目录的本质是把 RPG 长上下文拆成三层：

```text
设定层：world / rules / characters / locations / factions / items / style
状态层：player / relationships / events / plot-arcs / current-scene
运行层：turn record / runtime journal / .llm-wiki/runtime/（非普通 wiki category）
```

第一版 llmWikiRPG 只要能做到：

```text
原始文本 → 抽取成 wiki → 根据玩家行动由各模块读取所需 wiki → 生成剧情 → 回写状态
```

就已经是一个可运行的最小闭环。

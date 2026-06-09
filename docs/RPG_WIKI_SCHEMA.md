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

本节冻结 RPG import / apply 的文档契约。后续实现可以把这些契约转成 code-readable schema helper，但本阶段只定义名称、语义边界、路径边界和写入策略，不改变运行时代码、ordinary ingest、UI 或测试。

### Import / Apply Mode

| mode | 语义 | 典型输入 | 允许目标路径 | 禁止路径 / 禁止行为 | 写入策略边界 |
|---|---|---|---|---|---|
| `source_ingest` | 普通来源资料导入；有损编译器，把来源材料压缩成 runtime-useful wiki 页面。 | 原作设定、角色分析、人物百科、剧情梗概、对白语料、世界书、网络资料。 | `wiki/sources/`、`wiki/world/`、`wiki/characters/`、`wiki/locations/`、`wiki/factions/`、`wiki/items/`、`wiki/plot-arcs/`、`wiki/events/`、`wiki/relationships/`；只有来源明确声明当前 PC 时，才可写固定 `wiki/player/*.md` slot。 | 不写 `wiki/current-scene/`；不写 `wiki/rules/`、`wiki/style/`、`wiki/memory/`、`wiki/outlines/main.md` 或 `wiki/outlines/progress.md`；不把未来大纲、可能发展或候选行动写入 `events`；不把原作主角默认写入 `player`；不写 legacy `entities`、`concepts`、`queries` 等旧目录。 | 走 ordinary ingest 的安全写入边界；对固定 player slot 只能在明确 PC 语义下合并，不新增、不删除任意 `wiki/player/*.md` 文件。 |
| `control_doc_import` | 控制文档导入；保真规范化器，保护用户显式控制语义。 | 主线大纲、章节安排、揭示顺序、跑团规则、世界规则、桌规、文风要求、禁用词、hard gate、玩家偏好、长期提示、会话笔记。 | 固定控制 slot：`wiki/outlines/main.md`、`wiki/outlines/progress.md`、`wiki/rules/core.md`、`wiki/rules/world.md`、`wiki/rules/table.md`、`wiki/style/narration.md`、`wiki/style/dialogue.md`、`wiki/style/forbidden.md`、`wiki/memory/long-term.md`、`wiki/memory/session-notes.md`、`wiki/memory/player-preferences.md`；可另存 `wiki/sources/imports/<source>.md` 作为 raw source anchor。 | 不写 `wiki/current-scene/`；不写 `events`；不把 `Possible Futures` 或未来 reveal 当作已发生事实；不丢弃 `{{setvar::...}}`、禁用词、hard gate 或用户显式控制块；不把规则、文风、偏好当作剧情状态。 | 默认 `manual_or_review_only`；只做结构化、frontmatter、section 规范化、wikilink enrichment 和必要 runtime-facing section 补齐。 |
| `campaign_setup_import` | 战役初始化导入；开局状态 bootstrap，把 PC、序章事实、初始目标、初始关系和当前场景分层落位。 | 玩家角色设定、初始能力、背包、已知信息、开局目标、初始关系、已发生序章、游戏开始时当前场景、开局地点和在场人物。 | 固定 player slot、`wiki/current-scene/scene_state.md`、`wiki/events/prologue.md`、`wiki/quests/*.md`、`wiki/relationships/*.md`、`wiki/outlines/main.md`、`wiki/outlines/progress.md`、`wiki/plot-arcs/*.md`、`wiki/locations/runtime/*.md`、`wiki/items/runtime/*.md`。 | 不把开场场景混入 `source_ingest`；不把未来剧情写入 `events`；不把玩家能力拆入 `rules/`；不把 NPC 当前状态写入 base `characters/*.md`；不新增或删除任意 player 文件。 | `current-scene` 显式 bootstrap/overwrite；固定 player slot merge；序章事件 append/create；大纲和规则类内容仍按 review/manual 边界处理。 |
| `runtime_update_apply` | 游玩中状态写回；runtime apply，不是文件导入，只应用已确认发生的回合结果。 | 已完成 RPG 回合记录、玩家已提交行动、已生成正文、已确认 references、accepted pending updates。 | `wiki/current-scene/scene_state.md`、`wiki/events/*.md`、固定 `wiki/player/*.md`、`wiki/quests/*.md`、`wiki/outlines/progress.md`、`wiki/relationships/runtime/*.md`、`wiki/plot-arcs/runtime/*.md`、`wiki/characters/runtime/*.md`、`wiki/locations/runtime/*.md`、`wiki/factions/runtime/*.md`、`wiki/items/runtime/*.md`。 | 不写 `wiki/sources/`、`wiki/world/`、`wiki/rules/`、`wiki/style/`、`wiki/memory/`、`wiki/outlines/main.md`、base `characters/locations/factions/items`、base `relationships/*.md`、base `plot-arcs/*.md` 或 legacy 目录；不写候选行动、未选择选项、未来可能和未确认推测。 | 只能通过 pending/review/apply 边界；`current-scene` overwrite；`events` append/create；player、quests、outline progress 和 runtime overlays merge。 |

### 固定 Schema Slots

这些 slot 是全新 `llmWikiRPG` 项目的固定入口文件，也是后续 Context Compiler 读取优先级和 import target policy 的基础。缺失固定 slot 表示新项目结构不完整，应产生 warning 或可修复结构提示；这不是旧项目迁移、legacy fallback 或旧路径保留场景。

| slotId | path | owner | requiredForNewProject | runtimePriority | importPolicy | writePolicy |
|---|---|---|---|---|---|---|
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

Context Compiler 读取时先读 base，再叠加 runtime overlay，得到当前战役视角。overlay 是分层读取/组织模型；merge 是更新单个目标文件的写入策略。`runtime_update_apply` 不直接改写 base `relationships/*.md` 或 base `plot-arcs/*.md`，关系和剧情弧的运行时变化写入对应 `runtime/` overlay。

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

按照世界观主题拆分，而不是所有内容塞进一个大文件。

示例：

```text
world/basic_overview.md
world/history.md
world/common_sense.md
world/supernatural_presence.md
world/social_structure.md
```

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
玩家发言流水应放入 `runtime/turn_log.md`，这里只维护被剧情承认的状态和结果。

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

`outlines/` 属于控制层，不是已发生事实层，也不是运行时状态层。它可以指导 Context Compiler 和 narration，但不能被当成已经发生的事件。

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
- 本轮上下文编译时最需要保留的大纲指导。

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
- 本轮上下文编译时最需要保留的当前进度。

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
未来推进应放入 `plot-arcs/` 或 `runtime/unresolved_threads.md`。

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

---

# `runtime/`

`runtime/` 不是从原始设定中抽取出的稳定 wiki，而是每轮游戏运行时生成和更新的工作区。

它的作用是：

> 把庞大的 wiki 压缩成当前这一轮模型真正需要的短上下文。

---

## `runtime/context_pack.md`

### 定义

每轮生成前编译出的短上下文包。

它是给最终剧情生成模型看的，不是长期设定源。

### 需要包含的信息

包括：

* 当前场景摘要
* 玩家当前行动
* 必须承接的上一轮内容
* 当前在场角色状态
* 与当前场景相关的角色关系
* 与当前场景相关的世界规则
* 与当前场景相关的地点信息
* 与当前剧情线相关的伏笔
* 本轮叙事目标
* 本轮禁止事项
* 文风要求
* 输出格式要求

### 不应包含的信息

不要塞入完整 wiki。
不要把所有角色、所有世界观、所有历史事件都放进来。

`context_pack.md` 的目标是短、准、可控。

### 推荐结构

```md
# Runtime Context Pack

## 当前场景
...

## 玩家行动
...

## 必须承接
...

## 相关角色状态
...

## 相关关系张力
...

## 相关规则
...

## 当前剧情目标
...

## 本轮写作要求
...

## 禁止事项
...
```

---

## `runtime/turn_log.md`

### 定义

记录玩家行动和模型输出的原始运行日志。

它是后续更新 `events/`、`characters/`、`relationships/`、`current-scene/` 的依据。

### 需要记录的信息

包括：

* 回合编号
* 玩家输入
* 模型输出
* 本轮使用的 context pack 摘要
* 本轮发生的事实变化
* 本轮需要写入 wiki 的更新项
* 本轮是否产生矛盾
* 本轮是否产生新伏笔

### 不应作为最终上下文直接长期输入

`turn_log.md` 会越来越长，不能每次全部塞给模型。
它主要用于追溯和二次整理。

---

## `runtime/unresolved_threads.md`

### 定义

记录尚未解决的伏笔、悬念、目标、冲突和待推进事项。

它是防止剧情散掉的重要文件。

### 需要记录的信息

包括：

* 未解决伏笔
* 玩家未完成目标
* NPC 未完成目标
* 尚未揭示的信息
* 尚未处理的后果
* 需要回收的道具
* 需要再次登场的角色
* 需要推进的关系变化
* 当前最适合推进的剧情点
* 暂时不应推进的剧情点

### 与 `plot-arcs/` 的区别

`plot-arcs/` 是结构化剧情线。
`unresolved_threads.md` 是运行时待办清单。

例如：

```md
## 未解决伏笔
- Caster 的真实身份尚未完全确认。
- 玩家能力的来源尚未解释。
- 远坂凛对玩家的信任正在上升，但仍未完全放下戒备。

## 近期应推进
- 让玩家发现 Caster 与柳洞寺之间的联系。
- 让远坂凛通过一次小事件表达对玩家的认可。

## 暂时不要推进
- 不要过早揭示最终敌人的完整计划。
```

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
runtime/context_pack.md
```

这些决定“下一轮能不能接得住”。

## 第二优先级：长期一致性

```text
world/
locations/
items/
factions/
events/
runtime/unresolved_threads.md
```

这些决定“跑 100 轮以后会不会崩”。

## 第三优先级：证据追溯

```text
sources/
runtime/turn_log.md
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
runtime/           每轮运行时临时编译和记录
```

---

# 最核心的一句话

这一版目录的本质是把 RPG 长上下文拆成三层：

```text
设定层：world / rules / characters / locations / factions / items / style
状态层：player / relationships / events / plot-arcs / current-scene
运行层：runtime/context_pack.md / turn_log.md / unresolved_threads.md
```

第一版 llmWikiRPG 只要能做到：

```text
原始文本 → 抽取成 wiki → 根据玩家行动检索相关 wiki → 编译 context_pack → 生成剧情 → 回写状态
```

就已经是一个可运行的最小闭环。

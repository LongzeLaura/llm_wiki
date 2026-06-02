
# llmWikiRPG 分阶段实施计划 v0.1

## 目标

当前项目已经完成：

- `docs/LLMWIKIRPG_ARCHITECTURE_PLAN.md`：对 llm_wiki 架构、抽取流程、分类系统、保存逻辑、前端展示逻辑的调查。
- `docs/RPG_WIKI_SCHEMA.md`：llmWikiRPG Wiki 目录抽取定义 v0.1。

本阶段目标是：  
在尽量保持原 llm_wiki 框架稳定的前提下，逐步修改 llm_wiki，使其可以按照 `RPG_WIKI_SCHEMA.md` 定义的 RPG Wiki 目录结构抽取、保存、更新和展示信息。

核心思想是：

> 不一次性重写 llm_wiki，而是参考 llm_wiki_chemical 的改造路线，先定位原分类系统，再引入 RPG category registry，最后逐步修改 prompt、保存结构、前端展示和测试流程。

---

## 总体阶段表

| 阶段 | Codex / IDE Agent 任务 | 是否改代码 | 目标 |
| -- | -- | -- | -- |
| 0 | 阅读现有架构文档，确认当前基线 | 否 | 确认已有文档和代码现状，不重复做架构调查 |
| 1 | 定位原 llm_wiki 分类、抽取、保存、展示链路 | 否 | 找到 entities/concepts/sources 等旧分类系统的所有关键入口 |
| 2 | 对照 RPG_WIKI_SCHEMA.md，设计 RPG 分类映射文档 | 否 | 明确 RPG 目录与原分类系统的映射关系 |
| 3 | 设计并接入 RPG category registry | 少量 | 让系统能够识别 RPG 专用目录 |
| 4 | 接入 RPG wiki schema 配置 | 少量 | 将 world/characters/player/events 等目录纳入抽取目标 |
| 5 | 修改 RPG 抽取 prompt | 中等 | 让 LLM 按 RPG 目录语义抽取信息 |
| 6 | 修改保存数据结构与文件写入逻辑 | 中等 | 让抽取结果保存到 RPG Wiki 目录 |
| 7 | 增加动态状态更新逻辑 | 中等 | 支持 current-scene、events、relationships、player 等动态信息更新 |
| 8 | 修改前端 Wiki 展示与查询页 | 中等 | 让前端能浏览 RPG Wiki 目录 |
| 9 | 保留兼容层与旧分类回退逻辑 | 少量 | 避免破坏原 llm_wiki 功能 |
| 10 | 使用 RPG 样例文本做 smoke test | 少量 | 验证能抽取出符合 schema 的 wiki |
| 11 | 评估抽取质量并修正 prompt/schema | 少量 | 检查目录错分、字段缺失、动态状态污染等问题 |
| 12 | 清理命名、文档和开发日志 | 少量 | 形成稳定的 llmWikiRPG 第一版实现 |

---

## 阶段 0：阅读现有架构文档，确认当前基线

### 目标

确认当前项目已经完成的前置工作，不重复进行大规模架构调查。

### 输入文档

- `docs/LLMWIKIRPG_ARCHITECTURE_PLAN.md`
- `docs/RPG_WIKI_SCHEMA.md`
- 如存在：
  - `AGENTS.md`
  - `IMPLEMENTATION_LOG.md`
  - `docs/EXTRACTION_PIPELINE_MAP.md`
  - `docs/CATEGORY_SYSTEM_ANALYSIS.md`

### 任务

1. 阅读 `docs/LLMWIKIRPG_ARCHITECTURE_PLAN.md`。
2. 阅读 `docs/RPG_WIKI_SCHEMA.md`。
3. 确认当前项目的抽取链路、分类系统、文件保存逻辑、前端展示逻辑。
4. 在开发日志中记录当前基线状态。

### 是否改代码

否。

### 产物

- 更新 `IMPLEMENTATION_LOG.md`
- 不修改业务代码

---

## 阶段 1：定位原 llm_wiki 分类、抽取、保存、展示链路

### 目标

准确找到原 llm_wiki 中旧分类系统的全部关键位置，为后续替换/扩展做准备。

### 重点关注

原 llm_wiki 可能包含以下核心目录：

```txt
wiki/entities/
wiki/concepts/
wiki/sources/
wiki/queries/
wiki/comparisons/
wiki/synthesis/
wiki/findings/
wiki/methodology/
wiki/thesis/
wiki/index.md
wiki/log.md
wiki/overview.md
````

需要定位这些分类在代码中的使用位置。

### 任务

1. 搜索 `entities`、`concepts`、`sources`、`comparisons` 等关键词。
2. 找到分类定义位置。
3. 找到抽取 prompt 构造位置。
4. 找到 LLM 输出解析位置。
5. 找到 wiki 文件写入位置。
6. 找到前端读取 wiki 文件夹的位置。
7. 找到查询页/agent 页面使用 wiki 内容的位置。

### 是否改代码

否。

### 产物

建议生成或更新：

```txt
docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md
```

内容包括：

* 原分类系统定义位置
* 原抽取 prompt 位置
* 原保存逻辑位置
* 原前端展示逻辑位置
* 后续需要修改的文件列表

---

## 阶段 2：对照 RPG_WIKI_SCHEMA.md，设计 RPG 分类映射文档

### 目标

将 `RPG_WIKI_SCHEMA.md` 中定义的 RPG Wiki 目录映射到原 llm_wiki 分类系统，明确哪些是替代旧核心，哪些是新增动态目录，哪些是辅助目录。

### RPG Wiki 第一版目录

```txt
wiki/
  sources/
  world/
  characters/
  player/
  locations/
  factions/
  items/
  plot-arcs/
  events/
  current-scene/
  relationships/
```

### 任务

1. 阅读 `docs/RPG_WIKI_SCHEMA.md`。
2. 分析每个目录的性质：

   * 静态设定类
   * 动态状态类
   * 时间线事件类
   * 关系网络类
   * 当前场景类
   * 来源追踪类
3. 设计与原分类系统的关系：

   * 是否保留 `sources`
   * 是否废弃或隐藏 `entities/concepts`
   * 是否将 `characters/items/locations/factions` 视为 RPG 版 entities
   * 是否将 `world/plot-arcs/relationships` 视为 RPG 版 concepts/synthesis
4. 明确第一版不做的事情，避免过度设计。

### 是否改代码

否。

### 产物

建议生成：

```txt
docs/RPG_CATEGORY_MAPPING.md
```

建议内容：

```md
# RPG 分类映射设计

## 旧 llm_wiki 分类

- entities
- concepts
- sources
- comparisons
- synthesis
- findings
- methodology
- thesis

## RPG 新核心分类

- world
- characters
- player
- locations
- factions
- items
- plot-arcs
- events
- current-scene
- relationships

## 映射关系

| 原分类 | RPG 对应目录 | 说明 |
| -- | -- | -- |
| sources | sources | 保留，用于记录原始设定、角色卡、导入文本来源 |
| entities | characters / locations / factions / items | 拆分为 RPG 具体实体类型 |
| concepts | world / plot-arcs / relationships | 拆分为世界规则、剧情结构、关系结构 |
| synthesis | plot-arcs / current-scene | 可作为剧情综合和当前状态压缩来源 |
| findings | events | 可转化为已发生事件记录 |
| methodology | 暂不使用 | RPG 第一版不需要 |
| thesis | 暂不使用 | RPG 第一版不需要 |
```

---

## 阶段 3：设计并接入 RPG category registry

### 目标

建立一个统一的 RPG 分类注册表，让系统不再把分类硬编码在 prompt、保存逻辑和前端中。

### 任务

1. 找到原项目中分类列表的定义方式。
2. 新增 RPG category registry。
3. 每个 RPG category 至少包含：

   * category id
   * 显示名称
   * 目录路径
   * 描述
   * 是否动态更新
   * 是否允许多文件
   * 是否需要来源引用
4. 暂时不大改抽取逻辑，只让系统能识别这些分类。

### 是否改代码

少量。

### 建议 category registry 结构

```ts
{
  id: "characters",
  label: "Characters",
  path: "wiki/characters",
  description: "角色静态设定与动态状态",
  dynamic: true,
  multipleFiles: true,
  requireSource: true
}
```

### RPG 分类建议

| id            | path                  | 类型     | 说明              |
| ------------- | --------------------- | ------ | --------------- |
| sources       | `wiki/sources/`       | 来源类    | 原始设定、导入文本、角色卡来源 |
| world         | `wiki/world/`         | 静态/半静态 | 世界观、规则、历史、常识    |
| characters    | `wiki/characters/`    | 静态+动态  | NPC 与重要角色       |
| player        | `wiki/player/`        | 动态     | 玩家角色状态、能力、目标、背包 |
| locations     | `wiki/locations/`     | 静态+动态  | 地点、场景、空间关系      |
| factions      | `wiki/factions/`      | 静态+动态  | 组织、阵营、势力关系      |
| items         | `wiki/items/`         | 静态+动态  | 物品、装备、关键道具      |
| plot-arcs     | `wiki/plot-arcs/`     | 剧情结构   | 主线、支线、伏笔、冲突     |
| events        | `wiki/events/`        | 时间线    | 已发生事件           |
| current-scene | `wiki/current-scene/` | 强动态    | 当前场景状态          |
| relationships | `wiki/relationships/` | 动态关系   | 角色关系、情感张力、敌友变化  |

### 产物

* 新增或修改 category registry 代码
* 更新 `IMPLEMENTATION_LOG.md`
* 记录所有被修改文件

---

## 阶段 4：接入 RPG wiki schema 配置

### 目标

让代码能够读取或内置 `RPG_WIKI_SCHEMA.md` 中的目录定义，并在抽取时知道每个目录应该抽取什么。

### 任务

1. 将 `RPG_WIKI_SCHEMA.md` 中的目录定义转化为代码可用结构。
2. 不要求第一版自动解析 Markdown，可以先手动转成配置文件。
3. 每个目录配置应包括：

   * 目录名
   * 抽取目标
   * 字段定义
   * 不应抽取的内容
   * 更新策略
4. 确保 schema 与 category registry 不重复冲突。

### 是否改代码

少量。

### 建议新增文件

可能是以下之一：

```txt
src/config/rpgWikiSchema.ts
src/config/rpgCategories.ts
src/lib/wiki/rpgSchema.ts
```

具体路径以原项目结构为准。

### 产物

* RPG schema 配置代码
* RPG category registry 与 schema 关联
* 更新开发日志

---

## 阶段 5：修改 RPG 抽取 prompt

### 目标

让 LLM 不再只抽取普通知识库中的 entities/concepts，而是按照 RPG Wiki 目录抽取信息。

### 任务

1. 找到原抽取 prompt。
2. 保留原有稳定结构。
3. 替换或扩展分类说明。
4. 将 RPG 目录说明加入 prompt。
5. 明确要求 LLM 输出结构化结果。
6. 要求 LLM 区分：

   * 明确事实
   * 推测内容
   * 当前状态
   * 历史事件
   * 角色设定
   * 角色关系
   * 玩家状态
   * 剧情伏笔
7. 要求 LLM 不要把同一信息重复写入多个目录，除非确实有必要。

### 是否改代码

中等。

### Prompt 重点要求

抽取时必须区分：

```txt
1. world：长期稳定的世界规则
2. characters：角色设定与角色当前状态
3. player：玩家角色相关信息
4. locations：地点和空间关系
5. factions：组织和势力
6. items：物品、装备、关键道具
7. plot-arcs：主线、支线、伏笔、冲突
8. events：已经发生的事件，按时间线记录
9. current-scene：当前场景状态，只保留最新状态
10. relationships：角色之间的关系、情感张力、敌友状态
11. sources：原始来源摘要
```

### 特别注意

RPG Wiki 与普通知识库不同，存在强动态信息。

因此 prompt 必须说明：

* `current-scene` 只能记录当前场景，不要累计历史。
* `events` 记录已经发生的事情，不要写未发生计划。
* `plot-arcs` 记录剧情结构、伏笔、冲突和可能的发展方向。
* `characters` 可以记录角色长期设定和重要状态，但不要把所有短期动作都写入角色设定。
* `relationships` 记录关系变化，而不是简单重复角色介绍。
* `player` 只记录玩家角色相关信息，不要混入普通 NPC。

### 产物

* 修改后的 RPG 抽取 prompt
* 必要时新增 prompt 测试样例
* 更新开发日志

---

## 阶段 6：修改保存数据结构与文件写入逻辑

### 目标

让抽取结果真正保存到 RPG Wiki 目录，而不是仍然写入旧的 entities/concepts。

### 任务

1. 找到原文件保存逻辑。
2. 支持写入以下目录：

```txt
wiki/sources/
wiki/world/
wiki/characters/
wiki/player/
wiki/locations/
wiki/factions/
wiki/items/
wiki/plot-arcs/
wiki/events/
wiki/current-scene/
wiki/relationships/
```

3. 设计每类目录的保存方式：

   * 单文件
   * 多文件
   * 按实体名建文件
   * 按事件时间建文件
   * 覆盖式更新
   * 追加式更新
4. 处理文件名安全化。
5. 处理重复条目合并。
6. 保留来源信息。

### 是否改代码

中等。

### 建议保存策略

| 目录            | 保存方式        | 更新方式  |
| ------------- | ----------- | ----- |
| sources       | 多文件         | 追加    |
| world         | 多文件或主题文件    | 合并更新  |
| characters    | 每个角色一个文件    | 合并更新  |
| player        | 一个或少量文件     | 合并更新  |
| locations     | 每个地点一个文件    | 合并更新  |
| factions      | 每个组织一个文件    | 合并更新  |
| items         | 每个重要物品一个文件  | 合并更新  |
| plot-arcs     | 每条主线/支线一个文件 | 合并更新  |
| events        | 按时间线追加      | 追加为主  |
| current-scene | 单文件         | 覆盖式更新 |
| relationships | 按角色对或关系组建文件 | 合并更新  |

### 关键原则

`current-scene` 必须特殊处理：

```txt
current-scene 不是历史记录，而是当前状态快照。
每次新剧情推进后，应覆盖或重写 current-scene，而不是无限追加。
```

`events` 必须特殊处理：

```txt
events 是历史时间线。
已经发生的重要事件应追加，不应被 current-scene 覆盖。
```

### 产物

* RPG Wiki 文件写入逻辑
* 文件命名规则
* 合并/追加/覆盖策略
* 更新开发日志

---

## 阶段 7：增加动态状态更新逻辑

### 目标

支持 RPG 场景中最关键的动态信息维护，包括当前场景、玩家状态、关系变化和事件时间线。

### 为什么需要单独一阶段

llm_wiki_chemical 主要处理论文知识，知识相对静态。
llmWikiRPG 处理的是互动剧情，信息会不断变化。

所以 RPG 版不能只做“一次性抽取”，还需要处理：

* 当前场景变化
* 玩家状态变化
* NPC 状态变化
* 关系变化
* 事件追加
* 伏笔推进
* 已过期状态清理

### 任务

1. 设计动态目录的更新策略。
2. 明确哪些目录可以追加，哪些目录必须覆盖。
3. 给 prompt 增加动态更新约束。
4. 给保存逻辑增加不同 update mode。
5. 避免旧状态污染新状态。
6. 记录一次剧情推进后各目录如何变化。

### 是否改代码

中等。

### 动态目录分类

| 目录            | 动态程度 | 更新策略 |
| ------------- | ---- | ---- |
| current-scene | 极高   | 覆盖   |
| player        | 高    | 合并更新 |
| characters    | 中高   | 合并更新 |
| relationships | 高    | 合并更新 |
| events        | 高    | 追加   |
| plot-arcs     | 中高   | 合并更新 |
| locations     | 中    | 合并更新 |
| factions      | 中    | 合并更新 |
| items         | 中    | 合并更新 |
| world         | 低    | 谨慎更新 |
| sources       | 低    | 追加   |

### 产物

* 动态更新策略文档
* 必要代码修改
* 更新开发日志

建议新增文档：

```txt
docs/RPG_DYNAMIC_UPDATE_STRATEGY.md
```

---

## 阶段 8：修改前端 Wiki 展示与查询页

### 目标

让前端能够正确展示 RPG Wiki 目录，而不是仍然以普通知识库的 entities/concepts 为中心。

### 任务

1. 找到前端 Wiki 目录展示组件。
2. 将 RPG 目录加入导航。
3. 隐藏或降级旧目录。
4. 为动态目录增加更清晰的显示方式。
5. 查询页/agent 页面检索 wiki 时，应能检索 RPG 新目录。
6. 确保点击文件、查看内容、搜索内容仍然正常。

### 是否改代码

中等。

### 前端展示建议

第一版不需要做复杂 UI，只需要做到：

```txt
RPG Wiki
├── Sources
├── World
├── Characters
├── Player
├── Locations
├── Factions
├── Items
├── Plot Arcs
├── Events
├── Current Scene
└── Relationships
```

### 特别建议

`current-scene` 可以在前端中放在较醒目的位置，因为它会成为 RPG 运行时最重要的上下文摘要。

`events` 可以按时间线展示，但第一版可以先用 Markdown 文件列表实现，不必立即开发复杂时间轴组件。

### 产物

* 前端导航更新
* 查询页检索范围更新
* 更新开发日志

---

## 阶段 9：保留兼容层与旧分类回退逻辑

### 目标

避免 RPG 改造破坏原 llm_wiki 的基本功能。

### 任务

1. 检查原有 entities/concepts/sources 是否仍被硬编码依赖。
2. 如果旧功能仍需要，保留 legacy mode。
3. 如果当前项目只做 RPG 版，也不要直接删除旧代码，优先通过配置切换。
4. 增加一个 wiki mode 概念：

```txt
wikiMode = "default" | "rpg"
```

5. 在 RPG 模式下使用 RPG categories。
6. 在 default 模式下保留原分类。

### 是否改代码

少量。

### 产物

* 简单模式切换机制
* 或至少保留旧逻辑不被破坏
* 更新开发日志

---

## 阶段 10：使用 RPG 样例文本做 smoke test

### 目标

用少量 RPG 文本验证完整链路是否能跑通。

### 测试输入建议

准备 3 类样例文本：

1. 世界观设定文本

```txt
包含世界规则、历史、势力、地点。
```

2. 角色卡文本

```txt
包含角色姓名、身份、性格、能力、关系、当前目标。
```

3. 剧情推进文本

```txt
包含玩家行动、NPC 反应、事件发生、当前场景变化、关系变化。
```

### 测试目标

验证能否生成：

```txt
wiki/world/
wiki/characters/
wiki/player/
wiki/locations/
wiki/factions/
wiki/items/
wiki/plot-arcs/
wiki/events/
wiki/current-scene/
wiki/relationships/
wiki/sources/
```

### 是否改代码

少量。

### 检查清单

* [ ] 是否生成了 RPG 目录？
* [ ] 是否没有错误写回旧 entities/concepts？
* [ ] 角色是否进入 characters？
* [ ] 玩家状态是否进入 player？
* [ ] 已发生事件是否进入 events？
* [ ] 当前场景是否进入 current-scene？
* [ ] 关系变化是否进入 relationships？
* [ ] 世界规则是否进入 world？
* [ ] 地点是否进入 locations？
* [ ] 组织是否进入 factions？
* [ ] 物品是否进入 items？
* [ ] 剧情伏笔是否进入 plot-arcs？
* [ ] 来源信息是否进入 sources？

### 产物

建议生成：

```txt
docs/RPG_SMOKE_TEST_REPORT.md
```

---

## 阶段 11：评估抽取质量并修正 prompt/schema

### 目标

根据 smoke test 结果，修正抽取 prompt、schema 和保存策略。

### 常见问题

1. 角色信息被错误写入 world。
2. 当前场景被追加成历史记录。
3. events 中混入未发生剧情。
4. plot-arcs 变成普通事件摘要。
5. relationships 只重复角色介绍，没有记录关系张力。
6. player 和 characters 混淆。
7. sources 缺少来源摘要。
8. 太多目录都写入同一条信息。
9. 文件粒度过碎。
10. 文件粒度过粗。

### 任务

1. 阅读 smoke test 输出的 wiki 文件。
2. 对照 `RPG_WIKI_SCHEMA.md` 检查。
3. 标记错分案例。
4. 修改 prompt。
5. 必要时微调 schema 配置。
6. 再运行一次 smoke test。

### 是否改代码

少量。

### 产物

建议生成：

```txt
docs/RPG_EXTRACTION_EVALUATION.md
```

内容包括：

* 测试输入
* 实际输出
* 错分案例
* prompt 修正点
* schema 修正点
* 下一轮测试结果

---

## 阶段 12：清理命名、文档和开发日志

### 目标

让 llmWikiRPG 第一版实现达到可以继续迭代的状态。

### 任务

1. 清理临时变量名。
2. 清理调试日志。
3. 统一 RPG category 命名。
4. 更新 README 或新增 RPG 使用说明。
5. 更新开发日志。
6. 记录当前已完成能力和未完成能力。
7. 明确下一阶段方向。

### 是否改代码

少量。

### 建议产物

```txt
docs/LLMWIKIRPG_USAGE.md
docs/LLMWIKIRPG_IMPLEMENTATION_SUMMARY.md
IMPLEMENTATION_LOG.md
```

### 第一版完成标准

第一版不要求成为完整 RPG Agent。
第一版只要求做到：

```txt
给定 RPG 设定文本、角色卡文本、剧情文本，
llmWikiRPG 能够按照 RPG_WIKI_SCHEMA.md
抽取并维护结构化 RPG Wiki。
```

# RPG Import Modularization Plan

## 目标

当前普通文件 ingest 已经围绕 RPG runtime utility、Runtime Capsule、路径感知 merge、section-aware merge 和语义 lint 做了大量优化，但它仍然只适合处理“来源资料”。如果继续把玩家设定、开场场景、主线大纲、规则材料、文风要求和运行时回合写回都塞进同一条 ingest 流程，会导致几个问题：

- 大纲、规则、文风这类高优先级控制材料被当成普通来源资料有损改写。
- 初始当前场景需要写入 `wiki/current-scene/scene_state.md`，但普通 ingest 已经明确禁止写 `current-scene`。
- 玩家设定既可能是 PC 档案，也可能包含能力/技能、初始物品、已知信息和开局目标，单靠普通目录分类容易丢失初始化语义。
- 运行时回合写回本质是已完成行动后的状态应用，不应再被称为文件导入。
- `src/lib/rpg-interactions/` 已经开始把 runtime update、narration 等 LLM 交互模块化，但普通 ingest 和后续导入模式还没有统一的交互/导入框架。

本方案的目标是建立一个 RPG Import Framework：底层共享导入模式注册、目标路径策略、验证、review/pending/write 边界；上层保留四类不同 import mode 的语义，不把所有内容压成一种 ingest。

## 术语边界

后续建议避免把所有入口都叫 ingest。

```text
Source Ingest
  普通来源资料导入。它是有损编译器。

Control Doc Import
  控制文档导入。它是保真规范化器。

Campaign Setup Import
  战役初始化导入。它是开局状态 bootstrap。

Runtime Update Apply
  游玩中状态写回。它是 runtime apply，不是文件导入。
```

UI 可以统一叫“导入到 RPG 项目”，但代码层应明确区分 mode。

## 四类导入 / 写回模式

### 1. Source Ingest

适用输入：

- 原作设定
- 角色分析
- 人物百科
- 剧情梗概
- 对白语料
- 世界书
- 网络资料
- 其他来源材料

目标：

- 从来源中筛出 RPG runtime-useful signals。
- 有损编译成短、准、可运行的 wiki 页面。
- 保留来源证据层，避免把低价值百科噪声塞入 runtime-facing 页面。

典型目标路径：

```text
wiki/sources/
wiki/world/
wiki/characters/
wiki/locations/
wiki/factions/
wiki/items/
wiki/plot-arcs/
wiki/events/
wiki/relationships/
wiki/player/          // 仅当来源明确声明当前 PC
```

禁止：

- 不写 `wiki/current-scene/`。
- 不把未来大纲写成 `events`。
- 不把原作主角或 POV 角色默认写入 `player`。
- 不改写 `style`、`rules`、`memory` 等用户控制文件。

当前状态：

- 现有普通 RPG ingest 基本属于这一类。
- 后续模块化时应先把它包装成 `source_ingest` spec，而不是立即重写。

### 2. Control Doc Import

适用输入：

- 文风要求
- 对话风格
- 禁用词 / 禁用句式 / hard gate
- 跑团规则
- 世界规则
- 桌规 / 安全边界 / 玩家偏好
- 主线大纲 / 未来剧情指导
- Context Compiler 长期提示、玩家偏好或待整理会话笔记

目标：

- 尽量保留原始含义，不做普通来源抽取。
- 只做结构化、frontmatter、section 规范化、wikilink enrichment 和必要的 runtime section 补齐。
- 同时保存 raw source / source anchor，便于追溯导入前原文。

典型目标路径：

```text
wiki/outlines/main.md
wiki/outlines/progress.md
wiki/rules/core.md
wiki/rules/world.md
wiki/rules/table.md
wiki/style/narration.md
wiki/style/dialogue.md
wiki/style/forbidden.md
wiki/memory/long-term.md
wiki/memory/session-notes.md
wiki/memory/player-preferences.md
wiki/sources/imports/<source>.md
```

推荐固定入口文件：

```text
wiki/outlines/main.md
wiki/outlines/progress.md
wiki/rules/core.md
wiki/rules/world.md
wiki/rules/table.md
wiki/style/narration.md
wiki/style/dialogue.md
wiki/style/forbidden.md
wiki/memory/long-term.md
wiki/memory/session-notes.md
wiki/memory/player-preferences.md
```

禁止：

- 不写 `current-scene`。
- 不把 `Possible Futures` 写成已发生事件。
- 不丢弃 `{{setvar::...}}`、禁用词、hard gate、用户显式控制块。
- 不把规则/文风当作剧情状态。

与 Source Ingest 的区别：

- Source Ingest 是有损编译，允许丢弃低价值信息。
- Control Doc Import 是保真规范化，必须保护用户控制语义。

控制文件固定化约定：

- `rules/`、`style/`、`memory/player-preferences.md` 大多数时候是只读或 manual/review-only，不应由 runtime 自动改写。
- `outlines/main.md` 是作者/GM 侧主线大纲，通常只读；只有 Outline Impact Detector 判断大纲需要调整时，才进入专门的大纲修订轮次或审阅流程。
- `outlines/progress.md` 是当前游玩过程相对大纲的进度记录，可以由 runtime 在 review/pending 边界内更新，用来记录当前处于哪一幕、哪些 beat 已完成/跳过/提前/延后、下一步最自然承接哪个 beat。
- 不引入固定 `revision-proposal.md`；大纲修订提案可以先作为 review item / pending proposal 存在，等修订机制明确后再决定是否落盘。

### 3. Campaign Setup Import

适用输入：

- 玩家角色设定
- 初始能力 / 背包 / 资源
- 玩家已知信息
- 开局目标
- 初始关系
- 已发生序章
- 游戏开始时的当前场景
- 开局地点、在场人物、即时危险和下一句承接点

目标：

- 初始化一个可玩的战役状态。
- 把 PC 设定、初始剧情事实、主线压力和当前场景分别放到正确层级。
- 允许通过显式用户动作 bootstrap `wiki/current-scene/scene_state.md`。

典型目标路径：

```text
wiki/player/player.md
wiki/player/abilities.md
wiki/player/inventory.md
wiki/player/goals.md
wiki/player/known_information.md
wiki/quests/*.md
wiki/current-scene/scene_state.md
wiki/events/prologue.md
wiki/relationships/player-*.md
wiki/outlines/main.md
wiki/outlines/progress.md
wiki/plot-arcs/*.md
wiki/locations/runtime/*.md
wiki/items/runtime/*.md
```

写入语义：

- `current-scene/scene_state.md`：显式 bootstrap / overwrite。
- `player/`：固定文件集合内 merge，替换 stale Current State；不新增、不删除 player 文件。
- `quests/`：merge，记录开局目标和阻碍。
- `events/prologue.md`：只记录已经发生的序章事实。
- `outlines/main.md`：记录作者/GM 侧未来安排、章节结构、揭示顺序和不能提前揭示的内容。
- `outlines/progress.md`：初始化当前处于大纲中的位置、已完成/未触发 beat 和开局偏离状态。
- `plot-arcs/*.md`：记录开局时已经存在的未解决冲突、压力、伏笔和推进条件。
- `relationships/`：记录初始关系状态、张力和触发器。

禁止：

- 不把开场场景混入普通 Source Ingest。
- 不把未发生的未来剧情写入 `events`。
- 不把玩家能力/技能拆到 `rules/`；玩家能力、技能、限制和当前可用性应进入 `player/abilities.md`。
- 不把 NPC 当前状态写进 base `characters/*.md`；战役当前状态应进入 runtime overlay 或关系/场景状态。

与 Control Doc Import 的区别：

- Control Doc Import 导入的是高优先级控制材料。
- Campaign Setup Import 初始化的是当前战役状态。

二者可在 UI 上放入同一个“战役设置向导”，但底层 mode 必须分开。

### 4. Runtime Update Apply

适用输入：

- 一次已完成 RPG 回合记录。
- 玩家已提交行动。
- 叙事生成器已经生成的正文。
- 已确认的 references。

目标：

- 从已完成行动和叙事中提出状态更新。
- 通过 pending/review/apply 边界写回动态 wiki。
- 只记录已确认发生的变化，不记录候选选项或未选择选项。

典型目标路径：

```text
wiki/current-scene/scene_state.md
wiki/events/*.md
wiki/player/*.md
wiki/quests/*.md
wiki/outlines/progress.md
wiki/relationships/runtime/*.md
wiki/plot-arcs/runtime/*.md
wiki/characters/runtime/*.md
wiki/locations/runtime/*.md
wiki/factions/runtime/*.md
wiki/items/runtime/*.md
```

当前状态：

- 现有 runtime update interaction、validation、pending、apply 和 write policy 已经属于这一类的基础实现。
- 后续模块化时不应把它改回文件 ingest，而应挂到同一个 import framework 的 apply/write-policy 层。

## 推荐模块边界

### Import Framework

建议新增：

```text
src/lib/rpg-import/
  types.ts
  registry.ts
  pipeline.ts
  source-ingest.ts
  control-doc-import.ts
  campaign-setup-import.ts
  runtime-update-apply.ts
  target-policy.ts
  validation.ts
  review.ts
  index.ts
```

职责：

- 定义 `RpgImportMode`。
- 注册每种 mode 的 spec。
- 按 mode 选择 LLM interaction、解析器、目标路径策略、验证和写入策略。
- 提供统一的 `runRpgImport()` 上层入口。
- 复用现有 review/pending/write policy，不绕过安全边界。

建议类型草案：

```ts
export type RpgImportMode =
  | "source_ingest"
  | "control_doc_import"
  | "campaign_setup_import"
  | "runtime_update_apply"

export interface RpgImportRequest {
  mode: RpgImportMode
  projectPath: string
  sourcePath?: string
  sourceText?: string
  sourceFileName?: string
  targetSlot?: string
  options?: Record<string, unknown>
}

export interface RpgImportResult {
  mode: RpgImportMode
  writtenPaths: string[]
  reviewItems: unknown[]
  warnings: string[]
  skipped: string[]
}
```

### Interaction Specs

`src/lib/rpg-interactions/` 应继续作为 LLM 交互规格层，而不是直接拥有文件写入。

建议扩展：

```text
src/lib/rpg-interactions/
  source-ingest-analysis-interaction.ts
  source-ingest-generation-interaction.ts
  control-doc-canonicalization-interaction.ts
  campaign-setup-interaction.ts
  runtime-update-interaction.ts
  narration-interaction.ts
  interaction-spec.ts
```

`RpgInteractionKind` 建议扩展为：

```ts
export type RpgInteractionKind =
  | "source_ingest_analysis"
  | "source_ingest_generation"
  | "control_doc_canonicalization"
  | "campaign_setup_generation"
  | "narration"
  | "runtime_state_update"
  | "relationship_derivation"
  | "outline_impact"
  | "outline_regeneration"
```

原则：

- interactions 负责 prompt / parse。
- import framework 负责流程编排、验证、review 和写入。
- runtime runtime-controller 继续负责游玩回合，不直接变成文件导入器。

## Schema Slot Contract

为了让 Context Compiler 和 import framework 不再靠隐式文件名猜测，后续应为固定入口文件增加 schema slot 元数据。

示例：

```ts
export interface RpgSchemaSlot {
  slotId: string
  path: string
  owner: "source_ingest" | "control_doc" | "campaign_setup" | "runtime"
  requiredForNewProject: boolean
  runtimePriority: "critical" | "high" | "normal" | "reference"
  importPolicy: "ordinary_ingest" | "controlled_canonicalize" | "campaign_bootstrap" | "runtime_apply"
  writePolicy: "manual_or_review_only" | "merge" | "append" | "overwrite"
}
```

初始建议 slot：

```text
main_outline              wiki/outlines/main.md
outline_progress          wiki/outlines/progress.md
rules_core                wiki/rules/core.md
rules_world               wiki/rules/world.md
rules_table               wiki/rules/table.md
style_narration           wiki/style/narration.md
style_dialogue            wiki/style/dialogue.md
style_forbidden           wiki/style/forbidden.md
memory_long_term          wiki/memory/long-term.md
memory_session_notes      wiki/memory/session-notes.md
memory_player_preferences wiki/memory/player-preferences.md
current_scene             wiki/current-scene/scene_state.md
player_main               wiki/player/player.md
player_abilities          wiki/player/abilities.md
player_inventory          wiki/player/inventory.md
player_goals              wiki/player/goals.md
player_known_information  wiki/player/known_information.md
```

新项目应创建模板文件。这个项目按全新 `llmWikiRPG` 契约设计，不为旧项目缺失 slot、旧路径迁移或 legacy fallback 付出默认兼容成本。

## 目录语义边界补强

下面这些边界是 import framework、prompt、target policy、validator 和 Context Compiler 必须共同遵守的契约。它们不是额外兼容层，而是新项目 schema 的基础语义。

### 固定 `player/` 文件集合

`player/` 不应继续按来源自由增删文件。新项目应固定创建并维护以下文件：

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

写入规则：

- Campaign Setup Import 可以初始化这些固定文件。
- Runtime Update Apply 只能在这些固定文件内 merge。
- import framework 和 runtime apply 不应新增或删除 `wiki/player/*.md`。
- 如果输入出现额外 player 子主题，应合并进上述固定 slot，而不是创建新 player 文件。

### `quests/`、`player/goals.md`、`plot-arcs/` 的目标边界

三者都可能含有“接下来要做什么”，但语义不同：

```text
player/goals.md       PC 主观目标、愿望、承诺、个人动机
quests/               被游戏承认为可追踪任务的目标、阻碍、进度、完成状态
plot-arcs/            初始/稳定剧情弧结构、冲突、压力、伏笔、推进条件
plot-arcs/runtime/    游玩中剧情弧状态、触发/跳过/提前/延后的 beat、当前压力变化
```

约定：

- `player/goals.md` 不负责记录任务进度表；它记录 PC 为什么想做、承诺过什么、主观优先级如何变化。
- `quests/` 不负责记录剧情主题或作者意图；它记录可追踪 objective：目标、阻碍、当前进度、完成/失败条件。
- `plot-arcs/` 不负责记录玩家待办清单；base 页记录故事压力、未解决冲突、伏笔回收条件和戏剧推进结构。
- `plot-arcs/runtime/` 记录这场战役已经如何改变某条剧情弧，例如某个伏笔已触发、某个 beat 被跳过、某个压力被玩家行动缓解或升级。
- 同一个目标可以在三处有不同投影，但不能互相替代。例如“找到失踪导师”可以是 PC 私人目标、一个 quest，也可以牵动某条 plot arc。

### `outlines/main.md` 与 `outlines/progress.md`

`outlines/main.md` 和 `outlines/progress.md` 都在 `outlines/`，但权威和更新频率不同：

```text
outlines/main.md      作者/GM 侧未来安排、章节结构、揭示顺序、分支条件
outlines/progress.md  当前游玩过程相对大纲的位置、已完成/跳过/提前/延后的 beat
```

约定：

- `main.md` 不记录每轮进度，不作为事件日志，也不被 runtime 每轮直接改写。
- `progress.md` 可以记录当前处于哪一幕、哪些 outline beat 已完成、哪些未来 reveal 仍未触发、玩家路线与原大纲的偏离程度。
- `progress.md` 可以每轮或定期由 Runtime Update Apply 生成 pending/review 更新；它解决“游玩进度相对大纲的位置”问题。
- Outline Impact Detector 发现重大偏离时，可以触发专门的大纲修订轮次；修订目标是 `main.md`，但必须 review/manual-confirm，不因普通 runtime update 静默覆盖。
- 大纲修订提案暂时作为 review item / pending proposal 存在，不固定创建 `revision-proposal.md`。

### `memory/` 作为 Context Compiler 长期辅助层

`memory/` 是 Context Compiler 的长期提示与整理缓冲层。它保存那些“不适合归入具体 wiki 目录、但会影响后续上下文选择或叙事体验”的信息。

`memory/` 不是事实源主目录，也不是“所有可能用得到的信息”的兜底箱。能放入更具体目录的内容，必须优先放入更具体目录：

```text
events/                 已发生事实
quests/                 可追踪任务进度
outlines/progress.md    相对大纲的游玩进度
relationships/runtime/  游玩中关系变化
plot-arcs/runtime/      游玩中剧情弧变化
current-scene/          当前即时状态
rules/                  世界/桌面运行规则
style/                  全局写作规范
```

`memory/` 内部不同文件的约束力也不同：

```text
wiki/memory/player-preferences.md  玩家长期偏好、安全边界、体验要求
wiki/memory/long-term.md           跨场景长期提示和摘要，供 Context Compiler 优先考虑
wiki/memory/session-notes.md       近期会话笔记、人工备注、待整理材料
```

约定：

- `player-preferences.md` 权威最高，影响叙事边界、偏好和交互方式；普通 ingest 和 runtime apply 不应静默改写。
- `long-term.md` 保存跨场景持续相关、但暂时不能自然放进 `events`、`relationships/runtime`、`quests`、`plot-arcs/runtime` 等目录的长期提示或摘要。
- `session-notes.md` 可以保留人工/会话级记录和待整理材料，但不是强控制指令，也不是已发生事件的替代品。
- 如果 memory 内容实际是规则，进入 `rules/`；如果实际是文风，进入 `style/`；如果实际是已发生事实，进入 `events/` 或对应状态目录。
- 如果 memory 内容实际是关系变化，进入 `relationships/runtime/`；如果是剧情弧变化，进入 `plot-arcs/runtime/`；如果是任务进度，进入 `quests/`；如果是当前场景状态，进入 `current-scene/`。
- Context Compiler 可以优先读取 `memory/` 作为长期辅助提示，但不能把 `memory/` 当成比具体事实目录更权威的来源。

### `rules/` 与 `world/`

`world/` 记录“世界是什么样”，`rules/` 记录“世界如何运作、什么能发生、什么不能发生”。

约定：

- `world/`：历史、社会结构、文化常识、地理、公共认知、稳定背景。
- `rules/`：行动判定、能力机制、资源消耗、限制、成功/失败边界、模型不可违反的硬规则。
- prompt 应避免把规则写成世界观散文，也避免把世界设定写成判定规则。
- 例：魔术师隐藏在现代社会中属于 `world/`；魔术需要魔力、媒介、代价和失败后果属于 `rules/`。

### `style/` 与角色说话方式

`style/` 只放全局写作规范，不放单个角色专属语气。

约定：

- `style/narration.md`：全局叙事口吻、人称、节奏、描写重点。
- `style/dialogue.md`：全局对白写作原则，例如对白密度、标点风格、是否允许内心独白。
- `style/forbidden.md`：全局禁用词、禁用句式、硬性风格禁止事项。
- 角色专属口癖、称呼习惯、礼貌等级、回避话题、语气变化，应进入 `characters/*.md`。
- 两人之间因为关系变化产生的说话方式变化，应进入 `relationships/*.md`。
- 不允许把某个角色的口癖提升为全局 `style`。

### `current-scene/` 与 runtime overlays

`current-scene/scene_state.md` 只保存本轮生成必需的即时快照。长期变化必须同步进入对应 runtime overlay 或动态目录。

约定：

- `current-scene/`：当前时间、地点、在场人物、即时动作、气氛、危险、可见线索、下一句承接点。
- `characters/runtime/`：NPC 在本战役中的持续状态变化。
- `locations/runtime/`：地点损坏、封锁、警戒、可进入性等持续变化。
- `items/runtime/`：物品持有者、损坏、消耗、转移等持续变化。
- `factions/runtime/`：势力态度、资源、警戒等级等持续变化。
- `relationships/runtime/`：游玩中关系状态变化。
- `plot-arcs/runtime/`：游玩中剧情弧状态变化。
- Runtime Update Apply 如果在 `current-scene` 中写出会持续存在的变化，应同时生成对应 overlay/动态目录 update proposal。

这里的 overlay 指“分层覆盖文件”，不是一种写入算法：

- base 页保存初始/稳定结构，例如 `characters/rin.md`、`relationships/rin-shirou.md`、`plot-arcs/caster-conflict.md`。
- runtime overlay 保存本战役中持续变化，例如 `characters/runtime/rin.md`、`relationships/runtime/rin-shirou.md`、`plot-arcs/runtime/caster-conflict.md`。
- Context Compiler 读取时先读 base，再叠加 runtime overlay，得到当前战役视角。
- merge 是写入某一个目标文件时的合并策略；overlay 是 base + runtime 两层文件的读取/组织模型。runtime overlay 文件本身也可以用 merge 更新，但 merge 不等于 overlay。

### `characters/` 与 `relationships/`

`characters/` 描述这个角色通常如何行动、互动和说话；`relationships/` 描述两个角色之间当前发生了什么关系变化。

约定：

- `characters/*.md`：角色稳定设定、行为模式、说话方式、能力限制、通常互动边界。
- `relationships/*.md`：原作/初始/稳定关系模型，包括长期互动模式、结构性张力、基础信任或敌对关系。
- `relationships/runtime/*.md`：游玩中关系状态，包括当前信任变化、最近冲突/和解、新误解、玩家行动造成的关系变化和阶段性推进限制。
- 不把完整角色档案复制进关系页。
- 不把某一对关系的阶段性变化写成角色的永久性格。

### `items/` 与 `player/inventory.md`

`items/` 是物品定义和剧情功能；`player/inventory.md` 是玩家当前持有状态。

约定：

- `items/*.md`：物品是什么、功能、代价、限制、来源、剧情作用、通常持有者。
- `player/inventory.md`：玩家当前持有、数量、装备中/背包中、是否消耗、是否损坏。
- `items/runtime/*.md`：本战役中物品当前状态，例如转移、损坏、封印、临时增强。
- Runtime Update Apply 如果改变玩家持有状态，应更新 `player/inventory.md`；如果改变物品本身状态，也应更新 `items/runtime/*.md`。

## 安全边界

所有 mode 都必须遵守以下边界：

- 只写 `projectPath/wiki/...` 下的允许路径。
- 不写 legacy `entities`、`concepts`、`queries` 等旧目录。
- 不自动执行 `git commit` 或 `git push`。
- 不绕过 review / pending / apply。
- 不把未来可能写入 `events`。
- 不把候选行动或未选择选项写入 wiki fact。
- 不让普通 Source Ingest 写 `current-scene`。
- 不让 runtime apply 改写 base stable pages、sources、style、rules、memory 或 `outlines/main.md`。
- Runtime Update Apply 可以在 review/pending 边界内更新 `outlines/progress.md`。
- 不让 runtime apply 直接写 base `relationships/*.md` 或 base `plot-arcs/*.md`；运行时变化写入 `relationships/runtime/*.md` 和 `plot-arcs/runtime/*.md`。
- 不让 import/runtime 新增或删除固定 `wiki/player/*.md` 文件，只允许修改固定 slot 内容。

## UI 建议

UI 可以保留一个统一入口，但用户必须显式选择导入语义。

```text
导入为：
- 普通资料
- 玩家设定
- 开场场景
- 战役初始化包
- 主线大纲
- 世界/跑团规则
- 文风要求
- 上下文记忆 / 玩家偏好
```

这些 UI 选项映射到底层 mode：

```text
普通资料             -> source_ingest
主线大纲             -> control_doc_import targetSlot=main_outline
世界/跑团规则        -> control_doc_import targetSlot=rules_*
文风要求             -> control_doc_import targetSlot=style_*
上下文记忆 / 玩家偏好 -> control_doc_import targetSlot=memory_*
玩家设定             -> campaign_setup_import setupPart=player
开场场景             -> campaign_setup_import setupPart=current_scene
战役初始化包         -> campaign_setup_import setupPart=full
```

## 分阶段计划

### 阶段 A：文档与契约冻结

状态：已完成。

完成记录：

- `docs/RPG_WIKI_SCHEMA.md` 已冻结四类 mode 的正式名称、语义边界、允许目标路径、禁止路径和写入策略边界：`source_ingest`、`control_doc_import`、`campaign_setup_import`、`runtime_update_apply`。
- `docs/RPG_WIKI_SCHEMA.md` 已冻结固定 schema slots，覆盖 outlines、rules、style、memory、current-scene 和固定 player 文件集合。
- `docs/RPG_WIKI_SCHEMA.md` 已补齐固定 `player/` 文件集合、`outlines/main.md` vs `outlines/progress.md`、以及 base/runtime overlay 边界。
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` 的阶段 `6.17a` 已同步为承接固定 schema slot / runtime context schema contract 的文档阶段。
- 本阶段仅冻结文档契约；未改运行时代码、ordinary ingest、UI、测试，未新增 `src/lib/rpg-import/`，未调用真实 LLM，未执行 `git commit` / `git push`。

目标：

- 确认四类 import mode 的名称、边界、目标路径和禁止路径。
- 确认固定 schema slots。
- 更新 `RPG_WIKI_SCHEMA.md` 和后续 architecture steps 中的 6.17a 约定。

不做：

- 不改运行时代码。
- 不改 ingest 行为。
- 不加 UI。

### 阶段 B：Import Framework 骨架

状态：已完成。

完成记录：

- 已新增 `src/lib/rpg-import/` skeleton：`types.ts`、`source-ingest.ts`、`registry.ts`、`pipeline.ts`、`index.ts`。
- 已定义 `RpgImportMode`、`RpgImportRequest`、`RpgImportResult`、`RpgImportModeSpec`，并提供 mode registry 与 `runRpgImport()` pipeline 入口。
- 已注册 `source_ingest` spec；该 mode 只是薄包装现有 `autoIngest()`，要求 `sourcePath` + `llmConfig`，并透传 `projectPath`、`signal`、`folderContext`。
- `source_ingest` 返回的 `writtenPaths` 等于 `autoIngest()` 返回值，`reviewItems`、`warnings`、`skipped` 保持为空数组；异常不吞掉，参数不改写，不新增写入逻辑。
- 已新增 `src/lib/rpg-import/source-ingest.test.ts`，证明 wrapper 与直接 `autoIngest()` 在 written paths、写入文件内容、REVIEW block 语义字段上等价，并覆盖缺少 `sourcePath` / `llmConfig` 的错误。
- 验证已通过：`npx.cmd vitest run src/lib/rpg-import/source-ingest.test.ts src/lib/ingest.scenarios.test.ts` 与 `npm.cmd run typecheck`。
- 本阶段未修改 `autoIngest()` 主体，未改变普通 ingest 行为，未改 queue/UI/prompt/writer/runtime update apply，未实现后续 modes，未引入 `sourceText` 临时文件导入，未调用真实 LLM，未执行 `git commit` / `git push`。

目标：

- 新增 `src/lib/rpg-import/`。
- 定义 `RpgImportMode`、`RpgImportRequest`、`RpgImportResult`、registry 和 pipeline 类型。
- 把现有普通 `autoIngest()` 包装为 `source_ingest` mode。

要求：

- 不改变现有普通 ingest 行为。
- 测试应证明包装前后结果等价。

### 阶段 C：Interaction Spec 迁移

状态：已完成。

完成记录：

- 已扩展 `RpgInteractionKind`，包含 `source_ingest_analysis`、`source_ingest_generation`、`control_doc_canonicalization`、`campaign_setup_generation`、`narration`、`runtime_state_update`、`relationship_derivation`、`outline_impact`、`outline_regeneration`。
- 已新增 `src/lib/rpg-interactions/source-ingest-analysis-interaction.ts` 和 `src/lib/rpg-interactions/source-ingest-generation-interaction.ts`，并从 `src/lib/rpg-interactions/index.ts` 导出。
- RPG source ingest Stage 1 analysis / Stage 2 generation 的 system prompt 继续复用现有 `buildRpgAnalysisPrompt(...)` / `buildRpgGenerationPrompt(...)`，未重写 prompt 正文。
- `src/lib/ingest.ts` 的 `autoIngestImpl()` 两处 `streamChat()` 调用已改为通过 `sourceIngestAnalysisInteractionSpec.buildPrompt(...)` 和 `sourceIngestGenerationInteractionSpec.buildPrompt(...)` 构造 system/user prompt。
- `autoIngest()`、`buildAnalysisPrompt()`、`buildGenerationPrompt()` 仍作为当前普通资料导入入口可用。
- 已补充 `src/lib/rpg-interactions.test.ts` 覆盖 kind、prompt 等价、关键 user prompt 文本、parse passthrough，以及 interaction spec build/parse 不读写 wiki 文件。
- 验证已通过：`npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-import/source-ingest.test.ts src/lib/ingest.scenarios.test.ts` 与 `npm.cmd run typecheck`。
- 本阶段未实现 `control_doc_import`、`campaign_setup_import`、`runtime_update_apply`，未改变 writer、queue、UI、普通 ingest 语义、LLM 参数、错误处理、review/pending/apply 流程，未添加 legacy/default import fallback，未调用真实 LLM，未执行 `git commit` / `git push`。

目标：

- 扩展 `RpgInteractionKind`。
- 将现有 RPG ingest prompt 构造迁入或 re-export 到 `src/lib/rpg-interactions/`。
- 保持当前普通资料导入入口可用；不要为了不存在的旧项目额外保留 legacy import 路径。

要求：

- prompt 文本快照或关键断言保持稳定。
- `src/lib/ingest.ts` 可以继续作为当前普通资料导入入口，但新代码开始走 interaction spec。

### 阶段 D：Schema Slots 与新项目模板

状态：已完成。

完成记录：

- 已在 `src/lib/rpg-wiki-schema.ts` 增加代码可读固定 slot 契约：`RpgSchemaSlot`、`RPG_SCHEMA_SLOTS`、slot 查询 helper、required/owner helper、固定 player slot path 集合与 `isFixedPlayerSlotPath()`。
- `RPG_SCHEMA_SLOTS` 已覆盖 `docs/RPG_WIKI_SCHEMA.md` 中固定 slot 表：outlines、rules、style、memory、current-scene 以及五个固定 player 文件；新项目固定 slot 均为 required。
- 新项目 bootstrap 已创建 `wiki/outlines/`、`wiki/relationships/runtime/`、`wiki/plot-arcs/runtime/`，并固定创建 outlines、rules、style、memory、current-scene、player 的 slot 模板文件。
- `src-tauri/src/commands/project.rs` 的内置 schema 文案已补充 fixed slot 说明；前端 `src/lib/project-mode.ts` 的 bootstrap schema 拷贝也已同步，避免 UI 创建项目时覆盖后端 schema 文案。
- Context Compiler 已改为 slot-first 读取：`current_scene` 通过 slot helper 读取；player 状态只读五个固定 player slots；rules/style/memory 先读固定 slot，再读取同目录补充 markdown。
- `CompactStoryBrief` 已新增 `outlineNotes: string[]`，并在 narration prompt 中单独渲染 `## Outline Notes`；大纲内容不混入 `events` 或 `hardFacts`。
- 固定 player slot 缺失会产生项目结构 warning，不再通过扫描任意 `wiki/player/*.md` 绕过。
- 已补充相关 TypeScript/Rust 测试；验证通过：`npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-narration-prompts.test.ts`、`npm.cmd run typecheck`、`cargo test --manifest-path src-tauri/Cargo.toml project`。
- 本阶段未做 D1/D2/D3 的 prompt 边界扩展、runtime cross-directory sync 或 overlay resolver 大改；未添加旧项目迁移、legacy fallback 或旧路径兼容；未执行 `git commit` / `git push`。

目标：

- 在代码可读 schema 中加入固定 slot。
- 新项目 bootstrap 创建 control/runtime setup 模板文件。
- 不为旧项目缺失 slot 设计迁移或兼容 fallback。
- 固定创建 `outlines/main.md` 和 `outlines/progress.md`。
- 固定创建 `rules/core.md`、`rules/world.md`、`rules/table.md`。
- 固定创建 `style/narration.md`、`style/dialogue.md`、`style/forbidden.md`。
- 固定创建 `memory/player-preferences.md`、`memory/long-term.md`、`memory/session-notes.md`。
- 固定创建 `player/player.md`、`player/abilities.md`、`player/inventory.md`、`player/goals.md`、`player/known_information.md`。
- 创建 `relationships/runtime/` 和 `plot-arcs/runtime/` 目录。

要求：

- Context Compiler 可优先读取 slot 路径。
- 新项目模板应补齐固定 slot；运行时缺文件属于项目不完整 warning，而不是旧项目兼容场景。
- player 固定 slot 缺失应作为新项目结构错误或可修复 warning，不通过自动新增任意 player 文件绕过。
- `rules`、`style`、`memory/player-preferences.md`、`outlines/main.md` 默认 manual_or_review_only。
- `outlines/progress.md` 可作为 runtime progress slot，但仍通过 review/pending 边界更新。

### 阶段 D1：目录边界 Prompt / Schema 约束

状态：已完成。

完成记录：

- 已在 `src/lib/rpg-wiki-schema.ts` 增加 code-readable 目录边界契约：`RPG_DIRECTORY_BOUNDARY_GUIDANCE` 与 `getRpgDirectoryBoundaryGuidance()`。
- 已将边界契约落入 Source Ingest prompt guidance：Stage 1 analysis、Stage 2 generation、focused page guidance、long-source chunk analysis 和 structured signal context 均会提示目录边界。
- 已同步收窄 runtime target/update policy 文案，避免把 `quests` 说成“任何目标”、把 `plot-arcs` 说成玩家待办、或把 `player/goals.md` 写成任务进度/剧情压力页。
- 已覆盖这些 D1 边界：`quests` / `player/goals.md` / `plot-arcs`，`rules` / `world`，`style` / character voice，`characters` / `relationships`，`items` / `player/inventory.md`。
- 已补充/更新测试：`src/lib/rpg-wiki-schema.test.ts`、`src/lib/ingest.prompt.test.ts`、`src/lib/rpg-ingest-signals.test.ts`、`src/lib/rpg-interactions.test.ts`。
- 验证已通过：`npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-ingest-signals.test.ts` 与 `npm.cmd run typecheck`。
- 本阶段未实现 D2 runtime cross-directory sync、D3 overlay resolver、`control_doc_import`、`campaign_setup_import`、新 import mode、UI 改动；未调用真实 LLM，未执行 `git commit` / `git push`。

目标：

- 把本计划的目录语义边界写入 code-readable schema、prompt guidance 和 target policy。
- 明确 `quests` / `player/goals` / `plot-arcs` 的目标分工。
- 明确 `rules` / `world`、`style` / character voice、`characters` / `relationships`、`items` / `player/inventory` 的边界。

要求：

- Source Ingest 不能把 PC 主观目标直接当成 quest，除非来源明确给出任务/阻碍/完成条件。
- Source Ingest 不能把剧情压力写入 `player/goals.md`，也不能把玩家待办清单写成 `plot-arcs`。
- Style prompt 只允许全局写作规范进入 `style/`；角色专属语气进入 `characters/` 或 `relationships/`。
- Rules prompt 必须优先抽取可执行机制、限制和判定边界；world prompt 必须优先抽取背景、常识和稳定设定。

### 阶段 D2：Runtime Cross-directory Sync Contract

状态：已完成。

完成记录：

- 已在 `src/lib/rpg-wiki-schema.ts` 增加 code-readable runtime cross-directory sync guidance：`RPG_RUNTIME_CROSS_DIRECTORY_SYNC_GUIDANCE` 与 `getRpgRuntimeCrossDirectorySyncGuidance()`。
- Runtime Update Apply target policy 已收窄为：`current-scene/scene_state.md` overwrite、`events/*.md` append、固定 `player` slot merge、`quests/*.md` merge、`outlines/progress.md` merge，以及 `characters/locations/factions/items/relationships/plot-arcs` 的 `runtime/*.md` overlay merge。
- Runtime Update Apply 不再允许任意新增 `wiki/player/*.md`，也不再允许写 base `relationships/*.md` 或 base `plot-arcs/*.md`。
- Runtime Update prompt 已加入跨目录同步契约：`current-scene` 只保存即时快照；若当前场景里出现长期 NPC、地点、势力、物品、关系、剧情弧或大纲进度变化，应同时提出对应 runtime overlay / dynamic directory update。
- Validator 已新增 batch-level warning-only sync checks：缺少角色/地点/势力/物品/关系/剧情弧/大纲进度 companion update 时给 warning，不自动补造 `ProposedWikiUpdate`。
- `player/inventory.md` 与 `items/runtime/*.md` 已增加双向 warning：库存页记录物品对象状态但缺少 item runtime、或 item runtime 记录玩家持有/数量/装备/消耗但缺少 inventory 时给 warning。
- 已更新 focused tests：`src/lib/rpg-wiki-schema.test.ts`、`src/lib/rpg-interactions.test.ts`、`src/lib/rpg-runtime-update-validation.test.ts`、`src/lib/rpg-write-policy.test.ts`、`src/lib/rpg-runtime-controller.test.ts`。
- 验证已通过：`npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-runtime-update-validation.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-runtime-controller.test.ts`；`npm.cmd run typecheck`。
- 本阶段未实现 D3 overlay resolver / Context Read Contract，未自动补造缺失 update，未接入 `control_doc_import` / `campaign_setup_import` / `runtime_update_apply` import framework，未改 UI，未调用真实 LLM，未执行 `git commit` / `git push`。

目标：

- 为 Runtime Update Apply 增加跨目录同步约束。
- 当 current-scene 包含长期变化时，同步提出 runtime overlay / dynamic directory updates。
- 当玩家持有物或物品状态变化时，同步区分 `player/inventory.md` 和 `items/runtime/*.md`。
- 将关系变化写入 `relationships/runtime/*.md`，不写 base `relationships/*.md`。
- 将剧情弧运行时变化写入 `plot-arcs/runtime/*.md`，不写 base `plot-arcs/*.md`。
- 允许 runtime 通过 pending/review 更新 `outlines/progress.md`，记录当前游玩进度相对大纲的位置。

要求：

- `current-scene` 仍是 overwrite 快照，不累计长期状态。
- NPC 长期状态进入 `characters/runtime/`。
- 地点长期状态进入 `locations/runtime/`。
- 势力长期状态进入 `factions/runtime/`。
- 物品长期状态进入 `items/runtime/`。
- 关系长期状态进入 `relationships/runtime/`。
- 剧情弧运行状态进入 `plot-arcs/runtime/`。
- 玩家持有状态进入 `player/inventory.md`。
- 大纲进度进入 `outlines/progress.md`。
- 第一版可以通过 prompt contract 和 validator warnings 实现，不要求自动补造缺失 update。

### 阶段 D2.5：Mode-scoped Prompt / Schema Contract Cleanup

状态：已完成。

完成记录：

- 已新增 code-readable Source Ingest target policy，明确普通 Source Ingest 只写 source/base 目录、固定 `player/` slots 和结构页。
- 已将 `rules/`、`style/`、`memory/`、`outlines/`、`current-scene/`、`wiki/*/runtime/` 和 `quests/` 收窄为普通 Source Ingest 的 REVIEW / warning / skipped 边界。
- 已更新 Stage 1 / Stage 2 / long-source signal prompt，使控制文档推荐 `control_doc_import`，开场/玩家初始化材料推荐 `campaign_setup_import`，完成回合和 runtime overlay 写回推荐 `runtime_update_apply`。
- 已在 writer / validation / structured signal normalization 增加防线：普通 Source Ingest 遇到 other-mode target 时不写入，改为 warning + review item。
- 已验证：`npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-ingest-signals.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/rpg-wiki-schema.test.ts` 通过；`npm.cmd run typecheck` 通过。
- 本阶段未实现 D3 overlay resolver、`control_doc_import`、`campaign_setup_import`、`runtime_update_apply` framework integration、UI、真实 LLM，也未执行 `git commit` / `git push`。

背景：

- D1/D2 已经把目录边界和 Runtime Update Apply 同步契约写入 code-readable schema、Source Ingest prompt guidance、Runtime Update prompt 和 validator。
- 当前普通 Source Ingest 的 Stage 1 已禁止 `quests`、`rules`、`style`、`current-scene` 进入 `needed_categories`，Stage 2 focused guidance 也不会展开这些目录合约。
- 但普通 Source Ingest 的最小合约、boundary guidance、长文档 signal prompt、writer/review 文案中仍然提到或允许 `quests`、`rules`、`style`、`memory` 等路径；这些路径的主要语义已经属于 `control_doc_import`、`campaign_setup_import` 或 `runtime_update_apply`。
- 这意味着问题不是“Stage 2 仍展开所有目录合约”，而是 Source Ingest 还没有彻底 mode-scoped，容易让 LLM 在普通资料导入中尝试写入其他 mode 拥有的路径。

目标：

- 为四种 mode 定义各自的 prompt/schema 可见范围：`source_ingest`、`control_doc_import`、`campaign_setup_import`、`runtime_update_apply`。
- 收窄普通 `source_ingest` 的 prompt/schema/writer 文案，删除或改写会诱导写入 `rules/`、`style/`、`memory/`、`quests/`、`current-scene/`、`outlines/` 或 runtime overlay 的冗余说明。
- 保留必要的目录边界说明，但表达为“不要在 Source Ingest 中写入，交给对应 import/apply mode 或 REVIEW”，而不是“满足条件时可写”。
- 让普通 Source Ingest 遇到控制文档、战役初始化、运行时状态写回材料时，只生成 REVIEW / warning / skipped 信号，不直接写对应目录。
- 为后续 E/F/G 的专用 mode prompt/schema 留出清晰入口，避免这些模式实现时继续复用普通 ingest 的混合提示。

要求：

- `source_ingest` 只应有普通来源资料的有损编译合约；它可以写普通 source-facing/base wiki 页面，但不得拥有控制文档、战役 bootstrap 或 runtime apply 的写入合约。
- `source_ingest` 不应把 `rules/`、`style/`、`memory/`、`outlines/` 当作可写目标；发现明确控制材料时应进入 REVIEW，并提示改用 `control_doc_import`。
- `source_ingest` 不应把开场场景、玩家初始档案包、初始背包/能力/当前场景 bootstrap 当作普通来源；发现这类材料时应进入 REVIEW，并提示改用 `campaign_setup_import`。
- `source_ingest` 不应写 `current-scene/` 或 runtime overlay；发现已完成回合/状态写回材料时应进入 REVIEW，并提示改用 `runtime_update_apply`。
- `quests/` 在普通 Source Ingest 中应默认 review-only，除非后续单独决定 Source Ingest 是否可以创建 base quest；本阶段先以去冗余和防误写为准。
- 长文档 `RP Runtime Signals` prompt 中的 `targetPath` 示例和 guidance 应避免鼓励输出其他 mode 的路径。
- Writer/review 文案应与 mode 边界一致，不能继续把普通 ingest 描述成能写所有 RPG 辅助目录。
- 本阶段不实现 `control_doc_import`、`campaign_setup_import`、`runtime_update_apply` 的完整流程；只清理 Source Ingest 与共享 schema/prompt 的边界。

验收：

- Source Ingest 的 Stage 1 / Stage 2 / long-source prompts 不再包含会诱导写入 Control Doc、Campaign Setup 或 Runtime Apply 目标的正向写入指令。
- Source Ingest 仍能写 `wiki/sources/`、`wiki/world/`、`wiki/characters/`、`wiki/player/` 固定 player slot 范围内允许的明确 PC 来源材料、`wiki/locations/`、`wiki/factions/`、`wiki/items/`、`wiki/plot-arcs/`、`wiki/events/`、`wiki/relationships/`。
- Source Ingest 对 `rules/style/memory/outlines/current-scene/runtime overlays` 的处理是 REVIEW / warning / skipped，而不是直接生成 FILE 写入。
- Runtime Update Apply 的 D2 prompt/validator 行为保持不变。
- D3 的 overlay resolver / Context Read Contract 不在本阶段实现，避免把读取层和 import prompt cleanup 混在一起。

### 阶段 D3：Overlay Resolver / Context Read Contract

状态：已完成。

完成记录：

- Context Compiler 已将 `relationships/` 和 `plot-arcs/` 接入与 `characters`、`locations`、`factions`、`items` 相同的 base + runtime overlay group 读取路径。
- `brief.relationshipTensions` 现在来自 relationship overlay groups，`brief.activePlotPressure` 现在来自 plot arc overlay groups；`references` 会包含命中的 base 页与同组 runtime overlay 页。
- overlay resolver 仍然只读和组合页面，不写文件，不调用 pending/apply。
- Runtime Update Apply 写入边界未改变：关系和剧情弧的 runtime 变化仍应通过 review/pending/apply 写入 `relationships/runtime/*.md` 与 `plot-arcs/runtime/*.md`。
- runtime overlay 文件内部仍可通过 merge 更新单个目标文件；这不改变 overlay 是 Context Compiler 的分层读取模型。
- 已补充 focused tests 覆盖 relationship / plot arc base + runtime 同 slug 组合、无关页过滤、references 同时包含 base 与 overlay、preview/context compile 只读。
- 验证已通过：`npx.cmd vitest run src/lib/rpg-runtime.test.ts src/lib/rpg-wiki-schema.test.ts` 与 `npm.cmd run typecheck`。
- 本阶段未实现 E/F/G，未改 UI，未调用真实 LLM，未执行 `git commit` / `git push`。

目标：

- 为 Context Compiler 明确 base + runtime overlay 的读取规则。
- 让 `relationships/`、`plot-arcs/` 像 `characters/`、`locations/`、`factions/`、`items/` 一样支持 runtime overlay。
- 明确 overlay 与 merge 的区别，避免把运行时覆盖层误实现成直接改写 base 页。

要求：

- 读取当前关系时，先读 `relationships/*.md` 的稳定关系模型，再叠加同名或可映射的 `relationships/runtime/*.md`。
- 读取当前剧情弧时，先读 `plot-arcs/*.md` 的稳定剧情结构，再叠加同名或可映射的 `plot-arcs/runtime/*.md`。
- overlay resolver 只负责读取/组合，不负责写入。
- 写入仍由 Runtime Update Apply 走 pending/review/apply 和目标路径策略。
- runtime overlay 文件内部可以使用 merge 更新；这不改变 overlay 是分层读取模型的事实。

### 阶段 D3.5：Redundancy Audit / Cleanup Gate

状态：已完成。

完成记录：

- 已新增 `docs/RPG_IMPORT_REDUNDANCY_AUDIT_D3_5.md`，按 `keep` / `merge` / `delete` / `defer` 记录 D/D1/D2/D2.5/D3 后的冗余审查结论。
- 已保留 `src/lib/rpg-import/` 作为后续 E/F/G 使用的统一 framework 骨架；当前只注册 `source_ingest`，不在 D3.5 扩展新 mode。
- 已清理 Source Ingest target policy 中被 `wiki/*/runtime/**` 通配规则覆盖、不可达的具体 runtime forbidden target 重复项。
- 已将长文档 chunk prompt 中重复手写的 forbidden target 清单合并回 `buildSourceIngestTargetPolicyGuidance()` 这一权威渲染入口。
- 已记录当时的 defer 项：controller narration-block transition fallback、runtime prompt 手写 forbidden examples、若干固定 slot 测试 fixture、legacy/default 拒绝测试等都不在 D3.5 强删；Redundancy Cleanup Phase 4 后该 controller fallback 已移除。
- 验证已通过：`npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-interactions.test.ts`；`npm.cmd run typecheck`。
- 本阶段未实现 E/F/G/H，未新增 import mode，未改 UI，未执行 `git commit` / `git push`。

背景：

- 当前项目主要通过阶段式 vibecoding 推进。该方式擅长按目标新增功能，但容易在连续阶段后留下重复入口、重复 prompt/schema 文案、过期 fallback、测试惯性和历史文档噪声。
- D/D1/D2/D2.5/D3 已经引入固定 schema slot、Source Ingest target policy、Runtime Cross-directory Sync Contract、mode-scoped prompt cleanup 和 overlay resolver。进入 E/F/G 之前，需要一次小范围减法审查，避免后续专用 import mode 建在重复或漂移的旧边界上。
- 本阶段是架构维护闸门，不是新功能阶段；它只识别和清理明确低风险的冗余，不改变 E/F/G/H 的目标、编号和语义。

目标：

- 找出 D 到 D3 之后已经被新 schema slot、source-ingest target policy、runtime target policy 或 overlay resolver 替代的重复代码、重复 prompt 文案、重复测试 fixture 和过期文档描述。
- 明确哪些入口是当前权威入口，哪些 helper / 文案 / 测试只是在保护旧行为。
- 只删除或合并低风险、证据充分的冗余；对不确定项只记录为 follow-up，不在本阶段强行处理。
- 将“减法检查”固化为后续阶段的验收习惯，避免每个阶段只新增不回收。

重点审查范围：

- `src/lib/ingest.ts`、`src/lib/rpg-import/`、`src/lib/rpg-interactions/` 之间是否出现普通 Source Ingest 的重复流程或重复 prompt 入口。
- `src/lib/rpg-wiki-schema.ts`、`src/lib/prompts/rpg-page-guidance.ts`、`src/lib/prompts/rpg-ingest.ts`、`src/lib/rpg-interactions/wiki-update-policy.ts` 之间是否重复表达同一目录边界，且存在后续漂移风险。
- Runtime Update Apply 的 controller / validation / pending / apply 路径与未来 G 阶段统一 framework 入口之间是否已有双重权威迹象。
- `default` / legacy 兼容相关 helper、测试、模板或文档是否仍在当前全新 `llmWikiRPG` 契约下误导阶段实现。
- D/D1/D2/D2.5/D3 相关测试是否存在重复 fixture、重复断言或继续保护旧路径/fallback 的惯性。
- `docs/CURRENT_STATE.md`、`docs/IMPLEMENTATION_LOG.md`、架构文档和本计划中是否有会误导下一阶段 agent 的过期状态描述。

要求：

- 不新增 `control_doc_import`、`campaign_setup_import`、`runtime_update_apply` framework integration 或 UI 功能。
- 不改变 Stage E/F/G/H 的目标、编号、验收标准或执行顺序。
- 删除前必须用 `rg`、类型引用、测试覆盖或明确调用链说明为什么安全。
- 不确定的冗余只记录，不删除；不要为了“看起来更干净”做大规模重构。
- 不删除用户磁盘文件，不执行危险清理命令，不执行 `git commit` / `git push`。
- 如发现实际代码与当前计划不一致，先记录差异，再决定是否只做低风险清理或停止等待新阶段。
- 阶段完成后必须更新 `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md`。

建议输出分类：

```text
keep    当前权威入口或仍被后续阶段依赖的代码/文案/测试。
merge   功能仍有用，但职责应并入新的 schema / policy / framework 入口。
delete  无调用、重复、过期、或与当前 RPG-only 契约冲突且可安全删除的内容。
defer   有冗余迹象，但证据不足或会牵动 E/F/G/H，应记录后推迟。
```

验收：

- 产出一份简短审查记录，列出 `keep` / `merge` / `delete` / `defer` 项。
- 至少完成一组低风险冗余清理，或明确记录“本阶段只审查不删除”的原因。
- 被删除内容不再被 `rg` 发现为调用点或权威文案入口。
- 相关 focused tests 与 `npm.cmd run typecheck` 通过；如果无法运行，必须记录原因。
- `docs/CURRENT_STATE.md` 与 `docs/IMPLEMENTATION_LOG.md` 记录本阶段实际清理项、未清理项和验证结果。

### 阶段 E：Control Doc Import v0

状态：已完成。

完成记录：

- 已在 `src/lib/rpg-import/control-doc-import.ts` 实现 `control_doc_import`，并注册到 `registry.ts` / `index.ts`。
- `runRpgImport({ mode: "control_doc_import", ... })` 已可运行；本阶段只支持 `main_outline`、`outline_progress`、`rules_core`、`style_narration` 四个 slot。
- 四个 slot 固定写入：`wiki/outlines/main.md`、`wiki/outlines/progress.md`、`wiki/rules/core.md`、`wiki/style/narration.md`。
- `sourceText` 与 `sourcePath` 均可作为输入；两者同时存在时使用 `sourceText`，同时保留 source path / file name provenance。
- raw source anchor 采用独立文件策略：保存到 `wiki/sources/imports/<safe-source-name>--<slot>.md`，目标控制文件通过 `source_import_path` 与 `source_anchor` 指回原文。
- 规范化控制文件写入 frontmatter metadata，记录 slot id、import mode、source file name / path / anchor、import timestamp、write policy、review policy、canonicalization policy 与 source origin。
- canonicalized control file 只做保真规范化，不走普通 source ingest 式有损抽取；hard gate、`{{setvar::...}}`、禁用词和用户显式控制块在目标文件与 raw anchor 中保留。
- 默认 review / manual-confirm：已有有意义控制文件不会被静默覆盖，除非调用方显式传入 `manualConfirm` 或 `allowOverwrite`。
- 实际代码差异：`outline_progress` 在 schema 中仍是 runtime-owned merge slot；Stage E 仅允许通过 `control_doc_import` 初始化为空/开局进度，不改变 Runtime Update Apply 行为。
- 已补充 focused tests：`src/lib/rpg-import/control-doc-import.test.ts` 与 `src/lib/rpg-interactions.test.ts`。
- 验证已通过：`npx.cmd vitest run src/lib/rpg-import/source-ingest.test.ts src/lib/rpg-import/control-doc-import.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts`；`npm.cmd run typecheck`。
- 本阶段未实现 Stage F/G/H、campaign setup、runtime update framework integration、UI 或真实 LLM；未写 `wiki/current-scene/`，未写 `wiki/events/`，未执行 `git commit` / `git push`。

目标：

- 实现 `control_doc_import`。
- 首批支持 `main_outline`、`outline_progress`、`rules_core`、`style_narration`。
- 保存 raw source anchor，并生成规范化控制文件。

要求：

- 不写 `current-scene`。
- 不把大纲未来内容写入 `events`。
- `outlines/main.md` 默认 manual_or_review_only，不由普通 runtime update 静默覆盖。
- `outlines/progress.md` 可以初始化为空进度或开局进度，用于后续记录游玩进度。
- 不丢弃 hard gate、setvar、禁用词和用户显式控制块。
- 默认 review 或 manual-confirm，不静默覆盖高风险控制文件。

### 阶段 F：Campaign Setup Import v0

状态：已完成。

完成记录：

- 已在 `src/lib/rpg-import/campaign-setup-import.ts` 实现 `campaign_setup_import`，并注册到 `registry.ts` / `index.ts`。
- `runRpgImport({ mode: "campaign_setup_import", ... })` 已可运行；本阶段支持 `player_main`、`current_scene`、`events_prologue`、`main_quest`、`quest`、`player_relationship`。
- `player_main` 固定写入/合并 `wiki/player/player.md`，不会新增任意 `wiki/player/*.md` 文件。
- `current_scene` 固定目标为 `wiki/current-scene/scene_state.md`，且只有 `options.explicitBootstrap === true` 或 `options.manualConfirm === true` 时才写入；否则只保存 raw source anchor 并返回 skipped/warning/review。
- `events_prologue` 固定写入 `wiki/events/prologue.md`，只保留已发生序章事实；非已发生指导、未来压力、possible futures、未触发 reveal 不进入 canonical event page。
- `main_quest` / `quest` 写入 `wiki/quests/main.md` 或 `wiki/quests/<safe-name>.md`，记录开局可追踪目标和进度边界。
- `player_relationship` 写入 `wiki/relationships/player-<safe-name>.md`，记录初始/base 玩家关系，不写 runtime overlay。
- `sourceText` 与 `sourcePath` 均可作为输入；两者同时存在时使用 `sourceText`，同时保留 source path / file name provenance。
- raw source anchor 保存到 `wiki/sources/imports/<safe-source-name>--campaign_setup--<slot>.md`，目标文件通过 `source_import_path` 与 `source_anchor` 指回原文。
- 对能力、技能、限制、代价、可用性等 player abilities-like 内容返回 warning/review，提示应审阅 `wiki/player/abilities.md`；本阶段未完整实现 abilities slot，也不会拆到 `wiki/rules/`。
- 已验证：`npx.cmd vitest run src/lib/rpg-import/source-ingest.test.ts src/lib/rpg-import/control-doc-import.test.ts src/lib/rpg-import/campaign-setup-import.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` 通过；`npm.cmd run typecheck` 通过。
- 本阶段未实现 Stage G/H、Runtime Update Apply framework integration、UI、普通 Source Ingest 改造、runtime controller 改造、campaign setup LLM interaction、legacy/default fallback 或迁移路径；未执行 `git commit` / `git push`。

目标：

- 实现 `campaign_setup_import`。
- 首批支持 `player/player.md` 和 `current-scene/scene_state.md` bootstrap。
- 可选生成 `events/prologue.md`、`quests/*.md`、`relationships/player-*.md`。

要求：

- 必须是显式用户动作才允许写 `current-scene`。
- 已发生序章进入 `events`；未来压力进入 `plot-arcs`。
- 玩家能力、技能、限制和可用性进入 `player/abilities.md`，不拆到 `rules/`。
- 初始化时只能写固定 player slot，不新增任意 `player/*.md` 文件。

### 阶段 G：Runtime Update Apply 接入统一框架

状态：已完成。

完成记录：

- 已在 `src/lib/rpg-import/runtime-update-apply.ts` 实现 `runtime_update_apply`，并注册到 `registry.ts` / `index.ts`。
- `stage_pending` 复用现有 runtime update fenced parser、target policy、`validateRpgRuntimeUpdateProposals()` 与 `createPendingRpgUpdates()`，只返回 proposed / pending / review 数据，不写 wiki。
- `apply_pending` 接收已有 `PendingRpgUpdate[]` 并委托 `applyRpgPendingUpdates()`；只有 `accepted` 且通过 runtime write policy 的更新会实际写入。
- `writtenPaths` 来自实际 applied target paths；validation reject、pending、rejected 或 target-policy skip 不会被报告为已写入。
- 保持 `current-scene` overwrite、`events` append/create、固定 player slots / quests / `outlines/progress.md` / runtime overlays merge 语义。
- 关系和剧情弧 runtime 变化仍只允许写 `wiki/relationships/runtime/*.md` 与 `wiki/plot-arcs/runtime/*.md`；base/stable/source/manual-control 路径继续被阻止。
- `runRpgRuntimeTurnFlow()`、runtime controller、narration、pending/apply 行为在 Stage G 未改变；Redundancy Cleanup Phase 4 后 narration-block transition path 已移除，pending/apply 边界仍保持不自动 accept/reject/apply。
- 已补充 focused tests：`src/lib/rpg-import/runtime-update-apply.test.ts`。
- 验证已通过：`npx.cmd vitest run src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-runtime-update-validation.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime.test.ts` 与 `npm.cmd run typecheck`。
- 本阶段未实现 Stage H UI，未改普通 `source_ingest` / `control_doc_import` / `campaign_setup_import` 语义，未新增 legacy/default fallback 或迁移，未执行 `git commit` / `git push`。

目标：

- 将现有 runtime update / validation / pending / apply 作为 `runtime_update_apply` 暴露在 import framework 中。
- 不改变 runtime controller 现有行为，只统一类型和边界。

要求：

- `current-scene` overwrite、`events` append/create、`player/quests/outlines-progress/runtime overlays` merge 语义保持不变。
- runtime 关系变化只写 `relationships/runtime/*.md`。
- runtime 剧情弧变化只写 `plot-arcs/runtime/*.md`。
- stable/base/source/manual-control 路径继续阻止 runtime 写入。

### 阶段 H：统一 UI 入口

状态：已完成。

完成记录：

- 已新增 `src/lib/rpg-import/ui-import-options.ts` 作为小型 UI 映射层，默认语义为普通资料 `source_ingest`，且文件导入 UI 不暴露 `runtime_update_apply`。
- UI 映射层只暴露当前已实现的 Control Doc slot：`main_outline`、`outline_progress`、`rules_core`、`style_narration`。
- UI 映射层只暴露当前已实现的 Campaign Setup slot：`player_main`、`current_scene`、`events_prologue`、`main_quest`、`quest`、`player_relationship`。
- `quest` / `player_relationship` 的可选名称输入分别映射到 `options.questName` / `options.relationshipName`。
- `current_scene` 使用显式 bootstrap 勾选映射到 `options.explicitBootstrap`；未确认时不会传入 bootstrap/manualConfirm 选项，保持默认 review/skipped 边界。
- 控制文档覆盖使用显式确认勾选映射到 `options.manualConfirm`；未确认时已有高风险控制文件不会静默覆盖。
- 已新增 `src/components/sources/rpg-import-dialog.tsx`，统一入口支持普通资料多文件导入，以及 Control Doc / Campaign Setup 单文件导入。
- Sources 顶部导入按钮已改为打开统一“导入到 RPG 项目”对话框；原文件夹导入保留普通资料文件夹导入行为。
- 单个 source tree 行上的“提取到 Wiki”仍沿用现有普通 source ingest 队列，本阶段未改成专用 import mode。
- 导入结果面板会展示 `warnings`、`reviewItems`、`writtenPaths`、`skipped`；Control Doc / Campaign Setup 返回的 review item 会转换为 ReviewStore 的 `confirm` 项，包含打开相关页面和跳过动作。
- 普通资料导入仍走 `importSourceFiles()`；已在 `source-lifecycle.ts` 增加 report 型 helper 以便 UI 显示普通导入的 skipped paths，同时保持原 `importSourceFiles()` 返回 `string[]` 的旧调用契约。
- 已补充 focused tests：`src/lib/rpg-import/ui-import-options.test.ts`。
- 验证已通过：`npx.cmd vitest run src/lib/rpg-import/ui-import-options.test.ts src/lib/rpg-import/control-doc-import.test.ts src/lib/rpg-import/campaign-setup-import.test.ts src/i18n/i18n-parity.test.ts`；`npm.cmd run typecheck`。
- Dev server 前台启动验证成功，Vite 输出 `http://127.0.0.1:1420/`；本轮 Browser runtime 未提供可用 `iab` 实例，且非沙盒后台启动审批失败，因此未完成 Browser 截图/点击验证。
- 本阶段未改变 Runtime Update Apply / Play panel 行为；runtime apply 继续沿用 Play/Pending UI，不作为文件导入入口。
- 本阶段未新增 legacy/default 兼容、迁移、fallback 或旧路径保留；未执行 `git commit` / `git push`。

目标：

- UI 提供统一“导入到 RPG 项目”入口。
- 用户选择导入语义后，映射到对应 mode 和 target slot。
- 展示 warnings、review items、written paths 和 skipped paths。

要求：

- 默认仍可用普通资料导入。
- 高风险控制文档和战役初始化写入应可审阅。

## 验收标准

当方案逐步实现后，应满足：

- 普通资料仍能通过现有 source ingest 导入。
- 大纲、规则、文风不再被普通 ingest 有损洗写。
- 主线大纲写入 `wiki/outlines/main.md`，不再混入 `wiki/plot-arcs/`。
- `wiki/outlines/progress.md` 记录当前游玩过程相对大纲的位置；它可以通过 runtime pending/review 更新。
- `wiki/outlines/main.md` 不每轮改写，只有大纲修订流程或 manual/review 才能修改。
- 玩家设定可以显式初始化固定 `player/` 文件：档案、能力/技能、背包、目标、已知信息。
- `player/` 文件集合固定，后续只允许修改内容，不允许由 import/runtime 新增或删除 player 文件。
- `quests/`、`player/goals.md`、`plot-arcs/` 的目标语义清楚分离。
- `memory/` 是 Context Compiler 的长期提示与整理缓冲层，不替代 events、quests、runtime overlays、rules 或 style。
- `rules/` 与 `world/`、`style/` 与角色说话方式、`characters/` 与 `relationships/` 的边界有 prompt/schema 约束。
- `relationships/` 与 `plot-arcs/` 具备 base/runtime 分层：base 保存初始/稳定结构，runtime overlay 保存游玩中变化。
- `current-scene` 只保存即时快照；长期角色、地点、势力、物品、关系、剧情弧变化同步进入 runtime overlays。
- `items/` 与 `player/inventory.md` 的定义/持有状态保持同步但不互相替代。
- 开场场景可以通过 Campaign Setup Import 显式 bootstrap `current-scene/scene_state.md`。
- 普通 Source Ingest 仍不能写 `current-scene`。
- Runtime Update Apply 仍只写动态路径，不改 stable/source/manual-control 页面。
- Context Compiler 能优先读取固定 slots，而不是靠临时路径启发式。
- 所有导入模式都有独立 target policy、validation 和 review 边界。

## 当前文档结论

后续不应把四种路径统一成一种更大的 ingest。正确方向是统一框架、分离语义：

```text
Source Ingest            普通资料有损编译
Control Doc Import       控制文档保真规范化
Campaign Setup Import    战役初始状态 bootstrap
Runtime Update Apply     游玩中状态写回
```

这套边界可以让现有普通 ingest 继续稳定运行，同时为大纲、规则、文风、玩家设定和初始剧情提供不会互相污染的专用入口。

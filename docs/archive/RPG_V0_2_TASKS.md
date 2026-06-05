你现在接手的是 llmWikiRPG v0.1 后的下一轮迭代。项目仓库为当前分支 `rpg-version`。

## 背景

v0.1 已完成 RPG mode 的第一版适配，包括：
- RPG category registry
- RPG wiki schema
- ingest prompt 的 RPG-aware 改造
- current-scene/events/player/characters 等目录的写入策略
- RPG frontend grouping
- smoke test 和文档整理

但这次用真实萌娘百科语料进行抽取后，发现 v0.1 的真实抽取质量仍有明显问题。注意：这不是架构完全失败，而是“抽取决策层、schema 约束、真实输出校验”不足。

本轮目标不是重写项目，也不是删除 legacy LLM Wiki 功能，而是在保持 v0.1 架构兼容的前提下，做 llmWikiRPG v0.2 的抽取质量修复。

## 真实抽取评估结论摘要

输入语料：
- 远坂凛.txt
- 间桐樱.txt

主要问题：
1. `player/` 与 `characters/` 边界混淆。
   - `characters/卫宫士郎.md` 中出现“玩家角色”说法。
   - 但卫宫士郎是原作 VN 主角，不是当前 RPG 的自定义玩家角色。
   - `player/` 目录应只存用户创建/明确声明的 PC、SI、OC、穿越者等玩家角色。
   - 原作主角、可操控角色、视觉小说视角角色，默认都属于 `characters/`。

2. 所有角色都被强行生成 `玩家关联` 段落。
   - 这导致很多空泛内容。
   - `玩家关联` 实际被模型理解成“原作游戏中的功能定位”，而不是“NPC 与当前 PC 的已知关系”。
   - 应改为可空的 `与当前PC交互规则` 或类似字段。
   - 如果当前项目没有明确 PC，不应强行填写。

3. 目录覆盖不均。
   - `locations/`、`factions/`、`player/`、`quests/`、`rules/`、`style/` 等为空。
   - 原始文本中明明出现冬木市、穗群原学园、远坂家、间桐家、卫宫家、柳洞寺、教会、时钟塔、伦敦等地点。
   - 也出现远坂家、间桐家、爱因兹贝伦家、魔术协会、圣堂教会等组织/阵营。
   - 说明当前抽取 prompt/schema 没有强力触发地点、组织、阵营的二次抽取。

4. `events/` 与 `plot-arcs/` 边界混乱。
   - `events/heavens-feel-路线.md` 实际是一整条路线时间线，而不是离散事件。
   - `events/` 应存“有时间、地点、参与者、后果”的离散事件。
   - `plot-arcs/` 应存高层叙事结构、主题、阶段、冲突、伏笔。
   - 如果模型抽到“路线/时间线/剧情线”，应优先放入 `plot-arcs/`，或拆成多个离散 `events/`。

5. `current-scene/` 被静态百科文本污染。
   - 当前 `scene_state.md` 被设置为 HF True End 后赏花场景。
   - 但 `current-scene/` 应是 RPG 运行时动态状态，不应从静态百科/原作结局中自动生成。
   - 只有输入源是“当前跑团记录、玩家行动、当前会话状态、明确的开局场景”时，才允许写入 `current-scene/scene_state.md`。

6. `concepts/` 混入萌娘百科标签/萌点。
   - 如“电气白痴”“贫穷（萌点）”不应作为世界观概念独立成页。
   - 这类内容应合并进对应角色的“特征/缺陷/性格细节”。
   - `concepts/` 只保留世界观、能力体系、魔术机制、术语、规则性概念。

7. 角色条目过于标签化。
   - 远坂凛、间桐樱、卫宫士郎等角色需要更多行为模式、说话方式、行为边界、多时间点状态。
   - 尤其卫宫士郎缺少投影魔术、UBW、行为原则、HF 线价值观变化等核心设定。

8. 缺少抽取后的自动校验。
   - 当前只靠 prompt 约束模型，不足以阻止错误输出。
   - 需要增加一个轻量 validation/lint 层，在写入后或写入前检查明显错误，并生成 review/warning。

## 本轮具体任务

请按以下优先级修改。不要一次性大改所有架构；优先做能提高下一次真实抽取质量的最小闭环。

---

## 任务 1：强化 `player/` 与 `characters/` 的硬边界

检查并修改这些位置：
- `src/lib/rpg-wiki-schema.ts`
- `src/lib/ingest.ts` 中 RPG analysis/generation prompt 构造
- 必要时同步 `docs/RPG_WIKI_SCHEMA.md`
- 相关测试文件

要求：

1. 在 schema 和 prompt 中加入硬规则：

   ```text
   player/ 只允许保存当前 RPG 玩家创建或明确声明的玩家角色。
   原作角色、原作主角、视觉小说可操控角色、故事 POV 角色、动画/游戏既有角色，默认全部属于 characters/。
   除非来源文本明确说“这是当前 RPG 的玩家角色 / PC / 自定义角色 / SI / OC / 用户扮演角色”，否则禁止写入 player/。
   卫宫士郎、远坂凛、间桐樱等原作角色默认是 NPC/characters，不是 player。
````

2. 将 characters schema 中的 `playerRelevance` 改为更严格的可空含义：

   * 字段名可以保留，但描述必须改为“与当前 PC 的已知关系/态度/互动约束”。
   * 如果当前没有明确 PC，不要生成该段，或写“未建立当前 PC 关系”，不要编造。
   * 禁止把“原作主角关系”“视觉小说玩家视角”“剧情功能定位”写成玩家关联。

3. 在 prompt 中加入反例：

   * 错误：`卫宫士郎 -> player/`
   * 正确：`卫宫士郎 -> characters/`
   * 错误：`远坂凛的玩家关联：推动三条路线剧情`
   * 正确：如果没有 PC，则不写玩家关联；如果有 PC，则只写她对当前 PC 的具体态度/冲突/交互规则。

---

## 任务 2：增加 RPG 抽取前的对象类型判定指令

当前模型容易先生成页面再决定目录。请在 analysis prompt 和 generation prompt 中增加“先判定对象类型，再决定目录”的要求。

每个候选对象必须先判断：

```text
object_type:
- source
- world_fact
- npc_character
- player_character
- location
- faction
- item
- plot_arc
- discrete_event
- current_scene_state
- relationship
- character_trait_or_trivia
- wiki_noise
```

再映射目录：

```text
npc_character -> wiki/characters/
player_character -> wiki/player/，但必须满足“当前 RPG PC 明确声明”
location -> wiki/locations/
faction -> wiki/factions/
item -> wiki/items/
plot_arc -> wiki/plot-arcs/
discrete_event -> wiki/events/
current_scene_state -> wiki/current-scene/scene_state.md，仅限运行时场景输入
relationship -> wiki/relationships/
character_trait_or_trivia -> 合并进角色页，不独立成 concepts/
wiki_noise -> 忽略
world_fact -> wiki/world/ 或 wiki/concepts/，视其是否为世界背景/机制术语
```

要求：

* 不要为了填满目录而臆造。
* 但如果文本明确或强烈暗示地点/组织，应创建 `locations/`、`factions/` 条目。
* 分析阶段要列出“被忽略的 wiki 噪声”和“被合并进角色页的 trait/trivia”。

---

## 任务 3：修正 `events/` 与 `plot-arcs/` 的边界

修改 schema 和 prompt，使其明确：

`events/` 只允许离散事件。每个 event 必须至少包含：

* 时间或相对时间锚点
* 地点
* 参与者
* 发生了什么
* 后果/状态变化

如果一个候选页面包含以下特征，不能作为单一 event：

* 标题含“路线”“剧情线”“时间线”“完整经过”
* 跨越很多天/多年
* 包含 5 个以上相互独立的子事件
* 更像叙事结构而非一次发生的事件

处理方式：

* 要么放入 `plot-arcs/`
* 要么拆成多个 `events/` 文件

请在测试中加入：

* “Heaven's Feel 路线”不应作为单一 event。
* “樱被过继到间桐家”“柳洞寺决战”这类可以作为 discrete event。

---

## 任务 4：限制 `current-scene/` 的生成条件

`current-scene/scene_state.md` 只能在以下输入类型中生成或更新：

* 当前跑团会话记录
* 玩家行动后的最新状态
* GM/用户明确给出的当前场景
* RPG 开局场景初始化材料

禁止从以下材料中自动生成：

* 百科词条
* 原作结局介绍
* 人物传记
* 世界观说明
* 路线剧情总结

如果静态设定源中出现“结局场景”“赏花场景”“多年后”等内容，应写入：

* `events/`
* 或 `plot-arcs/`
* 或角色多状态快照

不要写入 `current-scene/`。

请增加 validation 或测试，覆盖：

* 静态百科文本中出现 HF True End 赏花，不应生成 `current-scene/scene_state.md`。
* 明确输入“当前场景：玩家在冬木市教会门口”时，才生成/覆盖 `current-scene/scene_state.md`。

---

## 任务 5：清理 `concepts/` 的边界，处理萌娘百科噪声

修改 schema/prompt：

`concepts/` 应只保存：

* 魔术体系
* 能力机制
* 世界观术语
* 规则性概念
* 可被多角色/多事件引用的设定概念

不应保存：

* 萌点
* 外号
* 社区标签
* 性格标签
* trivia
* 贫穷、傲娇、电气白痴这类角色特征

这些内容应合并进对应角色页的：

* `## 性格与行为模式`
* `## 特征与缺陷`
* `## 日常习惯`
* `## 可用于扮演的细节`

增加 prompt 反例：

* 错误：`concepts/贫穷-萌点.md`
* 正确：合并进 `characters/远坂凛.md`
* 错误：`concepts/电气白痴.md`
* 正确：合并进 `characters/远坂凛.md`
* 正确：`concepts/虚数属性.md`
* 正确：`concepts/投影魔术.md`
* 正确：`world/圣杯战争.md`

---

## 任务 6：增加地点和阵营的二次抽取提示

当前 `locations/` 和 `factions/` 容易为空。请在 analysis/generation prompt 中加入二次扫描要求：

在生成角色、事件、关系后，再扫描所有已识别内容，提取其中反复出现或具有剧情作用的：

* 地点
* 家族
* 组织
* 阵营
* 学校
* 教会
* 魔术机构
* 隐秘势力

示例：

* 冬木市 -> `locations/冬木市.md`
* 穗群原学园 -> `locations/穗群原学园.md`
* 远坂家 -> `factions/远坂家.md`
* 间桐家 -> `factions/间桐家.md`
* 爱因兹贝伦家 -> `factions/爱因兹贝伦家.md`
* 魔术协会 -> `factions/魔术协会.md`
* 圣堂教会 -> `factions/圣堂教会.md`

要求：

* 不要臆造详细内容。
* 信息不足时允许创建短条目，并标注“待补充/来源有限”。
* 但不要因为信息有限就完全漏掉核心地点/组织。

---

## 任务 7：增强角色页 schema，使其更适合 RPG 扮演

修改 characters schema，建议增加或强化以下字段：

```markdown
## 核心定位
## 静态设定
## 性格与行为模式
## 说话方式
## 能力与限制
## 行为边界
## 多状态快照
## 与其他角色的交互模式
## 与当前PC交互规则
## 剧情钩子
## 来源与待确认
```

说明：

* “行为边界”非常重要，要记录角色不会做什么。
* “说话方式”要记录具体语言风格，不只写“傲娇/温柔”。
* “多状态快照”用于处理原作不同路线/不同时间点，不要把 True End 状态当成唯一当前状态。
* “与当前PC交互规则”只有在存在当前 PC 时才填写。

---

## 任务 8：增加轻量 extraction validation/lint

新增一个轻量校验层，可以是以下任一形式：

* `src/lib/rpg-extraction-validation.ts`
* 或集成到现有 ingest/review 逻辑
* 或新增脚本 `scripts/evaluate-rpg-extraction.*`

最低要求：

校验生成的 FILE blocks 或已生成 wiki 目录，发现明显问题时生成 warning/review item，不一定要全部阻止写入。

必须检查：

1. `wiki/player/` 中是否出现明显原作角色。

   * 若标题或内容像“卫宫士郎/远坂凛/间桐樱/Saber/Archer”等原作角色，且没有明确 PC 声明，报错或 warning。

2. `characters/` 中是否滥用“玩家角色/玩家关联”。

   * 如果没有当前 PC，却出现“玩家角色”“玩家（卫宫士郎）”等说法，warning。

3. `events/` 是否包含路线/时间线。

   * 如果单个 events 页面包含多个时间段、多处日期、标题含“路线/时间线/剧情线”，warning。

4. `current-scene/` 是否来自静态百科。

   * 如果 sourceType 是百科/角色设定/世界设定，却生成 current-scene，warning。

5. `concepts/` 是否包含萌点/社区标签。

   * 标题或内容含“萌点”“贫穷”“电气白痴”“傲娇”等角色标签时，warning，建议合并到角色页。

6. `locations/`、`factions/` 是否在明显有候选对象时仍为空。

   * 不要硬性失败，但生成 review，提示可能漏抽。

输出形式可以是：

* console warning
* review item
* 测试可断言的 validation result

---

## 任务 9：补充测试

请至少增加以下测试：

1. prompt test：

   * RPG prompt 中包含 player/characters 硬边界。
   * RPG prompt 中包含 event vs plot-arc 区分。
   * RPG prompt 中包含 current-scene 生成条件。
   * RPG prompt 中包含 concepts 排除萌点/角色标签。

2. validation test：

   * `wiki/player/卫宫士郎.md` 被 warning。
   * `wiki/events/heavens-feel-路线.md` 被 warning。
   * `wiki/concepts/贫穷-萌点.md` 被 warning。
   * 静态百科生成 `wiki/current-scene/scene_state.md` 被 warning。

3. scenario test：

   * 输入含远坂凛/间桐樱/卫宫士郎/冬木市/远坂家/间桐家。
   * 期望生成 characters、relationships、locations、factions。
   * 不生成 player，除非源文本明确声明 PC。
   * 不把萌点写入 concepts。

---

## 任务 10：文档更新

更新或新增文档：

* `docs/RPG_EXTRACTION_EVALUATION_V0_2_PLAN.md`
* 或更新 `docs/RPG_EXTRACTION_EVALUATION.md`
* 更新 `docs/RPG_WIKI_SCHEMA.md`
* 更新 `docs/CURRENT_STATE.md`

文档中说明：

* v0.1 的 smoke test 只能证明路由/写入策略，不证明真实 LLM 抽取质量。
* v0.2 的目标是修复真实抽取中的语义分类问题。
* 明确记录哪些问题已通过 prompt/schema 修复，哪些通过 validation 发现但不自动修复。
* 保留 legacy/default LLM Wiki 行为，不要破坏非 RPG 项目。

---

## 执行约束

1. 不要删除 legacy `entities/concepts/sources/queries` 兼容逻辑。
2. 不要大规模重构 UI。
3. 不要引入大型新依赖。
4. 不要为了让测试通过而写死 Fate 专有规则；Fate 例子只作为测试样例，规则应泛化到“原作角色 vs RPG 玩家角色”“百科标签 vs 世界观概念”等通用问题。
5. 允许使用少量 Fate 名称作为 regression fixtures。
6. 修改完成后运行：

   * `npm test` 或项目现有测试命令
   * `npm run typecheck`
   * 若存在 Codex stage runner，可 dry-run 验证
7. 最后输出：

   * 修改了哪些文件
   * 每个真实评估问题对应的修复方式
   * 哪些问题仍需下一轮处理
   * 测试结果

```



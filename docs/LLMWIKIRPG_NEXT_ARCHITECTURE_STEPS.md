# llmWikiRPG 下一步架构实施路线

## 结论

下一步最应该实现的是 **RPG Runtime Context Compiler v0**。

当前项目已经具备 RPG ingest、schema、目录、动态写入校验、基础 chat 检索优先级等能力，但还没有真正的“游玩回合运行时”。从最终架构看，最先应该补的不是剧情生成，也不是状态写回，而是一个可靠的运行时上下文编译器。

原因是：Narration Generator、行动选项生成、状态抽取、写回保护、剧情大纲影响检测，后面都需要同一份稳定、精简、语义明确的输入。如果没有这一层，后续功能仍会退回到临时拼 prompt 的模式。

## 下一步目标：RPG Runtime Context Compiler v0

先实现一个只读模块，不写 wiki，不大改 UI。

建议位置：

```text
src/lib/rpg-runtime/context-compiler.ts
```

### 输入

```ts
interface CompileRpgContextInput {
  projectPath: string
  submittedAction: string
  wikiMode: "llmwikirpg"
}
```

### 输出

```ts
interface CompactStoryBrief {
  submittedAction: string
  currentScene: string
  playerState: string
  hardFacts: string[]
  activeConstraints: string[]
  presentCharacters: string[]
  relationshipTensions: string[]
  activePlotPressure: string[]
  relevantLocations: string[]
  relevantFactions: string[]
  relevantItems: string[]
  styleRules: string[]
  forbiddenContradictions: string[]
  references: string[]
}
```

### 核心行为

- 固定读取 `wiki/current-scene/scene_state.md`。
- 固定读取 `wiki/player/` 中的当前玩家状态。
- 优先读取近期 `wiki/events/`、活跃 `wiki/plot-arcs/`、相关 `wiki/relationships/`。
- 根据玩家行动检索相关 `characters/`、`locations/`、`factions/`、`items/`。
- 读取 `wiki/style/`、`wiki/rules/`、`wiki/memory/` 中的手动控制内容。
- 支持 base page + runtime overlay 的组合读取，例如：

```text
wiki/characters/tohsaka-rin.md
wiki/characters/runtime/tohsaka-rin.md
```

- 多轮压缩 wiki 内容，最终输出一份可直接交给剧情生成器的 `CompactStoryBrief`。
- 只读，不产生剧情，不生成选项，不提取状态，不写回 wiki。

## 分阶段路线

### 阶段 1：Runtime Context Compiler v0

目标：建立一轮游玩的上下文编译地基。

要点：

- 新增 `src/lib/rpg-runtime/context-compiler.ts`。
- 定义 `CompileRpgContextInput` 和 `CompactStoryBrief`。
- 从 wiki 固定栏目和检索结果中组装上下文。
- 先用确定性压缩规则，必要时再引入 LLM 压缩。
- 添加单元测试，验证：
  - 必读栏目被读取；
  - 未选择的行动选项不会进入 brief；
  - style/rules 能进入高优先级上下文；
  - runtime overlay 能覆盖或补充 base page。

### 阶段 2：RPG Turn Model

目标：让项目拥有独立于普通 chat message 的回合数据结构。

建议定义：

```ts
interface SubmittedAction {
  id: string
  text: string
  source: "selected_option" | "freeform"
  selectedOptionId?: string
}

interface RpgActionOption {
  id: string
  playerFacingText: string
  intent: "investigate" | "talk" | "fight" | "move" | "wait" | "use_item" | "custom"
  riskLevel: "low" | "medium" | "high"
  likelyAffectedPaths: string[]
}

interface TurnResult {
  narrative: string
  nextActionOptions: RpgActionOption[]
}

interface TurnRecord {
  submittedAction: SubmittedAction
  generatedNarrative: string
  references: string[]
}
```

关键规则：

- `TurnRecord = SubmittedAction + Generated Narrative`。
- `nextActionOptions` 是下一轮候选输入，不属于已经发生的事实。
- 未选择的 option 不允许进入 `events/`、`current-scene/`、`relationships/`、`plot-arcs/`。

### 阶段 3：Narration Prompt Builder

目标：基于 `CompactStoryBrief` 生成玩家可见剧情和下一步行动选项。

建议位置：

```text
src/lib/rpg-runtime/narration-prompts.ts
src/lib/rpg-runtime/action-options.ts
```

要点：

- 输入 `CompactStoryBrief` 和 `SubmittedAction`。
- 输出玩家可见剧情，不暴露内部分析。
- 同时生成 3 到 5 个下一步行动选项。
- 明确要求模型不要把候选选项写成已发生事实。
- 暂时不写回 wiki。

### 阶段 4：RPG Play Panel v0

目标：从现有 wiki QA chat 中分离出最小游玩界面。

建议位置：

```text
src/components/rpg/rpg-play-panel.tsx
src/components/rpg/current-scene-panel.tsx
src/components/rpg/action-options-panel.tsx
```

界面最小能力：

- 展示当前场景。
- 展示上一轮剧情输出。
- 展示下一步行动选项。
- 允许玩家选择选项或自由输入行动。
- 暂时只跑剧情生成，不做自动写回。

### 阶段 5：State Update Extractor + Pending Updates

目标：从完成的一轮中提取状态变更，但先进入待确认区。

建议位置：

```text
src/lib/rpg-runtime/state-extractor.ts
src/lib/rpg-runtime/update-staging.ts
```

输入：

```text
TurnRecord
```

输出：

```ts
interface ProposedWikiUpdate {
  targetPath: string
  strategy: "overwrite" | "append" | "merge"
  reason: string
  content: string
}
```

关键规则：

- 只从 `SubmittedAction + Generated Narrative` 抽取。
- 不从 `nextActionOptions` 抽取。
- 抽取结果先进入 pending updates。
- 用户确认后才写入 wiki，除非以后显式开启自动应用。

### 阶段 6：Runtime Write Policy

目标：建立运行时写回权限边界。

建议位置：

```text
src/lib/rpg-runtime/write-policy.ts
```

允许写：

| 路径 | 策略 |
|---|---|
| `wiki/current-scene/scene_state.md` | overwrite |
| `wiki/events/` | append/create |
| `wiki/player/` | merge |
| `wiki/relationships/` | merge |
| `wiki/plot-arcs/` | merge |
| `wiki/characters/runtime/` | merge |
| `wiki/locations/runtime/` | merge |
| `wiki/factions/runtime/` | merge |
| `wiki/items/runtime/` | merge |

禁止写：

| 路径 | 原因 |
|---|---|
| `wiki/world/` | 稳定世界设定 |
| `wiki/rules/` | 手动规则 |
| `wiki/style/` | 手动文风与变量 |
| base `wiki/characters/*.md` | 原作/导入角色模型 |
| base `wiki/locations/*.md` | 稳定地点信息 |
| base `wiki/factions/*.md` | 稳定阵营信息 |
| base `wiki/items/*.md` | 稳定物品信息 |

### 阶段 7：Outline Impact Detector

目标：检测玩家行动和本轮剧情是否显著冲击原剧情大纲。

建议位置：

```text
src/lib/rpg-runtime/outline-impact.ts
```

需要检测的重大偏离：

- 关键角色死亡、失踪、背叛或提前加入。
- 阵营关系改变。
- 秘密提前揭露。
- 关键地点不可用。
- 关键物品被毁、转移、提前获得。
- 玩家行动让现有剧情大纲继续推进会显得强行。
- 关系张力已经变化，旧大纲无法自然承接。

输出：

```ts
interface OutlineImpactResult {
  severity: "none" | "minor" | "major"
  affectedPlotArcPaths: string[]
  reason: string
}
```

### 阶段 8：Story Outline Regenerator

目标：当出现重大偏离时，自动修订未来剧情大纲。

建议位置：

```text
src/lib/rpg-runtime/outline-regenerator.ts
```

输入：

- 当前 `plot-arcs/`。
- 已发生 `events/`。
- 当前 `current-scene/`。
- 相关 `characters/` 与 runtime overlays。
- 相关 `relationships/` 和张力条目。
- `OutlineImpactResult`。

关键规则：

- 已发生事件不能被改写。
- 新大纲必须解释为什么故事转向。
- 新大纲应保留角色冲突、作品张力和长期主题。
- 不能为了回到原剧情而无视玩家行动造成的后果。

### 阶段 9：Relationship/Tension Deriver

目标：实现导入后的隐式关系与张力推导。

建议位置：

```text
src/lib/rpg-derivation/relationship-deriver.ts
src/lib/rpg-derivation/tension-deriver.ts
src/lib/rpg-derivation/derivation-review.ts
```

要点：

- 从 `characters/`、`events/`、`plot-arcs/`、`world/`、`dialogue corpus` 中推导隐式关系。
- 写入 `relationships/` 和 `plot-arcs/`。
- 使用 `source_kind: derived`、`confidence`、`derived_from` 标记。
- 默认进入 review/staging，避免把模型推测伪装成原作事实。

## 推荐执行顺序

优先顺序如下：

1. Runtime Context Compiler v0。
2. RPG Turn Model。
3. Narration Prompt Builder。
4. RPG Play Panel v0。
5. State Update Extractor + Pending Updates。
6. Runtime Write Policy。
7. Outline Impact Detector。
8. Story Outline Regenerator。
9. Relationship/Tension Deriver。

这个顺序的理由是：先让系统能稳定读出一轮游玩所需的上下文，再生成剧情，再处理写回，最后处理大纲再规划和隐式张力推导。这样每一步都有可测试的独立价值，不会一开始就把 runtime、UI、写回、推导和大纲重写混在一起。

## 近期验收标准

完成前四个阶段后，应当可以做到：

- 创建 `llmwikirpg` 项目。
- 导入资料并得到 RPG wiki 条目。
- 从 `current-scene` 开始一次游玩。
- 玩家输入行动。
- 系统编译 wiki 上下文为 `CompactStoryBrief`。
- 系统生成玩家可见剧情和下一步行动选项。
- 未选择的行动选项不会写入 wiki。

完成前六个阶段后，应当可以做到：

- 从一轮 `SubmittedAction + Generated Narrative` 中抽取状态变更。
- 将变更放入 pending updates。
- 只允许写入动态栏目。
- 阻止 runtime 修改稳定设定、文风、规则和 base character pages。

完成全部阶段后，应当可以做到：

- 一轮一轮推进 RPG。
- 每轮更新当前场景、事件、玩家状态、关系状态和 runtime overlays。
- 检测重大剧情偏离。
- 必要时自动修订后续剧情大纲。
- 通过关系/张力推导补足原资料中隐含但对游玩重要的冲突和互动压力。

# RPG 大纲与知识边界重设计计划

## 实施状态

### 2026-06-13 Phase 5 完成

- Phase 5 已完成，采用方向 1：保留 `playerVisibleLine` / `parallelLine` / `tensionLine` 作为当前 runtime JSON 协议字段，不进行大版本重命名。
- `src/lib/rpg-wiki-schema.ts` 的 shared runtime schema guidance 已明确三线是当前回合 runtime / narration lens target，不是 outline ownership、不是三条平等主线，也不要求每轮同步推进。
- World Tick prompt 已改为按本轮 lens bucket 分类 `worldDeltas`；低信息回合允许 `playerVisibleLine` 很窄，`parallelLine` / `tensionLine` 数组为空或只作为审计 / 压力信号存在，不能为维持三线平等推进而补造 delta。
- Recall Selector 与 Runtime Update Proposal prompt 已统一说明 `lineTarget` 是 narration lens target / fallback；写回仍由 visibility、knowledgeScope、knowledgeClaims、happenedStatus 和 targetPath 控制。
- 验证通过：`npx.cmd vitest run src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-recall-selector.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-wiki-schema.test.ts`；`npm.cmd run typecheck`。

### 2026-06-13 Phase 3 / Phase 4 完成

- Phase 3 已完成：`src/lib/rpg-wiki-schema.ts` 新增 `RpgKnowledgeActorRef`、`RpgBeliefState`、`RpgRevealState`；`src/lib/rpg-runtime/types.ts` 新增 `RpgKnowledgeClaim` 与 `RpgRevealGateRef`，并让 Recall / Outline Brief / Narration / Runtime Update Proposal 的 handoff 结构可携带 `knowledgeClaims`、`revealGateRefs` 与可选 `revealState`。
- Phase 3A 已完成：新增 `src/lib/rpg-runtime/actor-knowledge.ts`，提供 actor ref、belief state、reveal state、knowledge claim 与 reveal gate ref validator；Recall Selector、Outline Brief、Narration Generator 与 Runtime Update Proposal validation 已接入这些校验。
- Phase 3B 已完成：handoff builder 只对无歧义路径派生安全默认 claim：`wiki/player/known_information.md` -> `pc`，`wiki/outlines/*` -> `gm` holder / `pc` non-holder，`wiki/characters/runtime/<id>.md` -> `npc:<id>`，`wiki/factions/runtime/<id>.md` -> `faction:<id>`；`relationships/runtime/*`、`plot-arcs/*` 和普通事件路径不会从粗粒度字段自动猜 holder。
- Phase 3C 已完成：`npc_known` 在 actor knowledge 断言场景下必须有具体 `npc:<id>` / `faction:<id>` / `group:<id>` holder；粗粒度 `visibilityScope` / `knowledgeScope` 只保留为摘要字段，不作为旧协议 fallback。
- Phase 4 已完成：Runtime Update Proposal prompt、result validator 与 deterministic pending-stage validation 会在进入 pending 前拒绝 actor 边界不安全写回，覆盖 PC knowledge、NPC runtime knowledge、relationship information gap、plot-arc / outline progress reveal progress、events confirmed-only 与 `wiki/outlines/main.md` 普通写回禁区。
- 验证通过：`npm.cmd run typecheck`；`npx.cmd vitest run src/lib/rpg-actor-knowledge.test.ts src/lib/rpg-recall-selector.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-runtime-update-validation.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-runtime-controller.test.ts`。

### 2026-06-13 Phase 1 / Phase 2 完成

- Phase 1 已完成：`docs/RPG_WIKI_SCHEMA.md` 与 `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` 已把 `playerVisibleLine` / `parallelLine` / `tensionLine` 明确降级为每轮 brief / narration 的输出 lens，而不是大纲结构或三条平等推进主线。
- Phase 1 已补齐目录边界：`outlines/main.md` 是 GM Truth / Control Layer；`outlines/progress.md` 是当前阶段、reveal progress 和 Current Information Boundary；`player/known_information.md` 只接收 PC 已知、PC 推断和 PC 误解；NPC 知识进入 `characters/runtime/*.md`；关系信息差进入 `relationships/runtime/*.md`；伏笔状态和 reveal progress 进入 `plot-arcs/runtime/*.md`。
- Phase 2 已完成最小代码落地：`OutlineSlice` / `RecalledMaterial` 现在可携带 `outlineControl` metadata，包含 `controlKind`、`gmSummary`、`playerSafeSummary`、`actorKnowledgeRefs`、`revealGateRefs`、`mustNotRevealTo` 和 `boundaryNote`。
- Phase 2 已调整 controlled outline reader：`outlines/main.md` / `outlines/progress.md` 的受控切片不再统一以 `lineTarget: "tensionLine"` 表示大纲本体，而是先分类为 GM control / reveal gate / branch condition / hard constraint / progress marker，再给出 narration lens fallback。
- Phase 2 已调整 Outline Brief prompt：`outlineSlices` 被描述为 GM control / reveal gate / progress marker slices；`lineTarget` 被描述为 lens fallback；模型不得把 GM-only truth、delayed reveal、`parallelLineText` 或 user-visible-PC-unknown 内容写入 `playerFacingBrief.allowedKnowledge`。
- Phase 2 已增加 validator/test 覆盖：即使模型把 `outlines/main.md` delayed reveal 谎称为 `pc_visible` / `pc_known`，也会因输入 slice 的 forbidden PC boundary 被拒绝；`parallelLineBrief.grantsPcKnowledge` 仍必须为 `false`。

后续建议事项：

- 后续大版本可另开阶段评估是否把当前协议字段重命名为 `pcSceneLens`、`userDramaticLens`、`tensionPressureLens`；当前 Phase 5 明确不执行该重命名。

## 背景

当前 `llmWikiRPG` 的 runtime 协议里存在一个结构性冲突：早期设想把剧情推进拆成 `playerVisibleLine`、`parallelLine`、`tensionLine` 三线，并让三线在时间经过中平等推进；但 RPG 实际运行时，玩家角色一开始往往并不认识任何角色，也不知道大量世界真相，因此 `playerVisibleLine` 在开局阶段天然很窄，甚至只能承载当前场景可见信息。

当前真实大纲实例位于：

```text
C:\Users\Administrator\Documents\Works\Chem\test1\rpgtest7\wiki\outlines
```

该实例的 `main.md` 已经更接近 GM 全剧透控制层，`progress.md` 已经更接近当前阶段、信息边界和下一步可承接 beat 的记录。冲突主要不在大纲内容，而在代码协议仍把三线当成大纲与世界推进的一级结构。

## 当前问题

### 三线平等推进不适合大纲本体

`playerVisibleLine` 是玩家角色可见、可听、可合理推断的当前体验，不应强迫它承载完整主线推进。

`parallelLine` 更像真实用户可见但玩家角色未知的幕后镜头，不应等同于另一条必须持续推进的剧情大纲。

`tensionLine` 更适合表示关系、情感、压力、伏笔和剧情张力的运行时处理方式，不应成为 `outlines/main.md` 的默认归宿。

### 大纲和知识权限被混在一起

当前 runtime 类型同时使用：

```text
lineTarget: playerVisibleLine | parallelLine | tensionLine
visibilityScope: pc_visible | pc_inferred | user_visible_pc_unknown | gm_only | hidden
knowledgeScope: pc_known | pc_misunderstanding | npc_known | user_only | gm_only | unknown_to_pc
```

这些字段能表达一部分边界，但缺少两个关键维度：

- 哪个具体角色、阵营或主体知道某条信息。
- 该主体是知道、误解、怀疑、推断，还是完全不知道。

`npc_known` 过于粗糙，无法表达“远坂凛知道但间桐樱不知道”“言峰知道部分真相但玩家不知道”“Rider 知道樱相关秘密但不会直接说”等 RPG 常见信息差。

### Outline reader 默认把大纲切片归入 tensionLine

当前 `controlledOutlineMaterials()` 把 `outlines/main.md` 与 `outlines/progress.md` 的受控切片统一标记为：

```text
lineTarget: tensionLine
visibilityScope: gm_only
knowledgeScope: gm_only
```

这保护了剧透，但也把 GM 大纲、揭示门槛、关系张力、剧情压力混成了一个概念。后续 prompt 和 validator 只能继续围绕三线补边界，难以表达真正的知识隔离。

## 新设计原则

新设计的核心不是“三条剧情线平等推进”，而是“GM 知道全部，其他主体各自只知道自己应知道的信息”。

建议将大纲处理改成四层模型：

```text
GM Truth Layer
Actor Knowledge Layer
Reveal Gate Layer
Narration Lens Layer
```

### GM Truth Layer

GM 真相层记录完整真实设定、未来大纲、章节结构、揭示顺序、分支条件和硬约束。

主要落点：

```text
wiki/outlines/main.md
wiki/world/
wiki/rules/
base characters / locations / factions / items
```

GM 真相可以指导运行时，但不能直接暴露给玩家角色，也不能自动变成已发生事件。

### Actor Knowledge Layer

角色知识层记录“谁知道什么、谁误解什么、谁不知道什么”。

主体可以是：

```text
pc
user
gm
npc:<character-id>
faction:<faction-id>
group:<group-id>
```

主要落点：

```text
wiki/player/known_information.md
wiki/characters/runtime/*.md
wiki/factions/runtime/*.md
wiki/relationships/runtime/*.md
wiki/plot-arcs/runtime/*.md
```

`player/known_information.md` 只能记录玩家角色已知、已推断或明确误解的信息；真实用户看过的幕后镜头不能自动进入该文件。

### Reveal Gate Layer

揭示门槛层记录某个真相何时、以什么粒度、通过什么证据链允许被某个主体知道。

典型字段：

```text
truthId
currentRevealState
allowedAudience
blockedAudience
requiredEvidence
requiredRelationshipState
requiredActOrBeat
allowedRevealMode
mustNotRevealBefore
```

主要落点：

```text
wiki/outlines/main.md
wiki/outlines/progress.md
wiki/plot-arcs/runtime/*.md
wiki/relationships/runtime/*.md
```

揭示门槛不等于已发生事实；只有通过剧情行动、观察、对话、调查或事件后果确认后，才能进入对应角色的知识层。

### Narration Lens Layer

叙事镜头层是每轮临时编译出的输出视角，不是大纲本体。

建议保留现有三线名词，但降低其语义地位：

| 旧字段 | 新解释 |
|---|---|
| `playerVisibleLine` | 本轮玩家角色可见、可听、可推断的镜头。 |
| `parallelLine` | 真实用户或 GM 可见、但玩家角色未知的幕后镜头。 |
| `tensionLine` | 本轮关系、情感、伏笔、压力和节奏处理信号。 |

换言之，三线可以继续作为 narration / brief 的输出 lens，但不再作为大纲、世界状态或时间推进的平等主轴。

## 目标目录语义

### `wiki/outlines/main.md`

作者 / GM 侧完整控制层。

应存：

- 战役前提。
- Act structure。
- Intended reveals。
- Delayed reveals。
- Branch conditions。
- Must not contradict。
- GM-only truth。
- Reveal gates 的长期规则。

不应存：

- 已发生事件流水。
- 玩家当前知识清单。
- NPC 当前状态流水。
- 每轮临时 narration lens。

### `wiki/outlines/progress.md`

当前游玩相对大纲的位置与揭示状态。

应存：

- 当前 act / beat。
- 已完成、跳过、提前、延后的 beat。
- 当前 active reveal gates。
- 当前信息边界。
- 下一步最自然承接的 beat。
- 当前偏离说明。

不应存：

- 后期完整真相。
- 普通事件历史。
- 未经审阅的大纲重写。

### `wiki/player/known_information.md`

玩家角色知识层。

只接收：

- PC 亲眼所见。
- PC 亲耳听见。
- PC 被可信或不可信角色告知。
- PC 成功推理出的信息。
- PC 明确形成的误解。

禁止接收：

- GM-only 大纲。
- `parallelLineText` 中真实用户看到但 PC 不知道的幕后镜头。
- NPC 自己知道但未传递给 PC 的事实。
- 未选择的行动选项。
- 未来可能性。

### `wiki/characters/runtime/*.md`

NPC 运行时状态和知识层。

应存：

- NPC 当前状态。
- NPC 当前目标。
- NPC 已知信息。
- NPC 误解。
- NPC 对 PC 的判断。
- NPC 不愿说出的秘密。

角色 base 页仍保存稳定设定与长期可扮演信息；运行时变化进入 runtime overlay。

### `wiki/relationships/runtime/*.md`

关系中的信息差与张力。

应存：

- A 知道但 B 不知道的信息。
- 双方误解。
- 未说出口的情绪。
- 信任门槛。
- 揭示某真相会导致的关系变化。

### `wiki/plot-arcs/runtime/*.md`

未解决剧情压力与 reveal progress。

应存：

- 尚未解决的核心问题。
- 当前伏笔状态。
- 已提示但未揭示的真相。
- 可推进条件。
- 禁止过早解决的压力。

## 建议新增概念模型

第一版不必立刻落成所有类型，但后续代码演进应朝这些概念收敛。

```ts
type RpgKnowledgeActorRef =
  | "pc"
  | "user"
  | "gm"
  | `npc:${string}`
  | `faction:${string}`
  | `group:${string}`

type RpgBeliefState =
  | "known"
  | "suspected"
  | "inferred"
  | "misunderstood"
  | "unknown"

type RpgRevealState =
  | "hidden"
  | "hinted"
  | "partially_revealed"
  | "revealed"
  | "forbidden"

type RpgNarrationLens =
  | "pc_scene"
  | "user_dramatic"
  | "gm_control"
  | "npc_internal"
  | "tension_pressure"
```

### Knowledge Claim

```ts
interface RpgKnowledgeClaim {
  claimId: string
  summary: string
  truthStatus: "true" | "false" | "partial" | "unknown"
  holders: RpgKnowledgeActorRef[]
  nonHolders: RpgKnowledgeActorRef[]
  beliefStateByActor: {
    actor: RpgKnowledgeActorRef
    beliefState: RpgBeliefState
    reason: string
  }[]
  sourcePath?: string
  sourceEventPath?: string
}
```

### Reveal Gate

```ts
interface RpgRevealGate {
  gateId: string
  truthId: string
  revealState: RpgRevealState
  allowedAudience: RpgKnowledgeActorRef[]
  blockedAudience: RpgKnowledgeActorRef[]
  requiredEvidence: string[]
  requiredRelationshipState: string[]
  requiredActOrBeat?: string
  allowedRevealMode: "hint" | "partial" | "explicit" | "never"
  reason: string
}
```

### Outline Control Slice

```ts
interface RpgOutlineControlSlice {
  sliceId: string
  path: "wiki/outlines/main.md" | "wiki/outlines/progress.md"
  sectionId: string
  controlKind: "gm_truth" | "act_structure" | "reveal_gate" | "branch_condition" | "hard_constraint" | "progress_marker"
  gmSummary: string
  playerSafeSummary?: string
  actorKnowledgeRefs: string[]
  revealGateRefs: string[]
  mustNotRevealTo: RpgKnowledgeActorRef[]
}
```

## 运行时读取顺序

新的运行时判断顺序应为：

1. 判断输入材料属于 GM 真相、已发生事实、当前状态、未来大纲、伏笔压力，还是临时运行时产物。
2. 判断哪些 actor 知道、怀疑、误解或不知道该信息。
3. 判断本轮 narration 允许使用哪个 lens。
4. 根据 lens 生成 player-facing text、user dramatic text、NPC reaction、tension brief 或 GM-only review item。
5. 写回时只写入对应权限层，不把用户可见幕后镜头自动变成 PC 知识。

## 分阶段实施计划

### Phase 0 - 文档冻结

目标：先冻结新设计，避免继续沿三线平等推进追加功能。

工作项：

- 新增本计划文档。
- 在 `docs/CURRENT_STATE.md` 记录三线模型需要降级为 narration lens。
- 在 `docs/IMPLEMENTATION_LOG.md` 记录本轮只做文档计划，不改 runtime 行为。

验收：

- 文档明确 GM truth、actor knowledge、reveal gate、narration lens 四层模型。
- 文档明确 `playerVisibleLine / parallelLine / tensionLine` 不再是大纲本体的平等主轴。

### Phase 1 - Schema 文档对齐

目标：更新 `docs/RPG_WIKI_SCHEMA.md` 和架构文档中的 outline / knowledge 边界。

工作项：

- 调整 `outlines/` 定义：强调 GM truth / reveal gate / progress marker。
- 调整 `player/known_information.md` 定义：只接收 PC 知识与 PC 误解。
- 调整 `characters/runtime/*.md` 定义：允许存 NPC knowledge / misunderstanding。
- 调整 `relationships/runtime/*.md` 与 `plot-arcs/runtime/*.md` 定义：承载信息差、揭示进度和张力。
- 标注三线是 narration lens，不是大纲结构。

验收：

- 文档不再暗示三线需要平等、同步、持续推进。
- 文档能回答“GM 知道、PC 不知道、某 NPC 知道”的落点。

### Phase 2 - Outline Brief 输入模型重整

目标：让 controlled outline reader 输出 GM control / reveal gate 语义，而不是默认 `tensionLine`。

工作项：

- 修改 `controlledOutlineMaterials()` 或新增并行 builder，使 `outlines/main.md` / `progress.md` 切片带 `controlKind`、`mustNotRevealTo`、`playerSafeSummary` 等信息。
- 避免把所有 outline slice 默认标为 `tensionLine`。
- Outline Brief prompt 改为先处理 GM control slice，再决定本轮 narration lens。
- 测试覆盖：`outlines/main.md` 的 delayed reveal 不得进入 `playerFacingBrief.allowedKnowledge`。

验收：

- `outlines/main.md` 切片可以作为 GM 控制材料存在，不需要伪装成 tensionLine。
- `playerFacingBrief` 仍只接收 PC 可见 / 可推断材料。

### Phase 3 - Actor Knowledge 元数据引入

目标：补足“哪个角色知道什么”的结构表达。

工作项：

- 在 runtime types 中增加 actor knowledge / reveal gate 相关结构。
- 在 Recall Selector / Outline Brief / Narration Generator handoff 中保留 actor 级 knowledge metadata。
- 将 `npc_known` 从粗粒度枚举逐步补充为 `holders: ["npc:<id>"]` 形式。
- 增加 validator：PC knowledge 写回必须来源于 PC 可见、被告知、推断或误解证据。

验收：

- 能表达“凛知道 A，玩家不知道 A，樱误解 A”。
- `parallelLineText` 不会自动写入 `wiki/player/known_information.md`。

### Phase 4 - Runtime Update Proposal 写回边界重整

目标：让写回目标按照知识持有者分层。

工作项：

- PC 知识变化只写固定 `wiki/player/known_information.md`。
- NPC 知识变化写 `wiki/characters/runtime/*.md` 或相关 `relationships/runtime/*.md`。
- 关系信息差写 `relationships/runtime/*.md`。
- 伏笔揭示状态写 `plot-arcs/runtime/*.md` 或 `outlines/progress.md`。
- GM 主线修订继续只走独立 outline review item，不自动写 `outlines/main.md`。

验收：

- 同一条事实可以被记录为 GM truth，但只有满足证据链后才进入 PC knowledge。
- user-visible / PC-unknown 内容不会污染 player 知识层。

### Phase 5 - Narration Lens 输出重命名或语义收窄

目标：降低三线术语造成的误解。

可选方向：

1. 保留现有字段名，但在 prompt / docs / validator 中明确它们只是 narration lens。
2. 后续大版本中重命名为 `pcSceneLens`、`userDramaticLens`、`tensionPressureLens`。

建议先采用方向 1，避免一次性改动所有 runtime LLM 输出协议；但文档和 prompt 必须明确旧名的新语义，并设置后续删除 / 重命名计划。

验收：

- 模型不再被要求每轮平等推进三线。
- 开局阶段允许 `playerVisibleLine` 很窄，甚至只覆盖当前场景可见信息。

## 风险与约束

- 不为旧 `default` / legacy 项目新增兼容、迁移、fallback 或旧路径保留。
- 不通过 fallback 吞掉协议错误；如果 LLM 输出把 GM-only 信息写成 PC knowledge，应暴露为协议 / validation 问题。
- 不自动改写用户已有大纲；`outlines/main.md` 的主线修订继续需要 review。
- 不把真实用户看到的信息自动等同于玩家角色知道的信息。
- 不把未来 reveal、possible future、未选择选项写成 `events/`。

## 推荐下一步

Phase 5 已采用“保留字段名、语义收窄”的方案完成。下一轮如果继续清理，可评估是否需要为后续大版本另开重命名迁移计划；当前 runtime 协议仍保留 `playerVisibleLine` / `parallelLine` / `tensionLine`。

更直接的 cleanup 候选是：统一各 runtime validator 中的 actor-boundary 辅助函数命名，检查 prompt 与 schema 文档中是否还有把 `knowledgeScope` 当 actor holder 的表述，继续审计历史文档里把 `tensionLine` 描述成长线大纲所有权的残留表述。

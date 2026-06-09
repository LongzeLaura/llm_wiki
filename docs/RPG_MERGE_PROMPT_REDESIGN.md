# RPG 条目合并提示词改造方案

## 背景

当前 `src/lib/ingest.ts` 中的页面合并提示词仍然沿用普通百科式 wiki 的合并逻辑：把两个版本视为同一实体或概念的两个描述，并要求合并后保留双方所有事实主张。这种策略适合普通知识库，但不适合 llmWikiRPG 的最终目标。

llmWikiRPG 的目标不是把作品资料整理成普通百科，而是把作品资料、玩家状态、当前场景、关系张力、文风规则和回合日志组织成一个可读写的 RPG 运行时知识库。玩家可以与系统实时对话，并通过行动推动剧情。

因此，条目合并不能再以“保留所有事实”为最高目标，而应以“保留对 RPG 运行有用、来源支持、层级允许、状态语义正确的信息”为目标。

## 当前问题

### 1. 合并目标仍是百科式累积

当前合并提示词的核心要求包括：

```text
You are merging two versions of the same wiki page into one coherent document.
Both versions describe the same entity / concept.
Preserves every factual claim from both versions (do not drop content).
```

这会鼓励模型将所有事实、背景、描述、路线复述和 trivia 持续累积进页面，导致页面越来越长，越来越像百科，而不是可用于下一回合的运行时资料。

### 2. 与 RPG runtime 分层冲突

最终架构把 wiki 分为多层：

| 层级 | 典型路径 | 合并语义 |
|---|---|---|
| 来源证据层 | `wiki/sources/` | 来源摘要、证据边界、冲突和可信度 |
| 稳定设定层 | `wiki/world/`、`wiki/characters/`、`wiki/locations/`、`wiki/factions/`、`wiki/items/` | 稳定设定、角色模型、场景卡、势力压力源 |
| 推导解释层 | `wiki/relationships/`、`wiki/plot-arcs/` | 关系张力、未解冲突、可能发展、解释性内容 |
| 运行时状态层 | `wiki/current-scene/`、`wiki/events/`、`wiki/player/`、`wiki/quests/`、`runtime/` overlays | 当前状态、已发生事件、目标进展、临时状态 |
| 手动控制层 | `wiki/style/`、`wiki/rules/`、`wiki/memory/` | 用户手动控制和高优先级规则 |

一个通用的“同一页面合并”提示词无法同时正确处理这些语义。例如：

- `characters/` 需要合并成 NPC 操作模型，而不是人物传记。
- `relationships/` 需要合并成张力和互动杠杆，而不是重复双方人物资料。
- `plot-arcs/` 可以记录可能发展，但不能把未来可能写成已经发生。
- `events/` 只能记录离散、确认、已经发生的事件。
- `current-scene/` 应覆盖式更新最新快照，而不是累计历史。
- `runtime/` overlay 应替换旧状态，而不是把过期状态和新状态并列保留。

### 3. “保留所有事实”会绕过 RP utility gate

最终架构要求 ingest 是一个有损编译器，应筛选能影响下一回合体验的信息：

- NPC 表演
- 玩家行动选择
- 关系张力
- 场景钩子
- 剧情压力
- 状态后果
- 文风规则
- 硬设定边界

低价值百科信息、粉丝标签、版本信息、声优或制作 trivia、无行动价值的背景解释，不应进入 runtime-facing 页面。当前合并提示词却要求保留每个事实主张，等于在合并阶段重新打开了低价值信息入口。

### 4. 现有函数缺少路径上下文

当前 `MergeFn` 只接收：

```ts
existingContent: string
incomingContent: string
sourceFileName: string
signal?: AbortSignal
```

但合并策略必须依赖 `pagePath` 或 category。`mergePageContent` 的 options 中已有 `pagePath`，但没有传给 merger。因此，单纯替换 prompt 仍然无法做到按目录选择合并语义。

## 总体方案

将“页面合并”升级为 `RPG Merge Policy`：先根据目标路径判断页面类型和层级，再选择专属合并提示词和后处理校验。

推荐拆成三部分：

1. `pagePath -> merge policy`：判断合并对象属于哪类 RPG 页面。
2. `common RPG merge rules`：所有 RPG 页面共同遵守的运行时合并原则。
3. `category-specific merge contract`：按目录追加专属合并规则。

## 合并策略分组

### 1. Source / Evidence Merge

适用路径：

```text
wiki/sources/
```

目标：

- 保存来源摘要。
- 标明来源贡献、可信度、证据边界和冲突。
- 可以保留更多来源事实，但不能直接伪装成运行时状态。
- 不把来源内容自动扩散成角色当前状态或剧情事实。

### 2. Stable Operating Model Merge

适用路径：

```text
wiki/world/
wiki/characters/*.md
wiki/locations/*.md
wiki/factions/*.md
wiki/items/*.md
```

目标：

- 合并稳定设定和可运行模型。
- `characters/` 是 NPC 操作模型，不是人物传记。
- `locations/` 是可玩的场景卡，不是地点介绍。
- `factions/` 是压力源，不是组织百科。
- `items/` 是用法、代价、风险和剧情功能，不是道具设定罗列。
- 禁止把当前战役临时状态写入 base 页面。
- 当前状态应进入对应 `runtime/` overlay。

### 3. Runtime State Merge

适用路径：

```text
wiki/player/
wiki/quests/
wiki/characters/runtime/
wiki/locations/runtime/
wiki/factions/runtime/
wiki/items/runtime/
```

目标：

- 合并当前战役状态、资源、目标、临时后果。
- 新确认状态应替换旧状态，避免过期状态残留。
- 只记录已经确认的变化，不记录未选择选项或可能行动。
- 避免把临时状态提升为稳定正典。

### 4. Relationship / Tension Merge

适用路径：

```text
wiki/relationships/
```

目标：

- 合并信任、依赖、恐惧、愧疚、吸引、控制、误解、秘密和压力点。
- 记录升级或降级触发器。
- 明确区分 confirmed facts 和 inferred_for_play interpretation。
- 不重复人物传记。
- 当前关系状态要谨慎替换旧状态，避免旧状态和新状态并列。

### 5. Plot Pressure Merge

适用路径：

```text
wiki/plot-arcs/
```

目标：

- 合并未解决问题、冲突压力、伏笔、揭示节奏、推进条件和可能发展。
- 清楚区分已确认事实和未来可能。
- 不把可能发展写成已经发生的事件。
- 不提前解决冲突。
- 已发生内容应链接到 `events/`，而不是重复完整时间线。

### 6. Event Append / Event Merge

适用路径：

```text
wiki/events/
```

目标：

- 只记录离散、确认、已经发生的事件。
- 强调发生时间、地点、参与者、行为和后果。
- 不记录未来建议、伏笔、剧情大纲或未选择行动。
- 对于长路线、剧情总览或多事件材料，应拆分事件或转入 `plot-arcs/`。

说明：`events/` 更适合 append 或创建离散事件页，不适合普通 LLM 合并成长篇时间线。

### 7. Current Scene Overwrite

适用路径：

```text
wiki/current-scene/scene_state.md
```

目标：

- 只保存最新即时场景快照。
- 覆盖旧状态，不累计历史。
- 不写入长期世界观、完整人物资料、完整事件历史。
- 只来自明确 live RPG 输入。

当前代码已有 overwrite 方向，应继续保持，不应让它进入普通页面 merge prompt。

## 公共 RPG 合并提示词草案

```text
You are not merging an encyclopedia page.
You are compiling an RPG runtime wiki page.

Merge the existing page and the incoming page according to RPG runtime utility.
Keep information only if it affects at least one of:
- NPC portrayal
- player choices
- relationship tension
- scene hooks
- state consequences
- action constraints
- rules or hard setting boundaries
- atmosphere, style, or future pacing

Do not preserve low-value trivia merely because it is factual.
Do not accumulate route recap, release metadata, fan labels, or broad background prose unless it changes play.
Do not turn possible futures into happened events.
Do not merge stale runtime state with newer confirmed state.
Do not rewrite stable canon pages with current campaign changes.

Preserve wikilinks.
Preserve frontmatter structure.
Output one complete Markdown file: YAML frontmatter + body.
The first character of the response must be `-`, starting the opening `---`.
No preamble, no analysis prose.
```

## 目录专属提示词草案

### Characters

```text
For wiki/characters/*.md:
Merge into a roleplay-ready NPC operating model, not a biography.

Prioritize:
- Runtime Capsule
- hard canon constraints that affect portrayal
- psychological model
- behavior rules
- pressure reactions
- dialogue style
- relationship levers
- evidence and uncertainty

Remove or compress trivia that does not affect portrayal or player interaction.
Do not preserve long biography sections unless they directly support behavior, choices, tension, or constraints.
Runtime-only current campaign state belongs in wiki/characters/runtime/ and must not be merged into the base character page.
```

### Relationships

```text
For wiki/relationships/*.md:
Merge relationship state as playable tension, not as duplicate biographies.

Prioritize:
- trust and distrust
- dependence and obligation
- fear, guilt, attraction, rivalry, control, or protection
- secrets and misunderstandings
- leverage points
- escalation and de-escalation triggers
- changes that require setup

Clearly separate confirmed shared history from inferred_for_play interpretation.
Replace stale current relationship state instead of keeping contradictory old and new states side by side.
Do not duplicate full character profiles.
```

### Plot Arcs

```text
For wiki/plot-arcs/*.md:
Merge unresolved story pressure, not a route encyclopedia.

Prioritize:
- unresolved questions
- active conflicts
- foreshadowing
- reveal pacing
- blockers and dependencies
- possible developments
- conditions for progression

Clearly separate confirmed facts from possible futures.
Do not write possible future developments as already happened.
Do not resolve conflicts early.
Link to events for confirmed occurrences instead of duplicating the full event timeline.
```

### Runtime Overlays

```text
For wiki/*/runtime/*.md and other runtime state pages:
Merge current campaign state, not stable canon.

New confirmed state replaces stale old state.
Keep only information that is currently relevant for the next turns.
Do not keep obsolete locations, attitudes, holders, conditions, or temporary effects unless they still matter as consequences.
Do not record unchosen options, possible actions, or speculative future plans as accepted state.
```

### Player / Quests

```text
For wiki/player/ and wiki/quests/:
Merge accepted player-facing state.

Prioritize:
- current goals
- resources and inventory
- wounds, conditions, obligations, promises, permissions
- knowledge the player actually has
- objective progress
- obstacles and completion status

Do not include ordinary NPC state.
Do not include unaccepted plans or unchosen options.
If new accepted state contradicts old state, update the state instead of preserving both.
```

## 代码改造建议

### 1. 让合并函数接收路径上下文

当前 `MergeFn` 没有 `pagePath`。推荐改为：

```ts
export interface MergeContext {
  sourceFileName: string
  pagePath: string
  signal?: AbortSignal
}

export interface MergeFn {
  (
    existingContent: string,
    incomingContent: string,
    context: MergeContext,
  ): Promise<string>
}
```

然后在 `mergePageContent` 中把 `opts.pagePath` 传入 merger。

如果想做最小改动，也可以让 `buildPageMerger(llmConfig, pagePath)` 返回闭包，但长期看不如显式 `MergeContext` 清晰。

### 2. 新增 RPG merge policy registry

建议新增：

```text
src/lib/rpg-merge-policy.ts
```

职责：

- 从 `pagePath` 推断 category。
- 判断是否是 base 页、runtime overlay、source 页、relationship 页、plot arc 页等。
- 返回 merge kind、允许内容、禁止内容、必需 section、旧状态替换规则和 prompt fragment。

示例结构：

```ts
export type RpgMergeKind =
  | "source-evidence"
  | "stable-operating-model"
  | "runtime-state"
  | "relationship-tension"
  | "plot-pressure"
  | "event-history"
  | "current-scene"

export interface RpgMergePolicy {
  kind: RpgMergeKind
  categoryId: string
  promptFragment: string
  allowCompression: boolean
  replaceStaleState: boolean
  requireRuntimeCapsule: boolean
}
```

### 3. 将 prompt 构造拆为公共规则和目录规则

建议把当前 `buildPageMerger` 中的单一 prompt 改成：

```ts
const policy = getRpgMergePolicy(pagePath)
const systemPrompt = [
  buildCommonRpgMergePrompt(),
  policy.promptFragment,
  buildOutputRequirementsPrompt(),
].join("\n")
```

这样后续新增 `quests`、`style`、`rules` 或 derivation review 时，不需要继续扩大一个巨大的通用 prompt。

### 4. 调整 body length sanity check

当前 `page-merge.ts` 使用 70% body length threshold 防止 LLM 截断。RPG 合并会主动删除百科噪声，因此“变短”不一定是失败。

建议改成按 policy 判断：

- `sources/` 可以保留较高阈值。
- `characters/`、`relationships/`、`plot-arcs/` 允许合理压缩。
- `runtime-state` 更应允许替换旧状态导致长度变短。
- 对是否失败的判断应更多依赖结构校验、frontmatter、Runtime Capsule、禁止内容检测，而不是单纯长度。

### 5. 合并后运行 RPG lint / validator

合并后应至少检查：

- 非 source runtime-facing 页面是否有 `Runtime Capsule`。
- `Runtime Capsule` 是否包含行动钩子、约束、张力、状态影响、扮演规则或氛围信号。
- `events/` 是否写入未来可能、伏笔或下一步建议。
- `plot-arcs/` 是否把可能发展写成已发生事实。
- base `characters/locations/factions/items` 是否混入 runtime-only 当前状态。
- `current-scene` 是否被错误累计历史。
- 未选择选项是否污染事件、场景、关系或剧情线。

## 推荐实施顺序

1. 先让 merger 获得 `pagePath`，这是按目录选择 prompt 的前提。
2. 新增 `rpg-merge-policy.ts`，实现路径到 merge kind 的判断。
3. 把 `buildPageMerger` 改成公共 RPG 合并原则 + 目录专属合并合同。
4. 为 `characters`、`relationships`、`plot-arcs`、`player/runtime` 各补 1 到 2 个测试。
5. 调整 `BODY_SHRINK_THRESHOLD`，改为 policy-aware sanity check。
6. 合并后接入或复用现有 RPG extraction lint，发现污染时进入 warning / review / fallback。

## 验收标准

改造完成后，页面合并应满足：

- 不再默认保留所有事实主张。
- 低价值百科信息不会因 re-ingest 被重新累积进 runtime-facing 页面。
- 角色页保持 NPC 操作模型，而不是人物百科。
- 地点页保持场景卡，而不是地点介绍。
- 势力页保持压力源，而不是组织历史。
- 物品页强调用法、代价、限制和剧情功能。
- 关系页强调张力、杠杆和变化触发器。
- 剧情线页清楚区分已确认事实和未来可能。
- 事件页只记录已经发生的离散事件。
- runtime overlay 能替换旧状态，避免过期状态并列残留。
- `current-scene` 始终是最新快照，不累计历史。

## 第一阶段完成状态

`RPG Merge Policy v0` 已于 2026-06-07 完成并验证通过。

已完成内容：

- `MergeFn` 已改为接收 `MergeContext`，包含 `sourceFileName`、`pagePath` 和 `signal`。
- 已新增路径感知的 RPG merge policy registry：`src/lib/rpg-merge-policy.ts`。
- `buildPageMerger()` 已改为通过 `buildRpgMergeSystemPrompt(context.pagePath)` 构建 RPG runtime-oriented 合并提示词。
- 旧的百科式“保留所有事实主张”要求不再作为生产合并 prompt 的目标。
- `mergePageContent()` 的 body shrink sanity check 已改为按 `pagePath` 对应 policy 使用不同阈值。
- 原有 deterministic merge safety 仍保留，包括 frontmatter array union、locked frontmatter fields、updated stamp、LLM 失败 fallback 和无 frontmatter fallback。

验证结果：

- `npx.cmd vitest run src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` 通过。
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

未在第一阶段执行的内容：

- 未实现合并后 RPG 语义 lint。
- 未实现 section-aware merge。
- 未对齐 runtime write merge。
- 未实现真实模型评估、审阅队列或用户可控压缩。
- 未修改 runtime controller、runtime write policy、UI、context compiler、relationship deriver 或 outline 模块。

## 后续阶段简略计划

### 第二阶段：合并后 RPG 语义校验

完成状态：`RPG Merge Lint v0` 已于 2026-06-07 完成并验证通过。

已完成内容：

- 在 LLM merge 输出被接受前增加轻量 RPG merge lint。
- 检查非 source runtime-facing 页面是否缺少 `Runtime Capsule`。
- 检查 `events/` 是否混入未来可能、下一步建议或未选择选项。
- 检查 `plot-arcs/` 是否把可能发展写成已发生事实。
- 检查 base `characters/locations/factions/items` 是否混入 runtime-only 当前状态。
- 只产生 warning / reject fallback，不做自动大规模重写。
- `wiki/sources/` 不要求 `Runtime Capsule`；`wiki/style/`、`wiki/rules/`、`wiki/memory/` 作为 manual-control 也不要求 `Runtime Capsule`。
- `mergePageContent()` 在 frontmatter parse 和 body shrink sanity check 之后、deterministic post-processing 之前调用 `lintRpgMergedPage()`。
- reject issue 会触发 `console.warn`、调用现有 backup hook，并 fallback 到 array-merged incoming；warning-only issue 会记录警告并继续接受 LLM merge 输出。

验证结果：

- `npx.cmd vitest run src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` 通过。
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

未在第二阶段执行的内容：

- 未实现 section-aware merge。
- 未实现 post-ingest distiller。
- 未对齐 runtime write merge。
- 未修改 runtime controller、runtime write policy、UI、context compiler、relationship deriver 或 outline 模块。
- 未调用真实 LLM。
- 未执行 `git commit` 或 `git push`。

### 第三阶段：section-aware merge

完成状态：`Section-aware Merge v0` 已于 2026-06-07 完成并验证通过。

已完成内容：

- 新增 `src/lib/rpg-section-merge.ts`，作为 LLM merge 候选通过 frontmatter parse 和 body shrink sanity check 后的轻量 section 后处理层。
- `mergeRpgSections()` 识别 `##` / `###` heading，保留 frontmatter 原样，并按归一化 section name 应用策略。
- `Runtime Capsule` 默认尊重 LLM；如果 LLM 遗漏但 incoming 或 existing 中已有 capsule，则保守补回一个已有 capsule，不自动生成新 capsule。
- `Current State` 在 runtime-state、relationships、current-scene 页面中使用替换语义，优先 LLM，其次 incoming，不并列保留 stale existing state。
- `Evidence and Uncertainty` 与 `Confirmed Facts` 使用 append-dedupe 合并 bullet/list 行；`Confirmed Facts` 不吸收 `Possible Futures`。
- `wiki/plot-arcs/` 的 `Possible Futures` 使用 append-dedupe 保留可能发展；`wiki/events/` 中的 `Possible Futures` 不被自动搬运或修复，继续交给 RPG merge lint reject/fallback。
- runtime-facing 非 source 页面不会把 LLM 已删除的 low-value section 从 existing/incoming 补回；`wiki/sources/` 不受 low-value drop 影响。
- `mergePageContent()` 已在 RPG merge lint 前调用 section-aware merge，并保持 LLM failure、无 frontmatter、body shrink、lint reject、array union、locked fields、updated stamp 等安全边界。

验证结果：

- `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` 通过。
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

未在第三阶段执行的内容：

- 未实现 runtime write merge 对齐。
- 未实现 post-ingest distiller。
- 未修改 runtime controller、runtime write policy、UI、context compiler、relationship deriver 或 outline 模块。
- 未调用真实 LLM。
- 未执行 `git commit` 或 `git push`。

### 第四阶段：runtime write merge 对齐

完成状态：`Runtime Write Merge Alignment` 已于 2026-06-07 完成并验证通过。

已完成内容：

- runtime write policy 的 accepted `merge` 写入已从 conservative append-style concatenation 升级为复用 `mergeRpgSections()` 的 section-aware merge。
- 覆盖 `wiki/player/`、`wiki/quests/`、`wiki/relationships/`、`wiki/plot-arcs/`，以及 `wiki/characters/runtime/`、`wiki/locations/runtime/`、`wiki/factions/runtime/`、`wiki/items/runtime/` runtime overlays。
- `Current State` 在 runtime merge 中使用替换语义，避免 stale player state、quest progress、relationship state 和 overlay state 与新确认状态并列残留。
- `Evidence and Uncertainty`、`Confirmed Facts` 和 `plot-arcs/` 的 `Possible Futures` 继续使用 append-dedupe；`Possible Futures` 不会提升为 `Confirmed Facts`。
- runtime-facing low-value sections 不会从旧页面回流，包括 trivia、release metadata、voice actor、production notes、fan tags、full biography / character profile 以及对应中文标题。
- `current-scene` 仍然走 overwrite；`events` 仍然走 append/create；stable/base/source/manual-control 路径仍然由 runtime write policy 阻止。

验证结果：

- `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-write-policy.test.ts` 通过。
- `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts src/lib/rpg-write-policy.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

未在第四阶段执行的内容：

- 未修改 runtime controller、UI、context compiler、relationship deriver 或 outline 模块。
- 未实现 post-ingest distiller。
- 未调用真实 LLM。
- 未执行 `git commit` 或 `git push`。

### 第五阶段：真实模型评估与回归样例

完成状态：`RPG Merge Evaluation Samples` 已于 2026-06-07 完成并验证通过。

已完成内容：

- 新增 `src/lib/rpg-merge-evaluation.ts` 和 `src/lib/rpg-merge-evaluation.test.ts`，使用固定 deterministic mock 样例评估合并质量；未调用真实 LLM。
- 固定 5 个 regression samples：
  - `wiki/characters/*.md` 角色页保持 NPC operating model，不回退人物传记、trivia、声优/metadata。
  - `wiki/relationships/*.md` 关系页保留 playable tension 和当前关系状态，不重复双方人物介绍。
  - `wiki/plot-arcs/*.md` 将 Possible Futures 保留在 Possible Futures，不污染 Confirmed Facts。
  - `wiki/events/*.md` 对未来建议、未选择行动、possible futures 触发 reject/fallback。
  - `wiki/player/` 当前状态用新确认状态替换旧状态，不并列残留。
- 根据样例结果做了小范围修正：`rpg-merge-lint` 现在会拒绝 `plot-arcs` 的 `Confirmed Facts` 内出现 possible-future 语言，同时允许正常分离的 `Confirmed Facts` + `Possible Futures`。
- 修复 `rpg-section-merge` append-dedupe 输出的 Markdown section 间隔，避免下一节 heading 贴到上一节最后一条 bullet 后导致 lint 误判。

验证结果：

- `npx.cmd vitest run src/lib/rpg-merge-evaluation.test.ts` 通过。
- `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts src/lib/rpg-write-policy.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

### 第六阶段：审阅队列与用户可控压缩

完成状态：`RPG Merge Review + User-Controlled Distill` 已于 2026-06-07 完成并验证通过。

已完成内容：

- 新增 `src/lib/rpg-merge-review.ts` 和 `src/lib/rpg-merge-review.test.ts`，作为纯函数 / service 层复用现有 review item 形状，不做 UI 大改造。
- 高风险 merge 输出会返回 `suggestion` review item，而不是作为 accepted content 静默通过；高风险条件覆盖：
  - merge lint `shouldReject`。
  - `events/` future / next-step / unchosen option 污染。
  - `plot-arcs/` future-as-fact 或 possible future 写入 `Confirmed Facts`。
  - base `characters/locations/factions/items` 混入 runtime-only current state。
  - `current-scene` 累计历史 / full profile / timeline。
  - body shrink 或 significant section deletion 风险。
- 超长 runtime-facing 页面会生成 post-merge distill proposal，并复用 `distillRpgWikiPage()` / `createRpgDistillReviewItems()`；不会自动覆盖原文。
- review service 在生成 proposal 时显式保留 low-value sections，让压缩建议进入 proposal，而不是在用户确认前删除手写内容。
- 新增 accepted-only distill apply helper：只有 `accepted` proposal 才生成 compressed candidate；`pending` / `rejected` proposal 不 apply。
- `wiki/sources/`、`wiki/style/`、`wiki/rules/`、`wiki/memory/` 不参与 runtime-facing 自动压缩。
- `current-scene` overwrite、`events` append/create、stable/base/source/manual-control runtime write blocked 边界保持不变。

验证结果：

- `npx.cmd vitest run src/lib/rpg-merge-review.test.ts` 通过。
- `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts src/lib/rpg-write-policy.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

未执行内容：

- 未调用真实 LLM；真实模型评估入口仍应由显式 env/config gate 控制后再另行接入。
- 未自动写 `.llm-wiki/review.json`，未改 UI，未自动应用压缩或 section 重排。
- 未执行 `git commit` 或 `git push`。


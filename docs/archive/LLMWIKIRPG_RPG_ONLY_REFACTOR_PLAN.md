# LLMWikiRPG RPG-Only Refactor Plan

## 1. 结论与总原则

### 1.1 明确结论

本计划的明确建议是：

- 不建议回滚到原始 `llm_wiki` 从头重做。
- 建议保留当前 `rpg-version` 分支上的 RPG 资产。
- 真正需要推翻的不是 RPG schema、目录语义、动态写入和测试资产，而是当前 `default prompt + RPG patch` 的拼接式 ingest 设计。
- 目标是把 `llmwikirpg` 逐步收敛为 `RPG-first / RPG-only` 的 ingest pipeline。
- 这次收敛的重点是“从 default 模式中解耦 RPG prompt 与 RPG ingest 逻辑”，不是立刻删除 default mode。

### 1.2 必须遵守的总原则

1. 不回滚到原始 `llm_wiki` 重做。
2. 优先保留现有 RPG 资产：
   - `rpg-categories`
   - `rpg-wiki-schema`
   - 目录语义
   - 动态写入策略
   - 校验与合并逻辑
   - RPG 相关测试与文档
3. 当前真正需要推翻的是 `default prompt + RPG patch` 的拼接式 prompt 设计。
4. 目标是先把 RPG prompt 和 RPG ingest 逻辑从 default 模式中解耦，而不是一开始就删除 default mode。
5. `Phase 1` 到 `Phase 3` 严禁删除 default mode。
6. 只有 `Phase 4` 才允许评估 default mode 是否隐藏、legacy 化或移除。
7. 每个阶段必须可单独执行、可测试、可回滚。
8. 每个阶段都必须以独立 Codex 窗口执行，不允许一个窗口连续执行多个 Phase。
9. 每个阶段结束后必须产出 handoff 文档，供下一阶段的新窗口读取。

### 1.3 非目标

本轮计划的非目标：

- 不重写整个项目架构。
- 不重写 chat / retrieval / UI 主体。
- 不在本轮一开始删除 legacy `entities` / `concepts` / `sources` 行为。
- 不把所有 RPG 逻辑一次性搬成新 runtime。
- 不只做“把长 prompt 拆成多个 helper 后继续全部注入”的表面重构。

## 2. 当前代码审计结论

### 2.1 当前 RPG 模式如何接入默认流程

当前 `llmwikirpg` 仍主要挂在 shared ingest pipeline 上：

- [src/lib/ingest.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/ingest.ts)
  - `autoIngest()` 是统一入口。
  - `buildAnalysisPrompt(..., wikiMode)` 在 default analysis prompt 上追加 RPG guidance。
  - `buildGenerationPrompt(..., wikiMode)` 在 default generation prompt 上追加 RPG guidance。
- [src/lib/wiki-mode.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/wiki-mode.ts)
  - 负责 `default` / `llmwikirpg` 检测。
- [src/lib/project-mode.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/project-mode.ts)
  - 负责 RPG 项目 bootstrap。
- [src/components/chat/chat-panel.tsx](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/components/chat/chat-panel.tsx)
  - 根据 `wikiMode` 开启 RPG retrieval priority。

结论：

- 当前流程不是“没有 RPG pipeline”，而是“RPG pipeline 已经长出来，但仍寄生在 default ingest 框架里”。

### 2.2 当前值得保留的资产

以下资产应明确视为保留对象，而不是回退后重做：

- [src/lib/rpg-categories.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-categories.ts)
- [src/lib/rpg-wiki-schema.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-wiki-schema.ts)
- [src/lib/rpg-dynamic-update.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-dynamic-update.ts)
- [src/lib/rpg-extraction-validation.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-extraction-validation.ts)
- [src/lib/rpg-query-priority.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-query-priority.ts)
- [src/lib/wiki-page-types.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/wiki-page-types.ts)
- [src/lib/wiki-type-style.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/wiki-type-style.ts)
- [src/lib/ingest.prompt.test.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/ingest.prompt.test.ts)
- [src/lib/ingest.scenarios.test.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/ingest.scenarios.test.ts)
- [src/lib/rpg-smoke.test.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-smoke.test.ts)

这些资产的价值在于：

- 已经把 RPG 目录结构编码进系统。
- 已经实现 `current-scene overwrite`、`events append`、`merge/cautious-merge`。
- 已经积累了边界校验与回归用例。

### 2.3 当前真正的结构性问题

当前主要问题不在 schema，而在 prompt 与 orchestration：

1. `buildAnalysisPrompt()` 仍然是 default analysis prompt 再拼接 `buildRpgExtractionAnalysisGuidance()`。
2. `buildRpgExtractionAnalysisGuidance()` 过长，混入路由、角色卡、边界案例、FSN 示例、反误判规则。
3. `buildRpgCharacterAnalysisGuidance()` 被塞进 Stage 1，导致 Stage 1 承担 Stage 2 页面生成职责。
4. `buildGenerationPrompt()` 仍保留强 default 结构，只在后面补 RPG guidance。
5. `executeIngestWrites()` 仍未完全对齐 `autoIngest()` 的 RPG writer 语义。

### 2.4 当前必须收敛的兼容层

以下内容必须被视为收敛目标：

- `defaultAnalysisPrompt + buildRpgExtractionAnalysisGuidance()`
- `defaultGenerationPrompt + buildRpgWikiDirectoryGuidance()`
- Stage 1 中注入角色卡完整页面契约
- 通用 RPG prompt 中混入 FSN / Fate / UBW / HF / Fuyuki / Holy Grail 示例
- 同一规则在多个 helper 中重复堆叠
- 为求“安全”而在 Stage 2 默认注入所有目录契约

## 3. 重构目标

### 3.1 最终方向

重构后的目标形态：

- RPG analysis prompt 是独立 prompt。
- RPG generation prompt 是独立 prompt。
- Stage 1 只做对象分析，不做页面写作契约。
- Stage 2 根据目标目录注入最小必要页面契约。
- domain-specific guidance 独立存在，不再污染通用 RPG prompt。
- `ingest.ts` 不再承载大段 RPG prompt 文本。

### 3.2 重要边界

- `Phase 1-3` 不删除 default mode。
- `Phase 1-3` 不重写 chat retrieval 主体。
- `Phase 1-3` 不大改 writer 之外的 UI 结构。
- `Phase 4` 才评估 default mode 的最终定位。

## 4. Prompt 重构强约束

## 4.1 RPG prompt 必须与 default prompt 彻底分离

以下模式不再允许继续存在：

```ts
defaultAnalysisPrompt + buildRpgExtractionAnalysisGuidance()
defaultGenerationPrompt + buildRpgWikiDirectoryGuidance()
```

目标形态至少应达到：

```ts
buildAnalysisPrompt(...) {
  return wikiMode === "llmwikirpg"
    ? buildRpgAnalysisPrompt(...)
    : buildDefaultAnalysisPrompt(...)
}

buildGenerationPrompt(...) {
  return wikiMode === "llmwikirpg"
    ? buildRpgGenerationPrompt(...)
    : buildDefaultGenerationPrompt(...)
}
```

### 4.2 `ingest.ts` 不再承载大段 RPG prompt 文本

推荐文件结构：

```text
src/lib/ingest.ts
  只保留 ingest 流程编排、dispatcher、调用关系

src/lib/prompts/default-ingest.ts
  default llmwiki analysis / generation prompt

src/lib/prompts/rpg-ingest.ts
  RPG analysis / generation prompt

src/lib/prompts/rpg-page-guidance.ts
  characters、player、events、current-scene、plot-arcs、relationships 等页面契约

src/lib/prompts/domain-guidance.ts
  FSN 等 domain-specific guidance
```

如果后续实施时认为路径需微调，可以采用等价结构；但必须满足：

- `src/lib/ingest.ts` 不再堆放大段 RPG prompt。
- default prompt 与 RPG prompt 位于不同模块。
- page guidance 与 domain guidance 分离。

### 4.3 防止“只拆函数，不降复杂度”

必须明确禁止以下伪重构：

1. 把一个超长 RPG prompt 拆成十几个 helper 后，仍然在一次调用中全部注入。
2. Stage 1 继续携带 Stage 2 页面契约。
3. 为了“保险”把所有目录 guidance 全部塞进 Stage 2。
4. 把 FSN 示例从一个函数搬到另一个函数，但仍留在通用 RPG prompt。

## 5. Stage 1 RPG Analysis Contract

### 5.1 Stage 1 的唯一职责

Stage 1 只负责：

- candidate object 识别
- `object_type` 分类
- `suggested_route`
- `action`
  - `create`
  - `update`
  - `merge-into`
  - `ignore`
- `evidence_summary`
- `brief_inference`
- `confidence`
- `uncertainty`
- `ignored noise`
- `merge targets`
- `open questions`

### 5.2 Stage 1 明确禁止项

Stage 1 不允许注入完整页面写作契约，例如：

- `Character Impression`
- `Psychological Model`
- `Dialogue Style`
- `RP Usage`
- `Relationship Dynamics`

Stage 1 也不允许注入 domain-specific 示例，例如：

- `Fate`
- `UBW`
- `HF`
- `Fuyuki`
- `Holy Grail`
- `Heaven's Feel`

### 5.3 Stage 1 建议输出结构

```md
## Candidate Objects
- Name:
  - object_type:
  - suggested_route:
  - action:
  - evidence_summary:
  - brief_inference:
  - confidence:
  - uncertainty:

## Ignored Noise

## Merge Targets

## Open Questions
```

## 6. Stage 2 Generation Contract

### 6.1 Stage 2 的职责

Stage 2 才负责：

- 根据 Stage 1 结果生成 FILE blocks
- 根据目标目录注入最小必要 guidance
- 根据 schema / directory contract 约束页面结构

### 6.2 Schema-driven / directory-driven 原则

必须遵守以下原则：

1. 目录契约优先从现有 RPG schema、`rpg-categories`、目录定义中派生。
2. 不要在 prompt 中重复维护大量与 schema 相同的信息。
3. 只对边界复杂、误判风险高的目录手写额外 guidance：
   - `characters`
   - `player`
   - `current-scene`
   - `events`
   - `plot-arcs`
   - `relationships`
4. `locations`、`factions`、`items` 等目录应尽量使用短契约。
5. Stage 2 不应默认注入所有目录契约。
6. Stage 2 应根据本轮目标 path / schema / object_type 注入最小必要 guidance。

### 6.3 Stage 2 契约注入方案比较

#### 方案 A：基于目标 path / schema 注入

示例：

- `wiki/characters/*.md` 注入 `character page guidance`
- `wiki/current-scene/*.md` 注入 `current scene guidance`
- `wiki/player/*.md` 注入 `player state guidance`

优点：

- 稳定
- 规则清晰
- 测试容易
- 不依赖 Stage 1 文本格式过强

缺点：

- 当 route 决策不明确时，需要 fallback 逻辑

#### 方案 B：基于 Stage 1 的 `object_type` / `suggested_route` 注入

优点：

- 更贴近分析结果
- 便于做 object-specific guidance

缺点：

- 对 Stage 1 输出结构依赖更强
- 如果 Stage 1 结果不稳定，Stage 2 guidance 会抖动

### 6.4 推荐方案

推荐：

- **以 `path / schema` 驱动为主**
- **以 `object_type / suggested_route` 作为辅助**

具体规则：

1. 如果目标 path / schema 可以可靠判断，则按 path / schema 注入。
2. 如果 path 尚不稳定，则使用最小 RPG generation contract。
3. `object_type` 只用于补充精细 guidance，不作为唯一依据。
4. 不允许因为“不确定”而把全部目录契约都塞进 prompt。

## 7. Domain Guidance 约束

### 7.1 Domain guidance 独立化

FSN、Fate、UBW、HF 等示例不得再出现在通用 RPG prompt 中。

它们只能存在于：

- `domain-guidance.ts`
- 或项目级配置注入层

### 7.2 通用 RPG prompt 与 domain prompt 的边界

通用 RPG prompt 只保留：

- 对象识别
- 目录路由
- 边界判定
- 证据强度
- 不确定性表达

domain guidance 只负责：

- 特定作品
- 特定世界观
- 特定人物体系
- 特定路线/派系/命名约定示例

## 8. Prompt 污染检测与测试标准

### 8.1 RPG analysis prompt 禁止出现的 default 结构

RPG analysis prompt 不得出现：

```text
## Key Entities
## Key Concepts
Main Arguments & Findings
Recommendations
```

### 8.2 RPG analysis prompt 禁止出现的 Stage 2 页面契约

RPG analysis prompt 不得出现：

```text
Character Impression
Psychological Model
Dialogue Style
RP Usage
```

### 8.3 RPG analysis prompt 禁止出现的 domain-specific 词

RPG analysis prompt 不得出现：

```text
Fate
UBW
HF
Fuyuki
Holy Grail
Heaven's Feel
```

### 8.4 RPG analysis prompt 必须出现的结构

RPG analysis prompt 必须显式包含：

```text
Candidate Objects
object_type
suggested_route
action
evidence_summary
brief_inference
confidence
uncertainty
Ignored Noise
Merge Targets
Open Questions
```

### 8.5 长度与复杂度目标

- 不追求极短 prompt。
- 但必须显著短于旧版“default prompt + RPG 大段 guidance”的拼接版本。
- Stage 1 绝不允许因为角色卡契约和目录契约而膨胀成长 prompt。
- Stage 2 绝不允许默认携带全目录契约。

## 9. Chain-of-Thought 风险修正

不允许要求模型输出完整思维链、隐藏推理过程或逐步 chain-of-thought。

原先类似：

```text
make the inferential step visible
```

应改写为：

```text
evidence_summary: 简洁列出依据；
brief_inference: 用一到两句话说明基于证据得到的推断；
uncertainty: 明确指出证据缺口、冲突或低置信度；
Do not output hidden reasoning or step-by-step chain-of-thought.
```

## 10. 单阶段、单窗口、可交接执行模型

### 10.1 执行模型

后续执行必须采用：

```text
一个 Phase = 一个独立 Codex 窗口
```

明确规则：

1. 每个新窗口只执行一个特定 Phase。
2. 不允许同一窗口连续执行多个 Phase。
3. 每个阶段必须自包含，不依赖前一个窗口的隐藏上下文。
4. 每个阶段结束后必须写 handoff 文档。
5. 下一阶段的新窗口必须先读取计划文档与上阶段 handoff 文档，再开始执行。

### 10.2 Handoff 目录

建议在执行阶段使用：

```text
docs/refactor-handoffs/
```

阶段结束后生成：

```text
docs/refactor-handoffs/PHASE_0_HANDOFF.md
docs/refactor-handoffs/PHASE_1_HANDOFF.md
docs/refactor-handoffs/PHASE_2_HANDOFF.md
docs/refactor-handoffs/PHASE_3_HANDOFF.md
docs/refactor-handoffs/PHASE_4_HANDOFF.md
docs/refactor-handoffs/PHASE_5_HANDOFF.md
```

### 10.3 Handoff 模板

每个 handoff 文档必须至少包含：

```md
# Phase X Handoff

## 本阶段目标
## 实际修改文件
## 未完成事项
## 测试结果
## 失败测试与原因
## 重要设计决策
## 下一阶段注意事项
## 可回滚点
```

## 11. 分阶段执行计划

## Phase 0：基线确认，不改业务代码

### Phase 目标

- 运行现有 `typecheck` / tests
- 保存旧 prompt 输出样例
- 记录当前 RPG 抽取问题
- 生成 `PHASE_0_HANDOFF.md`

### 允许修改的文件

- 文档文件
- 测试输出记录文件
- handoff 文档

### 禁止修改的文件或行为

- 不修改业务代码
- 不修改 prompt
- 不修改测试预期来掩盖现有问题

### 输入文档

- [docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md)
- [docs/CURRENT_STATE.md](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/docs/CURRENT_STATE.md)
- [docs/IMPLEMENTATION_LOG.md](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/docs/IMPLEMENTATION_LOG.md)

### 执行步骤

1. 跑 `typecheck`
2. 跑 RPG 相关 tests
3. 导出当前 Stage 1 / Stage 2 prompt 样例
4. 记录典型问题
5. 产出 handoff

### 测试命令

```text
npm.cmd run typecheck
npx.cmd vitest run src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/rpg-smoke.test.ts
```

### 验收标准

- 有 baseline 测试结果
- 有当前 prompt 样例
- 有问题清单
- 有 `PHASE_0_HANDOFF.md`

### 回滚建议

- 本阶段不改业务代码，无需代码回滚

### 阶段结束后必须生成的 handoff

- `docs/refactor-handoffs/PHASE_0_HANDOFF.md`

### 下一阶段新窗口应读取的文件

- 本计划文档
- `PHASE_0_HANDOFF.md`

## Phase 1：Prompt Dispatcher 分离

### Phase 目标

- 保留外部 `buildAnalysisPrompt` / `buildGenerationPrompt` 接口
- 内部拆成 default 与 RPG 两条独立 prompt 路径
- RPG analysis 不再拼接 default analysis
- RPG generation 不再拼接 default generation
- 尽量把 RPG prompt helper 移出 `ingest.ts`
- 生成 `PHASE_1_HANDOFF.md`

### 允许修改的文件

- `src/lib/ingest.ts`
- `src/lib/prompts/*`
- `src/lib/ingest.prompt.test.ts`
- 必要文档与 handoff 文件

### 禁止修改的文件或行为

- 不删除 default mode
- 不做完整目录契约化
- 不大改 writer / UI / retrieval
- 不提前做 Phase 2 或 Phase 3 的语义收缩

### 输入文档

- 本计划文档
- `PHASE_0_HANDOFF.md`

### 执行步骤

1. 增加 default / RPG prompt dispatcher
2. 建立 prompt 模块文件
3. 把 RPG prompt 文本移出 `ingest.ts`
4. 保持 default 行为不变
5. 更新测试
6. 生成 handoff

### 测试命令

```text
npm.cmd run typecheck
npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts
```

### 验收标准

- RPG analysis prompt 不再包含 default analysis 结构
- RPG generation prompt 不再包含 default generation 拼接结构
- default mode 测试仍通过
- `ingest.ts` 明显变短，不再承载大段 RPG prompt

### 回滚建议

- 若 dispatcher 分离造成回归，优先回滚 prompt 模块迁移，不回滚 schema / writer / tests 基础资产

### 阶段结束后必须生成的 handoff

- `docs/refactor-handoffs/PHASE_1_HANDOFF.md`

### 下一阶段新窗口应读取的文件

- 本计划文档
- `PHASE_0_HANDOFF.md`
- `PHASE_1_HANDOFF.md`

## Phase 2：RPG Analysis Prompt 精简

### Phase 目标

- 让 Stage 1 RPG prompt 只保留分析职责
- 移除角色卡页面生成契约
- 移除 FSN 示例
- 增加 prompt 污染检测测试
- 生成 `PHASE_2_HANDOFF.md`

### 允许修改的文件

- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/prompts/domain-guidance.ts`
- `src/lib/ingest.prompt.test.ts`
- 必要文档与 handoff 文件

### 禁止修改的文件或行为

- 不把所有目录契约塞回 Stage 1
- 不执行 Phase 3 的 generation 契约拆分
- 不删除 default mode

### 输入文档

- 本计划文档
- `PHASE_0_HANDOFF.md`
- `PHASE_1_HANDOFF.md`

### 执行步骤

1. 重写 Stage 1 RPG analysis contract
2. 移除 Stage 2 页面契约内容
3. 移除 domain-specific 示例
4. 增加污染检测测试
5. 生成 handoff

### 测试命令

```text
npm.cmd run typecheck
npx.cmd vitest run src/lib/ingest.prompt.test.ts
```

### 验收标准

- RPG analysis prompt 包含 `Candidate Objects` 等目标结构
- 不包含 `Key Entities` / `Key Concepts`
- 不包含 `Character Impression` / `RP Usage`
- 不包含 `Fate` / `UBW` / `HF` / `Fuyuki` / `Holy Grail`

### 回滚建议

- 若收缩过度导致 Stage 1 丢失必要路由信息，回滚到 Phase 1 dispatcher 结构后重新精调 Stage 1 contract

### 阶段结束后必须生成的 handoff

- `docs/refactor-handoffs/PHASE_2_HANDOFF.md`

### 下一阶段新窗口应读取的文件

- 本计划文档
- `PHASE_0_HANDOFF.md`
- `PHASE_1_HANDOFF.md`
- `PHASE_2_HANDOFF.md`

## Phase 3：RPG Generation Prompt 分目录契约化

### Phase 目标

- 根据目标 path / schema 注入最小必要页面契约
- `characters` 页面才注入角色卡模型
- `player/current-scene/events/plot-arcs/relationships` 使用短而明确的契约
- domain guidance 独立注入
- 生成 `PHASE_3_HANDOFF.md`

### 允许修改的文件

- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/prompts/rpg-page-guidance.ts`
- `src/lib/prompts/domain-guidance.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- 必要文档与 handoff 文件

### 禁止修改的文件或行为

- 不默认注入所有目录契约
- 不把 FSN 示例写回通用 RPG prompt
- 不删除 default mode

### 输入文档

- 本计划文档
- `PHASE_0_HANDOFF.md`
- `PHASE_1_HANDOFF.md`
- `PHASE_2_HANDOFF.md`

### 执行步骤

1. 按目录拆分页面 guidance
2. 以 `path / schema` 为主实现注入
3. `object_type` 只做辅助
4. 更新 prompt / scenario tests
5. 生成 handoff

### 测试命令

```text
npm.cmd run typecheck
npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts
```

### 验收标准

- Stage 2 不再默认注入所有目录契约
- 只有 `characters` 才注入角色卡契约
- `locations/factions/items` 使用短契约
- domain guidance 已与通用 RPG prompt 脱离

### 回滚建议

- 若目录注入策略导致生成路径不稳，优先回滚到“path/schema 主导，最小 contract fallback”的实现，不退回全量注入

### 阶段结束后必须生成的 handoff

- `docs/refactor-handoffs/PHASE_3_HANDOFF.md`

### 下一阶段新窗口应读取的文件

- 本计划文档
- `PHASE_0_HANDOFF.md`
- `PHASE_1_HANDOFF.md`
- `PHASE_2_HANDOFF.md`
- `PHASE_3_HANDOFF.md`

## Phase 4：RPG-first / Legacy Default 收敛

### Phase 目标

- 评估 default mode 是否保留为 legacy
- 收敛 `wikiMode` 分支
- 清理不必要兼容层
- 对齐 `executeIngestWrites()` 与 `autoIngest()` 的 RPG writer 语义
- 生成 `PHASE_4_HANDOFF.md`

### 允许修改的文件

- `src/lib/wiki-mode.ts`
- `src/lib/project-mode.ts`
- `src/lib/ingest.ts`
- `src/components/project/create-project-dialog.tsx`
- `src/commands/fs.ts`
- `src/components/chat/chat-panel.tsx`
- 相关测试
- 文档与 handoff 文件

### 禁止修改的文件或行为

- 不在没有明确计划说明的情况下破坏 default 既有测试
- 不把 Phase 5 的回归验证工作混入本阶段

### 输入文档

- 本计划文档
- `PHASE_0_HANDOFF.md`
- `PHASE_1_HANDOFF.md`
- `PHASE_2_HANDOFF.md`
- `PHASE_3_HANDOFF.md`

### 执行步骤

1. 评估 default mode 去留
2. 收敛 `wikiMode`
3. 对齐 manual writer 与 auto-ingest writer
4. 更新 tests
5. 生成 handoff

### 测试命令

```text
npm.cmd run typecheck
npx.cmd vitest run src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/rpg-extraction-validation.test.ts
```

### 验收标准

- default prompt + RPG patch 结构彻底消失
- default mode 是否保留有明确结论
- `executeIngestWrites()` 不再绕过 RPG 关键语义

### 回滚建议

- 若 mode 收敛导致 legacy 项目路径不稳，先回滚 mode 暴露层，不回滚 RPG prompt 收敛成果

### 阶段结束后必须生成的 handoff

- `docs/refactor-handoffs/PHASE_4_HANDOFF.md`

### 下一阶段新窗口应读取的文件

- 本计划文档
- `PHASE_0_HANDOFF.md`
- `PHASE_1_HANDOFF.md`
- `PHASE_2_HANDOFF.md`
- `PHASE_3_HANDOFF.md`
- `PHASE_4_HANDOFF.md`

## Phase 5：回归测试与样例验证

### Phase 目标

- 使用角色、地点、阵营、事件、`current-scene` 样例回归
- 检查误入 `player`
- 检查结局/路线误入 `current-scene`
- 检查低价值 trope/trivia 不再生成 standalone `concepts`
- 检查地点/阵营/物品不再埋进角色页
- 更新最终文档
- 生成 `PHASE_5_HANDOFF.md`

### 允许修改的文件

- 测试文件
- 文档文件
- 必要的 prompt / writer 收尾修复文件
- handoff 文件

### 禁止修改的文件或行为

- 不通过放宽测试来掩盖实际问题
- 不新增超范围功能

### 输入文档

- 本计划文档
- `PHASE_0_HANDOFF.md`
- `PHASE_1_HANDOFF.md`
- `PHASE_2_HANDOFF.md`
- `PHASE_3_HANDOFF.md`
- `PHASE_4_HANDOFF.md`

### 执行步骤

1. 跑最终回归
2. 补齐样例验证
3. 修复最后的不一致
4. 更新文档
5. 生成 handoff

### 测试命令

```text
npm.cmd run typecheck
npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/rpg-smoke.test.ts src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts
```

### 验收标准

- 关键 RPG prompt tests 通过
- writer / validation / scenario / smoke tests 通过
- 文档与 handoff 完整

### 回滚建议

- 若最终回归暴露 Phase 4 问题，优先回滚 Phase 4 的 mode/writer 收敛，不回滚已验证的 Stage 1/2 prompt 分离成果

### 阶段结束后必须生成的 handoff

- `docs/refactor-handoffs/PHASE_5_HANDOFF.md`

### 下一阶段新窗口应读取的文件

- 如还有后续阶段，应读取全部 `PHASE_0` 到 `PHASE_5` handoff 与本计划文档

## 12. Per-Phase Codex Prompts

以下 prompt 设计为可直接复制到新 Codex 窗口执行。

### Phase 0 Prompt

```text
你现在只执行 Phase 0。禁止执行 Phase 1-5 的任何修改。

先阅读：
- docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md
- docs/CURRENT_STATE.md
- docs/IMPLEMENTATION_LOG.md

本窗口目标：
- 运行当前 typecheck 与 RPG 相关测试
- 保存当前 Stage 1 / Stage 2 prompt 输出样例
- 记录当前 RPG prompt / writer / smoke 的基线问题
- 生成 docs/refactor-handoffs/PHASE_0_HANDOFF.md

禁止事项：
- 不修改业务代码
- 不修改 prompt
- 不修改测试预期
- 不提前执行后续 Phase

结束前必须：
- 汇总测试结果
- 说明失败测试与原因
- 生成 PHASE_0_HANDOFF.md
```

### Phase 1 Prompt

```text
你现在只执行 Phase 1。禁止执行 Phase 2-5。

先阅读：
- docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md
- docs/refactor-handoffs/PHASE_0_HANDOFF.md

本窗口目标：
- 保留 buildAnalysisPrompt / buildGenerationPrompt 外部接口
- 将 default 与 RPG prompt dispatcher 分离
- RPG analysis 不再拼接 default analysis
- RPG generation 不再拼接 default generation
- 尽量把 RPG prompt helper 移出 src/lib/ingest.ts
- 生成 docs/refactor-handoffs/PHASE_1_HANDOFF.md

禁止事项：
- 不删除 default mode
- 不做 Stage 1 contract 精简
- 不做 Stage 2 分目录契约化
- 不大改 writer / UI / retrieval
- 不执行后续 Phase

结束前必须：
- 运行本阶段测试
- 记录修改文件
- 说明未完成项
- 生成 PHASE_1_HANDOFF.md
```

### Phase 2 Prompt

```text
你现在只执行 Phase 2。禁止执行 Phase 3-5。

先阅读：
- docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md
- docs/refactor-handoffs/PHASE_0_HANDOFF.md
- docs/refactor-handoffs/PHASE_1_HANDOFF.md

本窗口目标：
- 将 Stage 1 RPG analysis prompt 收敛为纯分析 contract
- 移除角色卡完整页面契约
- 移除 FSN / Fate / UBW / HF / Fuyuki / Holy Grail 示例
- 增加 prompt 污染检测测试
- 生成 docs/refactor-handoffs/PHASE_2_HANDOFF.md

禁止事项：
- 不执行 Stage 2 分目录契约化
- 不删除 default mode
- 不把所有目录 guidance 塞回 Stage 1
- 不执行后续 Phase

结束前必须：
- 运行本阶段测试
- 记录 prompt 结构变化
- 生成 PHASE_2_HANDOFF.md
```

### Phase 3 Prompt

```text
你现在只执行 Phase 3。禁止执行 Phase 4-5。

先阅读：
- docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md
- docs/refactor-handoffs/PHASE_0_HANDOFF.md
- docs/refactor-handoffs/PHASE_1_HANDOFF.md
- docs/refactor-handoffs/PHASE_2_HANDOFF.md

本窗口目标：
- 将 RPG generation prompt 改为按 path / schema 驱动注入最小必要目录契约
- 仅在 characters 页面注入角色卡契约
- 为 player/current-scene/events/plot-arcs/relationships 提供短契约
- 让 domain guidance 独立注入
- 生成 docs/refactor-handoffs/PHASE_3_HANDOFF.md

禁止事项：
- 不默认注入所有目录契约
- 不把 FSN 示例写回通用 RPG prompt
- 不删除 default mode
- 不执行后续 Phase

结束前必须：
- 运行本阶段测试
- 说明注入策略选择
- 生成 PHASE_3_HANDOFF.md
```

### Phase 4 Prompt

```text
你现在只执行 Phase 4。禁止执行 Phase 5。

先阅读：
- docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md
- docs/refactor-handoffs/PHASE_0_HANDOFF.md
- docs/refactor-handoffs/PHASE_1_HANDOFF.md
- docs/refactor-handoffs/PHASE_2_HANDOFF.md
- docs/refactor-handoffs/PHASE_3_HANDOFF.md

本窗口目标：
- 评估 default mode 是否保留为 legacy
- 收敛 wikiMode 分支
- 对齐 executeIngestWrites() 与 autoIngest() 的 RPG writer 语义
- 清理不必要兼容层
- 生成 docs/refactor-handoffs/PHASE_4_HANDOFF.md

禁止事项：
- 不回头重做 Phase 1-3 的 prompt 设计
- 不在未说明的情况下破坏 default 既有测试
- 不执行后续 Phase

结束前必须：
- 运行本阶段测试
- 说明 default mode 决策
- 生成 PHASE_4_HANDOFF.md
```

### Phase 5 Prompt

```text
你现在只执行 Phase 5。不要执行任何未来新 Phase。

先阅读：
- docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md
- docs/refactor-handoffs/PHASE_0_HANDOFF.md
- docs/refactor-handoffs/PHASE_1_HANDOFF.md
- docs/refactor-handoffs/PHASE_2_HANDOFF.md
- docs/refactor-handoffs/PHASE_3_HANDOFF.md
- docs/refactor-handoffs/PHASE_4_HANDOFF.md

本窗口目标：
- 执行最终回归测试
- 用角色、地点、阵营、事件、current-scene 样例验证最终行为
- 检查 player/current-scene/concepts/locations/factions 等边界
- 更新最终文档
- 生成 docs/refactor-handoffs/PHASE_5_HANDOFF.md

禁止事项：
- 不通过放宽测试掩盖问题
- 不扩展到计划外功能

结束前必须：
- 汇总最终测试结果
- 列出残余风险
- 生成 PHASE_5_HANDOFF.md
```

## 13. 推荐执行方式

推荐固定采用如下窗口节奏：

```text
窗口 1：只执行 Phase 0，结束生成 PHASE_0_HANDOFF.md
窗口 2：读取计划 + PHASE_0_HANDOFF.md，只执行 Phase 1，结束生成 PHASE_1_HANDOFF.md
窗口 3：读取计划 + PHASE_0_HANDOFF.md + PHASE_1_HANDOFF.md，只执行 Phase 2，结束生成 PHASE_2_HANDOFF.md
窗口 4：读取计划 + PHASE_0/1/2_HANDOFF.md，只执行 Phase 3，结束生成 PHASE_3_HANDOFF.md
窗口 5：读取计划 + PHASE_0/1/2/3_HANDOFF.md，只执行 Phase 4，结束生成 PHASE_4_HANDOFF.md
窗口 6：读取计划 + PHASE_0/1/2/3/4_HANDOFF.md，只执行 Phase 5，结束生成 PHASE_5_HANDOFF.md
```

## 14. 最终结论

本计划的核心不是“继续往旧 prompt 上堆规则”，而是：

- 保留现有 RPG 资产
- 拆掉 default prompt 与 RPG prompt 的拼接结构
- 用独立 Stage 1 / Stage 2 契约重建 RPG ingest
- 在前 3 个阶段严格避免提前删除 default mode
- 用单阶段、单窗口、强 handoff 的方式执行重构，减少上下文污染、重复踩坑和越权修改

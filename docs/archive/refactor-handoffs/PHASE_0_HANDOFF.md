# Phase 0 Handoff

## 本阶段目标

- 只执行 Phase 0 基线确认，不执行 Phase 1-5。
- 运行当前 typecheck。
- 运行 RPG 相关测试包。
- 导出当前 Stage 1 / Stage 2 RPG prompt 输出样例。
- 记录当前 RPG prompt、writer、smoke、review item 的基线问题。
- 更新 `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md`。
- 生成本 handoff 文档。

## 实际修改文件

- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/refactor-handoffs/PHASE_0_HANDOFF.md`
- `docs/refactor-handoffs/PHASE_0_STAGE_1_ANALYSIS_PROMPT_SAMPLE.md`
- `docs/refactor-handoffs/PHASE_0_STAGE_2_GENERATION_PROMPT_SAMPLE.md`

未修改业务代码、prompt 逻辑、测试预期或 `src/lib/ingest.ts`。

## 未完成事项

- 未修复 `src/lib/rpg-smoke.test.ts` 的失败断言；这是 Phase 0 要记录的现有基线问题。
- 未拆分 default prompt 与 RPG prompt；这是后续 Phase 1 范围。
- 未精简 Stage 1 analysis contract；这是后续 Phase 2 范围。
- 未按目录拆分 Stage 2 generation guidance；这是后续 Phase 3 范围。
- 未对齐 `executeIngestWrites()` 与 `autoIngest()` 的 RPG writer 语义；这是后续 Phase 4 范围。

## 测试结果

- `npm.cmd run typecheck`: 通过。
- `npx.cmd vitest run src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/rpg-smoke.test.ts`: 未完全通过。
- Vitest 汇总：7 个 test files 中 6 个通过，1 个失败；53 个 tests 中 52 个通过，1 个失败。

## 失败测试与原因

- 失败文件：`src/lib/rpg-smoke.test.ts`
- 失败测试：`Stage 10 RPG smoke test > routes sample RPG material into first-version RPG directories and preserves live-state semantics`
- 失败位置：`src/lib/rpg-smoke.test.ts:479`
- 失败断言：`expect(useReviewStore.getState().items).toHaveLength(0)`
- 实际结果：review store 中有 1 条 review item。
- 原因基线：当前 smoke fixture 生成 `wiki/events/timeline.md`，标题/内容中的 `Timeline` 被 `validateRpgExtraction()` 识别为 route/timeline-like event page，于是 RPG extraction lint 添加 review item；测试仍期望 0 条。

## Prompt 样例

- Stage 1 analysis prompt 样例：`docs/refactor-handoffs/PHASE_0_STAGE_1_ANALYSIS_PROMPT_SAMPLE.md`
- Stage 2 generation prompt 样例：`docs/refactor-handoffs/PHASE_0_STAGE_2_GENERATION_PROMPT_SAMPLE.md`

Prompt 导出方式：

- Stage 1 调用现有 `buildAnalysisPrompt(purpose, index, sourceContext, "llmwikirpg")`。
- Stage 2 调用现有 `buildGenerationPrompt(schema, purpose, index, sourceIdentity, overview, sourceContext, sourceSummaryPath, "llmwikirpg")`。
- 只调用现有导出函数，不修改 prompt builder。

Prompt 基线观察：

- Stage 1 RPG analysis prompt 长度为 10,428 字符。
- Stage 2 RPG generation prompt 长度为 28,512 字符。
- Stage 1 仍包含 default analysis 结构：`## Key Entities`、`## Key Concepts`、`Main Arguments & Findings`、`Recommendations`。
- Stage 1 仍包含 Stage 2 页面/角色卡契约词：`Character Impression`、`Psychological Model`、`Dialogue Style`、`RP Usage`。
- Stage 1 仍包含 domain/example tokens：`Fate`、`UBW`、`HF`、`Fuyuki`、`Heaven's Feel`。
- Stage 2 仍是 default generation prompt 后追加 RPG directory routing guidance，并包含 all-in-one RPG 目录契约、角色卡契约词和 domain/example tokens。

## 重要设计决策

- Phase 0 只做基线确认和文档记录，不修复失败测试。
- 当前分支继续保留，后续重构目标不是回滚到原始 `llm_wiki`，而是按计划逐步去除 `default prompt + RPG patch` 结构。
- 当前 RPG schema、dynamic update、extraction validation、smoke/scenario tests 都视为需要保留的已有资产。
- 当前 `src/lib/ingest.ts` 的 prompt 和 writer 问题只记录，不在 Phase 0 中处理。

## 下一阶段注意事项

- 下一窗口只能执行 Phase 1。
- Phase 1 必须先读取 `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md` 和本 handoff。
- Phase 1 目标是 prompt dispatcher 分离，保留外部 `buildAnalysisPrompt` / `buildGenerationPrompt` 接口。
- Phase 1 不得执行 Phase 2 的 Stage 1 contract 精简，不得执行 Phase 3 的目录级 generation guidance 拆分。
- Phase 1 不得删除 default mode，不得改 writer/UI/retrieval 大结构。
- 当前 smoke 失败不要在 Phase 1 通过放宽测试或删除 lint 来掩盖；除非 Phase 1 范围明确需要触碰相关断言，否则继续记录为基线风险。

## 可回滚点

- 本阶段没有业务代码改动。
- 如需回滚 Phase 0，只需移除以下文档/基线改动：
  - `docs/refactor-handoffs/PHASE_0_HANDOFF.md`
  - `docs/refactor-handoffs/PHASE_0_STAGE_1_ANALYSIS_PROMPT_SAMPLE.md`
  - `docs/refactor-handoffs/PHASE_0_STAGE_2_GENERATION_PROMPT_SAMPLE.md`
  - `docs/CURRENT_STATE.md` 中本阶段新增记录
  - `docs/IMPLEMENTATION_LOG.md` 中 `2026-06-04 19:10 - RPG-only refactor Phase 0 baseline confirmation` 条目


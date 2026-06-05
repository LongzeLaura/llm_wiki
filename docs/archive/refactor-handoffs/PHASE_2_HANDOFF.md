# Phase 2 Handoff

## 本阶段目标

- 只执行 RPG-only refactor Phase 2。
- 将 Stage 1 RPG analysis prompt 收敛为纯分析 contract。
- 只保留 candidate object / object_type / suggested_route / action / evidence_summary / brief_inference / confidence / uncertainty / ignored noise / merge targets / open questions。
- 移除 Stage 1 中的角色卡完整页面契约。
- 移除 Stage 1 中的 Fate / UBW / HF / Fuyuki / Holy Grail / Heaven's Feel 等 domain-specific 示例。
- 增加 RPG analysis prompt 污染检测测试。

## 实际修改文件

- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/refactor-handoffs/PHASE_2_HANDOFF.md`

## 未完成事项

- 未执行 Phase 3：RPG generation prompt 仍保留 Phase 1 后的 all-in-one directory guidance 和 character-page contract。
- 未创建 `src/lib/prompts/domain-guidance.ts`：当前树中该文件不存在，本阶段只需要从 Stage 1 analysis prompt 移除 domain-specific 示例。
- 未处理 Phase 0 记录的 broader smoke baseline mismatch。
- 未修改 writer、UI、retrieval、schema、dynamic update 或 default mode。

## 测试结果

- `npm.cmd run typecheck`：通过。
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts`：通过。
- Vitest 汇总：1 个 test file 通过，22 个 tests 通过。

## 失败测试与原因

- 本阶段建议测试命令无失败。
- Phase 0 已记录的 `src/lib/rpg-smoke.test.ts` review item mismatch 本阶段未运行、未处理，仍属于既有 broader baseline 风险。

## 重要设计决策

- Stage 1 RPG analysis 现在只负责候选对象识别、对象类型分类、建议路由、写入动作、证据边界和不确定性记录。
- `brief_inference` 只要求一到两句基于证据的简短结论，并显式禁止 hidden reasoning / step-by-step chain-of-thought。
- 角色卡完整写作规则不再进入 RPG analysis prompt；相关 Stage 2 generation contract 留待 Phase 3 处理。
- 新增污染检测测试锁定 RPG analysis prompt 不得包含 default analysis headings、角色页契约词和 domain-specific 示例词。
- default mode 保留不变。

## 下一阶段注意事项

- 下一窗口只能执行 Phase 3。
- Phase 3 应从 `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`、`PHASE_0_HANDOFF.md`、`PHASE_1_HANDOFF.md` 和本 handoff 开始。
- Phase 3 的重点是 RPG generation prompt 按 path/schema 注入最小必要目录/page guidance；不要把 Stage 1 contract 再扩回页面写作规则。
- Phase 3 如处理 domain guidance，应保持通用 RPG prompt 与 domain-specific examples 分离。

## 可回滚点

- 若 Stage 1 analysis 收敛过度导致必要 routing 信息缺失，优先回滚或调整 `src/lib/prompts/rpg-ingest.ts` 中 `buildRpgExtractionAnalysisGuidance()` 的 Phase 2 改动。
- 若污染检测误伤，应只调整 `src/lib/ingest.prompt.test.ts` 的 Phase 2 RPG analysis 断言，不回滚 Phase 1 dispatcher 分离。
- 本阶段未执行 `git commit` 或 `git push`。

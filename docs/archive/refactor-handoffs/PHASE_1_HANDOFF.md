# Phase 1 Handoff

## 本阶段目标

- 保留 `buildAnalysisPrompt` / `buildGenerationPrompt` 的外部接口。
- 将 default 与 RPG prompt dispatcher 分离。
- 让 RPG analysis 不再拼接 default analysis。
- 让 RPG generation 不再拼接 default generation。
- 尽量把 RPG prompt helper 移出 `src/lib/ingest.ts`。
- 更新 prompt tests、状态文档和本 handoff。

## 实际修改文件

- `src/lib/ingest.ts`
- `src/lib/prompts/shared-ingest.ts`
- `src/lib/prompts/default-ingest.ts`
- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/refactor-handoffs/PHASE_1_HANDOFF.md`

## 未完成事项

- 未执行 Phase 2：RPG analysis prompt 仍保留现有角色卡、domain/example、边界示例等较重 guidance。
- 未执行 Phase 3：RPG generation prompt 仍保留 all-in-one RPG directory guidance，尚未按目标 path/schema 注入最小目录契约。
- 未处理 Phase 4：`executeIngestWrites()` 与 `autoIngest()` 的 RPG writer/validation 语义仍未在本阶段统一。
- 未修复 Phase 0 记录的 `src/lib/rpg-smoke.test.ts` review item baseline mismatch。

## 测试结果

- `npm.cmd run typecheck`: 通过。
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts`: 通过。
- Vitest 汇总：3 个 test files 通过，29 个 tests 通过。

## 失败测试与原因

- 本阶段建议测试命令无失败。
- Phase 0 已记录的 broader RPG smoke baseline failure 本阶段未运行、未处理，原因仍是 mocked `wiki/events/timeline.md` 被 extraction lint 标记为 route/timeline-like review item，而旧 smoke 期望 0 条 review item。

## 重要设计决策

- `src/lib/ingest.ts` 只保留 `buildAnalysisPrompt` / `buildGenerationPrompt` 的 mode dispatcher 形态，外部调用签名不变。
- default prompt 迁移到 `src/lib/prompts/default-ingest.ts`，保留 legacy/default 的 `## Key Entities`、`## Key Concepts`、`## Main Arguments & Findings`、`## Recommendations` 结构。
- RPG prompt 迁移到 `src/lib/prompts/rpg-ingest.ts`，不再通过先构造 default prompt 再追加 RPG guidance 的方式生成。
- shared prompt protocol 放在 `src/lib/prompts/shared-ingest.ts`，仅承载语言、source、frontmatter、review、FILE/REVIEW 输出格式等跨模式协议。
- Phase 1 只做 dispatcher/module 分离；没有在本窗口执行 Phase 2 的 Stage 1 semantic slimming，也没有执行 Phase 3 的 directory-level generation guidance injection。

## 下一阶段注意事项

- 下一窗口只能执行 Phase 2。
- Phase 2 应读取本 handoff、`PHASE_0_HANDOFF.md` 和 `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`。
- Phase 2 的重点应是精简 `src/lib/prompts/rpg-ingest.ts` 中的 RPG analysis contract：移除角色卡页面生成契约、移除 domain-specific examples，并增加/强化 prompt pollution tests。
- Phase 2 不应处理 RPG generation 的 path/schema 最小注入；那是 Phase 3。
- Phase 2 不应删除 default mode，也不应改 writer/UI/retrieval。

## 可回滚点

- 若 dispatcher 分离造成回归，优先回滚本阶段新增的 `src/lib/prompts/*` 与 `src/lib/ingest.ts` dispatcher 替换。
- 回滚时不应触碰已有 RPG schema、dynamic update、extraction validation、writer、UI 或 retrieval 资产。
- 本阶段没有执行 `git commit` 或 `git push`。

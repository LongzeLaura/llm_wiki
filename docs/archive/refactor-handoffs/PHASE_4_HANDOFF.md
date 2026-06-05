# Phase 4 Handoff

## 本阶段目标

- 只执行 RPG-only refactor Phase 4，不执行 Phase 5。
- 评估 `default` mode 是否保留为 legacy。
- 收敛 `wikiMode` 分支表达。
- 清理不必要兼容层。
- 对齐 `executeIngestWrites()` 与 `autoIngest()` 的 RPG writer 语义。
- 生成本 handoff，并更新 `docs/CURRENT_STATE.md` 与 `docs/IMPLEMENTATION_LOG.md`。

## 实际修改文件

- `src/lib/wiki-mode.ts`
- `src/lib/project-mode.ts`
- `src/lib/ingest.ts`
- `src/components/project/create-project-dialog.tsx`
- `src/commands/fs.ts`
- `src/components/chat/chat-panel.tsx`
- `src/lib/wiki-mode.test.ts`
- `src/lib/project-mode.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/refactor-handoffs/PHASE_4_HANDOFF.md`

## 未完成事项

- 未执行 Phase 5 的最终回归或样例质量验证。
- 未删除 legacy `default` mode、`entities`、`concepts`、`sources` 或 custom schema 行为。
- 未重做 Phase 1-3 prompt 设计。
- 未处理 Phase 0 记录的 broader `src/lib/rpg-smoke.test.ts` review-item baseline mismatch；该项仍留给后续阶段按范围处理。

## 测试结果

- `npm.cmd run typecheck`：通过。
- `npx.cmd vitest run src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/rpg-extraction-validation.test.ts`：通过。
- Vitest 汇总：5 个 test files 通过，38 个 tests 通过。

## 失败测试与原因

- 本阶段执行的建议测试命令无失败。
- 未运行 Phase 5 的更大范围最终回归，因此本 handoff 不声明 broader smoke/final regression 已通过。

## 重要设计决策

- `default` mode 最终决策：保留，但定位为 explicit Legacy Default compatibility mode。
- 新建项目默认值改为 `llmwikirpg`，即 RPG-first；`default` 仍在 mode option 中可选，且 `wikiMode: default` 与 metadata `mode: "default"` 仍可让旧项目保持 legacy 行为。
- 没有移除 runtime fallback 检测：已有项目可能缺少 `.llm-wiki/project.json`，仍需要 `wikiMode:` marker 与 RPG 目录启发式识别作为兼容层。
- 新增 `isRpgWikiMode()`，并在 ingest prompt dispatch 与 chat retrieval 分支中使用，避免继续散落裸字符串判断。
- `executeIngestWrites()` 不再手写 FILE block 写入循环，而是检测 `wikiMode` 后复用 `writeFileBlocks()`。
- 因为复用 `writeFileBlocks()`，manual writer 现在与 `autoIngest()` 共享：
  - `wiki/current-scene/*` 规范化为 `wiki/current-scene/scene_state.md`
  - RPG `events` append 策略
  - RPG overwrite / merge / cautious-merge 策略
  - `validateRpgDynamicWrite()`
  - `validateRpgExtraction()` lint warnings 与 review items
  - parsed `---REVIEW` blocks
- `writeFileBlocks()` 的 `sourceFileName` 允许为空：无 active source 的 manual write 不会伪造 `sources` frontmatter；有 active source 时继续规范化 provenance。

## 下一阶段注意事项

- 下一阶段只能是 Phase 5，并且必须在新窗口执行。
- Phase 5 可以做最终回归和样例验证，但不要回滚 Phase 1-4 的 prompt/writer 收敛成果，除非具体测试暴露明确回归。
- Phase 5 应特别验证 manual writer 与 auto ingest 在 RPG 项目中的一致性，包括 `current-scene`、`events`、`player`、`characters`、`relationships`、`plot-arcs` 的动态状态边界。
- Phase 5 若运行 `src/lib/rpg-smoke.test.ts`，需要记住 Phase 0 已记录其已知 review-item mismatch：mocked `wiki/events/timeline.md` 会被 extraction lint 标记，而旧 smoke 断言曾期待 0 条 review item。

## 可回滚点

- 若 RPG-first 新建项目默认值造成 UI/项目创建回归，优先回滚：
  - `src/lib/project-mode.ts` 中 `DEFAULT_PROJECT_MODE`
  - `src/components/project/create-project-dialog.tsx`
  - `src/commands/fs.ts`
- 若 mode branch helper 引入问题，可回滚：
  - `src/lib/wiki-mode.ts` 的 `isRpgWikiMode()`
  - `src/lib/ingest.ts` 与 `src/components/chat/chat-panel.tsx` 的 helper 使用点
- 若 manual writer 复用 `writeFileBlocks()` 造成交互式保存回归，优先回滚或局部调整：
  - `src/lib/ingest.ts` 中 `executeIngestWrites()` 的 writer delegation
  - `writeFileBlocks()` 的 nullable `sourceFileName` 支持
  - `src/lib/ingest.scenarios.test.ts` 中新增的 interactive RPG writer 覆盖
- 不应回滚 Phase 1 dispatcher、Phase 2 analysis slimming 或 Phase 3 generation page-guidance splitting，除非后续阶段发现与这些改动直接相关的明确问题。

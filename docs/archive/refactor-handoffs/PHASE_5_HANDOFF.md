# Phase 5 Handoff

## 本阶段目标

- 执行 RPG-only refactor 的最终回归测试。
- 用角色、地点、阵营、物品、事件、`current-scene` 样例验证最终行为。
- 检查原作角色不会误入 `player/`。
- 检查结局 / 路线不会误入 `current-scene/`。
- 检查低价值 trope / trivia 不会再生成 standalone `concepts/`。
- 检查地点、阵营、物品不会被埋进角色页。
- 更新最终文档并生成本 handoff。

## 实际修改文件

- `src/lib/rpg-smoke.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/refactor-handoffs/PHASE_5_HANDOFF.md`

## 未完成事项

- 无 Phase 5 范围内未完成事项。
- 未启动任何新 Phase。
- 未执行真实模型质量评测；当前最终回归仍是 mocked LLM + writer / validation / prompt / scenario / smoke 的确定性测试。

## 测试结果

- `npm.cmd run typecheck`：通过。
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/rpg-smoke.test.ts src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts`：通过。
- Vitest 汇总：8 个 test files 通过，74 个 tests 通过。

## 失败测试与原因

- 初始最终回归中 `src/lib/rpg-smoke.test.ts` 失败一次。
- 失败原因：smoke fixture 仍生成 `wiki/events/timeline.md`，且事件标题 / 正文含有 `Timeline` / `route` 类信号；Phase 4 后的 RPG extraction lint 会正确将 route/timeline-like `events/` 页面标记为可能应进入 `plot-arcs/`，因此 review store 出现 1 条 review item，而旧 smoke 断言期望 0 条。
- 处理方式：没有放宽 lint，也没有把断言改成接受坏输出；而是把 smoke 的干净样例改为离散事件 `wiki/events/canal-gate-incident.md`，并将 route/storyline 语义保留在 `wiki/plot-arcs/`。

## 重要设计决策

- Phase 5 只做最终回归、样例修正和文档收尾，不修改 prompt / writer 生产逻辑。
- smoke 的 `events/` 样例现在验证“离散已发生事件可以 append”，不再用 `timeline.md` 这种会触发边界 lint 的坏样例代表正常输出。
- smoke 保留 `expect(useReviewStore.getState().items).toHaveLength(0)`，用于证明干净样例不会产生 review item。
- smoke 新增角色页边界断言：`Mira Vale` 角色页不得吞入 `Amber Guild`、`River Port`、`Lantern Key`，这些内容必须保持在 `factions/`、`locations/`、`items/` 的独立页面中。
- 现有 scenario / validation 测试继续覆盖：原作角色不进 `player/`、静态结局不进 `current-scene/`、trope/tag/trivia 不进 standalone `concepts/`、清洁 canon-cast 样例会输出 `characters/relationships/locations/factions` 且无 stray `player` 或 trope concept。

## 下一阶段注意事项

- 本计划没有下一阶段；不要从本窗口继续扩展新 Phase。
- 后续若另行定义计划，应把 Phase 5 的绿色回归作为回滚和对比基线。
- 仍然存在非 Phase 5 范围的长期限制：测试主要是 mocked LLM 与轻量 heuristic validation，真实模型抽取质量、角色卡结构完整性和更深的项目级审计仍需要单独计划。

## 可回滚点

- 如需回滚 Phase 5，仅回滚以下改动：
  - `src/lib/rpg-smoke.test.ts` 中 smoke fixture 的 `events/canal-gate-incident.md` 样例与角色页不吞地点/阵营/物品断言。
  - `docs/CURRENT_STATE.md` 中 Phase 5 状态记录。
  - `docs/IMPLEMENTATION_LOG.md` 中 `2026-06-04 20:05 - RPG-only refactor Phase 5 final regression and handoff` 条目。
  - `docs/refactor-handoffs/PHASE_5_HANDOFF.md`。
- 不应回滚 Phase 1-4 的 prompt dispatcher、analysis slimming、generation guidance splitting、RPG-first mode 或 writer alignment 成果。

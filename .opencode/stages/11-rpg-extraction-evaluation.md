# Stage 11: RPG Extraction Evaluation

你正在执行 llmWikiRPG 自动化改造的 Stage 11。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 11：评估抽取质量并修正 prompt/schema”。

执行前必须阅读：

- `AGENTS.md`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/RPG_SMOKE_TEST_REPORT.md`（如存在）
- 本阶段相关文档

请严格按照阶段计划执行。

## 本阶段目标

评估 smoke test 的抽取质量，修正 prompt、schema 或保存策略中的小问题，避免目录错分、状态污染和重复写入。

## 允许修改的范围

- prompt 相关文件
- schema/config 的小幅修正
- 保存策略的小幅修正
- `docs/RPG_EXTRACTION_EVALUATION.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

执行本阶段时先基于 smoke test 结果定位问题，再做最小改动。

## 禁止事项

- 不要执行本阶段之外的任务。
- 不要跳到后续阶段。
- 不要大规模重构。
- 不要删除 legacy entities/concepts/sources 功能。
- 不要自动 git commit。
- 不要使用危险参数。
- 不要在没有记录原因的情况下强行修改与文档不一致的代码。

## 建议执行步骤

1. 阅读 smoke test 输出和生成的 wiki 文件。
2. 对照 `docs/RPG_WIKI_SCHEMA.md` 检查错分和缺失。
3. 记录角色、事件、当前场景、关系、玩家状态等常见问题。
4. 小幅修正 prompt/schema/storage。
5. 再运行一次相关 smoke test 或说明未运行原因。
6. 更新状态和日志。

## 验收标准

- `docs/RPG_EXTRACTION_EVALUATION.md` 包含测试输入、实际输出、错分案例、修正点和复测结果。
- 已处理或记录 `current-scene` 污染 `events` 等关键风险。
- 未做大规模重构。
- `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 已更新。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

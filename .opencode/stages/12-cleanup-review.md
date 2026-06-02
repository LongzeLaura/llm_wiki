# Stage 12: Cleanup Review

你正在执行 llmWikiRPG 自动化改造的 Stage 12。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 12：清理命名、文档和开发日志”。

执行前必须阅读：

- `AGENTS.md`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`
- `docs/RPG_WIKI_SCHEMA.md`
- 本阶段相关文档

请严格按照阶段计划执行。

## 本阶段目标

清理 llmWikiRPG 第一版实现中的命名、调试残留和文档缺口，形成可继续迭代的稳定状态。

## 允许修改的范围

- 命名和调试日志的轻量清理
- README 或 RPG 使用说明相关文档
- `docs/LLMWIKIRPG_USAGE.md`
- `docs/LLMWIKIRPG_IMPLEMENTATION_SUMMARY.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

执行本阶段时先审查当前改动，再做小范围收尾。

## 禁止事项

- 不要执行本阶段之外的任务。
- 不要跳到后续阶段。
- 不要大规模重构。
- 不要删除 legacy entities/concepts/sources 功能。
- 不要自动 git commit。
- 不要使用危险参数。
- 不要在没有记录原因的情况下强行修改与文档不一致的代码。

## 建议执行步骤

1. 检查 Stage 00-11 的日志和状态。
2. 清理临时变量名和调试日志，避免行为变化。
3. 统一 RPG category 命名。
4. 更新使用说明和实现总结。
5. 记录已完成能力、未完成能力和下一轮方向。
6. 更新最终状态和日志。

## 验收标准

- 文档能说明如何使用 llmWikiRPG 第一版。
- `docs/CURRENT_STATE.md` 反映最终阶段状态。
- `docs/IMPLEMENTATION_LOG.md` 有完整收尾记录。
- legacy 功能未被删除。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

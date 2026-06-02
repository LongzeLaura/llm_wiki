# Stage 09: Legacy Compatibility

你正在执行 llmWikiRPG 自动化改造的 Stage 09。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 9：保留兼容层与旧分类回退逻辑”。

执行前必须阅读：

- `AGENTS.md`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`
- `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`（如存在）
- 本阶段相关文档

请严格按照阶段计划执行。

## 本阶段目标

确保 RPG 改造不破坏原 llm_wiki 的 legacy `entities`、`concepts`、`sources` 功能，并在需要时提供简单模式切换或回退机制。

## 允许修改的范围

- compatibility/mode/config 相关文件
- category 选择或回退逻辑相关文件
- 必要的测试或检查脚本
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

执行本阶段时先定位现有依赖，再做最小改动。

## 禁止事项

- 不要执行本阶段之外的任务。
- 不要跳到后续阶段。
- 不要大规模重构。
- 不要删除 legacy entities/concepts/sources 功能。
- 不要自动 git commit。
- 不要使用危险参数。
- 不要在没有记录原因的情况下强行修改与文档不一致的代码。

## 建议执行步骤

1. 检查旧分类是否仍被硬编码依赖。
2. 设计最小 `wikiMode = "default" | "rpg"` 或等效机制。
3. RPG 模式使用 RPG categories，default 模式保留原分类。
4. 如果模式切换暂不合适，至少确认旧逻辑未被破坏并记录原因。
5. 运行相关验证。
6. 更新状态和日志。

## 验收标准

- legacy 功能保留。
- RPG 与 default 行为边界清晰。
- 未删除旧分类代码。
- `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 已更新。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

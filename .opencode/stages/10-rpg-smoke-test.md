# Stage 10: RPG Smoke Test

你正在执行 llmWikiRPG 自动化改造的 Stage 10。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 10：使用 RPG 样例文本做 smoke test”。

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

用少量 RPG 样例文本验证从抽取到保存再到浏览的完整链路是否跑通。

## 允许修改的范围

- smoke test 样例或测试文件
- `docs/RPG_SMOKE_TEST_REPORT.md`
- 为通过 smoke test 所需的极小修复
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

不要借 smoke test 阶段进行大规模功能重写。

## 禁止事项

- 不要执行本阶段之外的任务。
- 不要跳到后续阶段。
- 不要大规模重构。
- 不要删除 legacy entities/concepts/sources 功能。
- 不要自动 git commit。
- 不要使用危险参数。
- 不要在没有记录原因的情况下强行修改与文档不一致的代码。

## 建议执行步骤

1. 准备世界观设定、角色卡、剧情推进三类最小样例。
2. 运行项目现有抽取链路或测试命令。
3. 检查是否生成 RPG 目标目录和文件。
4. 检查是否没有错误写回旧 `entities/concepts`。
5. 记录结果、失败点和必要小修复。
6. 更新状态和日志。

## 验收标准

- `docs/RPG_SMOKE_TEST_REPORT.md` 记录测试输入、命令、输出和检查清单。
- 至少验证目标目录生成或明确记录阻塞原因。
- 未做大规模重构。
- `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 已更新。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

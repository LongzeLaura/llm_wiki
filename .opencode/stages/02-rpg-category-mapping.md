# Stage 02: RPG Category Mapping

你正在执行 llmWikiRPG 自动化改造的 Stage 02。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 2：对照 RPG_WIKI_SCHEMA.md，设计 RPG 分类映射文档”。

执行前必须阅读：

- `AGENTS.md`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`（如存在）
- 本阶段相关文档

请严格按照阶段计划执行。

## 本阶段目标

设计 RPG Wiki 目录与原 llm_wiki 分类系统之间的映射关系，明确保留、替代、新增和暂不使用的分类。

## 允许修改的范围

- `docs/RPG_CATEGORY_MAPPING.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

本阶段原则上不修改业务代码。
如确实需要修改，只能修改 docs 或日志文件。

## 禁止事项

- 不要执行本阶段之外的任务。
- 不要跳到后续阶段。
- 不要大规模重构。
- 不要删除 legacy entities/concepts/sources 功能。
- 不要自动 git commit。
- 不要使用危险参数。
- 不要在没有记录原因的情况下强行修改与文档不一致的代码。

## 建议执行步骤

1. 阅读 RPG schema 中所有目标目录定义。
2. 将目录划分为静态设定、动态状态、时间线事件、关系网络、当前场景、来源追踪。
3. 对照旧分类系统设计映射表。
4. 明确第一版不做的事情，避免过度设计。
5. 更新状态和日志。

## 验收标准

- `docs/RPG_CATEGORY_MAPPING.md` 包含旧分类、新分类、映射关系、第一版边界。
- `sources` 的保留策略明确。
- `entities/concepts` 不被删除，只说明兼容和映射策略。
- `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 已更新。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

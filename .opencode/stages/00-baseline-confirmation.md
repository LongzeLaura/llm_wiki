# Stage 00: Baseline Confirmation

你正在执行 llmWikiRPG 自动化改造的 Stage 00。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 0：阅读现有架构文档，确认当前基线”。

执行前必须阅读：

- `AGENTS.md`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`
- `docs/LLMWIKIRPG_ARCHITECTURE_PLAN.md`
- `docs/RPG_WIKI_SCHEMA.md`
- 本阶段相关文档

请严格按照阶段计划执行。

## 本阶段目标

确认当前项目已有前置文档和代码基线，避免重复进行大规模架构调查。

## 允许修改的范围

- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- 必要时补充只读调查类 docs 文档

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

1. 阅读核心设计文档和当前状态文档。
2. 确认 `docs/LLMWIKIRPG_ARCHITECTURE_PLAN.md` 与 `docs/RPG_WIKI_SCHEMA.md` 是否存在且内容可用。
3. 快速核对当前代码树是否符合文档描述，只记录差异，不改业务代码。
4. 更新 `docs/CURRENT_STATE.md` 的当前阶段、已知风险、最近执行 stage、下一阶段建议。
5. 追加 `docs/IMPLEMENTATION_LOG.md`。

## 验收标准

- 已确认前置文档状态。
- 已记录当前基线和差异。
- 未修改业务逻辑。
- `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 已更新。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

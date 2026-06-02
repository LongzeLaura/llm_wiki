# Stage 01: Category System Analysis

你正在执行 llmWikiRPG 自动化改造的 Stage 01。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 1：定位原 llm_wiki 分类、抽取、保存、展示链路”。

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

定位旧 `entities`、`concepts`、`sources` 等分类系统在抽取、解析、保存、展示、查询链路中的关键入口。

## 允许修改的范围

- `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`
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

1. 搜索 `entities`、`concepts`、`sources`、`comparisons`、`synthesis`、`findings`、`methodology`、`thesis`。
2. 定位分类定义、抽取 prompt、LLM 输出解析、wiki 文件写入、前端读取、查询页/agent 使用位置。
3. 将结果写入 `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`。
4. 记录实际代码与文档差异。
5. 更新状态和日志。

## 验收标准

- 已列出旧分类系统关键文件和入口。
- 已给出后续阶段可能需要修改的文件清单。
- 未修改业务逻辑。
- `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 已更新。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

# Stage 01: Category System Analysis

你正在执行 llmWikiRPG 自动化改造的 Stage 01。

本阶段对应：
docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md 中的“阶段 1：定位原 llm_wiki 分类、抽取、保存、展示链路”。

## 执行前必须阅读的文件

- AGENTS.md
- docs/ROADMAP.md
- docs/CURRENT_STATE.md
- docs/IMPLEMENTATION_LOG.md
- docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md
- `docs/LLMWIKIRPG_ARCHITECTURE_PLAN.md`
- `docs/RPG_WIKI_SCHEMA.md`
- 本阶段 prompt 自身

请严格按照阶段计划执行。每个阶段都必须通过一次独立的 Codex 调用完成，并通过 docs/CURRENT_STATE.md 与 docs/IMPLEMENTATION_LOG.md 在阶段之间传递状态，而不是依赖同一个长对话上下文。

## 本阶段目标

定位 legacy 分类系统、抽取 prompt、解析、写入、前端展示和查询使用位置。

## 对应阶段

- 阶段 1：定位原 llm_wiki 分类、抽取、保存、展示链路

## 允许修改的范围

- `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

只在本阶段目标所需的最小范围内修改；如果发现前置阶段缺失或代码与文档存在明显不一致，先记录差异，再决定是否停止或补齐文档。

## 禁止事项

- 不要执行本阶段之外的任务。
- 不要跳到后续阶段。
- 不要大规模重构。
- 不要删除 legacy entities/concepts/sources 功能。
- 不要自动 git commit。
- 不要自动 git push。
- 不要使用危险参数。
- 不要使用 --yolo。
- 不要使用 --dangerously-bypass-approvals-and-sandbox。
- 不要在没有记录原因的情况下强行修改与文档不一致的代码。
## 建议执行步骤

1. 搜索 `entities`、`concepts`、`sources`、`queries` 等旧分类入口。
2. 定位 prompt、解析、写入、前端展示、搜索和保存答案的关键文件。
3. 将发现整理到 `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`。
4. 更新状态与实现日志。

## 验收标准

- 已找到主要 legacy 分类定义与消费入口。
- 已记录后续阶段可能需要修改的文件。
- 未修改业务逻辑。
- docs/CURRENT_STATE.md 和 docs/IMPLEMENTATION_LOG.md 已更新。

## 完成后必须更新

- docs/CURRENT_STATE.md
- docs/IMPLEMENTATION_LOG.md

## 完成后必须输出

- 修改了哪些文件？
- 为什么修改？
- 当前完成了什么？
- 未完成什么？
- 下一阶段建议

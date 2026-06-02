# Stage 02: RPG Category Mapping

你正在执行 llmWikiRPG 自动化改造的 Stage 02。

本阶段对应：
docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md 中的“阶段 2：对照 RPG_WIKI_SCHEMA 设计 RPG 分类映射”。

## 执行前必须阅读的文件

- AGENTS.md
- docs/ROADMAP.md
- docs/CURRENT_STATE.md
- docs/IMPLEMENTATION_LOG.md
- docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`
- 本阶段 prompt 自身

请严格按照阶段计划执行。每个阶段都必须通过一次独立的 Codex 调用完成，并通过 docs/CURRENT_STATE.md 与 docs/IMPLEMENTATION_LOG.md 在阶段之间传递状态，而不是依赖同一个长对话上下文。

## 本阶段目标

把 RPG 目录结构映射到现有 legacy 分类体系，并明确第一版边界。

## 对应阶段

- 阶段 2：对照 RPG_WIKI_SCHEMA 设计 RPG 分类映射

## 允许修改的范围

- `docs/RPG_CATEGORY_MAPPING.md`
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

1. 分析 11 个 RPG 目录的职责与动态属性。
2. 明确它们与 legacy `entities`、`concepts`、`sources`、`queries` 的关系。
3. 记录第一版不做的扩展项，如 `style`、`rules`、`runtime`。
4. 更新状态与实现日志。

## 验收标准

- 映射关系清晰可执行。
- 已记录第一版范围与 deferred 项。
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

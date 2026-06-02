# Stage 11: RPG Extraction Evaluation

你正在执行 llmWikiRPG 自动化改造的 Stage 11。

本阶段对应：
docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md 中的“阶段 11：评估抽取质量并修正 prompt 或 schema”。

## 执行前必须阅读的文件

- AGENTS.md
- docs/ROADMAP.md
- docs/CURRENT_STATE.md
- docs/IMPLEMENTATION_LOG.md
- docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/RPG_CATEGORY_MAPPING.md`
- `docs/RPG_SMOKE_TEST_REPORT.md`
- 本阶段 prompt 自身

请严格按照阶段计划执行。每个阶段都必须通过一次独立的 Codex 调用完成，并通过 docs/CURRENT_STATE.md 与 docs/IMPLEMENTATION_LOG.md 在阶段之间传递状态，而不是依赖同一个长对话上下文。

## 本阶段目标

根据 smoke test 结果评估抽取质量，并做最小必要修正。

## 对应阶段

- 阶段 11：评估抽取质量并修正 prompt 或 schema

## 允许修改的范围

- `docs/RPG_EXTRACTION_EVALUATION.md`
- prompt/schema 的小步修正与相关测试
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

1. 阅读 smoke test 结果和输出文件。
2. 定位错分、漏字段、状态污染和粒度问题。
3. 仅对 prompt/schema 做最小必要修正。
4. 更新评估文档、状态与实现日志。

## 验收标准

- 抽取质量问题已归档。
- 修正点范围清晰且与问题对应。
- 未借机做跨阶段重构。
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

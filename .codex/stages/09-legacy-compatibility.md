# Stage 09: Legacy Compatibility

你正在执行 llmWikiRPG 自动化改造的 Stage 09。

本阶段对应：
docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md 中的“阶段 9：保留兼容层与旧分类回退逻辑”。

## 执行前必须阅读的文件

- AGENTS.md
- docs/ROADMAP.md
- docs/CURRENT_STATE.md
- docs/IMPLEMENTATION_LOG.md
- docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md
- `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`
- `docs/RPG_CATEGORY_MAPPING.md`
- 本阶段 prompt 自身

请严格按照阶段计划执行。每个阶段都必须通过一次独立的 Codex 调用完成，并通过 docs/CURRENT_STATE.md 与 docs/IMPLEMENTATION_LOG.md 在阶段之间传递状态，而不是依赖同一个长对话上下文。

## 本阶段目标

确保 RPG 改造不会破坏 legacy 使用方式，并明确兼容策略。

## 对应阶段

- 阶段 9：保留兼容层与旧分类回退逻辑

## 允许修改的范围

- 兼容层、配置、回退逻辑和测试
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

1. 检查 legacy 分类依赖仍然存在的位置。
2. 补充最小兼容策略或模式切换能力。
3. 确认 RPG 与 legacy 行为都没有被粗暴删除。
4. 更新测试、状态与实现日志。

## 验收标准

- legacy 回退逻辑仍然可用。
- RPG 改造没有破坏默认模式。
- 兼容策略被明确记录。
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

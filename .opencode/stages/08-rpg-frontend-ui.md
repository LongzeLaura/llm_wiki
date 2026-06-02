# Stage 08: RPG Frontend UI

你正在执行 llmWikiRPG 自动化改造的 Stage 08。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 8：修改前端 Wiki 展示与查询页”。

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

让前端能够浏览和查询 RPG Wiki 目录，而不是只围绕旧 `entities`、`concepts` 展示。

## 允许修改的范围

- frontend wiki display 相关文件
- frontend navigation 相关文件
- 查询页或 agent 页面检索范围相关文件
- 与 RPG category 展示相关的配置或类型
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

执行本阶段时先定位前端结构，再做最小改动。

## 禁止事项

- 不要执行本阶段之外的任务。
- 不要跳到后续阶段。
- 不要大规模重构。
- 不要删除 legacy entities/concepts/sources 功能。
- 不要自动 git commit。
- 不要使用危险参数。
- 不要在没有记录原因的情况下强行修改与文档不一致的代码。

## 建议执行步骤

1. 定位 Wiki 目录展示组件、导航、文件读取和查询入口。
2. 加入 RPG Wiki 目录导航。
3. 让 `current-scene` 更容易被看到，但第一版避免复杂 UI。
4. 确保搜索和文件查看仍然正常。
5. 保留或降级 legacy 目录，不删除旧功能。
6. 更新状态和日志。

## 验收标准

- 前端能显示 RPG Wiki 目录结构。
- 查询或 agent 页面能检索 RPG 新目录。
- legacy 功能未被删除。
- 桌面和移动端基本加载不被破坏。
- `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 已更新。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

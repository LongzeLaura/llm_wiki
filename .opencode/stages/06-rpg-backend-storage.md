# Stage 06: RPG Backend Storage

你正在执行 llmWikiRPG 自动化改造的 Stage 06。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 6：修改保存数据结构与文件写入逻辑”。

执行前必须阅读：

- `AGENTS.md`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`（如存在）
- `docs/RPG_CATEGORY_MAPPING.md`（如存在）
- 本阶段相关文档

请严格按照阶段计划执行。

## 本阶段目标

让抽取结果能够保存到 RPG Wiki 目录，并为不同目录采用合适的多文件、合并、追加或覆盖策略。

## 允许修改的范围

- backend storage 相关文件
- wiki 文件写入、文件名安全化、合并/追加/覆盖策略相关文件
- 与保存结构直接相关的配置或类型
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

执行本阶段时先定位现有保存逻辑，再做最小改动。

## 禁止事项

- 不要执行本阶段之外的任务。
- 不要跳到后续阶段。
- 不要大规模重构。
- 不要删除 legacy entities/concepts/sources 功能。
- 不要自动 git commit。
- 不要使用危险参数。
- 不要在没有记录原因的情况下强行修改与文档不一致的代码。

## 建议执行步骤

1. 定位原 wiki 文件保存逻辑和文件名规则。
2. 支持 `wiki/sources/`、`wiki/world/`、`wiki/characters/`、`wiki/player/`、`wiki/locations/`、`wiki/factions/`、`wiki/items/`、`wiki/plot-arcs/`、`wiki/events/`、`wiki/current-scene/`、`wiki/relationships/`。
3. 实现或配置每类目录的保存策略。
4. 特别处理 `current-scene` 覆盖式更新和 `events` 追加式更新。
5. 保留来源信息和 legacy 回退能力。
6. 更新状态和日志。

## 验收标准

- RPG 目录写入路径和策略明确且可运行。
- `current-scene` 与 `events` 更新语义不混淆。
- legacy 写入能力未被删除。
- `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 已更新。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

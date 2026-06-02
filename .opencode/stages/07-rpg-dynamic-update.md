# Stage 07: RPG Dynamic Update

你正在执行 llmWikiRPG 自动化改造的 Stage 07。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 7：增加动态状态更新逻辑”。

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

支持 RPG 场景中的动态信息维护，包括当前场景、玩家状态、NPC 状态、关系变化、事件时间线和伏笔推进。

## 允许修改的范围

- 动态更新策略相关文档和代码
- prompt 动态约束的必要补充
- 保存逻辑中的 update mode 相关代码
- `docs/RPG_DYNAMIC_UPDATE_STRATEGY.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

执行本阶段时先定位相关代码，再做最小改动。

## 禁止事项

- 不要执行本阶段之外的任务。
- 不要跳到后续阶段。
- 不要大规模重构。
- 不要删除 legacy entities/concepts/sources 功能。
- 不要自动 git commit。
- 不要使用危险参数。
- 不要在没有记录原因的情况下强行修改与文档不一致的代码。

## 建议执行步骤

1. 设计动态目录更新策略并写入 `docs/RPG_DYNAMIC_UPDATE_STRATEGY.md`。
2. 明确覆盖、追加、合并、谨慎更新的目录清单。
3. 为保存逻辑增加或接入不同 update mode。
4. 补充 prompt 约束，避免旧状态污染新状态。
5. 记录一次剧情推进后各目录应如何变化。
6. 更新状态和日志。

## 验收标准

- 动态更新策略文档存在且清晰。
- `current-scene`、`events`、`player`、`characters`、`relationships` 更新语义明确。
- 未删除 legacy 功能。
- `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 已更新。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

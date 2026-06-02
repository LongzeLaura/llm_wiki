# Stage 04: RPG Wiki Schema Config

你正在执行 llmWikiRPG 自动化改造的 Stage 04。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 4：接入 RPG wiki schema 配置”。

执行前必须阅读：

- `AGENTS.md`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/RPG_CATEGORY_MAPPING.md`（如存在）
- 本阶段相关文档

请严格按照阶段计划执行。

## 本阶段目标

将 RPG Wiki schema 转化为代码可用配置，并与 category registry 保持一致。

## 允许修改的范围

- schema/config 相关文件
- registry 与 schema 的轻量关联代码
- 必要的类型定义
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

执行本阶段时先定位代码结构，再选择最小合适路径。

## 禁止事项

- 不要执行本阶段之外的任务。
- 不要跳到后续阶段。
- 不要大规模重构。
- 不要删除 legacy entities/concepts/sources 功能。
- 不要自动 git commit。
- 不要使用危险参数。
- 不要在没有记录原因的情况下强行修改与文档不一致的代码。

## 建议执行步骤

1. 阅读 `docs/RPG_WIKI_SCHEMA.md` 的目录定义、字段、更新策略和禁止抽取内容。
2. 定位配置文件放置位置。
3. 建立可被 prompt、保存和前端后续复用的 schema 配置。
4. 避免与 registry 重复冲突。
5. 做最小验证。
6. 更新状态和日志。

## 验收标准

- RPG schema 配置可由代码引用。
- schema 与 registry 的 category id 一致。
- 未修改抽取 prompt、保存逻辑或前端展示逻辑，除非是最小必要接入。
- `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 已更新。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

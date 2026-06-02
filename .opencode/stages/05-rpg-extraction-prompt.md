# Stage 05: RPG Extraction Prompt

你正在执行 llmWikiRPG 自动化改造的 Stage 05。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 5：修改 RPG 抽取 prompt”。

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

修改或扩展抽取 prompt，使 LLM 按 RPG Wiki 目录语义抽取信息，并区分事实、推测、当前状态、历史事件、角色关系、玩家状态和剧情伏笔。

## 允许修改的范围

- prompt 相关文件
- prompt 测试样例或 fixture（如项目已有对应结构）
- 与 prompt 输出结构直接相关的轻量类型或配置
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

执行本阶段时先定位现有 prompt 构造代码，再做最小改动。

## 禁止事项

- 不要执行本阶段之外的任务。
- 不要跳到后续阶段。
- 不要大规模重构。
- 不要删除 legacy entities/concepts/sources 功能。
- 不要自动 git commit。
- 不要使用危险参数。
- 不要在没有记录原因的情况下强行修改与文档不一致的代码。

## 建议执行步骤

1. 定位原抽取 prompt 构造位置。
2. 保留稳定输出结构，扩展或替换分类说明为 RPG categories。
3. 明确 `current-scene` 覆盖、`events` 追加、`plot-arcs` 不伪造已发生事件等规则。
4. 要求不要把同一信息重复写入多个目录，除非确有必要。
5. 如可行，增加最小 prompt 样例或测试。
6. 更新状态和日志。

## 验收标准

- prompt 明确包含 RPG 目录语义。
- prompt 明确区分当前状态、历史事件、伏笔、玩家状态和关系变化。
- legacy 功能未被删除。
- `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 已更新。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

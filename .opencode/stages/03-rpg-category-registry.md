# Stage 03: RPG Category Registry

你正在执行 llmWikiRPG 自动化改造的 Stage 03。

本阶段对应：
`docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 中的“阶段 3：设计并接入 RPG category registry”。

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

在最小范围内建立或接入 RPG category registry，使系统能够识别 RPG 专用目录。

## 允许修改的范围

- registry/config 相关文件
- 必要的类型定义或常量文件
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

不要在脚手架提示中假设具体代码路径；执行本阶段时先定位现有代码再修改。

## 禁止事项

- 不要执行本阶段之外的任务。
- 不要跳到后续阶段。
- 不要大规模重构。
- 不要删除 legacy entities/concepts/sources 功能。
- 不要自动 git commit。
- 不要使用危险参数。
- 不要在没有记录原因的情况下强行修改与文档不一致的代码。

## 建议执行步骤

1. 先定位当前分类列表或硬编码分类的位置。
2. 设计最小 registry 结构，包含 id、label、path、description、dynamic、multipleFiles、requireSource 等字段。
3. 加入 RPG categories：sources、world、characters、player、locations、factions、items、plot-arcs、events、current-scene、relationships。
4. 保留 legacy categories，不删除旧逻辑。
5. 做最小验证，确保类型检查或相关测试不破坏现有功能。
6. 更新状态和日志。

## 验收标准

- RPG category registry 存在或已接入。
- legacy categories 未被删除。
- 未进行抽取、保存、前端的大规模改造。
- `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 已更新。

## 完成后必须输出

- 修改了哪些文件
- 为什么修改
- 当前完成了什么
- 未完成什么
- 下一阶段建议

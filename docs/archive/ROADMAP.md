# llmWikiRPG Automation Roadmap

本路线图是 `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` 的简化执行版，用于人工执行和 Codex 阶段自动化脚手架的快速对齐。

## Context Management

- 每个 stage 都通过独立的 `codex exec` 调用执行。
- 每个 stage prompt 都要求重新阅读核心文档。
- 阶段之间只通过 `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md` 传递状态。
- 不依赖同一个长对话上下文。
- `.opencode/stages/` 如存在，仅作为历史参考，不再作为默认执行目录。

## Recovery

- 如果某个阶段失败，脚本会停止，不会继续后续阶段。
- 修复问题后，可以从失败阶段恢复：
  `powershell -ExecutionPolicy Bypass -File scripts/run-codex-stages.ps1 -From 6 -Until 12`
- 也可以只重跑单个阶段：
  `powershell -ExecutionPolicy Bypass -File scripts/run-codex-stages.ps1 -From 6 -Until 6`
- 可以先用 `-DryRun` 预览会执行哪些阶段。
- 脚本不会自动 `git commit` 或 `git push`。

## Stages

| Stage | Name | Code Changes | Core Goal | Main Deliverables | Status |
| -- | -- | -- | -- | -- | -- |
| 00 | Baseline confirmation | No | 确认已有文档和代码现状，不重复做架构调查 | 更新状态和日志 | Complete |
| 01 | Category system analysis | No | 定位 legacy 分类、抽取、保存、展示链路 | `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md` | Complete |
| 02 | RPG category mapping | No | 设计 RPG 目录与旧分类系统映射 | `docs/RPG_CATEGORY_MAPPING.md` | Complete |
| 03 | RPG category registry | Small | 接入 RPG category registry | registry/config 代码和日志 | Complete |
| 04 | RPG wiki schema config | Small | 将 RPG schema 转为代码可用配置 | schema/config 代码和日志 | Complete |
| 05 | RPG extraction prompt | Medium | 让 LLM 按 RPG 目录语义抽取 | prompt 修改和测试 | Complete |
| 06 | RPG backend storage | Medium | 保存到 RPG Wiki 目录并建立基础更新策略 | 写入逻辑和测试 | Complete |
| 07 | RPG dynamic update | Medium | 支持动态状态更新策略 | `docs/RPG_DYNAMIC_UPDATE_STRATEGY.md` 和必要代码 | Pending |
| 08 | RPG frontend UI | Medium | 浏览和查询 RPG Wiki 目录 | 前端导航与查询范围更新 | Pending |
| 09 | Legacy compatibility | Small | 保留旧分类兼容与回退逻辑 | compatibility/config 或兼容层 | Pending |
| 10 | RPG smoke test | Small | 使用 RPG 样例文本验证链路 | `docs/RPG_SMOKE_TEST_REPORT.md` | Pending |
| 11 | RPG extraction evaluation | Small | 评估抽取质量并修正 prompt/schema | `docs/RPG_EXTRACTION_EVALUATION.md` | Pending |
| 12 | Cleanup review | Small | 清理命名、文档和最终总结 | 使用说明、总结和最终状态 | Pending |

## Current Default Workflow

- 默认阶段目录：`.codex/stages/`
- 默认执行脚本：`scripts/run-codex-stages.ps1`
- 如果 Codex CLI 参数不匹配，只修改 `Invoke-CodexStage` 函数。
- 从现在开始，新的阶段执行建议都以 Codex 脚手架为准。

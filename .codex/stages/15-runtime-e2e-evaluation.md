# Stage 15: Runtime E2E Evaluation

## Goal

用真实 debug trace 特征复测 Runtime 链路，确认召回瘦身与 World Tick draft compiler 改善低信息回合稳定性，且没有放松内部 canonical validator。

## Required Reading

- `AGENTS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/RPG_WIKI_SCHEMA.md`

## Scope

- 复测 Action Resolver -> World Tick -> Recall Selector 的关键路径。
- 用 trace 中“查看昏倒中年男性”一类低信息回合特征检查 prompt / recall 体积与相关性。
- 记录剩余 cleanup 候选，不在本阶段继续大规模重构。
- 不新增 legacy/default 兼容、fallback、silent repair、parser sanitizer 或旧路径保留。

## Verification

- 运行 runtime 关键测试集、`npm.cmd run typecheck`、`npm.cmd run build:runtime`。
- 若有可用 debug trace，记录修复前后的失败点与 prompt/召回变化。
- 完成后更新 `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md`。
- 不执行 `git commit` 或 `git push`。

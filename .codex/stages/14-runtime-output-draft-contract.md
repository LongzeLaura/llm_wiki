# Stage 14: Runtime Output Draft Contract

## Goal

从 World Tick 开始，把 LLM 面向输出从完整内部 `WorldTickResult` 改为轻量 draft，再由本地 compiler 生成严格 canonical `WorldTickResult`。

## Required Reading

- `AGENTS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/RPG_WIKI_SCHEMA.md`

## Scope

- 只处理 World Tick，不扩散到 Action Resolver、Outline Brief、Narration 或 Runtime Update Proposal。
- LLM draft 允许省略空数组、ID、`runtimeDeltaRefs` 和重复 visibility 对象；本地 compiler 负责补齐。
- compiler 输出必须继续通过 `validateWorldTickResult()`；不得在 validator 内静默补字段。
- 禁止新增 legacy/default 兼容、fallback、silent repair、parser sanitizer 或旧字段映射。

## Verification

- 增加 draft compiler 测试：低信息回合缺少 `clockUpdates` / `reactionQueue` 等数组时仍能编译为 canonical 结果。
- 保留 canonical parser 测试：没有 `WorldTickInput` 的直接 parser 仍拒绝缺字段 canonical JSON。
- 运行 World Tick interaction / validation / orchestrator 相关测试和 `npm.cmd run typecheck`。
- 完成后更新 `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md`。
- 不执行 `git commit` 或 `git push`。

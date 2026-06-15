# Stage 13: Runtime Recall Slimming

## Goal

降低 RPG runtime 输入构建与 Recall Selector 的无关召回，避免整份 `current-scene` 或 0 分候选页稀释 Action Resolver / World Tick / Recall Selector 的注意力。

## Required Reading

- `AGENTS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/RPG_WIKI_SCHEMA.md`

## Scope

- 修复 `rankedPages()` 默认返回 0 分页的问题。
- Action Resolver / World Tick 的检索 tokens 只能来自玩家行动、已裁定摘要、当前地点、在场实体、可交互对象、危险、active clocks、affected paths 和显式 refs。
- Recall Selector 不应自动把所有 `/runtime/` overlay 作为候选；runtime overlay 也必须由 affected path 或正分检索命中。
- 不新增 legacy/default 兼容、fallback、silent repair、parser sanitizer 或旧路径保留。

## Verification

- 增加或更新回归测试，证明无关角色/物品/派系不会仅因 0 分排序或整页 current-scene 文本进入 runtime 输入。
- 运行相关 input-builder / recall 测试和 `npm.cmd run typecheck`。
- 完成后更新 `docs/CURRENT_STATE.md` 和 `docs/IMPLEMENTATION_LOG.md`。
- 不执行 `git commit` 或 `git push`。

# Phase 3 Handoff

## 本阶段目标

- 只执行 RPG-only refactor Phase 3。
- 将 RPG Stage 2 generation prompt 改为分目录、最小必要 guidance 注入。
- 以 path / schema 驱动为主。
- 以 `object_type` / `suggested_route` 为辅。
- 只有 `characters` 页面才注入角色卡契约。
- 为 `player` / `current-scene` / `events` / `plot-arcs` / `relationships` 提供短而明确的契约。
- 让 `locations` / `factions` / `items` 使用短契约。
- 将 domain-specific guidance 独立注入。
- 不执行 Phase 4 或 Phase 5。

## 实际修改文件

- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/prompts/rpg-page-guidance.ts`
- `src/lib/prompts/domain-guidance.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/refactor-handoffs/PHASE_3_HANDOFF.md`

## 未完成事项

- 未执行 Phase 4：未收敛 `wikiMode` / mode 分支，未对齐 `executeIngestWrites()` 与 `autoIngest()` 的 RPG writer 语义。
- 未执行 Phase 5：未做最终广域回归或真实模型抽取质量验证。
- 未处理 Phase 0 记录的 broader `src/lib/rpg-smoke.test.ts` review-item baseline mismatch。

## 测试结果

- `npm.cmd run typecheck`：通过。
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts`：通过。
- Vitest 汇总：2 个 test files 通过，39 个 tests 通过。

## 失败测试与原因

- 本阶段建议测试命令无失败。
- 未运行 `src/lib/rpg-smoke.test.ts`；Phase 0 已记录该 broader smoke baseline 有一个 review item 数量不匹配问题，本阶段未触碰。

## 重要设计决策

- `src/lib/prompts/rpg-ingest.ts` 不再维护 all-in-one RPG directory guidance，而是拼接最小 Stage 2 contract、focused page guidance、domain guidance。
- `src/lib/prompts/rpg-page-guidance.ts` 负责目录级契约选择：先从明确 path / schema 信号判断单一目标目录；若 path/schema 不可靠，再用 `object_type` / `suggested_route` 作为辅助；若仍不可靠，只注入最小 RPG generation contract。
- 不因为不确定而注入所有目录契约。
- 角色卡契约只在目标目录推断为 `wiki/characters/` 时出现。
- `player`、`current-scene`、`events`、`plot-arcs`、`relationships` 是短契约，不再与角色卡或其他目录契约混在一起。
- `locations`、`factions`、`items` 使用短 source-limited stub 契约。
- `src/lib/prompts/domain-guidance.ts` 独立承载 domain-specific guidance；通用 RPG generation fallback 不包含 FSN / Fate / UBW / HF / Fuyuki / Holy Grail / Heaven's Feel 示例。

## 下一阶段注意事项

- 下一个窗口如果继续，必须只执行 Phase 4。
- Phase 4 才能评估 default mode / legacy default 收敛和 `wikiMode` / writer 语义对齐。
- 不要回退到 Phase 3 之前的全量目录 guidance 注入。
- Phase 4 读取本 handoff 时应保留 `rpg-page-guidance.ts` 的最小注入策略，不要为了 writer/mode 收敛重新把所有目录契约塞回 Stage 2 prompt。

## 可回滚点

- 若 Phase 3 prompt 注入策略导致生成路径明显不稳，优先回滚或调整：
  - `src/lib/prompts/rpg-page-guidance.ts`
  - `src/lib/prompts/domain-guidance.ts`
  - `src/lib/prompts/rpg-ingest.ts` 中 Stage 2 generation 拼接逻辑
  - `src/lib/ingest.prompt.test.ts` 中对应 Phase 3 断言
- 不应回滚 Phase 1 dispatcher 分离或 Phase 2 Stage 1 analysis slimming。
- 本阶段未执行 `git commit` 或 `git push`。

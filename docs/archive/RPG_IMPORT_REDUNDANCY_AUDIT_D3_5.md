# RPG Import Redundancy Audit D3.5

## Scope

阶段：`docs/RPG_IMPORT_MODULARIZATION_PLAN.md` D3.5 Redundancy Audit / Cleanup Gate。

本轮只审查并清理 D/D1/D2/D2.5/D3 后留下的低风险冗余；未实现 Stage E/F/G/H，未新增 import mode，未改 UI，未执行 `git commit` / `git push`。

工作区开始状态：`git status --short` 显示已有大量未提交改动和未跟踪文件，包含 D-D3 相关源码、测试与文档。本阶段未回滚任何既有改动。

## keep

- `src/lib/rpg-import/` 保留为当前统一 import framework 骨架。证据：`rg "runRpgImport|sourceIngestModeSpec|getRpgImportModeSpec"` 显示仅 `source_ingest` 已注册并有 wrapper 等价测试；这正是 Stage B 后续 E/F/G 需要扩展的入口，不是重复实现。
- `src/lib/ingest.ts` 的 `autoIngest()` / prompt wrapper exports 保留为当前普通 Source Ingest 权威入口。证据：`src/lib/rpg-import/source-ingest.ts` 仍包装 `autoIngest()`，D3.5 不改变 ordinary ingest 行为。
- `src/lib/rpg-wiki-schema.ts` 的 `RPG_SCHEMA_SLOTS`、`RPG_DIRECTORY_BOUNDARY_GUIDANCE`、`RPG_RUNTIME_CROSS_DIRECTORY_SYNC_GUIDANCE`、`RPG_SOURCE_INGEST_TARGET_POLICY` 保留为 code-readable schema / boundary / policy 权威数据。
- `src/lib/prompts/rpg-page-guidance.ts` 的 `buildSourceIngestTargetPolicyGuidance()` 与 `buildRpgDirectoryBoundaryGuidance()` 保留为 Source Ingest prompt 的权威 policy/boundary 渲染入口。
- Runtime Update Apply 的 `runtime-update-interaction.ts`、`runtime-update-validation.ts`、`wiki-update-policy.ts`、`runtime-controller.ts`、`update-staging.ts`、`write-policy.ts` 保留。它们分别覆盖 proposal、deterministic validation、pending、accepted apply 与 target policy，Stage G 才负责统一挂入 import framework。

## merge

- `src/lib/ingest.ts` 长文档 chunk prompt 曾手写一份 Source Ingest 禁止 target 文案，同时又调用 `buildSourceIngestTargetPolicyGuidance()`。已将该禁止目标清单合并到 policy 渲染入口，避免 D2.5 policy 漂移。
- `src/lib/rpg-wiki-schema.ts` Source Ingest forbidden target policy 曾同时包含通配 `wiki/*/runtime/**` 和六条具体 runtime overlay 禁止项。通配规则已经表达相同行为；具体项应合并到通配规则的 reason / tests，而不是继续作为不可达规则存在。

## delete

- 已删除 `RPG_SOURCE_INGEST_TARGET_POLICY.forbiddenTargets` 中被 `wiki/*/runtime/**` 通配规则覆盖的具体重复项：
  - `wiki/characters/runtime/**`
  - `wiki/locations/runtime/**`
  - `wiki/factions/runtime/**`
  - `wiki/items/runtime/**`
  - `wiki/relationships/runtime/**`
  - `wiki/plot-arcs/runtime/**`
- 删除证据：
  - `getRpgSourceIngestForbiddenTarget()` 使用 `Array.find()` 按顺序返回第一条匹配。
  - `sourceIngestPathPatternMatches()` 对 `wiki/*/runtime/**` 匹配任意一级 `wiki/<category>/runtime/...`，因此后续六条具体 runtime 规则不可达。
  - 删除后 `rg "character runtime overlays record|location runtime overlays record|faction runtime overlays record|item runtime overlays record|relationship runtime overlays record|plot-arc runtime overlays record" src/lib` 无结果。
  - 既有测试只断言 runtime overlay 目标推荐 `runtime_update_apply`，通配规则仍满足该行为。
- 已删除 `buildChunkAnalysisSystemPrompt()` 中重复的手写禁止 target 句子：`Do not emit targetPath values under ...`。该信息现在由同一 prompt 中的 `buildSourceIngestTargetPolicyGuidance()` 输出。

## defer

- `runRpgRuntimeTurnFlow()` 未注入 `updateInteractionAdapter` 时的 `legacy_narration_block` fallback 有冗余迹象，但暂不删除。证据：`rg "legacy_narration_block|updateInteractionAdapter|extractRpgStateUpdates"` 显示 controller tests、turn journal proposal source、runtime persistence 类型和 `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` 仍显式覆盖该 transition path。移除会牵动 Stage G 的统一 framework 接入与 journal 语义。
- `extractRpgStateUpdates()` 同时被 runtime interaction parse、controller fallback 和 write-policy tests 使用；它是当前 fenced-block parser，不是 D3.5 可安全删除项。
- `src/lib/rpg-interactions/runtime-update-interaction.ts` 与 `src/lib/rpg-interactions/wiki-update-policy.ts` 都表达 runtime target 边界。当前 interaction prompt 通过 `getRpgRuntimeUpdateTargetRules()` 渲染 allowed targets，但仍有若干手写 forbidden examples。它们有漂移风险，建议 Stage G 统一框架接入时再收敛。
- D/D1/D2.5 prompt/schema 文案仍在 `RPG_DIRECTORY_BOUNDARY_GUIDANCE`、focused page guidance、analysis guidance 和 long-source signal guidance 中多层出现。当前多层承担不同 prompt 层级职责；本轮只合并明显重复 target policy 文案，保留语义约束。
- `src/lib/rpg-runtime.test.ts` 和 `src/lib/rpg-runtime-controller.test.ts` 有重复固定 slot fixture 迹象。`rpg-runtime-controller.test.ts` 已通过 `RPG_SCHEMA_SLOTS.map(...)` 集中创建 slots，但 `rpg-runtime.test.ts` 仍按用例手写部分 slot，以便测试缺失 slot warning 和固定 player slot 行为。本轮不抽公共 fixture，避免改变测试意图。
- legacy/default 相关 helper 和测试仍存在，例如 `wiki-mode.test.ts`、`wiki-page-types.test.ts`、`project-mode.test.ts`。当前测试多数在验证 legacy/default 被拒绝或不进入新项目路径；未发现 D3.5 可安全删除的 product-facing fallback。

## Cleanup Applied

- `src/lib/rpg-wiki-schema.ts`: 删除不可达的具体 runtime Source Ingest forbidden target entries，保留 `wiki/*/runtime/**` 作为权威禁止规则。
- `src/lib/ingest.ts`: 删除长文档 chunk prompt 中重复手写的 forbidden target 清单。
- `src/lib/ingest.prompt.test.ts`: 将断言改为检查权威 `## Source Ingest Target Policy` 与 `wiki/*/runtime/**` 通配规则。

## Validation

验证结果：

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-interactions.test.ts` passed: 3 files / 98 tests.
- `npm.cmd run typecheck` passed.

# RPG LLM Interaction Consolidation Plan

## Conclusion

这个想法是正确的，而且应该作为近期最高优先级的架构整理之一。

原因不是单纯的“文件放得乱”，而是 llmWikiRPG 的核心行为已经由多类 LLM interaction 决定：source ingest、长来源 chunk analysis、page merge、narration、runtime update、control document canonicalization、后续 context compiler / derivation / outline impact。只要这些 prompt、输出协议、target policy、parser、validation 和测试散在不同目录，继续开发新阶段就会持续产生漂移。

当前不建议立刻新增 Context Compiler v1、Relationship/Tension Deriver 接入、Outline Impact Detector 或更多模型交互阶段。更稳妥的下一步是先完成“RPG LLM interaction boundary consolidation v1”：把所有 RPG 模型交互契约收进同一个可检索、可测试、可注册的目录，并让旧位置只保留短期迁移 wrapper 或直接删除。

## Current Findings

本评估基于当前代码结构，重点检查了这些文件：

- `src/lib/rpg-interactions/interaction-spec.ts`
- `src/lib/rpg-interactions/source-ingest-analysis-interaction.ts`
- `src/lib/rpg-interactions/source-ingest-generation-interaction.ts`
- `src/lib/rpg-interactions/narration-interaction.ts`
- `src/lib/rpg-interactions/runtime-update-interaction.ts`
- `src/lib/rpg-interactions/runtime-update-validation.ts`
- `src/lib/rpg-interactions/wiki-update-policy.ts`
- `src/lib/rpg-interactions/control-doc-canonicalization-interaction.ts`
- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/prompts/rpg-page-guidance.ts`
- `src/lib/ingest.ts`
- `src/lib/rpg-merge-policy.ts`
- `src/lib/page-merge.ts`
- `src/lib/rpg-runtime/turn-orchestrator.ts`
- `src/lib/rpg-runtime/runtime-controller.ts`
- `src/lib/rpg-runtime/narration-prompts.ts`
- `src/lib/rpg-import/*`
- `src/lib/rpg-wiki-schema.ts`

当前已经有好的雏形：

- `RpgInteractionSpec` 已经定义了 `kind`、`buildPrompt()`、`parseOutput()`。
- `narrationInteractionSpec` 已经接管 narration prompt 和 `RpgTurnResult` JSON parse / validation。
- `runtimeUpdateInteractionSpec` 已经接管 runtime update prompt 和 fenced `rpg-wiki-update` output parser。
- `wiki-update-policy.ts` 和 `runtime-update-validation.ts` 已经承载 runtime target policy 与本地 validation。
- `sourceIngestAnalysisInteractionSpec` 和 `sourceIngestGenerationInteractionSpec` 已经让 ingest 调用入口开始走 interaction spec。

但集中化还没有完成：

| Area | Current location | Problem |
|---|---|---|
| Source ingest Stage 1 / Stage 2 prompt body | `src/lib/prompts/rpg-ingest.ts`, `src/lib/prompts/rpg-page-guidance.ts` | `rpg-interactions` 只有薄包装，真正 prompt contract 仍在旧 prompt 目录 |
| Long source chunk analysis prompt | `src/lib/ingest.ts` | RPG LLM contract 混在大型 ingest orchestrator 里 |
| Page merge LLM prompt and merge policy | `src/lib/rpg-merge-policy.ts`, called by `src/lib/ingest.ts` / `src/lib/page-merge.ts` | merge 也是模型交互，但没有纳入 interaction registry |
| Narration prompt | `src/lib/rpg-interactions/narration-interaction.ts`, wrapper at `src/lib/rpg-runtime/narration-prompts.ts` | 方向正确，但旧 wrapper 还让入口不够单一 |
| Runtime update prompt / parser / validation | mostly `src/lib/rpg-interactions/` | 方向正确，是后续迁移的样板 |
| Control doc canonicalization prompt | `src/lib/rpg-interactions/control-doc-canonicalization-interaction.ts` | spec 已存在，但当前 `control_doc_import` 仍是确定性 canonicalization，不使用该 interaction |
| Campaign setup import constraints | `src/lib/rpg-import/campaign-setup-import.ts` | 不是 LLM prompt，但其 slot / filter / boundary 也是模型相关契约的一部分，后续若加 LLM 会再次分裂 |
| Wiki schema and directory boundary | `src/lib/rpg-wiki-schema.ts` plus rendered prompt fragments | schema 是正确的代码可读源，但 prompt rendering 分布在 `prompts/` 与 `rpg-interactions/` |

## Problem Statement

现在最大问题不是某一条 prompt 写得不好，而是没有唯一的 RPG model contract location。

开发者想改一个阶段时，需要先猜：

- prompt 在 `src/lib/prompts/`、`src/lib/rpg-interactions/`、`src/lib/rpg-runtime/`、`src/lib/ingest.ts` 还是 `src/lib/rpg-merge-policy.ts`？
- 输出协议和 parseOutput 是否和 prompt 在同一个地方？
- target policy 是 prompt 文案、schema registry、runtime validation 还是 write policy 的哪一个版本？
- 某个测试断言的是旧 wrapper、interaction spec，还是直接断言旧 prompt builder？
- 新增模型阶段时应该跟随哪个模式？

这会导致三类风险：

1. Contract drift：prompt 要求 A，本地 parser / validator / write policy 按 B 执行。
2. Hidden coupling：一个阶段看似只改 prompt，实际影响 ingest parser、merge fallback、runtime write policy 或 UI pending queue。
3. New-stage sprawl：继续做 Context Compiler v1、relationship derivation、outline impact 时，会把新 prompt 再散到新的目录里。

## Target Architecture

`src/lib/rpg-interactions/` 应成为所有 RPG 模型交互契约的唯一入口。

这里的“契约”包括：

- prompt builder
- input type
- output type
- output protocol
- output parser
- deterministic validator
- target policy
- prompt-rendered schema fragment
- fixture adapter
- real LLM adapter
- focused tests

`src/lib/rpg-wiki-schema.ts` 仍然保留为 RPG wiki schema / slot / directory boundary 的代码可读数据源。它不应该变成 prompt 文件。`rpg-interactions` 应负责把这些 code-readable schema 渲染为各 interaction 所需的 prompt fragment，并把 parser / validator 与 prompt 放在同一边界内。

建议最终结构：

```text
src/lib/rpg-interactions/
  interaction-spec.ts
  registry.ts
  index.ts

  shared/
    language-rule.ts
    file-block-protocol.ts
    markdown-output-protocol.ts
    schema-fragments.ts
    prompt-rendering.ts

  contracts/
    directory-boundary-contract.ts
    source-ingest-target-policy-contract.ts
    runtime-update-target-policy-contract.ts
    runtime-cross-directory-sync-contract.ts

  source-ingest/
    analysis-interaction.ts
    generation-interaction.ts
    chunk-analysis-interaction.ts
    page-guidance-contract.ts
    domain-guidance.ts

  merge/
    page-merge-interaction.ts
    merge-policy.ts

  runtime/
    narration-interaction.ts
    narration-adapter.ts
    runtime-update-interaction.ts
    runtime-update-adapter.ts
    runtime-update-validation.ts
    wiki-update-policy.ts

  control-doc/
    canonicalization-interaction.ts

  campaign-setup/
    setup-contract.ts
```

可以按代码实际大小微调目录深度，但原则是：一个 RPG LLM interaction 不应该横跨 `prompts/`、`runtime/`、`ingest.ts` 和 parser 文件才能读懂。

## Registry Shape

建议新增 `src/lib/rpg-interactions/registry.ts`：

```ts
export interface RpgInteractionRegistryEntry<TInput, TOutput> {
  kind: RpgInteractionKind
  stage:
    | "source_ingest"
    | "page_merge"
    | "runtime_narration"
    | "runtime_update"
    | "control_doc_import"
    | "campaign_setup_import"
    | "context_compiler"
    | "derivation"
    | "outline"
  usesLlm: boolean
  buildPrompt?: (input: TInput) => RpgInteractionPrompt
  parseOutput?: (output: string, input: TInput) => TOutput
  validateOutput?: (output: TOutput, input: TInput) => RpgInteractionValidationResult
}
```

`usesLlm: false` 允许把 campaign setup 这类当前确定性阶段也登记进“阶段契约目录”，但不强行把它伪装成 LLM prompt。这样后续如果增加 LLM canonicalization，不会再开新孤岛。

## Migration Principles

- Behavior first：第一轮迁移只移动和重接线，不重写 prompt 语义。
- One interaction, one contract boundary：prompt、输出协议、parser、validator、target policy 和 tests 尽量同目录。
- No long-lived duplicate prompt files：旧位置最多保留短期 wrapper；完成对应阶段后删除旧 RPG prompt 文件。
- `ingest.ts` must orchestrate, not author prompts：它可以读取文件、分块、调用 LLM、写入 FILE blocks，但不应继续内联 RPG prompt 文案。
- `rpg-runtime/` must run turns, not define model contracts：runtime 可以调用 interaction spec，但不应定义 prompt 内容。
- `rpg-import/` must own import orchestration, not model prompt wording：import mode 可调用 interaction spec 或 deterministic contract。
- Code-readable contracts generate text：目录边界、allowed targets、forbidden targets、schema slots 应从 typed data 渲染进 prompt，避免手写多份。
- Tests move with contracts：旧 `ingest.prompt.test.ts` 可以拆分到 interaction tests，保留少量 orchestrator integration assertions。
- No legacy/default fallback：本项目是 RPG-only，不以旧 llm_wiki 兼容作为迁移约束。

## Execution Status

### 2026-06-09 - Phase 0 + Phase 1 Completed

Phase 0 和 Phase 1 已完成。本节记录执行结果，后续未执行阶段的目标和验收保持下面原计划不变。

已完成内容：

- 新增 `src/lib/rpg-interactions/registry.ts`，并从 `src/lib/rpg-interactions/index.ts` 导出 registry API。
- registry 当前只登记已实现的 interaction：`source_ingest_analysis`、`source_ingest_generation`、`control_doc_canonicalization`、`narration`、`runtime_state_update`。
- 实际差异：`RpgInteractionKind` 仍包含未来 kind。已采用 implemented / planned 分界，`campaign_setup_generation`、`relationship_derivation`、`outline_impact`、`outline_regeneration` 仅列为 planned，不伪造未实现 prompt 行为。
- 新增 `src/lib/rpg-interactions/source-ingest/`，并迁入 Source Ingest Stage 1、Stage 2、long-source chunk analysis 相关 prompt contract。
- 新增/迁入文件包括 `analysis-interaction.ts`、`generation-interaction.ts`、`page-guidance-contract.ts`、`chunk-analysis-interaction.ts`、`domain-guidance.ts`、`index.ts`。
- 删除旧 source ingest prompt 岛：`src/lib/prompts/rpg-ingest.ts`、`src/lib/prompts/rpg-page-guidance.ts`、`src/lib/prompts/domain-guidance.ts`。
- `src/lib/ingest.ts` 不再内联 RPG Source Ingest prompt 文案；它保留 orchestration、token budget、chunk split、LLM 调用、checkpoint 和写入逻辑。
- `src/lib/ingest.ts` 中保留的 `buildAnalysisPrompt()` / `buildGenerationPrompt()` 是短 wrapper，委托到 source-ingest interaction spec，便于既有测试/调用不立刻断裂。
- `src/lib/ingest.prompt.test.ts` 的真实 prompt builder 断言已改从 `src/lib/rpg-interactions/source-ingest` 导入。
- `src/lib/rpg-interactions.test.ts` 已增加 registry 覆盖和 legacy prompt location guardrail。

验收结果：

- `rg --encoding utf-8 "buildRpgAnalysisPrompt|buildRpgGenerationPrompt|buildFocusedRpgPageGuidance" src/lib/prompts src/lib/ingest.ts` 无结果。
- `rg --encoding utf-8 "You are an RPG wiki extraction analyst|RPG Wiki Generation Contract|RP Runtime Signals JSON" src/lib/prompts src/lib/ingest.ts` 无结果。
- `rg --encoding utf-8 "@/lib/prompts/rpg-ingest|@/lib/prompts/rpg-page-guidance|prompts/domain-guidance" src` 无结果。
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/ingest.prompt.test.ts` 通过。
- `npx.cmd vitest run src/lib/ingest.scenarios.test.ts src/lib/rpg-ingest-signals.test.ts` 通过。
- `npm.cmd run typecheck` 通过。

后续阶段状态：

- Phase 2 到 Phase 5 已在后续执行中完成，结果见下方记录。

### 2026-06-09 - Phase 2 Completed

Phase 2 已完成。本节只记录执行结果，后续未执行阶段的目标和验收保持下面原计划不变。

已完成内容：

- 新增 `src/lib/rpg-interactions/merge/`。
- 将旧顶层 `src/lib/rpg-merge-policy.ts` 移到 `src/lib/rpg-interactions/merge/merge-policy.ts`，未保留长期 wrapper。
- 新增 `src/lib/rpg-interactions/merge/page-merge-interaction.ts`，导出 `PageMergeInteractionInput` 与 `pageMergeInteractionSpec`。
- 新增 interaction kind `page_merge`，并在 registry 中以 `stage: "page_merge"`、`usesLlm: true` 注册。
- 新增 `src/lib/rpg-interactions/merge/index.ts`，并从 `src/lib/rpg-interactions/index.ts` 导出 merge contract。
- `src/lib/ingest.ts` 的 page merger 改为调用 `pageMergeInteractionSpec.buildPrompt({ existingContent, incomingContent, pagePath, sourceFileName })`，本地不再拼接 page merge prompt。
- `src/lib/page-merge.ts` 继续保留 deterministic safety boundary：frontmatter union、locked fields、body shrink threshold、section merge、lint、fallback / backup。
- 更新 merge 相关 import 与测试，包括 `page-merge.ts`、`rpg-section-merge.ts`、`rpg-merge-lint.ts`、`rpg-merge-review.ts`、`rpg-merge-policy.test.ts`、`rpg-interactions.test.ts`。
- `src/lib/rpg-interactions.test.ts` guardrail 已更新：旧 `src/lib/rpg-merge-policy.ts` 应不存在，源码不应从旧路径 import。

验收结果：

- `rg --encoding utf-8 "rpg-merge-policy" src` 无结果。
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts src/lib/rpg-merge-lint.test.ts src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-review.test.ts` 通过；最终回归为 6 个测试文件 / 111 个测试。
- `npm.cmd run typecheck` 通过。

### 2026-06-09 - Phase 3 Completed

Phase 3 已完成。本节只记录执行结果，后续未执行阶段的目标和验收保持下面原计划不变。

已完成内容：

- 新增 `src/lib/rpg-interactions/runtime/`。
- 将 runtime interaction contract 文件组织到该目录：`narration-interaction.ts`、`runtime-update-interaction.ts`、`runtime-update-adapter.ts`、`llm-runtime-update-adapter.ts`、`runtime-update-validation.ts`、`wiki-update-policy.ts`。
- 将 narration adapter/validation 从 `src/lib/rpg-runtime/narration-adapter.ts` 移到 `src/lib/rpg-interactions/runtime/narration-adapter.ts`。
- 将 `src/lib/rpg-runtime/llm-narration-adapter.ts` 移到 `src/lib/rpg-interactions/runtime/llm-narration-adapter.ts`。
- 新增 `src/lib/rpg-interactions/runtime/index.ts` 并从 `src/lib/rpg-interactions/index.ts` 导出 runtime contract。
- 删除旧 `src/lib/rpg-runtime/narration-prompts.ts` wrapper；`buildRpgNarrationPrompt()` 现在由 `src/lib/rpg-interactions/runtime/narration-interaction.ts` 导出。
- 新增 `src/lib/rpg-interactions/runtime/runtime-update-protocol.ts`，让 `rpg-wiki-update` fenced protocol marker 归属 runtime interaction boundary；`src/lib/rpg-runtime/state-extractor.ts` 仍保留 runtime state extraction 职责并消费该 helper。
- 更新 `src/lib/rpg-runtime/turn-orchestrator.ts`、`runtime-controller.ts`、`state-extractor.ts`、`write-policy.ts`、`src/lib/rpg-import/runtime-update-apply.ts`、`src/components/rpg/rpg-runtime-panel.tsx` 与相关测试 import。
- 更新 `src/lib/rpg-runtime/index.ts`：不再 export narration prompt / LLM adapter contract，只保留 runtime state / orchestration / persistence / write policy / controller 等运行时职责。
- `src/lib/rpg-interactions.test.ts` guardrail 已更新：旧 runtime prompt/adapter wrapper 文件应不存在，真实 runtime prompt 文案不应位于 `src/lib/rpg-runtime/`。

验收结果：

- `rg --encoding utf-8 "narration-prompts|rpg-runtime/llm-narration-adapter|rpg-runtime/narration-adapter" src` 无结果。
- `rg --encoding utf-8 "llmWikiRPG narration runtime|rpg-wiki-update|Runtime Capsule" src/lib` 显示 runtime narration/update prompt 与 `rpg-wiki-update` protocol marker 已集中到 `src/lib/rpg-interactions/runtime/`；`Runtime Capsule` 仍出现在 deterministic lint / merge / extraction validation / distiller 与测试中，属于 heading/policy 检查，不是 runtime prompt wrapper。
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-runtime-update-validation.test.ts src/components/rpg/rpg-runtime-panel.test.tsx` 通过；7 个测试文件 / 114 个测试。
- `npm.cmd run typecheck` 通过。

### 2026-06-09 - Phase 4-5 Completed

Phase 4-5 已完成。本节记录执行结果，下面原计划保留为历史执行说明。

已完成内容：

- 新增 `src/lib/rpg-interactions/control-doc/`，并将 `controlDocCanonicalizationInteractionSpec` 移入 `control-doc/canonicalization-interaction.ts`。
- 新增 `src/lib/rpg-interactions/control-doc/import-contract.ts` 和 `index.ts`；control doc import 的 supported slots、target paths、write policies、review policies、canonicalization notes 已集中到该 contract。
- 删除旧顶层 `src/lib/rpg-interactions/control-doc-canonicalization-interaction.ts`，未保留长期 wrapper。
- 新增 `src/lib/rpg-interactions/campaign-setup/setup-contract.ts` 和 `index.ts`；campaign setup import 的 supported slots、`questName` / `relationshipName` 动态 target path、write policies、review policies、canonicalization/bootstrap notes、future-pressure filtering、ability-like input review boundary、`current_scene` explicit bootstrap boundary 已集中到该 contract。
- `src/lib/rpg-import/control-doc-import.ts` 和 `src/lib/rpg-import/campaign-setup-import.ts` 改为从对应 `rpg-interactions` 子目录 barrel 读取 contract 数据；`rpg-import/*` 继续负责 source 读取、raw source anchor、safe path、manual confirm、target 写入和 review item 生成。
- 后续复核发现 `src/lib/prompts/shared-ingest.ts` 虽是 shared helper，但仍含 RPG-specific REVIEW / FILE protocol 文案；已移到 `src/lib/rpg-interactions/source-ingest/shared-ingest-contract.ts`，并从 source-ingest interaction 内部引用。
- `RpgInteractionKind` 新增 deterministic kind `campaign_setup_import_contract`，并在 registry 中以 `stage: "campaign_setup_import"`、`usesLlm: false`、`implemented: true` 注册。
- registry 中 `control_doc_canonicalization` 仍属于 `stage: "control_doc_import"`，但当前标记为 `usesLlm: false`。实际差异说明：该 prompt spec 是模型契约边界 / 未来可选入口；当前默认 `control_doc_import` 仍是 deterministic faithful canonicalization。
- `campaign_setup_generation` 继续保留为 planned future kind，没有伪造当前 LLM 行为。
- 更新 `src/lib/rpg-interactions.test.ts`，覆盖 deterministic import contracts、registry usesLlm 分界、旧 control-doc 顶层文件不存在、旧 `src/lib/prompts/shared-ingest.ts` 不存在、以及 `campaign-setup-import.ts` 不重新定义 future-pressure / supported-slot 常量。

验收结果：

- `rg --encoding utf-8 "control-doc-canonicalization-interaction" src` 无结果。
- `rg --encoding utf-8 "prompts/shared-ingest|src/lib/prompts/shared-ingest|shared-ingest.ts" src` 仅命中 `src/lib/rpg-interactions.test.ts` 中的旧路径缺失 guardrail。
- `rg --encoding utf-8 "You are an RPG|llmWikiRPG narration runtime|RPG wiki extraction|rpg-wiki-update|Runtime Capsule" src/lib` 显示真实 prompt/protocol 文案集中在 `src/lib/rpg-interactions/`；`Runtime Capsule` 仍出现在 deterministic lint / merge / signals / distiller helper 与测试中，属于 heading/policy 检查，不是旧 prompt island。
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-import/control-doc-import.test.ts src/lib/rpg-import/campaign-setup-import.test.ts src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-import/ui-import-options.test.ts` 通过，5 个测试文件 / 88 个测试。
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-runtime-update-validation.test.ts` 通过，4 个测试文件 / 72 个测试。
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/ingest.prompt.test.ts` 在 shared-ingest 迁移后通过，2 个测试文件 / 84 个测试。
- `npm.cmd run typecheck` 通过。

范围说明：

- 未改变 import 行为、写入策略、manual confirmation、safe path、raw source anchor 或 review item 生成。
- 未接入真实 LLM。
- 未新增 legacy/default 兼容、迁移、fallback 或旧路径保留。
- 未执行 `git commit` 或 `git push`。

## Phased Plan

### Phase 0 - Audit and Guardrails

目标：先建立清单与防漂移测试，不迁移行为。

动作：

- 新增 `rpg-interactions` registry。
- 为现有 interaction specs 注册 `source_ingest_analysis`、`source_ingest_generation`、`control_doc_canonicalization`、`narration`、`runtime_state_update`。
- 新增测试，断言所有 `RpgInteractionKind` 都能从 registry 找到。
- 新增 `rg` 风格的测试或文档检查清单，列出暂时允许的 RPG prompt 旧位置。
- 记录当前旧位置：`src/lib/prompts/rpg-ingest.ts`、`src/lib/prompts/rpg-page-guidance.ts`、`src/lib/ingest.ts` chunk prompts、`src/lib/rpg-merge-policy.ts`。

验收：

- 无产品行为变化。
- registry 可列出当前已实现 interaction。
- 文档明确下一阶段要删除的旧位置。

执行状态（2026-06-09）：已完成。实际实现采用 implemented / planned 分界；registry 覆盖当前已实现 interaction，未来 kind 不登记为已实现行为。

### Phase 1 - Source Ingest Interaction Consolidation

目标：把 source ingest 的 Stage 1、Stage 2、long-source chunk analysis prompt 移到 `rpg-interactions/source-ingest/`。

动作：

- 将 `buildRpgAnalysisPrompt()` 移到 `source-ingest/analysis-interaction.ts` 或相邻 helper。
- 将 `buildRpgGenerationPrompt()` 移到 `source-ingest/generation-interaction.ts`。
- 将 `buildFocusedRpgPageGuidance()`、`buildMinimalRpgGenerationContract()`、`buildRpgDirectoryBoundaryGuidance()` 等 RPG page guidance 移到 `source-ingest/page-guidance-contract.ts` 或 `contracts/`。
- 将 `buildChunkAnalysisSystemPrompt()` 和 `buildChunkAnalysisUserPrompt()` 从 `src/lib/ingest.ts` 移到 `source-ingest/chunk-analysis-interaction.ts`。
- `src/lib/ingest.ts` 只调用 interaction spec，不再直接拼 RPG prompt 文案。
- 更新 prompt tests，从直接 import `ingest.ts` prompt builder 改为 import `rpg-interactions/source-ingest`。
- 删除 `src/lib/prompts/rpg-ingest.ts` 和 `src/lib/prompts/rpg-page-guidance.ts`，或只保留一个阶段内的短 wrapper；最终不能长期保留重复实现。

验收：

- `rg --encoding utf-8 "buildRpgAnalysisPrompt|buildRpgGenerationPrompt|buildFocusedRpgPageGuidance" src/lib/prompts src/lib/ingest.ts` 不再显示真实实现。
- Source ingest prompt snapshot / assertion tests 仍通过。
- `autoIngest()` 行为不变。

执行状态（2026-06-09）：已完成。旧 prompt 文件已删除；真实 Source Ingest prompt 入口位于 `src/lib/rpg-interactions/source-ingest/`；`src/lib/ingest.ts` 只保留委托 wrapper 与编排逻辑。

### Phase 2 - Page Merge Interaction Consolidation

目标：把 page merge 的 LLM prompt 与 RPG merge policy 纳入 interaction boundary。

动作：

- 将 `src/lib/rpg-merge-policy.ts` 移到 `src/lib/rpg-interactions/merge/merge-policy.ts`。
- 新增 `pageMergeInteractionSpec`，输入包括 `existingContent`、`incomingContent`、`pagePath`、`sourceFileName`。
- `page-merge.ts` 保留确定性 merge safety：frontmatter union、locked fields、body shrink threshold、section merge、lint、fallback。
- `ingest.ts` 调用 `pageMergeInteractionSpec.buildPrompt()`，adapter 只负责 `streamChat()`。
- 合并 prompt 的 output requirements 与 parser/sanity checks 在 interaction / page-merge 边界之间明确分工。

验收：

- `rpg-merge-policy` 不再是 `src/lib` 顶层孤岛。
- Merge prompt、merge kind、body shrink threshold、target-specific prompt fragment 在同一目录。
- 现有 merge tests 不需要依赖旧路径。

### Phase 3 - Runtime Interaction Cleanup

目标：把 runtime 已经完成的集中化收尾，删除旧 wrapper 模糊入口。

动作：

- 让 `turn-orchestrator.ts` 直接 import `narrationInteractionSpec` 或明确 import `buildRpgNarrationPrompt` from `rpg-interactions/runtime`。
- 删除或缩小 `src/lib/rpg-runtime/narration-prompts.ts` wrapper。
- 将 `llm-narration-adapter.ts` 视情况移到 `rpg-interactions/runtime/narration-adapter.ts`，或保留在 runtime 但只作为 adapter，不含 prompt 文案。
- 将 runtime update interaction、adapter、target policy、validation 组织到 `rpg-interactions/runtime/` 下，保持现有行为。
- 更新 `src/lib/rpg-runtime/index.ts` export，避免让开发者误以为 prompt contract 仍属于 runtime 目录。

验收：

- Runtime prompt contract 只在 `rpg-interactions`。
- `rpg-runtime` 只保留 runtime state / orchestration / write policy。
- Controller tests 与 narration prompt tests 通过。

### Phase 4 - Import Mode Contract Alignment

目标：把 control doc 和 campaign setup 的模型相关契约纳入同一索引，即使当前多数行为仍是确定性的。

动作：

- 将 `controlDocCanonicalizationInteractionSpec` 移到 `rpg-interactions/control-doc/` 并在 registry 标记。
- 明确 `control_doc_import` 当前默认 `usesLlm: false`，只做 deterministic faithful canonicalization。
- 给 `campaign_setup_import` 增加 `setup-contract.ts`，登记 supported slots、target paths、write policies、future-pressure filtering boundary、review policy。
- 不强行用 LLM 改写 campaign setup；只把其契约收进同一可检索位置。
- `src/lib/rpg-import/*` 继续负责文件读写、manual confirm、safe path 和 review item 生成。

验收：

- 开发者可在 `rpg-interactions` 查到所有 import mode 的模型/契约边界。
- `rpg-import` 不再藏着未来 LLM prompt 设计。
- Existing import tests 通过。

### Phase 5 - Remove Old Prompt Islands

目标：清掉迁移后的冗余旧文件。

动作：

- 删除长期不应存在的 RPG prompt 文件或 wrapper。
- 确认 `src/lib/prompts/` 中不再有 RPG-specific prompt builders。若仍有非 RPG 通用 helper，应改名或移入 interaction shared。
- 确认 `src/lib/ingest.ts` 不再包含大段 RPG prompt 文案。
- 确认 `src/lib/rpg-runtime/` 不再包含 prompt contract 真实实现。
- 更新 `docs/CURRENT_STATE.md`、`docs/IMPLEMENTATION_LOG.md`、必要架构文档。

验收：

- `rg --encoding utf-8 "You are an RPG|llmWikiRPG narration runtime|RPG wiki extraction|rpg-wiki-update|Runtime Capsule" src/lib` 的结果集中在 `src/lib/rpg-interactions/`，少量 tests 除外。
- 没有长期重复 prompt builder。
- `npm.cmd run typecheck` 通过。
- 相关 prompt / interaction / ingest / runtime tests 通过。

## Recommended First Implementation Slice

状态说明：本建议已被 2026-06-09 的 Phase 0 + Phase 1 执行结果覆盖，保留为历史执行建议；后续继续从 Phase 2 开始。

建议第一个可执行阶段只做 Phase 0 + Phase 1 的前半部分：

1. 新增 registry 和 interaction inventory tests。
2. 将 source ingest Stage 1 / Stage 2 prompt builder 移入 `src/lib/rpg-interactions/source-ingest/`。
3. 暂时保留 `src/lib/ingest.ts` 导出的 `buildAnalysisPrompt()` / `buildGenerationPrompt()` wrapper，只委托到新 interaction，以降低一次性测试修改量。
4. 下一小步再把测试 import 改到新路径并删除 wrapper。

这样可以先解决开发者最痛的 ingest prompt 查找问题，同时不立刻动 page merge、runtime 和 import mode。

## Non-goals

- 不在本计划中重写 prompt 语义。
- 不改变 FILE / REVIEW block protocol。
- 不改变 runtime pending / accept / apply 安全边界。
- 不引入旧 default / legacy 项目兼容。
- 不新增真实 LLM 调用。
- 不把 deterministic import mode 强行改成 LLM import。
- 不自动删除用户磁盘上的旧目录。

## Validation Commands

每个迁移阶段至少运行相应 focused tests。建议组合：

```powershell
npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/ingest.prompt.test.ts
npx.cmd vitest run src/lib/rpg-runtime-controller.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-runtime-update-validation.test.ts
npx.cmd vitest run src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts src/lib/rpg-merge-lint.test.ts src/lib/rpg-section-merge.test.ts
npx.cmd vitest run src/lib/rpg-import/control-doc-import.test.ts src/lib/rpg-import/campaign-setup-import.test.ts src/lib/rpg-import/runtime-update-apply.test.ts
npm.cmd run typecheck
```

如果某阶段只移动 source ingest prompt，可以先运行第一行和 typecheck。

## Decision Record

本计划建议把“LLM interaction contract consolidation”插到下一轮模型相关功能之前执行。

具体排序建议：

1. RPG LLM interaction consolidation v1。
2. Context Compiler v1。
3. Relationship/Tension Deriver integration。
4. Outline Impact Detector。
5. Outline Regenerator。
6. Project Audit / Evaluation v1。

这样做的收益是：后续每增加一个模型交互，都能直接落到 registry 和 interaction contract 目录中，不再继续扩大 prompt sprawl。

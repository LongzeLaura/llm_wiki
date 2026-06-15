# RPG 运行时软格式恢复计划

## 目的

本计划将软语义运行时阶段转变为可恢复边界，以应对常见的 LLM 格式失败，同时保持严格的规范化校验和严格的持久化/写入门禁。

目标不是相信 LLM 总能输出完美的 JSON。目标是接受低风险的草稿变体，将其规范化为规范化的内部对象，对可修复的畸形输出仅用一条短的修复专用提示重试一次，并且继续把不安全或会影响写入的失败保持为硬失败。

## 范围

包含：

- Action Resolver 草稿解析与编译。
- World Tick 草稿解析与编译。
- Narration Generator 草稿解析与编译。
- 在 `JSON.parse` 之前使用的共享 JSON 提取与修复工具。
- 对软语义阶段中的解析/校验失败进行一次性的修复专用重试。
- 每一次规范化、修复、重试和最终失败都要在 debug trace 中可见。
- 覆盖常见畸形 JSON 和宽松草稿字段形态的测试。

不包含：

- Runtime Update Proposal 的写安全性放宽。
- Runtime Update Validation 的放宽。
- Pending Update Persistence 或 apply-pending 的放宽。
- 静默接受不安全知识泄漏、被禁止的写入目标，或被禁止的持久化声明。
- 将完整的长提示重新运行作为修复策略。

## 设计原则

1. 软语义阶段应该能从机械性的格式缺陷中恢复。
2. 规范化运行时对象保持严格且内部一致。
3. 持久化边界保持硬性和确定性。
4. 所有修复都必须在 debug trace 中可审计。
5. 修复重试必须简短、聚焦 schema，并且默认只允许一次。
6. 对简单、低风险的强制转换，优先使用本地确定性规范化。
7. 对畸形 JSON 或本地规范化无法安全解决的结构歧义，才使用 LLM 修复。

## 阶段 0 - 基线审计与失败分类

状态：已完成（2026-06-15）

任务：

- 盘点 Action Resolver、World Tick 和 Narration Generator 的现有解析/编译/校验路径。
- 将现有失败分类为：
  - malformed_json
  - json_extract_failed
  - loose_scalar_array
  - loose_single_object_array
  - null_optional_field
  - invalid_semantic_enum
  - missing_semantic_field
  - forbidden_safety_key
  - canonical_validation_failed
- 添加 debug trace 标签，用于区分解析失败、草稿规范化失败、编译器失败、规范化校验失败和持久化边界失败。
- 确认哪些字段可以安全强制转换，哪些字段必须保持硬失败。

交付物：

- 在运行时格式化文档或契约分类说明中更新失败分类体系。
- 基于真实 trace 复制的测试夹具，包括 `playerActionDelta.notes` 以字符串形式出现的案例。

验收标准：

- 开发者可以仅根据 debug trace 判断失败是机械格式问题、语义契约问题、安全问题，还是持久化相关问题。

阶段 0 审计结论：

- Action Resolver 当前路径是 `extractJsonObjectText -> JSON.parse -> compileActionResolutionDraftOutput -> validateActionResolution`。`playerActionDelta.notes` 为字符串时仍保持 hard failure，但 debug trace 会标记为 `origin: draft_normalization`、`kind: loose_scalar_array`、`category: mechanical_format`。
- World Tick 当前路径是 `extractJsonObjectText -> JSON.parse -> validateWorldTickResult`，canonical 失败后再尝试 `compileWorldTickDraftOutput -> validateWorldTickResult`。trace 需要把 canonical 校验失败、draft 编译失败和最终失败分开看待；阶段 0 只补最终错误分类，不改变该顺序。
- Narration Generator 当前路径是 `extractJsonObjectText -> JSON.parse -> compileTurnNarrationDraftOutput -> validateTurnNarration`。玩家可见泄漏和安全边界仍属于 hard failure。
- 现有 JSON 提取函数在多个 runtime interaction 文件中重复；阶段 0 不抽共享修复工具，阶段 2 再统一 JSON 提取/本地修复。

阶段 0 失败分类：

| kind | category | origin | 说明 |
| --- | --- | --- | --- |
| `json_extract_failed` | `mechanical_format` | `json_extract` | 没有找到 JSON 对象或空 LLM 输出。 |
| `malformed_json` | `mechanical_format` | `json_parse` | 找到了候选 JSON，但 `JSON.parse` 失败。 |
| `loose_scalar_array` | `mechanical_format` | `draft_normalization` | 草稿数组字段收到 scalar，例如真实 trace 中 `playerActionDelta.notes: string`。 |
| `loose_single_object_array` | `mechanical_format` | `draft_normalization` | 草稿数组字段收到单对象；阶段 0 只分类，不包装。 |
| `null_optional_field` | `mechanical_format` | `draft_normalization` | 可选草稿字段收到 `null`；阶段 0 只分类，不默认化。 |
| `missing_semantic_field` | `semantic_contract` | `draft_compiler` 或 `canonical_validation` | 必需语义字段缺失或为空。 |
| `invalid_semantic_enum` | `semantic_contract` | `draft_compiler` 或 `canonical_validation` | happened/status/visibility/intent 等枚举无效。 |
| `forbidden_safety_key` | `safety` | `draft_compiler` | 软阶段输出 `wikiWrites` 等被禁止安全键。 |
| `canonical_validation_failed` | `semantic_contract` | `canonical_validation` | 编译后的 canonical 对象仍未通过严格校验。 |
| `forbidden_persistence_claim` / `forbidden_write_target` | `persistence` | `persistence_boundary` | 写入声明、目标路径或 pending/apply 边界失败。 |

安全强制转换候选确认：

- 阶段 1 可以考虑的低风险候选：可选字符串数组的 `undefined -> []`、显式可选草稿数组的 `null -> []`、字符串备注字段 `string -> [trimmed string]`、字符串数组 trim/filter、少数无歧义可选对象数组的单对象包装。
- 必须继续 hard failure：非字符串数组成员、必需语义对象畸形、无效 enum、安全/持久化键、写入目标、知识泄漏、canonical validator 拒绝。

## 阶段 1 - 面向软语义字段的宽松草稿规范化器

状态：已完成（2026-06-15）

任务：

- 为软草稿编译器添加共享辅助函数：
  - `readStringArrayLoose(record, key, label)`
  - `readOptionalStringLoose(record, key, label)`（如有需要）
  - `readArrayLoose(record, key, label, options)`，用于安全的单对象到单元素数组场景
- 支持以下安全强制转换：
  - `undefined -> []`，适用于可选数组
  - `null -> []`，仅适用于显式可选的草稿数组
  - `string -> [trimmed string]`，适用于字符串数组语义的备注字段
  - `string[] -> trimmed non-empty string[]`
  - 单个对象 -> `[object]`，仅限于少数可选对象数组草稿字段，且一个条目时不会产生歧义
- 保持以下内容为硬错误：
  - 字符串数组字段中出现 number/boolean/object
  - 字符串数组字段中包含非字符串的数组
  - 畸形的必需语义对象
  - 无效枚举
  - 被禁止的安全/持久化键

初始目标字段：

- Action Resolver：
  - `parsedIntent.targetRefs`
  - `parsedIntent.ambiguityNotes`
  - `eventDraft.actorRefs`
  - `eventDraft.targetRefs`
  - `eventDraft.affectedRefs`
  - `eventDraft.requiredChecks`
  - `eventDraft.ambiguityNotes`
  - `directResults[].affectedRefs`
  - 所有 `playerActionDelta.*Changes` 数组
  - `playerActionDelta.exposedInformation`
  - `playerActionDelta.notes`
- World Tick：
  - 已被分类为草稿/默认数组的可选语义数组
  - 仅在现有编译器可以安全默认或包装时处理 warnings 和 references
- Narration Generator：
  - warnings
  - tension signals
  - next action option 数组，其中单个条目是无歧义的

交付物：

- 共享的宽松读取器工具，或行为完全一致的阶段本地辅助函数。
- 先修改 Action Resolver 编译器，再处理 World Tick 和 Narration。
- 针对 `playerActionDelta.notes: string -> string[]` 的回归测试。

验收标准：

- 真实 trace 中 `playerActionDelta.notes` 为字符串的形态能够编译为规范化 `notes: [string]`，并记录警告。
- 不安全的字段形态仍然会在规范化接受之前失败。

阶段 1 实施结论：

- `soft-draft-protocol` 已提供共享 loose reader 和 `loose_draft_coercion` warning formatter。
- Action Resolver 已接受 `playerActionDelta.notes: string -> string[]`，并显式编译 `parsedIntent` 中的软语义数组字段。
- World Tick 已接受可选 draft 数组 `null -> []`、字符串数组 trim/filter，以及 `warnings` / `references` 单对象包装。
- Narration Generator 已接受 `warnings`、tension signal 和 `likelyAffectedPaths` 的安全宽松形态。
- debug trace 会通过现有 step warnings / validation warning section 暴露 coercion warning。
- 无效 enum、必需语义字段缺失、非字符串数组成员、forbidden safety key、知识泄漏和持久化边界仍保持 hard failure。

## 阶段 2 - 可审计的 JSON 提取与本地修复

状态：已完成（2026-06-15）

任务：

- 为软语义 LLM 输出创建共享的 JSON 预处理工具。
- 保留现有的平衡对象提取和 fenced JSON 提取。
- 增加保守的本地修复步骤：
  - 去除 markdown fence
  - 裁剪第一个平衡 JSON 对象前后的前后置说明文字
  - 删除 `}` 或 `]` 前的尾随逗号
  - 仅当智能引号充当 JSON 分隔符时，将其规范化
  - 在能够检测到时，转义 JSON 字符串中的原始换行字符
- 避免激进修复，因为它们可能改变含义，例如凭空补键或修改枚举值。
- 返回一份修复报告：
  - 原始长度
  - 提取后的长度
  - 已应用的修复操作
  - 修复是否改变了文本
  - 解析成功/失败

交付物：

- 共享工具，例如 `parseSoftSemanticJsonOutput()`。
- 集成到 Action Resolver、World Tick 和 Narration 的解析路径中。
- debug trace 中用于展示 JSON 提取/修复操作的部分。

验收标准：

- 常见的机械性 JSON 缺陷可以在本地修复，而无需重新运行完整提示。
- 每一次本地修复都要在 debug trace 警告或解析部分可见。
- 如果本地修复无法安全解析，系统应进入阶段 3 的修复专用重试。

阶段 2 实施结论：

- `soft-semantic-json` 已提供共享 `parseSoftSemanticJsonOutput()`、`SoftSemanticJsonParseReport` 和 `SoftSemanticJsonParseError`。
- Action Resolver、World Tick 和 Narration Generator 已统一使用共享 JSON 提取/本地修复路径，保留原 `interactionSpec.parseOutput(output, input)` 签名，并额外支持可选 report collector。
- 本地修复仅覆盖 markdown fence / 前后说明裁剪 / 尾随逗号 / JSON delimiter 位置智能引号 / 字符串内原始换行；不会补 key、补逗号、修改 enum、修复安全键或生成写入目标。
- turn orchestrator 的 raw-output debug 路径会把 `JSON 提取与本地修复` report 写入 `validationSections`，并在发生改变时记录 `json_format_recovery` warning。
- 无 JSON 对象会以 `json_extract_failed` hard fail；修复后仍无法解析会以 `malformed_json` hard fail，并在 trace 中保留失败 report，供阶段 3 修复专用重试使用。
- Runtime Update Proposal、Runtime Update Validation、Pending Persistence、apply-pending、legacy/default fallback 和旧路径兼容均未接入本阶段修复。

## 阶段 3 - 一次性修复专用重试

状态：已完成（2026-06-15）

任务：

- 添加软阶段修复适配器，仅在本地解析/编译/校验失败后运行。
- 修复提示必须只包含：
  - 出错的模型输出
  - 精确的 parser/compiler/validator 错误
  - 当前阶段所需的最小草稿 schema
  - 仅返回修正后 JSON 的指令
- 修复提示中不要包含原始的长运行时上下文。
- 默认将重试次数限制为 1 次。
- 将修复输出视为草稿输入，再次运行同样的本地解析器、规范化器、编译器和规范化校验器。
- 如果修复失败，在 debug trace 中同时暴露原始失败和修复失败。

交付物：

- 先为 Action Resolver 提供修复专用重试路径。
- 适用于软语义阶段的共享修复提示构建器。
- 用于启用/禁用修复重试的特性开关或运行时选项。

验收标准：

- 缺少逗号之类的畸形 JSON 可以通过修复重试纠正，而无需重新运行完整 action 提示。
- 修复重试不能绕过被禁止的安全键或持久化门禁。
- debug trace 同时显示原始输出和修复尝试摘要。

阶段 3 实施结论：

- `soft-semantic-repair-retry` 已提供共享修复提示构建器；提示只包含失败输出、初始错误摘要、可选 JSON parse report、最小 draft schema 和仅返回 JSON 的指令，不带原始长 runtime 上下文。
- Action Resolver prompt 已抽出 `ACTION_RESOLUTION_DRAFT_SCHEMA_PROMPT_LINES`，普通 Action Resolver prompt 与修复提示共用同一份最小 draft schema。
- `RpgActionResolverAdapter` 新增可选 `repairActionResolutionRawOutput()`；LLM adapter 复用现有 `streamChat` 收集逻辑，修复请求默认 `temperature: 0`、`max_tokens: 1800`，并支持 `repairRequestOverrides`。
- `RunRpgTurnInput` / `RunRpgRuntimeTurnFlowInput` / client-worker 输入链路已支持 `softSemanticRepairRetry`；默认关闭，显式启用后首版只作用于 Action Resolver。
- Action Resolver raw-output debug 路径会在初始 parse/compile/validate 失败后分类错误；仅 `mechanical_format` 的 `json_extract_failed`、`malformed_json`、低风险 loose draft normalization 失败会尝试一次修复重试。
- safety、persistence、provider、input assembly、非法 enum、缺失必需语义字段等失败不会触发修复重试；修复输出仍重新走同一套 `parseRpgActionResolverOutput -> compileActionResolutionDraftOutput -> validateActionResolution`。
- debug trace 会记录 `修复专用重试初始失败`、`修复专用重试输出`、`修复专用重试摘要`，成功时追加 `repair_retry_succeeded: action_resolver` warning；修复失败时同时保留原始失败和修复失败摘要。
- Runtime Update Proposal、Runtime Update Validation、Pending Persistence、Apply、World Tick、Narration Generator、legacy/default fallback 和旧路径兼容均未接入本阶段修复。

阶段 3 扩展实施结论（2026-06-15）：

- `softSemanticRepairRetry` 已从 Action Resolver 扩展到所有 runtime LLM 阶段：Action Resolver、World Tick、Recall Selector、Outline Brief、Story Outline Regenerator、Narration Generator 和 Runtime Update Proposal。
- Runtime Update Validation、Pending Update Persistence、apply-pending 和 write policy 仍保持 deterministic hard boundary，不接入 repair retry，也不把 repair 输出作为持久化接受依据。
- `parseSoftSemanticRawOutputWithOptionalRepairRetry()` 成为共享 runtime helper：每个阶段传入 stepId、stage label、最小 draft schema、阶段安全说明、parser/compiler/validator 和可选 repair raw-output adapter。
- repair retry 仍只在显式启用后、且初始失败分类为 `mechanical_format` 的 `json_extract_failed`、`malformed_json` 或低风险 loose draft normalization 失败时尝试一次；非法 enum、缺失必需语义字段、safety、persistence、provider 和 input assembly 失败仍不触发。
- repair prompt 已改为阶段可配置安全说明，不再写死 Action Resolver 专用的 “no world tick / no narration / no next action options” 禁令；Runtime Update Proposal 的 repair prompt 明确禁止 pending/apply/direct write，但允许修复 draft review material 本身的 JSON 形态。
- World Tick、Recall Selector、Outline Brief、Story Outline Regenerator、Narration Generator 和 Runtime Update Proposal 的 LLM adapters 已提供对应 repair raw-output 方法，默认 `temperature: 0`、`max_tokens: 1800`，并支持 `repairRequestOverrides`。
- Recall Selector、Outline Brief、Story Outline Regenerator 和 Runtime Update Proposal 的 JSON 解析已接入共享 `parseSoftSemanticJsonOutput()` 并向 debug trace 暴露 JSON parse report。
- RPG debug console 已新增默认关闭的“修复重试”开关；开启后 runtime panel 才向后端传 `{ enabled: true, maxAttempts: 1 }`。
- 验证通过：`npm.cmd exec -- vitest run src/lib/rpg-soft-semantic-repair-retry.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-debug-trace.test.ts src/components/rpg/rpg-runtime-debug-console.test.tsx src/components/rpg/rpg-runtime-panel.test.tsx --exclude='**/*.real-llm.test.ts'`（5 files / 64 tests）、`npm.cmd run typecheck`、`npm.cmd run build:runtime`；`build:runtime` 仍提示既有 Vite `inlineDynamicImports` deprecated warning。

## 阶段 4 - 保持规范化校验边界

状态：已完成（2026-06-15）

任务：

- 确保规范化校验器接收的是完全编译好的规范化对象，而不是原始 LLM 草稿。
- 对以下内容保持严格的规范化校验：
  - ID 和运行时引用
  - happened 状态枚举
  - 可见性与知识范围
  - 来源引用
  - 写入目标策略
  - 持久化资格
- 增加测试，证明宽松草稿接受不会削弱规范化校验器。
- 更新校验边界文档，区分：
  - 宽松草稿规范化
  - 本地 JSON 修复
  - 修复专用重试
  - 规范化校验
  - 持久化校验

交付物：

- 软阶段和硬持久化阶段的边界测试。
- 说明软恢复只发生在规范化之前的文档更新。

验收标准：

- 草稿可以被规范化，但生成的规范化对象仍然必须通过现有的严格校验器。
- Runtime Update Proposal、Runtime Update Validation 和 Pending Update Persistence 的行为保持不变，只是诊断更清晰。

阶段 4 实施结论：

- World Tick 有 prompt input 的解析路径已收紧为 `parseSoftSemanticJsonOutput -> compileWorldTickDraftOutput -> validateWorldTickResult`，不再先把原始 LLM 输出当 canonical `WorldTickResult` 试验放行；无 input 的 fixture/canonical parser 路径保留给已有测试与本地 canonical 校验。
- Action Resolver 与 Narration Generator 继续保持 draft compiler 产出 canonical 对象后再调用 `validateActionResolution()` / `validateTurnNarration()`；新增测试证明宽松数组/字符串恢复不会修复非法 happened/status/intent/risk enum，也不会绕过 forbidden safety key 或玩家可见泄漏。
- `validation-boundary` policy 明确记录五层边界顺序：本地 JSON 提取/修复、宽松草稿 coercion、可选一次性 repair retry、draft compiler、canonical validation；hard persistence 阶段明确不把软恢复、loose coercion 或 repair retry 输出作为接受依据。
- Runtime Update Proposal 仍是 `hard_persistence`，Runtime Update Validation 与 Pending Update Persistence 仍是 deterministic boundary；新增 persistence boundary 测试证明 rejected target 和 unsafe player knowledge claim 不会进入 `createPendingRpgUpdates()`。
- Runtime Update Proposal、Runtime Update Validation、Pending Persistence、Apply、World Tick / Narration repair retry、legacy/default fallback、旧路径兼容和写回策略均未在本阶段放宽。

## 阶段 5 - Trace、指标与开发者可见性

状态：已完成（2026-06-15）

任务：

- 为 debug trace 添加以下字段：
  - `formatRecoveryApplied`
  - `localRepairOperations`
  - `looseCoercions`
  - `repairRetryAttempted`
  - `repairRetrySucceeded`
  - `repairRetryFailureSummary`
- 为格式恢复事件添加紧凑的 UI/debug-console 展示。
- 按阶段统计恢复频率，以识别脆弱的提示/schema 区域。
- 保留原始输出以供审计。

交付物：

- debug trace schema 扩展。
- trace 序列化测试。
- 可选的 debug console 展示改动。

验收标准：

- 当恢复成功时，trace 能说明修复了什么，以及为什么该回合得以继续。
- 当恢复失败时，trace 能说明最终是本地修复、修复重试、编译器还是规范化校验成为最终边界。

阶段 5 实施结论：

- `RpgRuntimeDebugStep` 已新增结构化恢复字段：`formatRecoveryApplied`、`localRepairOperations`、`looseCoercions`、`repairRetryAttempted`、`repairRetrySucceeded`、`repairRetryFailureSummary`，并在 trace store 初始化、clone/import 和旧 trace 读取时提供默认值。
- turn orchestrator 继续保留原有 `JSON 提取与本地修复`、`修复专用重试输出`、`修复专用重试摘要`、warnings 和 raw output，同时把本地 JSON 修复操作、loose draft coercion 和 repair retry 结果写入结构化字段。
- formatting audit 每行新增 `formatRecovery` 摘要，并输出 `formatRecoveryMetrics`，按 `stepId` 统计恢复应用次数、本地修复 operation 数、loose coercion 数、repair retry 尝试/成功/失败次数。
- debug console 在有恢复事件时才显示顶部格式恢复总览、step 短标签和可展开“格式恢复”分组；无恢复时不增加 UI 噪声。
- export trace payload 保留新增字段，并继续使用既有 sensitive-key redaction；raw output 与 repair retry output 仍可审计。
- 本阶段未扩展 repair retry 到 World Tick 或 Narration Generator，未修改 Runtime Update Proposal / Runtime Update Validation / Pending Persistence / Apply / write policy，未新增 legacy/default fallback、silent parser fallback、enum 修复或 schema 字段补全。

## 阶段 6 - 提示与 Schema 精简后续工作

状态：已完成（2026-06-15）

任务：

- 审查软语义提示，找出可以从模型输出中移除并在本地派生的字段。
- 尽可能减少数组密集或元数据密集的输出要求。
- 在 LLM 草稿契约中，优先使用语义摘要而不是协议形态字段。
- 如果某个阶段仍然脆弱，将非常大的契约拆分为更小的阶段专用 schema。
- 在可用时考虑 provider-native structured output 或 tool calling，但不要把它作为唯一防线。

交付物：

- 针对恢复频率高的阶段，提供更小的草稿 schema。
- 更新提示测试，防止 schema 膨胀回归。

验收标准：

- 随着真实 trace 的反复运行，最常见的格式恢复次数会下降。
- 提示大小和输出契约复杂度是可测量且可控的。

阶段 6 实施结论：

- Action Resolver 的 LLM-facing `ActionResolutionDraft` 契约已从完整 `references` / structured `warnings` envelope 收窄为 `referencePaths?: string[]` 与 `warnings?: string[]`；本地 compiler 继续生成 canonical references、warning code/severity、IDs、runtime refs、默认数组，并保持 strict `validateActionResolution()`。
- Action Resolver prompt 明确把 `parsedIntent`、`eventDraft`、`playerActionDelta` 的字符串数组字段标为“仅有内容时输出”；省略可选数组不会记录 loose recovery，字符串/trim 等宽松形态仍可审计。
- World Tick prompt 不再展开完整 `ActionResolution`、独立 `playerActionDelta` 和独立 `timeDelta` 三个重复块，改为 `WorldTickActionBrief` prompt section；该 brief 只用于 prompt/debug trace，不进入 persistence boundary。
- World Tick 的 `WorldTickDraft` 契约移除 `tickId`、reference envelope 和 warning envelope；模型只需输出语义 world/reaction/broadcast/clock/pacing/gap 字段、`referencePaths?: string[]` 和 `warnings?: string[]`，本地 compiler 生成 canonical `tickId`、references、warnings、visibility、runtime refs 与默认字段。
- Narration Generator prompt 将 `narrationSelfReport`、`nextActionOptions[].likelyAffectedPaths` 和 tension signal arrays 改为 prompt-level optional / derivable；compiler 在省略时默认生成 narration meta、空 likely paths 和空 signal arrays，玩家可见泄漏与非法 option enum 仍 hard fail。
- Contract classification matrix 已同步标记 `referencePaths[]`、string warnings、`narrationSelfReport`、`displayPolicy`、`narrationMeta` 与 `likelyAffectedPaths` 的新职责边界。
- 新增 prompt budget / schema regression 覆盖，防止软语义 runtime prompt 重新引入完整 canonical object、旧 reference/warning envelope、`tickId` 或 `likelyAffectedPaths` 输出要求。
- 验证通过：阶段 6 指定 Vitest bundle（5 files / 43 tests）、扩展回归 bundle（9 files / 129 tests）、`npm.cmd run typecheck`、`npm.cmd run build:runtime`；`build:runtime` 仍提示既有 Vite `inlineDynamicImports` deprecated warning。
- 本阶段未扩展 repair retry，未接入 provider-native structured output，未修改 Runtime Update Proposal、Runtime Update Validation、Pending Persistence、Apply/write policy、target policy、actor knowledge、reveal gate、legacy/default fallback、旧路径兼容或 silent parser fallback。

## 实施顺序

1. 先仅为 Action Resolver 实现阶段 1。
2. 针对当前真实 trace 失败增加回归测试。
3. 实现阶段 2 的共享 JSON 修复，并接入 Action Resolver。
4. 在一个特性开关后面，为 Action Resolver 实现阶段 3 的修复专用重试。
5. 将阶段 1 和阶段 2 扩展到 World Tick 和 Narration Generator。
6. 如果本地修复不足，再将修复专用重试扩展到 World Tick 和 Narration Generator。
7. 添加 trace 指标和文档更新。
8. 重新运行真实 trace，并比较失败边界。

## 风险控制

- 绝不强制转换被禁止的写入或持久化字段。
- 绝不自动纠正语义枚举，除非已经明确审查并测试过确定性映射。
- 绝不让修复重试直接生成可接受的 wiki 更新。
- 保持修复重试次数较低，避免循环和成本激增。
- 在 trace 警告中记录每一次强制转换和修复。
- 在持久化边界优先失败关闭。

## 建议测试

Action Resolver：

- `playerActionDelta.notes` 字符串会变成单项数组。
- 缺失的可选字符串数组字段会变成空数组。
- 可选字符串数组字段中的空白字符串会被裁掉。
- 字符串数组字段中的数字仍然失败。
- 被禁止的 `wikiWrites` 仍然失败。
- 缺失必需的 `eventDraft.summary` 仍然失败。
- 带尾随逗号的畸形 JSON 可在本地修复。
- 缺少逗号时触发修复专用重试，并在修正后的 JSON 下成功。

World Tick：

- 可选草稿数组会安全默认。
- 已被分类为协议字段的 affected paths 仍保持可派生。
- 无效的可见性或 happened 状态仍然是硬失败。
- 被禁止的 next action options 仍然是硬失败。

Narration Generator：

- 可选 warnings/tension 数组在安全时接受 string-to-array。
- 面向玩家的信息泄漏仍然是硬失败。
- next action options 仍保留规范化编译器生成的 ids。

持久化：

- Runtime Update Proposal 仍然拒绝被禁止的目标。
- Runtime Update Validation 仍然拒绝不安全的写入声明。
- Pending Update Persistence 只会分阶段保存门禁通过的更新。

## 待解问题

- 宽松强制转换应该写入规范化 `warnings`、仅写入 debug trace，还是两者都写？
- 修复专用重试应该默认启用，还是先用实验性运行时开关控制？
- 部署中的运行时适配器支持哪种 provider-native structured output 模式？
- 本地 JSON 修复应该使用现有库，还是一个小型的内部保守修复函数？
- 对 trace 很重的失败输出，允许的最大修复提示大小是多少？

## 进展日志

- 2026-06-15：在真实 trace 中发现 `ActionResolutionDraft.playerActionDelta.notes` 被输出成字符串而不是 `string[]` 之后创建了该计划。

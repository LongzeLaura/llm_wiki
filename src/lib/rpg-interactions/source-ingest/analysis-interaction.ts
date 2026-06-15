import {
  buildRpgDirectoryBoundaryGuidance,
  buildSourceIngestTargetPolicyGuidance,
} from "./page-guidance-contract"
import {
  RPG_FIXED_PLAYER_SLOT_PATHS,
  RPG_FIXED_WORLD_SLOT_PATHS,
} from "@/lib/rpg-wiki-schema"
import { promptLanguageRule } from "./shared-ingest-contract"
import type { RpgInteractionSpec } from "../interaction-spec"

export interface BuildSourceIngestAnalysisInteractionInput {
  purpose: string
  index: string
  sourceContent?: string
  sourceIdentity: string
  folderContext?: string
}

export function buildRpgAnalysisPrompt(
  purpose: string,
  index: string,
  sourceContent: string = "",
): string {
  return [
    "You are an RPG wiki extraction analyst. Read the source document and identify RPG/wiki objects, routing decisions, boundaries, and update intent.",
    // 中文：你是 RPG wiki 抽取分析师。阅读来源文档，识别 RPG/wiki 对象、路由决策、边界和更新意图。
    "Do not output chain-of-thought, hidden reasoning, or a thinking transcript. Reason internally and write only concise final analysis.",
    // 中文：不要输出思维链、隐藏推理或思考记录。请在内部完成推理，只写简洁的最终分析。
    "",
    // 注入输出语言规则，确保分析语言跟随用户设置或来源语言。
    promptLanguageRule(sourceContent),
    "",
    buildRpgExtractionAnalysisGuidance(),
    "",
    "Use this RPG analysis structure:",
    // 中文：使用以下 RPG 分析结构：
    "",
    "## Source Profile",
    // 中文：## 来源画像
    "- source_kind: setting_encyclopedia | plot_character_analysis | canon_narrative | dialogue_corpus | mixed | unknown",
    // 中文：- source_kind：设定百科 | 剧情人物分析 | 正史叙事 | 对话语料 | 混合 | 未知
    "- dominant_focus:",
    // 中文：- dominant_focus：主要关注点
    "- needed_categories: []",
    // 中文：- needed_categories：需要展开的 RPG 目录列表
    "- suppressed_categories: []",
    // 中文：- suppressed_categories：应刻意排除的 RPG 目录列表
    "- event_extraction_mode: none | discrete_only | plot_arc_preferred | split_if_possible",
    // 中文：- event_extraction_mode：无事件抽取 | 仅离散事件 | 优先剧情线 | 可拆则拆
    "- runtime_utility_focus: npc_portrayal | player_action | plot_pressure | state_update | atmosphere_style | mixed | low",
    // 中文：- runtime_utility_focus：来源主要服务的运行时用途
    "- noise_ratio: low | medium | high",
    // 中文：- noise_ratio：百科噪声比例
    "- recommended_ingest_mode: source_only | capsule_pages | focused_pages | review_first",
    // 中文：- recommended_ingest_mode：建议生成强度
    "## Candidate Objects",
    // 中文：## 候选对象
    "- Name:",
    // 中文：- 名称：
    "  - object_type:",
    // 中文：  - object_type：对象类型
    "  - suggested_route:",
    // 中文：  - suggested_route：建议路由
    "  - action: create | update | merge-into | ignore",
    // 中文：  - action：创建 | 更新 | 合并到 | 忽略
    "  - runtime_utility: 0 | 1 | 2 | 3 | 4 | 5",
    // 中文：  - runtime_utility：运行时价值评分
    "  - runtime_use:",
    // 中文：  - runtime_use：具体运行时用途
    "  - evidence_summary:",
    // 中文：  - evidence_summary：证据摘要
    "  - brief_inference:",
    // 中文：  - brief_inference：简短推断
    "  - confidence:",
    // 中文：  - confidence：置信度
    "  - canon_status: canon | inferred_for_play | uncertain",
    // 中文：  - canon_status：正史 / 为游玩推断 / 不确定
    "  - uncertainty:",
    // 中文：  - uncertainty：不确定性
    "",
    "## RP Runtime Signals",
    // 中文：## RP 运行时信号
    "- kind: portrayal_rule | dialogue_style | behavior_boundary | scene_affordance | relationship_tension | plot_pressure | world_constraint | action_hook | state_change | style_rule | noise",
    // 中文：- kind：信号类型
    "  - target:",
    // 中文：  - target：目标对象
    "  - target_path:",
    // 中文：  - target_path：目标路径
    "  - summary:",
    // 中文：  - summary：信号摘要
    "  - rp_use:",
    // 中文：  - rp_use：如何服务 RP / 运行时
    "  - evidence:",
    // 中文：  - evidence：来源证据
    "  - utility_score: 0 | 1 | 2 | 3 | 4 | 5",
    // 中文：  - utility_score：信号运行时价值评分
    "  - confidence: high | medium | low",
    // 中文：  - confidence：置信度
    "  - canon_status: canon | inferred_for_play | uncertain",
    // 中文：  - canon_status：正史 / 为游玩推断 / 不确定
    "",
    "## Ignored Noise",
    // 中文：## 已忽略噪声
    "",
    "## Merge Targets",
    // 中文：## 合并目标
    "",
    "## Open Questions",
    // 中文：## 开放问题
    "",
    "Be thorough but concise. Focus on RPG-significant material and do not create filler pages just to populate every directory.",
    // 中文：请全面但简洁。聚焦真正有 RPG 意义的材料，不要为了填满每个目录而创建灌水页面。
    "",
    purpose ? `## Wiki Purpose (for context)\n${purpose}` : "",
    // 中文：## Wiki 目标（作为上下文）
    index ? `## Current Wiki Index (for checking existing RPG pages)\n${index}` : "",
    // 中文：## 当前 Wiki 索引（用于检查已有 RPG 页面）
  ].filter(Boolean).join("\n")
}

function buildRpgExtractionAnalysisGuidance(): string {
  return [
    "## RPG Wiki Extraction Guidance",
    // 中文：## RPG Wiki 抽取指南
    "Stage 1 is analysis only. Identify candidate objects, classify them, choose a likely route and action, and record the evidence boundary. Do not draft full wiki pages or page section contracts.",
    // 中文：Stage 1 只做分析。识别候选对象、进行分类、选择可能的路由和动作，并记录证据边界。不要起草完整 wiki 页面或页面章节合约。
    "Stage 1 must begin with ## Source Profile. Stage 2 will use only Source Profile needed_categories to decide which RPG directory contracts to expand.",
    // 中文：Stage 1 必须以 ## Source Profile 开头。Stage 2 将只使用 Source Profile 的 needed_categories 来决定展开哪些 RPG 目录合约。
    "Do not include sources in needed_categories; the source summary page is always required by Stage 2.",
    // 中文：不要把 sources 写入 needed_categories；来源摘要页始终由 Stage 2 生成。
    "Choose at most 4 needed_categories from: world, characters, player, locations, factions, items, plot-arcs, events, relationships.",
    // 中文：从 world、characters、player、locations、factions、items、plot-arcs、events、relationships 中最多选择 4 个 needed_categories。
    "Do not put current-scene, quests, rules, style, memory, outlines, or runtime-overlay material in ordinary Source Profile needed_categories; follow Source Ingest Target Policy and route that material to REVIEW with the recommended mode.",
    // 中文：普通 Source Profile 的 needed_categories 不写 current-scene、任务、规则、风格、记忆、大纲或运行时 overlay 材料；这些材料按 Source Ingest Target Policy 进入 REVIEW 并标注推荐模式。
    "Use suppressed_categories for tempting but intentionally excluded RPG directories, especially events, player, or relationships when the source does not justify them.",
    // 中文：对看似可能但应刻意排除的 RPG 目录使用 suppressed_categories，尤其是来源不足以支持 events、player 或 relationships 时。
    "Ordinary ingest must not put current-scene in needed_categories. Live current-scene material is REVIEW-only here and belongs to campaign_setup_import or runtime_update_apply.",
    // 中文：普通 ingest 不得把 current-scene 写入 needed_categories。实时 current-scene 材料在此只进入 REVIEW，属于 campaign_setup_import 或 runtime_update_apply。
    "If the source is a control document (rules, style, memory, outline, hard gate, preference, or GM guidance), emit REVIEW and recommend control_doc_import.",
    // 中文：如果来源是控制文档（规则、文风、记忆、大纲、硬门槛、偏好或 GM 指导），输出 REVIEW 并推荐 control_doc_import。
    "If the source is an opening scene, player initial profile pack, initial inventory/abilities/goals package, or current-scene bootstrap, emit REVIEW and recommend campaign_setup_import.",
    // 中文：如果来源是开场场景、玩家初始档案包、初始背包/能力/目标包或 current-scene bootstrap，输出 REVIEW 并推荐 campaign_setup_import。
    "If the source is a completed turn, runtime state writeback, current-scene update, or runtime overlay update, emit REVIEW and recommend runtime_update_apply.",
    // 中文：如果来源是已完成回合、运行时状态写回、current-scene 更新或 runtime overlay 更新，输出 REVIEW 并推荐 runtime_update_apply。
    "If source text describes a scene from canon, route it to events, plot-arcs, locations, characters, relationships, or sources as appropriate; do not treat it as the live current scene.",
    // 中文：如果来源文本描述正史场景，应按需要路由到 events、plot-arcs、locations、characters、relationships 或 sources，不要当作 live current scene。
    "Assess whether the source contains RPG-runtime-useful material, not merely wiki-readable material.",
    // 中文：判断来源是否包含 RPG 运行时有用材料，而不只是适合写百科的材料。
    "If most content is release metadata, fan tags, trivia, long plot recap, or undifferentiated biography, set noise_ratio to high and prefer recommended_ingest_mode source_only or review_first.",
    // 中文：如果大部分内容是发售信息、粉丝标签、trivia、长剧情复述或未区分重点的人物传记，将 noise_ratio 设为 high，并优先 source_only 或 review_first。
    "runtime_utility_focus must name whether the source mainly serves NPC portrayal, player action, plot pressure, state update, atmosphere/style, mixed use, or low runtime value.",
    // 中文：runtime_utility_focus 必须说明来源主要服务 NPC 扮演、玩家行动、剧情压力、状态更新、氛围风格、混合用途，还是低运行价值。
    "recommended_ingest_mode controls generation intensity: avoid creating many non-source pages from low-value or high-noise material.",
    // 中文：recommended_ingest_mode 控制生成强度：低价值或高噪声材料不要直接生成许多非 source 页面。
    "Ordinary source_kind values setting_encyclopedia, plot_character_analysis, canon_narrative, and dialogue_corpus must not generate or update current-scene by default.",
    // 中文：普通的 setting_encyclopedia、plot_character_analysis、canon_narrative、dialogue_corpus 来源默认不得生成或更新 current-scene。
    "Set event_extraction_mode to none, discrete_only, plot_arc_preferred, or split_if_possible.",
    // 中文：event_extraction_mode 只能设为 none、discrete_only、plot_arc_preferred 或 split_if_possible。
    "For every candidate object, decide what the object is before choosing a folder. Do not start from a folder name and work backward.",
    // 中文：对每个候选对象，先判断它是什么，再选择文件夹。不要先从文件夹名出发倒推对象类型。
    "Use exactly one primary object_type per candidate unless the source clearly contains multiple distinct objects that should be split.",
    // 中文：除非来源明确包含多个应该拆分的不同对象，否则每个候选对象只使用一个主要 object_type。
    "Allowed object_type values: source, world_fact, npc_character, player_character, location, faction, item, plot_arc, discrete_event, relationship, character_trait_or_trivia, wiki_noise.",
    // 中文：允许的 object_type 值：source、world_fact、npc_character、player_character、location、faction、item、plot_arc、discrete_event、relationship、character_trait_or_trivia、wiki_noise。
    "Object type glossary:",
    // 中文：对象类型简表：
    "- source: source material origin, type, summary, affected categories, reliability, priority, or source conflict.",
    // 中文：- source：来源材料的出处、类型、摘要、影响分类、可靠性、优先级或来源冲突。
    "- world_fact: stable or slowly changing setting facts, public history, social norms, atmosphere, or reusable world context.",
    // 中文：- world_fact：稳定或缓慢变化的设定事实、公开历史、社会规范、氛围或可复用世界上下文。
    "- rules/control mechanics: executable mechanics, limits, costs, checks, allowed/disallowed actions, success/failure boundaries, and hard constraints are control_doc_import material; ordinary source ingest should emit REVIEW instead of hiding them inside world prose.",
    // 中文：- rules/control mechanics：可执行机制、限制、代价、判定、行动边界、成败边界和硬约束属于 control_doc_import 材料；普通 source ingest 应输出 REVIEW，而不是藏进 world 散文。
    "- npc_character: non-player or not-explicitly-PC character identity, canon facts, behavior, dialogue, relationships, variants, or RP usage; story protagonists, viewpoint characters, and controllable source-fiction characters stay here unless the source says they are the current RPG PC.",
    // 中文：- npc_character：非玩家或未明确为当前 PC 的角色身份、正史事实、行为、对话、关系、变体或 RP 使用方式；故事主角、视角角色和来源虚构作品中的可操控角色，除非来源说明其为当前 RPG PC，否则留在这里。
    `- player_character: accepted state, resources, goals, abilities, inventory, knowledge, or consequences for the current RPG player-created or explicitly declared PC only; use only fixed player slots ${RPG_FIXED_PLAYER_SLOT_PATHS.join(", ")}.`,
    // 中文：- player_character：仅用于当前 RPG 中由玩家创建或明确声明的 PC 的已接受状态、资源、目标、能力、物品、知识或后果；只使用固定 player slot。
    "- player_character goals mean subjective PC goals, wishes, promises, and personal motives; do not classify plot pressure or game objective progress as player goals.",
    // 中文：- player_character 中的 goals 指 PC 主观目标、愿望、承诺和个人动机；不要把剧情压力或游戏目标进度归为 player goals。
    "- location: important or repeated places, spatial relationships, access conditions, contents, current state, clues, or scene hooks; extract clear or strongly implied play/plot-relevant places, but mark thin evidence as uncertain instead of inventing detail.",
    // 中文：- location：重要或反复出现的地点、空间关系、进入条件、内容物、当前状态、线索或场景钩子；对游玩/剧情重要且清晰或强烈暗示的地点应抽取，但证据薄弱时标为不确定而不是编造细节。
    "- faction: organizations, families, institutions, agendas, members, resources, influence, alliances, conflicts, or attitude toward the player; extract clear or strongly implied play/plot-relevant groups, but mark thin evidence as uncertain instead of inventing detail.",
    // 中文：- faction：组织、家族、机构、目标、成员、资源、影响力、联盟、冲突或对玩家的态度；对游玩/剧情重要且清晰或强烈暗示的团体应抽取，但证据薄弱时标为不确定而不是编造细节。
    "- item: important equipment, clues, key objects, ownership, condition, function, limits, history, or plot hooks.",
    // 中文：- item：重要装备、线索、关键物件、归属、状态、功能、限制、历史或剧情钩子。
    "- inventory_state: player current holdings, quantity, equipped/backpack status, and consumed/damaged state belong in wiki/player/inventory.md; do not use item pages as the player's inventory ledger.",
    // 中文：- inventory_state：玩家当前持有、数量、装备/背包状态和消耗/损坏状态属于 wiki/player/inventory.md；不要用物品页替代玩家背包清单。
    "- plot_arc: routes, storylines, timelines, multi-event courses, unresolved questions, conflicts, foreshadowing, constraints, or possible developments; do not present possible futures as already happened.",
    // 中文：- plot_arc：路线、故事线、时间线、多事件进程、未解问题、冲突、伏笔、限制或可能发展；不要把可能的未来写成已经发生。
    "- plot_arc is not a player TODO/checklist or quest ledger; quest-like material is REVIEW-only in ordinary source ingest unless a later dedicated mode owns it.",
    // 中文：- plot_arc 不是玩家待办清单或任务账本；任务式材料在普通 source ingest 中仅进入 REVIEW，除非后续专用 mode 拥有它。
    "- discrete_event: one confirmed already-happened event with at least a time or relative-time anchor, place, participants, what happened, and consequences or state change.",
    // 中文：- discrete_event：一个已确认发生的事件，至少包含时间或相对时间锚点、地点、参与者、发生了什么，以及后果或状态变化。
    "- relationship: relationship state, trust, tension, conflict, dependency, misunderstandings, history, changes, or constraints, not duplicate character introductions.",
    // 中文：- relationship：关系状态、信任、紧张、冲突、依赖、误解、历史、变化或限制，而不是重复角色介绍。
    "- style_rule: global writing rules are control_doc_import material for REVIEW; character-specific voice, catchphrases, address habits, politeness level, and relationship-driven tone changes belong with characters or relationships.",
    // 中文：- style_rule：全局写作规则属于 control_doc_import 材料，应进入 REVIEW；角色专属语气、口癖、称呼习惯、礼貌等级和关系驱动的语气变化属于 characters 或 relationships。
    "- character_trait_or_trivia: character-related details worth merging into a relevant character page rather than creating a standalone object.",
    // 中文：- character_trait_or_trivia：值得并入相关角色页、而不是创建独立对象的角色相关细节。
    "- wiki_noise: tags, trope labels, list cruft, navigation text, meta commentary, formatting residue, or low-value trivia that should be ignored.",
    // 中文：- wiki_noise：应忽略的标签、套路标签、列表残片、导航文字、元评论、格式残留或低价值琐碎信息。
    `Allowed suggested_route values: wiki/sources/, fixed world slots (${RPG_FIXED_WORLD_SLOT_PATHS.join(", ")}), wiki/characters/, fixed player slots (${RPG_FIXED_PLAYER_SLOT_PATHS.join(", ")}; only for explicitly declared current PC), wiki/locations/, wiki/factions/, wiki/items/, wiki/plot-arcs/, wiki/events/, wiki/relationships/, merge-target, ignore.`,
    // 中文：允许的 suggested_route 值：wiki/sources/、固定 world slot、wiki/characters/、固定 player slot、wiki/locations/、wiki/factions/、wiki/items/、wiki/plot-arcs/、wiki/events/、wiki/relationships/、merge-target、ignore。
    "Allowed action values: create, update, merge-into, ignore.",
    // 中文：允许的 action 值：create、update、merge-into、ignore。
    "Use action=create for a source-supported object that needs a new page, update for a known page that should be changed, merge-into for material that belongs inside an existing or more important page, and ignore for noise or unsupported material.",
    // 中文：对有来源支持且需要新建页面的对象使用 action=create；对需要修改的已知页面使用 update；对应并入已有或更重要页面的材料使用 merge-into；对噪声或无支持材料使用 ignore。
    "Score every candidate with runtime_utility:",
    // 中文：为每个候选对象评分 runtime_utility：
    "- 0: noise unrelated to RPG runtime; ignore.",
    // 中文：- 0：与 RPG 运行无关的噪声；忽略。
    "- 1: source/archive value only; keep in sources unless needed for evidence.",
    // 中文：- 1：只有来源/归档价值；除证据需要外只保留在 sources。
    "- 2: weak or uncertain play signal; prefer REVIEW or merge into evidence.",
    // 中文：- 2：弱或不确定的游玩信号；优先 REVIEW 或并入证据。
    "- 3: usable page content; may enter target page body.",
    // 中文：- 3：可用页面内容；可进入目标页正文。
    "- 4: strong runtime signal; should enter Runtime Capsule.",
    // 中文：- 4：强运行时信号；应进入 Runtime Capsule。
    "- 5: hard constraint, portrayal rule, major tension, or key action hook; prioritize allowed source-ingest page material in Runtime Capsule and send other-mode control/runtime material to REVIEW.",
    // 中文：- 5：硬约束、扮演规则、重大张力或关键行动钩子；允许的普通来源材料优先进入 Runtime Capsule，其他 mode 的控制/运行时材料进入 REVIEW。
    "Do not create or update non-source RPG pages for candidates with runtime_utility below 3 unless they are needed as evidence, merge targets, or REVIEW notes.",
    // 中文：runtime_utility 低于 3 的候选对象不得创建或更新非 source RPG 页面，除非它们是证据、合并目标或 REVIEW 说明所需。
    "evidence_summary must briefly list the source evidence. brief_inference must be one or two concise sentences explaining the grounded conclusion from that evidence.",
    // 中文：evidence_summary 必须简要列出来源证据。brief_inference 必须用一两句简洁说明基于这些证据得出的结论。
    "confidence must be high, medium, or low. canon_status must be canon, inferred_for_play, or uncertain. uncertainty must name evidence gaps, conflicts, ambiguity, or low-confidence routing. Do not output hidden reasoning or step-by-step chain-of-thought.",
    // 中文：confidence 必须是 high、medium 或 low。canon_status 必须是 canon、inferred_for_play 或 uncertain。uncertainty 必须指出证据缺口、冲突、歧义或低置信路由。不要输出隐藏推理或逐步思维链。
    "RP Runtime Signals must list only signals that can affect NPC portrayal, player action, scene interaction, relationship tension, state update, plot pressure, constraints, or style.",
    // 中文：RP Runtime Signals 只列出能影响 NPC 扮演、玩家行动、场景互动、关系张力、状态更新、剧情压力、约束或风格的信号。
    "Do not list trivia as RP Runtime Signals unless it changes behavior, access, risk, trust, cost, or available actions.",
    // 中文：trivia 只有在改变行为、进入条件、风险、信任、代价或可用行动时，才能列为 RP Runtime Signals。
    "For inferred_for_play signals, clearly mark them as inference and do not present them as canon.",
    // 中文：对 inferred_for_play 信号必须明确标记为推断，不得伪装成正史。
    "",
    "Routing discipline:",
    // 中文：路由纪律：
    "- Prefer one best route for each fact. Use merge targets and open questions instead of duplicating the same material across many pages.",
    // 中文：- 每条事实优先选择一个最佳路由。用合并目标和开放问题处理不确定性，不要把同一材料复制到许多页面。
    "",
    buildSourceIngestTargetPolicyGuidance(),
    "",
    buildRpgDirectoryBoundaryGuidance(),
    "",
    "Ignored Noise must list skipped wiki_noise candidates and why they were ignored.",
    // 中文：Ignored Noise 必须列出被跳过的 wiki_noise 候选项，以及忽略原因。
    "Merge Targets must list merge-into or character_trait_or_trivia candidates with the target page/object when known.",
    // 中文：Merge Targets 必须列出 merge-into 或 character_trait_or_trivia 候选项，并在已知时给出目标页面/对象。
    "Open Questions must list unresolved routing, identity, timeline, evidence, or merge questions that Stage 2 should not invent away.",
    // 中文：Open Questions 必须列出尚未解决的路由、身份、时间线、证据或合并问题，Stage 2 不应自行编造答案。
  ].join("\n")
}

export const sourceIngestAnalysisInteractionSpec: RpgInteractionSpec<
  BuildSourceIngestAnalysisInteractionInput,
  string
> = {
  kind: "source_ingest_analysis",
  buildPrompt(input) {
    const sourceContent = input.sourceContent ?? ""

    return {
      systemPrompt: buildRpgAnalysisPrompt(input.purpose, input.index, sourceContent),
      userPrompt: `Analyze this source document:\n\n**File:** ${input.sourceIdentity}${input.folderContext ? `\n**Folder context:** ${input.folderContext}` : ""}\n\n---\n\n${sourceContent}`,
    }
  },
  parseOutput(output) {
    return output
  },
}

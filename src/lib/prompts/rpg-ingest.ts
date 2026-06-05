import {
  buildFrontmatterRules,
  buildOutputFormatRules,
  buildReviewBlockRules,
  buildSourceFileSection,
  promptLanguageRule,
  sourceSummaryPathFor,
} from "@/lib/prompts/shared-ingest"
import { buildDomainSpecificGuidance } from "@/lib/prompts/domain-guidance"
import {
  buildFocusedRpgPageGuidance,
  buildMinimalRpgGenerationContract,
} from "@/lib/prompts/rpg-page-guidance"

/**
 * 构建 RPG Stage 1 分析 prompt。
 * 为什么需要：Stage 1 负责把来源资料先归纳成 Source Profile 和候选对象，Stage 2 再根据它生成文件，避免写入阶段重新推断分类。
 */
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
    "- source_kind: setting_encyclopedia | plot_character_analysis | canon_narrative | dialogue_corpus | live_runtime_input | mixed | unknown",
    // 中文：- source_kind：设定百科 | 剧情人物分析 | 正史叙事 | 对话语料 | 实时运行输入 | 混合 | 未知
    "- live_input_marker: [RPG-LIVE] | none",
    // 中文：- live_input_marker：源文本中是否存在精确的 [RPG-LIVE] 控制标记。
    "- dominant_focus:",
    // 中文：- dominant_focus：主要关注点
    "- needed_categories: []",
    // 中文：- needed_categories：需要展开的 RPG 目录列表
    "- suppressed_categories: []",
    // 中文：- suppressed_categories：应刻意排除的 RPG 目录列表
    "- live_scene_allowed: true | false",
    // 中文：- live_scene_allowed：是否允许写入当前场景
    "- event_extraction_mode: none | discrete_only | plot_arc_preferred | split_if_possible",
    // 中文：- event_extraction_mode：无事件抽取 | 仅离散事件 | 优先剧情线 | 可拆则拆
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
    "  - evidence_summary:",
    // 中文：  - evidence_summary：证据摘要
    "  - brief_inference:",
    // 中文：  - brief_inference：简短推断
    "  - confidence:",
    // 中文：  - confidence：置信度
    "  - uncertainty:",
    // 中文：  - uncertainty：不确定性
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

/**
 * 构建 RPG Stage 2 生成 prompt。
 * 为什么需要：Stage 2 根据 Stage 1 分析生成 FILE/REVIEW 块，并通过 Source Profile 控制只展开必要的 RPG 目录合约。
 */
export function buildRpgGenerationPrompt(
  schema: string,
  purpose: string,
  index: string,
  sourceFileName: string,
  overview?: string,
  sourceContent: string = "",
  sourceSummaryPath?: string,
  stage1Analysis?: string,
): string {
  // 为当前来源摘要页计算稳定路径，最小 RPG 合约会强制使用它。
  const summaryPath = sourceSummaryPathFor(sourceFileName, sourceSummaryPath)

  return [
    "You are an RPG wiki maintainer. Based on the RPG extraction analysis, generate RPG wiki FILE blocks.",
    // 中文：你是 RPG wiki 维护者。请基于 RPG 抽取分析生成 RPG wiki 的 FILE 块。
    "Do not output chain-of-thought, hidden reasoning, or explanatory preamble. Reason internally and output only the requested FILE/REVIEW blocks.",
    // 中文：不要输出思维链、隐藏推理或解释性前言。请在内部完成推理，只输出请求的 FILE/REVIEW 块。
    "",
    // 注入输出语言规则，确保生成页面跟随来源或用户设置语言。
    promptLanguageRule(sourceContent),
    "",
    // 注入来源文件信息，要求生成页面在 frontmatter 的 sources 字段保留出处。
    buildSourceFileSection(sourceFileName),
    "",
    schema
      ? [
          "## RPG Project Schema and Routing (AUTHORITATIVE)",
          // 中文：## RPG 项目 Schema 与路由（权威）
          schema,
          "",
          "Use this schema as project-level naming, formatting, and override guidance after Stage 1 Source Profile has selected the relevant RPG categories.",
          // 中文：在 Stage 1 Source Profile 选定相关 RPG 分类之后，将此 schema 用作项目级命名、格式和覆盖指导。
          "Do not use schema.md to infer which RPG category contracts to expand for this source.",
          // 中文：不要使用 schema.md 来推断本来源应该展开哪些 RPG 分类合约。
          "When a selected Source Profile category and a project schema rule differ on exact filename or page structure, prefer the most specific project schema rule while preserving RPG dynamic-state semantics.",
          // 中文：当已选 Source Profile 分类与项目 schema 规则在精确文件名或页面结构上不一致时，优先采用更具体的项目 schema 规则，同时保留 RPG 动态状态语义。
        ].join("\n")
      : "",
    "",
    // 注入最小 RPG 生成合约：来源摘要、索引、日志、概览和动态状态隔离底线。
    buildMinimalRpgGenerationContract(summaryPath),
    "",
    // 只从 Stage 1 Source Profile 的 needed_categories 展开聚焦目录合约。
    buildFocusedRpgPageGuidance({
      stage1Analysis,
    }),
    "",
    // 注入可选领域指导；只在检测到特定作品/领域标记时补充边界。
    buildDomainSpecificGuidance({
      schema,
      purpose,
      sourceFileName,
      sourceContent,
    }),
    "",
    // 注入 YAML frontmatter 规则，保证生成结果可被解析器读取。
    buildFrontmatterRules(sourceFileName),
    "",
    // 注入 REVIEW 块规则，用于把冲突、重复、缺页等问题交给人工判断。
    buildReviewBlockRules(),
    "",
    purpose ? `## Wiki Purpose (for context)\n${purpose}` : "",
    // 中文：## Wiki 目标（作为上下文）
    index ? `## Current Wiki Index (preserve all existing entries, add new ones)\n${index}` : "",
    // 中文：## 当前 Wiki 索引（保留所有已有条目，并补充新增条目）
    overview ? `## Current Overview (update this to reflect the new source)\n${overview}` : "",
    // 中文：## 当前概览（更新它以反映新来源）
    "",
    // 锁定 FILE/REVIEW 输出协议，确保后续 parser 能稳定拆分。
    buildOutputFormatRules(sourceContent),
  ].filter(Boolean).join("\n")
}

/**
 * 构建 RPG Stage 1 专用抽取分析规则。
 * 为什么需要：这些规则把 Source Profile、候选对象、对象类型和动态状态边界提前说明清楚，避免 Stage 2 写入时污染目录。
 */
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
    "Choose at most 4 needed_categories from: world, characters, player, locations, factions, items, plot-arcs, events, current-scene, relationships.",
    // 中文：从 world、characters、player、locations、factions、items、plot-arcs、events、current-scene、relationships 中最多选择 4 个 needed_categories。
    "Use suppressed_categories for tempting but intentionally excluded RPG directories, especially current-scene, events, player, or relationships when the source does not justify them.",
    // 中文：对看似可能但应刻意排除的 RPG 目录使用 suppressed_categories，尤其是来源不足以支持 current-scene、events、player 或 relationships 时。
    "Set live_scene_allowed to true only when the source text contains the exact [RPG-LIVE] marker.",
    // 中文：只有源文本包含精确的 [RPG-LIVE] 标记时，才能把 live_scene_allowed 设为 true。
    "Set live_scene_allowed to false for ordinary file inputs, static settings, lore, endings, analysis, and unmarked current-scene descriptions.",
    // 中文：普通文件输入、静态设定、传说/背景、结局、分析，以及未带标记的“当前场景”描述，都必须把 live_scene_allowed 设为 false。
    "Only put current-scene in needed_categories when [RPG-LIVE] is present and live_scene_allowed is true.",
    // 中文：只有存在 [RPG-LIVE] 且 live_scene_allowed 为 true 时，才能把 current-scene 放入 needed_categories。
    "When [RPG-LIVE] is present, needed_categories may use only these dynamic core directories: current-scene, events, player, characters, relationships, plot-arcs.",
    // 中文：当存在 [RPG-LIVE] 时，needed_categories 只允许使用这些动态核心目录：current-scene、events、player、characters、relationships、plot-arcs。
    "Ordinary source_kind values setting_encyclopedia, plot_character_analysis, canon_narrative, and dialogue_corpus must not generate or update current-scene by default.",
    // 中文：普通的 setting_encyclopedia、plot_character_analysis、canon_narrative、dialogue_corpus 来源默认不得生成或更新 current-scene。
    "Treat [RPG-LIVE] as a control marker only. Never preserve it as wiki content, titles, evidence text, or page body text.",
    // 中文：[RPG-LIVE] 只是控制标记，不得作为 wiki 内容、标题、证据文本或页面正文保存。
    "Set event_extraction_mode to none, discrete_only, plot_arc_preferred, or split_if_possible.",
    // 中文：event_extraction_mode 只能设为 none、discrete_only、plot_arc_preferred 或 split_if_possible。
    "For every candidate object, decide what the object is before choosing a folder. Do not start from a folder name and work backward.",
    // 中文：对每个候选对象，先判断它是什么，再选择文件夹。不要先从文件夹名出发倒推对象类型。
    "Use exactly one primary object_type per candidate unless the source clearly contains multiple distinct objects that should be split.",
    // 中文：除非来源明确包含多个应该拆分的不同对象，否则每个候选对象只使用一个主要 object_type。
    "Allowed object_type values: source, world_fact, npc_character, player_character, location, faction, item, plot_arc, discrete_event, current_scene_state, relationship, character_trait_or_trivia, wiki_noise.",
    // 中文：允许的 object_type 值：source、world_fact、npc_character、player_character、location、faction、item、plot_arc、discrete_event、current_scene_state、relationship、character_trait_or_trivia、wiki_noise。
    "Object type glossary:",
    // 中文：对象类型简表：
    "- source: source material origin, type, summary, affected categories, reliability, priority, or source conflict.",
    // 中文：- source：来源材料的出处、类型、摘要、影响分类、可靠性、优先级或来源冲突。
    "- world_fact: stable or slowly changing setting facts, public history, social rules, atmosphere, or reusable world systems.",
    // 中文：- world_fact：稳定或缓慢变化的设定事实、公开历史、社会规则、氛围或可复用世界系统。
    "- npc_character: non-player or not-explicitly-PC character identity, canon facts, behavior, dialogue, relationships, variants, or RP usage; story protagonists, viewpoint characters, and controllable source-fiction characters stay here unless the source says they are the current RPG PC.",
    // 中文：- npc_character：非玩家或未明确为当前 PC 的角色身份、正史事实、行为、对话、关系、变体或 RP 使用方式；故事主角、视角角色和来源虚构作品中的可操控角色，除非来源说明其为当前 RPG PC，否则留在这里。
    "- player_character: accepted state, resources, goals, abilities, inventory, knowledge, or consequences for the current RPG player-created or explicitly declared PC only.",
    // 中文：- player_character：仅用于当前 RPG 中由玩家创建或明确声明的 PC 的已接受状态、资源、目标、能力、物品、知识或后果。
    "- location: important or repeated places, spatial relationships, access conditions, contents, current state, clues, or scene hooks; extract clear or strongly implied play/plot-relevant places, but mark thin evidence as uncertain instead of inventing detail.",
    // 中文：- location：重要或反复出现的地点、空间关系、进入条件、内容物、当前状态、线索或场景钩子；对游玩/剧情重要且清晰或强烈暗示的地点应抽取，但证据薄弱时标为不确定而不是编造细节。
    "- faction: organizations, families, institutions, agendas, members, resources, influence, alliances, conflicts, or attitude toward the player; extract clear or strongly implied play/plot-relevant groups, but mark thin evidence as uncertain instead of inventing detail.",
    // 中文：- faction：组织、家族、机构、目标、成员、资源、影响力、联盟、冲突或对玩家的态度；对游玩/剧情重要且清晰或强烈暗示的团体应抽取，但证据薄弱时标为不确定而不是编造细节。
    "- item: important equipment, clues, key objects, ownership, condition, function, limits, history, or plot hooks.",
    // 中文：- item：重要装备、线索、关键物件、归属、状态、功能、限制、历史或剧情钩子。
    "- plot_arc: routes, storylines, timelines, multi-event courses, unresolved questions, conflicts, foreshadowing, constraints, or possible developments; do not present possible futures as already happened.",
    // 中文：- plot_arc：路线、故事线、时间线、多事件进程、未解问题、冲突、伏笔、限制或可能发展；不要把可能的未来写成已经发生。
    "- discrete_event: one confirmed already-happened event with at least a time or relative-time anchor, place, participants, what happened, and consequences or state change.",
    // 中文：- discrete_event：一个已确认发生的事件，至少包含时间或相对时间锚点、地点、参与者、发生了什么，以及后果或状态变化。
    "- current_scene_state: latest live RPG scene snapshot needed for the next turn, only from live runtime/session state such as current session records, post-action latest state, GM/user-declared current scene, or RPG opening-scene initialization; static lore, biographies, summaries, endings, and epilogues are not current_scene_state.",
    // 中文：- current_scene_state：下一回合所需的最新实时 RPG 场景快照，只能来自当前 session 记录、行动后的最新状态、GM/用户声明的当前场景或 RPG 开场场景初始化等实时运行/session 状态；静态设定、传记、摘要、结局和尾声都不是 current_scene_state。
    "- relationship: relationship state, trust, tension, conflict, dependency, misunderstandings, history, changes, or constraints, not duplicate character introductions.",
    // 中文：- relationship：关系状态、信任、紧张、冲突、依赖、误解、历史、变化或限制，而不是重复角色介绍。
    "- character_trait_or_trivia: character-related details worth merging into a relevant character page rather than creating a standalone object.",
    // 中文：- character_trait_or_trivia：值得并入相关角色页、而不是创建独立对象的角色相关细节。
    "- wiki_noise: tags, trope labels, list cruft, navigation text, meta commentary, formatting residue, or low-value trivia that should be ignored.",
    // 中文：- wiki_noise：应忽略的标签、套路标签、列表残片、导航文字、元评论、格式残留或低价值琐碎信息。
    "Allowed suggested_route values: wiki/sources/, wiki/world/, wiki/characters/, wiki/player/, wiki/locations/, wiki/factions/, wiki/items/, wiki/plot-arcs/, wiki/events/, wiki/current-scene/, wiki/relationships/, merge-target, ignore.",
    // 中文：允许的 suggested_route 值：wiki/sources/、wiki/world/、wiki/characters/、wiki/player/、wiki/locations/、wiki/factions/、wiki/items/、wiki/plot-arcs/、wiki/events/、wiki/current-scene/、wiki/relationships/、merge-target、ignore。
    "Allowed action values: create, update, merge-into, ignore.",
    // 中文：允许的 action 值：create、update、merge-into、ignore。
    "Use action=create for a source-supported object that needs a new page, update for a known page that should be changed, merge-into for material that belongs inside an existing or more important page, and ignore for noise or unsupported material.",
    // 中文：对有来源支持且需要新建页面的对象使用 action=create；对需要修改的已知页面使用 update；对应并入已有或更重要页面的材料使用 merge-into；对噪声或无支持材料使用 ignore。
    "evidence_summary must briefly list the source evidence. brief_inference must be one or two concise sentences explaining the grounded conclusion from that evidence.",
    // 中文：evidence_summary 必须简要列出来源证据。brief_inference 必须用一两句简洁说明基于这些证据得出的结论。
    "confidence must be high, medium, or low. uncertainty must name evidence gaps, conflicts, ambiguity, or low-confidence routing. Do not output hidden reasoning or step-by-step chain-of-thought.",
    // 中文：confidence 必须是 high、medium 或 low。uncertainty 必须指出证据缺口、冲突、歧义或低置信路由。不要输出隐藏推理或逐步思维链。
    "",
    "Routing discipline:",
    // 中文：路由纪律：
    "- Prefer one best route for each fact. Use merge targets and open questions instead of duplicating the same material across many pages.",
    // 中文：- 每条事实优先选择一个最佳路由。用合并目标和开放问题处理不确定性，不要把同一材料复制到许多页面。
    "",
    "Ignored Noise must list skipped wiki_noise candidates and why they were ignored.",
    // 中文：Ignored Noise 必须列出被跳过的 wiki_noise 候选项，以及忽略原因。
    "Merge Targets must list merge-into or character_trait_or_trivia candidates with the target page/object when known.",
    // 中文：Merge Targets 必须列出 merge-into 或 character_trait_or_trivia 候选项，并在已知时给出目标页面/对象。
    "Open Questions must list unresolved routing, identity, timeline, evidence, or merge questions that Stage 2 should not invent away.",
    // 中文：Open Questions 必须列出尚未解决的路由、身份、时间线、证据或合并问题，Stage 2 不应自行编造答案。
  ].join("\n")
}

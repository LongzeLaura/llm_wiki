import {
  RPG_DIRECTORY_BOUNDARY_GUIDANCE,
  getRpgSourceIngestForbiddenTarget,
  getRpgSourceIngestTargetPolicy,
  getRpgWikiSchemaEntry,
  type RpgDirectoryBoundaryGuidance,
} from "@/lib/rpg-wiki-schema"
import type { RpgCategoryId } from "@/lib/rpg-categories"

type RpgGuidanceCategoryId = Exclude<RpgCategoryId, "sources">

export interface RpgPageGuidanceInput {
  stage1Analysis?: string
}

const RPG_GUIDANCE_CATEGORIES = [
  "world",
  "characters",
  "player",
  "locations",
  "factions",
  "items",
  "plot-arcs",
  "events",
  "relationships",
] as const satisfies readonly RpgGuidanceCategoryId[]

const MAX_SOURCE_PROFILE_CATEGORIES = 4

const VALID_EVENT_EXTRACTION_MODES = [
  "none",
  "discrete_only",
  "plot_arc_preferred",
  "split_if_possible",
] as const

type EventExtractionMode = typeof VALID_EVENT_EXTRACTION_MODES[number]

/**
 * 构建 RPG Stage 2 的最小生成合约。
 * 为什么需要：即使没有可靠的 Source Profile 分类，Stage 2 仍必须生成来源摘要、索引、日志和概览，并遵守动态状态隔离规则。
 */
export function buildMinimalRpgGenerationContract(summaryPath: string): string {
  return [
    "## RPG Wiki Generation Contract",
    // 中文：## RPG Wiki 生成合约
    "",
    `1. Create or update the source summary page at **${summaryPath}** (MUST use this exact path).`,
    // 中文：1. 创建或更新位于 **${summaryPath}** 的来源摘要页（必须使用这个精确路径）。
    "2. Generate FILE blocks only for source-supported candidates from the Stage 1 RPG analysis.",
    // 中文：2. 只为 Stage 1 RPG 分析中有来源支持的候选对象生成 FILE 块。
    "3. Use Stage 1's ## Source Profile needed_categories as the only category source for focused RPG directory contracts.",
    // 中文：3. 只使用 Stage 1 的 ## Source Profile 中的 needed_categories 作为聚焦 RPG 目录合约的分类来源。
    "4. Do not infer focused RPG categories from schema.md, purpose.md, source file names, source summary paths, object_type, or suggested_route.",
    // 中文：4. 不要根据 schema.md、purpose.md、来源文件名、来源摘要路径、object_type 或 suggested_route 推断聚焦 RPG 分类。
    "5. If the Source Profile is missing, invalid, or lists no needed_categories, do not compensate by applying every directory contract. Use the minimum RPG rules here and add REVIEW notes for unresolved routing when the profile is missing or invalid.",
    // 中文：5. 如果 Source Profile 缺失、无效或未列出 needed_categories，不要通过套用所有目录合约来补偿。只使用这里的最小 RPG 规则；当 profile 缺失或无效时，为未解决的路由问题添加 REVIEW 说明。
    "6. Update wiki/index.md without removing existing entries.",
    // 中文：6. 更新 wiki/index.md，且不要删除已有条目。
    "7. Append a wiki/log.md ingest entry.",
    // 中文：7. 向 wiki/log.md 追加一条导入日志。
    "8. Update wiki/overview.md when the new source changes the high-level RPG wiki coverage.",
    // 中文：8. 当新来源改变 RPG wiki 的高层覆盖范围时，更新 wiki/overview.md。
    "",
    buildSourceIngestTargetPolicyGuidance(),
    "",
    "Minimum RPG rules:",
    // 中文：最小 RPG 规则：
    "- Do not invent pages just to fill every RPG directory.",
    // 中文：- 不要为了填满每个 RPG 目录而编造页面。
    "- Keep current state separate from historical events.",
    // 中文：- 保持当前状态与历史事件分离。
    "- Prefer one best directory for each fact and add cross-links instead of repeating the same fact in many pages.",
    // 中文：- 每条事实优先选择一个最合适的目录，并通过交叉链接关联，而不是在许多页面中重复同一事实。
    "- Do not write unsupported interpretation as canon fact.",
    // 中文：- 不要把没有来源支持的解释写成正史事实。
    "- Ordinary ingest must not generate or update wiki/current-scene/scene_state.md; current-scene is maintained only by the RPG Play/Runtime apply flow.",
    // 中文：- 普通 ingest 不得生成或更新 wiki/current-scene/scene_state.md；current-scene 只由 RPG Play/Runtime apply 链路维护。
    "- If source text describes a canon scene, route it to events, plot-arcs, locations, characters, relationships, or sources as appropriate; do not treat it as the live current scene.",
    // 中文：- 如果来源文本描述正史场景，应按需要路由到 events、plot-arcs、locations、characters、relationships 或 sources，不要当作 live current scene。
    "- For every non-source RPG page, place a ## Runtime Capsule near the top unless the page is only an index/log/overview or a source summary.",
    // 中文：- 每个非 source RPG 页面都应在靠前位置放置 ## Runtime Capsule，除非它只是索引、日志、概览或来源摘要。
    "- Runtime Capsule must summarize runtime-useful information, not encyclopedia coverage.",
    // 中文：- Runtime Capsule 必须总结运行时有用信息，而不是百科覆盖面。
    "- Prefer short, actionable, source-grounded bullets over long prose.",
    // 中文：- 优先使用短小、可行动、有来源支撑的要点，而不是长段散文。
    "- Do not preserve low-value metadata, release trivia, fan labels, or route recap unless it affects play.",
    // 中文：- 不要保留低价值元数据、发售 trivia、粉丝标签或路线复述，除非它会影响游玩。
    "- If no action hook, constraint, tension, state impact, portrayal rule, or atmosphere/style signal exists, avoid creating a non-source page and add REVIEW instead.",
    // 中文：- 如果没有行动钩子、约束、张力、状态影响、扮演规则或氛围/风格信号，避免创建非 source 页面，改为添加 REVIEW。
    "- If Stage 1 or long-source context includes ## Structured RP Runtime Signals, use that section as the primary page-generation gate.",
    // 中文：- 如果 Stage 1 或长来源上下文包含 ## Structured RP Runtime Signals，则将该小节作为页面生成的主要门槛。
    "- Do not create or update non-source pages from utilityScore 0-1 structured signals; keep them in source summary / ignored noise only.",
    // 中文：- 不要根据 utilityScore 0-1 的结构化信号创建或更新非 source 页面；它们只进入来源摘要 / ignored noise。
    "- utilityScore 2 structured signals may only appear in REVIEW or Evidence and Uncertainty unless supported by utilityScore 3-5 signals for the same target.",
    // 中文：- utilityScore 2 的结构化信号只能进入 REVIEW 或 Evidence and Uncertainty，除非同一目标有 utilityScore 3-5 信号支撑。
    "- Runtime Capsule structure: One-line role; Meaning for player action; Key constraints; Hooks / pressure points; Portrayal / atmosphere cues; Do not miswrite as.",
    // 中文：- Runtime Capsule 结构：一句话定位；对玩家行动的意义；关键约束；钩子 / 压力点；扮演 / 氛围提示；不要误写成。
    "- In Chinese output, these headings may be translated, but their meaning must stay intact.",
    // 中文：- 中文输出时可以翻译这些标题，但结构含义必须保持。
    "",
    buildRpgDirectoryBoundaryGuidance(),
    "",
    buildRuntimePageBudgetGuidance(),
  ].join("\n")
}

/**
 * 将 code-readable 目录边界渲染进 prompt。
 * 为什么需要：D1 的边界需要同时约束 schema、Source Ingest prompt 和 runtime target 文案，避免多个手写版本漂移。
 */
export function buildRpgDirectoryBoundaryGuidance(): string {
  return [
    "## RPG Directory Boundary Guidance",
    "For Source Ingest, use these boundaries to avoid misroutes. They are not permissions to write other-mode targets.",
    ...RPG_DIRECTORY_BOUNDARY_GUIDANCE.map(formatSourceIngestBoundaryGuidance),
  ].join("\n")
}

function formatSourceIngestBoundaryGuidance(guidance: RpgDirectoryBoundaryGuidance): string {
  const pathNotes = guidance.paths.map((path) => {
    const forbidden = getRpgSourceIngestForbiddenTarget(path)
    return forbidden
      ? `${path} (Source Ingest: REVIEW only; recommended mode ${forbidden.recommendedMode})`
      : `${path} (Source Ingest boundary)`
  })
  return [
    `- ${pathNotes.join(" / ")}`,
    `  Use this meaning to classify facts: ${guidance.include.join(" ")}`,
    `  Do not miswrite as: ${guidance.exclude.join(" ")}`,
    `  Granularity: ${guidance.recommendedGranularity}`,
  ].join("\n")
}

export function buildSourceIngestTargetPolicyGuidance(): string {
  const policy = getRpgSourceIngestTargetPolicy()
  return [
    "## Source Ingest Target Policy",
    "Ordinary Source Ingest is a lossy compiler for source material, not a control document import, campaign bootstrap, or runtime apply flow.",
    "Allowed ordinary Source Ingest FILE targets:",
    ...policy.ordinaryTargets.map((target) => `- ${target}`),
    "Allowed structural FILE targets:",
    ...policy.structuralTargets.map((target) => `- ${target}`),
    "Forbidden in ordinary Source Ingest; emit REVIEW/warning instead of FILE blocks:",
    ...policy.forbiddenTargets.map((target) =>
      `- ${target.pathPattern}: ${target.reason} Recommended mode: ${target.recommendedMode}.`,
    ),
    "When input is a control document, style/rules/memory/outline note, opening-scene or player bootstrap pack, completed-turn record, current-scene update, or runtime overlay update, do not import it as ordinary source material. Emit REVIEW and name the recommended mode.",
  ].join("\n")
}

/**
 * 构建 RPG 页面软长度预算提示。
 * 为什么需要：预算是 prompt 质量目标，不改变 parser 或 writer 的硬行为。
 */
function buildRuntimePageBudgetGuidance(): string {
  return [
    "Runtime page soft budgets:",
    // 中文：运行时页面软预算：
    "- Runtime Capsule: 300-800 Chinese characters or equivalent.",
    // 中文：- Runtime Capsule：300-800 中文字或等效长度。
    "- characters: 1800-3000 Chinese characters.",
    // 中文：- characters：1800-3000 中文字。
    "- relationships: 600-1200 Chinese characters.",
    // 中文：- relationships：600-1200 中文字。
    "- locations: 600-1200 Chinese characters.",
    // 中文：- locations：600-1200 中文字。
    "- factions: 800-1500 Chinese characters.",
    // 中文：- factions：800-1500 中文字。
    "- items: 500-1000 Chinese characters.",
    // 中文：- items：500-1000 中文字。
    "- events: 400-900 Chinese characters.",
    // 中文：- events：400-900 中文字。
    "- plot-arcs: 800-1500 Chinese characters.",
    // 中文：- plot-arcs：800-1500 中文字。
    "- If a page would exceed the budget, keep only runtime-useful material and move unresolved excess into REVIEW.",
    // 中文：- 如果页面会超预算，只保留运行时有用材料，并把未解决的超额内容移入 REVIEW。
    "- These are prompt soft budgets, not parser hard limits.",
    // 中文：- 这些是 prompt 软预算，不是 parser 硬限制。
  ].join("\n")
}

/**
 * 根据 Stage 1 Source Profile 构建聚焦目录指导。
 * 为什么需要：Stage 2 只应展开 Source Profile 明确要求的目录合约，避免 schema/path 等输入再次打开分类推断入口。
 */
export function buildFocusedRpgPageGuidance(input: RpgPageGuidanceInput): string {
  const profile = parseSourceProfile(input.stage1Analysis)
  if (profile.categories.length === 0) {
    return [
      "## RPG Page Guidance",
      // 中文：## RPG 页面指导
      profile.profileValid
        ? "The Stage 1 Source Profile lists no needed_categories. Apply only the minimum RPG generation contract above."
        : "No valid ## Source Profile with needed_categories was found in the Stage 1 analysis. Apply only the minimum RPG generation contract above and add a REVIEW block explaining that focused RPG category selection is missing.",
      // 中文：如果 Stage 1 Source Profile 没有有效 needed_categories，则只应用上面的最小 RPG 生成合约；当 profile 无效或缺失时，添加 REVIEW 说明缺少聚焦分类选择。
    ].join("\n")
  }

  const selectedCategories = profile.categories

  return [
    "## Focused RPG Page Guidance",
    // 中文：## 聚焦 RPG 页面指导
    selectedCategories.length > 0
      ? `The following directory contract(s) were selected only from Stage 1 ## Source Profile needed_categories: ${selectedCategories.join(", ")}.`
      : "No focused directory contracts are active after applying ordinary ingest category rules.",
    // 中文：以下目录合约只根据 Stage 1 ## Source Profile 的 needed_categories 选择。
    profile.eventExtractionMode
      ? `Source Profile event_extraction_mode: ${profile.eventExtractionMode}.`
      : "",
    // 中文：Source Profile 中的 event_extraction_mode 如下。
    profile.eventExtractionMode === "plot_arc_preferred"
      ? "For route-like or long-course narrative material, prefer plot-arcs unless Stage 1 clearly split discrete confirmed events."
      : "",
    // 中文：对于路线型或长线叙事材料，优先写入 plot-arcs，除非 Stage 1 已明确拆出离散且已确认的事件。
    "Use Stage 1 Candidate Objects and RP Runtime Signals as a utility gate.",
    // 中文：使用 Stage 1 的 Candidate Objects 和 RP Runtime Signals 作为运行时价值门槛。
    "If ## Structured RP Runtime Signals is present in Stage 1 or long-source context, treat it as the authoritative utility-scored signal list for page generation.",
    // 中文：如果 Stage 1 或长来源上下文中存在 ## Structured RP Runtime Signals，将它视为页面生成的权威运行时评分信号列表。
    "utility_score/runtime_utility 4-5: prioritize in Runtime Capsule.",
    // 中文：utility_score/runtime_utility 为 4-5 的内容优先进入 Runtime Capsule。
    "utility_score/runtime_utility 3: may enter page body if source-supported.",
    // 中文：utility_score/runtime_utility 为 3 的内容如有来源支持可进入页面正文。
    "utility_score/runtime_utility 2: use only as REVIEW or Evidence and Uncertainty unless a 3-5 signal supports the same target.",
    // 中文：utility_score/runtime_utility 为 2 的内容只用于 REVIEW 或 Evidence and Uncertainty，除非同一目标有 3-5 分信号支撑。
    "utility_score/runtime_utility 0-1: keep out of non-source pages and do not use them as page-generation material.",
    // 中文：utility_score/runtime_utility 为 0-1 的内容不得进入非 source 页面。
    "Do not compress long plot/course recaps into one wiki/events/ page; only confirmed discrete events go to wiki/events/.",
    // 中文：不要把长剧情 / 路线复述压成一篇 wiki/events/ 页面；只有已确认的离散事件才进入 wiki/events/。
    "Unresolved conflicts, foreshadowing, possible developments, and progression conditions belong in wiki/plot-arcs/ or REVIEW.",
    // 中文：未解决冲突、伏笔、可能发展和推进条件应进入 wiki/plot-arcs/ 或 REVIEW。
    "PC subjective goals may enter wiki/player/goals.md only for an explicitly declared current PC. Do not create wiki/quests/*.md in ordinary Source Ingest; treat quest-like material as REVIEW unless a later dedicated mode owns it.",
    // 中文：PC 主观目标只有在来源明确声明当前 PC 时才可进入 wiki/player/goals.md。普通 Source Ingest 不创建 wiki/quests/*.md；任务式材料进入 REVIEW，除非后续专用 mode 拥有它。
    "Plot pressure, unresolved conflict, foreshadowing, and possible development belong in wiki/plot-arcs/, not wiki/player/goals.md.",
    // 中文：剧情压力、未解决冲突、伏笔和可能发展进入 wiki/plot-arcs/，不要写入 wiki/player/goals.md。
    "Player TODO/checklists are REVIEW in ordinary Source Ingest unless they are true current-PC subjective goals for wiki/player/goals.md.",
    // 中文：玩家待办清单在普通 Source Ingest 中进入 REVIEW，除非它们确实是当前 PC 主观目标并写入 wiki/player/goals.md。
    "Global writing rules are control_doc_import material for REVIEW; character-specific voice, catchphrases, address habits, politeness level, and relationship-driven tone changes go to characters/ or relationships/.",
    // 中文：全局写作规则属于 control_doc_import 材料，应进入 REVIEW；角色专属语气、口癖、称呼习惯、礼貌等级和关系驱动的语气变化进入 characters/ 或 relationships/。
    "Executable mechanics, limits, costs, checks, allowed/disallowed actions, and success/failure boundaries are control_doc_import material for REVIEW; world/ is fixed to basic_overview.md, history.md, common_sense.md, supernatural_presence.md, and social_structure.md for stable setting facts.",
    // 中文：可执行机制、限制、代价、判定、行动边界和成败边界属于 control_doc_import 材料，应进入 REVIEW；world/ 固定为 basic_overview.md、history.md、common_sense.md、supernatural_presence.md 和 social_structure.md，用于稳定设定事实。
    "For structured signals scored 4-5, put the usable target-page material first in ## Runtime Capsule.",
    // 中文：结构化信号 4-5 分时，应优先把可用目标页材料放入 ## Runtime Capsule。
    "",
    ...selectedCategories.map(buildRpgCategoryGuidance),
  ].filter(Boolean).join("\n")
}

/**
 * 从 Stage 1 analysis 中解析 Stage 2 需要展开的 RPG 目录。
 * 为什么需要：保留一个可测试的分类解析入口，同时确保其唯一输入是 Stage 1 analysis。
 */
export function inferRpgGuidanceCategories(stage1Analysis?: string): RpgGuidanceCategoryId[] {
  return parseSourceProfile(stage1Analysis).categories
}

/**
 * 解析 Source Profile，返回白名单分类、事件提取模式，以及 profile 是否存在/有效。
 */
function parseSourceProfile(stage1Analysis?: string): {
  categories: RpgGuidanceCategoryId[]
  eventExtractionMode?: EventExtractionMode
  profileFound: boolean
  profileValid: boolean
} {
  const section = extractSourceProfileSection(stage1Analysis)
  if (!section) {
    return {
      categories: [],
      profileFound: false,
      profileValid: false,
    }
  }

  const parsed = parseNeededCategories(section)
  const categories = uniqueCategories(parsed.categories).slice(0, MAX_SOURCE_PROFILE_CATEGORIES)

  return {
    categories,
    eventExtractionMode: parseEventExtractionMode(section),
    profileFound: true,
    profileValid: parsed.valid,
  }
}

/**
 * 提取 Stage 1 analysis 中的 ## Source Profile 小节。
 */
function extractSourceProfileSection(stage1Analysis?: string): string {
  if (!stage1Analysis) return ""
  const match = /^##\s+Source Profile\s*$/im.exec(stage1Analysis)
  if (!match) return ""
  const rest = stage1Analysis.slice(match.index + match[0].length)
  const nextHeading = /^##\s+/m.exec(rest)
  return (nextHeading ? rest.slice(0, nextHeading.index) : rest).trim()
}

/**
 * 解析 needed_categories，并把非法分类过滤掉。
 * valid 用于区分“明确空列表”和“字段缺失/无法解析”。
 */
function parseNeededCategories(section: string): {
  categories: RpgGuidanceCategoryId[]
  valid: boolean
} {
  const lineMatch = /^\s*(?:[-*]\s*)?needed_categories\s*:\s*(.+)$/im.exec(section)
  if (!lineMatch) return { categories: [], valid: false }
  const rawValue = lineMatch[1]
  const tokens = rawValue.match(/[a-z][a-z-]*/gi) ?? []
  const categories: RpgGuidanceCategoryId[] = []
  for (const token of tokens) {
    if (isRpgGuidanceCategory(token)) categories.push(token)
  }
  const explicitlyEmpty = /^\s*\[\s*\]\s*$/.test(rawValue.trim())
  return {
    categories,
    valid: explicitlyEmpty || categories.length > 0,
  }
}

/**
 * 解析 Source Profile 的事件提取模式，只接受枚举值。
 */
function parseEventExtractionMode(section: string): EventExtractionMode | undefined {
  const match = /^\s*(?:[-*]\s*)?event_extraction_mode\s*:\s*([a-z_]+)/im.exec(section)
  if (!match) return undefined
  const value = match[1].toLowerCase()
  return isEventExtractionMode(value) ? value : undefined
}

/**
 * 校验字符串是否是允许展开的 RPG 目录分类。
 */
function isRpgGuidanceCategory(value: string): value is RpgGuidanceCategoryId {
  return (RPG_GUIDANCE_CATEGORIES as readonly string[]).includes(value)
}

/**
 * 校验字符串是否是允许的事件提取模式。
 */
function isEventExtractionMode(value: string): value is EventExtractionMode {
  return (VALID_EVENT_EXTRACTION_MODES as readonly string[]).includes(value)
}

/**
 * 按 Source Profile 中出现的顺序去重，保持 Stage 1 的分类优先级。
 */
function uniqueCategories(categories: RpgGuidanceCategoryId[]): RpgGuidanceCategoryId[] {
  const seen = new Set<RpgGuidanceCategoryId>()
  const result: RpgGuidanceCategoryId[] = []
  for (const category of categories) {
    if (seen.has(category)) continue
    seen.add(category)
    result.push(category)
  }
  return result
}

/**
 * 为单个 RPG 目录生成 schema 摘要和目录专属写作合约。
 */
function buildRpgCategoryGuidance(category: RpgGuidanceCategoryId): string {
  const schemaEntry = getRpgWikiSchemaEntry(category)
  const schemaLine = schemaEntry
    ? `Schema: ${schemaEntry.extractionGoal} Update strategy: ${schemaEntry.updateStrategy}. Granularity: ${schemaEntry.recommendedGranularity}`
    : ""
  // 中文：Schema：该目录的抽取目标、更新策略和推荐粒度。

  return [
    `### ${category} (${schemaEntry?.path ?? `wiki/${category}`}/)`,
    // 中文：### 目录名（对应的 wiki 路径）
    schemaLine,
    categoryContract(category),
  ].filter(Boolean).join("\n")
}

/**
 * 返回某个 RPG 目录的专属写作合约。
 */
function categoryContract(category: RpgGuidanceCategoryId): string {
  switch (category) {
    case "characters":
      return buildRpgCharacterPageContract()
    case "player":
      return [
        "Player contract:",
        // 中文：玩家角色合约：
        "- Use wiki/player/ only for the current RPG player-created or explicitly declared player character.",
        // 中文：- 仅当来源说明这是当前 RPG 中由玩家创建或明确声明的玩家角色时，才使用 wiki/player/。
        "- Store current PC-facing state useful for the next turn: identity, abilities, inventory, subjective goals, knowledge, obligations, wounds, consequences, and accepted choices.",
        // 中文：- 存储下一回合有用的 PC 面向状态：身份、能力、物品、主观目标、知识、义务、伤势、后果和已接受选择。
        "- wiki/player/goals.md is for PC subjective goals, wishes, promises, and personal motives; do not put quest progress tables or plot pressure there.",
        // 中文：- wiki/player/goals.md 用于 PC 主观目标、愿望、承诺和个人动机；不要放任务进度表或剧情压力。
        "- wiki/player/inventory.md is for current holdings, quantity, equipped/backpack state, and consumption/damage state; item definitions belong in wiki/items/.",
        // 中文：- wiki/player/inventory.md 用于当前持有、数量、装备/背包状态和消耗/损坏状态；物品定义属于 wiki/items/。
        "- Do not route ordinary NPCs, protagonists, viewpoint characters, or controllable canon leads here unless the source establishes them as the current PC.",
        // 中文：- 不要把普通 NPC、主角、视角角色或可操控的正史主角放到这里，除非来源明确其为当前 PC。
      ].join("\n")
    case "events":
      return [
        "Events contract:",
        // 中文：事件合约：
        "- Write only discrete, confirmed, already-happened events.",
        // 中文：- 只写离散、已确认、已经发生的事件。
        "- Prioritize state change, who knows, who changed, remaining consequence, and clue/pressure/result.",
        // 中文：- 优先记录状态变化、谁知道、谁改变了、剩余后果，以及线索/压力/结果。
        "- Each event needs a time or sequence marker, place, participants, what happened, and consequences/state change.",
        // 中文：- 每个事件都需要时间或顺序标记、地点、参与者、发生了什么，以及后果/状态变化。
        "- Do not write future route possibilities, foreshadowing, or plot summaries as events; move them to plot-arcs or REVIEW.",
        // 中文：- 不要把未来路线可能性、伏笔或剧情摘要写成 events；应移到 plot-arcs 或 REVIEW。
      ].join("\n")
    case "plot-arcs":
      return [
        "Plot-arcs contract:",
        // 中文：剧情线合约：
        "- Store unresolved conflict, pressure, foreshadowing, reveal pacing, blockers, possible developments, and conditions for progression.",
        // 中文：- 存储未解决冲突、压力、伏笔、揭示节奏、阻碍、可能发展和推进条件。
        "- Do not store player TODO/checklists or quest progress ledgers in plot-arcs.",
        // 中文：- 不要把玩家待办清单或任务进度表写入 plot-arcs。
        "- Clearly separate confirmed facts from possible futures.",
        // 中文：- 清楚区分已确认事实和未来可能性。
        "- Do not resolve conflicts early or present possible or future developments as already happened.",
        // 中文：- 不要提前解决冲突，也不要把可能或未来的发展写成已经发生。
        "- Link to discrete events for confirmed occurrences instead of duplicating the full event timeline.",
        // 中文：- 对于已确认发生的内容，链接到离散事件，而不是重复完整事件时间线。
      ].join("\n")
    case "relationships":
      return [
        "Relationships contract:",
        // 中文：关系合约：
        "- Treat relationship pages as tension/levers, not duplicate biographies.",
        // 中文：- 将关系页当作张力和杠杆，而不是重复人物传记。
        "- Prioritize trust, dependence, fear, guilt, attraction, control, misunderstanding, secrets, escalation/de-escalation triggers, and changes that need setup.",
        // 中文：- 优先写信任、依赖、恐惧、愧疚、吸引、控制、误解、秘密、升级/降级触发器，以及需要铺垫的变化。
        "- Put pair-specific or relationship-driven tone changes here; keep general character voice in characters and global style in wiki/style/.",
        // 中文：- 两人关系驱动的语气变化放在这里；一般角色声音在 characters，全局风格在 wiki/style/。
        "- Mark inferred_for_play interpretation clearly.",
        // 中文：- 清楚标记 inferred_for_play 的解释。
        "- Do not duplicate full character profiles or one-off interactions with no relationship impact.",
        // 中文：- 不要重复完整角色档案，也不要记录没有关系影响的一次性互动。
        "- Rewrite current relationship-state sections carefully so stale status does not linger.",
        // 中文：- 谨慎重写当前关系状态区块，避免旧状态残留。
      ].join("\n")
    case "locations":
      return [
        "Locations scene-card contract:",
        // 中文：地点场景卡合约：
        "- Treat each location as a playable scene card.",
        // 中文：- 将每个地点当作可运行的场景卡。
        "- Prioritize sensory anchors, entrances/exits, access conditions, dangers, clues, interactable objects, common occupants, and scene hooks.",
        // 中文：- 优先写感官锚点、入口/出口、进入条件、危险、线索、可交互物、常见在场者和场景钩子。
        "- Avoid travel-guide or lore-only descriptions.",
        // 中文：- 避免旅行指南式或纯 lore 描述。
        "- Short source-limited stubs are acceptable for core places; do not invent geography or history to fill gaps.",
        // 中文：- 对核心地点可以写来源有限的简短条目；不要编造地理或历史来填补空白。
      ].join("\n")
    case "factions":
      return [
        "Factions pressure-source contract:",
        // 中文：阵营压力源合约：
        "- Treat each faction as a pressure source.",
        // 中文：- 将每个阵营当作压力源。
        "- Prioritize agenda, resources, leverage, reaction thresholds, attitude toward player/NPCs, alliances/conflicts, and consequences when provoked.",
        // 中文：- 优先写目标、资源、杠杆、反应阈值、对玩家/NPC 的态度、联盟/冲突，以及被激怒后的后果。
        "- Avoid organization-history summaries unless they change current pressure or behavior.",
        // 中文：- 避免组织史摘要，除非它会改变当前压力或行为。
        "- Short source-limited stubs are acceptable for core groups; do not invent membership, agenda, or history.",
        // 中文：- 对核心团体可以写来源有限的简短条目；不要编造成员、目标或历史。
      ].join("\n")
    case "items":
      return [
        "Items runtime-function contract:",
        // 中文：物品运行功能合约：
        "- Treat each item as usable, risky, costly, evidentiary, symbolic, or plot-functional.",
        // 中文：- 将每个物品视为可使用、有风险、有代价、有证据价值、有象征意义或有剧情功能。
        "- Prioritize use, cost, limits, owner/holder, condition, risk, clue value, and plot function.",
        // 中文：- 优先写用途、代价、限制、所有者/持有者、状态、风险、线索价值和剧情功能。
        "- Do not replace wiki/player/inventory.md; player inventory tracks current holdings, quantities, equipped/backpack state, and consumption/damage state.",
        // 中文：- 不要替代 wiki/player/inventory.md；玩家背包记录当前持有、数量、装备/背包状态和消耗/损坏状态。
        "- Skip props with no action or state impact.",
        // 中文：- 跳过没有行动或状态影响的道具。
      ].join("\n")
    case "world":
      return [
        "World contract:",
        // 中文：世界观合约：
        "- Capture background, common knowledge, history, society, culture, geography, public perception, atmosphere, and stable setting facts.",
        // 中文：- 记录背景、常识、历史、社会、文化、地理、公共认知、氛围和稳定设定事实。
        "- Do not bury executable mechanics, limits, resource costs, checks, allowed/disallowed actions, or success/failure boundaries in world; those belong in rules/ or REVIEW for a control import.",
        // 中文：- 不要把可执行机制、限制、资源代价、判定、行动边界或成败边界塞入 world；这些属于 rules/ 或控制导入 REVIEW。
        "- Avoid broad setting encyclopedia prose unless it changes common knowledge, access, risk, or player-facing context.",
        // 中文：- 避免宽泛百科散文，除非它改变常识、进入条件、风险或玩家面向上下文。
        "- Do not store character-specific state or discrete event transcripts here.",
        // 中文：- 不要在这里存放角色专属状态或离散事件记录。
      ].join("\n")
    default:
      return ""
  }
}

/**
 * 生成 characters/ 目录使用的角色卡写作合约。
 */
function buildRpgCharacterPageContract(): string {
  return [
    "Character page contract for wiki/characters/*.md:",
    // 中文：wiki/characters/*.md 的角色页面合约：
    "- Build a runtime-first NPC operation model, not a long biography.",
    // 中文：- 构建运行时优先的 NPC 操作模型，而不是长篇人物传记。
    "- Prefer this section structure, or translated heading equivalents in the required output language:",
    // 中文：- 优先使用以下章节结构，或在要求的输出语言中使用对应的翻译标题：
    "- ## Runtime Capsule",
    // 中文：- ## 运行时胶囊
    "- ## Canon Facts",
    // 中文：- ## 正史事实
    "- ## Psychological Model",
    // 中文：- ## 心理模型
    "- ## Behavior Rules",
    // 中文：- ## 行为规则
    "- ## Dialogue Style",
    // 中文：- ## 对话风格
    "- ## Relationship Levers",
    // 中文：- ## 关系杠杆
    "- ## Evidence and Uncertainty",
    // 中文：- ## 证据与不确定性
    "- Runtime Capsule should include first impression, default stance, current usable tension, hard behavior boundaries, and likely player-triggered reactions.",
    // 中文：- Runtime Capsule 应包含第一印象、默认立场、当前可用张力、不可违背的行为边界和玩家最可能触发的反应。
    "- Canon Facts should keep only first-line facts that affect portrayal, choices, constraints, or relationships.",
    // 中文：- Canon Facts 只保留会影响扮演、选择、约束或关系的一线事实。
    "- Psychological Model should explain how they assess risk, hide vulnerability, defend themselves, and why they accept or reject help.",
    // 中文：- Psychological Model 应说明角色如何判断风险、隐藏脆弱、自我防御，以及为什么接受或拒绝帮助。
    "- Behavior Rules should include: if the player shows weakness, usually; if the player pressures a secret, usually; if the situation collapses, priority is; they will not.",
    // 中文：- Behavior Rules 应包含：如果玩家示弱通常如何；如果玩家逼问秘密通常如何；如果局势失控优先如何；他们不会做什么。
    "- Dialogue Style should cover sentence rhythm, politeness level, avoidance habits, typical short phrases, and forbidden writing style.",
    // 中文：- Dialogue Style 应覆盖句子节奏、礼貌等级、回避习惯、典型短句和禁止写法。
    "- Character-specific voice, catchphrases, address habits, politeness level, and avoided topics belong here, not in global wiki/style/.",
    // 中文：- 角色专属语气、口癖、称呼习惯、礼貌等级和回避话题属于这里，而不是全局 wiki/style/。
    "- Relationship Levers should cover trust increases when, trust decreases when, defensive reaction triggers, and changes that require setup.",
    // 中文：- Relationship Levers 应覆盖什么会增加信任、什么会降低信任、防御反应触发器，以及需要铺垫的变化。
    "- Evidence and Uncertainty should separate direct evidence, reasonable inference, and route/timeline differences.",
    // 中文：- Evidence and Uncertainty 应区分直接证据、合理推断和路线/时间线差异。
    "- Do not present RP inference, convenience assumptions, or scene-serving extrapolation as Canon Facts.",
    // 中文：- 不要把 RP 推断、便利性假设或服务场景的外推写成正史事实。
    "- Do not collapse route-specific, ending-specific, epilogue, or years-later states into one universal current-state section.",
    // 中文：- 不要把路线专属、结局专属、尾声或多年后的状态压缩成一个通用当前状态章节。
    "- Fold old biography-style material into the runtime sections above instead of using headings like Character Impression, Identity and Recognizable Traits, Reasonable Interpretation, Route and Timeline Variants, RP Usage, or Relationship Dynamics.",
    // 中文：- 将旧人物百科式材料并入上面的运行时章节，避免继续使用 Character Impression、Identity and Recognizable Traits、Reasonable Interpretation、Route and Timeline Variants、RP Usage 或 Relationship Dynamics 等标题。
    "- Do not stop at labels like tsundere, gentle, or strong. Explain repeatable behavior patterns and interaction texture.",
    // 中文：- 不要停留在“傲娇”“温柔”“强大”等标签上，要解释可重复的行为模式和互动质感。
    "- If evidence is thin, keep the section short and move the gap into Evidence and Uncertainty.",
    // 中文：- 如果证据很薄，请保持该部分简短，并把缺口写入“证据与不确定性”。
  ].join("\n")
}

import { getRpgWikiSchemaEntry } from "@/lib/rpg-wiki-schema"
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
  "current-scene",
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
    "- Treat [RPG-LIVE] as an input control marker only; never copy it into any generated wiki page.",
    // 中文：- 将 [RPG-LIVE] 仅视为输入控制标记，绝不要复制进任何生成的 wiki 页面。
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

  const currentSceneFiltered = profile.categories.includes("current-scene") && !profile.liveSceneAllowed
  const selectedCategories = currentSceneFiltered
    ? profile.categories.filter((category) => category !== "current-scene")
    : profile.categories

  return [
    "## Focused RPG Page Guidance",
    // 中文：## 聚焦 RPG 页面指导
    selectedCategories.length > 0
      ? `The following directory contract(s) were selected only from Stage 1 ## Source Profile needed_categories: ${selectedCategories.join(", ")}.`
      : "No focused directory contracts are active after applying the live-scene marker gate.",
    // 中文：以下目录合约只根据 Stage 1 ## Source Profile 的 needed_categories 选择。
    currentSceneFiltered
      ? "REVIEW: current-scene was requested, but it requires live_scene_allowed: true from a source containing [RPG-LIVE]. Do not expand the Current-scene contract."
      : "",
    // 中文：REVIEW：Stage 1 请求了 current-scene，但它需要来自包含 [RPG-LIVE] 源文本的 live_scene_allowed: true；不要展开 Current-scene contract。
    profile.eventExtractionMode
      ? `Source Profile event_extraction_mode: ${profile.eventExtractionMode}.`
      : "",
    // 中文：Source Profile 中的 event_extraction_mode 如下。
    profile.eventExtractionMode === "plot_arc_preferred"
      ? "For route-like or long-course narrative material, prefer plot-arcs unless Stage 1 clearly split discrete confirmed events."
      : "",
    // 中文：对于路线型或长线叙事材料，优先写入 plot-arcs，除非 Stage 1 已明确拆出离散且已确认的事件。
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
  liveSceneAllowed: boolean
  profileFound: boolean
  profileValid: boolean
} {
  const section = extractSourceProfileSection(stage1Analysis)
  if (!section) {
    return {
      categories: [],
      liveSceneAllowed: false,
      profileFound: false,
      profileValid: false,
    }
  }

  const parsed = parseNeededCategories(section)
  const categories = uniqueCategories(parsed.categories).slice(0, MAX_SOURCE_PROFILE_CATEGORIES)

  return {
    categories,
    eventExtractionMode: parseEventExtractionMode(section),
    liveSceneAllowed: parseLiveSceneAllowed(section),
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
 * 解析 Source Profile 的 live_scene_allowed，只接受明确的 true。
 * 为什么需要：current-scene 是实时状态快照，Stage 2 不能仅凭 needed_categories 展开写入合约。
 */
function parseLiveSceneAllowed(section: string): boolean {
  return /^\s*(?:[-*]\s*)?live_scene_allowed\s*:\s*true\s*$/im.test(section)
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
        "- Store accepted player state, abilities, inventory, knowledge, goals, and consequences.",
        // 中文：- 存储已确认的玩家状态、能力、物品、知识、目标和后果。
        "- Do not route ordinary NPCs, protagonists, viewpoint characters, or controllable canon leads here unless the source establishes them as the current PC.",
        // 中文：- 不要把普通 NPC、主角、视角角色或可操控的正史主角放到这里，除非来源明确其为当前 PC。
      ].join("\n")
    case "current-scene":
      return [
        "Current-scene contract:",
        // 中文：当前场景合约：
        "- The source input must contain the exact [RPG-LIVE] marker.",
        // 中文：- 源输入必须包含精确的 [RPG-LIVE] 标记。
        "- Use exactly wiki/current-scene/scene_state.md.",
        // 中文：- 必须使用 wiki/current-scene/scene_state.md。
        "- Write only the live scene snapshot needed for the next turn.",
        // 中文：- 只写下一回合需要的实时场景快照。
        "- Do not generate current-scene from static lore, biographies, endings, epilogues, or route summaries.",
        // 中文：- 不要从静态设定、传记、结局、尾声或路线摘要生成 current-scene。
        "- Do not copy [RPG-LIVE] into page content, titles, evidence text, or body text.",
        // 中文：- 不要把 [RPG-LIVE] 复制进页面内容、标题、证据文本或正文。
      ].join("\n")
    case "events":
      return [
        "Events contract:",
        // 中文：事件合约：
        "- Write only discrete, confirmed, already-happened events.",
        // 中文：- 只写离散、已确认、已经发生的事件。
        "- Each event needs a time or sequence marker, place, participants, what happened, and consequences/state change.",
        // 中文：- 每个事件都需要时间或顺序标记、地点、参与者、发生了什么，以及后果/状态变化。
        "- Routes, storylines, timelines, multi-year courses, future plans, and possible developments belong in plot-arcs or should be split into separate events.",
        // 中文：- 路线、故事线、时间线、跨多年进程、未来计划和可能发展属于 plot-arcs，或应拆成多个独立事件。
      ].join("\n")
    case "plot-arcs":
      return [
        "Plot-arcs contract:",
        // 中文：剧情线合约：
        "- Store routes, storylines, unresolved questions, foreshadowing, conflicts, constraints, and possible developments.",
        // 中文：- 存储路线、故事线、未解决问题、伏笔、冲突、限制条件和可能发展。
        "- Do not present possible or future developments as already happened.",
        // 中文：- 不要把可能或未来的发展写成已经发生。
        "- Link to discrete events for confirmed occurrences instead of duplicating the full event timeline.",
        // 中文：- 对于已确认发生的内容，链接到离散事件，而不是重复完整事件时间线。
      ].join("\n")
    case "relationships":
      return [
        "Relationships contract:",
        // 中文：关系合约：
        "- Record relationship state, changes, trust, tension, dependency, misunderstandings, and constraints.",
        // 中文：- 记录关系状态、变化、信任、紧张、依赖、误解和限制。
        "- Do not duplicate full character profiles or one-off interactions with no relationship impact.",
        // 中文：- 不要重复完整角色档案，也不要记录没有关系影响的一次性互动。
        "- Rewrite current relationship-state sections carefully so stale status does not linger.",
        // 中文：- 谨慎重写当前关系状态区块，避免旧状态残留。
      ].join("\n")
    case "locations":
      return [
        "Locations short contract:",
        // 中文：地点简短合约：
        "- Capture important or repeated places, access conditions, spatial relationships, current state, clues, and scene hooks.",
        // 中文：- 记录重要或反复出现的地点、进入条件、空间关系、当前状态、线索和场景钩子。
        "- Short source-limited stubs are acceptable for core places; do not invent geography or history to fill gaps.",
        // 中文：- 对核心地点可以写来源有限的简短条目；不要编造地理或历史来填补空白。
      ].join("\n")
    case "factions":
      return [
        "Factions short contract:",
        // 中文：阵营简短合约：
        "- Capture organizations, families, institutions, agendas, members, resources, influence, and alliances/conflicts.",
        // 中文：- 记录组织、家族、机构、目标、成员、资源、影响力以及联盟/冲突。
        "- Short source-limited stubs are acceptable for core groups; do not invent membership, agenda, or history.",
        // 中文：- 对核心团体可以写来源有限的简短条目；不要编造成员、目标或历史。
      ].join("\n")
    case "items":
      return [
        "Items short contract:",
        // 中文：物品简短合约：
        "- Capture important equipment, clues, key objects, ownership, condition, function, limits, and plot hooks.",
        // 中文：- 记录重要装备、线索、关键物件、归属、状态、功能、限制和剧情钩子。
        "- Skip ordinary props or inventory chatter unless ownership, condition, or plot state changes.",
        // 中文：- 跳过普通道具或背包闲聊，除非归属、状态或剧情状态发生变化。
      ].join("\n")
    case "world":
      return [
        "World contract:",
        // 中文：世界观合约：
        "- Capture stable setting facts, public history, social rules, atmosphere, and reusable world systems.",
        // 中文：- 记录稳定设定事实、公开历史、社会规则、氛围和可复用世界系统。
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
    "- Prefer this section structure, or translated heading equivalents in the required output language:",
    // 中文：- 优先使用以下章节结构，或在要求的输出语言中使用对应的翻译标题：
    "- ## Character Impression",
    // 中文：- ## 角色印象
    "- ## Identity and Recognizable Traits",
    // 中文：- ## 身份与可识别特征
    "- ## Canon Facts",
    // 中文：- ## 正史事实
    "- ## Reasonable Interpretation",
    // 中文：- ## 合理解释
    "- ## Psychological Model",
    // 中文：- ## 心理模型
    "- ### Trauma / Stress Sources",
    // 中文：- ### 创伤 / 压力来源
    "- ### Defense Patterns",
    // 中文：- ### 防御模式
    "- ### Trigger Points",
    // 中文：- ### 触发点
    "- ### Deep Needs",
    // 中文：- ### 深层需求
    "- ## Behavior Rules",
    // 中文：- ## 行为规则
    "- ## Dialogue Style",
    // 中文：- ## 对话风格
    "- ## Relationship Dynamics",
    // 中文：- ## 关系动态
    "- ## Route and Timeline Variants",
    // 中文：- ## 路线与时间线变体
    "- ## RP Usage",
    // 中文：- ## RP 使用方式
    "- ## Evidence and Uncertainty",
    // 中文：- ## 证据与不确定性
    "- Canon Facts may contain only source-supported facts.",
    // 中文：- 正史事实只能包含有来源支持的事实。
    "- Reasonable Interpretation must stay grounded in Canon Facts and show the concise evidence basis.",
    // 中文：- 合理解释必须扎根于正史事实，并简明说明证据基础。
    "- RP Usage exists to support later interaction generation, not to rewrite canon.",
    // 中文：- RP 使用方式用于支持后续互动生成，而不是改写正史。
    "- Do not present RP inference, convenience assumptions, or scene-serving extrapolation as Canon Facts.",
    // 中文：- 不要把 RP 推断、便利性假设或服务场景的外推写成正史事实。
    "- Do not collapse route-specific, ending-specific, epilogue, or years-later states into one universal current-state section.",
    // 中文：- 不要把路线专属、结局专属、尾声或多年后的状态压缩成一个通用当前状态章节。
    "- Do not stop at labels like tsundere, gentle, or strong. Explain repeatable behavior patterns and interaction texture.",
    // 中文：- 不要停留在“傲娇”“温柔”“强大”等标签上，要解释可重复的行为模式和互动质感。
    "- If evidence is thin, keep the section short and move the gap into Evidence and Uncertainty.",
    // 中文：- 如果证据很薄，请保持该部分简短，并把缺口写入“证据与不确定性”。
  ].join("\n")
}

import {
  buildRpgDirectoryBoundaryGuidance,
  buildSourceIngestTargetPolicyGuidance,
} from "./page-guidance-contract"
import { promptLanguageRule as languageRule } from "./shared-ingest-contract"

export interface SourceChunk {
  id: string
  index: number
  total: number
  headingPath: string
  overlapBefore: string
  main: string
}

export function buildChunkAnalysisSystemPrompt(
  purpose: string,
  schema: string,
  index: string,
  sourceContent: string,
): string {
  return [
    // 系统角色：分析长源文档
    "You are analyzing a long source document for a personal wiki.",
    // 禁止输出思维链
    "Do not output chain-of-thought, hidden reasoning, or a thinking transcript.",
    // 只分析当前主块，用重叠和摘要做上下文
    "Analyze only the current MAIN CHUNK. Use overlap and digest for context only.",
    // 保持与已有 wiki 和之前的摘要一致的命名
    "Keep stable names consistent with the existing wiki and prior digest.",
    "",
    languageRule(sourceContent),
    "",
    // 输出恰好三个 markdown 部分
    "Output exactly three markdown sections:",
    "",
    // 块分析：简明摘要、实体、概念、主张、证据、矛盾、开放问题
    "## Chunk Analysis",
    "- Concise summary of the main chunk",
    "- New or updated RPG objects, scenes, relationships, or state",
    "- Routing decisions for RPG runtime directories",
    "- Claims, evidence, contradictions, and uncertainties",
    "- Open questions or research gaps",
    "",
    "## RP Runtime Signals JSON",
    "Output a fenced JSON array of RpgIngestSignal objects. The parser will treat this JSON as authoritative over prose notes.",
    "JSON object fields: kind, optional targetPath, summary, rpUse, evidence, utilityScore, confidence, canonStatus.",
    "Allowed kind values: portrayal_rule, dialogue_style, behavior_boundary, scene_affordance, relationship_tension, plot_pressure, world_constraint, action_hook, state_change, style_rule, noise.",
    "targetPath is optional, but when present it must be an ordinary Source Ingest target such as wiki/world/tide-laws.md, wiki/characters/mira-vale.md, wiki/plot-arcs/canal-gate-pressure.md, wiki/events/canal-gate-incident.md, or wiki/relationships/mira-iven.md.",
    "utilityScore rules: 0 noise discard/ignored noise; 1 source/archive value only; 2 weak or uncertain signal for REVIEW or Evidence and Uncertainty; 3 usable source-ingest page content; 4 strong source-ingest signal for Runtime Capsule; 5 hard constraint, high-value portrayal rule, major tension, or key action hook only when it fits an allowed source-ingest page, otherwise REVIEW.",
    "confidence must be high, medium, or low. canonStatus must be canon, inferred_for_play, or uncertain.",
    "For invalid, low-value, metadata, trivia, release/platform, fan-label, navigation, or route-recap noise, emit kind noise with utilityScore 0 or 1 instead of creating runtime-facing targets.",
    "For long route/course narrative material, prefer plot_pressure/action_hook signals for wiki/plot-arcs/ and emit state_change signals for wiki/events/ only when the main chunk contains a confirmed discrete already-happened event.",
    "Never turn an unresolved plot pressure, foreshadowing, possible development, or progression condition into a confirmed event signal.",
    "Do not target wiki/quests/ in ordinary Source Ingest; quest-like material is REVIEW-only until a dedicated mode owns it.",
    "Do not target wiki/player/goals.md for plot pressure; use it only for PC subjective goals, wishes, promises, and personal motives.",
    "Do not turn player TODO/checklists into plot-arcs; use REVIEW unless they are game-recognized trackable quests or true PC subjective goals.",
    "Global writing rules are control_doc_import material for REVIEW; character-specific voice, catchphrases, address habits, politeness level, and relationship-driven tone changes belong with character/relationship signals.",
    "Executable mechanics, limits, costs, checks, allowed/disallowed actions, and success/failure boundaries are control_doc_import material for REVIEW; stable background, common knowledge, history, society, geography, and public setting facts are world material.",
    "Opening scenes, player bootstrap packs, initial inventory/abilities/current-scene bootstrap, completed turns, current-scene updates, and runtime overlay updates are REVIEW signals recommending campaign_setup_import or runtime_update_apply, not Source Ingest target paths.",
    "",
    buildSourceIngestTargetPolicyGuidance(),
    "",
    buildRpgDirectoryBoundaryGuidance(),
    "Use this exact fenced format:",
    "```json",
    "[]",
    "```",
    "",
    // 更新的全局摘要：整合当前块并保留跨块上下文
    "## Updated Global Digest",
    "A compact document-level digest that incorporates this chunk and preserves prior cross-chunk context.",
    "Keep this digest structured under: Summary, RPG Objects, Scene/State Notes, Claims, Evidence, Contradictions, Open Questions, Cross-Chunk Relations.",
    "",
    // 稳定的项目上下文（背景）
    "Stable project context follows. It changes rarely and should be treated as background:",
    purpose ? `## Wiki Purpose\n${purpose}` : "",
    schema ? `## Wiki Schema\n${schema}` : "",
    index ? `## Current Wiki Index\n${trimLongText(index, 40_000)}` : "",
  ].filter(Boolean).join("\n")
}

export function buildChunkAnalysisUserPrompt(
  sourceIdentity: string,
  folderContext: string | undefined,
  chunk: SourceChunk,
  globalDigest: string,
): string {
  return [
    `Source file: ${sourceIdentity}`,
    folderContext ? `Folder context: ${folderContext}` : "",
    `Chunk: ${chunk.index}/${chunk.total}`,
    chunk.headingPath ? `Heading path: ${chunk.headingPath}` : "",
    "",
    // 当前全局摘要
    "## Current Global Digest",
    globalDigest || "(No prior digest yet.)",
    "",
    // 前一块的重叠上下文
    chunk.overlapBefore ? "## Previous Overlap Context\n" + chunk.overlapBefore : "",
    "",
    // 要分析的主块
    "## MAIN CHUNK TO ANALYZE",
    chunk.main,
    "",
    // 只返回三个请求的部分，不要重复仅出现在重叠中的事实
    "Return only the three requested sections: ## Chunk Analysis, ## RP Runtime Signals JSON, and ## Updated Global Digest. Do not repeat overlap-only facts unless the main chunk supports them.",
  ].filter(Boolean).join("\n")
}

function trimLongText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trimEnd()}\n\n[...trimmed for prompt budget...]`
}

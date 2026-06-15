export interface DomainGuidanceInput {
  schema: string
  purpose: string
  sourceFileName: string
  sourceContent: string
}

// 用途：根据当前来源、schema 和文件名识别是否需要注入特定领域的补充提示。
// 原因：某些作品集会有固定世界观术语；单靠通用 RPG 规则容易把路线、结局或设定误写成统一当前态。
export function buildDomainSpecificGuidance(input: DomainGuidanceInput): string {
  const text = [
    input.schema,
    input.purpose,
    input.sourceFileName,
    input.sourceContent.slice(0, 4000),
  ].join("\n")

  if (!looksLikeFsnDomain(text)) return ""

  return [
    "## Domain-Specific Guidance",
    "Detected Fate/stay night style source markers. Apply this only as source/domain guidance; it is not part of the generic RPG contract.",
    "- Keep route-specific, ending-specific, and epilogue states separate instead of merging them into one universal present state.",
    "- Treat Holy Grail War material as setting or plot structure unless the source describes a discrete happened event.",
    "- Domain scene summaries, route material, ending material, and epilogue material must stay in source-ingest allowed targets such as events, plot-arcs, locations, characters, relationships, or sources.",
    "- Live current-scene belongs to campaign_setup_import or runtime_update_apply and should be REVIEW in ordinary Source Ingest.",
    // 领域专属提示
    // 检测到 Fate/stay night 风格的来源标记。这里只能把它当作来源/领域提示使用；它不属于通用 RPG 合约的一部分。
    // 请将路线专属、结局专属和尾声状态分开处理，不要把它们合并成一个通用的“当前状态”。
    // 除非来源明确描述的是一个已经发生的离散事件，否则请把圣杯战争相关内容视为设定或剧情结构。
    // 领域场景摘要、路线、结局和尾声材料必须停留在普通 source-ingest 允许的目标中。
    // 实时 current-scene 属于 campaign_setup_import 或 runtime_update_apply；普通 Source Ingest 中应进入 REVIEW。
  ].join("\n")
}

// 用途：检测文本里是否出现 Fate/stay night 相关标记。
// 原因：只有在确认相关领域后才注入额外提示，避免把无关项目也套上不必要的约束。
function looksLikeFsnDomain(text: string): boolean {
  return /\b(Fate\/stay night|Fate|UBW|HF|Fuyuki|Holy Grail|Heaven's Feel)\b/i.test(text)
}

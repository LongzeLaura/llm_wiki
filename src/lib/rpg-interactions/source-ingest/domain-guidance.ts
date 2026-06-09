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
    "- A live current-scene page still requires explicit RPG session/current-scene framing; domain scene summaries alone are not enough.",
    // 领域专属提示
    // 检测到 Fate/stay night 风格的来源标记。这里只能把它当作来源/领域提示使用；它不属于通用 RPG 合约的一部分。
    // 请将路线专属、结局专属和尾声状态分开处理，不要把它们合并成一个通用的“当前状态”。
    // 除非来源明确描述的是一个已经发生的离散事件，否则请把圣杯战争相关内容视为设定或剧情结构。
    // 现场的 current-scene 页面仍然需要明确的 RPG session/current-scene 语境；仅有领域内的场景摘要是不够的。
  ].join("\n")
}

// 用途：检测文本里是否出现 Fate/stay night 相关标记。
// 原因：只有在确认相关领域后才注入额外提示，避免把无关项目也套上不必要的约束。
function looksLikeFsnDomain(text: string): boolean {
  return /\b(Fate\/stay night|Fate|UBW|HF|Fuyuki|Holy Grail|Heaven's Feel)\b/i.test(text)
}

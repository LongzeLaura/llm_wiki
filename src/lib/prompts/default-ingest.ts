import {
  buildFrontmatterRules,
  buildOutputFormatRules,
  buildReviewBlockRules,
  buildSourceFileSection,
  promptLanguageRule,
  sourceSummaryPathFor,
} from "@/lib/prompts/shared-ingest"

// 用途：生成通用分析提示词，引导模型先把来源材料整理成结构化研究结论。
// 原因：默认入口需要一套不依赖特定领域的分析模板，供后续生成阶段稳定复用。
export function buildDefaultAnalysisPrompt(
  purpose: string,
  index: string,
  sourceContent: string = "",
): string {
  return [
    "You are an expert research analyst. Read the source document and produce a structured analysis.",
    "Do not output chain-of-thought, hidden reasoning, or a thinking transcript. Reason internally and write only the concise final analysis.",
    // 你是一名专家研究分析师。请阅读源文档并输出结构化分析。
    // 不要输出思维链、隐藏推理或思考过程。请在内部完成推理，只写简洁的最终分析。
    "",
    promptLanguageRule(sourceContent),
    "",
    "Your analysis should cover:",
    // 你的分析应覆盖：
    "",
    "## Key Entities",
    // ## 关键实体
    "List people, organizations, products, datasets, tools mentioned. For each:",
    // 列出文中提到的人物、组织、产品、数据集、工具。每一项请说明：
    "- Name and type",
    // - 名称和类型
    "- Role in the source (central vs. peripheral)",
    // - 在来源中的角色（核心或边缘）
    "- Whether it likely already exists in the wiki (check the index)",
    // - 是否很可能已经存在于 wiki 中（请检查索引）
    "",
    "## Key Concepts",
    // ## 关键概念
    "List theories, methods, techniques, phenomena. For each:",
    // 列出理论、方法、技术、现象。每一项请说明：
    "- Name and brief definition",
    // - 名称和简要定义
    "- Why it matters in this source",
    // - 它为什么在本来源中重要
    "- Whether it likely already exists in the wiki",
    // - 是否很可能已经存在于 wiki 中
    "",
    "## Main Arguments & Findings",
    // ## 主要论点与发现
    "- What are the core claims or results?",
    // - 核心主张或结果是什么？
    "- What evidence supports them?",
    // - 有哪些证据支持它们？
    "- How strong is the evidence?",
    // - 证据强度如何？
    "",
    "## Connections to Existing Wiki",
    // ## 与现有 Wiki 的关联
    "- What existing pages does this source relate to?",
    // - 这个来源与哪些现有页面相关？
    "- Does it strengthen, challenge, or extend existing knowledge?",
    // - 它是在强化、挑战还是扩展现有知识？
    "",
    "## Contradictions & Tensions",
    // ## 矛盾与张力
    "- Does anything in this source conflict with existing wiki content?",
    // - 这个来源是否与现有 wiki 内容存在冲突？
    "- Are there internal tensions or caveats?",
    // - 是否存在内部矛盾或需要保留的限制条件？
    "",
    "## Recommendations",
    // ## 建议
    "- What wiki pages should be created or updated?",
    // - 应该创建或更新哪些 wiki 页面？
    "- What should be emphasized vs. de-emphasized?",
    // - 哪些内容应强调，哪些应弱化？
    "- Any open questions worth flagging for the user?",
    // - 是否有值得提醒用户的开放问题？
    "",
    "Be thorough but concise. Focus on what's genuinely important.",
    // 请做到全面但简洁，重点放在真正重要的内容上。
    "",
    "If a folder context is provided, use it as a hint for categorization -- the folder structure often reflects the user's organizational intent (e.g., 'papers/energy' suggests the file is an energy-related paper).",
    // 如果提供了文件夹上下文，请将其作为分类线索使用，因为文件夹结构通常反映用户的组织意图（例如 'papers/energy' 表示该文件可能是能源相关论文）。
    "",
    purpose ? `## Wiki Purpose (for context)\n${purpose}` : "",
    // Wiki 目标（上下文）
    index ? `## Current Wiki Index (for checking existing content)\n${index}` : "",
  ].filter(Boolean).join("\n")
}

// 用途：根据分析结果生成默认的 wiki 文件输出提示词，驱动真正的写入阶段。
// 原因：生成阶段必须复用统一的路由、frontmatter、输出格式规则，才能保证 parser 稳定解析。
// Schema source: ingest reads the active project's root `schema.md` and passes
// that content through this parameter. New projects seed `schema.md` from
// `getProjectModeBootstrap()` for llmWikiRPG mode, or from `getTemplate().schema`
// for legacy/default template projects.
export function buildDefaultGenerationPrompt(
  schema: string,
  purpose: string,
  index: string,
  sourceFileName: string,
  overview?: string,
  sourceContent: string = "",
  sourceSummaryPath?: string,
): string {
  const summaryPath = sourceSummaryPathFor(sourceFileName, sourceSummaryPath)

  return [
    "You are a wiki maintainer. Based on the analysis provided, generate wiki files.",
    "Do not output chain-of-thought, hidden reasoning, or explanatory preamble. Reason internally and output only the requested FILE/REVIEW blocks.",
    // 你是一名 wiki 维护者。请基于提供的分析生成 wiki 文件。
    // 不要输出思维链、隐藏推理或解释性前言。请在内部完成推理，只输出要求的 FILE/REVIEW 块。
    "",
    promptLanguageRule(sourceContent),
    "",
    buildSourceFileSection(sourceFileName),
    "",
    schema
      ? [
          "## Project Schema and Routing (AUTHORITATIVE)",
          schema,
          "",
          "Use this schema as the primary routing rule for page types and directories.",
          "If it defines custom folders or distinctions (for example people, technologies, organizations, methods, or cases), write pages into those schema-defined folders instead of forcing them into wiki/entities/ or wiki/concepts/.",
          "Use wiki/entities/ and wiki/concepts/ only when the schema does not provide a more specific destination.",
          // 项目 Schema 与路由（权威规则）
          // 请将此 schema 作为页面类型与目录路由的首要规则。
          // 如果它定义了自定义文件夹或分类差异（例如人物、技术、组织、方法或案例），请优先写入这些 schema 指定的文件夹，而不是强行放进 wiki/entities/ 或 wiki/concepts/。
          // 只有在 schema 没有提供更具体的目标位置时，才使用 wiki/entities/ 和 wiki/concepts/。
        ].join("\n")
      : "",
    "",
    "## What to generate",
    // ## 需要生成的内容
    "",
    `1. A source summary page at **${summaryPath}** (MUST use this exact path)`,
    // 1. 在 **${summaryPath}** 处生成来源摘要页（必须使用这个精确路径）
    "2. Entity or schema-defined typed pages for key named things identified in the analysis. Prefer schema-defined directories when present; otherwise use wiki/entities/.",
    // 2. 为分析中识别出的关键命名对象生成实体页或 schema 定义的类型页。若存在 schema 定义的目录，则优先使用；否则使用 wiki/entities/。
    "3. Concept or schema-defined typed pages for key ideas, methods, techniques, and abstractions. Prefer schema-defined directories when present; otherwise use wiki/concepts/.",
    // 3. 为关键想法、方法、技术和抽象概念生成概念页或 schema 定义的类型页。若存在 schema 定义的目录，则优先使用；否则使用 wiki/concepts/。
    "4. An updated wiki/index.md -- add new entries to existing categories, preserve all existing entries",
    // 4. 更新 wiki/index.md -- 向已有分类中添加新条目，并保留所有已有条目
    "5. A log entry for wiki/log.md (just the new entry to append, format: ## [YYYY-MM-DD] ingest | Title)",
    // 5. 为 wiki/log.md 追加一条日志（只输出要追加的新条目，格式为：## [YYYY-MM-DD] ingest | Title）
    "6. An updated wiki/overview.md -- a high-level summary of what the entire wiki covers, updated to reflect the newly ingested source. This should be a comprehensive 2-5 paragraph overview of ALL topics in the wiki, not just the new source.",
    // 6. 更新 wiki/overview.md -- 生成对整个 wiki 覆盖内容的高层摘要，并根据新导入的来源进行更新。这里应是覆盖 wiki 全部主题的 2-5 段综合概览，而不只是新来源。
    "",
    buildFrontmatterRules(sourceFileName),
    "",
    buildReviewBlockRules(),
    "",
    purpose ? `## Wiki Purpose (for context)\n${purpose}` : "",
    // Wiki 目标（上下文）
    index ? `## Current Wiki Index (preserve all existing entries, add new ones)\n${index}` : "",
    // 当前 Wiki 索引（保留所有已有条目，并补充新增条目）
    overview ? `## Current Overview (update this to reflect the new source)\n${overview}` : "",
    // 当前概览（请更新以反映新来源）
    "",
    buildOutputFormatRules(sourceContent),
  ].filter(Boolean).join("\n")
}

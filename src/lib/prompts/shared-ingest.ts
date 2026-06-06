import { buildLanguageDirective } from "@/lib/output-language"
import { GENERATION_WIKI_TYPES } from "@/lib/wiki-page-types"

// 用途：根据来源内容生成输出语言规则，统一控制后续 prompt 的语言约束。
// 原因：不同来源可能需要不同输出语言，单独封装能避免各个 prompt 重复拼接相同逻辑。
export function promptLanguageRule(sourceContent: string = ""): string {
  return buildLanguageDirective(sourceContent)
}

// 用途：根据源文件名计算默认的 source summary 路径。
// 原因：生成阶段需要一个稳定、可预测的摘要页落点，方便路由和索引维护。
export function sourceSummaryPathFor(sourceFileName: string, sourceSummaryPath?: string): string {
  const sourceBaseName = sourceFileName.replace(/\.[^.]+$/, "")
  return sourceSummaryPath ?? `wiki/sources/${sourceBaseName}.md`
}

// 用途：把“来源文件”信息注入 prompt。
// 原因：所有生成出来的 wiki 页面都必须在 frontmatter 里记录来源文件名，方便追溯与增量更新。
export function buildSourceFileSection(sourceFileName: string): string {
  return [
    "## IMPORTANT: Source File",
    `The original source file is: **${sourceFileName}**`,
    `All wiki pages generated from this source MUST include this filename in their frontmatter \`sources\` field.`,
    // 重要：来源文件
    // 原始来源文件是：**${sourceFileName}**
    // 所有从该来源生成的 wiki 页面都必须在 frontmatter 的 `sources` 字段中包含这个文件名。
  ].join("\n")
}

// 用途：提供严格的 frontmatter 规则给生成模型。
// 原因：解析器对 YAML 结构很严格，若 frontmatter 不稳定，后续文件就无法被系统正确读取。
export function buildFrontmatterRules(sourceFileName: string): string {
  return [
    "## Frontmatter Rules (CRITICAL -- parser is strict)",
    "",
    "Every page begins with a YAML frontmatter block. Format rules, in order of importance:",
    "",
    "1. The VERY FIRST line of the file MUST be exactly `---` (three hyphens, nothing else).",
    "   Do NOT wrap the file in a ```yaml ... ``` code fence.",
    "   Do NOT prefix it with a `frontmatter:` key or any other line.",
    "2. Each frontmatter line is a `key: value` pair on its own line.",
    "3. The frontmatter ends with another `---` line on its own.",
    "4. The next line after the closing `---` is the start of the page body.",
    "5. Arrays use the standard YAML inline form `[a, b, c]` (no outer brackets around each item).",
    "   Wikilinks belong in the BODY only -- never write `related: [[a]], [[b]]` (invalid YAML);",
    "   write `related: [a, b]` with bare slugs.",
    // Frontmatter 规则（关键 -- 解析器很严格）
    // 每个页面都以 YAML frontmatter 块开头。以下是按重要性排序的格式规则：
    // 1. 文件的第一行必须恰好是 `---`（三个连字符，不能有其他内容）。
    //    不要把整个文件包在 ```yaml ... ``` 代码块里。
    //    不要在前面加 `frontmatter:` 键或任何其他行。
    // 2. frontmatter 的每一行都必须是单独一行的 `key: value`。
    // 3. frontmatter 结束时必须再写一行单独的 `---`。
    // 4. 关闭 `---` 后的下一行就是页面正文的开始。
    // 5. 数组必须使用标准 YAML 内联形式 `[a, b, c]`（不要给每个 item 再套外层括号）。
    //    Wikilink 只能写在正文中 -- 绝不要写成 `related: [[a]], [[b]]`（这是无效 YAML）；
    //    应写成 `related: [a, b]`，使用裸 slug。
    "",
    "Required fields and types:",
    `  - type     - one of the known types (${GENERATION_WIKI_TYPES.join(" | ")}), or a custom type explicitly defined by the project schema`,
    "  - title    - string (quote it if it contains a colon, e.g. `title: \"Foo: Bar\"`)",
    "  - created  - date in YYYY-MM-DD form (no quotes)",
    "  - updated  - same as created",
    "  - tags     - array of bare strings: `tags: [microbiology, ai]`",
    "  - related  - array of bare wiki page slugs: `related: [foo, bar-baz]`. Do NOT include",
    "               `wiki/`, `.md`, or `[[...]]` here -- slugs only.",
    `  - sources  - array of source filenames; MUST include "${sourceFileName}".`,
    // 必填字段与类型：
    //   - type     - 已知类型之一（${GENERATION_WIKI_TYPES.join(" | ")}），或项目 schema 明确定义的自定义类型
    //   - title    - 字符串（如果包含冒号，请加引号，例如 `title: "Foo: Bar"`）
    //   - created  - YYYY-MM-DD 格式日期（不要加引号）
    //   - updated  - 同 created
    //   - tags     - 裸字符串数组：`tags: [microbiology, ai]`
    //   - related  - 裸 wiki 页面 slug 数组：`related: [foo, bar-baz]`。不要包含
    //                `wiki/`、`.md` 或 `[[...]]`，这里只能是 slug。
    //   - sources  - 来源文件名数组；必须包含 "${sourceFileName}"。
    "",
    "Concrete example of a complete, parseable page:",
    // 完整、可解析页面的具体示例：
    "",
    "    ---",
    "    type: characters",
    "    title: Example Character",
    "    created: 2026-04-29",
    "    updated: 2026-04-29",
    "    tags: [example, demo]",
    "    related: [related-slug-1, related-slug-2]",
    `    sources: ["${sourceFileName}"]`,
    "    ---",
    "",
    "    # Example Character",
    "",
    "    Body content goes here. Use [[wikilink]] syntax in the body for cross-references.",
    // 正文内容写在这里。请在正文中使用 [[wikilink]] 语法进行交叉引用。
    "",
    "Other rules:",
    "- Use [[wikilink]] syntax in the BODY for cross-references between pages.",
    "- If you include images, use wiki-root-relative paths such as `media/source-slug/image.png`; never output absolute filesystem paths.",
    "- Use kebab-case filenames.",
    "- Follow the analysis recommendations on what to emphasize.",
    "- If the analysis found connections to existing pages, add cross-references.",
    // 其他规则：
    // - 在正文中使用 [[wikilink]] 语法进行页面间交叉引用。
    // - 如果包含图片，请使用相对于 wiki 根目录的路径，例如 `media/source-slug/image.png`；绝不要输出绝对文件系统路径。
    // - 文件名使用 kebab-case。
    // - 按照分析建议决定重点强调哪些内容。
    // - 如果分析发现与现有页面有关联，请添加交叉引用。
  ].join("\n")
}

// 用途：告诉生成模型哪些 REVIEW 类型可用，以及什么时候应该把问题交给用户判断。
// 原因：有些冲突、重复和缺页问题不适合自动拍板，必须保留给人工确认。
export function buildReviewBlockRules(): string {
  return [
    "## Review block types",
    "",
    "After all FILE blocks, optionally emit REVIEW blocks for anything that needs human judgment:",
    "",
    "- contradiction: the analysis found conflicts with existing wiki content",
    "- duplicate: an RPG page might already exist under a different name in the index",
    "- missing-page: an important character, location, faction, item, event, relationship, world fact, or plot arc is referenced but still lacks a dedicated page",
    "- suggestion: ideas for further RPG source review, relationship/tension derivation, related sources to look for, or connections worth exploring",
    // REVIEW 块类型
    // 在所有 FILE 块之后，可以按需输出 REVIEW 块，用于需要人工判断的事项：
    // - contradiction：分析发现与现有 wiki 内容存在冲突
    // - duplicate：某个实体/概念可能已经以不同名称存在于索引中
    // - missing-page：某个重要概念被提到了，但还没有专门页面
    // - suggestion：进一步研究的想法、值得寻找的相关来源，或值得探索的关联
    "",
    "Only create reviews for things that genuinely need human input. Don't create trivial reviews.",
    // 只有在真正需要人工介入时才创建 review。不要为琐碎内容创建 review。
    "",
    "## OPTIONS allowed values (only these predefined labels):",
    "",
    "- contradiction: OPTIONS: Create Page | Skip",
    "- duplicate: OPTIONS: Create Page | Skip",
    "- missing-page: OPTIONS: Create Page | Skip",
    "- suggestion: OPTIONS: Create Page | Skip",
    // ## OPTIONS 允许值（只能使用这些预定义标签）：
    // - contradiction: OPTIONS: Create Page | Skip
    // - duplicate: OPTIONS: Create Page | Skip
    // - missing-page: OPTIONS: Create Page | Skip
    // - suggestion: OPTIONS: Create Page | Skip
    "",
    "The user also has a 'Deep Research' button (auto-added by the system) that triggers web search.",
    "Do NOT invent custom option labels. Only use 'Create Page' and 'Skip'.",
    // 用户还会看到一个由系统自动添加的 'Deep Research' 按钮，它会触发网页搜索。
    // 不要自创选项标签。只能使用 'Create Page' 和 'Skip'。
    "",
    "For suggestion and missing-page reviews, the SEARCH field must contain 2-3 web search queries",
    "(keyword-rich, specific, suitable for a search engine --NOT titles or sentences). Example:",
    // 对于 suggestion 和 missing-page review，SEARCH 字段必须包含 2-3 条网页搜索查询
    // （应包含关键词、具体且适合搜索引擎的查询词 -- 不是标题或完整句子）。示例：
    "  SEARCH: automated technical debt detection AI generated code | software quality metrics LLM code generation | static analysis tools agentic software development",
  ].join("\n")
}

// 用途：定义 FILE/REVIEW 的最终输出格式，确保解析器能稳定拆分结果。
// 原因：生成模型容易多写前言或格式漂移，所以需要明确到字符级的输出模板。
export function buildOutputFormatRules(sourceContent: string): string {
  return [
    "## Output Format (MUST FOLLOW EXACTLY -- this is how the parser reads your response)",
    "",
    "Your ENTIRE response consists of FILE blocks followed by optional REVIEW blocks. Nothing else.",
    "",
    "FILE block template:",
    "```",
    "---FILE: wiki/path/to/page.md---",
    "(complete file content with YAML frontmatter)",
    "---END FILE---",
    "```",
    "",
    "REVIEW block template (optional, after all FILE blocks):",
    "```",
    "---REVIEW: type | Title---",
    "Description of what needs the user's attention.",
    "OPTIONS: Create Page | Skip",
    "PAGES: wiki/page1.md, wiki/page2.md",
    "SEARCH: query 1 | query 2 | query 3",
    "---END REVIEW---",
    "```",
    "",
    "## Output Requirements (STRICT -- deviations will cause parse failure)",
    "",
    "1. The FIRST character of your response MUST be `-` (the opening of `---FILE:`).",
    "2. DO NOT output any preamble such as \"Here are the files:\", \"Based on the analysis...\", or any introductory prose.",
    "3. DO NOT echo or restate the analysis -- that was stage 1's job. Your job is to emit FILE blocks.",
    "4. DO NOT output markdown tables, bullet lists, or headings outside of FILE/REVIEW blocks.",
    "5. DO NOT output any trailing commentary after the last `---END FILE---` or `---END REVIEW---`.",
    "6. Between blocks, use only blank lines -- no prose.",
    "7. EVERY FILE block's content (titles, body, descriptions) MUST be in the mandatory output language specified below.",
    "",
    "If you start with anything other than `---FILE:`, the entire response will be discarded.",
    "",
    "---",
    "",
    // ## 输出格式（必须严格遵守 -- 解析器就是这样读取你的回复的）
    // 你的整段回复只能由 FILE 块组成，后面可跟可选的 REVIEW 块。除此之外不要输出任何内容。
    // FILE 块模板：
    // REVIEW 块模板（可选，放在所有 FILE 块之后）：
    // ## 输出要求（严格 -- 偏离将导致解析失败）
    // 1. 你的回复第一个字符必须是 `-`（即 `---FILE:` 的开头）。
    // 2. 不要输出任何前言，例如 "Here are the files:", "Based on the analysis..."，也不要写任何引导性文字。
    // 3. 不要重复或复述分析内容 -- 那是第一阶段的工作。你的工作是输出 FILE 块。
    // 4. 不要在 FILE/REVIEW 块之外输出 markdown 表格、项目列表或标题。
    // 5. 在最后一个 `---END FILE---` 或 `---END REVIEW---` 之后，不要再输出任何尾随说明。
    // 6. 块与块之间只能使用空行 -- 不要写说明文字。
    // 7. 每个 FILE 块的内容（标题、正文、描述）都必须使用下面指定的必需输出语言。
    // 如果你不是以 `---FILE:` 开头，整段回复都会被丢弃。
    promptLanguageRule(sourceContent),
  ].join("\n")
}

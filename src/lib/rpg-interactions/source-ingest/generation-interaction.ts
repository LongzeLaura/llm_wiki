import {
  buildFrontmatterRules,
  buildOutputFormatRules,
  buildReviewBlockRules,
  buildSourceFileSection,
  promptLanguageRule,
  sourceSummaryPathFor,
} from "./shared-ingest-contract"
import { buildDomainSpecificGuidance } from "./domain-guidance"
import {
  buildFocusedRpgPageGuidance,
  buildMinimalRpgGenerationContract,
} from "./page-guidance-contract"
import type { RpgInteractionSpec } from "../interaction-spec"

export interface BuildSourceIngestGenerationInteractionInput {
  schema: string
  purpose: string
  index: string
  sourceIdentity: string
  overview?: string
  sourceContent?: string
  sourceSummaryPath?: string
  stage1Analysis?: string
}

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

export const sourceIngestGenerationInteractionSpec: RpgInteractionSpec<
  BuildSourceIngestGenerationInteractionInput,
  string
> = {
  kind: "source_ingest_generation",
  buildPrompt(input) {
    const sourceContent = input.sourceContent ?? ""

    return {
      systemPrompt: buildRpgGenerationPrompt(
        input.schema,
        input.purpose,
        input.index,
        input.sourceIdentity,
        input.overview,
        sourceContent,
        input.sourceSummaryPath,
        input.stage1Analysis,
      ),
      userPrompt: [
        `Source document to process: **${input.sourceIdentity}**`,
        "",
        "The Stage 1 analysis below is CONTEXT to inform your output. Do NOT echo",
        "its tables, bullet points, or prose. Your output must be FILE/REVIEW",
        "blocks as specified in the system prompt -- nothing else.",
        "",
        "## Stage 1 Analysis (context only -- do not repeat)",
        "",
        input.stage1Analysis ?? "",
        "",
        "## Source Context",
        "",
        sourceContent,
        "",
        "---",
        "",
        `Now emit the FILE blocks for the wiki files derived from **${input.sourceIdentity}**.`,
        "Your response MUST begin with `---FILE:` as the very first characters.",
        "No preamble. No analysis prose. Start immediately.",
      ].join("\n"),
    }
  },
  parseOutput(output) {
    return output
  },
}

import type { RpgInteractionPrompt } from "../interaction-spec"
import type { SoftSemanticJsonParseReport } from "./soft-semantic-json"

export interface SoftSemanticRepairRetryErrorSummary {
  phase?: string
  origin?: string
  kind?: string
  category?: string
  message: string
  name?: string
}

export interface BuildSoftSemanticRepairRetryPromptInput {
  stageKind: string
  stageLabel: string
  failedOutput: string
  errorSummary: SoftSemanticRepairRetryErrorSummary
  draftSchemaLines: readonly string[]
  safetyInstructionLines?: readonly string[]
  jsonParseReport?: SoftSemanticJsonParseReport
  maxFailedOutputChars?: number
}

export interface SoftSemanticRepairRetryPromptSummary {
  stageKind: string
  originalOutputChars: number
  includedOutputChars: number
  promptChars: number
  maxFailedOutputChars: number
  truncated: boolean
}

export interface SoftSemanticRepairRetryPromptResult {
  prompt: RpgInteractionPrompt
  summary: SoftSemanticRepairRetryPromptSummary
}

export const DEFAULT_SOFT_SEMANTIC_REPAIR_RETRY_MAX_FAILED_OUTPUT_CHARS = 12000

export function buildSoftSemanticRepairRetryPrompt(
  input: BuildSoftSemanticRepairRetryPromptInput,
): SoftSemanticRepairRetryPromptResult {
  const maxFailedOutputChars = Math.max(
    1000,
    input.maxFailedOutputChars ?? DEFAULT_SOFT_SEMANTIC_REPAIR_RETRY_MAX_FAILED_OUTPUT_CHARS,
  )
  const truncatedOutput = truncateMiddle(input.failedOutput, maxFailedOutputChars)
  const summary: SoftSemanticRepairRetryPromptSummary = {
    stageKind: input.stageKind,
    originalOutputChars: input.failedOutput.length,
    includedOutputChars: truncatedOutput.text.length,
    promptChars: 0,
    maxFailedOutputChars,
    truncated: truncatedOutput.truncated,
  }

  const systemPrompt = [
    "You repair one llmWikiRPG soft semantic draft JSON output.",
    "Return only the corrected strict JSON object. Do not wrap it in markdown.",
    "Do not use any runtime context beyond the failed model output shown in this repair request.",
    "Do not change semantic enum values unless the failed output already clearly contains the exact allowed value with only JSON syntax damage.",
    "If a value is unknown from the failed output, preserve the existing value rather than inventing new facts.",
    ...(input.safetyInstructionLines ?? []),
  ].join("\n")

  const userPrompt = [
    `# Repair ${input.stageLabel} JSON`,
    "",
    "Fix only mechanical JSON/schema formatting defects so the same local parser, draft compiler, and canonical validator can run again.",
    "",
    "## Initial Failure",
    "",
    stringifyJson(input.errorSummary),
    "",
    ...(input.jsonParseReport
      ? [
          "## JSON Parse Report",
          "",
          stringifyJson(input.jsonParseReport),
          "",
        ]
      : []),
    "## Failed Model Output",
    "",
    "```text",
    truncatedOutput.text,
    "```",
    "",
    "## Required Draft Schema",
    "",
    input.draftSchemaLines.join("\n"),
    "",
    "Return only the repaired JSON object.",
  ].join("\n")

  summary.promptChars = systemPrompt.length + userPrompt.length

  return {
    prompt: { systemPrompt, userPrompt },
    summary,
  }
}

function truncateMiddle(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false }
  const marker = "\n\n[...truncated failed output...]\n\n"
  const available = Math.max(0, maxChars - marker.length)
  const headChars = Math.ceil(available / 2)
  const tailChars = Math.floor(available / 2)
  return {
    text: `${text.slice(0, headChars)}${marker}${text.slice(text.length - tailChars)}`,
    truncated: true,
  }
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

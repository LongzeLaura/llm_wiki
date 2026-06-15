import type {
  RpgRuntimeDebugErrorCategory,
  RpgRuntimeDebugErrorKind,
  RpgRuntimeDebugErrorOrigin,
  RpgRuntimeDebugErrorPhase,
} from "../../rpg-runtime/debug-trace"

export type SoftSemanticJsonRepairOperation =
  | "removed_markdown_fence"
  | "trimmed_surrounding_text"
  | "removed_trailing_commas"
  | "normalized_smart_quote_delimiters"
  | "escaped_raw_newlines_in_strings"

export interface SoftSemanticJsonParseReport {
  originalLength: number
  extractedLength: number
  repairedLength: number
  operations: SoftSemanticJsonRepairOperation[]
  changed: boolean
  parseSucceeded: boolean
  parseErrorMessage?: string
  failureKind?: "json_extract_failed" | "malformed_json"
}

export interface ParseSoftSemanticJsonOutputOptions {
  label?: string
}

export class SoftSemanticJsonParseError extends Error {
  readonly report: SoftSemanticJsonParseReport
  readonly phase: RpgRuntimeDebugErrorPhase
  readonly origin: RpgRuntimeDebugErrorOrigin
  readonly kind: RpgRuntimeDebugErrorKind
  readonly category: RpgRuntimeDebugErrorCategory

  constructor(message: string, report: SoftSemanticJsonParseReport) {
    super(message)
    this.name = "SoftSemanticJsonParseError"
    this.report = report
    this.phase = "parse"
    this.kind = report.failureKind ?? "malformed_json"
    this.origin = this.kind === "json_extract_failed" ? "json_extract" : "json_parse"
    this.category = "mechanical_format"
  }
}

export function parseSoftSemanticJsonOutput(
  output: string,
  options: ParseSoftSemanticJsonOutputOptions = {},
): { parsed: unknown; jsonText: string; report: SoftSemanticJsonParseReport } {
  const originalLength = output.length
  const operations: SoftSemanticJsonRepairOperation[] = []
  const extracted = extractJsonObjectCandidate(output, operations)
  if (!extracted) {
    const report: SoftSemanticJsonParseReport = {
      originalLength,
      extractedLength: 0,
      repairedLength: 0,
      operations,
      changed: output.trim().length !== output.length,
      parseSucceeded: false,
      failureKind: "json_extract_failed",
      parseErrorMessage: "No JSON object found.",
    }
    throw new SoftSemanticJsonParseError(
      `${options.label ?? "RPG soft semantic"} 交互无法在 LLM 输出中找到 JSON 对象。`,
      report,
    )
  }

  const repaired = repairExtractedJsonText(extracted.text, operations)
  let parsed: unknown
  try {
    parsed = JSON.parse(repaired)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const report: SoftSemanticJsonParseReport = {
      originalLength,
      extractedLength: extracted.text.length,
      repairedLength: repaired.length,
      operations,
      changed: repaired !== output.trim(),
      parseSucceeded: false,
      parseErrorMessage: message,
      failureKind: "malformed_json",
    }
    throw new SoftSemanticJsonParseError(
      `${options.label ?? "RPG soft semantic"} 交互解析 JSON 失败：${message}`,
      report,
    )
  }

  const report: SoftSemanticJsonParseReport = {
    originalLength,
    extractedLength: extracted.text.length,
    repairedLength: repaired.length,
    operations,
    changed: repaired !== output.trim(),
    parseSucceeded: true,
  }
  return { parsed, jsonText: repaired, report }
}

function extractJsonObjectCandidate(
  output: string,
  operations: SoftSemanticJsonRepairOperation[],
): { text: string } | null {
  const fenced = extractFencedJsonCandidate(output)
  if (fenced !== null) {
    pushUniqueOperation(operations, "removed_markdown_fence")
    const fencedObject = findFirstBalancedJsonObject(fenced)
    if (fencedObject !== null) {
      if (fencedObject.trim() !== output.trim()) pushUniqueOperation(operations, "trimmed_surrounding_text")
      return { text: fencedObject }
    }
  }

  const object = findFirstBalancedJsonObject(output)
  if (object === null) return null
  if (object.trim() !== output.trim()) pushUniqueOperation(operations, "trimmed_surrounding_text")
  return { text: object }
}

function repairExtractedJsonText(
  text: string,
  operations: SoftSemanticJsonRepairOperation[],
): string {
  let repaired = text.trim()
  const withoutTrailingCommas = removeTrailingCommas(repaired)
  if (withoutTrailingCommas !== repaired) {
    repaired = withoutTrailingCommas
    pushUniqueOperation(operations, "removed_trailing_commas")
  }

  const smartQuoteNormalized = normalizeSmartQuoteDelimiters(repaired)
  if (smartQuoteNormalized !== repaired) {
    repaired = smartQuoteNormalized
    pushUniqueOperation(operations, "normalized_smart_quote_delimiters")
  }

  const withoutRawNewlines = escapeRawNewlinesInStrings(repaired)
  if (withoutRawNewlines !== repaired) {
    repaired = withoutRawNewlines
    pushUniqueOperation(operations, "escaped_raw_newlines_in_strings")
  }

  return repaired
}

function extractFencedJsonCandidate(output: string): string | null {
  const jsonFence = /```json\s*([\s\S]*?)```/i.exec(output)
  if (jsonFence) return jsonFence[1]

  const genericFence = /```\s*([\s\S]*?)```/.exec(output)
  return genericFence?.[1] ?? null
}

function findFirstBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{")
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === "\\") {
        escaped = true
      } else if (char === "\"") {
        inString = false
      }
      continue
    }

    if (char === "\"") {
      inString = true
      continue
    }

    if (char === "{") {
      depth += 1
    } else if (char === "}") {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1).trim()
    }
  }

  return null
}

function removeTrailingCommas(text: string): string {
  let result = ""
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      result += char
      if (escaped) {
        escaped = false
      } else if (char === "\\") {
        escaped = true
      } else if (char === "\"") {
        inString = false
      }
      continue
    }

    if (char === "\"") {
      inString = true
      result += char
      continue
    }

    if (char === ",") {
      const next = nextNonWhitespace(text, index + 1)
      if (next === "}" || next === "]") continue
    }

    result += char
  }

  return result
}

function normalizeSmartQuoteDelimiters(text: string): string {
  let result = text
  let previous: string
  do {
    previous = result
    result = result
      .replace(/([\{\[,]\s*)[“”‘’]([^“”‘’\r\n]*?)[“”‘’](\s*:)/g, "$1\"$2\"$3")
      .replace(/(:\s*)[“”‘’]([^“”‘’\r\n]*?)[“”‘’](\s*[,}\]])/g, "$1\"$2\"$3")
      .replace(/(\[\s*|,\s*)[“”‘’]([^“”‘’\r\n]*?)[“”‘’](\s*[,}\]])/g, "$1\"$2\"$3")
  } while (result !== previous)
  return result
}

function escapeRawNewlinesInStrings(text: string): string {
  let result = ""
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (!inString) {
      result += char
      if (char === "\"") inString = true
      continue
    }

    if (escaped) {
      result += char
      escaped = false
      continue
    }

    if (char === "\\") {
      result += char
      escaped = true
      continue
    }

    if (char === "\"") {
      result += char
      inString = false
      continue
    }

    if (char === "\r") {
      if (text[index + 1] === "\n") index += 1
      result += "\\n"
      continue
    }

    if (char === "\n") {
      result += "\\n"
      continue
    }

    result += char
  }

  return result
}

function nextNonWhitespace(text: string, start: number): string | undefined {
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (!/\s/.test(char)) return char
  }
  return undefined
}

function pushUniqueOperation(
  operations: SoftSemanticJsonRepairOperation[],
  operation: SoftSemanticJsonRepairOperation,
): void {
  if (!operations.includes(operation)) operations.push(operation)
}

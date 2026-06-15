import { describe, expect, it } from "vitest"
import {
  parseSoftSemanticJsonOutput,
  SoftSemanticJsonParseError,
} from "./rpg-interactions/runtime"

describe("parseSoftSemanticJsonOutput", () => {
  it("extracts fenced JSON", () => {
    const result = parseSoftSemanticJsonOutput(["```json", "{\"ok\":true}", "```"].join("\n"))

    expect(result.parsed).toEqual({ ok: true })
    expect(result.report.operations).toContain("removed_markdown_fence")
    expect(result.report.parseSucceeded).toBe(true)
  })

  it("trims prose before and after the first balanced JSON object", () => {
    const result = parseSoftSemanticJsonOutput("Here is the JSON:\n{\"ok\":true}\nDone.")

    expect(result.parsed).toEqual({ ok: true })
    expect(result.report.operations).toContain("trimmed_surrounding_text")
  })

  it("repairs trailing commas before object and array closers", () => {
    const result = parseSoftSemanticJsonOutput("{\"items\":[1,2,],\"ok\":true,}")

    expect(result.parsed).toEqual({ items: [1, 2], ok: true })
    expect(result.report.operations).toContain("removed_trailing_commas")
  })

  it("normalizes smart quotes only when they act as JSON delimiters", () => {
    const result = parseSoftSemanticJsonOutput("{“label”:“A plain value”,\"note\":\"Keep “inner” smart quotes.\"}")

    expect(result.parsed).toEqual({ label: "A plain value", note: "Keep “inner” smart quotes." })
    expect(result.report.operations).toContain("normalized_smart_quote_delimiters")
  })

  it("escapes raw newline characters inside JSON strings", () => {
    const result = parseSoftSemanticJsonOutput("{\"text\":\"line one\nline two\"}")

    expect(result.parsed).toEqual({ text: "line one\nline two" })
    expect(result.report.operations).toContain("escaped_raw_newlines_in_strings")
  })

  it("keeps missing commas as malformed JSON instead of guessing", () => {
    expect(() => parseSoftSemanticJsonOutput("{\"a\":1 \"b\":2}")).toThrow(SoftSemanticJsonParseError)
    try {
      parseSoftSemanticJsonOutput("{\"a\":1 \"b\":2}")
    } catch (error) {
      expect((error as SoftSemanticJsonParseError).report.failureKind).toBe("malformed_json")
      expect((error as SoftSemanticJsonParseError).report.parseSucceeded).toBe(false)
    }
  })

  it("reports json_extract_failed when no JSON object exists", () => {
    expect(() => parseSoftSemanticJsonOutput("not json")).toThrow(SoftSemanticJsonParseError)
    try {
      parseSoftSemanticJsonOutput("not json")
    } catch (error) {
      expect((error as SoftSemanticJsonParseError).report.failureKind).toBe("json_extract_failed")
      expect((error as SoftSemanticJsonParseError).origin).toBe("json_extract")
    }
  })

  it("does not add missing keys or modify semantic enum values", () => {
    const result = parseSoftSemanticJsonOutput("{\"happenedStatus\":\"happened\"}")

    expect(result.parsed).toEqual({ happenedStatus: "happened" })
    expect(result.report.operations).toEqual([])
  })
})

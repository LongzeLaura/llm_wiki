import type { RpgInteractionSpec } from "../interaction-spec"
import { buildRpgMergeSystemPrompt } from "./merge-policy"

export interface PageMergeInteractionInput {
  existingContent: string
  incomingContent: string
  pagePath: string
  sourceFileName: string
}

export const pageMergeInteractionSpec: RpgInteractionSpec<PageMergeInteractionInput, string> = {
  kind: "page_merge",
  buildPrompt(input) {
    return {
      systemPrompt: buildRpgMergeSystemPrompt(input.pagePath),
      userPrompt: buildPageMergeUserPrompt(input),
    }
  },
  parseOutput(output) {
    return output
  },
}

function buildPageMergeUserPrompt(input: PageMergeInteractionInput): string {
  return [
    `## Existing version on disk`,
    "",
    input.existingContent,
    "",
    "---",
    "",
    `## Newly generated version (from ${input.sourceFileName})`,
    "",
    input.incomingContent,
    "",
    "---",
    "",
    "Now output the merged file. Start with `---` on the first line.",
  ].join("\n")
}

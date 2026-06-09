import type { RpgInteractionSpec } from "../interaction-spec"

export interface BuildControlDocCanonicalizationInteractionInput {
  slotId: string
  targetPath: string
  sourceIdentity: string
  sourceContent: string
}

export const controlDocCanonicalizationInteractionSpec: RpgInteractionSpec<
  BuildControlDocCanonicalizationInteractionInput,
  string
> = {
  kind: "control_doc_canonicalization",
  buildPrompt(input) {
    return {
      systemPrompt: [
        "You canonicalize llmWikiRPG control documents.",
        "Preserve the user's control semantics faithfully.",
        "Do not perform ordinary source ingest, lossy extraction, summarization, or event conversion.",
        "Do not drop hard gates, forbidden terms, {{setvar::...}} blocks, safety boundaries, or explicit user control blocks.",
        "Future outlines and possible futures must stay control guidance, never confirmed history.",
        `Target slot: ${input.slotId}`,
        `Target path: ${input.targetPath}`,
      ].join("\n"),
      userPrompt: [
        `Source identity: ${input.sourceIdentity}`,
        "",
        "Normalize headings and sections only where that preserves meaning.",
        "Return the complete canonical control document body.",
        "",
        "## Source Control Text",
        "",
        input.sourceContent,
      ].join("\n"),
    }
  },
  parseOutput(output) {
    return output
  },
}

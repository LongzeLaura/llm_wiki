export type RpgInteractionKind =
  | "source_ingest_analysis"
  | "source_ingest_generation"
  | "page_merge"
  | "control_doc_canonicalization"
  | "campaign_setup_import_contract"
  | "campaign_setup_generation"
  | "narration"
  | "runtime_state_update"
  | "relationship_derivation"
  | "outline_impact"
  | "outline_regeneration"

export interface RpgInteractionPrompt {
  systemPrompt: string
  userPrompt: string
}

export interface RpgInteractionSpec<TInput, TOutput> {
  kind: RpgInteractionKind
  buildPrompt(input: TInput): RpgInteractionPrompt
  parseOutput(output: string, input: TInput): TOutput
}

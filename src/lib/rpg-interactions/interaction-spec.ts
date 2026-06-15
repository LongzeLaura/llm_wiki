export type RpgInteractionKind =
  | "source_ingest_analysis"
  | "source_ingest_generation"
  | "page_merge"
  | "control_doc_canonicalization"
  | "campaign_setup_import_contract"
  | "campaign_setup_generation"
  | "action_resolver"
  | "world_tick"
  | "recall_selector"
  | "outline_brief"
  | "narration_generator"
  | "runtime_update_proposal"
  | "runtime_state_update"
  | "relationship_derivation"
  | "outline_impact"
  | "outline_regeneration"

export interface RpgInteractionPrompt {
  systemPrompt: string
  userPrompt: string
  debugSections?: RpgPromptDebugSection[]
}

export type RpgPromptDebugSectionSourceKind =
  | "fixed_prompt"
  | "player_input"
  | "wiki_file"
  | "runtime_handoff"
  | "llm_output"
  | "local_input_builder"
  | "local_result"
  | "validation"

export type RpgPromptDebugContentType = "text" | "json" | "markdown"

export interface RpgPromptDebugSection {
  sectionId: string
  title: string
  promptRole: "system" | "user"
  sourceKind: RpgPromptDebugSectionSourceKind
  sourceLabel: string
  contentType: RpgPromptDebugContentType
  content: string
}

export interface RpgInteractionSpec<TInput, TOutput> {
  kind: RpgInteractionKind
  buildPrompt(input: TInput): RpgInteractionPrompt
  parseOutput(output: string, input: TInput): TOutput
}

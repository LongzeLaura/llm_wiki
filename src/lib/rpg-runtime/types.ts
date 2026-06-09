export interface SubmittedAction {
  id: string
  text: string
  source: "selected_option" | "freeform"
  selectedOptionId?: string
}

export interface CompileRpgContextInput {
  projectPath: string
  submittedAction: SubmittedAction
}

export interface RunRpgRuntimePreviewInput {
  projectPath: string
  submittedAction: SubmittedAction
  wikiMode: "llmwikirpg"
}

export interface CompactStoryBrief {
  submittedAction: SubmittedAction
  currentScene: string
  playerState: string
  hardFacts: string[]
  activeConstraints: string[]
  presentCharacters: string[]
  relationshipTensions: string[]
  activePlotPressure: string[]
  outlineNotes: string[]
  activeQuests: string[]
  relevantLocations: string[]
  relevantFactions: string[]
  relevantItems: string[]
  styleRules: string[]
  ruleNotes: string[]
  memoryNotes: string[]
  forbiddenContradictions: string[]
  references: string[]
}

export interface RpgRuntimePreviewResult {
  submittedAction: SubmittedAction
  brief: CompactStoryBrief
  warnings: string[]
}

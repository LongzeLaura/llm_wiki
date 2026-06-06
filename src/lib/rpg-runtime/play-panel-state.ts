import type { RpgActionOption } from "./turn-model"
import type { SubmittedAction } from "./types"

export interface RpgPlayPanelState {
  currentScene: string
  lastNarrative: string
  nextActionOptions: RpgActionOption[]
  freeformActionText: string
  selectedOptionId: string | null
  submittedAction: SubmittedAction | null
}

export interface CreateRpgPlayPanelStateInput {
  currentScene: string
  lastNarrative?: string
  nextActionOptions?: RpgActionOption[]
  freeformActionText?: string
  selectedOptionId?: string | null
  submittedAction?: SubmittedAction | null
}

export interface RpgPlayPanelSemanticBuckets {
  currentScene: string
  completedNarrative: string
  futureCandidateActions: string[]
  submittedAction: SubmittedAction | null
  pendingWikiUpdates: []
}

export function createRpgPlayPanelState(input: CreateRpgPlayPanelStateInput): RpgPlayPanelState {
  return {
    currentScene: input.currentScene,
    lastNarrative: input.lastNarrative ?? "",
    nextActionOptions: input.nextActionOptions ?? [],
    freeformActionText: input.freeformActionText ?? "",
    selectedOptionId: input.selectedOptionId ?? null,
    submittedAction: input.submittedAction ?? null,
  }
}

export function selectRpgPlayPanelOption(state: RpgPlayPanelState, optionId: string): RpgPlayPanelState {
  const option = state.nextActionOptions.find((candidate) => candidate.id === optionId)
  if (!option) return state

  return {
    ...state,
    selectedOptionId: option.id,
  }
}

export function setRpgPlayPanelFreeformText(state: RpgPlayPanelState, text: string): RpgPlayPanelState {
  return {
    ...state,
    freeformActionText: text,
  }
}

export function createSubmittedActionFromOption(option: RpgActionOption, id: string): SubmittedAction {
  return {
    id,
    text: option.playerFacingText,
    source: "selected_option",
    selectedOptionId: option.id,
  }
}

export function createSubmittedActionFromFreeform(text: string, id: string): SubmittedAction | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  return {
    id,
    text: trimmed,
    source: "freeform",
  }
}

export function submitSelectedRpgPlayPanelOption(state: RpgPlayPanelState, actionId: string): RpgPlayPanelState {
  const option = state.nextActionOptions.find((candidate) => candidate.id === state.selectedOptionId)
  if (!option) return state

  return {
    ...state,
    submittedAction: createSubmittedActionFromOption(option, actionId),
  }
}

export function submitRpgPlayPanelFreeformAction(state: RpgPlayPanelState, actionId: string): RpgPlayPanelState {
  const submittedAction = createSubmittedActionFromFreeform(state.freeformActionText, actionId)
  if (!submittedAction) return state

  return {
    ...state,
    selectedOptionId: null,
    submittedAction,
  }
}

export function getRpgPlayPanelSemanticBuckets(state: RpgPlayPanelState): RpgPlayPanelSemanticBuckets {
  return {
    currentScene: state.currentScene,
    completedNarrative: state.lastNarrative,
    futureCandidateActions: state.nextActionOptions.map((option) => option.playerFacingText),
    submittedAction: state.submittedAction,
    pendingWikiUpdates: [],
  }
}

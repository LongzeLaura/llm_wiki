import type { RecallSelection, RecallSelectorInput } from "../../rpg-runtime/types"
import type { RpgRecallSelectorPrompt } from "./recall-selector-interaction"
import { validateRecallSelection } from "./recall-selector-validation"

export interface RpgRecallSelectorAdapter {
  selectRecall(prompt: RpgRecallSelectorPrompt, promptInput: RecallSelectorInput): Promise<RecallSelection>
  selectRecallRawOutput?(prompt: RpgRecallSelectorPrompt, promptInput: RecallSelectorInput): Promise<string>
  repairRecallRawOutput?(prompt: RpgRecallSelectorPrompt, promptInput: RecallSelectorInput): Promise<string>
}

export function createFixtureRecallSelectorAdapter(selection: RecallSelection): RpgRecallSelectorAdapter {
  return {
    async selectRecall(_prompt, promptInput) {
      return validateRecallSelection(selection, promptInput)
    },
  }
}

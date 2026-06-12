import type {
  StoryOutlineRegeneratorInput,
  StoryOutlineRegeneratorOutput,
} from "../../rpg-runtime/types"
import type { RpgStoryOutlineRegeneratorPrompt } from "./story-outline-regenerator-interaction"
import { validateStoryOutlineRegeneratorOutput } from "./story-outline-regenerator-validation"

export interface RpgStoryOutlineRegeneratorAdapter {
  regenerateOutline(
    prompt: RpgStoryOutlineRegeneratorPrompt,
    promptInput: StoryOutlineRegeneratorInput,
  ): Promise<StoryOutlineRegeneratorOutput>
}

export function createFixtureStoryOutlineRegeneratorAdapter(
  output: StoryOutlineRegeneratorOutput,
): RpgStoryOutlineRegeneratorAdapter {
  return {
    async regenerateOutline(_prompt, promptInput) {
      return validateStoryOutlineRegeneratorOutput(output, promptInput)
    },
  }
}

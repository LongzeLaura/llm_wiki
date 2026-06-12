import type { WorldTickInput, WorldTickResult } from "../../rpg-runtime/types"
import type { RpgWorldTickPrompt } from "./world-tick-interaction"

export interface RpgWorldTickAdapter {
  advanceWorldTick(prompt: RpgWorldTickPrompt, promptInput?: WorldTickInput): Promise<WorldTickResult>
}

export function createFixtureWorldTickAdapter(result: WorldTickResult): RpgWorldTickAdapter {
  return {
    async advanceWorldTick() {
      return result
    },
  }
}

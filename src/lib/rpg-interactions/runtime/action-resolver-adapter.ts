import type { ActionResolution, ActionResolverInput } from "../../rpg-runtime/types"
import type { RpgActionResolverPrompt } from "./action-resolver-interaction"

export interface RpgActionResolverAdapter {
  resolveAction(prompt: RpgActionResolverPrompt, promptInput?: ActionResolverInput): Promise<ActionResolution>
}

export function createFixtureActionResolverAdapter(
  actionResolution: ActionResolution,
): RpgActionResolverAdapter {
  return {
    async resolveAction() {
      return actionResolution
    },
  }
}

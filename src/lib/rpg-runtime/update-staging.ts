import type { ProposedWikiUpdate } from "./state-extractor"

export type PendingRpgUpdateStatus = "pending" | "accepted" | "rejected"

export interface PendingRpgUpdate extends ProposedWikiUpdate {
  status: PendingRpgUpdateStatus
}

export function createPendingRpgUpdates(proposedUpdates: ProposedWikiUpdate[]): PendingRpgUpdate[] {
  return proposedUpdates.map((update) => ({
    ...update,
    references: [...update.references],
    status: "pending",
  }))
}

export function acceptPendingRpgUpdate(updates: PendingRpgUpdate[], id: string): PendingRpgUpdate[] {
  return updatePendingRpgUpdateStatus(updates, id, "accepted")
}

export function rejectPendingRpgUpdate(updates: PendingRpgUpdate[], id: string): PendingRpgUpdate[] {
  return updatePendingRpgUpdateStatus(updates, id, "rejected")
}

function updatePendingRpgUpdateStatus(
  updates: PendingRpgUpdate[],
  id: string,
  status: PendingRpgUpdateStatus,
): PendingRpgUpdate[] {
  return updates.map((update) => (update.id === id ? { ...update, status } : update))
}

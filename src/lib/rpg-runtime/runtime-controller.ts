import {
  runtimeUpdateInteractionSpec,
  type RpgNarrationAdapter,
  type RpgRuntimeUpdateInteractionAdapter,
  validateRpgRuntimeUpdateProposals,
  type RpgRuntimeUpdateValidationResult,
} from "../rpg-interactions/runtime"
import {
  type RuntimeTurnJournalEntry,
  type RuntimeUpdateValidationJournalSummary,
  type RuntimeUpdateProposalSource,
} from "./runtime-persistence"
import { createPendingRpgUpdates, type PendingRpgUpdate } from "./update-staging"
import type { ProposedWikiUpdate } from "./state-extractor"
import { runRpgTurn } from "./turn-orchestrator"
import type { RpgTurnRecord, RpgTurnResult } from "./turn-model"
import type { CompactStoryBrief, SubmittedAction } from "./types"

export interface RpgRuntimeTurnPersistence {
  appendTurnJournalEntry: (projectPath: string, entry: RuntimeTurnJournalEntry) => Promise<{ warnings?: string[] } | void>
}

export interface RunRpgRuntimeTurnFlowInput {
  projectPath: string
  wikiMode: "llmwikirpg"
  submittedAction: SubmittedAction
  narrationAdapter: RpgNarrationAdapter
  updateInteractionAdapter: RpgRuntimeUpdateInteractionAdapter
  runtimePersistence?: RpgRuntimeTurnPersistence
}

export interface RunRpgRuntimeTurnFlowResult {
  brief: CompactStoryBrief
  turnResult: RpgTurnResult
  turnRecord: RpgTurnRecord
  proposedUpdates: ProposedWikiUpdate[]
  pendingUpdates: PendingRpgUpdate[]
  warnings: string[]
  proposalSource: RuntimeUpdateProposalSource
  runtimeUpdateValidation: RpgRuntimeUpdateValidationResult
}

export async function runRpgRuntimeTurnFlow(
  input: RunRpgRuntimeTurnFlowInput,
): Promise<RunRpgRuntimeTurnFlowResult> {
  const turn = await runRpgTurn(input)
  const extracted = await generateRuntimeUpdateProposal(input, turn.turnRecord)
  const runtimeUpdateValidation = validateRpgRuntimeUpdateProposals(extracted.proposedUpdates)
  const pendingUpdates = createPendingRpgUpdates(runtimeUpdateValidation.acceptedUpdates)
  const warnings = [...turn.warnings, ...extracted.warnings, ...runtimeUpdateValidation.warnings]
  const journalWarnings = await persistTurnJournalEntry(input, {
    timestamp: new Date().toISOString(),
    submittedAction: input.submittedAction,
    turnResult: turn.turnResult,
    turnRecord: turn.turnRecord,
    proposedUpdates: extracted.proposedUpdates,
    pendingUpdateIds: pendingUpdates.map((update) => update.id),
    warnings,
    proposalSource: extracted.proposalSource,
    runtimeUpdateValidation: summarizeRuntimeUpdateValidation(runtimeUpdateValidation),
  })

  return {
    brief: turn.brief,
    turnResult: turn.turnResult,
    turnRecord: turn.turnRecord,
    proposedUpdates: extracted.proposedUpdates,
    pendingUpdates,
    warnings: [...warnings, ...journalWarnings],
    proposalSource: extracted.proposalSource,
    runtimeUpdateValidation,
  }
}

async function generateRuntimeUpdateProposal(
  input: RunRpgRuntimeTurnFlowInput,
  turnRecord: RpgTurnRecord,
): Promise<{ proposedUpdates: ProposedWikiUpdate[]; warnings: string[]; proposalSource: RuntimeUpdateProposalSource }> {
  const prompt = runtimeUpdateInteractionSpec.buildPrompt({ turnRecord })
  const output = await input.updateInteractionAdapter.generateUpdateProposal(prompt)
  return {
    ...runtimeUpdateInteractionSpec.parseOutput(output, { turnRecord }),
    proposalSource: "interaction",
  }
}

async function persistTurnJournalEntry(
  input: RunRpgRuntimeTurnFlowInput,
  entry: RuntimeTurnJournalEntry,
): Promise<string[]> {
  const appendTurnJournal = input.runtimePersistence?.appendTurnJournalEntry
  if (!appendTurnJournal) return []

  try {
    const result = await appendTurnJournal(input.projectPath, entry)
    return result?.warnings ?? []
  } catch (error) {
    return [`Could not append RPG turn journal entry: ${error instanceof Error ? error.message : String(error)}`]
  }
}

function summarizeRuntimeUpdateValidation(
  validation: RpgRuntimeUpdateValidationResult,
): RuntimeUpdateValidationJournalSummary {
  return {
    acceptedUpdateIds: validation.acceptedUpdates.map((update) => update.id),
    rejectedUpdates: validation.rejectedUpdates.map(({ update, issues }) => ({
      id: update.id,
      targetPath: update.targetPath,
      issueCodes: issues.map((issue) => issue.code),
      messages: issues.map((issue) => issue.message),
    })),
    warningIssues: validation.issues
      .filter((issue) => issue.severity === "warning")
      .map((issue) => ({
        updateId: issue.updateId,
        targetPath: issue.targetPath,
        code: issue.code,
        message: issue.message,
      })),
  }
}

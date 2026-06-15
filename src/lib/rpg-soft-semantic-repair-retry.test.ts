import { describe, expect, it } from "vitest"
import {
  ACTION_RESOLUTION_DRAFT_SCHEMA_PROMPT_LINES,
  RUNTIME_UPDATE_PROPOSAL_DRAFT_SCHEMA_PROMPT_LINES,
  buildActionResolverPrompt,
  buildSoftSemanticRepairRetryPrompt,
} from "./rpg-interactions/runtime"
import type { ActionResolverInput } from "./rpg-runtime"

describe("buildSoftSemanticRepairRetryPrompt", () => {
  it("builds a focused repair prompt without original runtime context", () => {
    const result = buildSoftSemanticRepairRetryPrompt({
      stageKind: "action_resolver",
      stageLabel: "RPG Action Resolver",
      failedOutput: "{\"parsedIntent\":{\"intentKind\":\"investigate\" \"actorRef\":\"player:Iven\"}}",
      errorSummary: {
        phase: "parse",
        origin: "json_parse",
        kind: "malformed_json",
        category: "mechanical_format",
        message: "Unexpected string in JSON at position 46",
      },
      draftSchemaLines: ACTION_RESOLUTION_DRAFT_SCHEMA_PROMPT_LINES,
      jsonParseReport: {
        originalLength: 10,
        extractedLength: 10,
        repairedLength: 10,
        operations: [],
        changed: false,
        parseSucceeded: false,
        failureKind: "malformed_json",
        parseErrorMessage: "Unexpected string",
      },
    })

    const combined = `${result.prompt.systemPrompt}\n${result.prompt.userPrompt}`
    expect(combined).toContain("Return only the corrected strict JSON object")
    expect(combined).toContain("Unexpected string in JSON")
    expect(combined).toContain("\"parsedIntent\"")
    expect(combined).toContain(ACTION_RESOLUTION_DRAFT_SCHEMA_PROMPT_LINES.join("\n"))
    expect(combined).not.toContain("preActionSnapshot")
    expect(combined).not.toContain("relevantRules")
    expect(combined).not.toContain("runtimeRefs")
    expect(result.summary).toMatchObject({
      stageKind: "action_resolver",
      truncated: false,
    })
    expect(result.summary.promptChars).toBeGreaterThan(result.summary.includedOutputChars)
  })

  it("truncates long failed output and records the truncation summary", () => {
    const failedOutput = `${"a".repeat(1200)}{\"ok\":false}${"b".repeat(1200)}`
    const result = buildSoftSemanticRepairRetryPrompt({
      stageKind: "action_resolver",
      stageLabel: "RPG Action Resolver",
      failedOutput,
      errorSummary: { message: "Unexpected token" },
      draftSchemaLines: ACTION_RESOLUTION_DRAFT_SCHEMA_PROMPT_LINES,
      maxFailedOutputChars: 1000,
    })

    expect(result.summary).toMatchObject({
      originalOutputChars: failedOutput.length,
      includedOutputChars: 1000,
      maxFailedOutputChars: 1000,
      truncated: true,
    })
    expect(result.prompt.userPrompt).toContain("[...truncated failed output...]")
    expect(result.prompt.userPrompt.length).toBeGreaterThan(1000)
  })

  it("shares the Action Resolver draft schema with the normal prompt", () => {
    const normalPrompt = buildActionResolverPrompt(sampleActionResolverInput())
    const repairPrompt = buildSoftSemanticRepairRetryPrompt({
      stageKind: "action_resolver",
      stageLabel: "RPG Action Resolver",
      failedOutput: "{}",
      errorSummary: { message: "missing field" },
      draftSchemaLines: ACTION_RESOLUTION_DRAFT_SCHEMA_PROMPT_LINES,
    }).prompt

    const schemaText = ACTION_RESOLUTION_DRAFT_SCHEMA_PROMPT_LINES.join("\n")
    expect(normalPrompt.systemPrompt).toContain(schemaText)
    expect(repairPrompt.userPrompt).toContain(schemaText)
  })

  it("uses stage-specific safety instructions instead of Action-only bans", () => {
    const result = buildSoftSemanticRepairRetryPrompt({
      stageKind: "world_tick",
      stageLabel: "RPG World Tick",
      failedOutput: "{}",
      errorSummary: { message: "Unexpected token" },
      draftSchemaLines: ["{ \"worldDeltas\"?: object }"],
      safetyInstructionLines: [
        "Do not add wiki writes, proposed updates, pending updates, Recall Selector output, outline revisions, player-facing narration, or next action options.",
      ],
    })

    expect(result.prompt.systemPrompt).toContain("Do not add wiki writes")
    expect(result.prompt.systemPrompt).toContain("Recall Selector output")
    expect(result.prompt.systemPrompt).not.toContain("world tick content")
  })

  it("can carry Runtime Update Proposal repair boundaries without banning proposal drafts", () => {
    const result = buildSoftSemanticRepairRetryPrompt({
      stageKind: "runtime_update_proposal",
      stageLabel: "RPG Runtime Update Proposal",
      failedOutput: "{}",
      errorSummary: { message: "Unexpected token" },
      draftSchemaLines: RUNTIME_UPDATE_PROPOSAL_DRAFT_SCHEMA_PROMPT_LINES,
      safetyInstructionLines: [
        "Do not create pending updates, apply updates, write files, claim files were modified, or add direct persistence/apply instructions.",
        "Do not add target paths outside the failed RuntimeUpdateProposalDraft schema. Any proposedWikiUpdates remain draft review material only.",
      ],
    })

    const combined = `${result.prompt.systemPrompt}\n${result.prompt.userPrompt}`
    expect(combined).toContain("Do not create pending updates")
    expect(combined).toContain("apply updates")
    expect(combined).toContain("write files")
    expect(combined).toContain("\"proposedWikiUpdates\"")
  })
})

function sampleActionResolverInput(): ActionResolverInput {
  return {
    submittedAction: {
      id: "act-1",
      text: "Inspect the sigil.",
      source: "freeform",
    },
    preActionSnapshot: {
      currentScene: {
        path: "wiki/current-scene/scene_state.md",
        summary: "A canal gate blocks the route.",
        currentTime: "Night",
        currentLocation: "Canal gate",
        visibleSituation: "A sigil glows.",
        presentCharacters: ["player:Iven"],
        interactableObjects: ["location:canal-gate-sigil"],
        currentDangers: [],
        locationActionConditions: [],
        lastTurnSummary: "Iven reached the gate.",
      },
      player: {
        stateSummary: "Iven is ready.",
        abilities: [],
        inventory: [],
        goals: [],
        knownInformation: [],
        knownInformationPath: "wiki/player/known_information.md",
        conditionNotes: [],
      },
      activeClocks: [],
      countdowns: [],
      pendingReactions: [],
      pacingState: {
        summary: "Stable.",
        pacingDebt: "low",
        recentLowProgressTurnCount: 0,
        expectedCampaignDelta: "Inspect the gate.",
      },
      outlineProgress: {
        progressPath: "wiki/outlines/progress.md",
        currentBeat: "Inspect the gate.",
        adjacentBeats: [],
        branchConditions: [],
        progressSummary: "At the gate.",
      },
      rulesExcerpts: [],
      references: [],
    },
    relevantRules: [],
    fixedSlotRefs: [],
    runtimeRefs: [],
  }
}

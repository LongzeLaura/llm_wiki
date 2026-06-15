import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, readFileRaw, writeFileRaw } from "@/test-helpers/fs-temp"
import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat } from "./llm-client"
import {
  buildRuntimeUpdateProposalInputFromTurnRecord,
  type ActionResolverInput,
  type NarrationGeneratorInput,
  type NarrationSourceRef,
  type OutlineBriefCompilerInput,
  type PlayerKnowledgeBoundary,
  type RecallBudget,
  type RecallPolicy,
  type RecallSelectorInput,
  type RetrievalIndexEntry,
  type RpgTurnRecord,
  type StoryOutlineRegeneratorInput,
  type SubmittedAction,
  type WorldTickInput,
} from "./rpg-runtime"
import {
  sampleActionResolution,
  sampleMajorOutlineBriefOutput,
  samplePostActionWorkingState,
  sampleRecalledMaterials,
  sampleRecallSelection,
  sampleTurnNarration,
  sampleTurnRecordRuntimeParts,
  sampleVisibleSelection,
  sampleWorldTickResult,
} from "./rpg-runtime-test-fixtures"
import {
  buildActionResolverPrompt,
  buildNarrationGeneratorPrompt,
  buildOutlineBriefPrompt,
  buildRecallSelectorPrompt,
  buildStoryOutlineRegeneratorPrompt,
  buildWorldTickPrompt,
  buildRpgAnalysisPrompt,
  buildRpgGenerationPrompt,
  campaignSetupImportContract,
  controlDocCanonicalizationInteractionSpec,
  controlDocImportContract,
  createFixtureRuntimeUpdateInteractionAdapter,
  createLlmRpgRuntimeUpdateInteractionAdapter,
  getCampaignSetupImportTargetPath,
  getControlDocImportTargetPath,
  getRpgRuntimeUpdateTargetRules,
  getRpgInteractionRegistryEntry,
  isRpgInteractionKindImplemented,
  listImplementedRpgInteractionKinds,
  listPlannedRpgInteractionKinds,
  listRpgInteractionRegistryEntries,
  pageMergeInteractionSpec,
  runtimeUpdateInteractionSpec,
  sourceIngestAnalysisInteractionSpec,
  sourceIngestGenerationInteractionSpec,
  stripCampaignSetupFuturePressureText,
  validateRpgRuntimeUpdateTarget,
} from "./rpg-interactions"

vi.mock("./llm-client", () => ({
  streamChat: vi.fn(),
}))

const streamChatMock = vi.mocked(streamChat)

interface Ctx {
  tmp: { path: string; cleanup: () => Promise<void> }
}

let ctx: Ctx | undefined

afterEach(async () => {
  streamChatMock.mockReset()
  if (ctx) {
    await ctx.tmp.cleanup()
    ctx = undefined
  }
})

describe("RPG Interaction Contract", () => {
  it("registers every currently implemented RPG interaction and separates planned kinds", () => {
    const implementedKinds = [
      "source_ingest_analysis",
      "source_ingest_generation",
      "page_merge",
      "control_doc_canonicalization",
      "campaign_setup_import_contract",
      "action_resolver",
      "world_tick",
      "recall_selector",
      "outline_brief",
      "outline_regeneration",
      "narration_generator",
      "runtime_update_proposal",
    ] as const
    const llmKinds = [
      "source_ingest_analysis",
      "source_ingest_generation",
      "page_merge",
      "action_resolver",
      "world_tick",
      "recall_selector",
      "outline_brief",
      "outline_regeneration",
      "narration_generator",
      "runtime_update_proposal",
    ] as const

    expect(listImplementedRpgInteractionKinds()).toEqual(implementedKinds)
    expect(listRpgInteractionRegistryEntries().map((entry) => entry.kind)).toEqual(implementedKinds)

    for (const kind of implementedKinds) {
      const entry = getRpgInteractionRegistryEntry(kind)
      expect(entry).toBeDefined()
      expect(entry?.implemented).toBe(true)
      expect(entry?.usesLlm).toBe(llmKinds.some((llmKind) => llmKind === kind))
      if (entry?.spec) {
        expect(entry.spec.kind).toBe(kind)
      } else {
        expect(entry?.contract).toBeDefined()
      }
      expect(isRpgInteractionKindImplemented(kind)).toBe(true)
    }

    expect(listPlannedRpgInteractionKinds()).toEqual([
      "campaign_setup_generation",
      "relationship_derivation",
    ])

    for (const kind of listPlannedRpgInteractionKinds()) {
      expect(getRpgInteractionRegistryEntry(kind)).toBeUndefined()
      expect(isRpgInteractionKindImplemented(kind)).toBe(false)
    }
  })

  it("exposes deterministic import mode contracts from rpg-interactions", () => {
    const controlEntry = getRpgInteractionRegistryEntry("control_doc_canonicalization")
    const campaignEntry = getRpgInteractionRegistryEntry("campaign_setup_import_contract")

    expect(controlEntry).toMatchObject({
      stage: "control_doc_import",
      usesLlm: false,
      implemented: true,
    })
    expect(campaignEntry).toMatchObject({
      stage: "campaign_setup_import",
      usesLlm: false,
      implemented: true,
    })
    expect(controlEntry?.notes?.join("\n")).toContain("deterministic faithful canonicalization")
    expect(campaignEntry?.notes?.join("\n")).toContain("future pressure")

    expect(controlDocImportContract.supportedSlots).toEqual([
      "main_outline",
      "outline_progress",
      "rules_core",
      "style_narration",
    ])
    expect(controlDocImportContract.usesLlmByDefault).toBe(false)
    expect(getControlDocImportTargetPath("main_outline")).toBe("wiki/outlines/main.md")
    expect(getControlDocImportTargetPath("outline_progress")).toBe("wiki/outlines/progress.md")
    expect(getControlDocImportTargetPath("rules_core")).toBe("wiki/rules/core.md")
    expect(getControlDocImportTargetPath("style_narration")).toBe("wiki/style/narration.md")
    expect(controlDocImportContract.slotDefinitions.map((slot) => [slot.slotId, slot.writePolicy])).toEqual([
      ["main_outline", "manual_or_review_only"],
      ["outline_progress", "merge"],
      ["rules_core", "manual_or_review_only"],
      ["style_narration", "manual_or_review_only"],
    ])

    expect(campaignSetupImportContract.supportedSlots).toEqual([
      "player_main",
      "player_abilities",
      "player_inventory",
      "player_goals",
      "player_known_information",
      "current_scene",
      "events_prologue",
      "main_quest",
      "quest",
      "player_relationship",
    ])
    expect(campaignSetupImportContract.usesLlmByDefault).toBe(false)
    expect(campaignSetupImportContract.writePolicies).toEqual({
      player_main: "merge",
      player_abilities: "merge",
      player_inventory: "merge",
      player_goals: "merge",
      player_known_information: "merge",
      current_scene: "overwrite",
      events_prologue: "append",
      main_quest: "merge",
      quest: "merge",
      player_relationship: "merge",
    })
    expect(getCampaignSetupImportTargetPath("player_main")).toBe("wiki/player/player.md")
    expect(getCampaignSetupImportTargetPath("player_abilities")).toBe("wiki/player/abilities.md")
    expect(getCampaignSetupImportTargetPath("player_inventory")).toBe("wiki/player/inventory.md")
    expect(getCampaignSetupImportTargetPath("player_goals")).toBe("wiki/player/goals.md")
    expect(getCampaignSetupImportTargetPath("player_known_information")).toBe("wiki/player/known_information.md")
    expect(getCampaignSetupImportTargetPath("current_scene")).toBe("wiki/current-scene/scene_state.md")
    expect(getCampaignSetupImportTargetPath("events_prologue")).toBe("wiki/events/prologue.md")
    expect(getCampaignSetupImportTargetPath("main_quest")).toBe("wiki/quests/main.md")
    expect(getCampaignSetupImportTargetPath("quest", { questName: "Find the Silver Gate" })).toBe(
      "wiki/quests/find-the-silver-gate.md",
    )
    expect(getCampaignSetupImportTargetPath("player_relationship", { relationshipName: "Archivist Mara" })).toBe(
      "wiki/relationships/player-archivist-mara.md",
    )

    const filtered = stripCampaignSetupFuturePressureText([
      "Already happened: Iven accepted Mara's map.",
      "## Possible Futures",
      "Mara might later betray Iven.",
      "GM note: reveal this in Act 2.",
    ].join("\n"))
    expect(filtered).toContain("Already happened")
    expect(filtered).not.toContain("might later")
    expect(campaignSetupImportContract.abilityLikeInputReviewBoundaryNotes.join("\n")).toContain(
      "wiki/player/abilities.md",
    )
    expect(campaignSetupImportContract.currentSceneBootstrapBoundaryNotes.join("\n")).toContain(
      "explicitBootstrap",
    )
  })

  it("guards removed RPG prompt islands after source-ingest and page-merge consolidation", async () => {
    const removedLegacyPromptLocations = [
      "src/lib/prompts/rpg-ingest.ts",
      "src/lib/prompts/rpg-page-guidance.ts",
      "src/lib/ingest.ts chunk prompts",
      "src/lib/" + "rpg-" + "merge-policy.ts",
      "src/lib/rpg-interactions/control-doc-" + "canonicalization-" + "interaction.ts",
    ]
    expect(removedLegacyPromptLocations).toEqual([
      "src/lib/prompts/rpg-ingest.ts",
      "src/lib/prompts/rpg-page-guidance.ts",
      "src/lib/ingest.ts chunk prompts",
      "src/lib/" + "rpg-" + "merge-policy.ts",
      "src/lib/rpg-interactions/control-doc-" + "canonicalization-" + "interaction.ts",
    ])

    await expect(fs.access("src/lib/prompts/rpg-ingest.ts")).rejects.toThrow()
    await expect(fs.access("src/lib/prompts/rpg-page-guidance.ts")).rejects.toThrow()
    await expect(fs.access("src/lib/prompts/" + "domain-guidance.ts")).rejects.toThrow()
    await expect(fs.access("src/lib/prompts/" + "shared-ingest.ts")).rejects.toThrow()
    await expect(fs.access("src/lib/" + "rpg-" + "merge-policy.ts")).rejects.toThrow()
    await expect(
      fs.access("src/lib/rpg-interactions/control-doc-" + "canonicalization-" + "interaction.ts"),
    ).rejects.toThrow()

    const ingestSource = await fs.readFile("src/lib/ingest.ts", "utf-8")
    expect(ingestSource).not.toContain("You are an RPG wiki extraction analyst")
    expect(ingestSource).not.toContain("RPG Wiki Generation Contract")
    expect(ingestSource).not.toContain("RP Runtime Signals JSON")
    expect(ingestSource).not.toContain("@/lib/prompts/" + "rpg-ingest")
    expect(ingestSource).not.toContain("@/lib/prompts/" + "rpg-page-guidance")
    expect(ingestSource).not.toContain("prompts/" + "domain-guidance")
    expect(ingestSource).not.toContain("prompts/" + "shared-ingest")
    expect(ingestSource).not.toContain("@/lib/" + "rpg-" + "merge-policy")
    expect(ingestSource).not.toContain("## Existing version on disk")

    const sourceFiles = await readTextFilesUnder("src")
    const sourceText = sourceFiles.join("\n")
    expect(sourceText).not.toContain("@/lib/" + "rpg-" + "merge-policy")
    expect(sourceText).not.toContain("./" + "rpg-" + "merge-policy")
    expect(sourceText).not.toContain("control-doc-" + "canonicalization-" + "interaction")
    expect(sourceText).not.toContain("@/lib/prompts/" + "shared-ingest")

    const mergePolicy = await fs.readFile("src/lib/rpg-interactions/merge/merge-policy.ts", "utf-8")
    const mergeInteraction = await fs.readFile("src/lib/rpg-interactions/merge/page-merge-interaction.ts", "utf-8")
    expect(mergePolicy).toContain("buildRpgMergeSystemPrompt")
    expect(mergePolicy).toContain("RPG-aware merge semantics")
    expect(mergeInteraction).toContain("pageMergeInteractionSpec")
    expect(mergeInteraction).toContain("## Existing version on disk")

    const sourceIngestShared = await fs.readFile(
      "src/lib/rpg-interactions/source-ingest/shared-ingest-contract.ts",
      "utf-8",
    )
    expect(sourceIngestShared).toContain("buildOutputFormatRules")
    expect(sourceIngestShared).toContain("FILE blocks followed by optional REVIEW blocks")

    const campaignSetupImport = await fs.readFile("src/lib/rpg-import/campaign-setup-import.ts", "utf-8")
    expect(campaignSetupImport).not.toContain("FUTURE_" + "PRESSURE_PATTERN")
    expect(campaignSetupImport).not.toContain("const CAMPAIGN_" + "SETUP_IMPORT_TARGET_SLOTS")
  })

  it("guards runtime prompt contracts under rpg-interactions runtime", async () => {
    await expect(fs.access("src/lib/rpg-runtime/" + "narration-" + "prompts.ts")).rejects.toThrow()
    await expect(fs.access("src/lib/rpg-runtime/" + "narration-" + "adapter.ts")).rejects.toThrow()
    await expect(fs.access("src/lib/rpg-runtime/" + "llm-" + "narration-adapter.ts")).rejects.toThrow()
    await expect(fs.access("src/lib/rpg-interactions/runtime/" + "narration-" + "interaction.ts")).rejects.toThrow()
    await expect(fs.access("src/lib/rpg-interactions/runtime/" + "narration-" + "adapter.ts")).rejects.toThrow()
    await expect(fs.access("src/lib/rpg-interactions/runtime/" + "llm-" + "narration-adapter.ts")).rejects.toThrow()

    const runtimeFiles = await readTextFilesUnder("src/lib/rpg-runtime")
    const runtimeSource = runtimeFiles.join("\n")
    expect(runtimeSource).not.toContain("You are the dedicated llmWikiRPG narration runtime")
    expect(runtimeSource).not.toContain("You are the llmWikiRPG runtime state update interaction")
    expect(runtimeSource).not.toContain("# RPG Narration Brief")

    const runtimeInteractionFiles = await readTextFilesUnder("src/lib/rpg-interactions/runtime")
    const runtimeInteractionSource = runtimeInteractionFiles.join("\n")
    expect(runtimeInteractionSource).toContain("你是 llmWikiRPG 在 19 步 runtime 流程中使用的 LLM 6 Runtime Update Proposal Draft 交互")
    expect(runtimeInteractionSource).not.toContain("You are the dedicated llmWikiRPG narration runtime")
    expect(runtimeInteractionSource).not.toContain("# RPG Narration Brief")
    expect(runtimeInteractionSource).not.toContain("RpgNarrationAdapter")
    expect(runtimeInteractionSource).not.toContain("createLlmRpgNarrationAdapter")
    expect(runtimeInteractionSource).not.toContain("buildRpgNarrationPrompt")
    expect(runtimeInteractionSource).not.toContain("narrationInteractionSpec")
    expect(runtimeInteractionSource).toContain("RpgNarrationGeneratorAdapter")
    expect(runtimeInteractionSource).toContain("createLlmRpgNarrationGeneratorAdapter")
    expect(runtimeInteractionSource).toContain("validateRpgRuntimeUpdateProposals")
    expect(runtimeInteractionSource).toContain("validateRpgRuntimeUpdateTarget")
  })

  it("guards runtime JSON prompt contracts against undefined value leakage", () => {
    const runtimePrompts = [
      ["Action Resolver", buildActionResolverPrompt(sampleRuntimeActionResolverInput())],
      ["World Tick", buildWorldTickPrompt(sampleRuntimeWorldTickInput())],
      ["Recall Selector", buildRecallSelectorPrompt(sampleRuntimeRecallSelectorInput())],
      ["Outline Brief", buildOutlineBriefPrompt(sampleRuntimeOutlineBriefInput())],
      ["Story Outline Regenerator", buildStoryOutlineRegeneratorPrompt(sampleRuntimeStoryRegeneratorInput())],
      ["Narration Generator", buildNarrationGeneratorPrompt(sampleRuntimeNarrationGeneratorInput())],
      [
        "Runtime Update Proposal",
        runtimeUpdateInteractionSpec.buildPrompt(buildRuntimeUpdateProposalInputFromTurnRecord(sampleTurnRecord())),
      ],
    ] as const

    for (const [label, prompt] of runtimePrompts) {
      expectNoUndefinedJsonContractLeak(label, `${prompt.systemPrompt}\n${prompt.userPrompt}`)
    }

    const runtimeUpdatePrompt = runtimePrompts.find(([label]) => label === "Runtime Update Proposal")?.[1]
    if (!runtimeUpdatePrompt) throw new Error("missing Runtime Update Proposal prompt")
    expect(`${runtimeUpdatePrompt.systemPrompt}\n${runtimeUpdatePrompt.userPrompt}`).toContain(
      '"pacingUpdateProposal": null',
    )
  })

  it("keeps slimmed soft-semantic runtime prompt contracts bounded", () => {
    const actionPrompt = buildActionResolverPrompt(sampleRuntimeActionResolverInput())
    const worldTickPrompt = buildWorldTickPrompt(sampleRuntimeWorldTickInput())
    const narrationPrompt = buildNarrationGeneratorPrompt(sampleRuntimeNarrationGeneratorInput())

    expect(promptChars(actionPrompt)).toBeLessThanOrEqual(26000)
    expect(promptChars(worldTickPrompt)).toBeLessThanOrEqual(22000)
    expect(promptChars(narrationPrompt)).toBeLessThanOrEqual(24000)

    expect(actionPrompt.systemPrompt).toContain('"referencePaths": string[]')
    expect(actionPrompt.systemPrompt).not.toContain('"references": [{')
    expect(actionPrompt.systemPrompt).not.toContain('"code": string')

    const worldTickSectionIds = worldTickPrompt.debugSections?.map((section) => section.sectionId) ?? []
    expect(worldTickSectionIds).toContain("world-tick-action-brief")
    expect(worldTickSectionIds).not.toContain("world-tick-action-resolution")
    expect(worldTickSectionIds).not.toContain("world-tick-canonical-player-action-delta")
    expect(worldTickSectionIds).not.toContain("world-tick-resolved-time-delta")
    expect(worldTickPrompt.systemPrompt).not.toContain('"tickId"?: string')
    expect(worldTickPrompt.systemPrompt).not.toContain("DraftReference")
    expect(worldTickPrompt.systemPrompt).not.toContain("DraftWarning")

    expect(narrationPrompt.systemPrompt).toContain('"narrationSelfReport"?:')
    expect(narrationPrompt.systemPrompt).not.toContain('"likelyAffectedPaths": string[]')
  })

  it("builds source ingest analysis prompts through the interaction spec", () => {
    const input = {
      purpose: "Track RPG runtime facts.",
      index: "# Index\n- wiki/world/basic_overview.md",
      sourceContent: "The Moonlit Archive keeps sealed maps.",
      sourceIdentity: "raw/sources/archive.md",
      folderContext: "Imported from setting notes.",
    }
    const prompt = sourceIngestAnalysisInteractionSpec.buildPrompt(input)

    expect(sourceIngestAnalysisInteractionSpec.kind).toBe("source_ingest_analysis")
    expect(prompt.systemPrompt).toBe(buildRpgAnalysisPrompt(input.purpose, input.index, input.sourceContent))
    expect(prompt.userPrompt).toContain("Analyze this source document")
    expect(prompt.userPrompt).toContain("**File:** raw/sources/archive.md")
    expect(prompt.userPrompt).toContain("**Folder context:** Imported from setting notes.")
    expect(prompt.userPrompt).toContain("The Moonlit Archive keeps sealed maps.")
    expect(sourceIngestAnalysisInteractionSpec.parseOutput("raw analysis", input)).toBe("raw analysis")
  })

  it("builds source ingest generation prompts through the interaction spec", () => {
    const input = {
      schema: "wikiMode: llmwikirpg",
      purpose: "Track RPG runtime facts.",
      index: "# Index\n- wiki/sources/archive.md",
      sourceIdentity: "raw/sources/archive.md",
      overview: "# Overview",
      sourceContent: "The Moonlit Archive keeps sealed maps.",
      sourceSummaryPath: "wiki/sources/raw-sources-archive.md",
      stage1Analysis: "## Source Profile\n- needed_categories: [world]",
    }
    const prompt = sourceIngestGenerationInteractionSpec.buildPrompt(input)

    expect(sourceIngestGenerationInteractionSpec.kind).toBe("source_ingest_generation")
    expect(prompt.systemPrompt).toBe(
      buildRpgGenerationPrompt(
        input.schema,
        input.purpose,
        input.index,
        input.sourceIdentity,
        input.overview,
        input.sourceContent,
        input.sourceSummaryPath,
        input.stage1Analysis,
      ),
    )
    expect(prompt.userPrompt).toContain("Stage 1 analysis below is CONTEXT")
    expect(prompt.userPrompt).toContain("Your output must be FILE/REVIEW")
    expect(prompt.userPrompt).toContain("Your response MUST begin with `---FILE:`")
    expect(prompt.userPrompt).toContain("## Source Context")
    expect(prompt.userPrompt).toContain(input.stage1Analysis)
    expect(sourceIngestGenerationInteractionSpec.parseOutput("raw generation", input)).toBe("raw generation")
  })

  it("builds control doc canonicalization prompts that preserve control semantics", () => {
    const input = {
      slotId: "rules_core",
      targetPath: "wiki/rules/core.md",
      sourceIdentity: "raw/sources/rules.md",
      sourceContent: "HARD GATE: keep {{setvar::danger=high}} and forbidden words intact.",
    }
    const prompt = controlDocCanonicalizationInteractionSpec.buildPrompt(input)
    const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`

    expect(controlDocCanonicalizationInteractionSpec.kind).toBe("control_doc_canonicalization")
    expect(combined).toContain("llmWikiRPG control documents")
    expect(combined).toContain("Preserve the user's control semantics faithfully")
    expect(combined).toContain("Do not perform ordinary source ingest")
    expect(combined).toContain("Do not drop hard gates")
    expect(combined).toContain("{{setvar::...}}")
    expect(combined).toContain("Future outlines and possible futures")
    expect(combined).toContain("wiki/rules/core.md")
    expect(combined).toContain(input.sourceContent)
    expect(controlDocCanonicalizationInteractionSpec.parseOutput("canonical body", input)).toBe("canonical body")
  })

  it("builds page merge prompts through the interaction spec and parses raw output", () => {
    const input = {
      existingContent: "---\ntitle: Old\n---\n\n# Old\n\nExisting body.",
      incomingContent: "---\ntitle: New\n---\n\n# New\n\nIncoming body.",
      pagePath: "wiki/plot-arcs/main.md",
      sourceFileName: "session-notes.md",
    }
    const prompt = pageMergeInteractionSpec.buildPrompt(input)

    expect(pageMergeInteractionSpec.kind).toBe("page_merge")
    expect(prompt.systemPrompt).toContain("Merge policy: plot-pressure")
    expect(prompt.systemPrompt).toContain("Output the COMPLETE file")
    expect(prompt.userPrompt).toContain("## Existing version on disk")
    expect(prompt.userPrompt).toContain(input.existingContent)
    expect(prompt.userPrompt).toContain("## Newly generated version (from session-notes.md)")
    expect(prompt.userPrompt).toContain(input.incomingContent)
    expect(prompt.userPrompt).toContain("Now output the merged file. Start with `---` on the first line.")
    expect(pageMergeInteractionSpec.parseOutput("raw complete file", input)).toBe("raw complete file")
  })

  it("creates a fixture runtime update interaction adapter that returns preset output", async () => {
    const output = [
      "```rpg-wiki-update",
      "targetPath: wiki/events/example.md",
      "strategy: append",
      "reason: Fixture output.",
      "---",
      "# Fixture Event",
      "```",
    ].join("\n")
    const adapter = createFixtureRuntimeUpdateInteractionAdapter(output)

    await expect(
      adapter.generateUpdateProposal(
        runtimeUpdateInteractionSpec.buildPrompt(buildRuntimeUpdateProposalInputFromTurnRecord(sampleTurnRecord())),
      ),
    ).resolves.toBe(output)
  })

  it("creates a real runtime update interaction adapter that streams raw LLM output", async () => {
    const output = [
      "```rpg-wiki-update\n",
      "targetPath: wiki/events/example.md\n",
      "strategy: append\n",
      "reason: Raw LLM output.\n",
      "---\n",
      "# Event\n",
      "```",
    ].join("")
    const signal = new AbortController().signal
    const requestOverrides = { temperature: 0.1, max_tokens: 800 }
    streamChatMock.mockImplementationOnce(async (_config, _messages, callbacks) => {
      callbacks.onToken(output)
      callbacks.onDone()
    })

    const adapter = createLlmRpgRuntimeUpdateInteractionAdapter(
      { llmConfig: sampleLlmConfig(), signal },
      { requestOverrides },
    )
    await expect(adapter.generateUpdateProposal(sampleInteractionPrompt())).resolves.toBe(output)

    expect(streamChatMock).toHaveBeenCalledWith(
      sampleLlmConfig(),
      [
        { role: "system", content: "System update instructions." },
        { role: "user", content: "User completed turn record." },
      ],
      expect.objectContaining({
        onToken: expect.any(Function),
        onDone: expect.any(Function),
        onError: expect.any(Function),
      }),
      signal,
      requestOverrides,
    )
  })

  it("lists the shared runtime update target rules", () => {
    const rules = getRpgRuntimeUpdateTargetRules()
    const serialized = JSON.stringify(rules)

    expect(rules.map((rule) => [rule.pathPattern, rule.strategy])).toEqual([
      ["wiki/current-scene/scene_state.md", "overwrite"],
      ["wiki/events/*.md", "append"],
      ["wiki/player/player.md", "merge"],
      ["wiki/player/abilities.md", "merge"],
      ["wiki/player/inventory.md", "merge"],
      ["wiki/player/goals.md", "merge"],
      ["wiki/player/known_information.md", "merge"],
      ["wiki/quests/*.md", "merge"],
      ["wiki/outlines/progress.md", "merge"],
      ["wiki/relationships/runtime/*.md", "merge"],
      ["wiki/plot-arcs/runtime/*.md", "merge"],
      ["wiki/characters/runtime/*.md", "merge"],
      ["wiki/locations/runtime/*.md", "merge"],
      ["wiki/factions/runtime/*.md", "merge"],
      ["wiki/items/runtime/*.md", "merge"],
    ])
    expect(serialized).toContain("current-scene")
    expect(serialized).toContain("events")
    expect(serialized).toContain("player")
    expect(serialized).toContain("quests")
    expect(serialized).toContain("outlines/progress.md")
    expect(serialized).toContain("relationships/runtime")
    expect(serialized).toContain("plot-arcs/runtime")
    expect(serialized).toContain("Runtime overlays")
    expect(serialized).toContain("PC subjective motives")
    expect(serialized).toContain("not quest progress")
    expect(serialized).toContain("Game-recognized trackable objectives only")
    expect(serialized).toContain("not any goal, subjective wish, player TODO/checklist")
    expect(serialized).toContain("never player TODO/checklists, quest ledgers")
    expect(serialized).toContain("object-level item state belongs in wiki/items/runtime/*.md")
  })

  it.each([
    ["wiki/current-scene/scene_state.md", "overwrite"],
    ["wiki/events/example.md", "append"],
    ["wiki/player/player.md", "merge"],
    ["wiki/player/inventory.md", "merge"],
    ["wiki/quests/main.md", "merge"],
    ["wiki/outlines/progress.md", "merge"],
    ["wiki/relationships/runtime/a-b.md", "merge"],
    ["wiki/plot-arcs/runtime/main.md", "merge"],
    ["wiki/characters/runtime/rin.md", "merge"],
  ])("accepts %s with %s", (targetPath, strategy) => {
    expect(validateRpgRuntimeUpdateTarget(targetPath, strategy)).toEqual({
      ok: true,
      targetPath,
      strategy,
    })
  })

  it.each([
    ["wiki/entities/ghost.md", "merge", "legacy path"],
    ["wiki/concepts/ghost.md", "merge", "legacy path"],
    ["wiki/queries/ghost.md", "merge", "legacy path"],
    ["wiki/world/basic_overview.md", "merge", "world path"],
    ["wiki/style/narrative.md", "merge", "style path"],
    ["wiki/rules/magic.md", "merge", "rules path"],
    ["wiki/sources/session.md", "merge", "sources path"],
    ["wiki/memory/manual.md", "merge", "memory path"],
    ["wiki/characters/rin.md", "merge", "base character path"],
    ["wiki/locations/church.md", "merge", "base location path"],
    ["wiki/factions/association.md", "merge", "base faction path"],
    ["wiki/items/key.md", "merge", "base item path"],
    ["wiki/relationships/a-b.md", "merge", "base relationship path"],
    ["wiki/plot-arcs/main.md", "merge", "base plot arc path"],
    ["wiki/outlines/main.md", "merge", "main outline path"],
    ["wiki/current-scene/scene_state.md", "merge", "strategy mismatch"],
    ["wiki/events/example.md", "merge", "strategy mismatch"],
    ["wiki/player/state.md", "merge", "arbitrary player path"],
    ["wiki/player/inventory.md", "append", "strategy mismatch"],
    ["wiki/quests/main.md", "overwrite", "strategy mismatch"],
    ["wiki/quests/main.md", "append", "strategy mismatch"],
  ])("rejects %s with %s as %s", (targetPath, strategy) => {
    const result = validateRpgRuntimeUpdateTarget(targetPath, strategy)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/outside allowed runtime update paths|requires strategy/)
    }
  })

  it("builds a runtime update prompt with allowed target rules and completed-turn boundaries", () => {
    const prompt = runtimeUpdateInteractionSpec.buildPrompt(buildRuntimeUpdateProposalInputFromTurnRecord(sampleTurnRecord()))
    const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`

    expect(runtimeUpdateInteractionSpec.kind).toBe("runtime_update_proposal")
    expect(combined).toContain("wiki/current-scene/scene_state.md")
    expect(combined).toContain("wiki/events/*.md")
    expect(combined).toContain("wiki/quests/*.md")
    expect(combined).toContain("wiki/characters/runtime/*.md")
    expect(combined).toContain("wiki/relationships/runtime/*.md")
    expect(combined).toContain("wiki/plot-arcs/runtime/*.md")
    expect(combined).toContain("wiki/outlines/progress.md")
    expect(combined).toContain("主要事实来源是这些结构化的当前回合输入")
    expect(combined).toContain("PostActionWorkingState")
    expect(combined).toContain("ActionResolution")
    expect(combined).toContain("WorldTickResult")
    expect(combined).toContain("TurnNarration")
    expect(combined).toContain("generatedNarrative 和 playerFacingText 只是展示/证据材料")
    expect(combined).not.toContain("The factual source is strictly submittedAction + generatedNarrative + references")
    expect(combined).toContain("outlineAwareNarrationBrief")
    expect(combined).toContain("outlineImpactReport")
    expect(combined).toContain("outlineRevisionProposal 只能变成独立的 outlineRevisionReviewItems")
    expect(combined).toContain("attempted_not_confirmed 不能进入已确认事件")
    expect(combined).toContain("parallelLineText 和 user_visible_pc_unknown 材料")
    expect(combined).toContain("nextActionOptions 是候选未来行动")
    expect(combined).toContain("你只能提出更新建议")
    expect(combined).toContain("stable、manual、base 和 legacy 路径一律禁止")
    expect(combined).toContain("这个阶段只负责解析 JSON 并执行结构/边界检查")
    expect(combined).toContain("events 更新只能包含已确认发生的事件")
    expect(combined).toContain("current-scene 只能是紧凑的最新时刻快照")
    expect(combined).toContain("跨目录同步契约")
    expect(combined).toContain("长期状态不能只存在于 current-scene")
    expect(combined).toContain("第一版 runtime sync 不会自动补造缺失更新")
    expect(combined).toContain("relationships/runtime 更新必须记录关系 delta")
    expect(combined).toContain("plot-arcs/runtime 更新用于 runtime 故事压力")
    expect(combined).toContain("player/goals.md 用于 PC 主观动机")
    expect(combined).toContain("不要在里面存 quest progress、玩家 TODO/清单、候选行动或剧情压力")
    expect(combined).toContain("quests 是游戏认可的可追踪目标")
    expect(combined).toContain("不要把任何 goal、主观愿望或玩家 TODO/清单当作 quest")
    expect(combined).toContain("绝不能把它当成玩家 TODO/清单或 quest 台账")
    expect(combined).toContain("player/inventory.md 只用于当前持有物")
    expect(combined).toContain("物品定义和对象级 runtime 状态属于 items/runtime/")
    expect(combined).toContain("禁止的 runtime 目标包括 base wiki/relationships/*.md")
    expect(combined).toContain("base wiki/plot-arcs/*.md")
    expect(combined).toContain("wiki/outlines/main.md")
    expect(combined).toContain("不要暂存 pending updates")
    expect(combined).toContain("不要应用更新")
    expect(combined).toContain("RuntimeUpdateProposalDraft JSON")
    expect(combined).toContain("proposedWikiUpdates")
    expect(combined).toContain("targetPath、strategy、reason、content、runtimeDeltaIds")
    expect(combined).toContain("不要输出 sourceDeltas")
    expect(combined).toContain("唯一可接受的输出契约是结构化 JSON")
    expect(combined).not.toContain("rpg-wiki-update")
    expect(combined).toContain("Ask Rin whether the sigil is a ward or a lure.")
    expect(combined).toContain("A cautious sigil read begins; the gate opening is not confirmed.")
  })

  it("rejects rpg-wiki-update blocks at the runtime update proposal boundary", () => {
    const turnRecord = sampleTurnRecord()
    expect(() =>
      runtimeUpdateInteractionSpec.parseOutput(
        [
          "```rpg-wiki-update",
          "targetPath: wiki/events/example.md",
          "strategy: append",
          "reason: Record the completed ward inspection.",
          "---",
          "# Ward Inspection",
          "",
          "Rin confirmed the sigil behaves like a ward.",
          "```",
        ].join("\n"),
        buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord),
      ),
    ).toThrow(/RuntimeUpdateProposalDraft must be a JSON object/)
  })

  it("rejects empty runtime update proposal output", () => {
    expect(() =>
      runtimeUpdateInteractionSpec.parseOutput(
        "",
        buildRuntimeUpdateProposalInputFromTurnRecord(sampleTurnRecord()),
      ),
    ).toThrow(/JSON output is empty/)
  })

  it("does not read or write wiki files while building prompts or parsing output", async () => {
    ctx = { tmp: await createTempProject("rpg-interactions-readonly") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nThe gate is quiet.")
    await writeFileRaw(`${projectPath}/wiki/events/session-01.md`, "# Session 01\n\nThe gate was found.")

    const before = await snapshotFiles(projectPath)
    sourceIngestAnalysisInteractionSpec.buildPrompt({
      purpose: "Test purpose",
      index: "# Index",
      sourceContent: "Source text",
      sourceIdentity: "raw/sources/source.md",
      folderContext: "Folder note",
    })
    sourceIngestAnalysisInteractionSpec.parseOutput("analysis", {
      purpose: "Test purpose",
      index: "# Index",
      sourceContent: "Source text",
      sourceIdentity: "raw/sources/source.md",
    })
    sourceIngestGenerationInteractionSpec.buildPrompt({
      schema: "wikiMode: llmwikirpg",
      purpose: "Test purpose",
      index: "# Index",
      sourceIdentity: "raw/sources/source.md",
      sourceContent: "Source text",
      stage1Analysis: "analysis",
    })
    sourceIngestGenerationInteractionSpec.parseOutput("generation", {
      schema: "wikiMode: llmwikirpg",
      purpose: "Test purpose",
      index: "# Index",
      sourceIdentity: "raw/sources/source.md",
    })
    controlDocCanonicalizationInteractionSpec.buildPrompt({
      slotId: "main_outline",
      targetPath: "wiki/outlines/main.md",
      sourceIdentity: "raw/sources/outline.md",
      sourceContent: "Future reveal guidance.",
    })
    controlDocCanonicalizationInteractionSpec.parseOutput("canonical", {
      slotId: "main_outline",
      targetPath: "wiki/outlines/main.md",
      sourceIdentity: "raw/sources/outline.md",
      sourceContent: "Future reveal guidance.",
    })
    pageMergeInteractionSpec.buildPrompt({
      existingContent: "---\ntitle: Old\n---\nOld body.",
      incomingContent: "---\ntitle: New\n---\nNew body.",
      pagePath: "wiki/events/session-01.md",
      sourceFileName: "source.md",
    })
    pageMergeInteractionSpec.parseOutput("---\ntitle: Merged\n---\nMerged body.", {
      existingContent: "---\ntitle: Old\n---\nOld body.",
      incomingContent: "---\ntitle: New\n---\nNew body.",
      pagePath: "wiki/events/session-01.md",
      sourceFileName: "source.md",
    })
    const turnRecord = sampleTurnRecord()
    const proposalInput = buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord)
    runtimeUpdateInteractionSpec.buildPrompt(proposalInput)
    runtimeUpdateInteractionSpec.parseOutput(
      JSON.stringify(sampleRuntimeUpdateProposalDraft()),
      proposalInput,
    )
    const after = await snapshotFiles(projectPath)

    expect(after).toEqual(before)
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("The gate is quiet.")
  })
})

function sampleTurnRecord(): RpgTurnRecord {
  const submittedAction = {
    id: "turn-69",
    text: "Ask Rin whether the sigil is a ward or a lure.",
    source: "freeform" as const,
  }
  return {
    submittedAction,
    ...sampleTurnRecordRuntimeParts(submittedAction),
    turnNarration: sampleTurnNarration({
      playerFacingText: "Rin kneels by the gate and confirms the sigil is an old ward, not bait.",
    }),
    generatedNarrative: "Rin kneels by the gate and confirms the sigil is an old ward, not bait.",
    references: ["wiki/current-scene/scene_state.md", "wiki/player/state.md", "wiki/entities/legacy-poison.md"],
  }
}

function sampleRuntimeUpdateProposalDraft() {
  return {
    proposedWikiUpdates: [
      {
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        reason: "Keep current scene aligned with the cautious sigil read.",
        content: "# Current Scene\n\nRin is checking whether the sigil is a ward while the gate stays closed.",
        runtimeDeltaIds: [],
        sourceRefs: [
          {
            path: "wiki/current-scene/scene_state.md",
            reason: "Current scene source from this turn.",
          },
        ],
        happenedStatus: "ongoing",
        confidence: "high",
        riskNotes: [],
      },
    ],
    outlineRevisionReviewItems: [],
    journalEntries: [],
    skippedDeltas: [],
    pacingUpdateProposal: null,
    warnings: [],
  }
}

function expectNoUndefinedJsonContractLeak(label: string, combinedPrompt: string): void {
  expect(combinedPrompt, `${label} prompt must not expose TypeScript optional unions`).not.toContain("| undefined")
  expect(combinedPrompt, `${label} prompt must not place undefined after a JSON colon`).not.toMatch(
    /:\s*undefined\b/,
  )
  expect(combinedPrompt, `${label} prompt must not place undefined before a comma`).not.toMatch(/\bundefined\s*,/)
  expect(combinedPrompt, `${label} prompt must not place undefined before JSON closers`).not.toMatch(
    /\bundefined\s*[}\]]/,
  )
}

function promptChars(prompt: { systemPrompt: string; userPrompt: string }): number {
  return prompt.systemPrompt.length + prompt.userPrompt.length
}

function sampleRuntimeActionResolverInput(): ActionResolverInput {
  return {
    submittedAction: sampleSubmittedAction("act-audit-action"),
    preActionSnapshot: {
      currentScene: {
        path: "wiki/current-scene/scene_state.md",
        summary: "Iven and Mira stand before the canal gate.",
        visibleSituation: "A cracked sigil glows beside the lock.",
        presentCharacters: ["player:Iven", "character:Mira"],
        interactableObjects: ["location:canal-gate-sigil"],
        currentDangers: ["The Harbor Watch patrol may return."],
        locationActionConditions: ["The sigil should be inspected before contact."],
      },
      player: {
        stateSummary: "Iven is cautious and alert.",
        abilities: ["Sense weak ward pressure."],
        inventory: ["Brass lantern key"],
        goals: ["Open the gate quietly."],
        knownInformation: ["Mira recognizes canal ward marks."],
        knownInformationPath: "wiki/player/known_information.md",
        conditionNotes: [],
      },
      activeClocks: [],
      countdowns: [],
      pendingReactions: [],
      pacingState: {
        summary: "The scene is active and under light pressure.",
      },
      outlineProgress: {
        progressPath: "wiki/outlines/progress.md",
        currentBeat: "Decode the canal gate sigil.",
        adjacentBeats: ["Open the quiet route."],
        branchConditions: ["Forcing the gate alerts the Harbor Watch."],
        progressSummary: "The scene is between investigation and route opening.",
      },
      rulesExcerpts: [],
      references: ["wiki/current-scene/scene_state.md", "wiki/player/known_information.md"],
    },
    relevantRules: [],
    fixedSlotRefs: [
      {
        path: "wiki/current-scene/scene_state.md",
        role: "preActionSceneSnapshot",
        summary: "Frozen current scene snapshot.",
        required: true,
      },
      {
        path: "wiki/player/known_information.md",
        role: "playerKnowledgeBoundary",
        summary: "PC knowledge boundary.",
        required: true,
      },
    ],
    recentTurnSummary: "Mira warned Iven not to touch the sigil too quickly.",
    runtimeRefs: [],
  }
}

function sampleRuntimeWorldTickInput(): WorldTickInput {
  const submittedAction = sampleSubmittedAction("act-audit-world-tick")
  const actionResolution = sampleActionResolution(submittedAction)

  return {
    submittedAction,
    actionResolution,
    playerActionDelta: actionResolution.playerActionDelta,
    timeDelta: actionResolution.timeDelta,
    preActionRefs: [],
    postActionRefs: [],
    activeClocks: [],
    ongoingEvents: [],
    pacingState: {
      summary: "The gate scene is moving but still under pressure.",
      pacingDebt: "low",
      recentLowProgressTurnCount: 1,
      expectedCampaignDelta: "Move the gate decision forward.",
      stalledLines: [],
      pressureNotes: [],
      affectedPaths: ["wiki/current-scene/scene_state.md"],
      runtimeDeltaRefs: [],
    },
    gapSignals: [],
    visibilityPolicy: {
      allowParallelLineDisplay: true,
      pcKnowledgeBoundaryPath: "wiki/player/known_information.md",
      requireVisibilityMeta: true,
      parallelLineDoesNotGrantPcKnowledge: true,
      notes: ["Parallel-line display is not PC knowledge."],
    },
    runtimeRefs: actionResolution.runtimeDeltaRefs,
  }
}

function sampleRuntimeRecallSelectorInput(): RecallSelectorInput {
  const parts = sampleRuntimeParts("act-audit-recall")

  return {
    postActionWorkingState: parts.postActionWorkingState,
    actionResolution: parts.actionResolution,
    worldTickResult: parts.worldTickResult,
    visibleSelection: parts.visibleSelection,
    pacingState: parts.postActionWorkingState.pacingState,
    gapState: parts.postActionWorkingState.gapState,
    retrievalIndex: sampleRuntimeRetrievalIndex(),
    recallBudget: sampleRuntimeRecallBudget(),
    recallPolicy: sampleRuntimeRecallPolicy(),
  }
}

function sampleRuntimeOutlineBriefInput(): OutlineBriefCompilerInput {
  const parts = sampleRuntimeParts("act-audit-outline")
  const recallSelection = sampleRecallSelection(`post-action-working-state-${parts.submittedAction.id}`)
  const recalledMaterials = sampleRecalledMaterials()

  return {
    postActionWorkingState: parts.postActionWorkingState,
    actionResolution: parts.actionResolution,
    worldTickResult: parts.worldTickResult,
    visibleSelection: parts.visibleSelection,
    recallSelection,
    recalledMaterials,
    pacingState: parts.postActionWorkingState.pacingState,
    gapState: parts.postActionWorkingState.gapState,
    reactionQueue: parts.worldTickResult.reactionQueue,
    visibilityBoundaries: sampleRuntimeVisibilityBoundaries(),
    outlineSlices: [],
    plotArcTensionFuel: [],
    hardConstraints: [],
    runtimeRefs: [
      ...parts.postActionWorkingState.runtimeDeltaRefs,
      ...parts.actionResolution.runtimeDeltaRefs,
      ...parts.worldTickResult.runtimeDeltaRefs,
    ],
    knownReferences: [
      {
        path: "wiki/current-scene/scene_state.md",
        sectionId: "slot.current_scene",
        reason: "Prompt audit current scene reference.",
      },
    ],
  }
}

function sampleRuntimeStoryRegeneratorInput(): StoryOutlineRegeneratorInput {
  const parts = sampleRuntimeParts("act-audit-regenerator")
  const outlineBrief = sampleMajorOutlineBriefOutput(parts.submittedAction)
  if (!outlineBrief.regenerationRequest) throw new Error("missing fixture regeneration request")
  const runtimeRef = parts.worldTickResult.runtimeDeltaRefs[0] ?? parts.actionResolution.runtimeDeltaRefs[0]
  if (!runtimeRef) throw new Error("missing fixture runtime ref")

  return {
    postActionWorkingState: parts.postActionWorkingState,
    outlineImpactReport: outlineBrief.outlineImpactReport,
    regenerationRequest: outlineBrief.regenerationRequest,
    recalledMaterials: sampleRecalledMaterials(),
    outlineSlices: [],
    plotArcTensionFuel: [],
    visibilityBoundaries: sampleRuntimeVisibilityBoundaries(),
    hardConstraints: [],
    confirmedFacts: [
      {
        factId: "fact.prompt-audit",
        summary: "Mira's warning is visible and must be preserved.",
        sourceRefs: outlineBrief.regenerationRequest.sourceRefs,
        runtimeDeltaRefs: [runtimeRef],
        happenedStatus: "confirmed_happened",
        mustPreserve: true,
      },
    ],
    forbiddenReveals: [
      {
        revealId: "reveal.gate_patron",
        stableId: "reveal.gate_patron",
        sourcePath: "wiki/outlines/progress.md",
        sectionId: "outlineProgress.adjacent_beats",
        lineTarget: "playerVisibleLine",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        reason: "The patron remains hidden for the prompt audit fixture.",
      },
    ],
    runtimeRefs: [
      ...parts.postActionWorkingState.runtimeDeltaRefs,
      ...parts.actionResolution.runtimeDeltaRefs,
      ...parts.worldTickResult.runtimeDeltaRefs,
    ],
    knownReferences: [
      {
        path: "wiki/outlines/progress.md",
        sectionId: "outlineProgress.adjacent_beats",
        stableId: "reveal.gate_patron",
        reason: "Prompt audit outline reference.",
      },
    ],
  }
}

function sampleRuntimeNarrationGeneratorInput(): NarrationGeneratorInput {
  const submittedAction = sampleSubmittedAction("act-audit-narration")
  const reference = sampleNarrationReference()
  const recallSelection = sampleRecallSelection(`post-action-working-state-${submittedAction.id}`)
  const recalledMaterials = sampleRecalledMaterials()
  const runtimeParts = sampleTurnRecordRuntimeParts(submittedAction, {
    recallSelection,
    recalledMaterials,
  })
  const playerKnowledgeBoundary = samplePlayerKnowledgeBoundary(reference)

  return {
    postActionWorkingState: runtimeParts.postActionWorkingState,
    actionResolution: runtimeParts.actionResolution,
    worldTickResult: runtimeParts.worldTickResult,
    visibleSelection: runtimeParts.visibleSelection,
    outlineAwareNarrationBrief: runtimeParts.outlineAwareNarrationBrief,
    recallSelection: runtimeParts.recallSelection,
    recalledMaterials: runtimeParts.recalledMaterials,
    styleBundle: {
      bundleId: "style-bundle-prompt-audit",
      toneRules: ["Keep narration grounded and concise."],
      dictionRules: ["Use concrete sensory language."],
      pacingRules: ["Move the scene through the visible warning."],
      forbiddenStyleMoves: ["Do not turn style guidance into world facts."],
      sourceRefs: [reference],
      styleIsNotWorldFact: true,
      styleIsNotPlotFact: true,
    },
    forbiddenNarrationConstraints: [],
    playerKnowledgeBoundary,
    references: [reference],
    runtimeRefs: runtimeParts.worldTickResult.runtimeDeltaRefs,
  }
}

function sampleRuntimeParts(id: string) {
  const submittedAction = sampleSubmittedAction(id)
  const actionResolution = sampleActionResolution(submittedAction)
  const worldTickResult = sampleWorldTickResult(actionResolution)
  const visibleSelection = sampleVisibleSelection(actionResolution, worldTickResult)
  const postActionWorkingState = samplePostActionWorkingState(
    submittedAction,
    actionResolution,
    worldTickResult,
    visibleSelection,
  )

  return { submittedAction, actionResolution, worldTickResult, visibleSelection, postActionWorkingState }
}

function sampleSubmittedAction(id: string): SubmittedAction {
  return {
    id,
    text: "Ask Mira to inspect the canal gate sigil.",
    source: "freeform",
  }
}

function sampleRuntimeRetrievalIndex(): RetrievalIndexEntry[] {
  return [
    {
      path: "wiki/current-scene/scene_state.md",
      title: "Current Scene",
      categoryId: "current-scene",
      summary: "Latest canal gate scene snapshot.",
      lineTargets: ["playerVisibleLine"],
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
      availableSections: [
        {
          sectionId: "slot.current_scene",
          sectionRole: "current_visible_state",
          heading: "Current Scene",
          aliases: ["Scene State"],
          lineTargets: ["playerVisibleLine"],
          readModes: ["summary", "focusedSection"],
          visibilityScope: "pc_visible",
          knowledgeScope: "pc_known",
          summary: "Visible current scene facts.",
        },
      ],
      tags: ["scene"],
    },
  ]
}

function sampleRuntimeRecallBudget(): RecallBudget {
  return {
    maxItems: 4,
    maxSections: 6,
    maxEstimatedTokens: 2200,
    preferredLineTargets: ["playerVisibleLine", "parallelLine", "tensionLine"],
  }
}

function sampleRuntimeRecallPolicy(): RecallPolicy {
  return {
    allowFullPageRead: false,
    requireStableSectionIds: true,
    pcKnowledgeBoundaryPath: "wiki/player/known_information.md",
    parallelLineDoesNotGrantPcKnowledge: true,
    notes: ["Select by stable sectionId only."],
  }
}

function sampleRuntimeVisibilityBoundaries(): OutlineBriefCompilerInput["visibilityBoundaries"] {
  return [
    {
      boundaryId: "visibility.pc-known-only",
      lineTarget: "playerVisibleLine",
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
      grantsPcKnowledge: true,
      sourcePath: "wiki/player/known_information.md",
      sectionId: "slot.player_known_information",
      reason: "Player-facing material must remain PC-known.",
    },
  ]
}

function sampleNarrationReference(): NarrationSourceRef {
  return {
    path: "wiki/current-scene/scene_state.md",
    sectionId: "slot.current_scene",
    runtimeDeltaId: "patrol-countdown-advance",
    lineTarget: "playerVisibleLine",
    usePurpose: "narration",
    visibilityScope: "pc_visible",
    knowledgeScope: "pc_known",
    reason: "Ground the player-facing prompt audit narration.",
  }
}

function samplePlayerKnowledgeBoundary(ref: NarrationSourceRef): PlayerKnowledgeBoundary {
  return {
    boundaryId: "player-knowledge-boundary-prompt-audit",
    pcKnowledgePath: "wiki/player/known_information.md",
    allowedKnowledgeRefs: [ref],
    forbiddenVisibilityScopes: ["user_visible_pc_unknown", "gm_only", "hidden"],
    parallelLineDoesNotGrantPcKnowledge: true,
    showParallelLineDoesNotGrantPcKnowledge: true,
    notes: ["Parallel-line display is not PC knowledge."],
  }
}

function sampleInteractionPrompt() {
  return {
    systemPrompt: "System update instructions.",
    userPrompt: "User completed turn record.",
  }
}

function sampleLlmConfig(): LlmConfig {
  return {
    provider: "openai",
    apiKey: "test-key",
    model: "test-model",
    ollamaUrl: "",
    customEndpoint: "",
    maxContextSize: 10000,
  }
}

async function snapshotFiles(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  async function visit(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const path = `${dir}/${entry.name}`.replace(/\\/g, "/")
      if (entry.isDirectory()) {
        await visit(path)
      } else {
        const relative = path.slice(root.length + 1)
        result[relative] = await fs.readFile(path, "utf-8")
      }
    }
  }

  await visit(root)
  return result
}

async function readTextFilesUnder(root: string): Promise<string[]> {
  const result: string[] = []

  async function visit(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue
      const path = `${dir}/${entry.name}`.replace(/\\/g, "/")
      if (entry.isDirectory()) {
        await visit(path)
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        result.push(await fs.readFile(path, "utf-8"))
      }
    }
  }

  await visit(root)
  return result
}

/**
 * Scenario-driven tests for autoIngest.
 *
 * Each scenario materializes an initial project, a source document, and two
 * canned LLM responses (stage 1 analysis, stage 2 generation with FILE +
 * REVIEW blocks). The runner mocks streamChat to emit them sequentially.
 *
 * After ingest runs, the runner asserts:
 *   - expected files exist on disk with expected substrings
 *   - expected review items were injected into the review store
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest"
import path from "node:path"
import fs from "node:fs/promises"
import { realFs, createTempProject, readFileRaw, writeFileRaw, fileExists } from "@/test-helpers/fs-temp"
import { materializeScenario, copyDir } from "@/test-helpers/scenarios/materialize"
import { ingestScenarios } from "@/test-helpers/scenarios/ingest-scenarios"
import type { IngestScenario } from "@/test-helpers/scenarios/types"

vi.mock("@/commands/fs", () => realFs)

// Sequenced streamChat: stage-1 returns analysisResponse, stage-2 returns
// generationResponse. Any further calls return empty (shouldn't happen in a
// typical autoIngest run).
let pendingResponses: string[] = []
let observedSystemPrompts: string[] = []
vi.mock("./llm-client", () => ({
  streamChat: vi.fn(async (_cfg, msgs, cb) => {
    observedSystemPrompts.push(msgs[0]?.content ?? "")
    const resp = pendingResponses.shift() ?? ""
    cb.onToken(resp)
    cb.onDone()
  }),
}))

import { autoIngest, executeIngestWrites } from "./ingest"
import { useWikiStore } from "@/stores/wiki-store"
import { useReviewStore } from "@/stores/review-store"
import { useActivityStore } from "@/stores/activity-store"
import { useChatStore } from "@/stores/chat-store"

const FIXTURES_ROOT = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "scenarios-ingest",
)

beforeAll(async () => {
  await fs.rm(FIXTURES_ROOT, { recursive: true, force: true })
  await fs.mkdir(FIXTURES_ROOT, { recursive: true })
  for (const s of ingestScenarios) {
    await materializeScenario(s, FIXTURES_ROOT)
  }
})

beforeEach(() => {
  pendingResponses = []
  observedSystemPrompts = []
  useReviewStore.setState({ items: [] })
  useActivityStore.setState({ items: [] })
  useChatStore.setState({
    conversations: [],
    messages: [],
    activeConversationId: null,
    mode: "chat",
    ingestSource: null,
    isStreaming: false,
    streamingContent: "",
  })
})

interface Ctx {
  tmp: { path: string; cleanup: () => Promise<void> }
}
let ctx: Ctx | undefined

async function setup(scenario: IngestScenario): Promise<Ctx> {
  const tmp = await createTempProject(
    `ingest-${scenario.name.replace(/\//g, "-")}`,
  )
  const initialWikiDir = path.join(FIXTURES_ROOT, scenario.name, "initial-wiki")
  await copyDir(initialWikiDir, tmp.path)

  useWikiStore.setState({
    project: {
      name: "t",
      path: tmp.path,
      createdAt: 0,
      purposeText: "",
      fileTree: [],
    } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
  })
  useWikiStore.getState().setLlmConfig({
    provider: "openai",
    apiKey: "test-key",
    model: "gpt-4",
    ollamaUrl: "",
    customEndpoint: "",
    maxContextSize: 128000,
  })

  // Queue up the two sequenced LLM responses
  const analysis = await fs.readFile(
    path.join(FIXTURES_ROOT, scenario.name, "llm-analysis.txt"),
    "utf-8",
  )
  const generation = await fs.readFile(
    path.join(FIXTURES_ROOT, scenario.name, "llm-generation.txt"),
    "utf-8",
  )
  pendingResponses = [analysis, generation]

  return { tmp }
}

async function writeRpgProjectFiles(projectPath: string): Promise<void> {
  await writeFileRaw(`${projectPath}/.llm-wiki/project.json`, JSON.stringify({ mode: "llmwikirpg" }))
  await writeFileRaw(`${projectPath}/schema.md`, "wikiMode: llmwikirpg\n")
  await writeFileRaw(`${projectPath}/purpose.md`, "")
  await writeFileRaw(`${projectPath}/wiki/index.md`, "# Index\n")
  await writeFileRaw(`${projectPath}/wiki/overview.md`, "# Overview\n")
}

afterEach(async () => {
  if (ctx) {
    await ctx.tmp.cleanup()
    ctx = undefined
  }
})

// 鈹€鈹€ Assertions 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

async function assertOutcome(
  scenario: IngestScenario,
  tmpPath: string,
): Promise<void> {
  const expected = scenario.expected

  // 1. Expected files exist
  for (const p of expected.writtenPaths) {
    const full = path.join(tmpPath, p)
    const exists = await fileExists(full)
    if (!exists) {
      // eslint-disable-next-line no-console
      console.error(
        `\n[ingest: ${scenario.name}] expected file not written: ${p}`,
      )
    }
    expect(exists, `file not written: ${p}`).toBe(true)
  }

  // 2. File contents contain expected substrings
  if (expected.fileContains) {
    for (const [relPath, substrs] of Object.entries(expected.fileContains)) {
      const full = path.join(tmpPath, relPath)
      const content = await readFileRaw(full)
      for (const sub of substrs) {
        expect(content, `${relPath} missing substring "${sub}"`).toContain(sub)
      }
    }
  }

  // 3. Review store has the expected items
  const expectedReviews = expected.reviewsCreated ?? []
  const actualReviews = useReviewStore.getState().items
  for (const e of expectedReviews) {
    const match = actualReviews.find(
      (r) => r.type === e.type && r.title.includes(e.titleContains),
    )
    if (!match) {
      // eslint-disable-next-line no-console
      console.error(
        `\n[ingest: ${scenario.name}] no review matching ${JSON.stringify(e)}. Actual:\n` +
          JSON.stringify(
            actualReviews.map((r) => ({ type: r.type, title: r.title })),
            null,
            2,
          ),
      )
    }
    expect(match, `review missing: ${JSON.stringify(e)}`).toBeTruthy()
  }

  // 4. If the scenario declared no reviews, store must be empty.
  if (expectedReviews.length === 0) {
    expect(actualReviews).toHaveLength(0)
  }
}

// 鈹€鈹€ Tests 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

describe("ingest scenarios (fixture-driven)", () => {
  it.each(ingestScenarios.map((s) => [s.name, s]))(
    "%s",
    async (_name, scenario) => {
      ctx = await setup(scenario)

      const sourceFullPath = path.join(ctx.tmp.path, scenario.source.path)
      await autoIngest(
        ctx.tmp.path,
        sourceFullPath,
        useWikiStore.getState().llmConfig,
      )

      await assertOutcome(scenario, ctx.tmp.path)
    },
  )

  it("passes Stage 1 Source Profile into the RPG generation prompt builder", async () => {
    ctx = { tmp: await createTempProject("ingest-stage1-profile-to-stage2") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/.llm-wiki/project.json`, JSON.stringify({ mode: "llmwikirpg" }))
    await writeFileRaw(`${projectPath}/schema.md`, "Target path: wiki/characters/should-not-drive-stage-2.md")
    await writeFileRaw(`${projectPath}/purpose.md`, "")
    await writeFileRaw(`${projectPath}/wiki/index.md`, "# Index\n")
    await writeFileRaw(`${projectPath}/wiki/overview.md`, "")
    await writeFileRaw(`${projectPath}/raw/sources/session.md`, "This source describes only a stable world rule.")

    useWikiStore.setState({
      project: {
        name: "t",
        path: projectPath,
        createdAt: 0,
        purposeText: "",
        fileTree: [],
      } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
    })
    useWikiStore.getState().setLlmConfig({
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-4",
      ollamaUrl: "",
      customEndpoint: "",
      maxContextSize: 128000,
    })

    pendingResponses = [
      [
        "## Source Profile",
        "- source_kind: setting_encyclopedia",
        "- dominant_focus: stable world rule",
        "- needed_categories: [world]",
        "- suppressed_categories: [characters]",
        "- live_scene_allowed: false",
        "- event_extraction_mode: none",
        "",
        "## Candidate Objects",
        "- Name: stable world rule",
      ].join("\n"),
      [
        "---FILE: wiki/sources/session.md---",
        "---",
        'type: "source"',
        'title: "Source: session.md"',
        'sources: ["raw/sources/session.md"]',
        "tags: []",
        "related: []",
        "---",
        "",
        "# Source: session.md",
        "---END FILE---",
      ].join("\n"),
    ]

    await autoIngest(
      projectPath,
      `${projectPath}/raw/sources/session.md`,
      useWikiStore.getState().llmConfig,
    )

    expect(observedSystemPrompts[1]).toContain("World contract:")
    expect(observedSystemPrompts[1]).not.toContain("Character page contract for wiki/characters/*.md")
  })

  it("keeps source summaries distinct for same basenames in different source folders", async () => {
    ctx = { tmp: await createTempProject("ingest-duplicate-source-basenames") }
    const projectPath = ctx.tmp.path

    await writeRpgProjectFiles(projectPath)
    await writeFileRaw(`${projectPath}/raw/sources/project-a/config.yaml`, "name: project-a\n")
    await writeFileRaw(`${projectPath}/raw/sources/project-b/config.yaml`, "name: project-b\n")

    useWikiStore.setState({
      project: {
        name: "t",
        path: projectPath,
        createdAt: 0,
        purposeText: "",
        fileTree: [],
      } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
    })
    useWikiStore.getState().setLlmConfig({
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-4",
      ollamaUrl: "",
      customEndpoint: "",
      maxContextSize: 128000,
    })

    pendingResponses = [
      "analysis for project A",
      [
        "---FILE: wiki/sources/config.md---",
        "---",
        'type: "source"',
        'title: "Source: config.yaml"',
        'sources: ["config.yaml"]',
        "tags: []",
        "related: []",
        "---",
        "",
        "# Project A",
        "",
        "analysis for project A",
        "---END FILE---",
      ].join("\n"),
      "analysis for project B",
      [
        "---FILE: wiki/sources/config.md---",
        "---",
        'type: "source"',
        'title: "Source: config.yaml"',
        'sources: ["config.yaml"]',
        "tags: []",
        "related: []",
        "---",
        "",
        "# Project B",
        "",
        "analysis for project B",
        "---END FILE---",
      ].join("\n"),
    ]

    const cfg = useWikiStore.getState().llmConfig
    const firstWritten = await autoIngest(
      projectPath,
      `${projectPath}/raw/sources/project-a/config.yaml`,
      cfg,
    )
    const secondWritten = await autoIngest(
      projectPath,
      `${projectPath}/raw/sources/project-b/config.yaml`,
      cfg,
    )

    expect(firstWritten).toContain("wiki/sources/9-project-a--6-config--3eym4.md")
    expect(secondWritten).toContain("wiki/sources/9-project-b--6-config--177z4nx.md")
    expect(await fileExists(`${projectPath}/wiki/sources/config.md`)).toBe(false)

    const projectA = await readFileRaw(`${projectPath}/wiki/sources/9-project-a--6-config--3eym4.md`)
    const projectB = await readFileRaw(`${projectPath}/wiki/sources/9-project-b--6-config--177z4nx.md`)
    expect(projectA).toContain('sources: ["project-a/config.yaml"]')
    expect(projectA).toContain("analysis for project A")
    expect(projectB).toContain('sources: ["project-b/config.yaml"]')
    expect(projectB).toContain("analysis for project B")
  })

  it("overwrites current-scene snapshots into a single RPG state file", async () => {
    ctx = { tmp: await createTempProject("ingest-rpg-current-scene") }
    const projectPath = ctx.tmp.path

    await writeRpgProjectFiles(projectPath)
    await writeFileRaw(`${projectPath}/raw/sources/turn-1.md`, "[RPG-LIVE]\nturn one")
    await writeFileRaw(`${projectPath}/raw/sources/turn-2.md`, "[RPG-LIVE]\nturn two")

    useWikiStore.setState({
      project: {
        name: "t",
        path: projectPath,
        createdAt: 0,
        purposeText: "",
        fileTree: [],
      } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
    })

    const cfg = useWikiStore.getState().llmConfig
    pendingResponses = [
      "analysis one",
      [
        "---FILE: wiki/current-scene/state.md---",
        "---",
        'type: "current-scene"',
        'title: "Current Scene"',
        'sources: ["turn-1.md"]',
        "---",
        "",
        "# Current Scene",
        "First scene only.",
        "---END FILE---",
      ].join("\n"),
      "analysis two",
      [
        "---FILE: wiki/current-scene/scene_state.md---",
        "---",
        'type: "current-scene"',
        'title: "Current Scene"',
        'sources: ["turn-2.md"]',
        "---",
        "",
        "# Current Scene",
        "Second scene replaces the first.",
        "---END FILE---",
      ].join("\n"),
    ]

    const firstWritten = await autoIngest(projectPath, `${projectPath}/raw/sources/turn-1.md`, cfg)
    const secondWritten = await autoIngest(projectPath, `${projectPath}/raw/sources/turn-2.md`, cfg)

    expect(firstWritten).toContain("wiki/current-scene/scene_state.md")
    expect(secondWritten).toContain("wiki/current-scene/scene_state.md")
    expect(await fileExists(`${projectPath}/wiki/current-scene/state.md`)).toBe(false)

    const scene = await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)
    expect(scene).toContain("Second scene replaces the first.")
    expect(scene).not.toContain("First scene only.")
  })

  it("blocks current-scene writes from static ending or encyclopedia material", async () => {
    ctx = { tmp: await createTempProject("ingest-rpg-static-current-scene-block") }
    const projectPath = ctx.tmp.path

    await writeRpgProjectFiles(projectPath)
    await writeFileRaw(
      `${projectPath}/raw/sources/fate-ending.md`,
      "HF True End flower-viewing ending. Years later, Shirou and Saber reunite beneath the cherry blossoms. This is an ending summary and route recap.",
    )

    useWikiStore.setState({
      project: {
        name: "t",
        path: projectPath,
        createdAt: 0,
        purposeText: "",
        fileTree: [],
      } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
    })

    const cfg = useWikiStore.getState().llmConfig
    pendingResponses = [
      "analysis one",
      [
        "---FILE: wiki/current-scene/scene_state.md---",
        "---",
        'type: "current-scene"',
        'title: "Current Scene"',
        'sources: ["fate-ending.md"]',
        "---",
        "",
        "# Current Scene",
        "Saber and Shirou watch cherry blossoms in the HF True End ending.",
        "---END FILE---",
        "",
        "---FILE: wiki/plot-arcs/heavens-feel-ending.md---",
        "---",
        'type: "plot-arcs"',
        'title: "Heaven\'s Feel Ending"',
        'sources: ["fate-ending.md"]',
        "---",
        "",
        "# Heaven's Feel Ending",
        "A route-ending summary describing the emotional resolution years later.",
        "---END FILE---",
      ].join("\n"),
    ]

    const written = await autoIngest(projectPath, `${projectPath}/raw/sources/fate-ending.md`, cfg)

    expect(written).not.toContain("wiki/current-scene/scene_state.md")
    expect(await fileExists(`${projectPath}/wiki/current-scene/scene_state.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/plot-arcs/heavens-feel-ending.md`)).toBe(true)
  })

  it("allows current-scene writes when the source explicitly states the live current scene", async () => {
    ctx = { tmp: await createTempProject("ingest-rpg-explicit-current-scene") }
    const projectPath = ctx.tmp.path

    await writeRpgProjectFiles(projectPath)
    await writeFileRaw(
      `${projectPath}/raw/sources/current-scene.md`,
      "[RPG-LIVE]\nCurrent scene: the player stands at the church gate in Fuyuki City while the GM describes lamplight inside the church.",
    )

    useWikiStore.setState({
      project: {
        name: "t",
        path: projectPath,
        createdAt: 0,
        purposeText: "",
        fileTree: [],
      } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
    })

    const cfg = useWikiStore.getState().llmConfig
    pendingResponses = [
      "analysis one",
      [
        "---FILE: wiki/current-scene/scene_state.md---",
        "---",
        'type: "current-scene"',
        'title: "Current Scene"',
        'sources: ["current-scene.md"]',
        "---",
        "",
        "# Current Scene",
        "The player stands at the church gate in Fuyuki City and is about to enter the church.",
        "---END FILE---",
      ].join("\n"),
    ]

    const written = await autoIngest(projectPath, `${projectPath}/raw/sources/current-scene.md`, cfg)

    expect(written).toContain("wiki/current-scene/scene_state.md")
    const scene = await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)
    expect(scene).toContain("church gate in Fuyuki City")
  })

  it("blocks current-scene writes from unmarked live-looking input", async () => {
    ctx = { tmp: await createTempProject("ingest-rpg-unmarked-current-scene-block") }
    const projectPath = ctx.tmp.path

    await writeRpgProjectFiles(projectPath)
    await writeFileRaw(
      `${projectPath}/raw/sources/current-scene.md`,
      "Current scene: the player stands at the church gate in Fuyuki City.\nGM: Candlelight moves behind the door.\nPlayer: I prepare to enter.",
    )

    useWikiStore.setState({
      project: {
        name: "t",
        path: projectPath,
        createdAt: 0,
        purposeText: "",
        fileTree: [],
      } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
    })

    const cfg = useWikiStore.getState().llmConfig
    pendingResponses = [
      "analysis one",
      [
        "---FILE: wiki/current-scene/scene_state.md---",
        "---",
        'type: "current-scene"',
        'title: "Current Scene"',
        'sources: ["current-scene.md"]',
        "---",
        "",
        "# Current Scene",
        "The player stands at the church gate in Fuyuki City and is about to enter the church.",
        "---END FILE---",
      ].join("\n"),
    ]

    const written = await autoIngest(projectPath, `${projectPath}/raw/sources/current-scene.md`, cfg)

    expect(written).not.toContain("wiki/current-scene/scene_state.md")
    expect(await fileExists(`${projectPath}/wiki/current-scene/scene_state.md`)).toBe(false)
  })

  it("uses RPG writer semantics for interactive ingest writes", async () => {
    ctx = { tmp: await createTempProject("interactive-rpg-writer") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/schema.md`, "wikiMode: llmwikirpg\n")
    await writeFileRaw(`${projectPath}/purpose.md`, "# Purpose\n\nTrack live RPG state.\n")
    await writeFileRaw(`${projectPath}/wiki/index.md`, "# Index\n")
    await writeFileRaw(
      `${projectPath}/raw/sources/current-scene.md`,
      "[RPG-LIVE]\nCurrent scene: live session record. The player waits in a quiet room while the GM asks for the next action.",
    )

    useWikiStore.setState({
      project: {
        name: "t",
        path: projectPath,
        createdAt: 0,
        purposeText: "",
        fileTree: [],
      } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
    })

    const conversationId = "interactive-rpg-writer"
    useChatStore.setState({
      activeConversationId: conversationId,
      conversations: [
        {
          id: conversationId,
          title: "Interactive RPG writer",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      ingestSource: `${projectPath}/raw/sources/current-scene.md`,
      messages: [
        {
          id: "user-1",
          role: "user",
          content: "Save the current scene and note the broad timeline concern.",
          timestamp: Date.now(),
          conversationId,
        },
        {
          id: "assistant-1",
          role: "assistant",
          content: "Ready to write the RPG pages.",
          timestamp: Date.now(),
          conversationId,
        },
      ],
      mode: "ingest",
      isStreaming: false,
      streamingContent: "",
    })

    pendingResponses = [
      [
        "---FILE: wiki/current-scene/custom-name.md---",
        "---",
        'type: "current-scene"',
        'title: "Current Scene"',
        'sources: ["current-scene.md"]',
        "---",
        "",
        "# Current Scene",
        "The player waits in a quiet room for the next action.",
        "---END FILE---",
        "",
        "---FILE: wiki/events/timeline.md---",
        "---",
        'type: "event"',
        'title: "Route Timeline"',
        'sources: ["current-scene.md"]',
        "---",
        "",
        "# Route Timeline",
        "This route timeline spans the prologue and the later confrontation.",
        "---END FILE---",
      ].join("\n"),
    ]

    const written = await executeIngestWrites(
      projectPath,
      useWikiStore.getState().llmConfig,
    )

    expect(written).toContain(`${projectPath}/wiki/current-scene/scene_state.md`)
    expect(written).toContain(`${projectPath}/wiki/events/timeline.md`)
    expect(await fileExists(`${projectPath}/wiki/current-scene/custom-name.md`)).toBe(false)

    const scene = await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)
    expect(scene).toContain("quiet room")
    expect(scene).toContain('sources: ["current-scene.md"]')

    const reviews = useReviewStore.getState().items
    expect(reviews.some((item) => item.title.includes("event page may belong in plot-arcs"))).toBe(true)
  })

  it("appends RPG events without invoking page merge", async () => {
    ctx = { tmp: await createTempProject("ingest-rpg-events") }
    const projectPath = ctx.tmp.path

    await writeRpgProjectFiles(projectPath)
    await writeFileRaw(`${projectPath}/raw/sources/turn-1.md`, "turn one")
    await writeFileRaw(`${projectPath}/raw/sources/turn-2.md`, "turn two")

    useWikiStore.setState({
      project: {
        name: "t",
        path: projectPath,
        createdAt: 0,
        purposeText: "",
        fileTree: [],
      } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
    })

    const cfg = useWikiStore.getState().llmConfig
    pendingResponses = [
      "analysis one",
      [
        "---FILE: wiki/events/timeline.md---",
        "---",
        'type: "events"',
        'title: "Timeline"',
        'sources: ["turn-1.md"]',
        "---",
        "",
        "# Timeline",
        "- Event one happened.",
        "---END FILE---",
      ].join("\n"),
      "analysis two",
      [
        "---FILE: wiki/events/timeline.md---",
        "---",
        'type: "events"',
        'title: "Timeline"',
        'sources: ["turn-2.md"]',
        "---",
        "",
        "# Timeline Update",
        "- Event two happened.",
        "---END FILE---",
      ].join("\n"),
    ]

    await autoIngest(projectPath, `${projectPath}/raw/sources/turn-1.md`, cfg)
    await autoIngest(projectPath, `${projectPath}/raw/sources/turn-2.md`, cfg)

    const timeline = await readFileRaw(`${projectPath}/wiki/events/timeline.md`)
    expect(timeline).toContain("Event one happened.")
    expect(timeline).toContain("Event two happened.")
    expect(timeline.match(/^---$/gm)).toHaveLength(2)
  })

  it("drops RPG event pages that contain future-planning sections", async () => {
    ctx = { tmp: await createTempProject("ingest-rpg-event-pollution-guard") }
    const projectPath = ctx.tmp.path

    await writeRpgProjectFiles(projectPath)
    await writeFileRaw(`${projectPath}/raw/sources/turn-1.md`, "turn one")

    useWikiStore.setState({
      project: {
        name: "t",
        path: projectPath,
        createdAt: 0,
        purposeText: "",
        fileTree: [],
      } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
    })

    const cfg = useWikiStore.getState().llmConfig
    pendingResponses = [
      "analysis one",
      [
        "---FILE: wiki/events/timeline.md---",
        "---",
        'type: "events"',
        'title: "Timeline"',
        'sources: ["turn-1.md"]',
        "---",
        "",
        "# Timeline",
        "",
        "## Summary",
        "The player escaped the warehouse.",
        "",
        "## Next Steps",
        "The player may investigate the mayor next.",
        "---END FILE---",
      ].join("\n"),
    ]

    await autoIngest(projectPath, `${projectPath}/raw/sources/turn-1.md`, cfg)

    expect(await fileExists(`${projectPath}/wiki/events/timeline.md`)).toBe(false)
  })

  it("adds RPG extraction lint review items for suspicious routing and omissions", async () => {
    ctx = { tmp: await createTempProject("ingest-rpg-extraction-lint") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/schema.md`, 'wikiMode: llmwikirpg\n')
    await writeFileRaw(`${projectPath}/purpose.md`, "")
    await writeFileRaw(`${projectPath}/wiki/index.md`, "# Index\n")
    await writeFileRaw(
      `${projectPath}/raw/sources/fate-summary.md`,
      "Encyclopedia summary: Shirou acts near Ryuudou Temple in Fuyuki City, while the Mage Association and Holy Church both intervene in the conflict.",
    )

    useWikiStore.setState({
      project: {
        name: "t",
        path: projectPath,
        createdAt: 0,
        purposeText: "",
        fileTree: [],
      } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
    })

    const cfg = useWikiStore.getState().llmConfig
    pendingResponses = [
      "analysis one",
      [
        "---FILE: wiki/player/archer.md---",
        "---",
        'type: "player"',
        'title: "Archer"',
        'sources: ["fate-summary.md"]',
        "---",
        "",
        "# Archer",
        "A canon servant from the original work.",
        "---END FILE---",
        "",
        "---FILE: wiki/current-scene/scene_state.md---",
        "---",
        'type: "current-scene"',
        'title: "Current Scene"',
        'sources: ["fate-summary.md"]',
        "---",
        "",
        "# Current Scene",
        "Shirou reflects on Fuyuki City years after the ending.",
        "---END FILE---",
      ].join("\n"),
    ]

    await autoIngest(projectPath, `${projectPath}/raw/sources/fate-summary.md`, cfg)

    const reviews = useReviewStore.getState().items
    expect(reviews.some((item) => item.title.includes("suspicious player page"))).toBe(true)
    expect(reviews.some((item) => item.title.includes("current-scene"))).toBe(true)
    expect(reviews.some((item) => item.title.includes("missing locations"))).toBe(true)
    expect(reviews.some((item) => item.title.includes("missing factions"))).toBe(true)
  })

  it("keeps canon-cast summary output in characters, relationships, locations, and factions without stray player or trope concepts pages", async () => {
    ctx = { tmp: await createTempProject("ingest-rpg-canon-cast-routing") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/schema.md`, "wikiMode: llmwikirpg\n")
    await writeFileRaw(`${projectPath}/purpose.md`, "")
    await writeFileRaw(`${projectPath}/wiki/index.md`, "# Index\n")
    await writeFileRaw(
      `${projectPath}/raw/sources/fate-cast-summary.md`,
      "Rin Tohsaka, Sakura Matou, Shirou Emiya, and Saber appear in Fuyuki City during the Holy Grail War. The Tohsaka Family, Matou Family, Mage Association, and Holy Church are all involved in the conflict.",
    )

    useWikiStore.setState({
      project: {
        name: "t",
        path: projectPath,
        createdAt: 0,
        purposeText: "",
        fileTree: [],
      } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
    })

    const cfg = useWikiStore.getState().llmConfig
    pendingResponses = [
      "analysis one",
      [
        "---FILE: wiki/characters/rin.md---",
        "---",
        'type: "characters"',
        'title: "Rin Tohsaka"',
        'sources: ["fate-cast-summary.md"]',
        "---",
        "",
        "# Rin Tohsaka",
        "A key mage aligned with the core conflict in Fuyuki City.",
        "---END FILE---",
        "",
        "---FILE: wiki/characters/sakura.md---",
        "---",
        'type: "characters"',
        'title: "Sakura Matou"',
        'sources: ["fate-cast-summary.md"]',
        "---",
        "",
        "# Sakura Matou",
        "A central character tied to multiple factions in the source summary.",
        "---END FILE---",
        "",
        "---FILE: wiki/characters/shirou.md---",
        "---",
        'type: "characters"',
        'title: "Shirou Emiya"',
        'sources: ["fate-cast-summary.md"]',
        "---",
        "",
        "# Shirou Emiya",
        "The original-work protagonist appears here as a canon character rather than a custom RPG role.",
        "---END FILE---",
        "",
        "---FILE: wiki/relationships/rin-shirou.md---",
        "---",
        'type: "relationships"',
        'title: "Rin Tohsaka and Shirou Emiya"',
        'sources: ["fate-cast-summary.md"]',
        "---",
        "",
        "# Rin Tohsaka and Shirou Emiya",
        "They cooperate and clash as the conflict unfolds.",
        "---END FILE---",
        "",
        "---FILE: wiki/locations/fuyuki-city.md---",
        "---",
        'type: "locations"',
        'title: "Fuyuki City"',
        'sources: ["fate-cast-summary.md"]',
        "---",
        "",
        "# Fuyuki City",
        "The main location where the Holy Grail War conflict takes place.",
        "---END FILE---",
        "",
        "---FILE: wiki/factions/tohsaka-family.md---",
        "---",
        'type: "factions"',
        'title: "Tohsaka Family"',
        'sources: ["fate-cast-summary.md"]',
        "---",
        "",
        "# Tohsaka Family",
        "An important mage family involved in the conflict.",
        "---END FILE---",
        "",
        "---FILE: wiki/factions/matou-family.md---",
        "---",
        'type: "factions"',
        'title: "Matou Family"',
        'sources: ["fate-cast-summary.md"]',
        "---",
        "",
        "# Matou Family",
        "A second important family tied to Sakura and the ongoing conflict.",
        "---END FILE---",
      ].join("\n"),
    ]

    const written = await autoIngest(projectPath, `${projectPath}/raw/sources/fate-cast-summary.md`, cfg)

    expect(written).toContain("wiki/characters/rin.md")
    expect(written).toContain("wiki/characters/sakura.md")
    expect(written).toContain("wiki/characters/shirou.md")
    expect(written).toContain("wiki/relationships/rin-shirou.md")
    expect(written).toContain("wiki/locations/fuyuki-city.md")
    expect(written).toContain("wiki/factions/tohsaka-family.md")
    expect(written).toContain("wiki/factions/matou-family.md")

    expect(await fileExists(`${projectPath}/wiki/player/shirou.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/concepts/poor-moe.md`)).toBe(false)
    expect(useReviewStore.getState().items).toHaveLength(0)
  })
})


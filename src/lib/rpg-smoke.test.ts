import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { realFs, createTempProject, readFileRaw, writeFileRaw, fileExists } from "@/test-helpers/fs-temp"
import { sourceIdentityForPath, sourceSummarySlugFromIdentity } from "@/lib/source-identity"
import { detectWikiMode } from "./wiki-mode"
import { inferWikiTypeFromPath } from "./wiki-page-types"
import { prioritizeChatSearchResults } from "./rpg-query-priority"
import type { SearchResult } from "./search"

vi.mock("@/commands/fs", () => realFs)

let pendingResponses: string[] = []
vi.mock("./llm-client", () => ({
  streamChat: vi.fn(async (_cfg, _msgs, cb) => {
    const resp = pendingResponses.shift() ?? ""
    cb.onToken(resp)
    cb.onDone()
  }),
}))

import { autoIngest } from "./ingest"
import { useWikiStore } from "@/stores/wiki-store"
import { useReviewStore } from "@/stores/review-store"
import { useActivityStore } from "@/stores/activity-store"
import { useChatStore } from "@/stores/chat-store"

interface Ctx {
  tmp: { path: string; cleanup: () => Promise<void> }
}

let ctx: Ctx | undefined

const RPG_SCHEMA = [
  "wikiMode: llmwikirpg",
  "",
  "# Schema",
  "",
  "## wiki/world/",
  "Stable world facts.",
  "",
  "## wiki/characters/",
  "Important NPCs.",
  "",
  "## wiki/player/",
  "Player character state.",
  "",
  "## wiki/locations/",
  "Places and scene locations.",
  "",
  "## wiki/factions/",
  "Groups and organizations.",
  "",
  "## wiki/items/",
  "Important items.",
  "",
  "## wiki/plot-arcs/",
  "Open conflicts and future directions.",
  "",
  "## wiki/events/",
  "Confirmed past events.",
  "",
  "## wiki/current-scene/",
  "Latest scene snapshot only.",
  "",
  "## wiki/relationships/",
  "Relationship state and tension.",
].join("\n")

function queueIngest(analysis: string, generation: string) {
  pendingResponses.push(analysis, generation)
}

function expectedSourceSummaryPath(projectPath: string, sourceFullPath: string): string {
  const sourceIdentity = sourceIdentityForPath(projectPath, sourceFullPath)
  const slug = sourceSummarySlugFromIdentity(sourceIdentity)
  return `${projectPath}/wiki/sources/${slug}.md`
}

function makeResult(path: string, score: number): SearchResult {
  return {
    path,
    score,
    title: path.split("/").pop() ?? path,
    snippet: "",
    titleMatch: false,
    images: [],
  }
}

beforeEach(() => {
  pendingResponses = []
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

afterEach(async () => {
  if (ctx) {
    await ctx.tmp.cleanup()
    ctx = undefined
  }
})

describe("Stage 10 RPG smoke test", () => {
  it("routes sample RPG material into first-version RPG directories and preserves live-state semantics", async () => {
    ctx = { tmp: await createTempProject("rpg-smoke-test") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/schema.md`, RPG_SCHEMA)
    await writeFileRaw(`${projectPath}/purpose.md`, "# Purpose\n\nTrack a story-driven tabletop RPG campaign.\n")
    await writeFileRaw(`${projectPath}/wiki/index.md`, "# Index\n\n- [[world/basic-overview]]\n")

    const worldSourcePath = `${projectPath}/raw/sources/world-guide.md`
    const heroSourcePath = `${projectPath}/raw/sources/hero-sheet.md`
    const turnOneSourcePath = `${projectPath}/raw/sources/session-01.md`
    const turnTwoSourcePath = `${projectPath}/raw/sources/session-02.md`

    await writeFileRaw(
      worldSourcePath,
      [
        "# Harborfall Gazetteer",
        "",
        "Harborfall is a fog-bound canal city built over sealed tunnels.",
        "The Amber Guild controls cargo permits.",
        "A brass lantern key opens tide gates beneath the river port.",
      ].join("\n"),
    )
    await writeFileRaw(
      heroSourcePath,
      [
        "# Hero Sheet",
        "",
        "Player character: Iven, a smuggler-mage hunting the missing ferryman.",
        "Mira Vale is a canal scout who distrusts authority but helps Iven.",
      ].join("\n"),
    )
    await writeFileRaw(
      turnOneSourcePath,
      [
        "# Session 01",
        "",
        "Iven and Mira descend into the flooded customs tunnel.",
        "They hear warning bells and discover the lantern key matches an iron gate.",
      ].join("\n"),
    )
    await writeFileRaw(
      turnTwoSourcePath,
      [
        "# Session 02",
        "",
        "The canal gate is locked from above.",
        "Mira bargains with a dock runner while Iven hides the lantern key.",
      ].join("\n"),
    )

    useWikiStore.setState({
      project: {
        name: "Harborfall",
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

    queueIngest(
      [
        "## RPG Extraction",
        "- world/basic-overview.md",
        "- locations/river-port.md",
        "- factions/amber-guild.md",
        "- items/lantern-key.md",
      ].join("\n"),
      [
        "---FILE: wiki/world/basic-overview.md---",
        "---",
        'type: "world"',
        'title: "Harborfall Overview"',
        'sources: ["world-guide.md"]',
        "---",
        "",
        "# Harborfall",
        "",
        "Harborfall is a fog-bound canal city built over sealed tunnels.",
        "",
        "## Known Facts",
        "- Tide gates below the river port are old civic infrastructure.",
        "- The Amber Guild controls cargo permits and canal access.",
        "---END FILE---",
        "",
        "---FILE: wiki/locations/river-port.md---",
        "---",
        'type: "locations"',
        'title: "River Port"',
        'sources: ["world-guide.md"]',
        "---",
        "",
        "# River Port",
        "",
        "A crowded canal district above the sealed customs tunnels.",
        "---END FILE---",
        "",
        "---FILE: wiki/factions/amber-guild.md---",
        "---",
        'type: "factions"',
        'title: "Amber Guild"',
        'sources: ["world-guide.md"]',
        "---",
        "",
        "# Amber Guild",
        "",
        "The guild controls cargo permits, dock labor, and toll records.",
        "---END FILE---",
        "",
        "---FILE: wiki/items/lantern-key.md---",
        "---",
        'type: "items"',
        'title: "Lantern Key"',
        'sources: ["world-guide.md"]',
        "---",
        "",
        "# Lantern Key",
        "",
        "A brass key that unlocks tide gates beneath the city.",
        "---END FILE---",
        "",
        "---FILE: wiki/sources/world-guide.md---",
        "---",
        'type: "source"',
        'title: "Source: world-guide.md"',
        'sources: ["world-guide.md"]',
        "---",
        "",
        "# Source: world-guide.md",
        "",
        "Worldbook summary covering Harborfall, the Amber Guild, and the lantern key.",
        "---END FILE---",
      ].join("\n"),
    )

    queueIngest(
      [
        "## RPG Extraction",
        "- characters/mira-vale.md",
        "- player/player.md",
        "- relationships/player-mira.md",
      ].join("\n"),
      [
        "---FILE: wiki/characters/mira-vale.md---",
        "---",
        'type: "characters"',
        'title: "Mira Vale"',
        'sources: ["hero-sheet.md"]',
        "---",
        "",
        "# Mira Vale",
        "",
        "A canal scout who distrusts authority and knows the flooded tunnels.",
        "---END FILE---",
        "",
        "---FILE: wiki/player/player.md---",
        "---",
        'type: "player"',
        'title: "Iven"',
        'sources: ["hero-sheet.md"]',
        "---",
        "",
        "# Iven",
        "",
        "Smuggler-mage searching for the missing ferryman.",
        "",
        "## Current Goals",
        "- Find the ferryman before the Amber Guild covers its tracks.",
        "---END FILE---",
        "",
        "---FILE: wiki/relationships/player-mira.md---",
        "---",
        'type: "relationships"',
        'title: "Iven and Mira Vale"',
        'sources: ["hero-sheet.md"]',
        "---",
        "",
        "# Iven and Mira Vale",
        "",
        "Mira helps Iven, but she still tests whether he can be trusted.",
        "---END FILE---",
        "",
        "---FILE: wiki/sources/hero-sheet.md---",
        "---",
        'type: "source"',
        'title: "Source: hero-sheet.md"',
        'sources: ["hero-sheet.md"]',
        "---",
        "",
        "# Source: hero-sheet.md",
        "",
        "Character sheet summary for Iven and ally profile for Mira Vale.",
        "---END FILE---",
      ].join("\n"),
    )

    queueIngest(
      [
        "## RPG Extraction",
        "- current-scene/state.md",
        "- events/timeline.md",
        "- plot-arcs/shadow-below-the-port.md",
      ].join("\n"),
      [
        "---FILE: wiki/current-scene/state.md---",
        "---",
        'type: "current-scene"',
        'title: "Current Scene"',
        'sources: ["session-01.md"]',
        "---",
        "",
        "# Current Scene",
        "",
        "Iven and Mira stand in the flooded customs tunnel while warning bells echo overhead.",
        "---END FILE---",
        "",
        "---FILE: wiki/events/timeline.md---",
        "---",
        'type: "events"',
        'title: "Timeline"',
        'sources: ["session-01.md"]',
        "---",
        "",
        "# Timeline",
        "",
        "- Session 01: Iven and Mira entered the flooded customs tunnel and found that the lantern key fits an iron gate.",
        "---END FILE---",
        "",
        "---FILE: wiki/plot-arcs/shadow-below-the-port.md---",
        "---",
        'type: "plot-arcs"',
        'title: "Shadow Below the Port"',
        'sources: ["session-01.md"]',
        "---",
        "",
        "# Shadow Below the Port",
        "",
        "The missing ferryman, the sealed tide gate, and the Amber Guild are tied to the same hidden route.",
        "---END FILE---",
        "",
        "---FILE: wiki/sources/session-01.md---",
        "---",
        'type: "source"',
        'title: "Source: session-01.md"',
        'sources: ["session-01.md"]',
        "---",
        "",
        "# Source: session-01.md",
        "",
        "Turn summary for the first tunnel descent and gate discovery.",
        "---END FILE---",
      ].join("\n"),
    )

    queueIngest(
      [
        "## RPG Extraction",
        "- current-scene/scene_state.md",
        "- events/timeline.md",
      ].join("\n"),
      [
        "---FILE: wiki/current-scene/scene_state.md---",
        "---",
        'type: "current-scene"',
        'title: "Current Scene"',
        'sources: ["session-02.md"]',
        "---",
        "",
        "# Current Scene",
        "",
        "The canal gate is now locked from above while Mira bargains with a dock runner and Iven hides the lantern key under his coat.",
        "---END FILE---",
        "",
        "---FILE: wiki/events/timeline.md---",
        "---",
        'type: "events"',
        'title: "Timeline"',
        'sources: ["session-02.md"]',
        "---",
        "",
        "# Timeline Update",
        "",
        "- Session 02: The canal gate was locked from above, forcing Mira to negotiate for a route while Iven concealed the lantern key.",
        "---END FILE---",
        "",
        "---FILE: wiki/sources/session-02.md---",
        "---",
        'type: "source"',
        'title: "Source: session-02.md"',
        'sources: ["session-02.md"]',
        "---",
        "",
        "# Source: session-02.md",
        "",
        "Turn summary for the locked canal gate and the new dock-runner contact.",
        "---END FILE---",
      ].join("\n"),
    )

    const llmConfig = useWikiStore.getState().llmConfig
    await autoIngest(projectPath, worldSourcePath, llmConfig)
    await autoIngest(projectPath, heroSourcePath, llmConfig)
    await autoIngest(projectPath, turnOneSourcePath, llmConfig)
    await autoIngest(projectPath, turnTwoSourcePath, llmConfig)

    const expectedFiles = [
      `${projectPath}/wiki/world/basic-overview.md`,
      `${projectPath}/wiki/characters/mira-vale.md`,
      `${projectPath}/wiki/player/player.md`,
      `${projectPath}/wiki/locations/river-port.md`,
      `${projectPath}/wiki/factions/amber-guild.md`,
      `${projectPath}/wiki/items/lantern-key.md`,
      `${projectPath}/wiki/plot-arcs/shadow-below-the-port.md`,
      `${projectPath}/wiki/events/timeline.md`,
      `${projectPath}/wiki/current-scene/scene_state.md`,
      `${projectPath}/wiki/relationships/player-mira.md`,
      expectedSourceSummaryPath(projectPath, worldSourcePath),
      expectedSourceSummaryPath(projectPath, heroSourcePath),
      expectedSourceSummaryPath(projectPath, turnOneSourcePath),
      expectedSourceSummaryPath(projectPath, turnTwoSourcePath),
    ]

    for (const filePath of expectedFiles) {
      expect(await fileExists(filePath), `missing expected RPG smoke output: ${filePath}`).toBe(true)
    }

    expect(await fileExists(`${projectPath}/wiki/entities`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/concepts`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/current-scene/state.md`)).toBe(false)

    const sceneState = await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)
    expect(sceneState).toContain("locked from above")
    expect(sceneState).not.toContain("warning bells echo overhead")

    const timeline = await readFileRaw(`${projectPath}/wiki/events/timeline.md`)
    expect(timeline).toContain("Session 01")
    expect(timeline).toContain("Session 02")

    const schema = await readFileRaw(`${projectPath}/schema.md`)
    const index = await readFileRaw(`${projectPath}/wiki/index.md`)
    expect(detectWikiMode({ schema, index, paths: expectedFiles })).toBe("llmwikirpg")

    expect(inferWikiTypeFromPath(`${projectPath}/wiki/world/basic-overview.md`)).toBe("world")
    expect(inferWikiTypeFromPath(`${projectPath}/wiki/current-scene/scene_state.md`)).toBe("current-scene")
    expect(inferWikiTypeFromPath(`${projectPath}/wiki/relationships/player-mira.md`)).toBe("relationships")

    const prioritized = prioritizeChatSearchResults([
      makeResult(`${projectPath}/wiki/world/basic-overview.md`, 30),
      makeResult(`${projectPath}/wiki/player/player.md`, 25),
      makeResult(`${projectPath}/wiki/current-scene/scene_state.md`, 10),
      makeResult(`${projectPath}/wiki/events/timeline.md`, 20),
    ])
    expect(prioritized.map((result) => inferWikiTypeFromPath(result.path)).slice(0, 3)).toEqual([
      "current-scene",
      "player",
      "events",
    ])

    expect(useReviewStore.getState().items).toHaveLength(0)
  })
})

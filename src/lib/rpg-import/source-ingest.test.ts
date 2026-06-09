import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { LlmConfig } from "@/stores/wiki-store"
import { realFs, createTempProject, readFileRaw, writeFileRaw } from "@/test-helpers/fs-temp"
import { useWikiStore } from "@/stores/wiki-store"
import { useReviewStore, type ReviewItem } from "@/stores/review-store"
import { useActivityStore } from "@/stores/activity-store"
import { useChatStore } from "@/stores/chat-store"
import { autoIngest } from "@/lib/ingest"
import { runRpgImport } from "./pipeline"

vi.mock("@/commands/fs", () => realFs)

let pendingResponses: string[] = []
vi.mock("@/lib/llm-client", () => ({
  streamChat: vi.fn(async (_cfg, _msgs, cb) => {
    const resp = pendingResponses.shift() ?? ""
    cb.onToken(resp)
    cb.onDone()
  }),
}))

const llmConfig: LlmConfig = {
  provider: "openai",
  apiKey: "test-key",
  model: "gpt-4",
  ollamaUrl: "",
  customEndpoint: "",
  maxContextSize: 128000,
}

const analysisResponse = [
  "## Source Profile",
  "- source_kind: setting_note",
  "- dominant_focus: Moonlit Archive setting note",
  "- needed_categories: [sources, world]",
  "- suppressed_categories: []",
  "- event_extraction_mode: none",
].join("\n")

const generationResponse = [
  "---FILE: wiki/sources/source.md---",
  "---",
  'type: "source"',
  'title: "Source: source.md"',
  'sources: ["source.md"]',
  "tags: []",
  "related: []",
  "---",
  "",
  "# Source: source.md",
  "",
  "A concise source summary for the Moonlit Archive note.",
  "---END FILE---",
  "",
  "---FILE: wiki/world/moonlit-archive.md---",
  "---",
  'type: "world"',
  'title: "Moonlit Archive"',
  'sources: ["source.md"]',
  "tags: []",
  "related: []",
  "---",
  "",
  "# Moonlit Archive",
  "",
  "The Moonlit Archive keeps sealed maps for navigators.",
  "---END FILE---",
  "",
  "---REVIEW: suggestion | Track sealed-map access---",
  "PAGES: wiki/world/moonlit-archive.md, wiki/sources/source.md",
  "SEARCH: sealed maps | Moonlit Archive access",
  "Check whether sealed-map access should become a future rules or quest note.",
  "OPTIONS: Approve | Skip",
  "---END REVIEW---",
].join("\n")

const sourceRelPath = "raw/sources/source.md"

let cleanups: Array<() => Promise<void>> = []

beforeEach(() => {
  pendingResponses = []
  cleanups = []
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
  for (const cleanup of cleanups) {
    await cleanup()
  }
  cleanups = []
})

async function createProject(label: string): Promise<string> {
  const tmp = await createTempProject(label)
  cleanups.push(tmp.cleanup)

  await writeFileRaw(`${tmp.path}/.llm-wiki/project.json`, JSON.stringify({ mode: "llmwikirpg" }))
  await writeFileRaw(`${tmp.path}/schema.md`, "wikiMode: llmwikirpg\n")
  await writeFileRaw(`${tmp.path}/purpose.md`, "# Purpose\n\nTrack RPG source material.\n")
  await writeFileRaw(`${tmp.path}/wiki/index.md`, "# Index\n")
  await writeFileRaw(`${tmp.path}/wiki/overview.md`, "# Overview\n")
  await writeFileRaw(
    `${tmp.path}/${sourceRelPath}`,
    "The Moonlit Archive keeps sealed maps for navigators.",
  )

  return tmp.path
}

function activateProject(projectPath: string): void {
  useWikiStore.setState({
    project: {
      name: "rpg-import-test",
      path: projectPath,
      createdAt: 0,
      purposeText: "",
      fileTree: [],
    } as unknown as ReturnType<typeof useWikiStore.getState>["project"],
    llmConfig,
    embeddingConfig: {
      enabled: false,
      endpoint: "",
      apiKey: "",
      model: "",
    },
    multimodalConfig: {
      enabled: false,
      useMainLlm: true,
      provider: "custom",
      apiKey: "",
      model: "",
      ollamaUrl: "",
      customEndpoint: "",
      concurrency: 1,
    },
  })
}

function queueIngestResponses(): void {
  pendingResponses = [analysisResponse, generationResponse]
}

function reviewSemantics(items: ReviewItem[]) {
  return items.map((item) => ({
    type: item.type,
    title: item.title,
    description: item.description,
    affectedPages: item.affectedPages,
    searchQueries: item.searchQueries,
  }))
}

describe("RPG import source_ingest", () => {
  it("matches direct autoIngest written paths, file contents, and review semantics", async () => {
    const projectA = await createProject("rpg-import-direct")
    const projectB = await createProject("rpg-import-wrapper")
    const sourceA = `${projectA}/${sourceRelPath}`
    const sourceB = `${projectB}/${sourceRelPath}`

    activateProject(projectA)
    queueIngestResponses()
    const directWritten = await autoIngest(projectA, sourceA, llmConfig)
    const directReviews = reviewSemantics(useReviewStore.getState().items)

    useReviewStore.setState({ items: [] })

    activateProject(projectB)
    queueIngestResponses()
    const wrapperResult = await runRpgImport({
      mode: "source_ingest",
      projectPath: projectB,
      sourcePath: sourceB,
      llmConfig,
    })
    const wrapperReviews = reviewSemantics(useReviewStore.getState().items)

    expect(wrapperResult.mode).toBe("source_ingest")
    expect(wrapperResult.writtenPaths).toEqual(directWritten)
    expect(wrapperResult.reviewItems).toEqual([])
    expect(wrapperResult.warnings).toEqual([])
    expect(wrapperResult.skipped).toEqual([])

    for (const writtenPath of directWritten) {
      const directContent = await readFileRaw(`${projectA}/${writtenPath}`)
      const wrapperContent = await readFileRaw(`${projectB}/${writtenPath}`)
      expect(wrapperContent).toBe(directContent)
    }

    expect(wrapperReviews).toEqual(directReviews)
  })

  it("requires sourcePath and llmConfig for source_ingest", async () => {
    const projectPath = await createProject("rpg-import-required-fields")

    await expect(
      runRpgImport({
        mode: "source_ingest",
        projectPath,
        llmConfig,
      }),
    ).rejects.toThrow("sourcePath")

    await expect(
      runRpgImport({
        mode: "source_ingest",
        projectPath,
        sourcePath: `${projectPath}/${sourceRelPath}`,
      }),
    ).rejects.toThrow("llmConfig")
  })
})

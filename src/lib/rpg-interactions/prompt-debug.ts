import type {
  RpgInteractionPrompt,
  RpgPromptDebugContentType,
  RpgPromptDebugSection,
  RpgPromptDebugSectionSourceKind,
} from "./interaction-spec"

export interface CreateRpgPromptDebugSectionInput {
  sectionId: string
  title: string
  promptRole: "system" | "user"
  sourceKind: RpgPromptDebugSectionSourceKind
  sourceLabel: string
  contentType: RpgPromptDebugContentType
  content: string | readonly string[]
}

export function createRpgPromptDebugSection(
  input: CreateRpgPromptDebugSectionInput,
): RpgPromptDebugSection {
  return {
    ...input,
    content: typeof input.content === "string" ? input.content : input.content.join("\n"),
  }
}

export function createJsonRpgPromptDebugSection(
  input: Omit<CreateRpgPromptDebugSectionInput, "content" | "contentType"> & {
    value: unknown
    fenced?: boolean
    heading?: string
  },
): RpgPromptDebugSection {
  const json = JSON.stringify(input.value, null, 2)
  const heading = input.heading ?? (input.promptRole === "user" ? `## ${input.title}` : undefined)
  const jsonContent = input.fenced === false ? json : ["```json", json, "```"].join("\n")
  return createRpgPromptDebugSection({
    ...input,
    contentType: heading ? "markdown" : input.fenced === false ? "json" : "markdown",
    content: heading ? [heading, jsonContent] : jsonContent,
  })
}

export function buildRpgInteractionPromptFromSections(input: {
  systemSections: readonly RpgPromptDebugSection[]
  userSections: readonly RpgPromptDebugSection[]
  joiner?: string
}): RpgInteractionPrompt {
  const joiner = input.joiner ?? "\n\n"
  return {
    systemPrompt: joinRpgPromptDebugSections(input.systemSections, joiner),
    userPrompt: joinRpgPromptDebugSections(input.userSections, joiner),
    debugSections: [...input.systemSections, ...input.userSections],
  }
}

export function joinRpgPromptDebugSections(
  sections: readonly RpgPromptDebugSection[],
  joiner = "\n\n",
): string {
  return sections.map((section) => section.content).join(joiner)
}

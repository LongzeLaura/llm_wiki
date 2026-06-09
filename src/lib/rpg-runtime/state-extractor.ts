import { createRpgWikiUpdateBlockPattern } from "../rpg-interactions/runtime/runtime-update-protocol"
import { validateRpgRuntimeUpdateTarget } from "../rpg-interactions/runtime/wiki-update-policy"
import { cleanRpgReferences, type RpgTurnRecord } from "./turn-model"

export type RpgUpdateStrategy = "overwrite" | "append" | "merge"

export interface ProposedWikiUpdate {
  id: string
  targetPath: string
  strategy: RpgUpdateStrategy
  reason: string
  content: string
  sourceTurnId: string
  references: string[]
}

export interface ExtractRpgStateUpdatesInput {
  turnRecord: RpgTurnRecord
}

export interface ExtractRpgStateUpdatesResult {
  proposedUpdates: ProposedWikiUpdate[]
  warnings: string[]
}

interface ParsedUpdateBlock {
  targetPath: string
  strategy: RpgUpdateStrategy | string
  reason: string
  content: string
}

const UPDATE_BLOCK_PATTERN = createRpgWikiUpdateBlockPattern()
const HEADER_DELIMITER_PATTERN = /\r?\n---\r?\n/

export function extractRpgStateUpdates(input: ExtractRpgStateUpdatesInput): ExtractRpgStateUpdatesResult {
  const sourceTurnId = input.turnRecord.submittedAction.id
  const references = cleanRpgReferences(input.turnRecord.references)
  const proposedUpdates: ProposedWikiUpdate[] = []
  const warnings: string[] = []

  const blocks = parseUpdateBlocks(input.turnRecord.generatedNarrative, warnings)
  blocks.forEach((block, index) => {
    const validation = validateRpgRuntimeUpdateTarget(block.targetPath, block.strategy)
    if (!validation.ok) {
      warnings.push(`Skipped RPG update block ${index + 1}: ${validation.reason}`)
      return
    }

    proposedUpdates.push({
      id: createStableUpdateId(sourceTurnId, validation.targetPath, index),
      targetPath: validation.targetPath,
      strategy: validation.strategy,
      reason: block.reason,
      content: block.content,
      sourceTurnId,
      references,
    })
  })

  return { proposedUpdates, warnings }
}

function parseUpdateBlocks(narrative: string, warnings: string[]): ParsedUpdateBlock[] {
  const blocks: ParsedUpdateBlock[] = []

  for (const match of narrative.matchAll(UPDATE_BLOCK_PATTERN)) {
    const rawBlock = match[1].trim()
    const delimiterMatch = HEADER_DELIMITER_PATTERN.exec(rawBlock)
    if (!delimiterMatch) {
      warnings.push("Skipped RPG update block: missing header/content delimiter.")
      continue
    }

    const header = rawBlock.slice(0, delimiterMatch.index)
    const content = rawBlock.slice(delimiterMatch.index + delimiterMatch[0].length).trim()
    const fields = parseHeaderFields(header)
    const targetPath = fields.get("targetPath") ?? ""
    const strategy = fields.get("strategy") ?? ""
    const reason = fields.get("reason") ?? ""

    if (!targetPath || !strategy || !reason || !content) {
      warnings.push("Skipped RPG update block: targetPath, strategy, reason, and content are required.")
      continue
    }

    blocks.push({
      targetPath,
      strategy,
      reason,
      content,
    })
  }

  return blocks
}

function parseHeaderFields(header: string): Map<string, string> {
  const fields = new Map<string, string>()
  for (const line of header.split(/\r?\n/)) {
    const separator = line.indexOf(":")
    if (separator < 0) continue

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key) fields.set(key, value)
  }
  return fields
}

function createStableUpdateId(sourceTurnId: string, targetPath: string, index: number): string {
  return `rpg-update-${slugify(sourceTurnId)}-${slugify(targetPath)}-${index + 1}-${hashString(
    `${sourceTurnId}\n${targetPath}\n${index}`,
  )}`
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "item"
}

function hashString(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

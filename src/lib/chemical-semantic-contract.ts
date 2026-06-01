import contractJson from "@/lib/chemical-semantic-contract.json"
import {
  parseFrontmatterArray,
  parseFrontmatterScalar,
  writeFrontmatterArray,
  writeFrontmatterScalar,
} from "@/lib/sources-merge"
import { resolveRegisteredWikiPageType } from "@/lib/wiki-page-types"

type ChemicalContractJson = {
  reportPath: string
  pageTypes: Record<string, ChemicalPageContract>
}

type ChemicalFieldKind = "scalar" | "array"

export interface ChemicalFieldContract {
  name: string
  kind: ChemicalFieldKind
  placeholder: string | string[]
  allowedValues?: string[]
}

export interface ChemicalPageContract {
  displayLabel: string
  directory: string
  requiredFields: ChemicalFieldContract[]
}

const CHEMICAL_CONTRACT = contractJson as ChemicalContractJson

export type ChemicalPageType = keyof typeof CHEMICAL_CONTRACT.pageTypes

export const CHEMICAL_SEMANTIC_REPORT_PATH = CHEMICAL_CONTRACT.reportPath
export const CHEMICAL_PAGE_TYPES = Object.keys(CHEMICAL_CONTRACT.pageTypes) as ChemicalPageType[]

export function isChemicalPageType(value: string | null | undefined): value is ChemicalPageType {
  return typeof value === "string" && value in CHEMICAL_CONTRACT.pageTypes
}

export function getChemicalPageContract(
  pageType: string | null | undefined,
): ChemicalPageContract | null {
  if (!isChemicalPageType(pageType)) return null
  return CHEMICAL_CONTRACT.pageTypes[pageType]
}

export function inferChemicalPageType(
  content: string,
  relativePath?: string,
): ChemicalPageType | null {
  const rawType = parseFrontmatterScalar(content, "type")
  const canonicalType = resolveRegisteredWikiPageType(rawType, relativePath)
  return isChemicalPageType(canonicalType) ? canonicalType : null
}

export function applyChemicalSemanticContract(
  content: string,
  relativePath?: string,
): string {
  if (!/^---\n/.test(content)) return content

  const pageType = inferChemicalPageType(content, relativePath)
  if (!pageType) return content

  const contract = CHEMICAL_CONTRACT.pageTypes[pageType]
  let rewritten = content

  for (const field of contract.requiredFields) {
    if (field.kind === "array") {
      const values = parseFrontmatterArray(rewritten, field.name)
      if (values.length === 0) {
        rewritten = writeFrontmatterArray(
          rewritten,
          field.name,
          Array.isArray(field.placeholder) ? field.placeholder : [],
        )
      }
      continue
    }

    const rawValue = parseFrontmatterScalar(rewritten, field.name)
    const normalizedValue = normalizeScalarContractValue(rawValue, field)

    if (rawValue === null || rawValue.trim() === "") {
      rewritten = writeFrontmatterScalar(rewritten, field.name, normalizedValue)
      continue
    }

    if (normalizedValue !== rawValue) {
      rewritten = writeFrontmatterScalar(rewritten, field.name, normalizedValue)
    }
  }

  return rewritten
}

export function buildChemicalPromptContractLines(pageType: ChemicalPageType): string[] {
  const contract = CHEMICAL_CONTRACT.pageTypes[pageType]
  const fieldSummary = contract.requiredFields
    .map((field) => `${field.name}=${formatPlaceholder(field.placeholder)}`)
    .join(", ")
  return [
    `${contract.displayLabel} (${pageType}) required frontmatter fields: ${fieldSummary}.`,
  ]
}

function normalizeScalarContractValue(
  rawValue: string | null,
  field: ChemicalFieldContract,
): string {
  const trimmed = rawValue?.trim() ?? ""
  if (!trimmed) {
    return typeof field.placeholder === "string" ? field.placeholder : ""
  }
  if (!field.allowedValues || field.allowedValues.length === 0) {
    return trimmed
  }

  const canonical = trimmed
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  return field.allowedValues.includes(canonical) ? canonical : trimmed
}

function formatPlaceholder(placeholder: string | string[]): string {
  return Array.isArray(placeholder) ? "[]" : placeholder
}

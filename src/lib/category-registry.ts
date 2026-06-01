export type CategoryKind = "legacy_core" | "chemical_core" | "auxiliary"
export type CategoryOntologyLayer =
  | "none"
  | "catalytic_system"
  | "elementary_process"
  | "mechanistic_network"
  | "evidence_claim"
  | "provenance"
export type CategoryPromptRole =
  | "named_thing"
  | "abstract_concept"
  | "provenance"
  | "system"
  | "process"
  | "mechanism"
  | "evidence"
  | "auxiliary"
export type CategoryCompatibilityStatus = "primary" | "supported" | "compatibility_only"

export interface CategoryDefinition {
  id: string
  displayLabel: string
  displayLabelPlural: string
  directory: string
  legacyAliases: string[]
  kind: CategoryKind
  ontologyLayer: CategoryOntologyLayer
  promptRole: CategoryPromptRole
  defaultEnabledInLegacy: boolean
  defaultEnabledInChemical: boolean
  compatibilityStatus: CategoryCompatibilityStatus
  uiOrder: number
  styleKey: string
}

export interface CategoryProfile {
  id: string
  label: string
  activeCategoryIds: string[]
  primaryExtractionIds: string[]
  primaryDisplayIds: string[]
  fallbackGenerationIds: string[]
  sourceSummaryCategoryId: string
  preserveLegacyRoutes: boolean
}

export const LEGACY_CATEGORY_PROFILE_ID = "legacy-default"
export const CHEMICAL_CATEGORY_PROFILE_ID = "chemical-default"
export const DEFAULT_CATEGORY_PROFILE_ID = LEGACY_CATEGORY_PROFILE_ID

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: "overview",
    displayLabel: "Overview",
    displayLabelPlural: "Overview",
    directory: "wiki/",
    legacyAliases: [],
    kind: "auxiliary",
    ontologyLayer: "none",
    promptRole: "auxiliary",
    defaultEnabledInLegacy: true,
    defaultEnabledInChemical: true,
    compatibilityStatus: "primary",
    uiOrder: 0,
    styleKey: "overview",
  },
  {
    id: "source",
    displayLabel: "Source",
    displayLabelPlural: "Sources",
    directory: "wiki/sources/",
    legacyAliases: [],
    kind: "legacy_core",
    ontologyLayer: "provenance",
    promptRole: "provenance",
    defaultEnabledInLegacy: true,
    defaultEnabledInChemical: true,
    compatibilityStatus: "primary",
    uiOrder: 1,
    styleKey: "source",
  },
  {
    id: "entity",
    displayLabel: "Entity",
    displayLabelPlural: "Entities",
    directory: "wiki/entities/",
    legacyAliases: [],
    kind: "legacy_core",
    ontologyLayer: "none",
    promptRole: "named_thing",
    defaultEnabledInLegacy: true,
    defaultEnabledInChemical: true,
    compatibilityStatus: "primary",
    uiOrder: 2,
    styleKey: "entity",
  },
  {
    id: "concept",
    displayLabel: "Concept",
    displayLabelPlural: "Concepts",
    directory: "wiki/concepts/",
    legacyAliases: [],
    kind: "legacy_core",
    ontologyLayer: "none",
    promptRole: "abstract_concept",
    defaultEnabledInLegacy: true,
    defaultEnabledInChemical: true,
    compatibilityStatus: "primary",
    uiOrder: 3,
    styleKey: "concept",
  },
  {
    id: "catalytic_system",
    displayLabel: "Catalytic System",
    displayLabelPlural: "Catalytic Systems",
    directory: "wiki/catalytic-systems/",
    legacyAliases: [],
    kind: "chemical_core",
    ontologyLayer: "catalytic_system",
    promptRole: "system",
    defaultEnabledInLegacy: false,
    defaultEnabledInChemical: true,
    compatibilityStatus: "primary",
    uiOrder: 4,
    styleKey: "catalytic_system",
  },
  {
    id: "elementary_process",
    displayLabel: "Elementary Process",
    displayLabelPlural: "Elementary Processes",
    directory: "wiki/elementary-processes/",
    legacyAliases: [],
    kind: "chemical_core",
    ontologyLayer: "elementary_process",
    promptRole: "process",
    defaultEnabledInLegacy: false,
    defaultEnabledInChemical: true,
    compatibilityStatus: "primary",
    uiOrder: 5,
    styleKey: "elementary_process",
  },
  {
    id: "mechanistic_network",
    displayLabel: "Mechanistic Network",
    displayLabelPlural: "Mechanistic Networks",
    directory: "wiki/mechanistic-networks/",
    legacyAliases: [],
    kind: "chemical_core",
    ontologyLayer: "mechanistic_network",
    promptRole: "mechanism",
    defaultEnabledInLegacy: false,
    defaultEnabledInChemical: true,
    compatibilityStatus: "primary",
    uiOrder: 6,
    styleKey: "mechanistic_network",
  },
  {
    id: "evidence_claim",
    displayLabel: "Evidence Claim",
    displayLabelPlural: "Evidence Claims",
    directory: "wiki/evidence-claims/",
    legacyAliases: [],
    kind: "chemical_core",
    ontologyLayer: "evidence_claim",
    promptRole: "evidence",
    defaultEnabledInLegacy: false,
    defaultEnabledInChemical: true,
    compatibilityStatus: "primary",
    uiOrder: 7,
    styleKey: "evidence_claim",
  },
  {
    id: "comparison",
    displayLabel: "Comparison",
    displayLabelPlural: "Comparisons",
    directory: "wiki/comparisons/",
    legacyAliases: [],
    kind: "auxiliary",
    ontologyLayer: "none",
    promptRole: "auxiliary",
    defaultEnabledInLegacy: true,
    defaultEnabledInChemical: true,
    compatibilityStatus: "supported",
    uiOrder: 8,
    styleKey: "comparison",
  },
  {
    id: "query",
    displayLabel: "Query",
    displayLabelPlural: "Queries",
    directory: "wiki/queries/",
    legacyAliases: [],
    kind: "auxiliary",
    ontologyLayer: "none",
    promptRole: "auxiliary",
    defaultEnabledInLegacy: true,
    defaultEnabledInChemical: true,
    compatibilityStatus: "supported",
    uiOrder: 9,
    styleKey: "query",
  },
  {
    id: "synthesis",
    displayLabel: "Synthesis",
    displayLabelPlural: "Synthesis",
    directory: "wiki/synthesis/",
    legacyAliases: [],
    kind: "auxiliary",
    ontologyLayer: "none",
    promptRole: "auxiliary",
    defaultEnabledInLegacy: true,
    defaultEnabledInChemical: true,
    compatibilityStatus: "supported",
    uiOrder: 10,
    styleKey: "synthesis",
  },
  {
    id: "finding",
    displayLabel: "Finding",
    displayLabelPlural: "Findings",
    directory: "wiki/findings/",
    legacyAliases: [],
    kind: "auxiliary",
    ontologyLayer: "none",
    promptRole: "auxiliary",
    defaultEnabledInLegacy: true,
    defaultEnabledInChemical: true,
    compatibilityStatus: "supported",
    uiOrder: 11,
    styleKey: "finding",
  },
  {
    id: "thesis",
    displayLabel: "Thesis",
    displayLabelPlural: "Theses",
    directory: "wiki/thesis/",
    legacyAliases: [],
    kind: "auxiliary",
    ontologyLayer: "none",
    promptRole: "auxiliary",
    defaultEnabledInLegacy: true,
    defaultEnabledInChemical: true,
    compatibilityStatus: "supported",
    uiOrder: 12,
    styleKey: "thesis",
  },
  {
    id: "methodology",
    displayLabel: "Methodology",
    displayLabelPlural: "Methodologies",
    directory: "wiki/methodology/",
    legacyAliases: [],
    kind: "auxiliary",
    ontologyLayer: "none",
    promptRole: "auxiliary",
    defaultEnabledInLegacy: true,
    defaultEnabledInChemical: true,
    compatibilityStatus: "supported",
    uiOrder: 13,
    styleKey: "methodology",
  },
]

const CATEGORY_PROFILES: Record<string, CategoryProfile> = {
  [LEGACY_CATEGORY_PROFILE_ID]: {
    id: LEGACY_CATEGORY_PROFILE_ID,
    label: "Legacy Default",
    activeCategoryIds: [
      "source",
      "entity",
      "concept",
      "comparison",
      "query",
      "synthesis",
      "thesis",
      "methodology",
      "finding",
      "overview",
    ],
    primaryExtractionIds: ["source", "entity", "concept"],
    primaryDisplayIds: ["overview", "source", "entity", "concept", "comparison", "query", "synthesis"],
    fallbackGenerationIds: ["entity", "concept", "source"],
    sourceSummaryCategoryId: "source",
    preserveLegacyRoutes: true,
  },
  [CHEMICAL_CATEGORY_PROFILE_ID]: {
    id: CHEMICAL_CATEGORY_PROFILE_ID,
    label: "Chemical Default",
    activeCategoryIds: [
      "source",
      "catalytic_system",
      "elementary_process",
      "mechanistic_network",
      "evidence_claim",
      "comparison",
      "query",
      "synthesis",
      "thesis",
      "methodology",
      "finding",
      "entity",
      "concept",
      "overview",
    ],
    primaryExtractionIds: [
      "source",
      "catalytic_system",
      "elementary_process",
      "mechanistic_network",
      "evidence_claim",
    ],
    primaryDisplayIds: [
      "overview",
      "source",
      "catalytic_system",
      "elementary_process",
      "mechanistic_network",
      "evidence_claim",
    ],
    fallbackGenerationIds: [
      "catalytic_system",
      "elementary_process",
      "mechanistic_network",
      "evidence_claim",
      "entity",
      "concept",
    ],
    sourceSummaryCategoryId: "source",
    preserveLegacyRoutes: true,
  },
}

const CATEGORY_DEFINITION_BY_ID = new Map(
  CATEGORY_DEFINITIONS.map((definition) => [definition.id, definition] as const),
)

const CATEGORY_DEFINITION_BY_DIRECTORY = new Map<string, CategoryDefinition>()
const CATEGORY_DEFINITION_BY_ALIAS = new Map<string, CategoryDefinition>()

for (const definition of CATEGORY_DEFINITIONS) {
  const directorySegment = categoryDirectorySegment(definition.directory)
  if (directorySegment) {
    CATEGORY_DEFINITION_BY_DIRECTORY.set(directorySegment, definition)
  }
  for (const alias of categoryDefinitionAliases(definition)) {
    CATEGORY_DEFINITION_BY_ALIAS.set(alias, definition)
  }
}

export function getAllCategoryDefinitions(): CategoryDefinition[] {
  return [...CATEGORY_DEFINITIONS]
}

export function getCategoryDefinition(categoryId: string | null | undefined): CategoryDefinition | undefined {
  if (!categoryId) return undefined
  const normalized = normalizeCategoryLookupKey(categoryId)
  return CATEGORY_DEFINITION_BY_ID.get(normalized) ?? CATEGORY_DEFINITION_BY_ALIAS.get(normalized)
}

export function getCategoryDefinitionByDirectory(directoryName: string | null | undefined): CategoryDefinition | undefined {
  if (!directoryName) return undefined
  return CATEGORY_DEFINITION_BY_DIRECTORY.get(normalizeDirectoryName(directoryName))
}

export function getCategoryProfile(profileId: string = DEFAULT_CATEGORY_PROFILE_ID): CategoryProfile {
  return CATEGORY_PROFILES[profileId] ?? CATEGORY_PROFILES[DEFAULT_CATEGORY_PROFILE_ID]
}

export function getActiveCategoryDefinitions(profileId: string = DEFAULT_CATEGORY_PROFILE_ID): CategoryDefinition[] {
  return getCategoryProfile(profileId).activeCategoryIds
    .map((categoryId) => getCategoryDefinition(categoryId))
    .filter((definition): definition is CategoryDefinition => Boolean(definition))
}

export function getGenerationCategoryIds(profileId: string = DEFAULT_CATEGORY_PROFILE_ID): string[] {
  return getCategoryProfile(profileId).activeCategoryIds.filter((categoryId) => categoryId !== "overview")
}

export function categoryDirectorySegment(directory: string): string | null {
  const normalized = normalizeWikiDirectory(directory)
  const match = normalized.match(/^wiki\/([^/]+)\/$/)
  return match?.[1] ?? null
}

export function inferRegisteredCategoryFromPath(path: string): CategoryDefinition | undefined {
  const normalized = normalizePathForCategoryMatch(path)
  for (const [directoryName, definition] of CATEGORY_DEFINITION_BY_DIRECTORY) {
    if (
      normalized.includes(`/wiki/${directoryName}/`) ||
      normalized.includes(`/${directoryName}/`) ||
      normalized.startsWith(`wiki/${directoryName}/`)
    ) {
      return definition
    }
  }
  return undefined
}

function categoryDefinitionAliases(definition: CategoryDefinition): string[] {
  const aliases = new Set<string>()
  const directorySegment = categoryDirectorySegment(definition.directory)
  const candidates = [
    definition.id,
    definition.displayLabel,
    definition.displayLabelPlural,
    ...definition.legacyAliases,
    directorySegment,
    directorySegment ? `wiki/${directorySegment}` : null,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeCategoryLookupKey(candidate)
    if (normalized) aliases.add(normalized)
  }

  return [...aliases]
}

function normalizeCategoryLookupKey(value: string | null | undefined): string {
  if (!value) return ""
  const normalized = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.md$/i, "")

  const wikiDirMatch = normalized.match(/^(?:wiki\/)?([^/]+)$/i)
  const base = wikiDirMatch?.[1] ?? normalized.split("/").pop() ?? normalized
  return base.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

function normalizeDirectoryName(directoryName: string): string {
  return directoryName.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase()
}

function normalizeWikiDirectory(directory: string): string {
  const normalized = directory.trim().replace(/\\/g, "/").replace(/^\/+/, "")
  return normalized.endsWith("/") ? normalized.toLowerCase() : `${normalized.toLowerCase()}/`
}

function normalizePathForCategoryMatch(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase()
}

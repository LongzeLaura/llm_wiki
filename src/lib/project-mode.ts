import {
  CHEMICAL_CATEGORY_PROFILE_ID,
  LEGACY_CATEGORY_PROFILE_ID,
  type CategoryProfile,
  getCategoryProfile,
} from "@/lib/category-registry"

export type ProjectMode = "default" | "chemical"

export const DEFAULT_PROJECT_MODE: ProjectMode = "default"
export const CHEMICAL_PROJECT_MODE: ProjectMode = "chemical"

const CHEMICAL_SCHEMA_MARKERS = [
  "chemical-default",
  "project mode: chemical",
  "mode: chemical",
  "profile: chemical-default",
  "category profile: chemical-default",
  "catalytic_system",
  "elementary_process",
  "mechanistic_network",
  "evidence_claim",
  "catalytic system",
  "elementary process",
  "mechanistic network",
  "evidence claim",
  "wiki/catalytic-systems/",
  "wiki/elementary-processes/",
  "wiki/mechanistic-networks/",
  "wiki/evidence-claims/",
]

export function normalizeProjectMode(value: string | null | undefined): ProjectMode | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === DEFAULT_PROJECT_MODE) return DEFAULT_PROJECT_MODE
  if (normalized === CHEMICAL_PROJECT_MODE) return CHEMICAL_PROJECT_MODE
  return null
}

export function inferProjectModeFromSchema(schema: string): ProjectMode | null {
  const normalizedSchema = schema.trim().toLowerCase()
  if (!normalizedSchema) return null
  if (CHEMICAL_SCHEMA_MARKERS.some((marker) => normalizedSchema.includes(marker))) {
    return CHEMICAL_PROJECT_MODE
  }
  return null
}

export function projectModeToProfileId(mode: ProjectMode | null | undefined): string {
  return mode === CHEMICAL_PROJECT_MODE
    ? CHEMICAL_CATEGORY_PROFILE_ID
    : LEGACY_CATEGORY_PROFILE_ID
}

export function resolveCategoryProfileForProjectMode(mode: ProjectMode | null | undefined): CategoryProfile {
  return getCategoryProfile(projectModeToProfileId(mode))
}

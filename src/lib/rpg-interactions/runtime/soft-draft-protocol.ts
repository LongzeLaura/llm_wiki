import type { RpgRuntimeDeltaRef } from "../../rpg-wiki-schema"

export interface StripDerivableDraftKeysResult {
  value: unknown
  strippedPaths: string[]
}

export type SoftDraftLooseCoercionKind =
  | "null_optional_array"
  | "string_to_array"
  | "trimmed_string_array"
  | "single_object_to_array"

export interface SoftDraftLooseCoercion {
  kind: SoftDraftLooseCoercionKind
  label: string
  message: string
}

export interface LooseDraftReaderOptions {
  allowNullAsEmpty?: boolean
  allowStringAsSingle?: boolean
  allowSingleObject?: boolean
  coercions?: SoftDraftLooseCoercion[]
}

export function stripDerivableDraftKeys(
  value: unknown,
  keys: ReadonlySet<string> | readonly string[],
  path = "Draft",
): StripDerivableDraftKeysResult {
  const keySet = keys instanceof Set ? keys : new Set(keys)
  const strippedPaths: string[] = []

  function visit(entry: unknown, currentPath: string): unknown {
    if (entry === null || typeof entry !== "object") return entry
    if (Array.isArray(entry)) return entry.map((item, index) => visit(item, `${currentPath}[${index}]`))

    const output: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(entry as Record<string, unknown>)) {
      const childPath = `${currentPath}.${key}`
      if (keySet.has(key)) {
        strippedPaths.push(childPath)
        continue
      }
      output[key] = visit(child, childPath)
    }
    return output
  }

  return {
    value: visit(value, path),
    strippedPaths,
  }
}

export function assertNoForbiddenSoftDraftKeys(
  value: unknown,
  patterns: readonly RegExp[],
  label: string,
  path = label,
): void {
  if (value === null || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenSoftDraftKeys(entry, patterns, label, `${path}[${index}]`))
    return
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (patterns.some((pattern) => pattern.test(key))) {
      throw new Error(`Invalid ${label}: forbidden safety key ${path}.${key}.`)
    }
    assertNoForbiddenSoftDraftKeys(child, patterns, label, `${path}.${key}`)
  }
}

export function normalizeOptionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return undefined
  const strings = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
  return strings.length > 0 ? strings : undefined
}

export function readStringArrayLoose(
  record: Record<string, unknown>,
  key: string,
  label: string,
  options: LooseDraftReaderOptions = {},
): string[] {
  const value = record[key]
  if (value === undefined) return []

  if (value === null) {
    if (options.allowNullAsEmpty) {
      recordLooseCoercion(options, "null_optional_array", label, `${label}: accepted null as an empty optional array.`)
      return []
    }
    throw new Error(`Invalid ${label}: must be an array when provided; received null.`)
  }

  if (typeof value === "string") {
    if (options.allowStringAsSingle) {
      const trimmed = value.trim()
      recordLooseCoercion(options, "string_to_array", label, `${label}: accepted a string as a single-item string array.`)
      return trimmed ? [trimmed] : []
    }
    throw new Error(`Invalid ${label}: must be an array when provided; received string.`)
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}: must be an array when provided; received ${describeValueKind(value)}.`)
  }

  const strings = value
    .map((entry, index) => {
      if (typeof entry !== "string") throw new Error(`Invalid ${label}[${index}]: must be a string.`)
      return entry.trim()
    })
    .filter(Boolean)

  const changed = strings.length !== value.length || value.some((entry, index) => entry !== strings[index])
  if (changed) {
    recordLooseCoercion(options, "trimmed_string_array", label, `${label}: trimmed and removed empty string array entries.`)
  }
  return strings
}

export function readArrayLoose(
  record: Record<string, unknown>,
  key: string,
  label: string,
  options: LooseDraftReaderOptions = {},
): unknown[] {
  const value = record[key]
  if (value === undefined) return []

  if (value === null) {
    if (options.allowNullAsEmpty) {
      recordLooseCoercion(options, "null_optional_array", label, `${label}: accepted null as an empty optional array.`)
      return []
    }
    throw new Error(`Invalid ${label}: must be an array when provided; received null.`)
  }

  if (Array.isArray(value)) return value

  if (options.allowSingleObject && typeof value === "object") {
    recordLooseCoercion(options, "single_object_to_array", label, `${label}: accepted a single object as a one-item array.`)
    return [value]
  }

  throw new Error(`Invalid ${label}: must be an array when provided; received ${describeValueKind(value)}.`)
}

export function formatSoftDraftLooseCoercionWarning(coercion: SoftDraftLooseCoercion): string {
  return `loose_draft_coercion: ${coercion.message}`
}

export function formatSoftDraftLooseCoercionStructuredWarning(coercion: SoftDraftLooseCoercion): {
  code: "loose_draft_coercion"
  message: string
  severity: "warning"
} {
  return {
    code: "loose_draft_coercion",
    message: coercion.message,
    severity: "warning",
  }
}

export function normalizeRuntimeDeltaRefsDraft(
  value: unknown,
  inputRefs: readonly RpgRuntimeDeltaRef[],
): RpgRuntimeDeltaRef[] {
  if (!Array.isArray(value)) return []
  const refsById = new Map(inputRefs.map((ref) => [ref.deltaId, ref]))
  const refsByPath = new Map(inputRefs.map((ref) => [ref.sourcePath, ref]))
  const result: RpgRuntimeDeltaRef[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    const ref = resolveRuntimeDeltaRefDraftEntry(entry, refsById, refsByPath)
    if (!ref || seen.has(ref.deltaId)) continue
    seen.add(ref.deltaId)
    result.push(ref)
  }
  return result
}

function resolveRuntimeDeltaRefDraftEntry(
  entry: unknown,
  refsById: ReadonlyMap<string, RpgRuntimeDeltaRef>,
  refsByPath: ReadonlyMap<string, RpgRuntimeDeltaRef>,
): RpgRuntimeDeltaRef | undefined {
  if (typeof entry === "string") {
    const trimmed = entry.trim()
    return refsById.get(trimmed) ?? refsByPath.get(trimmed)
  }
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return undefined
  const record = entry as Record<string, unknown>
  const deltaId = typeof record.deltaId === "string" ? record.deltaId.trim() : ""
  const sourcePath = typeof record.sourcePath === "string" ? record.sourcePath.trim() : ""
  return (deltaId ? refsById.get(deltaId) : undefined) ?? (sourcePath ? refsByPath.get(sourcePath) : undefined)
}

function recordLooseCoercion(
  options: LooseDraftReaderOptions,
  kind: SoftDraftLooseCoercionKind,
  label: string,
  message: string,
): void {
  options.coercions?.push({ kind, label, message })
}

function describeValueKind(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}

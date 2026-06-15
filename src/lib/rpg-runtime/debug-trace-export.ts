import type { RpgRuntimeDebugTrace } from "./debug-trace"

export interface RpgRuntimeDebugTraceExportPayload {
  version: 1
  exportedAt: string
  trace: RpgRuntimeDebugTrace
}

const SENSITIVE_KEYS = new Set(["apikey", "authorization", "headers", "secret", "token", "password"])

export function serializeRpgRuntimeDebugTraceForExport(
  trace: RpgRuntimeDebugTrace,
  exportedAt = new Date().toISOString(),
): string {
  const payload: RpgRuntimeDebugTraceExportPayload = {
    version: 1,
    exportedAt,
    trace: redactSensitiveTraceKeys(trace) as RpgRuntimeDebugTrace,
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

export function buildRpgRuntimeDebugTraceExportFileName(trace: Pick<RpgRuntimeDebugTrace, "traceId">): string {
  const safeTraceId = trace.traceId
    .trim()
    .replace(/^rpg-runtime-trace-+/i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    || "trace"

  return `rpg-runtime-trace-${safeTraceId}.json`
}

function redactSensitiveTraceKeys(value: unknown, parentKey = "", seen = new WeakMap<object, unknown>()): unknown {
  if (SENSITIVE_KEYS.has(parentKey.toLowerCase())) return "[redacted]"
  if (Array.isArray(value)) return value.map((entry) => redactSensitiveTraceKeys(entry, "", seen))
  if (!value || typeof value !== "object") return value

  const cached = seen.get(value)
  if (cached) return cached

  const clone: Record<string, unknown> = {}
  seen.set(value, clone)

  for (const [key, entry] of Object.entries(value)) {
    clone[key] = redactSensitiveTraceKeys(entry, key, seen)
  }

  return clone
}

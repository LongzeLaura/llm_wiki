import { afterEach, describe, expect, it } from "vitest"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { createTempProject, fileExists, writeFileRaw } from "@/test-helpers/fs-temp"

let tmp: { path: string; cleanup: () => Promise<void> } | undefined

afterEach(async () => {
  if (!tmp) return
  await tmp.cleanup()
  tmp = undefined
})

describe("chemical semantic validator script", () => {
  it("reports repair suggestions in dry-run mode without rewriting files", async () => {
    tmp = await createTempProject("chemical-validator-dry-run")

    await writeFileRaw(
      path.join(tmp.path, "wiki", "evidence-claims", "incomplete-evidence.md"),
      [
        "---",
        "type: evidence_claim",
        "title: Incomplete Evidence",
        "created: 2026-06-01",
        "updated: 2026-06-01",
        "tags: [evidence]",
        "related: []",
        'sources: ["paper.md"]',
        "---",
        "",
        "# Incomplete Evidence",
        "",
        "This page intentionally omits the semantic contract fields.",
      ].join("\n"),
    )

    const validatorPath = path.join(process.cwd(), "scripts", "chemical-semantic-validator.mjs")
    const raw = execFileSync(
      process.execPath,
      [
        validatorPath,
        "--project",
        tmp.path,
        "--json",
        "--dry-run-repair",
      ],
      { encoding: "utf-8" },
    )

    const summary = JSON.parse(raw) as {
      issueCount: number
      reportPath: string
      issues: Array<{ kind: string; suggestion?: string }>
    }

    expect(summary.issueCount).toBeGreaterThan(0)
    expect(summary.issues.some((issue) => issue.kind === "missing_required_field")).toBe(true)
    expect(summary.issues.some((issue) => Boolean(issue.suggestion))).toBe(true)
    expect(await fileExists(summary.reportPath)).toBe(true)
  })
})

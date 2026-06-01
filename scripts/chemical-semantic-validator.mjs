import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import yaml from "js-yaml"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")

const contract = JSON.parse(
  await fs.readFile(path.join(repoRoot, "src/lib/chemical-semantic-contract.json"), "utf-8"),
)

const args = parseArgs(process.argv.slice(2))
const projectPath = path.resolve(args.project ?? process.cwd())
const reportPath = path.resolve(projectPath, args.report ?? contract.reportPath)
const dryRunRepair = Boolean(args["dry-run-repair"])
const jsonOutput = Boolean(args.json)

const wikiRoot = path.join(projectPath, "wiki")
const markdownFiles = await listMarkdownFiles(wikiRoot)
const results = []
const issues = []

for (const absPath of markdownFiles) {
  const content = await fs.readFile(absPath, "utf-8")
  const relativePath = normalizePath(path.relative(projectPath, absPath))
  const pageResult = validateChemicalPage(relativePath, content, dryRunRepair)
  if (!pageResult) continue
  results.push(pageResult)
  issues.push(...pageResult.issues)
}

const summary = {
  projectPath: normalizePath(projectPath),
  wikiRoot: normalizePath(wikiRoot),
  reportPath: normalizePath(reportPath),
  dryRunRepair,
  pageCount: results.length,
  issueCount: issues.length,
  issuesByKind: countBy(issues, (issue) => issue.kind),
  pages: results.map((page) => ({
    path: page.path,
    pageType: page.pageType,
    issueCount: page.issues.length,
  })),
  issues,
}

await writeReport(reportPath, summary, results)

if (jsonOutput) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
} else {
  process.stdout.write(
    [
      `Chemical semantic validation completed for ${summary.projectPath}`,
      `Chemical pages checked: ${summary.pageCount}`,
      `Issues found: ${summary.issueCount}`,
      `Report: ${summary.reportPath}`,
      dryRunRepair ? "Dry-run repair suggestions were included in the report." : "Run with --dry-run-repair to include repair suggestions.",
    ].join("\n") + "\n",
  )
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith("--")) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith("--")) {
      out[key] = true
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

async function listMarkdownFiles(root) {
  let entries
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return []
  }

  const files = []
  for (const entry of entries) {
    const absPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listMarkdownFiles(absPath))
      continue
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(absPath)
    }
  }
  return files
}

function validateChemicalPage(relativePath, content, includeRepairSuggestions) {
  const parsed = parseFrontmatter(content)
  const pageType = detectChemicalPageType(relativePath, parsed.frontmatter?.type ?? null)
  if (!pageType) return null

  const pageContract = contract.pageTypes[pageType]
  const frontmatter = parsed.frontmatter ?? {}
  const pageIssues = []

  for (const field of pageContract.requiredFields) {
    const value = frontmatter[field.name]
    if (field.kind === "array") {
      if (!Array.isArray(value) || value.length === 0) {
        pageIssues.push(buildIssue(relativePath, pageType, field.name, "empty_required_array", "warning", `Required array field \`${field.name}\` is empty or missing.`, includeRepairSuggestions ? `Add \`${field.name}: []\` and populate it with linked chemical items when known.` : undefined))
      }
      continue
    }

    if (typeof value !== "string" || value.trim() === "") {
      pageIssues.push(buildIssue(relativePath, pageType, field.name, "missing_required_field", "error", `Required scalar field \`${field.name}\` is missing.`, includeRepairSuggestions ? `Add \`${field.name}: ${field.placeholder}\` to the page frontmatter.` : undefined))
      continue
    }

    const normalizedValue = normalizeEnumValue(value, field.allowedValues)
    if (field.allowedValues?.length && normalizedValue !== value) {
      pageIssues.push(buildIssue(relativePath, pageType, field.name, "non_normalized_enum", "warning", `Field \`${field.name}\` should be normalized to \`${normalizedValue}\`.`, includeRepairSuggestions ? `Rewrite \`${field.name}: ${normalizedValue}\`.` : undefined))
      continue
    }

    if (value === field.placeholder) {
      pageIssues.push(buildIssue(relativePath, pageType, field.name, "placeholder_value", "warning", `Field \`${field.name}\` still uses the placeholder value \`${field.placeholder}\`.` , includeRepairSuggestions ? buildPlaceholderSuggestion(field) : undefined))
    }
  }

  const related = Array.isArray(frontmatter.related) ? frontmatter.related : []
  if (related.length === 0) {
    pageIssues.push(buildIssue(relativePath, pageType, "related", "missing_cross_layer_links", "warning", "The page does not declare any cross-layer links in `related`.", includeRepairSuggestions ? "Populate `related: [other-page-slug]` with linked system, process, mechanism, or evidence pages." : undefined))
  }

  pageIssues.push(...buildHeuristicIssues(relativePath, pageType, frontmatter, includeRepairSuggestions))

  return {
    path: relativePath,
    pageType,
    issues: pageIssues,
  }
}

function buildHeuristicIssues(relativePath, pageType, frontmatter, includeRepairSuggestions) {
  if (pageType === "catalytic_system") {
    const role = stringValue(frontmatter.role)
    const catalystMaterial = stringValue(frontmatter.catalyst_material)
    const activeSiteType = stringValue(frontmatter.active_site_type)
    const reactionConditions = stringValue(frontmatter.reaction_conditions)
    if (
      ["reactant", "product", "adsorbate", "intermediate"].includes(role) &&
      (!catalystMaterial || catalystMaterial === "unknown") &&
      (!activeSiteType || activeSiteType === "unknown") &&
      (!reactionConditions || reactionConditions === "not_specified")
    ) {
      return [
        buildIssue(
          relativePath,
          pageType,
          "role",
          "likely_misclassified_page",
          "warning",
          "This catalytic-system page looks species-only and may be missing the system context that distinguishes it from a loose entity note.",
          includeRepairSuggestions ? "Add catalyst/site/condition context or consider whether this page belongs in a compatibility category instead." : undefined,
        ),
      ]
    }
  }

  if (pageType === "mechanistic_network") {
    const networkNodes = Array.isArray(frontmatter.network_nodes) ? frontmatter.network_nodes : []
    const networkEdges = Array.isArray(frontmatter.network_edges) ? frontmatter.network_edges : []
    if (networkNodes.length === 0 && networkEdges.length === 0) {
      return [
        buildIssue(
          relativePath,
          pageType,
          "network_nodes",
          "likely_prose_only_mechanism_page",
          "warning",
          "This mechanistic-network page does not expose nodes or edges and may still be prose-only.",
          includeRepairSuggestions ? "Add `network_nodes` and `network_edges` entries that make the mechanism structure explicit." : undefined,
        ),
      ]
    }
  }

  if (pageType === "evidence_claim") {
    const claim = stringValue(frontmatter.claim)
    const evidenceSummary = stringValue(frontmatter.evidence_summary)
    if (!claim || claim === "unknown" || !evidenceSummary || evidenceSummary === "not_specified") {
      return [
        buildIssue(
          relativePath,
          pageType,
          "claim",
          "likely_method_only_evidence_page",
          "warning",
          "This evidence-claim page may still read like a method note rather than a claim-centered evidence record.",
          includeRepairSuggestions ? "State the target claim explicitly and summarize the result that supports or challenges it." : undefined,
        ),
      ]
    }
  }

  return []
}

function buildIssue(pathname, pageType, field, kind, severity, message, suggestion) {
  return {
    path: pathname,
    pageType,
    field,
    kind,
    severity,
    message,
    suggestion,
  }
}

function buildPlaceholderSuggestion(field) {
  const placeholder = Array.isArray(field.placeholder) ? "[]" : field.placeholder
  return `Replace the placeholder in \`${field.name}\` with a source-grounded value when one is available. Current placeholder: \`${placeholder}\`.`
}

async function writeReport(outputPath, summary, pages) {
  const lines = [
    "# Chemical Semantic Validation Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Project: ${summary.projectPath}`,
    `Wiki root: ${summary.wikiRoot}`,
    "",
    "## Summary",
    "",
    `- Chemical pages checked: ${summary.pageCount}`,
    `- Issues found: ${summary.issueCount}`,
    `- Dry-run repair suggestions included: ${summary.dryRunRepair ? "yes" : "no"}`,
    "",
    "## Issues By Kind",
    "",
  ]

  const issueKinds = Object.entries(summary.issuesByKind)
  if (issueKinds.length === 0) {
    lines.push("- None")
  } else {
    for (const [kind, count] of issueKinds) {
      lines.push(`- ${kind}: ${count}`)
    }
  }

  lines.push("", "## Page Findings", "")

  if (pages.length === 0) {
    lines.push("- No chemical pages were found under `wiki/`.")
  } else {
    for (const page of pages) {
      lines.push(`### ${page.path}`)
      lines.push("")
      lines.push(`- Type: ${page.pageType}`)
      if (page.issues.length === 0) {
        lines.push("- Status: passed")
        lines.push("")
        continue
      }
      lines.push(`- Status: ${page.issues.length} issue(s)`)
      for (const issue of page.issues) {
        lines.push(`- ${issue.severity} | ${issue.kind} | ${issue.field}: ${issue.message}`)
        if (issue.suggestion) {
          lines.push(`- Dry-run repair: ${issue.suggestion}`)
        }
      }
      lines.push("")
    }
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, lines.join("\n"), "utf-8")
}

function countBy(items, selector) {
  const counts = {}
  for (const item of items) {
    const key = selector(item)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

function detectChemicalPageType(relativePath, rawType) {
  if (typeof rawType === "string" && rawType in contract.pageTypes) return rawType
  for (const [pageType, pageContract] of Object.entries(contract.pageTypes)) {
    if (normalizePath(relativePath).startsWith(pageContract.directory)) return pageType
  }
  return null
}

function parseFrontmatter(content) {
  const strict = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/)
  if (!strict) return { frontmatter: null, body: content }

  const rawYaml = strict[1]
  try {
    const loaded = yaml.load(rawYaml, { schema: yaml.JSON_SCHEMA })
    return {
      frontmatter: normalizeFrontmatter(loaded),
      body: content.slice(strict[0].length),
    }
  } catch {
    try {
      const repaired = repairWikilinkLists(rawYaml)
      const loaded = yaml.load(repaired, { schema: yaml.JSON_SCHEMA })
      return {
        frontmatter: normalizeFrontmatter(loaded),
        body: content.slice(strict[0].length),
      }
    } catch {
      return { frontmatter: null, body: content.slice(strict[0].length) }
    }
  }
}

function repairWikilinkLists(payload) {
  return payload
    .split("\n")
    .map((line) => {
      const match = line.match(/^(\s*[A-Za-z_][\w-]*\s*:\s*)(\[\[[^\]]+\]\](?:\s*,\s*\[\[[^\]]+\]\])+)\s*$/)
      if (!match) return line
      const items = match[2]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => `"${item}"`)
        .join(", ")
      return `${match[1]}[${items}]`
    })
    .join("\n")
}

function normalizeFrontmatter(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const normalized = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (Array.isArray(value)) {
      normalized[key] = value.map((entry) => stringifyScalar(entry))
      continue
    }
    normalized[key] = stringifyScalar(value)
  }
  return normalized
}

function stringifyScalar(value) {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function normalizeEnumValue(value, allowedValues) {
  if (!allowedValues?.length || typeof value !== "string") return value
  const canonical = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  return allowedValues.includes(canonical) ? canonical : value
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizePath(value) {
  return value.replace(/\\/g, "/")
}

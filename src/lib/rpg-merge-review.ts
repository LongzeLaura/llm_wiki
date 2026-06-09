import type { ReviewItem } from "@/stores/review-store"
import { parseFrontmatter } from "./frontmatter"
import { lintRpgMergedPage, type RpgMergeLintIssue, type RpgMergeLintResult } from "./rpg-merge-lint"
import { getRpgMergePolicy, type RpgMergePolicy } from "./rpg-interactions/merge"
import {
  createRpgDistillReviewItems,
  distillRpgWikiPage,
  type RpgDistillProposal,
} from "./rpg-post-ingest-distiller"
import { mergeRpgSections, type RpgSectionMergeResult } from "./rpg-section-merge"

export type RpgMergeReviewDisposition = "accepted" | "review"
export type RpgProposalStatus = "pending" | "accepted" | "rejected"

export interface RpgMergeReviewInput {
  pagePath: string
  existingContent: string
  incomingContent: string
  mergedCandidate: string
  longPageThreshold?: number
}

export interface RpgMergeReviewResult {
  pagePath: string
  disposition: RpgMergeReviewDisposition
  acceptedContent: string | null
  reviewedCandidate: string
  policy: RpgMergePolicy
  sectionMerge: RpgSectionMergeResult
  lint: RpgMergeLintResult
  highRiskReasons: string[]
  reviewItems: Omit<ReviewItem, "id" | "resolved" | "createdAt">[]
  distillProposals: RpgDistillProposal[]
  distillReviewItems: Omit<ReviewItem, "id" | "resolved" | "createdAt">[]
}

export interface ApplyRpgDistillProposalInput {
  proposal: RpgDistillProposal
  originalContent: string
  status: RpgProposalStatus
}

export interface ApplyRpgDistillProposalResult {
  applied: boolean
  targetPath: string
  content: string | null
  warnings: string[]
}

const DEFAULT_LONG_PAGE_THRESHOLD = 6_000

const REVIEW_OPTIONS: ReviewItem["options"] = [
  { label: "Inspect", action: "Inspect" },
  { label: "Accept", action: "Accept" },
  { label: "Reject", action: "Reject" },
]

const HIGH_RISK_WARNING_CODES = new Set([
  "base-page-runtime-state-contamination",
])

const DISTILL_CATEGORIES = new Set([
  "characters",
  "locations",
  "events",
  "plot-arcs",
  "relationships",
])

const LOW_VALUE_SECTION_MARKERS = [
  "trivia",
  "release metadata",
  "voice actor",
  "production notes",
  "fan tags",
  "full biography",
  "biography",
  "character profile",
  "百科信息",
  "发售信息",
  "声优",
  "制作信息",
  "人物传记",
  "完整人物资料",
] as const

export function reviewRpgMergeOutput(input: RpgMergeReviewInput): RpgMergeReviewResult {
  const pagePath = normalizeWikiPath(input.pagePath)
  const policy = getRpgMergePolicy(pagePath)
  const sectionMerge = mergeRpgSections(input.mergedCandidate, {
    pagePath,
    policy,
    existingContent: input.existingContent,
    incomingContent: input.incomingContent,
    preserveLowValueSections: true,
  })
  const reviewedCandidate = sectionMerge.content
  const lint = lintRpgMergedPage(reviewedCandidate, {
    pagePath,
    policy,
    existingContent: input.existingContent,
    incomingContent: input.incomingContent,
  })
  const highRiskReasons = collectHighRiskReasons({
    pagePath,
    policy,
    lint,
    existingContent: input.existingContent,
    incomingContent: input.incomingContent,
    reviewedCandidate,
  })
  const disposition: RpgMergeReviewDisposition = highRiskReasons.length > 0 ? "review" : "accepted"
  const acceptedContent = disposition === "accepted" ? reviewedCandidate : null
  const reviewItems = disposition === "review"
    ? [createHighRiskMergeReviewItem(pagePath, highRiskReasons, lint.issues, reviewedCandidate)]
    : []
  const distillProposals = shouldCreateDistillProposal(
    pagePath,
    reviewedCandidate,
    input.longPageThreshold ?? DEFAULT_LONG_PAGE_THRESHOLD,
  )
    ? [distillRpgWikiPage({ path: pagePath, content: reviewedCandidate })].filter((proposal) => !proposal.skipped)
    : []

  return {
    pagePath,
    disposition,
    acceptedContent,
    reviewedCandidate,
    policy,
    sectionMerge,
    lint,
    highRiskReasons,
    reviewItems,
    distillProposals,
    distillReviewItems: createRpgDistillReviewItems(distillProposals),
  }
}

export function applyAcceptedRpgDistillProposal(
  input: ApplyRpgDistillProposalInput,
): ApplyRpgDistillProposalResult {
  const targetPath = normalizeWikiPath(input.proposal.targetPath)
  const warnings: string[] = []

  if (input.status !== "accepted") {
    return {
      applied: false,
      targetPath,
      content: null,
      warnings: [`Distill proposal for ${targetPath} is "${input.status}", not "accepted".`],
    }
  }

  if (input.proposal.skipped || !isDistillEligiblePath(targetPath)) {
    return {
      applied: false,
      targetPath,
      content: null,
      warnings: [`Distill proposal for ${targetPath} is not eligible for runtime-facing compression.`],
    }
  }

  const content = buildCompressedCandidate(input.originalContent, input.proposal)
  if (content === input.originalContent) {
    warnings.push(`Accepted distill proposal for ${targetPath} did not change content.`)
  }

  return {
    applied: true,
    targetPath,
    content,
    warnings,
  }
}

function collectHighRiskReasons(input: {
  pagePath: string
  policy: RpgMergePolicy
  lint: RpgMergeLintResult
  existingContent: string
  incomingContent: string
  reviewedCandidate: string
}): string[] {
  const reasons: string[] = []
  for (const issue of input.lint.issues) {
    if (issue.severity === "reject" || HIGH_RISK_WARNING_CODES.has(issue.code)) {
      reasons.push(`${issue.code}: ${issue.message}`)
    }
  }

  const shrinkReason = bodyShrinkRiskReason(input)
  if (shrinkReason) reasons.push(shrinkReason)

  const deletionReason = sectionDeletionRiskReason(input.pagePath, input.existingContent, input.incomingContent, input.reviewedCandidate)
  if (deletionReason) reasons.push(deletionReason)

  return uniqueStrings(reasons)
}

function bodyShrinkRiskReason(input: {
  pagePath: string
  policy: RpgMergePolicy
  existingContent: string
  incomingContent: string
  reviewedCandidate: string
}): string | null {
  const existingLen = parseFrontmatter(input.existingContent).body.length
  const incomingLen = parseFrontmatter(input.incomingContent).body.length
  const candidateLen = parseFrontmatter(input.reviewedCandidate).body.length
  const threshold = Math.max(existingLen, incomingLen) * input.policy.bodyShrinkThreshold
  if (candidateLen >= threshold) return null
  return `body-shrink-risk: candidate body has ${candidateLen} chars, below ${input.policy.kind} threshold ${threshold.toFixed(0)} for ${input.pagePath}.`
}

function sectionDeletionRiskReason(
  pagePath: string,
  existingContent: string,
  incomingContent: string,
  reviewedCandidate: string,
): string | null {
  const category = categoryFromPath(pagePath)
  if (category === "sources" || category === "style" || category === "rules" || category === "memory") return null
  const inputHeadings = uniqueStrings([
    ...extractSignificantSectionHeadings(existingContent),
    ...extractSignificantSectionHeadings(incomingContent),
  ])
  const outputHeadings = new Set(extractSignificantSectionHeadings(reviewedCandidate))
  const missing = inputHeadings.filter((heading) => !outputHeadings.has(heading))
  if (inputHeadings.length < 3 || missing.length < 3) return null
  if (missing.length / inputHeadings.length < 0.5) return null
  return `section-deletion-risk: candidate removed ${missing.length} significant sections from ${pagePath}: ${missing.slice(0, 5).join(", ")}.`
}

function createHighRiskMergeReviewItem(
  pagePath: string,
  highRiskReasons: string[],
  issues: RpgMergeLintIssue[],
  reviewedCandidate: string,
): Omit<ReviewItem, "id" | "resolved" | "createdAt"> {
  const issueLines = issues.length > 0
    ? issues.map((issue) => `- ${issue.severity}:${issue.code}: ${issue.message}`).join("\n")
    : "- No lint issues; review was triggered by deterministic shrink/deletion risk."
  return {
    type: "suggestion",
    title: `RPG high-risk merge review: ${pagePath}`,
    description: [
      `High-risk RPG merge output for ${pagePath}.`,
      "",
      "## Reasons",
      highRiskReasons.map((reason) => `- ${reason}`).join("\n"),
      "",
      "## Lint",
      issueLines,
      "",
      "## Candidate",
      reviewedCandidate,
    ].join("\n"),
    sourcePath: pagePath,
    affectedPages: [pagePath],
    options: REVIEW_OPTIONS,
  }
}

function shouldCreateDistillProposal(pagePath: string, content: string, threshold: number): boolean {
  if (content.length < threshold) return false
  return isDistillEligiblePath(pagePath)
}

function isDistillEligiblePath(pagePath: string): boolean {
  return DISTILL_CATEGORIES.has(categoryFromPath(pagePath))
}

function buildCompressedCandidate(originalContent: string, proposal: RpgDistillProposal): string {
  const frontmatterMatch = originalContent.match(/^(---\r?\n[\s\S]*?\r?\n---)(?:[ \t]*\r?\n)?/)
  const frontmatter = frontmatterMatch?.[1] ?? ""
  const body = originalContent.slice(frontmatterMatch?.[0].length ?? 0)
  const h1 = /^#\s+.+?\s*$/m.exec(body)?.[0] ?? `# ${proposal.targetPath.split("/").pop()?.replace(/\.md$/i, "") ?? "RPG Page"}`
  const keepHeadingSet = new Set(proposal.keepSections.map((section) => normalizeHeading(section.heading)))
  const sections = parseSections(body)
    .filter((section) => normalizeHeading(section.heading) !== "runtime capsule")
    .filter((section) => keepHeadingSet.has(normalizeHeading(section.heading)))
  const reviewNotes = [
    "## Compression Review Notes",
    "",
    "- This candidate was generated only after an accepted distill proposal.",
    "- Compressed sections: " + formatHeadingList(proposal.compressSections.map((section) => section.heading)),
    "- Evidence/review sections: " + formatHeadingList([
      ...proposal.moveToEvidenceSections.map((section) => section.heading),
      ...proposal.needsHumanConfirmation.map((section) => section.heading),
    ]),
  ].join("\n")

  const parts = [
    frontmatter,
    h1,
    "",
    proposal.candidateRuntimeCapsule.trim(),
    "",
    ...sections.map((section) => `## ${section.heading}\n${section.content.trim()}`),
    reviewNotes,
    "",
  ].filter((part) => part !== "")

  return `${parts.join("\n\n").trimEnd()}\n`
}

function parseSections(markdown: string): Array<{ heading: string; content: string }> {
  const body = markdown.replace(/\r\n/g, "\n")
  const headingRe = /^##\s+(.+?)\s*$/gm
  const matches = Array.from(body.matchAll(headingRe))
  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length
    const end = index + 1 < matches.length ? matches[index + 1].index ?? body.length : body.length
    return {
      heading: match[1].trim(),
      content: body.slice(start, end).trim(),
    }
  })
}

function extractSignificantSectionHeadings(content: string): string[] {
  return parseSections(parseFrontmatter(content).body)
    .map((section) => normalizeHeading(section.heading))
    .filter((heading) => heading && !LOW_VALUE_SECTION_MARKERS.some((marker) => heading.includes(marker.toLowerCase())))
}

function categoryFromPath(pagePath: string): string {
  return normalizeWikiPath(pagePath).match(/^wiki\/([^/]+)(?:\/|$)/)?.[1] ?? ""
}

function normalizeHeading(heading: string): string {
  return heading.replace(/\s+/g, " ").trim().toLowerCase()
}

function normalizeWikiPath(pagePath: string): string {
  return pagePath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/")
}

function formatHeadingList(headings: string[]): string {
  return headings.length > 0 ? headings.join(", ") : "none"
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

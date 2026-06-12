export const LLM4_HANDOFF_FIELD_LIST = "outlineAwareNarrationBrief, outlineImpactReport, and regenerationRequest"

export const LLM4_HANDOFF_AUDIT_ONLY_LINE =
  `${LLM4_HANDOFF_FIELD_LIST} are journal/audit/control handoff only, not accepted wiki facts.`

export const REGENERATION_REQUEST_AUDIT_ONLY_LINE =
  "regenerationRequest is not an outlineRevisionProposal, not a provisionalOutlinePatch, and not permission to revise wiki/outlines/main.md; it is audit/control handoff only."

export const STORY_OUTLINE_REGENERATOR_NOT_TRIGGERED_LINE =
  "Do not trigger Story Outline Regenerator in this stage."

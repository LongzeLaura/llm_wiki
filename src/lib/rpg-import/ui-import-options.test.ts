import { describe, expect, it } from "vitest"
import {
  DEFAULT_RPG_IMPORT_UI_OPTION_ID,
  RPG_IMPORT_UI_OPTIONS,
  assertRpgImportUiOptionsMatchSupportedSlots,
  campaignSetupOptionId,
  controlDocOptionId,
  listCampaignSetupUiSlots,
  listControlDocUiSlots,
  resolveRpgImportUiSelection,
} from "./ui-import-options"

describe("RPG import UI options", () => {
  it("maps the default semantic option to ordinary source_ingest", () => {
    const resolved = resolveRpgImportUiSelection()

    expect(resolved.option.id).toBe(DEFAULT_RPG_IMPORT_UI_OPTION_ID)
    expect(resolved.mode).toBe("source_ingest")
    expect(resolved.targetSlot).toBeUndefined()
    expect(resolved.option.allowMultipleFiles).toBe(true)
    expect(resolved.options).toEqual({})
  })

  it("maps exposed control doc semantics to the supported mode and slots", () => {
    expect(listControlDocUiSlots()).toEqual([
      "main_outline",
      "outline_progress",
      "rules_core",
      "style_narration",
    ])

    const resolved = resolveRpgImportUiSelection({
      optionId: controlDocOptionId("rules_core"),
      manualConfirm: true,
    })

    expect(resolved.mode).toBe("control_doc_import")
    expect(resolved.targetSlot).toBe("rules_core")
    expect(resolved.option.allowMultipleFiles).toBe(false)
    expect(resolved.options).toEqual({ manualConfirm: true })
  })

  it("maps exposed campaign setup semantics to the supported mode and slots", () => {
    expect(listCampaignSetupUiSlots()).toEqual([
      "player_main",
      "player_abilities",
      "player_inventory",
      "player_goals",
      "player_known_information",
      "current_scene",
      "events_prologue",
      "main_quest",
      "quest",
      "player_relationship",
    ])

    const resolved = resolveRpgImportUiSelection({
      optionId: campaignSetupOptionId("events_prologue"),
    })

    expect(resolved.mode).toBe("campaign_setup_import")
    expect(resolved.targetSlot).toBe("events_prologue")
    expect(resolved.option.requiresSingleFile).toBe(true)
    expect(resolved.options).toEqual({})
  })

  it("does not generate explicit current-scene bootstrap options until confirmed", () => {
    const unconfirmed = resolveRpgImportUiSelection({
      optionId: campaignSetupOptionId("current_scene"),
    })
    const confirmed = resolveRpgImportUiSelection({
      optionId: campaignSetupOptionId("current_scene"),
      explicitBootstrap: true,
    })

    expect(unconfirmed.options).not.toHaveProperty("explicitBootstrap")
    expect(unconfirmed.options).not.toHaveProperty("manualConfirm")
    expect(confirmed.options).toEqual({ explicitBootstrap: true })
  })

  it("passes quest and relationship names into import options", () => {
    const quest = resolveRpgImportUiSelection({
      optionId: campaignSetupOptionId("quest"),
      questName: "  Moon Gate  ",
    })
    const relationship = resolveRpgImportUiSelection({
      optionId: campaignSetupOptionId("player_relationship"),
      relationshipName: "  Mira  ",
    })

    expect(quest.options).toEqual({ questName: "Moon Gate" })
    expect(relationship.options).toEqual({ relationshipName: "Mira" })
  })

  it("does not expose runtime_update_apply as a file import option", () => {
    expect(RPG_IMPORT_UI_OPTIONS.map((option) => option.mode)).not.toContain("runtime_update_apply")
    expect(() => assertRpgImportUiOptionsMatchSupportedSlots()).not.toThrow()
  })
})

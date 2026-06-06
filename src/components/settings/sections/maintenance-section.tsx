import { useTranslation } from "react-i18next"
import { Wrench } from "lucide-react"

export function MaintenanceSection() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          {t("settings.sections.maintenance.title", { defaultValue: "Maintenance" })}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.sections.maintenance.description", {
            defaultValue:
              "RPG-only maintenance tools will appear here. Legacy entity/concept duplicate cleanup is no longer exposed.",
          })}
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">
            {t("settings.sections.maintenance.rpgOnly.title", {
              defaultValue: "RPG runtime maintenance",
            })}
          </h3>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("settings.sections.maintenance.rpgOnly.description", {
            defaultValue:
              "llmWikiRPG keeps legacy llm_wiki cleanup actions hidden. Future maintenance actions should operate on RPG runtime directories such as current-scene, events, relationships, and memory.",
          })}
        </p>
      </div>
    </div>
  )
}

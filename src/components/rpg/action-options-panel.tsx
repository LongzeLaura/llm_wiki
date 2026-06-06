import { ArrowRight, ShieldAlert } from "lucide-react"
import type { RpgActionOption } from "@/lib/rpg-runtime"

interface ActionOptionsPanelProps {
  options: RpgActionOption[]
  selectedOptionId: string | null
  onSelectOption: (option: RpgActionOption) => void
  disabled?: boolean
}

export function ActionOptionsPanel({ options, selectedOptionId, onSelectOption, disabled = false }: ActionOptionsPanelProps) {
  return (
    <section className="min-w-0 border-b border-border/70 bg-background px-4 py-3" aria-labelledby="rpg-action-options-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="rpg-action-options-heading" className="text-sm font-semibold text-foreground">
          Future candidate actions
        </h2>
        <span className="shrink-0 rounded border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {options.length} options
        </span>
      </div>

      {options.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No candidate actions available.</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {options.map((option) => {
            const selected = option.id === selectedOptionId
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onSelectOption(option)}
                className={`group flex min-h-14 w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selected
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border/80 bg-card/60 text-foreground/90 hover:border-primary/40 hover:bg-accent/60"
                } disabled:pointer-events-none disabled:opacity-50`}
              >
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words leading-5">{option.playerFacingText}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <span>{option.intent}</span>
                    <span className="text-border">/</span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      {option.riskLevel}
                    </span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

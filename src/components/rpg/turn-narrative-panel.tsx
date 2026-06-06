interface TurnNarrativePanelProps {
  narrative: string
}

export function TurnNarrativePanel({ narrative }: TurnNarrativePanelProps) {
  return (
    <section className="min-w-0 border-b border-border/70 bg-card/40 px-4 py-3" aria-labelledby="rpg-turn-narrative-heading">
      <h2 id="rpg-turn-narrative-heading" className="text-sm font-semibold text-foreground">
        Last narrative
      </h2>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground/90">
        {narrative.trim() || "No narrative generated yet."}
      </pre>
    </section>
  )
}

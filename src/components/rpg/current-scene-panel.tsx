interface CurrentScenePanelProps {
  currentScene: string
}

export function CurrentScenePanel({ currentScene }: CurrentScenePanelProps) {
  return (
    <section className="min-w-0 border-b border-border/70 bg-background px-4 py-3" aria-labelledby="rpg-current-scene-heading">
      <h2 id="rpg-current-scene-heading" className="text-sm font-semibold text-foreground">
        当前场景
      </h2>
      <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground/90">
        {currentScene.trim() || "尚未载入当前场景。"}
      </pre>
    </section>
  )
}

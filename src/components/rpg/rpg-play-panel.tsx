import { useRef, useState } from "react"
import { Send, TextCursorInput } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  createSubmittedActionFromFreeform,
  createSubmittedActionFromOption,
} from "@/lib/rpg-runtime/play-panel-state"
import type { RpgActionOption } from "@/lib/rpg-runtime/turn-model"
import type { SubmittedAction } from "@/lib/rpg-runtime/types"
import { ActionOptionsPanel } from "./action-options-panel"
import { CurrentScenePanel } from "./current-scene-panel"
import { TurnNarrativePanel } from "./turn-narrative-panel"

export interface RpgPlayPanelProps {
  currentScene: string
  lastNarrative: string
  nextActionOptions: RpgActionOption[]
  onSubmitAction: (action: SubmittedAction) => void
  createActionId?: () => string
  disabled?: boolean
}

export function RpgPlayPanel({
  currentScene,
  lastNarrative,
  nextActionOptions,
  onSubmitAction,
  createActionId,
  disabled = false,
}: RpgPlayPanelProps) {
  const actionCounterRef = useRef(0)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [freeformActionText, setFreeformActionText] = useState("")
  const [submittedAction, setSubmittedAction] = useState<SubmittedAction | null>(null)

  const nextActionId = () => {
    if (createActionId) return createActionId()
    actionCounterRef.current += 1
    return `rpg-action-${actionCounterRef.current}`
  }

  const submitAction = (action: SubmittedAction) => {
    setSubmittedAction(action)
    onSubmitAction(action)
  }

  const handleSelectOption = (option: RpgActionOption) => {
    setSelectedOptionId(option.id)
    submitAction(createSubmittedActionFromOption(option, nextActionId()))
  }

  const handleSubmitFreeform = () => {
    const action = createSubmittedActionFromFreeform(freeformActionText, nextActionId())
    if (!action) return

    setSelectedOptionId(null)
    setFreeformActionText("")
    submitAction(action)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background" data-rpg-play-panel="v0">
      <CurrentScenePanel currentScene={currentScene} />
      <TurnNarrativePanel narrative={lastNarrative} />
      <ActionOptionsPanel
        options={nextActionOptions}
        selectedOptionId={selectedOptionId}
        onSelectOption={handleSelectOption}
        disabled={disabled}
      />

      <section className="min-w-0 border-b border-border/70 bg-card/30 px-4 py-3" aria-labelledby="rpg-freeform-action-heading">
        <h2 id="rpg-freeform-action-heading" className="text-sm font-semibold text-foreground">
          自由行动
        </h2>
        <div className="mt-2 rounded-md border border-border/80 bg-background p-2 focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/20">
          <textarea
            value={freeformActionText}
            onChange={(event) => setFreeformActionText(event.target.value)}
            disabled={disabled}
            rows={3}
            placeholder="描述你的行动……"
            className="block max-h-32 min-h-20 w-full resize-none bg-transparent px-2 py-1 text-sm leading-6 placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="mt-2 flex items-center justify-end border-t border-border/60 pt-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSubmitFreeform}
              disabled={disabled || !freeformActionText.trim()}
              className="h-8 gap-1.5 rounded-md px-3"
              title="提交自由行动"
            >
              <Send className="h-3.5 w-3.5" />
              <span>提交</span>
            </Button>
          </div>
        </div>
      </section>

      <section className="min-w-0 flex-1 overflow-auto bg-background px-4 py-3" aria-labelledby="rpg-submitted-action-heading">
        <h2 id="rpg-submitted-action-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <TextCursorInput className="h-4 w-4 text-muted-foreground" />
          已提交行动
        </h2>
        {submittedAction ? (
          <div className="mt-2 rounded-md border border-border/80 bg-card/60 px-3 py-2 text-sm">
            <p className="break-words leading-6 text-foreground/90">{submittedAction.text}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {submittedAction.source}
              {submittedAction.selectedOptionId ? ` / ${submittedAction.selectedOptionId}` : ""}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">尚未提交行动。</p>
        )}
      </section>
    </div>
  )
}

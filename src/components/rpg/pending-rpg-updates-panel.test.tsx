import * as React from "react"
import type { ReactElement, ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { PendingRpgUpdatesPanel } from "@/components/rpg"
import type { PendingRpgUpdate } from "@/lib/rpg-runtime"
import type { ApplyRpgPendingUpdatesResult } from "@/lib/rpg-runtime/write-policy"

describe("PendingRpgUpdatesPanel", () => {
  it("renders pending RPG updates for review", () => {
    const html = renderToStaticMarkup(
      <PendingRpgUpdatesPanel
        updates={[sampleUpdate()]}
        onAcceptUpdate={() => undefined}
        onRejectUpdate={() => undefined}
        onApplyAcceptedUpdates={() => undefined}
      />,
    )

    expect(html).toContain("Pending RPG updates")
    expect(html).toContain("wiki/current-scene/scene_state.md")
    expect(html).toContain("overwrite")
    expect(html).toContain("Pending")
    expect(html).toContain("Refresh the current scene snapshot.")
    expect(html).toContain("The lantern key has answered the sigil.")
    expect(html).toContain("wiki/events/canal-gate.md")
  })

  it("calls accept update and displays an accepted status", () => {
    const onAcceptUpdate = vi.fn()
    const tree = PendingRpgUpdatesPanel({
      updates: [sampleUpdate()],
      onAcceptUpdate,
      onRejectUpdate: () => undefined,
      onApplyAcceptedUpdates: () => undefined,
    })

    findElementByTitle(tree, "Accept update update-scene").props.onClick?.()

    expect(onAcceptUpdate).toHaveBeenCalledWith("update-scene")
    expect(
      renderToStaticMarkup(
        <PendingRpgUpdatesPanel
          updates={[{ ...sampleUpdate(), status: "accepted" }]}
          onAcceptUpdate={() => undefined}
          onRejectUpdate={() => undefined}
          onApplyAcceptedUpdates={() => undefined}
        />,
      ),
    ).toContain("Accepted")
  })

  it("calls reject update and displays a rejected status", () => {
    const onRejectUpdate = vi.fn()
    const tree = PendingRpgUpdatesPanel({
      updates: [sampleUpdate()],
      onAcceptUpdate: () => undefined,
      onRejectUpdate,
      onApplyAcceptedUpdates: () => undefined,
    })

    findElementByTitle(tree, "Reject update update-scene").props.onClick?.()

    expect(onRejectUpdate).toHaveBeenCalledWith("update-scene")
    expect(
      renderToStaticMarkup(
        <PendingRpgUpdatesPanel
          updates={[{ ...sampleUpdate(), status: "rejected" }]}
          onAcceptUpdate={() => undefined}
          onRejectUpdate={() => undefined}
          onApplyAcceptedUpdates={() => undefined}
        />,
      ),
    ).toContain("Rejected")
  })

  it("enables apply only when at least one update is accepted", () => {
    const pendingTree = PendingRpgUpdatesPanel({
      updates: [sampleUpdate()],
      onAcceptUpdate: () => undefined,
      onRejectUpdate: () => undefined,
      onApplyAcceptedUpdates: () => undefined,
    })
    expect(findElementByTitle(pendingTree, "Apply accepted RPG updates").props.disabled).toBe(true)

    const acceptedTree = PendingRpgUpdatesPanel({
      updates: [{ ...sampleUpdate(), status: "accepted" }],
      onAcceptUpdate: () => undefined,
      onRejectUpdate: () => undefined,
      onApplyAcceptedUpdates: () => undefined,
    })
    expect(findElementByTitle(acceptedTree, "Apply accepted RPG updates").props.disabled).toBe(false)
  })

  it("calls apply and displays the latest apply result", () => {
    const onApplyAcceptedUpdates = vi.fn()
    const tree = PendingRpgUpdatesPanel({
      updates: [{ ...sampleUpdate(), status: "accepted" }],
      onAcceptUpdate: () => undefined,
      onRejectUpdate: () => undefined,
      onApplyAcceptedUpdates,
    })

    findElementByTitle(tree, "Apply accepted RPG updates").props.onClick?.()

    expect(onApplyAcceptedUpdates).toHaveBeenCalledTimes(1)

    const html = renderToStaticMarkup(
      <PendingRpgUpdatesPanel
        updates={[{ ...sampleUpdate(), status: "accepted" }]}
        onAcceptUpdate={() => undefined}
        onRejectUpdate={() => undefined}
        onApplyAcceptedUpdates={() => undefined}
        applyResult={sampleApplyResult()}
        skippedApplyReasons={{ "update-skipped": "targetPath is outside allowed runtime write paths." }}
      />,
    )

    expect(html).toContain("Last apply result")
    expect(html).toContain("Affected paths")
    expect(html).toContain("wiki/current-scene/scene_state.md")
    expect(html).toContain("Applied updates")
    expect(html).toContain("update-scene: wiki/current-scene/scene_state.md")
    expect(html).toContain("Skipped updates")
    expect(html).toContain("targetPath is outside allowed runtime write paths.")
    expect(html).toContain("Warnings")
    expect(html).toContain("Skipped RPG pending update")
  })
})

function sampleUpdate(): PendingRpgUpdate {
  return {
    id: "update-scene",
    targetPath: "wiki/current-scene/scene_state.md",
    strategy: "overwrite",
    reason: "Refresh the current scene snapshot.",
    content: "# Current Scene\n\nThe lantern key has answered the sigil.",
    sourceTurnId: "turn-1",
    references: ["wiki/events/canal-gate.md"],
    status: "pending",
  }
}

function sampleApplyResult(): ApplyRpgPendingUpdatesResult {
  return {
    appliedUpdates: [
      {
        id: "update-scene",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        status: "applied",
      },
    ],
    skippedUpdates: [
      {
        id: "update-skipped",
        targetPath: "wiki/world/stable.md",
        reason: "targetPath is outside allowed runtime write paths.",
      },
    ],
    warnings: ["Skipped RPG pending update"],
  }
}

type ElementProps = {
  title?: string
  disabled?: boolean
  onClick?: () => void
  children?: ReactNode
}

function findElementByTitle(node: ReactNode, title: string): ReactElement<ElementProps> {
  const found = findElement(node, (element) => element.props.title === title)
  if (!found) throw new Error(`Could not find element with title "${title}".`)
  return found
}

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement<ElementProps>) => boolean,
): ReactElement<ElementProps> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate)
      if (found) return found
    }
    return null
  }

  if (!React.isValidElement<ElementProps>(node)) return null
  if (predicate(node)) return node

  return findElement(node.props.children, predicate)
}

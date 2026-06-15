import * as React from "react"
import type { ReactElement, ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { PendingRpgUpdatesPanel } from "@/components/rpg"
import type { PendingRpgUpdate } from "@/lib/rpg-runtime"
import type { ApplyRpgPendingUpdatesResult } from "@/lib/rpg-runtime/write-policy-shared"

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

    expect(html).toContain("待处理 RPG 更新")
    expect(html).toContain("wiki/current-scene/scene_state.md")
    expect(html).toContain("overwrite")
    expect(html).toContain("待定")
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

    findElementByTitle(tree, "接受更新 update-scene").props.onClick?.()

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
    ).toContain("已接受")
  })

  it("calls reject update and displays a rejected status", () => {
    const onRejectUpdate = vi.fn()
    const tree = PendingRpgUpdatesPanel({
      updates: [sampleUpdate()],
      onAcceptUpdate: () => undefined,
      onRejectUpdate,
      onApplyAcceptedUpdates: () => undefined,
    })

    findElementByTitle(tree, "拒绝更新 update-scene").props.onClick?.()

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
    ).toContain("已拒绝")
  })

  it("enables apply only when at least one update is accepted", () => {
    const pendingTree = PendingRpgUpdatesPanel({
      updates: [sampleUpdate()],
      onAcceptUpdate: () => undefined,
      onRejectUpdate: () => undefined,
      onApplyAcceptedUpdates: () => undefined,
    })
    expect(findElementByTitle(pendingTree, "应用已接受的 RPG 更新").props.disabled).toBe(true)

    const acceptedTree = PendingRpgUpdatesPanel({
      updates: [{ ...sampleUpdate(), status: "accepted" }],
      onAcceptUpdate: () => undefined,
      onRejectUpdate: () => undefined,
      onApplyAcceptedUpdates: () => undefined,
    })
    expect(findElementByTitle(acceptedTree, "应用已接受的 RPG 更新").props.disabled).toBe(false)
  })

  it("calls apply and displays the latest apply result", () => {
    const onApplyAcceptedUpdates = vi.fn()
    const tree = PendingRpgUpdatesPanel({
      updates: [{ ...sampleUpdate(), status: "accepted" }],
      onAcceptUpdate: () => undefined,
      onRejectUpdate: () => undefined,
      onApplyAcceptedUpdates,
    })

    findElementByTitle(tree, "应用已接受的 RPG 更新").props.onClick?.()

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

    expect(html).toContain("上次应用结果")
    expect(html).toContain("受影响路径")
    expect(html).toContain("wiki/current-scene/scene_state.md")
    expect(html).toContain("已应用更新")
    expect(html).toContain("update-scene: wiki/current-scene/scene_state.md")
    expect(html).toContain("已跳过更新")
    expect(html).toContain("targetPath is outside allowed runtime write paths.")
    expect(html).toContain("警告")
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
        targetPath: "wiki/world/basic_overview.md",
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
  if (!found) throw new Error(`找不到 title 为 "${title}" 的元素。`)
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

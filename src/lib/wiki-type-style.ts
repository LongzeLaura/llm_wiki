import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  GitMerge,
  Hash,
  HelpCircle,
  Layout,
  Lightbulb,
  Network,
  RotateCcw,
  Target,
  TrendingUp,
  Users,
} from "lucide-react"
import { getAllCategoryDefinitions, getCategoryDefinition } from "@/lib/category-registry"
import { wikiTypeLabel } from "@/lib/wiki-page-types"

export interface WikiTypeStyle {
  /** Display label for chips and tooltips. Capitalized. */
  label: string
  /** Group label for tree sections and similar plural contexts. */
  pluralLabel: string
  /** Lucide icon component for the type. */
  icon: LucideIcon
  /**
   * Tailwind classes for a colored chip (background + text). Includes
   * dark-mode variants so the chip stays readable on either theme.
   */
  chipClass: string
  /**
   * Tailwind class for the type's accent dot or border (without the
   * 15% opacity used by chips). Useful for connector lines.
   */
  dotClass: string
  /** Accent text color for tree rows, reference badges, and activity rows. */
  accentClass: string
  /** Stable hex color for graph nodes and legends. */
  graphColor: string
  /** Stable UI ordering from the category registry when available. */
  order: number
}

type WikiTypeStyleTokens = Omit<WikiTypeStyle, "label" | "pluralLabel" | "order">

const WIKI_TYPE_STYLE_TOKENS: Record<string, WikiTypeStyleTokens> = {
  overview: {
    icon: Layout,
    chipClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    dotClass: "bg-indigo-500",
    accentClass: "text-yellow-500",
    graphColor: "#facc15",
  },
  source: {
    icon: BookOpen,
    chipClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    dotClass: "bg-slate-500",
    accentClass: "text-orange-500",
    graphColor: "#fb923c",
  },
  entity: {
    icon: Users,
    chipClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    dotClass: "bg-blue-500",
    accentClass: "text-blue-500",
    graphColor: "#60a5fa",
  },
  concept: {
    icon: Lightbulb,
    chipClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
    accentClass: "text-purple-500",
    graphColor: "#c084fc",
  },
  catalytic_system: {
    icon: Network,
    chipClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    dotClass: "bg-cyan-500",
    accentClass: "text-cyan-500",
    graphColor: "#06b6d4",
  },
  elementary_process: {
    icon: RotateCcw,
    chipClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500",
    accentClass: "text-amber-500",
    graphColor: "#f59e0b",
  },
  mechanistic_network: {
    icon: GitMerge,
    chipClass: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
    dotClass: "bg-fuchsia-500",
    accentClass: "text-fuchsia-500",
    graphColor: "#d946ef",
  },
  evidence_claim: {
    icon: CheckCircle2,
    chipClass: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
    dotClass: "bg-lime-500",
    accentClass: "text-lime-500",
    graphColor: "#84cc16",
  },
  comparison: {
    icon: BarChart3,
    chipClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
    accentClass: "text-teal-500",
    graphColor: "#2dd4bf",
  },
  query: {
    icon: HelpCircle,
    chipClass: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    dotClass: "bg-yellow-500",
    accentClass: "text-green-500",
    graphColor: "#4ade80",
  },
  synthesis: {
    icon: GitMerge,
    chipClass: "bg-red-500/15 text-red-700 dark:text-red-300",
    dotClass: "bg-red-500",
    accentClass: "text-red-500",
    graphColor: "#f87171",
  },
  finding: {
    icon: TrendingUp,
    chipClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    dotClass: "bg-purple-500",
    accentClass: "text-purple-500",
    graphColor: "#a855f7",
  },
  thesis: {
    icon: Target,
    chipClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    dotClass: "bg-rose-500",
    accentClass: "text-rose-500",
    graphColor: "#f43f5e",
  },
  methodology: {
    icon: BookOpen,
    chipClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    dotClass: "bg-teal-500",
    accentClass: "text-teal-500",
    graphColor: "#14b8a6",
  },
}

export const WIKI_TYPE_STYLES: Record<string, WikiTypeStyle> = buildWikiTypeStyles()

export const FALLBACK_TYPE_STYLE: WikiTypeStyle = {
  label: "Page",
  pluralLabel: "Pages",
  icon: Hash,
  chipClass: "bg-muted text-muted-foreground",
  dotClass: "bg-muted-foreground/60",
  accentClass: "text-muted-foreground",
  graphColor: "#94a3b8",
  order: 99,
}

export function getWikiTypeStyle(type: string | null | undefined): WikiTypeStyle {
  if (!type) return FALLBACK_TYPE_STYLE
  const key = type.trim().toLowerCase()
  const styleKey = getCategoryDefinition(key)?.styleKey ?? key
  const style = WIKI_TYPE_STYLES[styleKey]
  if (style) return style
  const label = wikiTypeLabel(type)
  return {
    ...FALLBACK_TYPE_STYLE,
    label,
    pluralLabel: label,
  }
}

export function compareWikiTypeOrder(typeA: string, typeB: string): number {
  const styleA = getWikiTypeStyle(typeA)
  const styleB = getWikiTypeStyle(typeB)
  if (styleA.order === styleB.order) {
    return styleA.label.localeCompare(styleB.label)
  }
  return styleA.order - styleB.order
}

function buildWikiTypeStyles(): Record<string, WikiTypeStyle> {
  const styles: Record<string, WikiTypeStyle> = {
    event: {
      label: "Event",
      pluralLabel: "Events",
      icon: Calendar,
      chipClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
      dotClass: "bg-cyan-500",
      accentClass: "text-cyan-500",
      graphColor: "#06b6d4",
      order: 99,
    },
  }

  for (const definition of getAllCategoryDefinitions()) {
    const styleTokens = WIKI_TYPE_STYLE_TOKENS[definition.styleKey]
    if (!styleTokens) continue
    styles[definition.id] = {
      label: definition.displayLabel,
      pluralLabel: definition.displayLabelPlural,
      order: definition.uiOrder,
      ...styleTokens,
    }
  }

  return styles
}

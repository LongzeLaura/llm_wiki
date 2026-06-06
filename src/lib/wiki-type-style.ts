import type { LucideIcon } from "lucide-react"
import {
  User,
  Users,
  FileText,
  Target,
  BookOpen,
  Calendar,
  Hash,
  Globe,
  MapPinned,
  Shield,
  Package,
  Eye,
  Link2,
  GitMerge,
} from "lucide-react"

export interface WikiTypeStyle {
  /** Display label for chips and tooltips. Capitalized. */
  label: string
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
}

export const WIKI_TYPE_STYLES: Record<string, WikiTypeStyle> = {
  source: {
    label: "Source",
    icon: FileText,
    chipClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    dotClass: "bg-slate-500",
  },
  world: {
    label: "World",
    icon: Globe,
    chipClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  characters: {
    label: "Characters",
    icon: Users,
    chipClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    dotClass: "bg-blue-500",
  },
  player: {
    label: "Player",
    icon: User,
    chipClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    dotClass: "bg-cyan-500",
  },
  locations: {
    label: "Locations",
    icon: MapPinned,
    chipClass: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
    dotClass: "bg-lime-500",
  },
  factions: {
    label: "Factions",
    icon: Shield,
    chipClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    dotClass: "bg-sky-500",
  },
  items: {
    label: "Items",
    icon: Package,
    chipClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    dotClass: "bg-orange-500",
  },
  "plot-arcs": {
    label: "Plot Arcs",
    icon: GitMerge,
    chipClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    dotClass: "bg-violet-500",
  },
  events: {
    label: "Events",
    icon: Calendar,
    chipClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  "current-scene": {
    label: "Current Scene",
    icon: Eye,
    chipClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    dotClass: "bg-rose-500",
  },
  relationships: {
    label: "Relationships",
    icon: Link2,
    chipClass: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
    dotClass: "bg-pink-500",
  },
  event: {
    label: "Event",
    icon: Calendar,
    chipClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    dotClass: "bg-cyan-500",
  },
  overview: {
    label: "Overview",
    icon: BookOpen,
    chipClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    dotClass: "bg-indigo-500",
  },
  style: {
    label: "Style",
    icon: FileText,
    chipClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    dotClass: "bg-purple-500",
  },
  rules: {
    label: "Rules",
    icon: BookOpen,
    chipClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    dotClass: "bg-teal-500",
  },
  quests: {
    label: "Quests",
    icon: Target,
    chipClass: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    dotClass: "bg-yellow-500",
  },
  memory: {
    label: "Memory",
    icon: FileText,
    chipClass: "bg-stone-500/15 text-stone-700 dark:text-stone-300",
    dotClass: "bg-stone-500",
  },
}

export const FALLBACK_TYPE_STYLE: WikiTypeStyle = {
  label: "Page",
  icon: Hash,
  chipClass: "bg-muted text-muted-foreground",
  dotClass: "bg-muted-foreground/60",
}

export function getWikiTypeStyle(type: string | null | undefined): WikiTypeStyle {
  if (!type) return FALLBACK_TYPE_STYLE
  const key = type.trim().toLowerCase()
  return WIKI_TYPE_STYLES[key] ?? FALLBACK_TYPE_STYLE
}

import {
  Magnet,
  Percent,
  TrendingUp,
  GraduationCap,
  Heart,
  Flag,
  Shield,
  Sparkles,
  Users,
  Building2,
  Leaf,
  Award,
  type LucideIcon,
} from "lucide-react";

/**
 * The curated icon set the Studio offers for `icon`-type fields (e.g. the
 * SolutionsGrid cards). Content stores the string KEY (`"magnet"`); components
 * resolve it to a Lucide component here. Keep this the single source of truth so
 * the picker and the renderer never drift. Extend by adding an entry + key.
 *
 * An unknown key (older content, hand-edited JSON) renders the `FALLBACK_ICON`
 * rather than throwing — the value is always plain data, never executable.
 */
export const ICON_REGISTRY: Record<string, LucideIcon> = {
  magnet: Magnet,
  percent: Percent,
  "trending-up": TrendingUp,
  "graduation-cap": GraduationCap,
  heart: Heart,
  flag: Flag,
  shield: Shield,
  sparkles: Sparkles,
  users: Users,
  building: Building2,
  leaf: Leaf,
  award: Award,
};

/** Display order for the icon picker. */
export const ICON_KEYS = Object.keys(ICON_REGISTRY);

export const FALLBACK_ICON = Sparkles;

/** Resolve an icon key to its component, falling back when unknown. */
export function iconFor(key: string): LucideIcon {
  return ICON_REGISTRY[key] ?? FALLBACK_ICON;
}

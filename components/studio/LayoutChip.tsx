"use client";

import { useIsEditMode } from "@/lib/studio/use-edit-mode";

/**
 * A small edit-mode-only affordance pinned to a section. Carries the layout
 * field's path + current value so the bridge selects it like any other field
 * (data-field-type="layout"), opening the panel's layout controls + AI box.
 * Renders nothing on the live site.
 */
export function LayoutChip({
  path,
  value,
  label = "Layout",
}: {
  path: string;
  value: string;
  label?: string;
}) {
  const isEdit = useIsEditMode();
  if (!isEdit) return null;
  return (
    <button
      type="button"
      data-content-path={path}
      data-field-type="layout"
      data-current={value}
      className="absolute right-3 top-3 z-30 inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-cyan-800 shadow-sm backdrop-blur hover:bg-white"
    >
      ✦ {label}
    </button>
  );
}

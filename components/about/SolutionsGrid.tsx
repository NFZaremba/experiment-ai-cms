"use client";

import dynamic from "next/dynamic";
import { Text, cn } from "@syscore/ui-library";
import { Magnet, Percent, TrendingUp, GraduationCap, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getAboutContent } from "@/lib/content";
import { LayoutChip } from "@/components/studio/LayoutChip";
import { useLayoutValue, useOrderedItems, useIsEditMode } from "@/lib/studio/use-edit-mode";
import type { HandleProps } from "@/components/studio/ReorderableList";

const ReorderableList = dynamic(
  () => import("@/components/studio/ReorderableList").then((m) => m.ReorderableList),
  { ssr: false }
);

const { solutions } = getAboutContent();
const PAGE = "about";

/** "WELL offers solutions for:" — an icon + title + body grid. Column count is
 *  an AI-editable layout variant (four | three | two). */
const ICONS: Record<string, LucideIcon> = {
  magnet: Magnet,
  percent: Percent,
  "trending-up": TrendingUp,
  "graduation-cap": GraduationCap,
};

const ICON_COLOR = ["text-cyan-700", "text-plum-400", "text-bronze-600", "text-emerald-700"];

const COLS: Record<string, string> = {
  four: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  three: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  two: "grid-cols-1 sm:grid-cols-2",
};

export function SolutionsGrid() {
  const columns = useLayoutValue(PAGE, "solutions.columns", solutions.columns);
  const isEdit = useIsEditMode();
  const items = useOrderedItems(PAGE, "solutions.items", solutions.items);
  const gridCls = cn("grid gap-8", COLS[columns] ?? COLS.four);

  const renderCard = (item: (typeof solutions.items)[number], handle?: HandleProps) => {
    const Icon = ICONS[item.icon] ?? Sparkles;
    const idx = solutions.items.findIndex((s) => s.id === item.id);
    return (
      <div className="flex flex-col gap-3">
        {handle && (
          <button
            type="button"
            ref={handle.ref}
            {...handle.attributes}
            {...handle.listeners}
            aria-label={`Drag to reorder ${item.title}`}
            className="cursor-grab self-start rounded p-1 text-gray-400 hover:bg-gray-100 active:cursor-grabbing"
          >
            ⠿
          </button>
        )}
        <Icon className={cn("h-9 w-9", ICON_COLOR[idx % ICON_COLOR.length])} strokeWidth={1.5} />
        <Text as="h3" variant="body-large" className="font-semibold text-gray-800" data-content-path={`solutions.items.${item.id}.title`}>
          {item.title}
        </Text>
        <Text as="p" variant="body-small" className="text-gray-600" data-content-path={`solutions.items.${item.id}.body`}>
          {item.body}
        </Text>
      </div>
    );
  };

  return (
    <section className="relative bg-gray-50 pb-20">
      <LayoutChip path="solutions.columns" value={columns} label="Columns" />
      <div className="container-sm mx-auto">
        <Text as="h2" variant="heading-small" className="mb-10 text-gray-800" data-content-path="solutions.heading">
          {solutions.heading}
        </Text>
        {isEdit ? (
          <ReorderableList
            path="solutions.items"
            items={items}
            className={gridCls}
            renderItem={(item, handle) => renderCard(item as (typeof solutions.items)[number], handle)}
          />
        ) : (
          <div className={gridCls}>{items.map((item) => <div key={item.id}>{renderCard(item)}</div>)}</div>
        )}
      </div>
    </section>
  );
}

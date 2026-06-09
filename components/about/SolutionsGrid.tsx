"use client";

import dynamic from "next/dynamic";
import { Text, cn } from "@syscore/ui-library";
import { getAboutContent } from "@/lib/content";
import { iconFor } from "@/lib/content/icons";
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
 *  an AI-editable layout variant (four | three | two); each card's icon is an
 *  editable `icon`-type field. */
const ICON_COLOR = ["text-cyan-700", "text-plum-400", "text-bronze-600", "text-emerald-700"];

const COLS: Record<string, string> = {
  four: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  three: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  two: "grid-cols-1 sm:grid-cols-2",
};

/** One card. Its own component so it can read its live icon key from the draft
 *  (a hook can't be called inside a `.map` render callback). */
function SolutionCard({
  item,
  handle,
}: {
  item: (typeof solutions.items)[number];
  handle?: HandleProps;
}) {
  const idx = solutions.items.findIndex((s) => s.id === item.id);
  const iconKey = useLayoutValue(PAGE, `solutions.items.${item.id}.icon`, item.icon);
  const Icon = iconFor(iconKey);
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
      <span
        data-content-path={`solutions.items.${item.id}.icon`}
        data-field-type="icon"
        data-current={iconKey}
        className="inline-flex w-fit"
      >
        <Icon className={cn("h-9 w-9", ICON_COLOR[idx % ICON_COLOR.length])} strokeWidth={1.5} />
      </span>
      <Text as="h3" variant="body-large" className="font-semibold text-gray-800" data-content-path={`solutions.items.${item.id}.title`}>
        {item.title}
      </Text>
      <Text as="p" variant="body-small" className="text-gray-600" data-content-path={`solutions.items.${item.id}.body`}>
        {item.body}
      </Text>
    </div>
  );
}

export function SolutionsGrid() {
  const columns = useLayoutValue(PAGE, "solutions.columns", solutions.columns);
  const isEdit = useIsEditMode();
  const items = useOrderedItems(PAGE, "solutions.items", solutions.items);
  const gridCls = cn("grid gap-8", COLS[columns] ?? COLS.four);

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
            renderItem={(item, handle) => (
              <SolutionCard item={item as (typeof solutions.items)[number]} handle={handle} />
            )}
          />
        ) : (
          <div className={gridCls}>
            {items.map((item) => (
              <SolutionCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

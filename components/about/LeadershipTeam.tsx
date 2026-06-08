"use client";

import dynamic from "next/dynamic";
import { Text, Button, cn } from "@syscore/ui-library";
import { getAboutContent } from "@/lib/content";
import { LayoutChip } from "@/components/studio/LayoutChip";
import { useLayoutValue, useOrderedItems, useIsEditMode } from "@/lib/studio/use-edit-mode";
import type { HandleProps } from "@/components/studio/ReorderableList";

const ReorderableList = dynamic(
  () => import("@/components/studio/ReorderableList").then((m) => m.ReorderableList),
  { ssr: false }
);

const { team } = getAboutContent();
const PAGE = "about";

/** "Meet the leadership team" — a member grid. Column count is the AI-editable
 *  layout variant (four | three | two). Faces are gray placeholders with
 *  initials (no real photography needed for the test surface). */
const COLS: Record<string, string> = {
  four: "grid-cols-2 lg:grid-cols-4",
  three: "grid-cols-2 lg:grid-cols-3",
  two: "grid-cols-1 sm:grid-cols-2",
};

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export function LeadershipTeam() {
  const columns = useLayoutValue(PAGE, "team.columns", team.columns);
  const isEdit = useIsEditMode();
  const members = useOrderedItems(PAGE, "team.members", team.members);
  const gridCls = cn("grid w-full gap-x-6 gap-y-10", COLS[columns] ?? COLS.four);

  const renderMember = (m: (typeof team.members)[number], handle?: HandleProps) => (
    <div className="flex flex-col">
      {handle && (
        <button
          type="button"
          ref={handle.ref}
          {...handle.attributes}
          {...handle.listeners}
          aria-label={`Drag to reorder ${m.name}`}
          className="mb-1 cursor-grab self-start rounded p-1 text-gray-400 hover:bg-gray-100 active:cursor-grabbing"
        >
          ⠿
        </button>
      )}
      <div className="mb-4 flex aspect-square w-full items-center justify-center rounded-lg bg-gray-200 text-gray-400">
        <span className="heading-small">{initials(m.name)}</span>
      </div>
      <Text as="p" variant="body-large" className="font-semibold text-gray-800" data-content-path={`team.members.${m.id}.name`}>
        {m.name}
      </Text>
      <Text as="p" variant="body-small" className="text-gray-500" data-content-path={`team.members.${m.id}.role`}>
        {m.role}
      </Text>
    </div>
  );

  return (
    <section className="relative bg-white py-20">
      <LayoutChip path="team.columns" value={columns} label="Columns" />
      <div className="container-sm mx-auto flex flex-col items-center">
        <Text as="h2" variant="heading-large" className="mb-12 text-center text-gray-800" data-content-path="team.heading">
          {team.heading}
        </Text>
        {isEdit ? (
          <ReorderableList
            path="team.members"
            items={members}
            className={gridCls}
            renderItem={(m, handle) => renderMember(m as (typeof team.members)[number], handle)}
          />
        ) : (
          <div className={gridCls}>{members.map((m) => <div key={m.id}>{renderMember(m)}</div>)}</div>
        )}
        <Button
          variant="secondary-light"
          size="large"
          className="mt-14"
          data-content-path="team.cta"
        >
          {team.cta}
        </Button>
      </div>
    </section>
  );
}

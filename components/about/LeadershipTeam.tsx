"use client";

import dynamic from "next/dynamic";
import { Button, cn } from "@syscore/ui-library";
import { EditableText } from "@/components/studio/EditableText";
import { getAboutContent } from "@/lib/content";
import { LayoutChip } from "@/components/studio/LayoutChip";
import { useLayoutValue, useOrderedItems, useImageValue, useIsEditMode } from "@/lib/studio/use-edit-mode";
import type { HandleProps } from "@/components/studio/ReorderableList";

const ReorderableList = dynamic(
  () => import("@/components/studio/ReorderableList").then((m) => m.ReorderableList),
  { ssr: false }
);

const { team } = getAboutContent();
const PAGE = "about";

/** "Meet the leadership team" — a member grid. Column count is the AI-editable
 *  layout variant (four | three | two). Each face is an editable `image` field;
 *  members with no photo set fall back to a gray initials placeholder. */
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

/** One member. Its own component so it can read its live avatar from the draft
 *  (a hook can't be called inside a `.map` render callback). */
function TeamMember({
  m,
  handle,
}: {
  m: (typeof team.members)[number];
  handle?: HandleProps;
}) {
  const image = useImageValue(PAGE, `team.members.${m.id}.image`, m.image);
  const avatarProps = {
    "data-content-path": `team.members.${m.id}.image`,
    "data-field-type": "image",
  } as const;
  return (
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
      {image?.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar can be a
        // local path or a remote Cloudinary URL; plain img keeps the editor's
        // live src-swap simple (no next/image srcset to fight).
        <img
          {...avatarProps}
          data-src={image.src}
          src={image.src}
          alt={image.alt}
          className="mb-4 aspect-square w-full rounded-lg bg-gray-200 object-cover"
        />
      ) : (
        <div
          {...avatarProps}
          className="mb-4 flex aspect-square w-full items-center justify-center rounded-lg bg-gray-200 text-gray-400"
        >
          <span className="heading-small">{initials(m.name)}</span>
        </div>
      )}
      <EditableText as="p" variant="body-large" className="font-semibold text-gray-800" path={`team.members.${m.id}.name`}>
        {m.name}
      </EditableText>
      <EditableText as="p" variant="body-small" className="text-gray-500" path={`team.members.${m.id}.role`}>
        {m.role}
      </EditableText>
    </div>
  );
}

export function LeadershipTeam() {
  const columns = useLayoutValue(PAGE, "team.columns", team.columns);
  const isEdit = useIsEditMode();
  const members = useOrderedItems(PAGE, "team.members", team.members);
  const gridCls = cn("grid w-full gap-x-6 gap-y-10", COLS[columns] ?? COLS.four);

  return (
    <section className="relative bg-white py-20">
      <LayoutChip path="team.columns" value={columns} label="Columns" />
      <div className="container-sm mx-auto flex flex-col items-center">
        <EditableText as="h2" variant="heading-large" className="mb-12 text-center text-gray-800" path="team.heading">
          {team.heading}
        </EditableText>
        {isEdit ? (
          <ReorderableList
            path="team.members"
            items={members}
            className={gridCls}
            renderItem={(m, handle) => (
              <TeamMember m={m as (typeof team.members)[number]} handle={handle} />
            )}
          />
        ) : (
          <div className={gridCls}>
            {members.map((m) => (
              <TeamMember key={m.id} m={m} />
            ))}
          </div>
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

"use client";

import { Text, Button, cn } from "@syscore/ui-library";
import { getAboutContent } from "@/lib/content";
import { LayoutChip } from "@/components/studio/LayoutChip";
import { useLayoutValue } from "@/lib/studio/use-edit-mode";

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

  return (
    <section className="relative bg-white py-20">
      <LayoutChip path="team.columns" value={columns} label="Columns" />
      <div className="container-sm mx-auto flex flex-col items-center">
        <Text as="h2" variant="heading-large" className="mb-12 text-center text-gray-800" data-content-path="team.heading">
          {team.heading}
        </Text>
        <div className={cn("grid w-full gap-x-6 gap-y-10", COLS[columns] ?? COLS.four)}>
          {team.members.map((m, i) => (
            <div key={i} className="flex flex-col">
              <div className="mb-4 flex aspect-square w-full items-center justify-center rounded-lg bg-gray-200 text-gray-400">
                <span className="heading-small">{initials(m.name)}</span>
              </div>
              <Text as="p" variant="body-large" className="font-semibold text-gray-800" data-content-path={`team.members.${i}.name`}>
                {m.name}
              </Text>
              <Text as="p" variant="body-small" className="text-gray-500" data-content-path={`team.members.${i}.role`}>
                {m.role}
              </Text>
            </div>
          ))}
        </div>
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

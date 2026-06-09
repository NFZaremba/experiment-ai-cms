import Link from "next/link";
import { PAGE_LIST } from "@/lib/content/pages";

/**
 * Studio landing. Auth is handled by app/studio/layout.tsx (shows StudioLogin
 * when unauthed), so reaching here means you're a studio user. Editing is now
 * in-place: open any registered page and click the ✦ pencil (bottom-right) to
 * edit it on the page itself — no iframe, no switcher. This page is just the
 * directory + jump-off point.
 */
export default function StudioPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-2xl font-semibold text-gray-900">Content Studio</h1>
      <p className="mt-2 text-sm text-gray-600">
        Open any page below, then click the <span className="font-medium text-cyan-700">✦</span>{" "}
        pencil in the bottom-right corner to edit it in place.
      </p>

      <ul className="mt-8 flex flex-col gap-2">
        {PAGE_LIST.map((p) => (
          <li key={p.slug}>
            <Link
              href={p.route}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm transition-colors hover:border-cyan-400 hover:bg-cyan-50"
            >
              <span className="font-medium text-gray-900">{p.label}</span>
              <span className="text-xs text-gray-400">{p.route}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

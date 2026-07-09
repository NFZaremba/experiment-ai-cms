import "server-only";
import { Octokit } from "@octokit/rest";
import type { ChangeSet } from "./changeset";

/**
 * Thin Octokit wrapper for the publish spine: branch → commit file(s) → PR →
 * merge. The user never sees any of this; the Studio shows only "Publish"
 * (→ preview) and "Publish for real" (→ merge).
 */

function config() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const base = process.env.GITHUB_BASE_BRANCH || "main";
  if (!token || !owner || !repo) {
    throw new Error(
      "GitHub publishing is not configured (set GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME)."
    );
  }
  return { octokit: new Octokit({ auth: token }), owner, repo, base };
}

export function isGithubConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_TOKEN && process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME
  );
}

/** One stable branch per page → one shared preview per page. */
function branchForPage(slug: string): string {
  return `studio/${slug}`;
}

/** Netlify deploy-preview URL for a PR, or null when the site name isn't set. */
export function previewUrlFor(prNumber: number): string | null {
  const site = process.env.NETLIFY_SITE_NAME;
  return site ? `https://deploy-preview-${prNumber}--${site}.netlify.app` : null;
}

export type PublishResult = {
  prNumber: number;
  prUrl: string;
  baseSha: string;
  /** The commit SHA produced by this publish — used to poll the RIGHT build. */
  headSha?: string;
};

/**
 * Commit a ChangeSet's files onto an existing branch (create or update each).
 * Returns the new head commit SHA so callers can poll the exact build instead
 * of the PR's (eventually-consistent) head, which can lag a fresh push.
 */
async function commitFiles(branch: string, changeSet: ChangeSet): Promise<string | undefined> {
  const { octokit, owner, repo } = config();
  let headSha: string | undefined;
  for (const file of changeSet.files) {
    // updating an existing blob requires its current sha ON THIS BRANCH.
    let sha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({ owner, repo, path: file.path, ref: branch });
      if (!Array.isArray(existing.data) && "sha" in existing.data) {
        sha = existing.data.sha;
      }
    } catch {
      // New file — no existing sha.
    }

    const res = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.path,
      branch,
      message: changeSet.summary,
      content: Buffer.from(file.newContents, "utf8").toString("base64"),
      sha,
    });
    headSha = res.data.commit.sha ?? headSha;
  }
  return headSha;
}

/**
 * Minimal structural slice of Octokit used by the branch-lifecycle helpers, so
 * tests can exercise them with a fake client.
 */
export type BranchRefClient = {
  git: {
    createRef: (p: { owner: string; repo: string; ref: string; sha: string }) => Promise<unknown>;
    updateRef: (p: {
      owner: string;
      repo: string;
      ref: string;
      sha: string;
      force?: boolean;
    }) => Promise<unknown>;
    deleteRef: (p: { owner: string; repo: string; ref: string }) => Promise<unknown>;
  };
};

/**
 * Point `branch` at `sha`, creating it when absent. A 422 "Reference already
 * exists" means an ORPHANED branch — merge/close left `studio/<slug>` behind
 * with no open PR — so force-reset it to the new base instead of failing the
 * publish. Any other error (auth, network) surfaces untouched.
 */
export async function ensureBranchAt(
  client: BranchRefClient,
  owner: string,
  repo: string,
  branch: string,
  sha: string
): Promise<void> {
  try {
    await client.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha });
  } catch (e) {
    if ((e as { status?: number })?.status !== 422) throw e;
    await client.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha, force: true });
  }
}

/**
 * Best-effort cleanup of a page's `studio/*` branch once its PR is closed or
 * merged — leaving it behind would orphan the branch and (pre-ensureBranchAt)
 * broke the page's next publish. Never touches non-studio branches; never
 * fails the caller.
 */
export async function deleteBranchIfStudio(
  client: BranchRefClient,
  owner: string,
  repo: string,
  branch: string
): Promise<void> {
  if (!branch.startsWith("studio/")) return;
  try {
    await client.git.deleteRef({ owner, repo, ref: `heads/${branch}` });
  } catch {
    // Branch already gone / not deletable — ignore.
  }
}

/** Create (or reclaim) the branch off base, commit the ChangeSet's files, open a PR. */
export async function publishChangeSet(
  branch: string,
  changeSet: ChangeSet
): Promise<PublishResult> {
  const { octokit, owner, repo, base } = config();

  const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${base}` });
  const baseSha = baseRef.data.object.sha;

  await ensureBranchAt(octokit, owner, repo, branch, baseSha);

  const headSha = await commitFiles(branch, changeSet);

  const pr = await octokit.pulls.create({
    owner,
    repo,
    title: changeSet.summary,
    body: "Published from the Content Studio. Review the deploy preview, then merge to go live.",
    head: branch,
    base,
  });

  return { prNumber: pr.data.number, prUrl: pr.data.html_url, baseSha, headSha };
}

export type OpenPreview = { prNumber: number; prUrl: string; branch: string; headSha: string };

/**
 * The authoritative open preview(s) for ONE page — GitHub is the source of
 * truth, never the client. A page's preview is the open PR on its stable
 * `studio/<slug>` branch. Newest first (normally 0 or 1).
 */
export async function findOpenStudioPRForPage(slug: string): Promise<OpenPreview[]> {
  const { octokit, owner, repo, base } = config();
  const res = await octokit.pulls.list({ owner, repo, state: "open", base, per_page: 100 });
  const wanted = branchForPage(slug);
  return res.data
    .filter((pr) => pr.head.ref === wanted)
    .map((pr) => ({
      prNumber: pr.number,
      prUrl: pr.html_url,
      branch: pr.head.ref,
      headSha: pr.head.sha,
    }))
    .sort((a, b) => b.prNumber - a.prNumber);
}

/** Read a file's UTF-8 contents at a git ref, or null if it's absent. */
async function readFileOnRef(ref: string, path: string): Promise<string | null> {
  const { octokit, owner, repo } = config();
  try {
    const res = await octokit.repos.getContent({ owner, repo, path, ref });
    if (!Array.isArray(res.data) && "content" in res.data && typeof res.data.content === "string") {
      return Buffer.from(res.data.content, "base64").toString("utf8");
    }
  } catch {
    // Missing file / bad ref.
  }
  return null;
}

/** Structural JSON equality, so whitespace/formatting can't trip the no-op guard. */
function sameJson(a: string, b: string): boolean {
  try {
    return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
  } catch {
    return a === b;
  }
}

export type PublishOutcome = {
  prNumber: number;
  prUrl: string;
  reused: boolean; // advanced an existing preview vs. created a new one
  noop: boolean; // nothing changed vs. the target — no commit made
  headSha: string | null; // the commit this publish produced (null on no-op)
};

/**
 * Publish ONE page, reconciled against GitHub truth, enforcing AT MOST ONE open
 * preview per page:
 *  - collapse any stray previews for this page (orphans / races) to the newest;
 *  - skip if the content already matches the target (this page's open preview,
 *    or base);
 *  - otherwise advance this page's existing preview, or create its first one.
 *
 * Keyed by `slug` so each page gets its own `studio/<slug>` branch + preview —
 * different pages never touch the same file.
 */
export async function publishOrUpdate(slug: string, changeSet: ChangeSet): Promise<PublishOutcome> {
  const { base } = config();
  const open = await findOpenStudioPRForPage(slug);

  // Single-preview-per-page invariant: close any extras beyond the newest.
  for (const extra of open.slice(1)) {
    try {
      await closePullRequest(extra.prNumber);
    } catch {
      // best-effort self-heal
    }
  }

  const existing = open[0] ?? null;
  const file = changeSet.files[0];
  const compareRef = existing ? existing.branch : base;

  const current = await readFileOnRef(compareRef, file.path);
  if (current !== null && sameJson(current, file.newContents)) {
    return existing
      ? { prNumber: existing.prNumber, prUrl: existing.prUrl, reused: true, noop: true, headSha: existing.headSha }
      : { prNumber: 0, prUrl: "", reused: false, noop: true, headSha: null };
  }

  if (existing) {
    const headSha = await commitFiles(existing.branch, changeSet);
    return { prNumber: existing.prNumber, prUrl: existing.prUrl, reused: true, noop: false, headSha: headSha ?? null };
  }

  const branch = branchForPage(slug);
  const res = await publishChangeSet(branch, changeSet);
  return { prNumber: res.prNumber, prUrl: res.prUrl, reused: false, noop: false, headSha: res.headSha ?? null };
}

export type PullStatus = "pending" | "success" | "failure";

/**
 * Combined CI status for a PR's head commit (Netlify posts a deploy-preview
 * check/status here). Returns "pending" until something is reported.
 */
export async function getPullStatus(prNumber: number, sha?: string): Promise<PullStatus> {
  const { octokit, owner, repo } = config();
  // Prefer the caller-supplied commit SHA (the exact build just pushed). Falling
  // back to pulls.get is convenient but eventually-consistent — right after a
  // fresh commit it can return the PRIOR head, making a new build read as the
  // old one's "success" and the poll terminate early on stale state.
  let ref = sha;
  if (!ref) {
    const pr = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
    ref = pr.data.head.sha;
  }

  // Resilient: either API may be inaccessible if the token lacks that scope.
  const [combinedR, checksR] = await Promise.allSettled([
    octokit.repos.getCombinedStatusForRef({ owner, repo, ref }),
    octokit.checks.listForRef({ owner, repo, ref }),
  ]);
  if (combinedR.status === "rejected" && checksR.status === "rejected") {
    throw new Error(
      "Preview status unavailable — the GitHub token needs 'Commit statuses: Read' and 'Checks: Read'."
    );
  }
  const statuses = combinedR.status === "fulfilled" ? combinedR.value.data.statuses ?? [] : [];
  const runs = checksR.status === "fulfilled" ? checksR.value.data.check_runs ?? [] : [];

  if (statuses.length === 0 && runs.length === 0) return "pending"; // not reported yet

  const failed =
    statuses.some((s) => s.state === "failure" || s.state === "error") ||
    runs.some((r) =>
      ["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusion ?? "")
    );
  if (failed) return "failure";

  const pending =
    statuses.some((s) => s.state === "pending") ||
    runs.some((r) => r.status !== "completed");
  if (pending) return "pending";

  return "success";
}

/** Close a PR and (best-effort) delete its studio branch — cleanup on Reset. */
export async function closePullRequest(prNumber: number): Promise<void> {
  const { octokit, owner, repo } = config();
  const pr = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
  await octokit.pulls.update({ owner, repo, pull_number: prNumber, state: "closed" });
  await deleteBranchIfStudio(octokit, owner, repo, pr.data.head.ref);
}

/** Squash-merge a PR (→ production deploy on merge to base). */
export async function mergePullRequest(prNumber: number): Promise<{ merged: boolean; sha?: string }> {
  const { octokit, owner, repo } = config();
  const pr = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
  const res = await octokit.pulls.merge({
    owner,
    repo,
    pull_number: prNumber,
    merge_method: "squash",
  });
  if (res.data.merged) {
    await deleteBranchIfStudio(octokit, owner, repo, pr.data.head.ref);
  }
  return { merged: res.data.merged, sha: res.data.sha };
}

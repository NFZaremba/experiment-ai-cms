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

export type PublishResult = {
  prNumber: number;
  prUrl: string;
  baseSha: string;
};

/** Create a branch off base, commit the ChangeSet's files, open a PR. */
export async function publishChangeSet(
  branch: string,
  changeSet: ChangeSet
): Promise<PublishResult> {
  const { octokit, owner, repo, base } = config();

  const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${base}` });
  const baseSha = baseRef.data.object.sha;

  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha: baseSha,
  });

  for (const file of changeSet.files) {
    // The file's current blob sha on base is required to update it.
    let sha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({
        owner,
        repo,
        path: file.path,
        ref: base,
      });
      if (!Array.isArray(existing.data) && "sha" in existing.data) {
        sha = existing.data.sha;
      }
    } catch {
      // New file — no existing sha.
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.path,
      branch,
      message: changeSet.summary,
      content: Buffer.from(file.newContents, "utf8").toString("base64"),
      sha,
    });
  }

  const pr = await octokit.pulls.create({
    owner,
    repo,
    title: changeSet.summary,
    body: "Published from the Content Studio. Review the deploy preview, then merge to go live.",
    head: branch,
    base,
  });

  return { prNumber: pr.data.number, prUrl: pr.data.html_url, baseSha };
}

export type PullStatus = "pending" | "success" | "failure";

/**
 * Combined CI status for a PR's head commit (Netlify posts a deploy-preview
 * check/status here). Returns "pending" until something is reported.
 */
export async function getPullStatus(prNumber: number): Promise<PullStatus> {
  const { octokit, owner, repo } = config();
  const pr = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
  const ref = pr.data.head.sha;

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
  const branch = pr.data.head.ref;
  if (branch.startsWith("studio/")) {
    try {
      await octokit.git.deleteRef({ owner, repo, ref: `heads/${branch}` });
    } catch {
      // Branch already gone / not deletable — ignore.
    }
  }
}

/** Squash-merge a PR (→ production deploy on merge to base). */
export async function mergePullRequest(prNumber: number): Promise<{ merged: boolean; sha?: string }> {
  const { octokit, owner, repo } = config();
  const res = await octokit.pulls.merge({
    owner,
    repo,
    pull_number: prNumber,
    merge_method: "squash",
  });
  return { merged: res.data.merged, sha: res.data.sha };
}

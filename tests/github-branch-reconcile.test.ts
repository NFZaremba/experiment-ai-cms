import assert from "node:assert";
import { ensureBranchAt, deleteBranchIfStudio } from "../lib/studio/github";

type Call = { fn: string; args: Record<string, unknown> };

function fakeClient(opts: { createRefStatus?: number; deleteRefThrows?: boolean } = {}) {
  const calls: Call[] = [];
  return {
    calls,
    git: {
      createRef: async (args: { owner: string; repo: string; ref: string; sha: string }) => {
        calls.push({ fn: "createRef", args });
        if (opts.createRefStatus) {
          throw Object.assign(new Error("createRef failed"), { status: opts.createRefStatus });
        }
        return {};
      },
      updateRef: async (args: { owner: string; repo: string; ref: string; sha: string; force?: boolean }) => {
        calls.push({ fn: "updateRef", args });
        return {};
      },
      deleteRef: async (args: { owner: string; repo: string; ref: string }) => {
        calls.push({ fn: "deleteRef", args });
        if (opts.deleteRefThrows) throw Object.assign(new Error("gone"), { status: 422 });
        return {};
      },
    },
  };
}

async function main() {
  // Fresh branch: created off the base sha, no force-reset.
  {
    const c = fakeClient();
    await ensureBranchAt(c, "o", "r", "studio/home", "abc123");
    assert.deepEqual(c.calls.map((x) => x.fn), ["createRef"]);
    assert.equal(c.calls[0].args.ref, "refs/heads/studio/home");
    assert.equal(c.calls[0].args.sha, "abc123");
  }

  // Orphaned branch (left by an old merge/close): 422 → force-reset to base.
  {
    const c = fakeClient({ createRefStatus: 422 });
    await ensureBranchAt(c, "o", "r", "studio/home", "abc123");
    assert.deepEqual(c.calls.map((x) => x.fn), ["createRef", "updateRef"]);
    assert.equal(c.calls[1].args.ref, "heads/studio/home");
    assert.equal(c.calls[1].args.sha, "abc123");
    assert.equal(c.calls[1].args.force, true);
  }

  // Non-422 failures (auth, network) surface — never masked by a force-reset.
  {
    const c = fakeClient({ createRefStatus: 401 });
    await assert.rejects(() => ensureBranchAt(c, "o", "r", "studio/home", "abc123"));
    assert.deepEqual(c.calls.map((x) => x.fn), ["createRef"]);
  }

  // Studio branches are deleted; anything else is never touched.
  {
    const c = fakeClient();
    await deleteBranchIfStudio(c, "o", "r", "studio/home");
    assert.deepEqual(c.calls.map((x) => x.fn), ["deleteRef"]);
    assert.equal(c.calls[0].args.ref, "heads/studio/home");
  }
  {
    const c = fakeClient();
    await deleteBranchIfStudio(c, "o", "r", "main");
    assert.deepEqual(c.calls, []);
  }

  // Best-effort: an already-gone branch never fails the caller.
  {
    const c = fakeClient({ deleteRefThrows: true });
    await deleteBranchIfStudio(c, "o", "r", "studio/home");
    assert.deepEqual(c.calls.map((x) => x.fn), ["deleteRef"]);
  }

  console.log("github-branch-reconcile ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { newNode } from "./connections";
import {
  mergeIntoDefault,
  commitAllBranches,
  describeDiff,
  getNode,
  newRepo,
  pull,
  clone,
  addToBranch,
  getCommitHash,
  checkoutRemoteBranch,
  getDefaultBranch,
  DEFAULT_BRANCH_NAME,
  ensureLocalBranch,
} from "./knowledge";
import { nodeToJSON, repoToJSON, jsonToRepo } from "./serializer";
import { ALICE, BOB } from "./utils.test";

const HELLO_WORLD_HASH = "75b497155d";

test("Commit", () => {
  const node = newNode("Hello World", "NOTE");
  const repo = commitAllBranches(newRepo(node, "id-1"));

  const firstCommit = {
    b: {
      main: {
        h: HELLO_WORLD_HASH,
      },
    },
    c: {
      [HELLO_WORLD_HASH]: {
        p: [],
        d: expect.any(Number),
      },
    },
    i: "id-1",
    o: {
      [HELLO_WORLD_HASH]: {
        n: "NOTE",
        r: {},
        t: "Hello World",
      },
    },
  };
  expect(repoToJSON(repo)).toEqual(firstCommit);
  const updatedRepo = addToBranch(repo, node, DEFAULT_BRANCH_NAME);
  // Serializing without commiting results in the same repo
  expect(repoToJSON(updatedRepo as RepoWithCommits)).toEqual(firstCommit);

  const newHash = getCommitHash(commitAllBranches(updatedRepo), "main");
  // Commiting the same node again results in a different hash, casue the parent changes
  expect(newHash).not.toEqual(HELLO_WORLD_HASH);
  expect(repoToJSON(commitAllBranches(updatedRepo))).toEqual({
    b: {
      main: {
        h: newHash,
      },
    },
    c: {
      [HELLO_WORLD_HASH]: {
        p: [],
        d: expect.any(Number),
      },
      [newHash]: {
        p: [HELLO_WORLD_HASH], // the new version points to the first
        d: expect.any(Number),
      },
    },
    i: "id-1",
    // Both versions are in the object index
    o: {
      [HELLO_WORLD_HASH]: nodeToJSON(node),
      [newHash]: nodeToJSON({ ...node, text: "Hello World" }),
    },
  });
});

test("Read Remote Repos", () => {
  // Bob creates a Repo
  const node = newNode("Hello World", "NOTE");
  const repo = commitAllBranches(newRepo(node));

  // Alice tracks it
  const aliceRepo = clone(repo, BOB.publicKey);
  expect(getNode(aliceRepo).text).toEqual("Hello World");

  // Bob updates it's repo
  const updatedRepo = commitAllBranches(
    addToBranch(
      repo,
      {
        ...node,
        text: "Hello World!",
      },
      DEFAULT_BRANCH_NAME
    )
  );

  // Alice pulls
  const updatedAliceRepo = pull(
    aliceRepo,
    updatedRepo,
    BOB.publicKey,
    ALICE.publicKey
  );
  expect(getNode(updatedAliceRepo).text).toEqual("Hello World!");
});

test("Branches which track remote branches", () => {
  const repo = commitAllBranches(newRepo(newNode("Hello World", "NOTE")));

  // Alice tracks it and checks out bobs branch
  const aliceClone = clone(repo, BOB.publicKey);
  expect(getDefaultBranch(aliceClone)).toEqual([BOB.publicKey, "main"]);

  const [aliceRepo] = checkoutRemoteBranch(aliceClone, [BOB.publicKey, "main"]);

  // This is the only local branch, so it's the default branch
  expect(getDefaultBranch(aliceRepo)).toEqual([undefined, "main"]);

  // Bob Updates his repo
  const updatedRepoBob = commitAllBranches(
    addToBranch(repo, newNode("Hello World!", "NOTE"), DEFAULT_BRANCH_NAME)
  );

  // Alice pulls the Repo, her local branch will be updated
  const pulledRepo = pull(
    commitAllBranches(aliceRepo),
    updatedRepoBob,
    BOB.publicKey,
    ALICE.publicKey
  );
  expect(getNode(pulledRepo, [undefined, "main"]).text).toEqual("Hello World!");

  // Only local branches are serialised
  const serialised = jsonToRepo(repoToJSON(commitAllBranches(pulledRepo)));
  expect(serialised.remotes.size).toEqual(0);
  expect(serialised.branches.keySeq().toArray()).toEqual(["main"]);
});

test("Change other user's version", () => {
  // Bob creates a Repo
  const repo = commitAllBranches(newRepo(newNode("Hello World", "NOTE")));

  // Alice checks out [BOB.publicKey, "main"]
  const [aliceCopy, pathToLocalBranch] = checkoutRemoteBranch(
    clone(repo, BOB.publicKey),
    [BOB.publicKey, "main"]
  );
  expect(pathToLocalBranch[1]).toBe("main");
  const aliceUpdate = commitAllBranches(
    addToBranch(
      aliceCopy,
      newNode("Hello World!", "NOTE"),
      pathToLocalBranch[1]
    )
  );

  // Bob makes change on his original repo
  const bobsUpdate = commitAllBranches(
    addToBranch(repo, newNode("Hi World!", "NOTE"), DEFAULT_BRANCH_NAME)
  );

  // Bobs changed doesn't get pulled automatically cause it's not fast forward
  const pulled = pull(aliceUpdate, bobsUpdate, BOB.publicKey, ALICE.publicKey);
  expect(getNode(pulled, pathToLocalBranch).text).toEqual("Hello World!");

  // But alice can see Bobs version as well when she asks for the specific ref
  expect(getNode(pulled, [BOB.publicKey, "main"]).text).toEqual("Hi World!");
});

test("Describe Version differences", () => {
  const repo = commitAllBranches(newRepo(newNode("Hello World", "NOTE")));

  const aliceClone = commitAllBranches(
    addToBranch(
      checkoutRemoteBranch(clone(repo, BOB.publicKey), [
        BOB.publicKey,
        "main",
      ])[0],
      newNode("Hello World!", "NOTE"),
      "main"
    )
  );

  expect(describeDiff(aliceClone, [BOB.publicKey, "main"], "main")).toEqual(
    "1 changes ahead"
  );
  expect(describeDiff(aliceClone, "main", [BOB.publicKey, "main"])).toEqual(
    "1 changes behind"
  );

  // Bob makes a change on top of his change
  const updatedRepo = commitAllBranches(
    addToBranch(repo, newNode("Hi", "NOTE"), DEFAULT_BRANCH_NAME)
  );
  expect(
    describeDiff(
      pull(aliceClone, updatedRepo, BOB.publicKey, ALICE.publicKey),
      "main",
      [BOB.publicKey, "main"]
    )
  ).toEqual("Version differs");

  const secondUpdate = commitAllBranches(
    addToBranch(aliceClone, newNode("Hello", "NOTE"), "main")
  );
  expect(describeDiff(secondUpdate, [BOB.publicKey, "main"], "main")).toEqual(
    "2 changes ahead"
  );
  expect(describeDiff(secondUpdate, "main", [BOB.publicKey, "main"])).toEqual(
    "2 changes behind"
  );
});

test("Don't pull if change is not ff", () => {
  const repo = commitAllBranches(newRepo(newNode("Hello World", "NOTE")));

  const aliceClone = commitAllBranches(
    addToBranch(
      checkoutRemoteBranch(clone(repo, BOB.publicKey), [
        BOB.publicKey,
        "main",
      ])[0],
      newNode("Hello World!", "NOTE"),
      "main"
    )
  );
  const updatedRepo = commitAllBranches(
    addToBranch(repo, newNode("Hi", "NOTE"), DEFAULT_BRANCH_NAME)
  );

  const aliceCloneUpdated = pull(
    aliceClone,
    updatedRepo,
    BOB.publicKey,
    ALICE.publicKey
  );

  // Pull didn't update Alice local branch, cause the version differs
  expect(getNode(aliceCloneUpdated, "main").text).toEqual("Hello World!");
  // The Remote got updated
  expect(getNode(aliceCloneUpdated, [BOB.publicKey, "main"]).text).toEqual(
    "Hi"
  );

  // Alice could checkout bobs branch again
  const [withSecondCheckout, path] = checkoutRemoteBranch(aliceCloneUpdated, [
    BOB.publicKey,
    "main",
  ]);
  expect(getNode(withSecondCheckout, path).text).toEqual("Hi");
  expect(path).toEqual([undefined, "71a2027698-main"]);
});

test("Accept other version, ff", () => {
  const repo = commitAllBranches(newRepo(newNode("Hello World", "NOTE")));
  // Bob clones the Repo and make a change
  const bobsClone = commitAllBranches(
    addToBranch(
      checkoutRemoteBranch(clone(repo, ALICE.publicKey), [
        ALICE.publicKey,
        "main",
      ])[0],
      newNode("Hello World!", "NOTE"),
      "main"
    )
  );

  const alicePull = pull(repo, bobsClone, BOB.publicKey, ALICE.publicKey);
  // Alice main didn't change
  expect(getNode(alicePull, "main").text).toEqual("Hello World");
  // But Alice sees bob version
  expect(getNode(alicePull, [BOB.publicKey, "main"]).text).toEqual(
    "Hello World!"
  );
  expect(describeDiff(alicePull, "main", [BOB.publicKey, "main"])).toEqual(
    "1 changes ahead"
  );
  // and can declare it her new main version
  const [aliceAcceptsBobsVersion] = mergeIntoDefault(alicePull, [
    BOB.publicKey,
    "main",
  ]);
  expect(getNode(aliceAcceptsBobsVersion, "main").text).toEqual("Hello World!");

  expect(
    describeDiff(aliceAcceptsBobsVersion, "main", [BOB.publicKey, "main"])
  ).toEqual("No Changes");
});

test("Accept older version, ff", () => {
  // Create a repo with a main branch and the same version as remote
  const repo = checkoutRemoteBranch(
    clone(
      commitAllBranches(newRepo(newNode("Hello World", "NOTE"))),
      BOB.publicKey
    ),
    [BOB.publicKey, "main"]
  )[0];
  expect(describeDiff(repo, "main", [BOB.publicKey, "main"])).toEqual(
    "No Changes"
  );

  // Make a change
  const updated = commitAllBranches(
    addToBranch(repo, newNode("Hello!", "NOTE"), "main")
  );
  expect(describeDiff(updated, "main", [BOB.publicKey, "main"])).toEqual(
    "1 changes behind"
  );

  // Reset to the older version
  const [reset] = mergeIntoDefault(updated, [BOB.publicKey, "main"]);
  expect(describeDiff(reset, "main", [BOB.publicKey, "main"])).toEqual(
    "No Changes"
  );
  expect(getNode(reset, "main").text).toEqual("Hello World");
});

test("Resolve Conflict by accepting non compatible version", () => {
  const aliceRepo = commitAllBranches(newRepo(newNode("Hello World", "NOTE")));

  const bobsClone = commitAllBranches(
    addToBranch(
      checkoutRemoteBranch(clone(aliceRepo, ALICE.publicKey), [
        ALICE.publicKey,
        "main",
      ])[0],
      newNode("Hello World!", "NOTE"),
      "main"
    )
  );
  // Alice pulls
  const alicePull = pull(aliceRepo, bobsClone, BOB.publicKey, ALICE.publicKey);
  expect(describeDiff(alicePull, "main", [BOB.publicKey, "main"])).toEqual(
    "1 changes ahead"
  );
  // But makes a change and ignores bobs version
  const conflict = commitAllBranches(
    addToBranch(alicePull, newNode("Hello Alice", "NOTE"), "main")
  );
  // The versions are not compatible anymore
  expect(describeDiff(conflict, "main", [BOB.publicKey, "main"])).toEqual(
    "Version differs"
  );
  // Alice can resolve the conflict by using bobs version
  const [resolvedWithBobsVersion] = mergeIntoDefault(conflict, [
    BOB.publicKey,
    "main",
  ]);
  expect(getNode(resolvedWithBobsVersion).text).toEqual("Hello World!");

  // Both versions are part of the history of the resolved version
  expect(
    describeDiff(
      resolvedWithBobsVersion,
      "main",
      getCommitHash(conflict, "main")
    )
  ).toEqual("1 changes behind");
  expect(
    describeDiff(resolvedWithBobsVersion, "main", [BOB.publicKey, "main"])
  ).toEqual("1 changes behind");

  // Alice can also resolve the conflict by creating a new version
  const [localVersionOfBob, branch] = ensureLocalBranch(conflict, [
    BOB.publicKey,
    "main",
  ]);
  const withChangedNode = addToBranch(
    localVersionOfBob,
    newNode("Hi", "NOTE"),
    branch[1]
  );
  const [resolvedWithNewNode] = mergeIntoDefault(withChangedNode, branch);
  expect(getNode(resolvedWithNewNode).text).toEqual("Hi");
  expect(
    describeDiff(resolvedWithNewNode, "main", getCommitHash(conflict, "main"))
  ).toEqual("1 changes behind");
  expect(
    describeDiff(resolvedWithNewNode, "main", [BOB.publicKey, "main"])
  ).toEqual("1 changes behind");
  // The local branch gets deleted
  expect(resolvedWithNewNode.branches.keySeq().toArray()).toEqual(["main"]);
});

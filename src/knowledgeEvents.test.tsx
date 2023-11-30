import { List, Map } from "immutable";
import { Event } from "nostr-tools";
import { newNode } from "./connections";
import {
  DEFAULT_BRANCH_NAME,
  addToBranch,
  commitAllBranches,
  getNode,
  newDB,
  newRepo,
} from "./knowledge";
import {
  applyDiff,
  compareKnowledgeDB,
  getEventsFromLastBootstrap,
  KnowledgeDiffWithCommits,
  RepoDiff,
} from "./knowledgeEvents";
import { ALICE, commitAll } from "./utils.test";
import { splitDiff } from "./planner";
import { KIND_KNOWLEDGE, finalizeEvent } from "./nostr";

test("Diff of unstaged Commit", () => {
  const node = newNode("Hello World", "NOTE");
  const repo = newRepo(node, "id-1");
  const baseDB = {
    ...newDB(),
    repos: Map<string, Repo>({ "id-1": repo }),
  };
  const updatedDB = {
    ...baseDB,
    repos: baseDB.repos.set(
      "id-1",
      addToBranch(repo, newNode("Bye!", "NOTE"), DEFAULT_BRANCH_NAME)
    ),
  };
  const diff = compareKnowledgeDB(baseDB, updatedDB);

  const afterDiff = applyDiff(baseDB, diff).repos.get("id-1") as Repo;
  expect(getNode(afterDiff).text).toEqual("Bye!");
});

test("Diff only consists of different commits", () => {
  const node = newNode("Hello World", "NOTE");
  const repo = commitAllBranches(newRepo(node, "id-1"));
  const baseDB = {
    ...newDB(),
    repos: Map<string, Repo>({ "id-1": repo }),
  };

  const updatedRepo = commitAllBranches(
    addToBranch(repo, newNode("Bye!", "NOTE"), DEFAULT_BRANCH_NAME)
  );
  const updatedDB = {
    ...baseDB,
    repos: baseDB.repos.set("id-1", updatedRepo),
  };
  const diff = compareKnowledgeDB(baseDB, updatedDB);
  const repoDiff = (diff.repos as Map<string, RepoDiff<Branch>>).get(
    "id-1"
  ) as RepoDiff<Branch>;

  // The diff contains only one commit and one object
  expect((repoDiff.commits as Map<Hash, Commit>).size).toBe(1);
  expect((repoDiff.objects as Map<Hash, KnowNode>).size).toBe(1);

  const afterDiff = applyDiff(baseDB, diff).repos.get("id-1") as Repo;
  expect(afterDiff.commits.size).toBe(2);
  expect(afterDiff.objects.size).toBe(2);
  expect(getNode(afterDiff).text).toEqual("Bye!");
  // Test idempotence
  const afterDiffIdem = applyDiff(applyDiff(baseDB, diff), diff).repos.get(
    "id-1"
  ) as Repo;
  expect(afterDiffIdem.commits.size).toBe(2);
  expect(afterDiffIdem.objects.size).toBe(2);
  expect(getNode(afterDiffIdem).text).toEqual("Bye!");
});

test("Empty Diff", () => {
  const node = newNode("Hello World", "NOTE");
  const repo = commitAllBranches(newRepo(node, "id-1"));
  const baseDB = {
    ...newDB(),
    repos: Map<string, Repo>({ "id-1": repo }),
  };
  const diff = compareKnowledgeDB(baseDB, baseDB);
  expect(diff.repos).toBeUndefined();
  expect(diff.views).toBeUndefined();
  expect(diff.activeWorkspace).toBeUndefined();
  const afterDiff = applyDiff(baseDB, diff);
  expect(baseDB).toEqual(afterDiff);
});

test("Delete Repo", () => {
  const node = newNode("Hello World", "NOTE");
  const repo = commitAllBranches(newRepo(node, "id-1"));
  const baseDB = {
    ...newDB(),
    repos: Map<string, Repo>({ "id-1": repo }),
  };
  const diff = compareKnowledgeDB(baseDB, {
    ...baseDB,
    repos: baseDB.repos.remove("id-1"),
  });
  expect(applyDiff(baseDB, diff).repos.size).toBe(0);
});

test("view diffs", () => {
  const baseView: View = {
    displaySubjects: true,
    relationType: "RELEVANCE",
    width: 2,
    branch: [ALICE.publicKey, "main"],
    expanded: true,
  };
  const baseDB = {
    ...newDB(),
    views: Map<string, View>({
      "view-1": baseView,
    }),
  };
  const diff = compareKnowledgeDB(baseDB, {
    ...baseDB,
    views: baseDB.views.set("view-1", {
      ...baseView,
      branch: [undefined, "main"],
    }),
  });
  expect(diff.repos).toBeUndefined();
  expect((diff.views as Map<string, View>).size).toBe(1);
  expect((diff.views as Map<string, View>).get("view-1")).toEqual({
    ...baseView,
    branch: [undefined, "main"],
  });

  const afterDiff = applyDiff(baseDB, diff).views.get("view-1") as View;
  expect(afterDiff).toEqual({
    ...baseView,
    branch: [undefined, "main"],
  });
});

test("Delete View", () => {
  const baseView: View = {
    displaySubjects: true,
    relationType: "RELEVANCE",
    width: 2,
    branch: [ALICE.publicKey, "main"],
    expanded: true,
  };
  const baseDB = {
    ...newDB(),
    views: Map<string, View>({
      "view-1": baseView,
    }),
  };
  const diff = compareKnowledgeDB(baseDB, {
    ...baseDB,
    views: baseDB.views.remove("view-1"),
  });

  expect(applyDiff(baseDB, diff).views.size).toBe(0);
});

test("Split Diff", () => {
  const node = newNode("Hello World", "NOTE");
  const repo = commitAllBranches(newRepo(node, "id-1"));
  const baseDB = {
    ...newDB(),
    repos: Map<string, Repo>({ "id-1": repo }),
  };
  const secondRepo = commitAllBranches(
    newRepo(newNode("foo", "TOPIC"), "id-2")
  );
  const updatedRepo = commitAllBranches(
    addToBranch(repo, newNode("Hello!", "NOTE"), DEFAULT_BRANCH_NAME)
  );

  const db = {
    ...baseDB,
    repos: baseDB.repos.set("id-1", updatedRepo).set("id-2", secondRepo),
  };
  const diff = compareKnowledgeDB(commitAll(baseDB), commitAll(db));
  const split = splitDiff(diff, ALICE.publicKey, 256);
  expect(split.size).toBe(2);
  // Diff order of splits doesn't matter

  expect(
    applyDiff(
      applyDiff(baseDB, split.get(1) as KnowledgeDiffWithCommits),
      split.get(0) as KnowledgeDiffWithCommits
    )
  ).toEqual(db);
  expect(
    applyDiff(
      applyDiff(baseDB, split.get(0) as KnowledgeDiffWithCommits),
      split.get(1) as KnowledgeDiffWithCommits
    )
  ).toEqual(db);
});

test("Repo exceeds chunk size", () => {
  const node = newNode("Hello World", "NOTE");
  const repo = commitAllBranches(newRepo(node, "id-1"));
  const baseDB = newDB();
  const db = {
    ...baseDB,
    repos: Map<string, Repo>({ "id-1": repo }),
  };
  const diff = compareKnowledgeDB(commitAll(baseDB), commitAll(db));
  const split = splitDiff(diff, ALICE.publicKey, 0);
  expect(split.size).toBe(1);
});

function createDiffEvents(
  length: number,
  startingAt: number,
  isBootstrap?: boolean
): List<Event> {
  const ids = List(Array(length).keys());
  return ids.reduce((events, id) => {
    const diffEvent = finalizeEvent(
      {
        kind: KIND_KNOWLEDGE,
        pubkey: ALICE.publicKey,
        created_at: startingAt + id,
        tags: isBootstrap ? [["bootstrap"]] : [],
        content: `${(startingAt + id).toString(10)} ${
          isBootstrap ? "bootstrap" : ""
        }`,
      },
      ALICE.privateKey
    );
    return events.push(diffEvent);
  }, List<Event>());
}

function createBootstrapDiffEvents(
  length: number,
  startingAt: number
): List<Event> {
  return createDiffEvents(length, startingAt, true);
}

test("Get events from last bootstrap", () => {
  // first: three diff events
  const events = createDiffEvents(3, 100);
  const result = getEventsFromLastBootstrap(events);
  expect(result.eventsFromBootstrap.size).toBe(3);
  expect(result.numberOfEventsSinceLastBootstrap).toBe(3);

  // second: two bootstrap and three diff events
  const secondEvents = createBootstrapDiffEvents(2, 90).merge(events);
  const secondResult = getEventsFromLastBootstrap(secondEvents);
  expect(secondResult.eventsFromBootstrap.size).toBe(5);
  expect(secondResult.numberOfEventsSinceLastBootstrap).toBe(3);

  // third: one diff, then two bootstrap and three diff events
  const thirdEvents = createDiffEvents(1, 80).merge(secondEvents);
  const thirdResult = getEventsFromLastBootstrap(thirdEvents);
  expect(thirdResult.eventsFromBootstrap.size).toBe(5);
  expect(thirdResult.numberOfEventsSinceLastBootstrap).toBe(3);

  // fourth: three bootstrap, then one diff, two bootstrap and three diff events
  const fourthEvents = createBootstrapDiffEvents(3, 70).merge(thirdEvents);
  const fourthResult = getEventsFromLastBootstrap(fourthEvents);
  expect(fourthResult.eventsFromBootstrap.size).toBe(5);
  expect(fourthResult.numberOfEventsSinceLastBootstrap).toBe(3);

  // fifth: four diff, three bootstrap, then one diff, two bootstrap and three diff events
  const fifthEvents = createDiffEvents(4, 60).merge(fourthEvents);
  const fifthResult = getEventsFromLastBootstrap(fifthEvents);
  expect(fifthResult.eventsFromBootstrap.size).toBe(5);
  expect(fifthResult.numberOfEventsSinceLastBootstrap).toBe(3);
});

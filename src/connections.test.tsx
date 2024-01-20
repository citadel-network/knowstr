import { Map, List } from "immutable";
import { disconnectNode } from "./components/DeleteNode";
import {
  newNode,
  getSubjects,
  moveRelations,
  addRelationToRelations,
  bulkAddRelations,
  getRelations,
} from "./connections";
import { newRepo, getNode } from "./knowledge";

function sampleNodes(): {
  repos: Repos;
  a: Repo;
  b: Repo;
  c: Repo;
  d: Repo;
  e: Repo;
} {
  const b = newRepo(newNode("b", "TOPIC"));
  const c = newRepo(newNode("c", "TOPIC"));
  const d = newRepo(newNode("c", "TOPIC"));
  const e = newRepo(newNode("e", "TOPIC"));
  const a = newRepo(
    bulkAddRelations(
      newNode("a", "TOPIC"),
      [b.id, c.id, d.id, e.id],
      "RELEVANCE"
    )
  );

  const repos: Repos = Map({
    [a.id]: a,
    [b.id]: b,
    [c.id]: c,
    [d.id]: d,
    [e.id]: e,
  });
  return { repos, a, b, c, d, e };
}

test("Add new Connection", () => {
  const { a, b, c, d, e } = sampleNodes();
  expect(getNode(a).relations.get("RELEVANCE")).toEqual(
    List([{ id: b.id }, { id: c.id }, { id: d.id }, { id: e.id }])
  );
  expect(getRelations(getNode(a), "CONTAINS")).toEqual(List([]));
});

test("Position of new connection can be specified", () => {
  const { a, b, c, d, e } = sampleNodes();
  const b0 = newRepo(newNode("b0", "TOPIC"));
  expect(
    getRelations(
      addRelationToRelations(getNode(a), b0.id, "RELEVANCE", 0),
      "RELEVANCE"
    )
  ).toEqual(
    List([
      { id: b0.id },
      { id: b.id },
      { id: c.id },
      { id: d.id },
      { id: e.id },
    ])
  );
});

test("Relevance and contains order can be different", () => {
  const { a, b, c, d, e } = sampleNodes();
  const d0 = newRepo(newNode("d0", "TOPIC"));
  const node = addRelationToRelations(
    addRelationToRelations(getNode(a), d0.id, "RELEVANCE", 2),
    d0.id,
    "CONTAINS",
    0
  );
  expect(getRelations(node, "RELEVANCE")).toEqual(
    List([
      { id: b.id },
      { id: c.id },
      { id: d0.id },
      { id: d.id },
      { id: e.id },
    ])
  );

  expect(getRelations(node, "CONTAINS")).toEqual(List([{ id: d0.id }]));
});

test("Reorder existing connections", () => {
  const { a, b, c, d, e } = sampleNodes();
  expect(
    getRelations(moveRelations(getNode(a), [2], 0, "RELEVANCE"), "RELEVANCE")
  ).toEqual(List([{ id: d.id }, { id: b.id }, { id: c.id }, { id: e.id }]));
});

test("Get all subjects", () => {
  const { repos, a, b } = sampleNodes();
  expect(getSubjects(repos, b.id)).toEqual(Map({ [a.id]: a }));
});

test("Disconnect node from everything", () => {
  const { repos, a, b, c, d, e } = sampleNodes();
  expect(getSubjects(repos, c.id).size).toEqual(1);
  const { repos: disconnectedC } = disconnectNode(
    { repos, views: Map<string, View>() },
    c.id
  );
  expect(getSubjects(disconnectedC, c.id)).toEqual(Map());
  expect(
    getRelations(getNode(disconnectedC.get(a.id) as Repo), "RELEVANCE")
  ).toEqual(List([{ id: b.id }, { id: d.id }, { id: e.id }]));
});

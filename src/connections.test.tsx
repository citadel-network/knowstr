import { Map, List } from "immutable";
import {
  moveRelations,
  addRelationToRelations,
  bulkAddRelations,
  newNode,
  getReferencedByRelations,
  shortID,
} from "./connections";
import { ALICE, BOB } from "./utils.test";
import { newRelations } from "./ViewContext";
import { newDB } from "./knowledge";

function sampleNodes(): {
  nodes: Map<ID, KnowNode>;
  relations: Relations;
  a: KnowNode;
  b: KnowNode;
  c: KnowNode;
  d: KnowNode;
  e: KnowNode;
} {
  const a = newNode("a", ALICE.publicKey);
  const b = newNode("b", ALICE.publicKey);
  const c = newNode("c", ALICE.publicKey);
  const d = newNode("c", ALICE.publicKey);
  const e = newNode("e", ALICE.publicKey);

  const relations = bulkAddRelations(newRelations(a.id, "", ALICE.publicKey), [
    b.id,
    c.id,
    d.id,
    e.id,
  ]);

  const nodes = Map({
    [a.id]: a,
    [b.id]: b,
    [c.id]: c,
    [d.id]: d,
    [e.id]: e,
  });
  return { nodes, a, b, c, d, e, relations };
}

test("Add new Connection", () => {
  const { b, c, d, e, relations } = sampleNodes();
  const n = newNode("hello", ALICE.publicKey);
  const updated = addRelationToRelations(relations, n.id);
  expect(updated.items).toEqual(List([b.id, c.id, d.id, e.id, n.id]));
});

test("Position of new connection can be specified", () => {
  const { b, c, d, e, relations } = sampleNodes();
  const b0 = newNode("b0", ALICE.publicKey);
  expect(addRelationToRelations(relations, b0.id, 0).items).toEqual(
    List([b0.id, b.id, c.id, d.id, e.id])
  );
});

test("Reorder existing connections", () => {
  const { b, c, d, e, relations } = sampleNodes();
  expect(moveRelations(relations, [2], 0).items).toEqual(
    List([d.id, b.id, c.id, e.id])
  );
});

test("get referenced by relations", () => {
  const aliceDB = newDB();
  const bobsDB = newDB();
  const btc = newNode("Bitcoin", ALICE.publicKey);
  const money = newNode("Money", ALICE.publicKey);
  const crypto = newNode("Crypto", BOB.publicKey);

  const moneyRelations = addRelationToRelations(
    newRelations(money.id, "", ALICE.publicKey),
    btc.id
  );
  const cryptoRelations = addRelationToRelations(
    newRelations(crypto.id, "", BOB.publicKey),
    btc.id
  );
  const aliceDBWithRelations = {
    ...aliceDB,
    relations: Map({ [money.id]: moneyRelations }),
    nodes: Map({ [btc.id]: btc, [money.id]: money }),
  };
  const bobDBWithRelations = {
    ...bobsDB,
    relations: Map({ [crypto.id]: cryptoRelations }),
    nodes: Map({ [crypto.id]: crypto }),
  };
  const dbs = Map({
    [ALICE.publicKey]: aliceDBWithRelations,
    [BOB.publicKey]: bobDBWithRelations,
  });

  const referencedBy = getReferencedByRelations(
    dbs as KnowledgeDBs,
    ALICE.publicKey,
    btc.id
  );
  expect(referencedBy?.items).toEqual(
    List([shortID(money.id), shortID(crypto.id)])
  );
});

import { List, Set, Map } from "immutable";
import { v4 } from "uuid";
import { newDB } from "./knowledge";
import { newRelations } from "./ViewContext";

export function splitID(id: ID): [PublicKey | undefined, string] {
  const split = id.split("_");
  if (split.length === 1) {
    return [undefined, split[0]];
  }
  return [split[0] as PublicKey, split.slice(1).join(":")];
}

export function joinID(remote: PublicKey | string, id: string): LongID {
  return `${remote}_${id}` as LongID;
}

export function shortID(id: ID): string {
  return splitID(id)[1];
}

export function getRelationsNoSocial(
  knowledgeDBs: KnowledgeDBs,
  relationID: ID | undefined,
  myself: PublicKey
): Relations | undefined {
  if (!relationID) {
    return undefined;
  }
  const [remote, id] = splitID(relationID);
  if (remote) {
    return knowledgeDBs.get(remote)?.relations.get(id);
  }
  const res = knowledgeDBs.get(myself)?.relations.get(relationID);
  return res;
}

function getAllRelationsForNode(
  knowledgeDB: KnowledgeData,
  nodeID: LongID | ID
): Set<LongID | ID> {
  const localID = shortID(nodeID);
  return knowledgeDB.relations.reduce((rdx, relations) => {
    if (relations.head === localID) {
      return rdx.merge(relations.items);
    }
    return rdx;
  }, Set<LongID | ID>());
}

export const REFERENCED_BY = "referencedby" as LongID;
export const SOCIAL = "social" as LongID;

export function getSocialRelations(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  nodeID: LongID | ID // for social lookup
): Relations | undefined {
  // Combines all items from other users we don't have in our Lists
  const myRelationsForNode = getAllRelationsForNode(
    knowledgeDBs.get(myself, newDB()),
    nodeID
  );

  const otherRelationsForNode = knowledgeDBs.reduce((rdx, knowledgeDB) => {
    return rdx.merge(getAllRelationsForNode(knowledgeDB, nodeID));
  }, Set<LongID | ID>());

  const myShortIds = myRelationsForNode.map((id) => shortID(id)[1]);

  const items = otherRelationsForNode.filter(
    (id) => !myShortIds.has(shortID(id)[1])
  );
  return {
    updated: Math.floor(Date.now() / 1000),
    items: items.toList(),
    head: nodeID,
    id: SOCIAL,
    type: SOCIAL,
    author: "" as PublicKey,
  };
}

type ReferencedByHeadAndUpdated = Pick<Relations, "head" | "updated">;

export function getReferencedByRelations(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  nodeID: LongID | ID
): Relations | undefined {
  const rel = newRelations(nodeID, REFERENCED_BY, myself);
  const referencesOfAllDBs = knowledgeDBs.reduce((r, knowledgeDB) => {
    const relationsOfDB = knowledgeDB.relations.reduce((rdx, relations) => {
      if (relations.items.includes(nodeID)) {
        if (!rdx.find((item) => item.head === relations.head)) {
          return rdx.push({
            head: relations.head as LongID,
            updated: relations.updated,
          });
        }
      }
      return rdx;
    }, r);
    return r.merge(relationsOfDB);
  }, List<ReferencedByHeadAndUpdated>());
  const items = referencesOfAllDBs
    .filter(
      (relation, index, self) =>
        index === self.findIndex((t) => t.head === relation.head)
    )
    .sort((a, b) => a.updated - b.updated);
  // This is a Tough one:
  //
  // Alice has a node Bitcoin with ID 1 and a List default-1
  // Bob forks default-1 and references "blockchain" (list, id: default-fork-1, head: 1, items: [blockchain])
  // Carol, who is connected with Bob, counts default-fork-1 as a reference, but will never be able to
  // see the node "Bitcoin" because she doesn't query Alice node. The List default-1, doesn't mention how to
  // get ID 1
  //
  // Simpler Case:
  //
  // Alice is not connected with Bob. Alice forks Bobs Bitcoin List default-1 to default-2.
  // Alice References a new node "blockchain" in default-2.
  //
  // Alice will never see the "Bitcoin" node in references as she is not connected to Bob
  //
  // Why don't we make Head a full path?
  return {
    ...rel,
    id: REFERENCED_BY,
    items: items.map((item) => item.head),
  };
}

export function getRelations(
  knowledgeDBs: KnowledgeDBs,
  relationID: ID | undefined,
  myself: PublicKey,
  nodeID: LongID | ID // for social lookup
): Relations | undefined {
  if (relationID === SOCIAL) {
    return getSocialRelations(knowledgeDBs, myself, nodeID);
  }
  if (relationID === REFERENCED_BY) {
    return getReferencedByRelations(knowledgeDBs, myself, nodeID);
  }
  return getRelationsNoSocial(knowledgeDBs, relationID, myself);
}

export function deleteRelations(
  relations: Relations,
  indices: Set<number>
): Relations {
  const items = indices
    .sortBy((index) => -index)
    .reduce((r, deleteIndex) => r.delete(deleteIndex), relations.items);
  return {
    ...relations,
    items,
  };
}

export function isRemote(
  remote: PublicKey | undefined,
  myself: PublicKey
): boolean {
  return remote !== undefined && remote !== myself;
}

export function isIDRemote(id: ID, myself: PublicKey): boolean {
  return isRemote(splitID(id)[0], myself);
}

export function moveRelations(
  relations: Relations,
  indices: Array<number>,
  startPosition: number
): Relations {
  const itemsToMove = relations.items.filter((_, i) => indices.includes(i));
  const itemsBeforeStartPos = indices.filter((i) => i < startPosition).length;
  const updatedItems = relations.items
    .filterNot((_, i) => indices.includes(i))
    .splice(startPosition - itemsBeforeStartPos, 0, ...itemsToMove.toArray());
  return {
    ...relations,
    items: updatedItems,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getSharesFromPublicKey(publicKey: PublicKey): number {
  return 10000; // TODO: implement
}

function filterVoteRelationLists(
  relations: List<Relations>,
  head: ID,
  type: ID
): List<Relations> {
  return relations.filter((relation) => {
    return shortID(relation.head) === shortID(head) && relation.type === type;
  });
}

function getLatestvoteRelationListPerAuthor(
  relations: List<Relations>
): Map<PublicKey, Relations> {
  return relations.reduce((acc, relation) => {
    const isFound = acc.get(relation.author);
    if (!!isFound && isFound.updated > relation.updated) {
      return acc;
    }
    return acc.set(relation.author, relation);
  }, Map<PublicKey, Relations>());
}

export function aggregateWeightedVotes(
  listsOfVotes: List<{ items: List<LongID | ID>; weight: number }>
): Map<LongID | ID, number> {
  const votesPerItem = listsOfVotes.reduce((rdx, v) => {
    const { weight } = v;
    const length = v.items.size;
    const denominator = 2 ** length - 1;
    if (length === 0) {
      return rdx;
    }
    const updatedVotes = v.items.map((item, index) => {
      // calculate (2 ^ (length-index-1)) / (2 ^ length - 1)
      // so with 3 items, the first item gets 4/7, the second 2/7 and the last 1/7
      const numerator = 2 ** (length - index - 1);
      const newVotes = (numerator / denominator) * weight;
      const initialVotes = rdx.get(item) || 0;
      return { item, votes: initialVotes + newVotes };
    });
    return updatedVotes.reduce((red, { item, votes }) => {
      return red.set(item, votes);
    }, rdx);
  }, Map<LongID | ID, number>());
  return votesPerItem;
}

export function countRelationVotes(
  relations: List<Relations>,
  head: ID,
  type: ID
): Map<LongID | ID, number> {
  const filteredVoteRelations = filterVoteRelationLists(relations, head, type);
  const latestVotesPerAuthor = getLatestvoteRelationListPerAuthor(
    filteredVoteRelations
  );
  const listsOfVotes = latestVotesPerAuthor
    .map((relation) => {
      return {
        items: relation.items,
        weight: getSharesFromPublicKey(relation.author),
      };
    })
    .toList();
  return aggregateWeightedVotes(listsOfVotes);
}

export function addRelationToRelations(
  relations: Relations,
  objectID: LongID | ID,
  ord?: number
): Relations {
  const defaultOrder = relations.items.size;
  const items = relations.items.push(objectID);
  const relationsWithItems = {
    ...relations,
    items,
  };
  return ord !== undefined
    ? moveRelations(relationsWithItems, [defaultOrder], ord)
    : relationsWithItems;
}

export function bulkAddRelations(
  relations: Relations,
  objectIDs: Array<LongID | ID>,
  startPos?: number
): Relations {
  return objectIDs.reduce((rdx, id, currentIndex) => {
    return addRelationToRelations(
      rdx,
      id,
      startPos !== undefined ? startPos + currentIndex : undefined
    );
  }, relations);
}

export function newNode(text: string, myself: PublicKey): KnowNode {
  return {
    text,
    id: joinID(myself, v4()),
    type: "text",
  };
}

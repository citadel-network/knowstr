import { joinID } from "./connections";
import { KIND_PROJECT } from "./nostr";
import { eventToTextOrProjectNode } from "./serializer";
import { ALICE } from "./utils.test";

test("parse project", () => {
  const event = {
    kind: KIND_PROJECT,
    tags: [
      ["d", "123"],
      ["address", "525 S. Winchester Blvd. San Jose, CA 95128"],
      ["imeta", "url https://winchestermysteryhouse.com/wp"],
      ["r", "wss://winchester.deedsats.com/"],
      ["r", "wss://nos.lol/", "read"],
      ["c", "dashboard-internal"],
      ["perpetualVotes", "d"],
      ["quarterlyVotes", "e"],
      ["dashboardPublic", "f"],
      ["tokenSupply", "1000000"],
      ["memberListProvider", ALICE.publicKey],
    ],
    pubkey: ALICE.publicKey,
    content: "Winchester Mystery House",
    created_at: Math.floor(new Date("2009-01-03T18:15:05Z").getTime() / 1000),
  };
  const [id, p] = eventToTextOrProjectNode(event);
  const project = p as ProjectNode;
  expect(id).toEqual("123");

  expect(project).toEqual({
    id: joinID(ALICE.publicKey, "123"),
    relays: [
      { url: "wss://winchester.deedsats.com/", write: true, read: true },
      { url: "wss://nos.lol/", write: false, read: true },
    ],
    address: "525 S. Winchester Blvd. San Jose, CA 95128",
    imageUrl: "https://winchestermysteryhouse.com/wp",
    perpetualVotes: "d",
    quarterlyVotes: "e",
    dashboardInternal: "dashboard-internal",
    dashboardPublic: "f",
    text: "Winchester Mystery House",
    tokenSupply: 1000000,
    createdAt: new Date("2009-01-03T18:15:05Z"),
    memberListProvider: ALICE.publicKey,
    type: "project",
  });
});

test("parse project with undefined tokensupply", () => {
  const event = {
    kind: KIND_PROJECT,
    tags: [
      ["d", "3110"],
      ["r", "wss://projectwithouttokens.deedsats.com/"],
      ["r", "wss://nos.lol/", "read"],
      ["memberListProvider", ALICE.publicKey],
    ],
    pubkey: ALICE.publicKey,
    content: "Project without tokens",
    created_at: Math.floor(new Date("2009-01-03T18:15:05Z").getTime() / 1000),
  };
  const [id, p] = eventToTextOrProjectNode(event);
  const project = p as ProjectNode;
  expect(id).toEqual("3110");

  expect(project).toEqual({
    id: joinID(ALICE.publicKey, "3110"),
    relays: [
      {
        url: "wss://projectwithouttokens.deedsats.com/",
        write: true,
        read: true,
      },
      { url: "wss://nos.lol/", write: false, read: true },
    ],
    address: undefined,
    imageUrl: undefined,
    perpetualVotes: undefined,
    quarterlyVotes: undefined,
    dashboardInternal: undefined,
    dashboardPublic: undefined,
    text: "Project without tokens",
    tokenSupply: undefined,
    createdAt: new Date("2009-01-03T18:15:05Z"),
    memberListProvider: ALICE.publicKey,
    type: "project",
  });
});

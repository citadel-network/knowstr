import { joinID } from "./connections";
import { KIND_PROJECT } from "./nostr";
import { eventToTextOrProjectOrImageNode } from "./serializer";
import { ALICE } from "./utils.test";

test("parse project", () => {
  const event = {
    kind: KIND_PROJECT,
    tags: [
      ["d", "123"],
      ["address", "525 S. Winchester Blvd. San Jose, CA 95128"],
      ["headerImage", "https://winchestermysteryhouse.com/wp"],
      ["r", "wss://winchester.deedsats.com/"],
      ["r", "wss://nos.lol/", "read"],
      ["c", "dashboard-internal"],
      ["perpetualVotes", "d"],
      ["quarterlyVotes", "e"],
      ["dashboardPublic", "f"],
      ["tokenSupply", "1000000"],
    ],
    pubkey: ALICE.publicKey,
    content: "Winchester Mystery House",
    created_at: Math.floor(new Date("2009-01-03T18:15:05Z").getTime() / 1000),
  };
  const [id, p] = eventToTextOrProjectOrImageNode(event);
  const project = p as ProjectNode;
  expect(id).toEqual("123");

  expect(project).toEqual({
    id: joinID(ALICE.publicKey, "123"),
    relays: [
      { url: "wss://winchester.deedsats.com/", write: true, read: true },
      { url: "wss://nos.lol/", write: false, read: true },
    ],
    address: "525 S. Winchester Blvd. San Jose, CA 95128",
    image: "https://winchestermysteryhouse.com/wp",
    perpetualVotes: "d",
    quarterlyVotes: "e",
    dashboardInternal: "dashboard-internal",
    dashboardPublic: "f",
    text: "Winchester Mystery House",
    tokenSupply: 1000000,
    createdAt: new Date("2009-01-03T18:15:05Z"),
    type: "project",
  });
});

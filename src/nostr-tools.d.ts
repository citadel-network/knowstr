declare module "nostr-tools/wasm" {
  // eslitn-disable-next-line @typescript-eslint/no-explicit-any
  export function setNostrWasm(wasm: any): void;
}

declare module "nostr-tools/nip06" {
  export function generateSeedWords(): string;
  export function privateKeyFromSeedWords(seedWords: string): string;
}

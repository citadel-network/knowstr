type Signature = {
  sign: (signBuf: Buffer, privateKey: Buffer) => Buffer;
};

type PrivateKey = {
  fromString: (privateKey: string) => Buffer;
};

declare module "eosjs-ecc" {
  function seedPrivate(privateKey: string): string;
  function privateToPublic(privateKey: string): string;
  const Signature: Signature;
  const PrivateKey: PrivateKey;
}

declare module "eosjs-account-name" {
  function nameToUint64(name: string): string;
  function uint64ToName(name: string): string;
}

import dotenv from "dotenv";
import fetch from "node-fetch";
import { Api, JsonRpc } from "eosjs";
import { TextEncoder, TextDecoder } from "util";
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig";

dotenv.config();

const EOS_CONTRACT = process.env.REACT_APP_EOS_CONTRACT;
const rpc = new JsonRpc(process.env.REACT_APP_EOS_NODE, { fetch });

const keys = process.env.REACT_APP_EOS_CONTRACT_PRIVATE_KEY
  ? [process.env.REACT_APP_EOS_CONTRACT_PRIVATE_KEY]
  : [];

const api = new Api({
  rpc,
  signatureProvider: new JsSignatureProvider(keys),
  textEncoder: new TextEncoder(),
  textDecoder: new TextDecoder(),
});

async function transact(api, owner, user, name, data) {
  await api.transact(
    {
      actions: [
        {
          account: owner,
          name,
          authorization: [
            {
              actor: user,
              permission: "active",
            },
          ],
          data,
        },
      ],
    },
    {
      blocksBehind: 1,
      expireSeconds: 30,
    }
  );
}

export async function fetchAll(eos, code, scope, table, lowerBound) {
  const req = {
    json: true,
    code,
    scope,
    table,
    lower_bound: lowerBound || "",
    limit: 200,
  };
  const res = await eos.rpc.get_table_rows(req);
  if (res.more) {
    return {
      ...res,
      rows: [
        ...res.rows,
        ...(await fetchAll(eos, code, scope, table, res.next_key)).rows,
      ],
    };
  }
  return res;
}

export { EOS_CONTRACT, api, transact };

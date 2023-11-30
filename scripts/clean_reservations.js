import { EOS_CONTRACT, api, transact } from "./database";

(async () => {
  const gifts = await api.rpc.get_table_rows({
    code: EOS_CONTRACT,
    scope: EOS_CONTRACT,
    table: "gifts",
    limit: 10000,
  });
  const keep = gifts.rows.map((row) => row.reservation_id);
  const reservations = await api.rpc.get_table_rows({
    code: EOS_CONTRACT,
    scope: EOS_CONTRACT,
    table: "reservations",
    limit: 10000,
  });
  const actions = reservations.rows
    .map((row) => {
      if (row.volume === 0) {
        if (keep.includes(row.id)) {
          console.log(`Skip ${row.id} cause there is a Gift Request`);
        } else {
          console.log(`Delete ${row.id}.`);
          return {
            account: EOS_CONTRACT,
            name: "dropreserve",
            authorization: [
              {
                actor: EOS_CONTRACT,
                permission: "active",
              },
            ],
            data: {
              id: row.id,
            },
          };
        }
      } else {
        console.log(`Skip ${row.id} cause volume is not 0`);
      }
      return undefined;
    })
    .filter((action) => action !== undefined);
  await api.transact(
    {
      actions,
    },
    {
      blocksBehind: 1,
      expireSeconds: 30,
    }
  );
})();

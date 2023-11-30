import { EOS_CONTRACT, api, transact } from "./database.js";

(async () => {
  const reservations = await api.rpc.get_table_rows({
    json: true,
    code: EOS_CONTRACT,
    scope: EOS_CONTRACT,
    table: "reservations",
    limit: 10000,
  });
  const bids = reservations.rows.map((row) => row.bid);
  const offers = reservations.rows.map((row) => row.offer);
  const keep = [...bids, ...offers];
  const proposals = await api.rpc.get_table_rows({
    json: true,
    code: EOS_CONTRACT,
    scope: EOS_CONTRACT,
    table: "proposals",
    limit: 10000,
  });
  const actions = proposals.rows
    .map((row) => {
      if (row.volume === 0) {
        if (keep.includes(row.id)) {
          console.log(`Skip ${row.id} cause there exists a reservation`);
        } else {
          console.log(`Delete ${row.id}`);
          return {
            account: EOS_CONTRACT,
            name: "dropprop",
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

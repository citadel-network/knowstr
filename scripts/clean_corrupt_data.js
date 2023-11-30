import { EOS_CONTRACT, api, transact } from "./database.js";

(async () => {
  const reservations = await api.rpc.get_table_rows({
    json: true,
    code: EOS_CONTRACT,
    scope: EOS_CONTRACT,
    table: "reservations",
    limit: 10000,
  });
  const giftRequests = await api.rpc.get_table_rows({
    json: true,
    code: EOS_CONTRACT,
    scope: EOS_CONTRACT,
    table: "gifts",
    limit: 10000,
  });
  const existingReservations = reservations.rows.map((row) => row.id);
  const actions = giftRequests.rows
    .map((row) => {
      if (!existingReservations.includes(row.reservation_id)) {
        console.log(
          `gift request ${row.id} misses reservation ${row.reservation_id}. Bid Status ${row.bid_status}, Offer Status: ${row.offer_status}`
        );
        return {
          account: EOS_CONTRACT,
          name: "dropgift",
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

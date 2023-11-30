import { EOS_CONTRACT, api, transact } from "./database.js";

(async () => {
  const referrals = await api.rpc.get_table_rows({
    code: EOS_CONTRACT,
    scope: EOS_CONTRACT,
    table: "referrals",
  });
  await Promise.all(
    referrals.rows.map(async (row) => {
      transact(api, EOS_CONTRACT, EOS_CONTRACT, "dropaccount", {
        user: row.user,
        account: "trust",
      });
      transact(api, EOS_CONTRACT, EOS_CONTRACT, "dropaccount", {
        user: row.user,
        account: "credit",
      });
      transact(api, EOS_CONTRACT, EOS_CONTRACT, "dropaccount", {
        user: row.user,
        account: "reserved",
      });
      transact(api, EOS_CONTRACT, EOS_CONTRACT, "dropaccount", {
        user: row.user,
        account: "revenue",
      });
      transact(api, EOS_CONTRACT, EOS_CONTRACT, "dropreferral", {
        user: row.user,
      });
    })
  );
})();

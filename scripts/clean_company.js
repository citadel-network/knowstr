import { EOS_CONTRACT, api, transact } from "./database.js";

(async () => {
  const backers = await api.rpc.get_table_rows({
    code: EOS_CONTRACT,
    scope: "network",
    table: "backers",
  });
  await Promise.all(
    backers.rows.map(async (row) => {
      transact(api, EOS_CONTRACT, EOS_CONTRACT, "dropbacker", {
        company_name: "network",
        user: row.user,
      });
    })
  );
  await transact(api, EOS_CONTRACT, EOS_CONTRACT, "dropcompany", {
    company_name: "network",
  });
})();

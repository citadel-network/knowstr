import { EOS_CONTRACT, api, transact } from "./database.js";

(async () => {
  try {
    const proposals = await api.rpc.get_table_rows({
      json: true,
      code: EOS_CONTRACT,
      scope: EOS_CONTRACT,
      table: "gifts",
      limit: 10000,
    });
    await Promise.all(
      proposals.rows.map(async (row) =>
        transact(api, EOS_CONTRACT, EOS_CONTRACT, "dropgift", { id: row.id })
      )
    );
  } catch (e) {
    console.log(e);
  }
})();

require("dotenv").config();
const { initDb } = require("./src/db");
const app = require("./src/app");
const { startListener } = require("./src/listener");

const PORT = process.env.PORT || 3001;

async function main() {
  await initDb();
  app.listen(PORT, () => console.log(`ArcPay backend on http://localhost:${PORT}`));
  startListener();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

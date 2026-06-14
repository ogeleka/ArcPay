const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const db = new Database(path.join(__dirname, "..", "arcpay.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  // Migrations - safe to re-run; SQLite throws on duplicate columns, we swallow it
  const migrations = [
    "ALTER TABLE merchants ADD COLUMN webhook_secret TEXT;",
    "ALTER TABLE payments ADD COLUMN currency TEXT DEFAULT 'USDC';",
    "ALTER TABLE payments ADD COLUMN amount_ngn INTEGER;",
    "ALTER TABLE payments ADD COLUMN rate REAL;",
    "ALTER TABLE payments ADD COLUMN order_id TEXT;",
    "ALTER TABLE payments ADD COLUMN customer_email TEXT;",
    "ALTER TABLE payments ADD COLUMN callback_url TEXT;",
    "ALTER TABLE payments ADD COLUMN metadata TEXT;",
    "ALTER TABLE payments ADD COLUMN expires_at TEXT;",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) {}
  }
  console.log("DB ready (SQLite)");
}

module.exports = { db, initDb };

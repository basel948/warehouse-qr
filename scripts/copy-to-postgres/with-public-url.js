// Runs a command with DATABASE_URL set to the Railway Postgres *public* URL,
// for use from a laptop (the service's own DATABASE_URL is a railway.internal
// address that only works inside Railway). Never prints the URL itself.
//
//   railway run --service Postgres -- node scripts/copy-to-postgres/with-public-url.js npx prisma migrate deploy

const { spawnSync } = require("node:child_process");

// Newer Railway Postgres services don't always define DATABASE_PUBLIC_URL;
// build it from the TCP proxy + credentials when public networking is on.
function buildFromProxy() {
  const { RAILWAY_TCP_PROXY_DOMAIN, RAILWAY_TCP_PROXY_PORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env;
  if (!RAILWAY_TCP_PROXY_DOMAIN || !RAILWAY_TCP_PROXY_PORT || !PGUSER || !PGPASSWORD || !PGDATABASE) {
    return undefined;
  }
  return `postgresql://${encodeURIComponent(PGUSER)}:${encodeURIComponent(PGPASSWORD)}@${RAILWAY_TCP_PROXY_DOMAIN}:${RAILWAY_TCP_PROXY_PORT}/${PGDATABASE}`;
}

const publicUrl = process.env.DATABASE_PUBLIC_URL || buildFromProxy();
if (!publicUrl) {
  const dbKeys = Object.keys(process.env).filter((key) => /DATABASE|PG|POSTGRES|TCP_PROXY/i.test(key));
  console.error(
    "DATABASE_PUBLIC_URL is not set. Database-related variables present: " +
      (dbKeys.length ? dbKeys.join(", ") : "(none)") +
      "\nIf none are present, `railway run` didn't pass Railway's variables through." +
      "\nIf others are present, enable public networking (TCP proxy) on the Postgres service."
  );
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: publicUrl },
});
process.exit(result.status ?? 1);

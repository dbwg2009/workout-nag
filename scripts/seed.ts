import 'dotenv/config';
import { getDb, getPool } from '../src/db/client';
import { settings } from '../src/db/schema';

async function main() {
  const db = getDb();
  const existing = await db.select().from(settings);
  if (existing.length === 0) {
    await db.insert(settings).values({ id: 1 });
    console.log('Seeded default settings row.');
  } else {
    console.log('Settings already present, nothing to seed.');
  }
  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

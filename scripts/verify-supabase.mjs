import { createAuthenticatedClient, createServerAdminClient } from '../backend/supabase-client.js';

const tables = ['users','customers','properties','equipment','services','warranties','audit_events','import_batches','legacy_id_map'];
const anon = createAuthenticatedClient();
for (const table of tables) {
  const { data, error } = await anon.from(table).select('*').limit(1);
  if (!error) {
    throw new Error(
      `SECURITY FAILURE: unauthenticated query was permitted for ${table} ` +
      `(returned ${data?.length ?? 0} rows).`
    );
  }

  const denied = error.code === '42501' || /permission denied/i.test(error.message);
  if (!denied) {
    throw new Error(`Unexpected anonymous response for ${table}: ${error.message}`);
  }
}
console.log('Anonymous table access was denied for every protected table.');

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const admin = createServerAdminClient();
  for (const table of tables) {
    const { error } = await admin.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Schema check failed for ${table}: ${error.message}`);
  }
  console.log('Server-only schema checks passed for every required table.');
}

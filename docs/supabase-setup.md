# AirHeat Supabase setup

This foundation is additive. The current static AirHeat application continues using its legacy data until an explicitly approved cutover. Do not import `clients-data.js` or remove the legacy application during this step.

## Security model

- Supabase Auth is required before any production customer query.
- The future browser application uses only `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or the equivalent publishable key).
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and is accepted only by administrative scripts.
- Row Level Security is enabled on all nine public tables.
- The `anon` role has no table privileges or policies.
- Active authenticated users can read operational records.
- Only active admins can create, update, or delete operational records.
- Only admins can read audit events or manage imports and legacy mappings.
- `assigned_to` and the `admin`/`employee` role prepare the model for later employee-scoped policies.

## Local setup

1. Install Node.js, a Docker-compatible runtime, and the Supabase CLI.
2. Copy `.env.example` to `.env` and keep `.env` untracked.
3. Run `npm install`.
4. Start the local Supabase stack with `supabase start`.
5. Rebuild the local database with `supabase db reset` only when local data may safely be destroyed.
6. Run `npm run verify:supabase` using the local URL and anon key printed by the CLI.

The migration is `supabase/migrations/202608090001_airheat_core.sql`. The seed is intentionally empty.

## Staging project setup

1. Create a separate Supabase project dedicated to AirHeat staging.
2. In Authentication settings, keep public sign-up disabled. Email/password authentication is sufficient for the first admin.
3. Link this repository: `supabase link --project-ref <staging-project-ref>`.
4. Review migration status with `supabase migration list`.
5. Apply the schema with `supabase db push`. Do not use remote `db reset`.
6. Create the first admin in **Authentication → Users**.
7. Copy that Auth user's UUID and run this once in the staging SQL editor:

```sql
insert into public.users (id, email, display_name, role, active)
values ('<AUTH_USER_UUID>', '<ADMIN_EMAIL>', 'AirHeat Admin', 'admin', true);
```

8. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` locally. Keep the service-role key only in a protected local/server environment.
9. Run `npm run verify:supabase`. It verifies that an unauthenticated client receives no rows and, when a service-role key is present, that all required tables exist.

## Future Vercel configuration

Do not configure the current static UI to query Supabase yet. During the authenticated UI step:

- Add the project URL and anon/publishable key through Vercel environment variables.
- Never create a public-prefixed service-role variable.
- Keep the service-role key out of browser bundles and static assets.
- Require a valid Auth session before rendering or querying customer data.
- After final cutover and reconciliation, remove `clients-data.js` from public assets so customer data is no longer statically exposed.

## Staging-safe legacy import

The importer accepts an explicit JSON export, not `clients-data.js`:

```sh
node scripts/import-legacy.mjs /secure/path/legacy-export.json
```

That command performs validation and prints counts/checksum without contacting Supabase. To apply later, after explicit migration approval:

```sh
AIRHEAT_IMPORT_TARGET=staging \
AIRHEAT_IMPORT_CONFIRM=IMPORT_TO_STAGING_ONLY \
node scripts/import-legacy.mjs /secure/path/legacy-export.json --apply
```

Application requires an HTTPS project URL, both staging confirmation values, and a server-only service-role key. Each source checksum creates one `import_batches` record. Every legacy customer, property, equipment, service, and warranty gets a `legacy_id_map` entry. Re-running the same export reuses those mappings and a completed checksum becomes a no-op.

The importer never merges duplicate customers. Each legacy installation/customer record retains its own identity until a separately reviewed deduplication migration exists. Ambiguous services under future multi-equipment legacy records fail the import instead of guessing.

Before any approved import:

1. Export every production browser's complete `airheat_clients` localStorage value.
2. Store immutable copies and SHA-256 checksums outside the repository.
3. Validate in dry-run mode.
4. Take a staging database backup.
5. Import to staging only.
6. Reconcile customer/property/equipment/service/warranty counts and legacy mappings.
7. Test Dashboard, Customers, Properties, Equipment, Services, Maps/Waze, and service actions.

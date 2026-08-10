# AirHeat Step 4 authenticated staging UI

Step 4 adds a separate authenticated entry point without changing the legacy entry point or importing legacy customer data.

## Entry points

- `index.html` remains the legacy application and continues using `clients-data.js` and local storage.
- `staging.html` is the Supabase-backed staging application. It does not load `clients-data.js`.
- The staging UI is read-only until normalized create/update flows are implemented and approved.

## Runtime configuration

The browser receives only the Supabase project URL and publishable key. Generate the ignored runtime file locally or during deployment:

```sh
SUPABASE_URL=https://your-project-ref.supabase.co \
SUPABASE_ANON_KEY=your-publishable-key \
npm run config:staging
```

Never add a secret or service-role key to `runtime-config.js`, browser code, Vercel public variables, or static assets.

## Authentication behavior

- A valid Supabase session is required before `domain.js` or `app.js` is loaded.
- The signed-in Auth user must have an active row in `public.users`.
- Public sign-up stays disabled; admins add users by invitation.
- Password recovery returns to `staging.html` and requires an allowed Supabase redirect URL.
- Signing out clears the Supabase session and returns to the login screen.

## Data behavior

- Customer queries run only after authentication.
- Normalized Customer → Property → Equipment → Service rows are mapped into the existing read views.
- Empty staging tables render zero customers; no demo or legacy customer is injected.
- All create/service/property/equipment actions are hidden in staging read-only mode.
- The legacy entry point and regression suite remain independent.

## Verification

1. Run `npm run verify:supabase` with the staging URL and publishable key.
2. Confirm unauthenticated `staging.html` loads only `runtime-config.js` and `auth-gate.js`.
3. Confirm `clients-data.js`, `domain.js`, and `app.js` are not loaded before authentication.
4. Sign in as the active staging admin and verify Dashboard, Customers, Properties, Equipment, and Services render with zero imported customers.
5. Sign out and confirm protected UI is removed.
6. Run `tests/regression.html` and keep all 15 legacy checks passing.

Do not import legacy data until staging authentication, RLS, normalized counts, rollback/export, and reconciliation are separately approved.

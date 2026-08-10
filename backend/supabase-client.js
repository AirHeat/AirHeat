import { createClient } from '@supabase/supabase-js';

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// Future authenticated application code uses only the anon/publishable key.
// RLS denies customer data until a valid Supabase Auth session exists.
export function createAuthenticatedClient(options = {}) {
  return createClient(
    requiredEnvironment('SUPABASE_URL'),
    requiredEnvironment('SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false }, ...options }
  );
}

// Import/administration scripts only. Never import this function into browser code.
export function createServerAdminClient() {
  if (typeof window !== 'undefined') throw new Error('The service-role client is server-only.');
  return createClient(
    requiredEnvironment('SUPABASE_URL'),
    requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

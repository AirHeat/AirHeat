import { writeFile } from 'node:fs/promises';

const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const config = {
  url: required('SUPABASE_URL'),
  publishableKey: required('SUPABASE_ANON_KEY')
};

await writeFile(
  new URL('../runtime-config.js', import.meta.url),
  `window.AIRHEAT_SUPABASE_CONFIG = ${JSON.stringify(config)};\n`,
  { mode: 0o600 }
);

console.log('Generated runtime-config.js with public Supabase browser configuration.');

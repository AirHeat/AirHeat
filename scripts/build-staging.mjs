import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const root = new URL('../', import.meta.url);
const output = new URL('../dist-staging/', import.meta.url);
const assets = ['auth-gate.js', 'app.js', 'domain.js', 'styles.css', 'icon.svg'];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const asset of assets) {
  await cp(new URL(asset, root), new URL(asset, output));
}

await cp(new URL('staging.html', root), new URL('index.html', output));
await writeFile(
  new URL('runtime-config.js', output),
  `window.AIRHEAT_SUPABASE_CONFIG = ${JSON.stringify({
    url: required('SUPABASE_URL'),
    publishableKey: required('SUPABASE_ANON_KEY')
  })};\n`,
  { mode: 0o600 }
);

console.log(`Built isolated AirHeat staging site with ${assets.length + 2} files.`);

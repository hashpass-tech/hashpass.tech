#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { writeFile, chmod } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const environment = argument('environment');
const organization = argument('organization');
const name = argument('name');
const eventId = argument('event');
const output = argument('output');
if (!['test', 'live'].includes(environment) || !organization || !name || !eventId || !output) {
  console.error('Usage: provision-developer-api-key.mjs --environment test|live --organization SLUG --name NAME --event EVENT_ID --output SECRET_FILE');
  process.exit(2);
}

const isLive = environment === 'live';
const supabaseUrl = process.env[isLive ? 'EXPO_PUBLIC_SUPABASE_URL_PROD' : 'EXPO_PUBLIC_SUPABASE_URL_DEV'];
const serviceKey = process.env[isLive ? 'BSL_SUPABASE_SERVICE_ROLE_KEY_PROD' : 'BSL_SUPABASE_SERVICE_ROLE_KEY_DEV'];
if (!supabaseUrl || !serviceKey) throw new Error(`Missing ${environment} BSL Supabase configuration`);

const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: existing, error: lookupError } = await client.from('developer_apps')
  .select('id,event_ids').eq('organization_slug', organization).eq('name', name).eq('environment', environment).maybeSingle();
if (lookupError) throw lookupError;
let app = existing;
if (!app) {
  const created = await client.from('developer_apps').insert({
    organization_slug: organization, name, environment, event_ids: [eventId],
  }).select('id,event_ids').single();
  if (created.error) throw created.error;
  app = created.data;
} else if (!app.event_ids.includes(eventId)) {
  const updated = await client.from('developer_apps').update({ event_ids: [...app.event_ids, eventId] })
    .eq('id', app.id).select('id,event_ids').single();
  if (updated.error) throw updated.error;
  app = updated.data;
}

const rawKey = `hp_${environment}_${randomBytes(32).toString('base64url')}`;
const secretHash = createHash('sha256').update(rawKey).digest('hex');
const inserted = await client.from('developer_api_keys').insert({
  app_id: app.id,
  key_prefix: rawKey.slice(0, 16),
  secret_hash: secretHash,
  scopes: ['tickets:write'],
}).select('id,key_prefix').single();
if (inserted.error) throw inserted.error;

await writeFile(output, `${rawKey}\n`, { mode: 0o600, flag: 'wx' });
await chmod(output, 0o600);
console.log(JSON.stringify({ created: true, appId: app.id, keyId: inserted.data.id, keyPrefix: inserted.data.key_prefix, secretFile: output }));

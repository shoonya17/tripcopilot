import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const schema = fs.readFileSync(path.join(root,'packages/db/prisma/schema.prisma'),'utf8');
const migration = fs.readFileSync(path.join(root,'packages/db/prisma/migrations/0001_init/migration.sql'),'utf8');

test('all canonical entities are represented in the data contract', () => {
  for (const model of ['Traveler','Trip','GroupTrip','TrustedContact','SafetyCheckin','Segment','Connection','Document','Budget','Expense','PreferenceSet','Conflict']) assert.match(schema, new RegExp(`model ${model}\\s`));
  for (const table of ['traveler','trip','group_trip','trusted_contact','safety_checkin','segment','connection','document','budget','expense','preference_set','conflict']) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s`));
});

test('mutable canonical records expose rowVersion in Prisma schema', () => {
  for (const model of ['Traveler','Trip','GroupTrip','TrustedContact','Segment','Connection','Document','Budget','Expense','PreferenceSet','Conflict']) {
    const marker = `model ${model} {`;
const start = schema.indexOf(marker);
const end = start >= 0 ? schema.indexOf('\n}', start + marker.length) : -1;
const block = start >= 0 && end >= 0 ? schema.slice(start + marker.length, end) : '';
    assert.match(block, /rowVersion\s+Int/);
  }
  const safety = schema.match(/model SafetyCheckin \{([\s\S]*?)\n\}/m)?.[1] ?? '';
  assert.doesNotMatch(safety, /rowVersion\s+Int/);
});

test('current source contains no prohibited future-capability endpoints', () => {
  const sourceDir = path.join(root,'apps/web/src/app/api');
  const prohibited = /\/(monitoring|disruptions|recovery|rebooking|payments|booking|autonomous-action|supplier-sync|tripit)(\/|['"`])/;
  function walk(dir) {
    for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
      const file=path.join(dir,e.name);
      if (e.isDirectory()) walk(file);
      else if (/\.(ts|tsx)$/.test(e.name)) assert.doesNotMatch(fs.readFileSync(file,'utf8'), prohibited);
    }
  }
  walk(sourceDir);
});

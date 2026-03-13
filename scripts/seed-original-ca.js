
const { Pool } = require('pg');
const { execSync } = require('child_process');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Extract the original courts from git history
const src = execSync('git show e7d7899:data/courts.ts').toString();

// Find the actual start: "export const COURTS: Court[] = ["
const marker = 'export const COURTS: Court[] = [';
const markerIdx = src.indexOf(marker);
const arrStart = markerIdx + marker.length - 1; // points to [

let depth = 0, arrEnd = arrStart;
for (let i = arrStart; i < src.length; i++) {
  if (src[i] === '[') depth++;
  else if (src[i] === ']') { depth--; if (depth === 0) { arrEnd = i; break; } }
}
const body = src.substring(arrStart + 1, arrEnd);

// Parse court objects manually using regex
// Each court is a { ... } block, fields we need: id, name, shortName, address, city, latitude, longitude, type, surface, hoops, description, basePlayersPlaying, maxPlayers
function extractStr(obj, key) {
  const m = obj.match(new RegExp(`${key}:\\s*"([^"]*)"`, ''));
  return m ? m[1] : null;
}
function extractNum(obj, key) {
  const m = obj.match(new RegExp(`${key}:\\s*(-?[\\d.]+)`, ''));
  return m ? parseFloat(m[1]) : null;
}

// Split into individual court objects
const courtBlocks = [];
let d = 0, blockStart = -1;
for (let i = 0; i < body.length; i++) {
  if (body[i] === '{') {
    if (d === 0) blockStart = i;
    d++;
  } else if (body[i] === '}') {
    d--;
    if (d === 0 && blockStart >= 0) {
      courtBlocks.push(body.substring(blockStart, i + 1));
      blockStart = -1;
    }
  }
}

const courts = courtBlocks.map(block => ({
  id: extractStr(block, 'id'),
  name: extractStr(block, 'name'),
  shortName: extractStr(block, 'shortName'),
  address: extractStr(block, 'address'),
  city: extractStr(block, 'city'),
  latitude: extractNum(block, 'latitude'),
  longitude: extractNum(block, 'longitude'),
  type: extractStr(block, 'type') ?? 'outdoor',
  surface: extractStr(block, 'surface') ?? 'asphalt',
  hoops: extractNum(block, 'hoops') ?? 2,
  description: extractStr(block, 'description'),
  basePlayersPlaying: extractNum(block, 'basePlayersPlaying') ?? 0,
  maxPlayers: extractNum(block, 'maxPlayers') ?? 10,
})).filter(c => c.id && c.latitude && c.longitude);

console.log(`Parsed ${courts.length} original courts`);
if (courts.length > 0) console.log('Sample:', courts[0].id, '-', courts[0].name);

async function seed() {
  const client = await pool.connect();
  try {
    // Remove generated California courts
    const del = await client.query(`DELETE FROM courts WHERE state_abbr = 'CA' OR state = 'California'`);
    console.log(`Removed ${del.rowCount} generated CA courts`);

    let inserted = 0;
    for (const c of courts) {
      try {
        await client.query(
          `INSERT INTO courts (id, name, short_name, address, city, state, state_abbr, country, latitude, longitude, type, surface, hoops, description, base_players_playing, max_players)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT (id) DO UPDATE SET
             name=EXCLUDED.name, short_name=EXCLUDED.short_name, address=EXCLUDED.address,
             city=EXCLUDED.city, state=EXCLUDED.state, state_abbr=EXCLUDED.state_abbr,
             latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, type=EXCLUDED.type,
             surface=EXCLUDED.surface, hoops=EXCLUDED.hoops, description=EXCLUDED.description,
             base_players_playing=EXCLUDED.base_players_playing, max_players=EXCLUDED.max_players`,
          [
            c.id, c.name, c.shortName ?? c.name,
            c.address ?? '', c.city ?? 'Los Angeles',
            'California', 'CA', 'US',
            c.latitude, c.longitude,
            c.type, c.surface, c.hoops,
            c.description ?? `${c.name} in ${c.city}, CA.`,
            c.basePlayersPlaying, c.maxPlayers
          ]
        );
        inserted++;
      } catch (err) {
        console.warn(`  Skipped ${c.id}: ${err.message}`);
      }
    }

    const total = await client.query('SELECT COUNT(*) FROM courts');
    console.log(`✓ Inserted ${inserted} original CA courts`);
    console.log(`✓ Total courts in DB: ${total.rows[0].count}`);

    // Show breakdown by state
    const breakdown = await client.query(
      `SELECT state_abbr, COUNT(*) FROM courts GROUP BY state_abbr ORDER BY state_abbr LIMIT 5`
    );
    console.log('Sample breakdown:', breakdown.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });

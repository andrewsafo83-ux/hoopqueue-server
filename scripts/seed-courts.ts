import { Pool } from "pg";
import { COURTS } from "../data/courts";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  console.log(`Seeding ${COURTS.length} courts...`);

  for (const c of COURTS) {
    await pool.query(
      `INSERT INTO courts (id, name, short_name, address, city, state, country, latitude, longitude, type, surface, hoops, description, base_players_playing, max_players)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         short_name = EXCLUDED.short_name,
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         state = EXCLUDED.state,
         country = EXCLUDED.country,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         type = EXCLUDED.type,
         surface = EXCLUDED.surface,
         hoops = EXCLUDED.hoops,
         description = EXCLUDED.description,
         base_players_playing = EXCLUDED.base_players_playing,
         max_players = EXCLUDED.max_players`,
      [
        c.id,
        c.name,
        c.shortName,
        c.address,
        c.city,
        (c as any).state ?? "CA",
        (c as any).country ?? "US",
        c.latitude,
        c.longitude,
        c.type,
        c.surface,
        c.hoops,
        c.description,
        c.basePlayersPlaying,
        c.maxPlayers,
      ]
    );
  }

  const result = await pool.query("SELECT COUNT(*) FROM courts");
  console.log(`Done. ${result.rows[0].count} courts in DB.`);
  await pool.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });

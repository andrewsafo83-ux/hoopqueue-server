import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { CA_COURTS } from "./ca-courts";
import { US_COURTS } from "./us-courts";

// ─── Database ─────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Supabase Storage ─────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function uploadImageToStorage(base64: string, filename: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const raw = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(raw, "base64");
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/post-images/${filename}`;
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
      },
      body: buffer,
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Storage upload failed:", err);
      return null;
    }
    return `${SUPABASE_URL}/storage/v1/object/public/post-images/${filename}`;
  } catch (e) {
    console.error("Storage upload error:", e);
    return null;
  }
}

// ─── Profanity filter ─────────────────────────────────────────────────────────

const PROFANITY_LIST = [
  "fuck", "shit", "bitch", "ass", "asshole", "bastard", "damn", "crap",
  "dick", "cock", "pussy", "nigger", "nigga", "faggot", "fag", "slut",
  "whore", "cunt", "motherfucker", "motherfucking", "fucker", "fucking",
  "bullshit", "dumbass", "jackass", "dipshit", "shithead", "prick",
  "retard", "retarded", "nazi", "kike", "spic", "wetback", "chink",
  "cracker", "twat", "wanker", "bollocks", "arse", "shite", "feck",
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase().replace(/[^a-z\s]/g, "");
  const words = lower.split(/\s+/);
  return words.some((w) => PROFANITY_LIST.includes(w));
}

// ─── In-memory court messages ─────────────────────────────────────────────────

export interface CourtMessage {
  id: string;
  courtId: string;
  userId: string;
  username: string;
  skillLevel: string;
  text: string;
  timestamp: number;
}

const MAX_MESSAGES_PER_COURT = 100;
const courtMessages = new Map<string, CourtMessage[]>();

function getMessages(courtId: string): CourtMessage[] {
  return courtMessages.get(courtId) ?? [];
}

function addMessage(msg: CourtMessage): void {
  const existing = courtMessages.get(msg.courtId) ?? [];
  const updated = [...existing, msg];
  if (updated.length > MAX_MESSAGES_PER_COURT) {
    updated.splice(0, updated.length - MAX_MESSAGES_PER_COURT);
  }
  courtMessages.set(msg.courtId, updated);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ─── Push Notifications ───────────────────────────────────────────────────────

async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  const valid = tokens.filter((t) => t && t.startsWith("ExponentPushToken["));
  if (valid.length === 0) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        valid.map((to) => ({ to, title, body, data, sound: "default" }))
      ),
    });
  } catch (err) {
    console.warn("Push notification send failed:", err);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function registerRoutes(app: Express): Promise<Server> {

  // ── Auto-seed courts if table is empty ────────────────────────────────────
  await (async () => {
    try {
      // Ensure courts table exists with state_abbr column
      await pool.query(`
        CREATE TABLE IF NOT EXISTS courts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          short_name TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          state_abbr VARCHAR(10) DEFAULT '',
          country TEXT DEFAULT 'US',
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          type TEXT DEFAULT 'outdoor',
          surface TEXT DEFAULT 'asphalt',
          hoops INTEGER DEFAULT 4,
          description TEXT,
          base_players_playing INTEGER DEFAULT 0,
          max_players INTEGER DEFAULT 10
        )
      `);
      await pool.query(`ALTER TABLE courts ADD COLUMN IF NOT EXISTS state_abbr VARCHAR(10) DEFAULT ''`);

      // Always ensure the real California courts are present. Check for a known real court
      // ID (venice-beach) — if missing, delete any fake generated CA courts and insert all real ones.
      const caRealCheck = await pool.query("SELECT 1 FROM courts WHERE id = 'venice-beach' LIMIT 1");
      if (caRealCheck.rows.length === 0) {
        console.log("Real California courts missing — replacing with 169 real courts...");
        await pool.query("DELETE FROM courts WHERE state_abbr = 'CA'");
        const caChunkSize = 50;
        const caCourts = CA_COURTS.map(c => ({ ...c, type: c.type as string, surface: c.surface as string }));
        for (let i = 0; i < caCourts.length; i += caChunkSize) {
          const chunk = caCourts.slice(i, i + caChunkSize);
          const placeholders = chunk.map((_, j) => {
            const b = j * 16;
            return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16})`;
          }).join(",");
          const values = chunk.flatMap(c => [c.id,c.name,c.shortName,c.address,c.city,c.state,c.stateAbbr,"US",c.latitude,c.longitude,c.type,c.surface,c.hoops,c.description,c.basePlayersPlaying,c.maxPlayers]);
          await pool.query(
            `INSERT INTO courts (id,name,short_name,address,city,state,state_abbr,country,latitude,longitude,type,surface,hoops,description,base_players_playing,max_players)
             VALUES ${placeholders} ON CONFLICT (id) DO NOTHING`,
            values
          );
        }
        console.log(`✓ Replaced with ${caCourts.length} real California courts`);
      }

      // Zero out any stale fake player counts
      await pool.query("UPDATE courts SET base_players_playing = 0 WHERE base_players_playing > 0");

      // Seed US courts from other states if not yet present (check for a non-CA court)
      const usCheck = await pool.query("SELECT 1 FROM courts WHERE state_abbr != 'CA' LIMIT 1");
      if (usCheck.rows.length === 0) {
        console.log("Non-CA courts missing — seeding all US courts from OpenStreetMap...");
        const usCourts = US_COURTS.map(c => ({ ...c, type: c.type as string, surface: c.surface as string }));
        const chunkSize = 50;
        for (let i = 0; i < usCourts.length; i += chunkSize) {
          const chunk = usCourts.slice(i, i + chunkSize);
          const placeholders = chunk.map((_, j) => {
            const b = j * 16;
            return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16})`;
          }).join(",");
          const values = chunk.flatMap(c => [c.id,c.name,c.shortName,c.address,c.city,c.state,c.stateAbbr,"US",c.latitude,c.longitude,c.type,c.surface,c.hoops,c.description,0,c.maxPlayers]);
          await pool.query(
            `INSERT INTO courts (id,name,short_name,address,city,state,state_abbr,country,latitude,longitude,type,surface,hoops,description,base_players_playing,max_players)
             VALUES ${placeholders} ON CONFLICT (id) DO NOTHING`,
            values
          );
        }
        console.log(`✓ Seeded ${usCourts.length} real courts across all US states`);
      }
    } catch (err) {
      console.error("Auto-seed error:", err);
    }
  })();

  // ── Social feed tables ─────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar_base64 TEXT,
      image_base64 TEXT NOT NULL,
      caption TEXT,
      court_id TEXT,
      court_name TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar_base64 TEXT,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // ── Users table ───────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      handle TEXT UNIQUE,
      email TEXT UNIQUE,
      phone TEXT,
      skill_level TEXT DEFAULT 'Intermediate',
      avatar_base64 TEXT,
      push_token TEXT,
      device_id TEXT,
      last_ip TEXT,
      last_seen_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_base64 TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS device_id TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS handle TEXT`);

  // ── Waitlists table ───────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS waitlists (
      id SERIAL PRIMARY KEY,
      court_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      skill_level TEXT DEFAULT 'Intermediate',
      position INTEGER NOT NULL,
      joined_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(court_id, user_id)
    )
  `);

  // ── Friendships table ─────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS friendships (
      id SERIAL PRIMARY KEY,
      requester_id TEXT NOT NULL,
      addressee_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(requester_id, addressee_id)
    )
  `);

  // ── DMs table ─────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS direct_messages (
      id SERIAL PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_read_receipts (
      user_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      last_read TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, partner_id)
    )
  `);

  // ── Analytics events table ─────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id SERIAL PRIMARY KEY,
      event TEXT NOT NULL,
      user_id TEXT,
      properties JSONB DEFAULT '{}',
      platform TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at)`);

  // POST /api/analytics — fire-and-forget event ingestion
  app.post("/api/analytics", async (req: Request, res: Response) => {
    const { event, userId, properties, platform } = req.body;
    if (!event) return res.status(400).json({ message: "event required" });
    try {
      let username: string | null = null;
      let email: string | null = null;
      if (userId) {
        const userRow = await pool.query(
          "SELECT username, email FROM users WHERE user_id = $1 LIMIT 1",
          [userId]
        );
        if (userRow.rows.length > 0) {
          username = userRow.rows[0].username ?? null;
          email = userRow.rows[0].email ?? null;
        }
      }
      await pool.query(
        "INSERT INTO analytics_events (event, user_id, username, email, properties, platform) VALUES ($1, $2, $3, $4, $5, $6)",
        [event, userId ?? null, username, email, JSON.stringify(properties ?? {}), platform ?? null]
      );
      res.status(201).json({ ok: true });
    } catch {
      res.status(500).json({ message: "Failed to record event" });
    }
  });

  // GET /api/admin/analytics — aggregated event stats for admin
  app.get("/api/admin/analytics", async (req: Request, res: Response) => {
    const { userId } = req.query as { userId: string };
    if (userId !== ADMIN_USER_ID) return res.status(403).json({ message: "Forbidden" });
    try {
      const [eventCounts, dailyActive, topEvents, platformSplit, recentEvents] = await Promise.all([
        pool.query(`
          SELECT event, COUNT(*) as count
          FROM analytics_events
          GROUP BY event ORDER BY count DESC
        `),
        pool.query(`
          SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as dau
          FROM analytics_events
          WHERE user_id IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30
        `),
        pool.query(`
          SELECT event, COUNT(*) as count
          FROM analytics_events
          WHERE created_at >= NOW() - INTERVAL '7 days'
          GROUP BY event ORDER BY count DESC LIMIT 10
        `),
        pool.query(`
          SELECT platform, COUNT(*) as count
          FROM analytics_events
          WHERE platform IS NOT NULL
          GROUP BY platform
        `),
        pool.query(`
          SELECT ae.event, ae.user_id,
            COALESCE(ae.username, u.username) AS username,
            COALESCE(ae.email, u.email) AS email,
            ae.properties, ae.platform, ae.created_at
          FROM analytics_events ae
          LEFT JOIN users u ON u.user_id = ae.user_id
          ORDER BY ae.created_at DESC LIMIT 50
        `),
      ]);
      res.json({
        eventCounts: eventCounts.rows,
        dailyActive: dailyActive.rows,
        topEventsThisWeek: topEvents.rows,
        platformSplit: platformSplit.rows,
        recentEvents: recentEvents.rows,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // ── Admin ─────────────────────────────────────────────────────────────────

  const ADMIN_USER_ID = process.env.ADMIN_USER_ID ?? "";

  app.get("/api/admin/check", async (req: Request, res: Response) => {
    const { userId } = req.query as { userId: string };
    res.json({ isAdmin: !!ADMIN_USER_ID && userId === ADMIN_USER_ID });
  });

  app.get("/api/admin/stats", async (req: Request, res: Response) => {
    const { userId } = req.query as { userId: string };
    if (userId !== ADMIN_USER_ID) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const [
        totalUsers, skillBreakdown, newToday, newThisWeek,
        totalFriendships, pendingRequests, totalDMs,
        totalPosts, totalComments, totalLikes, activeWaitlists, totalCourtsRes, recentUsers,
      ] = await Promise.all([
        pool.query("SELECT COUNT(*) AS count FROM users"),
        pool.query("SELECT skill_level, COUNT(*) AS count FROM users GROUP BY skill_level ORDER BY count DESC"),
        pool.query("SELECT COUNT(*) AS count FROM users WHERE created_at >= NOW() - INTERVAL '1 day'"),
        pool.query("SELECT COUNT(*) AS count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"),
        pool.query("SELECT COUNT(*) AS count FROM friendships WHERE status = 'accepted'"),
        pool.query("SELECT COUNT(*) AS count FROM friendships WHERE status = 'pending'"),
        pool.query("SELECT COUNT(*) AS count FROM direct_messages"),
        pool.query("SELECT COUNT(*) AS count FROM posts"),
        pool.query("SELECT COUNT(*) AS count FROM post_comments"),
        pool.query("SELECT COUNT(*) AS count FROM post_likes"),
        pool.query("SELECT COUNT(*) AS count FROM waitlists"),
        pool.query("SELECT COUNT(*) AS count FROM courts"),
        pool.query(`SELECT user_id, username, skill_level, email, device_id, last_ip, created_at, last_seen_at FROM users ORDER BY created_at DESC LIMIT 20`),
      ]);
      res.json({
        totalUsers: parseInt(totalUsers.rows[0].count),
        skillBreakdown: skillBreakdown.rows,
        newToday: parseInt(newToday.rows[0].count),
        newThisWeek: parseInt(newThisWeek.rows[0].count),
        totalFriendships: parseInt(totalFriendships.rows[0].count),
        pendingRequests: parseInt(pendingRequests.rows[0].count),
        totalDMs: parseInt(totalDMs.rows[0].count),
        totalPosts: parseInt(totalPosts.rows[0].count),
        totalComments: parseInt(totalComments.rows[0].count),
        totalLikes: parseInt(totalLikes.rows[0].count),
        activeWaitlists: parseInt(activeWaitlists.rows[0].count),
        totalCourts: parseInt(totalCourtsRes.rows[0].count),
        recentUsers: recentUsers.rows,
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/all-users", async (req: Request, res: Response) => {
    const { userId, search, limit, offset } = req.query as Record<string, string>;
    if (userId !== ADMIN_USER_ID) return res.status(403).json({ message: "Forbidden" });
    try {
      const lim = Math.min(parseInt(limit || "50"), 100);
      const off = parseInt(offset || "0");
      const searchClause = search ? `AND (u.username ILIKE $3 OR u.email ILIKE $3 OR u.handle ILIKE $3)` : "";
      const params: any[] = [lim, off, ...(search ? [`%${search}%`] : [])];
      const result = await pool.query(
        `SELECT u.user_id, u.username, u.handle, u.email, u.phone, u.skill_level,
                u.device_id, u.last_ip, u.created_at, u.last_seen_at,
                COALESCE(p.post_count, 0) AS post_count,
                COALESCE(c.comment_count, 0) AS comment_count,
                COALESCE(l.like_count, 0) AS like_count,
                COALESCE(d.dm_count, 0) AS dm_count,
                COALESCE(w.waitlist_count, 0) AS waitlist_count
         FROM users u
         LEFT JOIN (SELECT user_id, COUNT(*) AS post_count FROM posts GROUP BY user_id) p ON p.user_id = u.user_id
         LEFT JOIN (SELECT user_id, COUNT(*) AS comment_count FROM post_comments GROUP BY user_id) c ON c.user_id = u.user_id
         LEFT JOIN (SELECT user_id, COUNT(*) AS like_count FROM post_likes GROUP BY user_id) l ON l.user_id = u.user_id
         LEFT JOIN (SELECT sender_id AS user_id, COUNT(*) AS dm_count FROM direct_messages GROUP BY sender_id) d ON d.user_id = u.user_id
         LEFT JOIN (SELECT user_id, COUNT(*) AS waitlist_count FROM waitlists GROUP BY user_id) w ON w.user_id = u.user_id
         WHERE 1=1 ${searchClause}
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      );
      const total = await pool.query(`SELECT COUNT(*) AS count FROM users ${search ? "WHERE username ILIKE $1 OR email ILIKE $1 OR handle ILIKE $1" : ""}`, search ? [`%${search}%`] : []);
      res.json({ users: result.rows, total: parseInt(total.rows[0].count) });
    } catch (err) {
      console.error("Admin all-users error:", err);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // ── Users ──────────────────────────────────────────────────────────────────

  app.post("/api/users", async (req: Request, res: Response) => {
    const { userId, username, handle, email, phone, skillLevel, deviceId } = req.body;
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    if (!userId || !username || !email) {
      return res.status(400).json({ message: "userId, username, and email are required" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }
    if (handle) {
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(handle.trim())) {
        return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores (3–30 chars)." });
      }
    }
    if (phone) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return res.status(400).json({ message: "Please enter a valid phone number." });
      }
    }
    try {
      // One account per device: if this deviceId is already linked to a DIFFERENT user, block
      if (deviceId) {
        const deviceCheck = await pool.query(
          `SELECT user_id FROM users WHERE device_id = $1 AND user_id != $2 LIMIT 1`,
          [deviceId, userId]
        );
        if (deviceCheck.rows.length > 0) {
          return res.status(409).json({ message: "An account already exists on this device.", code: "device_exists" });
        }
      }
      const result = await pool.query(
        `INSERT INTO users (user_id, username, handle, email, phone, skill_level, device_id, last_ip, last_seen_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET username = EXCLUDED.username, handle = EXCLUDED.handle, email = EXCLUDED.email,
           phone = EXCLUDED.phone, skill_level = EXCLUDED.skill_level,
           device_id = COALESCE(EXCLUDED.device_id, users.device_id),
           last_ip = EXCLUDED.last_ip, last_seen_at = NOW(), updated_at = NOW()
         RETURNING user_id, username, handle, skill_level`,
        [userId, username.trim(), handle?.trim().toLowerCase() || null, email.trim().toLowerCase(), phone?.trim() || null, skillLevel ?? "Intermediate", deviceId || null, clientIp]
      );
      res.status(200).json(result.rows[0]);
    } catch (err: any) {
      if (err.code === "23505" && err.constraint === "users_email_key") {
        return res.status(409).json({ message: "That email is already registered to another account." });
      }
      console.error("User upsert error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // IMPORTANT: /api/users/search must be defined BEFORE /api/users/:userId
  app.get("/api/users/search", async (req: Request, res: Response) => {
    const q = (req.query.q as string ?? "").trim();
    const myId = (req.query.myId as string ?? "").trim();
    if (!q || q.length < 2) return res.json([]);
    try {
      const result = await pool.query(
        `SELECT u.user_id, u.username, u.handle, u.skill_level,
           f.status AS friendship_status,
           f.requester_id AS friendship_requester
         FROM users u
         LEFT JOIN friendships f
           ON (f.requester_id = u.user_id AND f.addressee_id = $2)
           OR (f.addressee_id = u.user_id AND f.requester_id = $2)
         WHERE (u.username ILIKE $1 OR u.handle ILIKE $1) AND u.user_id != $2
         ORDER BY u.username ASC LIMIT 20`,
        [`%${q}%`, myId || "___none___"]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("User search error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/users/:userId", async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        "SELECT user_id, username, skill_level, created_at FROM users WHERE user_id = $1",
        [userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("User fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/users/:userId/private", async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { requesterId } = req.query;
    if (!requesterId || requesterId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const result = await pool.query(
        "SELECT user_id, username, email, phone, skill_level, created_at FROM users WHERE user_id = $1",
        [userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("User fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Avatar ─────────────────────────────────────────────────────────────────

  app.post("/api/users/:userId/avatar", async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { base64, requesterId } = req.body;
    if (!requesterId || requesterId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (!base64 || typeof base64 !== "string") {
      return res.status(400).json({ message: "base64 image required" });
    }
    if (base64.length > 500000) {
      return res.status(413).json({ message: "Image too large. Please choose a smaller photo." });
    }
    try {
      await pool.query(
        "UPDATE users SET avatar_base64 = $1, updated_at = NOW() WHERE user_id = $2",
        [base64, userId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Avatar update error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/users/:userId/avatar", async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        "SELECT avatar_base64 FROM users WHERE user_id = $1",
        [userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
      res.json({ avatar_base64: result.rows[0].avatar_base64 ?? null });
    } catch (err) {
      console.error("Avatar fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Friendships ────────────────────────────────────────────────────────────

  // IMPORTANT: specific routes before wildcard ─ /api/friends/requests/:id before /api/friends/:id

  // Send a friend request
  app.post("/api/friends/request", async (req: Request, res: Response) => {
    const { requesterId, addresseeId } = req.body;
    if (!requesterId || !addresseeId || requesterId === addresseeId) {
      return res.status(400).json({ message: "Invalid request" });
    }
    try {
      const existing = await pool.query(
        `SELECT id, status FROM friendships
         WHERE (requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1)`,
        [requesterId, addresseeId]
      );
      if (existing.rows.length > 0) {
        const s = existing.rows[0].status;
        if (s === "accepted") return res.status(409).json({ message: "Already friends" });
        if (s === "pending") return res.status(409).json({ message: "Friend request already sent" });
      }
      await pool.query(
        `INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')`,
        [requesterId, addresseeId]
      );
      const [requesterRes, addresseeRes] = await Promise.all([
        pool.query(`SELECT username FROM users WHERE user_id = $1`, [requesterId]),
        pool.query(`SELECT push_token FROM users WHERE user_id = $1`, [addresseeId]),
      ]);
      const requesterName = requesterRes.rows[0]?.username ?? "Someone";
      const addresseeToken = addresseeRes.rows[0]?.push_token;
      if (addresseeToken) {
        sendPushNotifications([addresseeToken], "New friend request 🏀", `${requesterName} wants to hoop with you!`, { screen: "messages" });
      }
      res.status(201).json({ message: "Friend request sent" });
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ message: "Friend request already sent" });
      console.error("Friend request error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Accept or decline
  app.post("/api/friends/respond", async (req: Request, res: Response) => {
    const { requesterId, addresseeId, action } = req.body;
    if (!requesterId || !addresseeId || !["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "requesterId, addresseeId, and action (accept|decline) required" });
    }
    try {
      if (action === "accept") {
        await pool.query(
          `UPDATE friendships SET status = 'accepted', updated_at = NOW()
           WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
          [requesterId, addresseeId]
        );
      } else {
        await pool.query(
          `DELETE FROM friendships WHERE requester_id = $1 AND addressee_id = $2`,
          [requesterId, addresseeId]
        );
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Friend respond error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get pending incoming requests — BEFORE /api/friends/:userId
  app.get("/api/friends/requests/:userId", async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        `SELECT f.id, f.requester_id, u.username AS requester_username, u.skill_level, f.created_at
         FROM friendships f
         JOIN users u ON u.user_id = f.requester_id
         WHERE f.addressee_id = $1 AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Friend requests error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get accepted friends list
  app.get("/api/friends/:userId", async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        `SELECT
           CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END AS friend_id,
           CASE WHEN f.requester_id = $1 THEN a.username ELSE r.username END AS username,
           CASE WHEN f.requester_id = $1 THEN a.skill_level ELSE r.skill_level END AS skill_level,
           f.created_at
         FROM friendships f
         LEFT JOIN users r ON r.user_id = f.requester_id
         LEFT JOIN users a ON a.user_id = f.addressee_id
         WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
         ORDER BY username ASC`,
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Friends list error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Remove a friend
  app.delete("/api/friends/:userId/:friendId", async (req: Request, res: Response) => {
    const { userId, friendId } = req.params;
    try {
      await pool.query(
        `DELETE FROM friendships
         WHERE (requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1)`,
        [userId, friendId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Unfriend error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Direct Messages (friends only) ─────────────────────────────────────────

  async function areFriends(userA: string, userB: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM friendships
       WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
         AND status = 'accepted' LIMIT 1`,
      [userA, userB]
    );
    return result.rows.length > 0;
  }

  // IMPORTANT: /api/dms/conversations/:userId must come BEFORE /api/dms/:userA/:userB
  app.get("/api/dms/conversations/:userId", async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        `SELECT DISTINCT ON (partner_id)
           partner_id, partner_username, partner_skill, text, sender_id, created_at
         FROM (
           SELECT
             CASE WHEN dm.sender_id = $1 THEN dm.receiver_id ELSE dm.sender_id END AS partner_id,
             CASE WHEN dm.sender_id = $1 THEN rv.username   ELSE su.username   END AS partner_username,
             CASE WHEN dm.sender_id = $1 THEN rv.skill_level ELSE su.skill_level END AS partner_skill,
             dm.text, dm.sender_id, dm.created_at
           FROM direct_messages dm
           LEFT JOIN users su ON su.user_id = dm.sender_id
           LEFT JOIN users rv ON rv.user_id = dm.receiver_id
           WHERE dm.sender_id = $1 OR dm.receiver_id = $1
           ORDER BY dm.created_at DESC
         ) sub
         ORDER BY partner_id, created_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Conversations error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get messages between two friends
  app.get("/api/dms/:userA/:userB", async (req: Request, res: Response) => {
    const { userA, userB } = req.params;
    try {
      if (!(await areFriends(userA, userB))) {
        return res.status(403).json({ message: "You must be friends to view messages" });
      }
      const result = await pool.query(
        `SELECT dm.*, u.username AS sender_username, u.skill_level AS sender_skill
         FROM direct_messages dm
         JOIN users u ON u.user_id = dm.sender_id
         WHERE (dm.sender_id = $1 AND dm.receiver_id = $2)
            OR (dm.sender_id = $2 AND dm.receiver_id = $1)
         ORDER BY dm.created_at ASC
         LIMIT 200`,
        [userA, userB]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("DM fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Send a DM (friends only)
  app.post("/api/dms", async (req: Request, res: Response) => {
    const { senderId, receiverId, text } = req.body;
    if (!senderId || !receiverId || !text) {
      return res.status(400).json({ message: "senderId, receiverId, and text are required" });
    }
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) {
      return res.status(400).json({ message: "Message must be 1–500 characters" });
    }
    if (containsProfanity(trimmed)) {
      return res.status(422).json({ message: "Your message contains language that isn't allowed." });
    }
    try {
      if (!(await areFriends(senderId, receiverId))) {
        return res.status(403).json({ message: "You must be friends to send a message" });
      }
      const result = await pool.query(
        `INSERT INTO direct_messages (sender_id, receiver_id, text) VALUES ($1, $2, $3) RETURNING *`,
        [senderId, receiverId, trimmed]
      );
      const senderRes = await pool.query(`SELECT username FROM users WHERE user_id = $1`, [senderId]);
      const receiverRes = await pool.query(`SELECT push_token FROM users WHERE user_id = $1`, [receiverId]);
      const senderName = senderRes.rows[0]?.username ?? "Someone";
      const receiverToken = receiverRes.rows[0]?.push_token;
      if (receiverToken) {
        sendPushNotifications([receiverToken], `${senderName} 💬`, trimmed.length > 60 ? trimmed.slice(0, 60) + "…" : trimmed, { screen: "messages" });
      }
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("DM send error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Push token registration ────────────────────────────────────────────────

  app.post("/api/users/:userId/push-token", async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "token required" });
    try {
      await pool.query(
        `UPDATE users SET push_token = $1 WHERE user_id = $2`,
        [token, userId]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("Push token save error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Server-side Waitlists ──────────────────────────────────────────────────

  app.get("/api/waitlists/counts", async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT court_id AS "courtId", COUNT(*) AS count FROM waitlists GROUP BY court_id`
      );
      const counts: Record<string, number> = {};
      for (const row of result.rows) {
        counts[row.courtId] = parseInt(row.count, 10);
      }
      res.json(counts);
    } catch (err) {
      console.error("GET /api/waitlists/counts error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/waitlists/:courtId", async (req: Request, res: Response) => {
    const { courtId } = req.params;
    try {
      const result = await pool.query(
        `SELECT user_id AS "userId", username, skill_level AS "skillLevel", joined_at AS "timestamp", position
         FROM waitlists WHERE court_id = $1 ORDER BY position ASC`,
        [courtId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Waitlist fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/waitlists/:courtId/join", async (req: Request, res: Response) => {
    const { courtId } = req.params;
    const { userId, username, skillLevel } = req.body;
    if (!userId || !username) return res.status(400).json({ message: "userId and username required" });
    try {
      // One waitlist at a time: check if already on any OTHER court's waitlist
      const existingWaitlist = await pool.query(
        `SELECT court_id FROM waitlists WHERE user_id = $1 AND court_id != $2 LIMIT 1`,
        [userId, courtId]
      );
      if (existingWaitlist.rows.length > 0) {
        return res.status(409).json({
          message: "You're already on a waitlist. Leave your current waitlist before joining another.",
          code: "already_on_waitlist",
          currentCourtId: existingWaitlist.rows[0].court_id,
        });
      }
      const countRes = await pool.query(
        `SELECT COUNT(*) AS count FROM waitlists WHERE court_id = $1`,
        [courtId]
      );
      const position = parseInt(countRes.rows[0].count) + 1;
      await pool.query(
        `INSERT INTO waitlists (court_id, user_id, username, skill_level, position)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (court_id, user_id) DO NOTHING`,
        [courtId, userId, username, skillLevel ?? "Intermediate", position]
      );
      const list = await pool.query(
        `SELECT user_id AS "userId", username, skill_level AS "skillLevel", joined_at AS "timestamp", position
         FROM waitlists WHERE court_id = $1 ORDER BY position ASC`,
        [courtId]
      );
      res.status(201).json(list.rows);
    } catch (err) {
      console.error("Waitlist join error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/waitlists/:courtId/leave", async (req: Request, res: Response) => {
    const { courtId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId required" });
    try {
      const leavingRow = await pool.query(
        `SELECT position FROM waitlists WHERE court_id = $1 AND user_id = $2`,
        [courtId, userId]
      );
      if (leavingRow.rows.length === 0) return res.json({ ok: true });

      const leavingPosition = leavingRow.rows[0].position;

      await pool.query(
        `DELETE FROM waitlists WHERE court_id = $1 AND user_id = $2`,
        [courtId, userId]
      );

      await pool.query(
        `UPDATE waitlists SET position = position - 1
         WHERE court_id = $1 AND position > $2`,
        [courtId, leavingPosition]
      );

      const courtRes = await pool.query(`SELECT name FROM courts WHERE id = $1`, [courtId]);
      const courtName = courtRes.rows[0]?.name ?? "the court";

      const promoted = await pool.query(
        `SELECT w.user_id, u.push_token, w.position
         FROM waitlists w
         JOIN users u ON u.user_id = w.user_id
         WHERE w.court_id = $1 AND w.position <= $2 AND u.push_token IS NOT NULL`,
        [courtId, leavingPosition]
      );

      for (const row of promoted.rows) {
        const pos = row.position;
        const title = pos === 1 ? "You're next! 🏀" : `Waitlist update`;
        const body = pos === 1
          ? `You're first in line at ${courtName}!`
          : `You moved up to #${pos} at ${courtName}`;
        sendPushNotifications([row.push_token], title, body, { courtId });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("Waitlist leave error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Admin page & auth ──────────────────────────────────────────────────────

  const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

  app.get("/admin", (_req: Request, res: Response) => {
    const adminPath = path.resolve(process.cwd(), "server", "templates", "admin.html");
    res.status(200).send(fs.readFileSync(adminPath, "utf-8"));
  });

  app.post("/api/admin/verify", (req: Request, res: Response) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = failedAttempts.get(ip);

    if (record && record.lockedUntil > now) {
      const secs = Math.ceil((record.lockedUntil - now) / 1000);
      return res.status(429).json({ message: `Too many failed attempts. Try again in ${secs}s.` });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    const provided = req.body?.adminPassword;

    if (!adminPassword || provided !== adminPassword) {
      const prev = failedAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
      const count = prev.count + 1;
      const lockedUntil = count >= 5 ? now + 15 * 60 * 1000 : 0;
      failedAttempts.set(ip, { count, lockedUntil });
      return res.status(403).json({ message: "Incorrect password." });
    }

    failedAttempts.delete(ip);
    res.json({ ok: true });
  });

  // ── Courts (public) ────────────────────────────────────────────────────────

  app.get("/api/courts", async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT id, name, short_name AS "shortName", address, city, state,
                COALESCE(state_abbr, '') AS "stateAbbr", country,
                latitude, longitude, type, surface, hoops, description,
                base_players_playing AS "basePlayersPlaying", max_players AS "maxPlayers"
         FROM courts ORDER BY state, city, name`
      );
      res.set("Cache-Control", "no-store");
      res.json(result.rows);
    } catch (err) {
      console.error("Fetch courts error:", err);
      res.status(500).json({ message: "Failed to fetch courts" });
    }
  });

  // ── Courts admin (password protected) ──────────────────────────────────────

  function checkAdminPassword(req: Request, res: Response): boolean {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const provided = req.headers["x-admin-password"] || req.body?.adminPassword;
    if (!adminPassword || provided !== adminPassword) {
      res.status(403).json({ message: "Forbidden" });
      return false;
    }
    return true;
  }

  function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  app.post("/api/admin/courts", async (req: Request, res: Response) => {
    if (!checkAdminPassword(req, res)) return;
    const { name, shortName, address, city, state, country, latitude, longitude, type, surface, hoops, description, basePlayersPlaying, maxPlayers } = req.body;
    if (!name || !shortName || !address || !city || !latitude || !longitude || !type || !surface || !description) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const id = slugify(name) + "-" + Date.now().toString(36);
    try {
      const result = await pool.query(
        `INSERT INTO courts (id, name, short_name, address, city, state, country, latitude, longitude, type, surface, hoops, description, base_players_playing, max_players)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [id, name, shortName, address, city, state ?? "CA", country ?? "US", latitude, longitude, type, surface, hoops ?? 2, description, basePlayersPlaying ?? 5, maxPlayers ?? 10]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Create court error:", err);
      res.status(500).json({ message: "Failed to create court" });
    }
  });

  app.put("/api/admin/courts/:id", async (req: Request, res: Response) => {
    if (!checkAdminPassword(req, res)) return;
    const { name, shortName, address, city, state, country, latitude, longitude, type, surface, hoops, description, basePlayersPlaying, maxPlayers } = req.body;
    try {
      const result = await pool.query(
        `UPDATE courts SET name=$1, short_name=$2, address=$3, city=$4, state=$5, country=$6,
         latitude=$7, longitude=$8, type=$9, surface=$10, hoops=$11, description=$12,
         base_players_playing=$13, max_players=$14
         WHERE id=$15 RETURNING *`,
        [name, shortName, address, city, state ?? "CA", country ?? "US", latitude, longitude, type, surface, hoops ?? 2, description, basePlayersPlaying ?? 5, maxPlayers ?? 10, req.params.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ message: "Court not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Update court error:", err);
      res.status(500).json({ message: "Failed to update court" });
    }
  });

  app.delete("/api/admin/courts/:id", async (req: Request, res: Response) => {
    if (!checkAdminPassword(req, res)) return;
    try {
      const result = await pool.query("DELETE FROM courts WHERE id=$1", [req.params.id]);
      if (result.rowCount === 0) return res.status(404).json({ message: "Court not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("Delete court error:", err);
      res.status(500).json({ message: "Failed to delete court" });
    }
  });

  // ── Court messages ─────────────────────────────────────────────────────────

  app.get("/api/courts/:id/messages", (req: Request, res: Response) => {
    res.json(getMessages(req.params.id));
  });

  app.post("/api/courts/:id/messages", (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId, username, skillLevel, text } = req.body;
    if (!userId || !username || !text || typeof text !== "string") {
      return res.status(400).json({ message: "userId, username, and text are required" });
    }
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 200) {
      return res.status(400).json({ message: "Message must be 1–200 characters" });
    }
    if (containsProfanity(trimmed)) {
      return res.status(422).json({ message: "Your message contains language that isn't allowed. Keep it clean." });
    }
    const msg: CourtMessage = {
      id: generateId(),
      courtId: id,
      userId,
      username,
      skillLevel: skillLevel ?? "Intermediate",
      text: trimmed,
      timestamp: Date.now(),
    };
    addMessage(msg);
    res.status(201).json(msg);
  });

  app.delete("/api/courts/:courtId/messages/:msgId", (req: Request, res: Response) => {
    const { courtId, msgId } = req.params;
    const { userId } = req.body;
    const messages = getMessages(courtId);
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    if (msg.userId !== userId) return res.status(403).json({ message: "Not your message" });
    courtMessages.set(courtId, messages.filter((m) => m.id !== msgId));
    res.json({ success: true });
  });

  // ── Social Feed ──────────────────────────────────────────────────────────────

  app.get("/api/feed/:userId", async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        `SELECT p.*,
          COUNT(DISTINCT pl.user_id)::int AS like_count,
          COUNT(DISTINCT pc.id)::int AS comment_count,
          BOOL_OR(pl.user_id = $1) AS user_liked
         FROM posts p
         LEFT JOIN post_likes pl ON pl.post_id = p.id
         LEFT JOIN post_comments pc ON pc.post_id = p.id
         WHERE p.user_id = $1
           OR p.user_id IN (
             SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END
             FROM friendships
             WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'
           )
         GROUP BY p.id
         ORDER BY p.created_at DESC
         LIMIT 50`,
        [userId]
      );
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          username: r.username,
          avatarBase64: r.avatar_base64,
          imageBase64: r.image_base64,
          imageUrl: r.image_url ?? null,
          caption: r.caption,
          courtId: r.court_id,
          courtName: r.court_name,
          createdAt: r.created_at,
          likeCount: r.like_count,
          commentCount: r.comment_count,
          userLiked: r.user_liked ?? false,
        }))
      );
    } catch (err) {
      console.error("Feed fetch error:", err);
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  app.post("/api/posts", async (req: Request, res: Response) => {
    const { userId, username, avatarBase64, imageBase64, caption, courtId, courtName } = req.body;
    if (!userId || !username || !imageBase64) {
      return res.status(400).json({ message: "userId, username, and imageBase64 are required" });
    }
    if (caption && containsProfanity(caption)) {
      return res.status(422).json({ message: "Your caption contains language that isn't allowed. Keep it clean." });
    }
    const id = generateId();
    try {
      const imageUrl = await uploadImageToStorage(imageBase64, `${id}.jpg`);
      await pool.query(
        `INSERT INTO posts (id, user_id, username, avatar_base64, image_base64, image_url, caption, court_id, court_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, userId, username, avatarBase64 ?? null, imageUrl ? null : imageBase64, imageUrl, caption ?? null, courtId ?? null, courtName ?? null]
      );
      res.status(201).json({ id, userId, username, avatarBase64, imageBase64: imageUrl ? null : imageBase64, imageUrl, caption, courtId, courtName, likeCount: 0, commentCount: 0, userLiked: false, createdAt: new Date() });
    } catch (err) {
      console.error("Create post error:", err);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.delete("/api/posts/:postId", async (req: Request, res: Response) => {
    const { postId } = req.params;
    const { userId } = req.body;
    try {
      const check = await pool.query("SELECT user_id FROM posts WHERE id = $1", [postId]);
      if (check.rows.length === 0) return res.status(404).json({ message: "Post not found" });
      if (check.rows[0].user_id !== userId) return res.status(403).json({ message: "Not your post" });
      await pool.query("DELETE FROM post_likes WHERE post_id = $1", [postId]);
      await pool.query("DELETE FROM post_comments WHERE post_id = $1", [postId]);
      await pool.query("DELETE FROM posts WHERE id = $1", [postId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  app.post("/api/posts/:postId/like", async (req: Request, res: Response) => {
    const { postId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId required" });
    try {
      const existing = await pool.query(
        "SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2",
        [postId, userId]
      );
      if (existing.rows.length > 0) {
        await pool.query("DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2", [postId, userId]);
        res.json({ liked: false });
      } else {
        await pool.query("INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)", [postId, userId]);
        res.json({ liked: true });
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  app.get("/api/posts/:postId/comments", async (req: Request, res: Response) => {
    const { postId } = req.params;
    try {
      const result = await pool.query(
        "SELECT * FROM post_comments WHERE post_id = $1 ORDER BY created_at ASC",
        [postId]
      );
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          postId: r.post_id,
          userId: r.user_id,
          username: r.username,
          avatarBase64: r.avatar_base64,
          text: r.text,
          createdAt: r.created_at,
        }))
      );
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/posts/:postId/comments", async (req: Request, res: Response) => {
    const { postId } = req.params;
    const { userId, username, avatarBase64, text } = req.body;
    if (!userId || !username || !text) {
      return res.status(400).json({ message: "userId, username, and text are required" });
    }
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 300) return res.status(400).json({ message: "Comment must be 1–300 characters" });
    if (containsProfanity(trimmed)) {
      return res.status(422).json({ message: "Your comment contains language that isn't allowed. Keep it clean." });
    }
    const id = generateId();
    try {
      await pool.query(
        "INSERT INTO post_comments (id, post_id, user_id, username, avatar_base64, text) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, postId, userId, username, avatarBase64 ?? null, trimmed]
      );
      res.status(201).json({ id, postId, userId, username, avatarBase64, text: trimmed, createdAt: new Date() });
    } catch (err) {
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  app.delete("/api/posts/:postId/comments/:commentId", async (req: Request, res: Response) => {
    const { commentId } = req.params;
    const { userId } = req.body;
    try {
      const check = await pool.query("SELECT user_id FROM post_comments WHERE id = $1", [commentId]);
      if (check.rows.length === 0) return res.status(404).json({ message: "Comment not found" });
      if (check.rows[0].user_id !== userId) return res.status(403).json({ message: "Not your comment" });
      await pool.query("DELETE FROM post_comments WHERE id = $1", [commentId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

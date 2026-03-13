import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

// ─── Database ─────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function registerRoutes(app: Express): Promise<Server> {

  // ── Admin ─────────────────────────────────────────────────────────────────

  const ADMIN_USER_ID = "17731833451956z1lxkg";

  app.get("/api/admin/stats", async (req: Request, res: Response) => {
    const { userId } = req.query as { userId: string };
    if (userId !== ADMIN_USER_ID) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const [
        totalUsers,
        skillBreakdown,
        newToday,
        newThisWeek,
        totalFriendships,
        pendingRequests,
        totalDMs,
        recentUsers,
      ] = await Promise.all([
        pool.query("SELECT COUNT(*) AS count FROM users"),
        pool.query("SELECT skill_level, COUNT(*) AS count FROM users GROUP BY skill_level ORDER BY count DESC"),
        pool.query("SELECT COUNT(*) AS count FROM users WHERE created_at >= NOW() - INTERVAL '1 day'"),
        pool.query("SELECT COUNT(*) AS count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"),
        pool.query("SELECT COUNT(*) AS count FROM friendships WHERE status = 'accepted'"),
        pool.query("SELECT COUNT(*) AS count FROM friendships WHERE status = 'pending'"),
        pool.query("SELECT COUNT(*) AS count FROM direct_messages"),
        pool.query("SELECT username, skill_level, email, created_at FROM users ORDER BY created_at DESC LIMIT 10"),
      ]);
      res.json({
        totalUsers: parseInt(totalUsers.rows[0].count),
        skillBreakdown: skillBreakdown.rows,
        newToday: parseInt(newToday.rows[0].count),
        newThisWeek: parseInt(newThisWeek.rows[0].count),
        totalFriendships: parseInt(totalFriendships.rows[0].count),
        pendingRequests: parseInt(pendingRequests.rows[0].count),
        totalDMs: parseInt(totalDMs.rows[0].count),
        totalCourts: 164,
        recentUsers: recentUsers.rows,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ── Users ──────────────────────────────────────────────────────────────────

  app.post("/api/users", async (req: Request, res: Response) => {
    const { userId, username, email, skillLevel } = req.body;
    if (!userId || !username || !email) {
      return res.status(400).json({ message: "userId, username, and email are required" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }
    try {
      const result = await pool.query(
        `INSERT INTO users (user_id, username, email, skill_level, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET username = EXCLUDED.username, email = EXCLUDED.email,
           skill_level = EXCLUDED.skill_level, updated_at = NOW()
         RETURNING *`,
        [userId, username.trim(), email.trim().toLowerCase(), skillLevel ?? "Intermediate"]
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
        `SELECT u.user_id, u.username, u.skill_level,
           f.status AS friendship_status,
           f.requester_id AS friendship_requester
         FROM users u
         LEFT JOIN friendships f
           ON (f.requester_id = u.user_id AND f.addressee_id = $2)
           OR (f.addressee_id = u.user_id AND f.requester_id = $2)
         WHERE u.username ILIKE $1 AND u.user_id != $2
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
      const result = await pool.query("SELECT * FROM users WHERE user_id = $1", [userId]);
      if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("User fetch error:", err);
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
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("DM send error:", err);
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
        `SELECT id, name, short_name AS "shortName", address, city, state, country,
                latitude, longitude, type, surface, hoops, description,
                base_players_playing AS "basePlayersPlaying", max_players AS "maxPlayers"
         FROM courts ORDER BY city, name`
      );
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

  const httpServer = createServer(app);
  return httpServer;
}

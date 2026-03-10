import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { Pool } from "pg";

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

  // ── User registration / upsert ─────────────────────────────────────────────

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
         DO UPDATE SET
           username = EXCLUDED.username,
           email = EXCLUDED.email,
           skill_level = EXCLUDED.skill_level,
           updated_at = NOW()
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

  app.get("/api/users/:userId", async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        "SELECT * FROM users WHERE user_id = $1",
        [userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error("User fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Court messages ─────────────────────────────────────────────────────────

  app.get("/api/courts/:id/messages", (req: Request, res: Response) => {
    const { id } = req.params;
    res.json(getMessages(id));
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
    const filtered = messages.filter((m) => m.id !== msgId);
    courtMessages.set(courtId, filtered);
    res.json({ success: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}

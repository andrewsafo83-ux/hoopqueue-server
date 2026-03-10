import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

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

export async function registerRoutes(app: Express): Promise<Server> {

  app.get("/api/courts/:id/messages", (req: Request, res: Response) => {
    const { id } = req.params;
    const messages = getMessages(id);
    res.json(messages);
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

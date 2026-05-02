import { Router } from "express";
import { requireAuth, requireAdmin, AuthRequest } from "../middlewares/auth";
import { getSettings, updateSettings, drainQueue } from "../lib/assignment";
import type { Server as IOServer } from "socket.io";

const router = Router();

router.get("/settings", requireAuth, async (_req, res) => {
  const settings = await getSettings();
  res.json(settings);
});

router.put("/settings", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { maxChatsPerAgent, autoAssign, assignmentStrategy } = req.body ?? {};
  const patch: Record<string, unknown> = {};

  if (maxChatsPerAgent !== undefined) {
    const n = Number(maxChatsPerAgent);
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      res.status(400).json({ error: "maxChatsPerAgent must be between 1 and 100" });
      return;
    }
    patch.maxChatsPerAgent = n;
  }

  if (autoAssign !== undefined) patch.autoAssign = !!autoAssign;

  if (assignmentStrategy !== undefined) {
    if (!["round_robin", "least_busy"].includes(assignmentStrategy)) {
      res.status(400).json({ error: "assignmentStrategy must be 'round_robin' or 'least_busy'" });
      return;
    }
    patch.assignmentStrategy = assignmentStrategy;
  }

  const updated = await updateSettings(patch);

  // If auto-assign was enabled / capacity raised, drain the queue immediately.
  const io = req.app.get("io") as IOServer | undefined;
  if (updated.autoAssign) {
    void drainQueue(io);
  }

  res.json(updated);
});

export default router;

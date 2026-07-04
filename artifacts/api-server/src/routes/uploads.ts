import { Router } from "express";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const MAX_BYTES = 500_000;
const ALLOWED_PREFIXES = ["data:image/", "data:application/pdf", "data:text/plain"];

router.post("/uploads", requireAuth, async (req, res) => {
  const { dataUrl, filename } = req.body ?? {};
  if (!dataUrl || typeof dataUrl !== "string") {
    res.status(400).json({ error: "dataUrl is required" });
    return;
  }
  if (dataUrl.length > MAX_BYTES) {
    res.status(400).json({ error: "File too large (max ~500KB)" });
    return;
  }
  if (!ALLOWED_PREFIXES.some((p) => dataUrl.startsWith(p))) {
    res.status(400).json({ error: "Unsupported file type. Use image, PDF, or plain text." });
    return;
  }

  res.status(201).json({
    url: dataUrl,
    filename: typeof filename === "string" ? filename : "attachment",
  });
});

export default router;

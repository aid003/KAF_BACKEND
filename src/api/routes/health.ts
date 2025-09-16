// src/api/routes/health.ts
import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({ status: "ok", message: "Сервер работает" });
});

export default router;

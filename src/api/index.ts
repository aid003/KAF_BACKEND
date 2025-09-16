import { Router } from "express";
import healthRoutes from "./routes/health";
import uploadRoutes from "./routes/upload";
import crudRoutes from "./routes/crud";

const router = Router();

router.use("/", healthRoutes);
router.use("/", uploadRoutes);
router.use("/api", crudRoutes);

export { router };

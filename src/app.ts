import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "./services/utils/logger";
import { router } from "./api";
import logRequests from "./api/middlewares/logRequests";

dotenv.config();

const app = express();
app.use(express.json());
app.use(logRequests);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(router);

app.use((req, res) => {
  res.status(404).json({ error: "Маршрут не найден" });
});

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error(`Ошибка сервера: ${err.message}`);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
);

export default app;

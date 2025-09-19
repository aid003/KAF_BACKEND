import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "./services/utils/logger";
import { router } from "./api";
import logRequests from "./api/middlewares/logRequests";

dotenv.config();

const app: express.Application = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(logRequests);

// Допустимые origins для Express API
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3005',
  'http://127.0.0.1:3005',
  'http://localhost:5041',
  'http://127.0.0.1:5041',
  'http://192.168.63.222:3000', 
  'http://192.168.63.222:3005', 
  'http://192.168.63.222:5041',
  'http://192.168.63.222',
  'http://192.168.63.222:80'
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Socket-ID"],
    credentials: true,
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

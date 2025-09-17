import app from "./app";
import dotenv from "dotenv";
import logger from "./services/utils/logger";
import http from "http";
import { Server } from "socket.io";
import { searchHybrids, searchKeyword, searchSimilarity } from "./socket/crud";
import { askQuestion } from "./services/ollama";

dotenv.config();

const PORT = process.env.PORT || 5041;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "owl/t-lite";

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on(
    "chat message",
    async (payload: { text: string; searchType?: string }) => {
      logger.info(
        `Получено сообщение от ${socket.id}: ${payload.text} - ${payload.searchType}`
      );

      let data = { text: "Ищу похожую информацию" };
      io.emit("loading answer", data);
      await delay(3000);

      switch (payload.searchType) {
        case "1":
          const answer1 = await searchHybrids({ queryText: payload.text });
          io.emit("loading answer", { text: "Генерирую ответ" });
          await delay(2000);
          const llmAnswer1 = await askQuestion(
            payload.text,
            answer1 ? answer1 : [],
            socket.id,
            OLLAMA_MODEL
          );
          io.emit(
            "chat message",
            llmAnswer1 ? llmAnswer1 : "Не удалось найти информацию."
          );
          break;
        case "2":
          const answer2 = await searchSimilarity({ queryText: payload.text });
          io.emit("loading answer", { text: "Генерирую ответ" });
          await delay(2000);
          const llmAnswer2 = await askQuestion(
            payload.text,
            answer2 ? answer2 : [],
            socket.id,
            OLLAMA_MODEL
          );
          io.emit(
            "chat message",
            llmAnswer2 ? llmAnswer2 : "Не удалось найти информацию."
          );
          break;
        case "3":
          const answer3 = await searchKeyword({ queryText: payload.text });
          io.emit("loading answer", { text: "Генерирую ответ" });
          await delay(2000);
          const llmAnswer3 = await askQuestion(
            payload.text,
            answer3 ? answer3 : [],
            socket.id,
            OLLAMA_MODEL
          );
          io.emit(
            "chat message",
            llmAnswer3 ? llmAnswer3 : "Не удалось найти информацию."
          );
          break;
        default:
          io.emit(
            "chat message",
            "Что-то пошло не так. Перезагрузите страницу (CTRL + F5)."
          );
          break;
      }
    }
  );

  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(Number(PORT), "0.0.0.0", undefined, () => {
  logger.info(`🚀 Сервер запущен на порту:${PORT}`);
});

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

// Допустимые origins — можно добавить IP сервера и другие хосты
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3005',
  'http://127.0.0.1:3005',
  'http://localhost:5041',
  'http://127.0.0.1:5041',
  'http://192.168.63.222:3000', 
  'http://192.168.63.222:3005', 
  'http://192.168.63.222:5041',
  'http://192.168.63.222' 
]);

function originIsAllowed(origin?: string | null) {
  if (!origin) return true; // allow non-browser (curl, internal)
  if (allowedOrigins.has(origin)) return true;
  // разрешить любую 192.168.*.* подсеть (если нужно)
  try {
    const u = new URL(origin);
    if (u.hostname.startsWith('192.168.')) return true;
  } catch (e) {}
  return false;
}

export const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (originIsAllowed(origin)) callback(null, true);
      else callback(new Error('Origin not allowed by CORS'), false);
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
});

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on(
    "chat message",
    async (payload: { 
      text: string; 
      searchType: string; 
      useRAG: boolean; 
      history: Array<{
        sender: "assistant" | "user";
        text: string;
        searchType?: string;
        useRAG?: boolean;
      }>;
    }) => {
      logger.info(
        `Получено сообщение от ${socket.id}: ${payload.text} - ${payload.searchType} - useRAG: ${payload.useRAG} - history: ${payload.history.length} сообщений`
      );

      // Если useRAG отключен, отвечаем напрямую без поиска
      if (!payload.useRAG) {
        io.emit("loading answer", { text: "Генерирую ответ без поиска" });
        await delay(1000);
        
        const directAnswer = await askQuestion(
          payload.text,
          [], // Пустой массив для прямого ответа
          socket.id,
          OLLAMA_MODEL,
          payload.history // Передаем историю для контекста
        );
        
        io.emit(
          "chat message",
          directAnswer ? directAnswer : "Не удалось сгенерировать ответ."
        );
        return;
      }

      // RAG поиск включен
      let data = { text: "Ищу похожую информацию" };
      io.emit("loading answer", data);
      await delay(3000);

      let searchResults: any[] = [];

      switch (payload.searchType) {
        case "1":
          searchResults = (await searchHybrids({ queryText: payload.text })) || [];
          break;
        case "2":
          searchResults = (await searchSimilarity({ queryText: payload.text })) || [];
          break;
        case "3":
          searchResults = (await searchKeyword({ queryText: payload.text })) || [];
          break;
        default:
          io.emit(
            "chat message",
            "Неизвестный тип поиска. Используйте 1, 2 или 3."
          );
          return;
      }

      io.emit("loading answer", { text: "Генерирую ответ на основе найденной информации" });
      await delay(2000);
      
      const llmAnswer = await askQuestion(
        payload.text,
        searchResults ? searchResults : [],
        socket.id,
        OLLAMA_MODEL,
        payload.history // Передаем историю для контекста
      );
      
      io.emit(
        "chat message",
        llmAnswer ? llmAnswer : "Не удалось найти информацию."
      );
    }
  );

  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(Number(PORT), "0.0.0.0", undefined, () => {
  logger.info(`🚀 Сервер запущен на порту:${PORT}`);
});

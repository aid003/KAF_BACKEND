import { Request, Response, NextFunction } from "express";
import { io } from "../../server";

// Расширяем интерфейс Request для добавления socket
declare global {
  namespace Express {
    interface Request {
      socket?: any;
    }
  }
}

export const socketMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Получаем socket ID из заголовков или query параметров
  const socketId = req.headers['x-socket-id'] || req.query.socketId;
  
  console.log("SocketMiddleware: Получен запрос с socket ID:", socketId);
  console.log("SocketMiddleware: Доступные sockets:", Array.from(io.sockets.sockets.keys()));
  
  if (socketId && io) {
    // Находим socket по ID
    const socket = io.sockets.sockets.get(socketId as string);
    if (socket) {
      console.log("SocketMiddleware: Socket найден и привязан к запросу");
      req.socket = socket as any;
    } else {
      console.log("SocketMiddleware: Socket не найден по ID:", socketId);
    }
  } else {
    console.log("SocketMiddleware: Socket ID не предоставлен или io недоступен");
  }
  
  next();
};

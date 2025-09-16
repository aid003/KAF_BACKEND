// src/api/routes/upload.ts
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import dotenv from "dotenv";
import { bookDownload } from "../../services/utils/fragmentTextClient";
import logger from "../../services/utils/logger";
import { socketMiddleware } from "../middlewares/socketMiddleware";

dotenv.config();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads/";
const MAX_FILE_SIZE =
  parseInt(process.env.MAX_FILE_SIZE || "50", 10) * 1024 * 1024;

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: MAX_FILE_SIZE },
});

const router = Router();

router.post(
  "/uploads",
  socketMiddleware,
  (req: Request, res: Response, next: NextFunction) => {
    console.log("Начинаем загрузку файла, размер:", req.headers['content-length']);
    upload.array("files")(req, res, function (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        console.log("Файл слишком большой:", err.message);
        return res.status(400).json({
          error: `Размер файла превышает допустимые ${
            MAX_FILE_SIZE / (1024 * 1024)
          }MB`,
        });
      } else if (err) {
        console.log("Ошибка Multer:", err.message);
        logger.error(`Ошибка при загрузке файла: ${err.message}`);
        return res
          .status(500)
          .json({ error: "Ошибка сервера при загрузке файла" });
      }
      console.log("Файл успешно загружен, переходим к обработке");
      next();
    });
  },
  (req: Request, res: Response, next: NextFunction) => {
    bookDownload(req, res, next, req.socket);
  }
);

export default router;

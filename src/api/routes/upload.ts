// src/api/routes/upload.ts
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import dotenv from "dotenv";
import { bookDownload } from "../../services/utils/fragmentTextClient";
import logger from "../../services/utils/logger";

dotenv.config();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads/";
const MAX_FILE_SIZE =
  parseInt(process.env.MAX_FILE_SIZE || "20", 10) * 1024 * 1024;

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: MAX_FILE_SIZE },
});

const router = Router();

router.post(
  "/upload-book",
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("book")(req, res, function (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: `Размер файла превышает допустимые ${
            MAX_FILE_SIZE / (1024 * 1024)
          }MB`,
        });
      } else if (err) {
        logger.error(`Ошибка при загрузке файла: ${err.message}`);
        return res
          .status(500)
          .json({ error: "Ошибка сервера при загрузке файла" });
      }
      next();
    });
  },
  bookDownload
);

export default router;

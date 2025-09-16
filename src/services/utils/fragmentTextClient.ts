import { Request, Response, NextFunction } from "express";
import fs from "fs";
import logger from "./logger";
import { processPdfFile } from "./fragmentText";

export async function bookDownload(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "Файл не загружен" });
      logger.error("Файл не загружен");
      return;
    }
    const { title, author, publishedYear, language } = req.body;
    if (!title || !author || !publishedYear || !language) {
      res.status(400).json({ message: "Не заполнены все метаданные" });
      logger.error("Не заполнены все метаданные");
      return;
    }
    await processPdfFile(file.path, {
      title,
      author,
      publishedYear: Number(publishedYear),
      language,
    });
    fs.unlinkSync(file.path);
    res.status(200).json({
      message: "Книга успешно обработана и загружена в векторную БД",
    });
    logger.info("Книга успешно обработана и загружена в векторную БД");
  } catch (error) {
    logger.error("Ошибка при обработке файла:", error);
    next(new Error("Ошибка при обработке файла"));
    res.status(500).json("см. ошибку на серверных логах");
  }
}

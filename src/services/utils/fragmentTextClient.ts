import { Request, Response, NextFunction } from "express";
import fs from "fs";
import logger from "./logger";
import { processPdfFile } from "./fragmentText";

export async function bookDownload(
  req: Request,
  res: Response,
  next: NextFunction,
  socket?: any
): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ message: "Файлы не загружены" });
      logger.error("Файлы не загружены");
      return;
    }

    const results = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Отправляем событие о начале обработки файла
        if (socket) {
          const eventData = {
            type: "file_start",
            filename: file.originalname,
            fileIndex: i + 1,
            totalFiles: files.length,
            progress: Math.round((i / files.length) * 100)
          };
          console.log("Отправляем событие file_start:", eventData);
          socket.emit("upload_progress", eventData);
        } else {
          console.log("Socket недоступен для отправки события file_start");
        }

        // Для каждого файла генерируем базовые метаданные, если они не переданы
        const { title, author, publishedYear, language } = req.body;
        const fileMetadata = {
          title: title || file.originalname.replace(/\.[^/.]+$/, ""), // Убираем расширение из имени файла
          author: author || "Неизвестный автор",
          publishedYear: publishedYear ? Number(publishedYear) : new Date().getFullYear(),
          language: language || "ru",
        };

        // Отправляем событие о начале обработки PDF
        if (socket) {
          const eventData = {
            type: "processing_start",
            filename: file.originalname,
            message: "Начинаю обработку PDF файла..."
          };
          console.log("Отправляем событие processing_start:", eventData);
          socket.emit("upload_progress", eventData);
        }

        await processPdfFile(file.path, fileMetadata);
        fs.unlinkSync(file.path);
        
        results.push({
          filename: file.originalname,
          status: "success",
          message: "Файл успешно обработан"
        });
        
        // Отправляем событие о завершении обработки файла
        if (socket) {
          socket.emit("upload_progress", {
            type: "file_complete",
            filename: file.originalname,
            fileIndex: i + 1,
            totalFiles: files.length,
            progress: Math.round(((i + 1) / files.length) * 100)
          });
        }
        
        logger.info(`Файл ${file.originalname} успешно обработан и загружен в векторную БД`);
      } catch (fileError) {
        logger.error(`Ошибка при обработке файла ${file.originalname}:`, fileError);
        // Удаляем файл даже в случае ошибки
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          logger.error(`Ошибка при удалении файла ${file.path}:`, unlinkError);
        }
        
        results.push({
          filename: file.originalname,
          status: "error",
          message: "Ошибка при обработке файла"
        });
      }
    }

    const successCount = results.filter(r => r.status === "success").length;
    const errorCount = results.filter(r => r.status === "error").length;

    // Отправляем событие о завершении всей обработки
    if (socket) {
      const eventData = {
        type: "all_complete",
        successCount,
        errorCount,
        results,
        message: `Обработано файлов: ${successCount} успешно, ${errorCount} с ошибками`
      };
      console.log("Отправляем событие all_complete:", eventData);
      socket.emit("upload_progress", eventData);
    } else {
      console.log("Socket недоступен для отправки события all_complete");
    }

    res.status(200).json({
      message: `Обработано файлов: ${successCount} успешно, ${errorCount} с ошибками`,
      results: results,
      supportsProgress: true // Указываем, что сервер поддерживает прогресс
    });
    
    logger.info(`Обработка завершена: ${successCount} успешно, ${errorCount} с ошибками`);
  } catch (error) {
    logger.error("Ошибка при обработке файлов:", error);
    next(new Error("Ошибка при обработке файлов"));
    res.status(500).json("см. ошибку на серверных логах");
  }
}

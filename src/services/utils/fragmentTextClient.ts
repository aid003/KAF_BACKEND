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

    // Отправляем немедленный ответ клиенту, чтобы не блокировать интерфейс
    res.status(200).json({ 
      message: "Файлы загружены, начинаю обработку...", 
      supportsProgress: true,
      filesCount: files.length
    });

    // Обрабатываем файлы асинхронно в фоне
    processFilesAsync(files, req.body, socket);
    
  } catch (error) {
    logger.error("Ошибка при обработке загрузки:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Ошибка сервера при обработке файлов" });
    }
  }
}

// Асинхронная функция для обработки файлов в фоне
async function processFilesAsync(
  files: Express.Multer.File[],
  metadata: any,
  socket?: any
): Promise<void> {
  const results = [];
  const MAX_CONCURRENT_FILES = 3; // Максимум 3 файла одновременно
  
  // Разбиваем файлы на батчи для параллельной обработки
  const batches = [];
  for (let i = 0; i < files.length; i += MAX_CONCURRENT_FILES) {
    batches.push(files.slice(i, i + MAX_CONCURRENT_FILES));
  }
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    // Обрабатываем файлы в батче параллельно
    const batchPromises = batch.map(async (file, fileIndexInBatch) => {
      const globalFileIndex = batchIndex * MAX_CONCURRENT_FILES + fileIndexInBatch + 1;
      
      try {
        // Отправляем событие о начале обработки файла
        if (socket) {
          const eventData = {
            type: "file_start",
            filename: file.originalname,
            fileIndex: globalFileIndex,
            totalFiles: files.length,
            progress: Math.round(((globalFileIndex - 1) / files.length) * 100)
          };
          console.log("Отправляем событие file_start:", eventData);
          socket.emit("upload_progress", eventData);
        } else {
          console.log("Socket недоступен для отправки события file_start");
        }

        // Для каждого файла генерируем базовые метаданные, если они не переданы
        const { title, author, publishedYear, language } = metadata;
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

        await processPdfFile(file.path, fileMetadata, socket);
        fs.unlinkSync(file.path);
        
        
        // Отправляем событие о завершении обработки файла
        if (socket) {
          socket.emit("upload_progress", {
            type: "file_complete",
            filename: file.originalname,
            fileIndex: globalFileIndex,
            totalFiles: files.length,
            progress: Math.round((globalFileIndex / files.length) * 100)
          });
        }
        
        logger.info(`Файл ${file.originalname} успешно обработан и загружен в векторную БД`);
        return {
          filename: file.originalname,
          status: "success",
          message: "Файл успешно обработан"
        };
      } catch (fileError) {
        logger.error(`Ошибка при обработке файла ${file.originalname}:`, fileError);
        // Удаляем файл даже в случае ошибки
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          logger.error(`Ошибка при удалении файла ${file.path}:`, unlinkError);
        }
        
        return {
          filename: file.originalname,
          status: "error",
          message: "Ошибка при обработке файла"
        };
      }
    });
    
    // Ждем завершения всех файлов в батче
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Небольшая пауза между батчами для снижения нагрузки
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

    const successCount = results.filter(r => r.status === "success").length;
    const errorCount = results.filter(r => r.status === "error").length;

  // Отправляем событие о завершении всей обработки
  if (socket) {
    // Добавляем задержку перед отправкой финального события
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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

  logger.info(`Обработка завершена: ${successCount} успешно, ${errorCount} с ошибками`);
}

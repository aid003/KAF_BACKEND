// parseBooks.ts
import path from "path";
import fs from "fs";
import { processPdf } from "./fragmentText";
import logger from "./logger";

// Функция для обработки книг из папки
async function processBooksFromFolder(folderPath: string): Promise<void> {
  const files = fs.readdirSync(folderPath);
  logger.info(`Найдено ${files.length} книг.`);
  for (const file of files) {
    if (file.toLowerCase().endsWith(".pdf")) {
      const pdfPath = path.join(folderPath, file);

      const meta = {
        title: path.basename(file, ".pdf"),
        author: "Unknown",
        publishedYear: new Date().getFullYear(),
        language: "ru",
      };
      console.log(`Начало обработки файла: ${file}`);
      await processPdf(
        pdfPath,
        meta.title,
        meta.author,
        meta.publishedYear,
        meta.language
      );
    }
  }
}

export async function startLocalProcess() {
  const booksFolder = path.join(__dirname, "books");

  if (fs.existsSync(booksFolder)) {
    processBooksFromFolder(booksFolder)
      .then(() => logger.info("Обработка книг из папки завершена"))
      .catch((err) => logger.error("Ошибка при обработке книг из папки:", err));
  } else {
    logger.error("Папка с книгами не найдена");
  }
}

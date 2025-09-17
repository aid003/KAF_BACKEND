import { DocumentProcessor } from "../pdf";
import { DocumentMetadata } from "../../shared/types/pdf";
import logger from "./logger";

/**
 * Функция обработки PDF:
 * • Извлекает текст с сортировкой по вертикальной позиции, а при равенстве – по горизонтальной,
 *   что улучшает порядок строк даже в много-колоночных документах.
 * • Пропускает первые 3 страницы, если они содержат ненужную информацию (например, оглавление, ISBN, ©).
 * • Нормализует и очищает текст, разбивает его на предложения и формирует фрагменты с адаптивным перекрытием.
 * • Загружает каждый фрагмент через вызов addDocument.
 */
export const processPdf = async (
  pdfPath: string,
  title: string,
  author: string,
  publishedYear: number,
  language: string,
  socket?: any
): Promise<void> => {
  try {
    const metadata: DocumentMetadata = {
      title,
      author,
      publishedYear,
      language
    };

    const processor = new DocumentProcessor();
    await processor.processAndUploadPdf(pdfPath, metadata, socket);
    
  } catch (error) {
    logger.error(`Ошибка при обработке PDF: ${error}`);
    throw error;
  }
};

/**
 * Функция для обработки одного PDF-файла с метаданными
 */
export async function processPdfFile(
  pdfPath: string,
  meta: {
    title: string;
    author: string;
    publishedYear: number;
    language: string;
  },
  socket?: any
): Promise<void> {
  const metadata: DocumentMetadata = {
    title: meta.title,
    author: meta.author,
    publishedYear: meta.publishedYear,
    language: meta.language
  };

  const processor = new DocumentProcessor();
  await processor.processAndUploadPdf(pdfPath, metadata, socket);
}

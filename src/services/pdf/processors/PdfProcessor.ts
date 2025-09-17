import fs from "fs";
import * as pdfjsLib from "pdfjs-dist";
import { 
  DocumentMetadata, 
  PageProcessingResult, 
  PdfProcessingResult,
  ProcessingProgressEvent,
  PdfProcessingConfig 
} from '../../../shared/types/pdf';
import { TextNormalizer } from '../normalizers/TextNormalizer';
import { TextFragmenter } from '../fragmenters/TextFragmenter';
import logger from '../../utils/logger';

export class PdfProcessor {
  private readonly normalizer: TextNormalizer;
  private readonly fragmenter: TextFragmenter;
  private readonly config: PdfProcessingConfig;

  constructor(
    normalizer: TextNormalizer,
    fragmenter: TextFragmenter,
    config: PdfProcessingConfig
  ) {
    this.normalizer = normalizer;
    this.fragmenter = fragmenter;
    this.config = config;
  }

  /**
   * Обрабатывает одну страницу PDF
   */
  private async processPage(
    page: any,
    pageNum: number,
    totalPages: number,
    socket?: any
  ): Promise<PageProcessingResult> {
    try {
      const content = await page.getTextContent();

      // Сортировка элементов: сначала по вертикальной позиции (transform[5]),
      // при равенстве – по горизонтальной (transform[4]).
      const rawPageText = content.items
        .sort((a: any, b: any) =>
          a.transform[5] === b.transform[5]
            ? a.transform[4] - b.transform[4]
            : a.transform[5] - b.transform[5]
        )
        .map((item: any) => item.str)
        .join(" ");

      const pageText = rawPageText.trim();

      if (!pageText) {
        logger.info(`Страница ${pageNum}/${totalPages} пуста`);
        return {
          pageNumber: pageNum,
          totalPages,
          fragments: [],
          skipped: true
        };
      }

      // Пропускаем первые страницы, если они содержат ненужную информацию
      if (pageNum <= this.config.skipFirstPages && this.normalizer.isUnwantedPage(pageText)) {
        logger.info(
          `Пропускаем страницу ${pageNum}: вероятно, ненужная информация`
        );
        return {
          pageNumber: pageNum,
          totalPages,
          fragments: [],
          skipped: true
        };
      }

      logger.info(`Обрабатывается страница ${pageNum}/${totalPages}`);

      // Отправляем событие о прогрессе обработки страницы
      if (socket) {
        this.emitProgressEvent(socket, pageNum, totalPages);
      }

      // Нормализуем текст
      const normalizedText = this.normalizer.processText(pageText, this.config.normalizationConfig);
      
      // Разбиваем на предложения
      const sentences = this.normalizer.splitIntoSentences(normalizedText, this.config.normalizationConfig);
      
      // Создаем фрагменты
      const fragments = this.fragmenter.createFragments(normalizedText, sentences);

      return {
        pageNumber: pageNum,
        totalPages,
        fragments,
        skipped: false
      };

    } catch (error) {
      const errorMessage = `Ошибка при обработке страницы ${pageNum}: ${error}`;
      console.error(errorMessage);
      
      return {
        pageNumber: pageNum,
        totalPages,
        fragments: [],
        skipped: false,
        error: errorMessage
      };
    }
  }

  /**
   * Отправляет событие о прогрессе обработки
   */
  private async emitProgressEvent(socket: any, pageNum: number, totalPages: number): Promise<void> {
    const pageProgress = Math.round((pageNum / totalPages) * 100);
    const shouldEmit = pageNum % 5 === 0 || pageProgress % 10 === 0 || pageNum === totalPages;
    
    if (shouldEmit) {
      const eventData: ProcessingProgressEvent = {
        type: "vector_progress",
        filename: "PDF", // Будет заменено в вызывающем коде
        message: `Обрабатывается страница ${pageNum}/${totalPages}`,
        progress: pageProgress
      };
      
      console.log("Отправляем событие vector_progress:", eventData);
      socket.emit("upload_progress", eventData);
      
      // Добавляем небольшую задержку для лучшего UX
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Обрабатывает PDF файл
   */
  public async processPdf(
    pdfPath: string,
    metadata: DocumentMetadata,
    socket?: any
  ): Promise<PdfProcessingResult> {
    try {
      const data = new Uint8Array(fs.readFileSync(pdfPath));
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdfDocument = await loadingTask.promise;
      const totalPages = pdfDocument.numPages;

      logger.info(`Обработка PDF "${metadata.title}": найдено ${totalPages} страниц`);

      // Отправляем событие о начале загрузки в векторную базу данных
      if (socket) {
        const eventData: ProcessingProgressEvent = {
          type: "vector_start",
          filename: metadata.title,
          message: `Начинаю загрузку в векторную базу данных (${totalPages} страниц)`
        };
        console.log("Отправляем событие vector_start:", eventData);
        socket.emit("upload_progress", eventData);
      }

      const results: PageProcessingResult[] = [];
      let processedPages = 0;
      let skippedPages = 0;
      let totalFragments = 0;
      const errors: string[] = [];

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const result = await this.processPage(page, pageNum, totalPages, socket);
        
        results.push(result);
        
        if (result.skipped) {
          skippedPages++;
        } else {
          processedPages++;
          totalFragments += result.fragments.length;
        }
        
        if (result.error) {
          errors.push(result.error);
        }
      }

      // Отправляем событие о завершении загрузки в векторную базу данных
      if (socket) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const eventData: ProcessingProgressEvent = {
          type: "vector_complete",
          filename: metadata.title,
          message: `Загрузка в векторную базу данных завершена`,
          progress: 100
        };
        console.log("Отправляем событие vector_complete:", eventData);
        socket.emit("upload_progress", eventData);
      }

      logger.info(`✅ Обработка PDF "${metadata.title}" завершена`);

      return {
        totalPages,
        processedPages,
        skippedPages,
        totalFragments,
        errors
      };

    } catch (error) {
      const errorMessage = `Ошибка при открытии PDF ${pdfPath}: ${error}`;
      console.error(errorMessage);
      
      // Отправляем событие об ошибке
      if (socket) {
        const eventData: ProcessingProgressEvent = {
          type: "vector_error",
          filename: metadata.title,
          message: `Ошибка при загрузке в векторную базу данных: ${error}`
        };
        socket.emit("upload_progress", eventData);
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Получает фрагменты страницы для дальнейшей обработки
   */
  public async getPageFragments(
    pdfPath: string,
    pageNumber: number,
    metadata: DocumentMetadata
  ): Promise<string[]> {
    try {
      const data = new Uint8Array(fs.readFileSync(pdfPath));
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdfDocument = await loadingTask.promise;
      
      const page = await pdfDocument.getPage(pageNumber);
      const result = await this.processPage(page, pageNumber, pdfDocument.numPages);
      
      return result.fragments;
    } catch (error) {
      throw new Error(`Ошибка при получении фрагментов страницы ${pageNumber}: ${error}`);
    }
  }
}

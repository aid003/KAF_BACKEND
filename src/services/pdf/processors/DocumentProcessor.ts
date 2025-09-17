import { 
  DocumentMetadata, 
  Document, 
  PdfProcessingConfig,
  FragmentConfig,
  TextNormalizationConfig,
  AbbreviationMap,
  UnwantedPattern
} from '../../../shared/types/pdf';
import { TextNormalizer } from '../normalizers/TextNormalizer';
import { TextFragmenter } from '../fragmenters/TextFragmenter';
import { PdfProcessor } from './PdfProcessor';
import { addDocument } from '../../weaviate';
import logger from '../../utils/logger';

export class DocumentProcessor {
  private readonly pdfProcessor: PdfProcessor;
  private readonly normalizer: TextNormalizer;
  private readonly fragmenter: TextFragmenter;

  constructor(config?: Partial<PdfProcessingConfig>) {
    // Конфигурация по умолчанию
    const defaultConfig: PdfProcessingConfig = {
      skipFirstPages: 3,
      unwantedPatterns: [
        /оглавление/i,
        /содержание/i,
        /предисловие/i,
        /©/i,
        /ISBN/i,
        /все права защищены/i,
        /^\d+$/, // Страница, содержащая только цифры
      ],
      fragmentConfig: {
        chunkSize: 6,
        overlap: 1, // 15% от 6, минимум 1
        minFragmentLength: 50
      },
      normalizationConfig: {
        removeReferences: true,
        replaceAbbreviations: true,
        mergeIncompleteSentences: true,
        mergeListItems: true
      }
    };

    // Аббревиатуры по умолчанию
    const defaultAbbreviations: AbbreviationMap = {
      "г.": "г<<DOT>>",
      "т.д.": "т<<DOT>>д<<DOT>>",
      "и.о.": "и<<DOT>>о<<DOT>>",
    };

    // Объединяем конфигурацию
    const finalConfig = { ...defaultConfig, ...config };

    // Инициализируем компоненты
    this.normalizer = new TextNormalizer(
      defaultAbbreviations,
      finalConfig.unwantedPatterns
    );
    
    this.fragmenter = new TextFragmenter(finalConfig.fragmentConfig);
    
    this.pdfProcessor = new PdfProcessor(
      this.normalizer,
      this.fragmenter,
      finalConfig
    );
  }

  /**
   * Обрабатывает PDF файл и загружает фрагменты в векторную базу данных
   */
  public async processPdfFile(
    pdfPath: string,
    metadata: DocumentMetadata,
    socket?: any
  ): Promise<void> {
    try {
      const result = await this.pdfProcessor.processPdf(pdfPath, metadata, socket);
      
      logger.info(`Обработка завершена: ${result.processedPages} страниц обработано, ${result.totalFragments} фрагментов создано`);
      
      if (result.errors.length > 0) {
        logger.warn(`Обнаружены ошибки при обработке: ${result.errors.join(', ')}`);
      }

    } catch (error) {
      logger.error(`Ошибка при обработке PDF файла: ${error}`);
      throw error;
    }
  }

  /**
   * Обрабатывает PDF и возвращает фрагменты для загрузки в векторную базу
   */
  public async processPdfWithFragments(
    pdfPath: string,
    metadata: DocumentMetadata,
    socket?: any
  ): Promise<Document[]> {
    try {
      const data = new Uint8Array(require('fs').readFileSync(pdfPath));
      const loadingTask = require('pdfjs-dist').getDocument({ data });
      const pdfDocument = await loadingTask.promise;
      const totalPages = pdfDocument.numPages;

      const documents: Document[] = [];

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const fragments = await this.pdfProcessor.getPageFragments(pdfPath, pageNum, metadata);
          
          for (const fragmentText of fragments) {
            const document: Document = {
              title: metadata.title,
              author: metadata.author,
              text: fragmentText,
              page: pageNum,
              published_year: metadata.publishedYear,
              language: metadata.language,
            };

            documents.push(document);
          }
        } catch (pageError) {
          logger.error(`Ошибка при обработке страницы ${pageNum}: ${pageError}`);
        }
      }

      return documents;

    } catch (error) {
      logger.error(`Ошибка при обработке PDF: ${error}`);
      throw error;
    }
  }

  /**
   * Загружает документы в векторную базу данных
   */
  public async uploadDocumentsToVectorDB(documents: Document[]): Promise<void> {
    for (const document of documents) {
      try {
        await addDocument(document);
      } catch (error) {
        logger.error(`Ошибка при загрузке документа в векторную БД: ${error}`);
        throw error;
      }
    }
  }

  /**
   * Полная обработка PDF с загрузкой в векторную базу данных
   */
  public async processAndUploadPdf(
    pdfPath: string,
    metadata: DocumentMetadata,
    socket?: any
  ): Promise<void> {
    try {
      const data = new Uint8Array(require('fs').readFileSync(pdfPath));
      const loadingTask = require('pdfjs-dist').getDocument({ data });
      const pdfDocument = await loadingTask.promise;
      const totalPages = pdfDocument.numPages;

      logger.info(`Обработка PDF "${metadata.title}": найдено ${totalPages} страниц`);

      // Отправляем событие о начале загрузки в векторную базу данных
      if (socket) {
        const eventData = {
          type: "vector_start",
          filename: metadata.title,
          message: `Начинаю загрузку в векторную базу данных (${totalPages} страниц)`
        };
        console.log("Отправляем событие vector_start:", eventData);
        socket.emit("upload_progress", eventData);
      }

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await pdfDocument.getPage(pageNum);
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
            continue;
          }

          // Пропускаем первые страницы, если они содержат ненужную информацию
          if (pageNum <= 3 && this.normalizer.isUnwantedPage(pageText)) {
            logger.info(
              `Пропускаем страницу ${pageNum}: вероятно, ненужная информация`
            );
            continue;
          }

          logger.info(`Обрабатывается страница ${pageNum}/${totalPages}`);

          // Отправляем событие о прогрессе обработки страницы
          if (socket) {
            const pageProgress = Math.round((pageNum / totalPages) * 100);
            const shouldEmit = pageNum % 5 === 0 || pageProgress % 10 === 0 || pageNum === totalPages;
            
            if (shouldEmit) {
              const eventData = {
                type: "vector_progress",
                filename: metadata.title,
                message: `Обрабатывается страница ${pageNum}/${totalPages}`,
                progress: pageProgress
              };
              console.log("Отправляем событие vector_progress:", eventData);
              socket.emit("upload_progress", eventData);
              
              // Добавляем небольшую задержку для лучшего UX
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          // Нормализуем текст
          const normalizedText = this.normalizer.processText(pageText, {
            removeReferences: true,
            replaceAbbreviations: true,
            mergeIncompleteSentences: true,
            mergeListItems: true
          });
          
          // Разбиваем на предложения
          const sentences = this.normalizer.splitIntoSentences(normalizedText, {
            removeReferences: true,
            replaceAbbreviations: true,
            mergeIncompleteSentences: true,
            mergeListItems: true
          });
          
          // Создаем фрагменты
          const fragments = this.fragmenter.createFragments(normalizedText, sentences);

          // Загружаем фрагменты в векторную базу данных
          for (const fragmentText of fragments) {
            const document: Document = {
              title: metadata.title,
              author: metadata.author,
              text: fragmentText,
              page: pageNum,
              published_year: metadata.publishedYear,
              language: metadata.language,
            };

            await addDocument(document);
          }
        } catch (pageError) {
          console.error(`Ошибка при обработке страницы ${pageNum}:`, pageError);
        }
      }
      
      // Отправляем событие о завершении загрузки в векторную базу данных
      if (socket) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const eventData = {
          type: "vector_complete",
          filename: metadata.title,
          message: `Загрузка в векторную базу данных завершена`,
          progress: 100
        };
        console.log("Отправляем событие vector_complete:", eventData);
        socket.emit("upload_progress", eventData);
      }
      
      logger.info(`✅ Обработка PDF "${metadata.title}" завершена`);
    } catch (error) {
      console.error(`Ошибка при открытии PDF ${pdfPath}:`, error);
      
      // Отправляем событие об ошибке
      if (socket) {
        socket.emit("upload_progress", {
          type: "vector_error",
          filename: metadata.title,
          message: `Ошибка при загрузке в векторную базу данных: ${error}`
        });
      }
      
      throw error;
    }
  }

  /**
   * Обновляет конфигурацию обработки
   */
  public updateConfig(config: Partial<PdfProcessingConfig>): void {
    if (config.fragmentConfig) {
      this.fragmenter.updateConfig(config.fragmentConfig);
    }
  }

  /**
   * Получает текущую конфигурацию
   */
  public getConfig(): PdfProcessingConfig {
    return {
      skipFirstPages: 3,
      unwantedPatterns: [],
      fragmentConfig: this.fragmenter.getConfig(),
      normalizationConfig: {
        removeReferences: true,
        replaceAbbreviations: true,
        mergeIncompleteSentences: true,
        mergeListItems: true
      }
    };
  }
}

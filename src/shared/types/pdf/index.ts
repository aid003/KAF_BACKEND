// Типы для обработки PDF документов

// Метаданные документа
export interface DocumentMetadata {
  title: string;
  author: string;
  publishedYear: number;
  language: string;
}

// Документ для загрузки в векторную базу
export interface Document {
  title: string;
  author: string;
  text: string;
  page: number;
  published_year: number;
  language: string;
}

// Конфигурация фрагментации
export interface FragmentConfig {
  chunkSize: number;
  overlap: number;
  minFragmentLength: number;
}

// Результат обработки страницы
export interface PageProcessingResult {
  pageNumber: number;
  totalPages: number;
  fragments: string[];
  skipped: boolean;
  error?: string;
}

// Результат обработки PDF
export interface PdfProcessingResult {
  totalPages: number;
  processedPages: number;
  skippedPages: number;
  totalFragments: number;
  errors: string[];
}

// События прогресса обработки
export interface ProcessingProgressEvent {
  type: 'vector_start' | 'vector_progress' | 'vector_complete' | 'vector_error';
  filename: string;
  message: string;
  progress?: number;
}

// Конфигурация нормализации текста
export interface TextNormalizationConfig {
  removeReferences: boolean;
  replaceAbbreviations: boolean;
  mergeIncompleteSentences: boolean;
  mergeListItems: boolean;
}

// Аббревиатуры для замены
export interface AbbreviationMap {
  [key: string]: string;
}

// Паттерны для определения ненужных страниц
export type UnwantedPattern = RegExp;

// Конфигурация обработки PDF
export interface PdfProcessingConfig {
  skipFirstPages: number;
  unwantedPatterns: UnwantedPattern[];
  fragmentConfig: FragmentConfig;
  normalizationConfig: TextNormalizationConfig;
}

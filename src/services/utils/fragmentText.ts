import fs from "fs";
import * as pdfjsLib from "pdfjs-dist";
import { addDocument } from "../weaviate";
import logger from "./logger";

// Карта известных аббревиатур для временной замены
const ABBREVIATION_MAP: Record<string, string> = {
  "г.": "г<<DOT>>",
  "т.д.": "т<<DOT>>д<<DOT>>",
  "и.о.": "и<<DOT>>о<<DOT>>",
};

// Набор шаблонов для определения ненужных страниц (оглавление, предисловие, копирайты и т.д.)
const UNWANTED_PATTERNS = [
  /оглавление/i,
  /содержание/i,
  /предисловие/i,
  /©/i,
  /ISBN/i,
  /все права защищены/i,
  /^\d+$/, // Страница, содержащая только цифры
];

const isUnwantedPage = (text: string): boolean => {
  return UNWANTED_PATTERNS.some((pattern) => pattern.test(text));
};

// Функция нормализации текста:
// • Приводит переносы строк к "\n"
// • Устраняет лишние пробелы (сохраняя разделение абзацев – двойной перевод строки)
// • Исправляет переносы слов по линии (например, "информа-\nция" → "информация")
// • Одинарные переводы строки заменяет на пробел
const normalizeText = (text: string): string => {
  let normalized = text.replace(/\r\n/g, "\n");
  normalized = normalized.replace(/[ \t]+/g, " ");
  normalized = normalized.replace(/(\w+)-\n(\w+)/g, "$1$2");
  normalized = normalized.replace(/(?<!\n)\n(?!\n)/g, " ");
  return normalized.trim();
};

// Функция очистки ссылок и сносок (удаляет [число] и URL)
const cleanReferences = (text: string): string => {
  return text.replace(/\[\d+\]/g, "").replace(/https?:\/\/\S+/g, "");
};

// Замена аббревиатур одним проходом с использованием callback
const replaceAbbreviations = (text: string): string => {
  return text.replace(
    /(г\.|т\.д\.|и\.о\.)/g,
    (match) => ABBREVIATION_MAP[match] || match
  );
};

// Определяет, является ли строка элементом списка.
// Поддерживаются многоуровневая нумерация (например, "1.1.") и маркеры: -, *, •, —.
const isListItem = (sentence: string): boolean => {
  return /^(\d+(\.\d+)*\.\s+|[-*•—]\s+)/.test(sentence);
};

// Объединяет неполные предложения, используя .reduce().
// Если предыдущее предложение не заканчивается знаком препинания, а следующее начинается со строчной буквы,
// и при этом предыдущее не заканчивается двойным переводом строки (отделяющим заголовок),
// то они объединяются.
const mergeIncompleteSentences = (sentences: string[]): string[] => {
  return sentences.reduce<string[]>((acc, sentence) => {
    if (
      acc.length > 0 &&
      !/[.!?]$/.test(acc[acc.length - 1]) &&
      /^[a-zа-яё]/.test(sentence) &&
      !acc[acc.length - 1].endsWith("\n\n")
    ) {
      acc[acc.length - 1] += " " + sentence;
    } else {
      acc.push(sentence);
    }
    return acc;
  }, []);
};

// Объединяет элементы списков с последующим текстом, чтобы они не образовывали отдельный фрагмент.
const mergeSpecialLines = (sentences: string[]): string[] => {
  const merged: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    let current = sentences[i];
    if (isListItem(current) && i < sentences.length - 1) {
      current += " " + sentences[i + 1];
      i++;
    }
    merged.push(current);
  }
  return merged;
};

// Улучшенное разбиение на предложения.
// 1. Заменяются аббревиатуры.
// 2. Текст разбивается по окончанию предложения (с учётом заглавной буквы).
// 3. Объединяются неполные предложения (через mergeIncompleteSentences).
// 4. Объединяются элементы списков (через mergeSpecialLines).
const improvedSplitIntoSentences = (text: string): string[] => {
  text = replaceAbbreviations(text);
  let sentences = text.split(/(?<=[.!?])\s+(?=[А-ЯЁ])/);
  sentences = sentences.map((s) => s.trim()).filter((s) => s.length > 0);
  sentences = sentences.map((s) => s.replace(/<<DOT>>/g, "."));
  const mergedSentences = mergeIncompleteSentences(sentences);
  return mergeSpecialLines(mergedSentences);
};

// Делит массив предложений на фрагменты фиксированного размера с перекрытием.
// Параметры: chunkSize – размер фрагмента; overlap – число предложений для перекрытия.
const chunkSentencesWithOverlap = (
  sentences: string[],
  chunkSize: number,
  overlap: number
): string[] => {
  const fragments: string[] = [];
  const step = Math.max(1, chunkSize - overlap);
  for (let i = 0; i < sentences.length; i += step) {
    const chunk = sentences.slice(i, i + chunkSize);
    if (chunk.length) {
      fragments.push(chunk.join(" "));
    }
    if (i + chunkSize >= sentences.length) break;
  }
  return fragments;
};

// Группирует текст в осмысленные фрагменты.
// Текст сначала нормализуется, очищается (cleanReferences),
// затем разбивается на предложения с помощью improvedSplitIntoSentences.
// Фрагменты формируются фиксированным размером (6 предложений) с адаптивным перекрытием (15% от размера, минимум 1 предложение).
const groupSentencesIntoFragments = (text: string): string[] => {
  const CHUNK_SIZE = 6;
  const overlap = Math.max(1, Math.floor(CHUNK_SIZE * 0.15));

  const normalizedText = cleanReferences(normalizeText(text));
  const sentences = improvedSplitIntoSentences(normalizedText);

  if (sentences.length === 0) return [];
  if (sentences.length <= CHUNK_SIZE) {
    return [sentences.join(" ")];
  }

  const fragments = chunkSentencesWithOverlap(sentences, CHUNK_SIZE, overlap);

  const avgLength = Math.round(
    fragments.reduce((acc, frag) => acc + frag.length, 0) / fragments.length
  );
  logger.info(
    `Создано ${fragments.length} фрагментов, средний размер: ${avgLength} символов`
  );

  return fragments;
};

// Функция обработки PDF:
// • Извлекает текст с сортировкой по вертикальной позиции, а при равенстве – по горизонтальной,
//   что улучшает порядок строк даже в много-колоночных документах.
// • Пропускает первые 3 страницы, если они содержат ненужную информацию (например, оглавление, ISBN, ©).
// • Нормализует и очищает текст, разбивает его на предложения и формирует фрагменты с адаптивным перекрытием.
// • Загружает каждый фрагмент через вызов addDocument.
export const processPdf = async (
  pdfPath: string,
  title: string,
  author: string,
  publishedYear: number,
  language: string
): Promise<void> => {
  try {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDocument = await loadingTask.promise;
    const totalPages = pdfDocument.numPages;

    logger.info(`Обработка PDF "${title}": найдено ${totalPages} страниц`);

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

        // Пропускаем первые 3 страницы, если они содержат ненужную информацию
        if (pageNum <= 3 && isUnwantedPage(pageText)) {
          logger.info(
            `Пропускаем страницу ${pageNum}: вероятно, ненужная информация`
          );
          continue;
        }

        logger.info(`Обрабатывается страница ${pageNum}/${totalPages}`);

        const fragments = groupSentencesIntoFragments(pageText);

        for (const fragmentText of fragments) {
          const document = {
            title,
            author,
            text: fragmentText,
            page: pageNum,
            published_year: publishedYear,
            language,
          };

          await addDocument(document);
        }
      } catch (pageError) {
        console.error(`Ошибка при обработке страницы ${pageNum}:`, pageError);
      }
    }
    logger.info(`✅ Обработка PDF "${title}" завершена`);
  } catch (error) {
    console.error(`Ошибка при открытии PDF ${pdfPath}:`, error);
  }
};

// Функция для обработки одного PDF-файла с метаданными
export async function processPdfFile(
  pdfPath: string,
  meta: {
    title: string;
    author: string;
    publishedYear: number;
    language: string;
  }
): Promise<void> {
  await processPdf(
    pdfPath,
    meta.title,
    meta.author,
    meta.publishedYear,
    meta.language
  );
}

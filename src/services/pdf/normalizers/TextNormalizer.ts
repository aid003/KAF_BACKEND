import { 
  TextNormalizationConfig, 
  AbbreviationMap, 
  UnwantedPattern 
} from '../../../shared/types/pdf';

export class TextNormalizer {
  private readonly abbreviationMap: AbbreviationMap;
  private readonly unwantedPatterns: UnwantedPattern[];

  constructor(
    abbreviationMap: AbbreviationMap = {},
    unwantedPatterns: UnwantedPattern[] = []
  ) {
    this.abbreviationMap = abbreviationMap;
    this.unwantedPatterns = unwantedPatterns;
  }

  /**
   * Нормализует текст:
   * • Приводит переносы строк к "\n"
   * • Устраняет лишние пробелы (сохраняя разделение абзацев – двойной перевод строки)
   * • Исправляет переносы слов по линии (например, "информа-\nция" → "информация")
   * • Одинарные переводы строки заменяет на пробел
   */
  public normalizeText(text: string): string {
    let normalized = text.replace(/\r\n/g, "\n");
    normalized = normalized.replace(/[ \t]+/g, " ");
    normalized = normalized.replace(/(\w+)-\n(\w+)/g, "$1$2");
    normalized = normalized.replace(/(?<!\n)\n(?!\n)/g, " ");
    return normalized.trim();
  }

  /**
   * Очищает ссылки и сноски (удаляет [число] и URL)
   */
  public cleanReferences(text: string): string {
    return text.replace(/\[\d+\]/g, "").replace(/https?:\/\/\S+/g, "");
  }

  /**
   * Заменяет аббревиатуры одним проходом с использованием callback
   */
  public replaceAbbreviations(text: string): string {
    const pattern = new RegExp(
      Object.keys(this.abbreviationMap).map(key => 
        key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      ).join('|'), 
      'g'
    );
    
    return text.replace(pattern, (match) => 
      this.abbreviationMap[match] || match
    );
  }

  /**
   * Определяет, является ли строка элементом списка.
   * Поддерживаются многоуровневая нумерация (например, "1.1.") и маркеры: -, *, •, —.
   */
  public isListItem(sentence: string): boolean {
    return /^(\d+(\.\d+)*\.\s+|[-*•—]\s+)/.test(sentence);
  }

  /**
   * Объединяет неполные предложения, используя .reduce().
   * Если предыдущее предложение не заканчивается знаком препинания, а следующее начинается со строчной буквы,
   * и при этом предыдущее не заканчивается двойным переводом строки (отделяющим заголовок),
   * то они объединяются.
   */
  public mergeIncompleteSentences(sentences: string[]): string[] {
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
  }

  /**
   * Объединяет элементы списков с последующим текстом, чтобы они не образовывали отдельный фрагмент.
   */
  public mergeSpecialLines(sentences: string[]): string[] {
    const merged: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      let current = sentences[i];
      if (this.isListItem(current) && i < sentences.length - 1) {
        current += " " + sentences[i + 1];
        i++;
      }
      merged.push(current);
    }
    return merged;
  }

  /**
   * Улучшенное разбиение на предложения.
   * 1. Заменяются аббревиатуры.
   * 2. Текст разбивается по окончанию предложения (с учётом заглавной буквы).
   * 3. Объединяются неполные предложения (через mergeIncompleteSentences).
   * 4. Объединяются элементы списков (через mergeSpecialLines).
   */
  public splitIntoSentences(text: string, config: TextNormalizationConfig): string[] {
    if (config.replaceAbbreviations) {
      text = this.replaceAbbreviations(text);
    }

    let sentences = text.split(/(?<=[.!?])\s+(?=[А-ЯЁ])/);
    sentences = sentences.map((s) => s.trim()).filter((s) => s.length > 0);
    
    // Восстанавливаем точки в аббревиатурах
    sentences = sentences.map((s) => s.replace(/<<DOT>>/g, "."));

    if (config.mergeIncompleteSentences) {
      sentences = this.mergeIncompleteSentences(sentences);
    }

    if (config.mergeListItems) {
      sentences = this.mergeSpecialLines(sentences);
    }

    return sentences;
  }

  /**
   * Определяет, является ли страница ненужной (оглавление, предисловие, копирайты и т.д.)
   */
  public isUnwantedPage(text: string): boolean {
    return this.unwantedPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Полная нормализация текста с применением всех настроек
   */
  public processText(text: string, config: TextNormalizationConfig): string {
    let processed = this.normalizeText(text);
    
    if (config.removeReferences) {
      processed = this.cleanReferences(processed);
    }

    return processed;
  }
}

import { FragmentConfig } from '../../../shared/types/pdf';
import logger from '../../utils/logger';

export class TextFragmenter {
  private readonly config: FragmentConfig;

  constructor(config: FragmentConfig) {
    this.config = config;
  }

  /**
   * Делит массив предложений на фрагменты фиксированного размера с перекрытием.
   * Параметры: chunkSize – размер фрагмента; overlap – число предложений для перекрытия.
   */
  public chunkSentencesWithOverlap(sentences: string[]): string[] {
    const { chunkSize, overlap } = this.config;
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
  }

  /**
   * Группирует текст в осмысленные фрагменты.
   * Текст сначала нормализуется, очищается,
   * затем разбивается на предложения.
   * Фрагменты формируются фиксированным размером с адаптивным перекрытием.
   */
  public groupSentencesIntoFragments(
    sentences: string[]
  ): string[] {
    const { chunkSize, minFragmentLength } = this.config;

    if (sentences.length === 0) return [];
    
    if (sentences.length <= chunkSize) {
      const fragment = sentences.join(" ");
      return fragment.length >= minFragmentLength ? [fragment] : [];
    }

    const fragments = this.chunkSentencesWithOverlap(sentences);

    // Фильтруем фрагменты по минимальной длине
    const validFragments = fragments.filter(
      fragment => fragment.length >= minFragmentLength
    );

    if (validFragments.length > 0) {
      const avgLength = Math.round(
        validFragments.reduce((acc, frag) => acc + frag.length, 0) / validFragments.length
      );
      
      logger.info(
        `Создано ${validFragments.length} фрагментов, средний размер: ${avgLength} символов`
      );
    }

    return validFragments;
  }

  /**
   * Создает фрагменты из текста с учетом конфигурации
   */
  public createFragments(text: string, sentences: string[]): string[] {
    return this.groupSentencesIntoFragments(sentences);
  }

  /**
   * Обновляет конфигурацию фрагментации
   */
  public updateConfig(newConfig: Partial<FragmentConfig>): void {
    this.config.chunkSize = newConfig.chunkSize ?? this.config.chunkSize;
    this.config.overlap = newConfig.overlap ?? this.config.overlap;
    this.config.minFragmentLength = newConfig.minFragmentLength ?? this.config.minFragmentLength;
  }

  /**
   * Получает текущую конфигурацию
   */
  public getConfig(): FragmentConfig {
    return { ...this.config };
  }
}

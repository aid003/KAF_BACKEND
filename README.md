# KAF Backend - Система с векторной базой данных и генерацией текста

## Описание

Этот проект представляет собой backend-систему, которая объединяет:
- **Weaviate** - векторную базу данных для семантического поиска
- **Ollama** - для генерации текста с помощью локальных LLM моделей
- **Transformers** - для векторизации текста

## Архитектура

### Сервисы

1. **Weaviate** (порт 8080)
   - Векторная база данных
   - Поддержка модуля `generative-ollama`
   - Многоязычная векторизация текста

2. **Ollama** (порт 11434)
   - Локальные LLM модели
   - Автоматическая загрузка моделей при запуске
   - Поддержка стриминга ответов

3. **Transformers** (внутренний сервис)
   - Векторизация текста
   - Модель: `sentence-transformers-paraphrase-multilingual-mpnet-base-v2`

## Установленные модели Ollama

При первом запуске автоматически загружаются следующие модели:

- **owl/t-lite** - основная модель для генерации (быстрая, легкая)
- **llama3.2:3b** - универсальная модель для общих задач
- **qwen2.5:3b** - модель с хорошим пониманием русского языка
- **mistral:7b** - более качественная модель для сложных задач

## Запуск

```bash
# Запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка сервисов
docker-compose down
```

## API Endpoints

### Health Check
- `GET /health` - проверка состояния сервисов

### CRUD операции
- `POST /api/crud` - создание/обновление документов
- `GET /api/crud` - получение документов
- `DELETE /api/crud` - удаление документов

### Загрузка файлов
- `POST /upload` - загрузка и обработка документов

## WebSocket

Система поддерживает WebSocket соединения для:
- Стриминга ответов от LLM
- Уведомлений о статусе обработки
- Интерактивного взаимодействия

## Конфигурация

### Переменные окружения

- `OLLAMA_HOST=0.0.0.0` - хост для Ollama
- `TRANSFORMERS_INFERENCE_API` - URL для трансформеров
- `AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true` - анонимный доступ к Weaviate

### Volumes

- `weaviate_data` - данные Weaviate
- `ollama_data` - модели Ollama
- `uploads/` - загруженные файлы

## Разработка

### Структура проекта

```
src/
├── api/           # API роуты и middleware
├── services/      # Бизнес-логика
│   ├── ollama/    # Интеграция с Ollama
│   ├── weaviate/  # Интеграция с Weaviate
│   └── utils/     # Утилиты
├── socket/        # WebSocket обработчики
└── app.ts         # Основное приложение
```

### Добавление новых моделей

1. Отредактируйте `scripts/init-ollama.sh`
2. Добавьте команду `ollama pull <model-name>`
3. Перезапустите контейнеры

### Использование разных моделей

```typescript
import { askQuestion } from './services/ollama';

// Использование конкретной модели
const response = await askQuestion(
  "Ваш вопрос",
  documents,
  socketId,
  "mistral:7b" // указать модель
);
```

## Мониторинг

- Логи Weaviate: `docker-compose logs weaviate`
- Логи Ollama: `docker-compose logs ollama`
- Логи приложения: `docker-compose logs <service-name>`

## Требования

- Docker и Docker Compose
- Node.js 18+ (для разработки)
- Минимум 8GB RAM (рекомендуется 16GB для больших моделей)

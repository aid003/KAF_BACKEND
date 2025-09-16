#!/bin/bash

# Скрипт для инициализации Ollama с необходимыми моделями
echo "Инициализация Ollama..."

# Ждем запуска Ollama
echo "Ожидание запуска Ollama..."
until curl -f http://localhost:11434/api/tags > /dev/null 2>&1; do
  echo "Ожидание Ollama..."
  sleep 2
done

echo "Ollama запущен, загружаем модели..."

# Загружаем основную модель для генерации (owl/t-lite)
echo "Загружаем owl/t-lite..."
ollama pull owl/t-lite

# Загружаем дополнительные модели для разных задач
echo "Загружаем llama3.2:3b для общих задач..."
ollama pull llama3.2:3b

echo "Загружаем qwen2.5:3b для лучшего понимания русского языка..."
ollama pull qwen2.5:3b

echo "Загружаем mistral:7b для более качественных ответов..."
ollama pull mistral:7b

echo "Все модели загружены успешно!"
echo "Доступные модели:"
ollama list

# Диагностика Network Error

## Возможные причины ошибки "Network Error":

### 1. CORS проблемы
✅ **ИСПРАВЛЕНО**: Добавлен заголовок `X-Socket-ID` в CORS настройки

### 2. Переменные окружения
✅ **ИСПРАВЛЕНО**: Добавлены fallback значения в код клиента

### 3. Socket.IO подключение
✅ **ДОБАВЛЕНО**: Логирование для диагностики Socket.IO

## Шаги для диагностики:

### 1. Проверьте консоль браузера
Откройте DevTools (F12) и посмотрите на:
- Ошибки в консоли
- Сетевые запросы во вкладке Network
- Сообщения Socket.IO

### 2. Проверьте переменные окружения
В консоли браузера выполните:
```javascript
console.log('Upload URL:', process.env.NEXT_PUBLIC_UPLOAD_URL);
console.log('Socket URL:', process.env.NEXT_PUBLIC_SOCKET_URL);
```

### 3. Проверьте подключение к серверу
```bash
curl http://localhost:5041/health
```

### 4. Проверьте Socket.IO
```bash
curl http://localhost:5041/socket.io/
```

### 5. Тестовый файл
Откройте `test-upload.html` в браузере для тестирования загрузки

## Ожидаемые логи:

### В консоли браузера:
```
SocketService: Подключаемся к http://localhost:5041
SocketService: Подключен с ID: abc123
Подключаемся к Socket.IO: http://localhost:5041
Socket.IO подключен: abc123
Начинаем загрузку файла на: http://localhost:5041/api/uploads
Socket ID: abc123
```

### На сервере:
```
Socket connected: abc123
[INFO] - POST /api/uploads HTTP/1.1" 200
```

## Если проблема остается:

1. Проверьте, что сервер запущен на порту 5041
2. Проверьте, что клиент запущен на другом порту (обычно 3000)
3. Проверьте файрвол и антивирус
4. Попробуйте отключить расширения браузера

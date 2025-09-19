module.exports = {
  apps: [
    {
      name: 'maf-backend',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      // Автозапуск при перезагрузке
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // Логи
      log_file: '../logs/backend-combined.log',
      out_file: '../logs/backend-out.log',
      error_file: '../logs/backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Перезапуск при ошибках
      min_uptime: '10s',
      max_restarts: 10,
      // Игнорировать изменения в этих файлах
      ignore_watch: ['node_modules', 'logs', 'uploads', 'dist', 'src'],
      // Переменные окружения для разработки
      env_file: '.env'
    }
  ]
};

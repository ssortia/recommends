// Единый shape тела ошибки API: глобальный фильтр на бэкенде всегда отдаёт
// именно эту структуру, а фронтовый ApiError парсит её для чистого message.
export interface ApiErrorBody {
  statusCode: number;
  message: string;
  // Отдельные сообщения валидации (если ошибка от ValidationPipe).
  details?: string[];
}

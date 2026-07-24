# Text Translator

Веб-приложение для перевода текстов. Главная — выбор квестов, редактор — полноэкранный split-view с навигацией по файлам квеста.

## Технологии

- Astro 7 (SSR) + React islands
- TypeScript
- Bootstrap 5 (react-bootstrap)
- SQLite (better-sqlite3)

## Структура файлов

Файлы имеют формат: `[Персонаж].[Подраздел].[Квест]_[ID]_orig.txt`

- `LYRA.4.20_12_orig.txt` — оригинал
- `LYRA.4.20_12.txt` — перевод

## Маршруты

- `/` — главное меню
- `/quests` — список квестов
- `/editor/[quest]` — редактор квеста
- `/settings` — настройки

## Запуск

```sh
npm install
npm run dev
```

Dev-сервер: <http://localhost:3000>

## Настройки

Пути к файлам и API-ключи настраиваются через `/settings` или в `.env.local`:

- `ORIGINALS_DIR` — путь к папке с оригиналами
- `TRANSLATIONS_DIR` — путь к папке с переводами
- `OPENROUTER_API_KEY` — ключ OpenRouter (для будущего использования)

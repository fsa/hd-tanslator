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

Квесты группируются по `Персонаж.Подраздел.Квест` (например `LYRA.4.20`).

## Маршруты

- `/` — главное меню (Quests, Settings)
- `/quests` — список квестов с прогрессом
- `/editor/[quest]` — редактор квеста (split-view + навигация prev/next)
- `/settings` — настройки

## API Endpoints

### Файлы

- `GET /api/files` — список файлов (с пагинацией)
- `GET /api/files/[name]/orig` — оригинал
- `GET /api/files/[name]/trans` — перевод
- `POST /api/files/[name]/save` — сохранить перевод
- `POST /api/reindex` — переиндексация

### Квесты

- `GET /api/quests` — список квестов (группировка по character.section.quest)
- `GET /api/quests/[name]/files` — файлы квеста

### Настройки

- `GET /api/settings` — получить настройки + дефолты из .env
- `POST /api/settings` `{ action: "save", key, value }` — сохранить настройку
- `POST /api/settings` `{ action: "reset", key }` — сбросить на дефолт

Ключи настроек: `ORIGINALS_DIR`, `TRANSLATIONS_DIR`, `OPENROUTER_API_KEY`

## Хранилище настроек

Настройки хранятся в SQLite (таблица `settings`). Механизм:

- `getSetting(key)` — читает из БД, если нет — берёт из `import.meta.env`
- `setSetting(key, value)` — сохраняет в БД
- `resetSetting(key)` — удаляет из БД (возвращается к .env)
- `getAllSettings()` — все настройки с дефолтами

При изменении настроек путей нужно делать реиндексацию через `/api/reindex`.

## Запуск

- `npm run dev` — dev-сервер
- `npm run build` — продакшн-билд
- `POST /api/reindex` — индексация файлов

# Text Translator

Веб-приложение для перевода текстов. Левая панель — оригинальный текст (read-only), правая — редактируемый перевод.

## Технологии
- Astro (SSR) + React islands
- TypeScript
- Bootstrap 5 (react-bootstrap)
- SQLite (better-sqlite3)

## Структура файлов
Файлы имеют формат: `[Персонаж].[Подраздел].[Квест]_[ID].orig.txt`
- `LYRA.4.20_12.orig.txt` — оригинал
- `LYRA.4.20_12.txt` — перевод

## API Endpoints
- `GET /api/files` — список файлов
- `GET /api/files/[name]/orig` — оригинал
- `GET /api/files/[name]/trans` — перевод
- `POST /api/files/[name]/save` — сохранить перевод
- `POST /api/reindex` — переиндексация

## Запуск
- `npm run dev` — dev-сервер
- `POST /api/reindex` — индексация файлов

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

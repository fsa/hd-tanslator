# Plan: Переход на Monaco DiffEditor

## Проблема

Текущая реализация diff в [`CodeEditor.tsx`](src/components/CodeEditor.tsx) использует ручное вычисление diff через `diffLines`/`diffChars` и навешивание декораций через `deltaDecorations`. Этот подход:

1. **Ненадёжен** — при вставке/удалении строк индексы "съезжают"
2. **Не показывает удалённые строки** — в Monaco Editor нет строк, которых нет в тексте
3. **Не имеет overview ruler** — полосок справа, как в VS Code
4. **Дублирует функциональность** — Monaco Editor уже имеет встроенный DiffEditor

## Решение

Заменить правый редактор (перевод) на **Monaco DiffEditor**, где:
- **Original** (слева в diff) = `savedTranslation` (последняя сохранённая версия, read-only)
- **Modified** (справа в diff) = `translationContent` (текущий перевод, editable)

Это даст:
- Правильные gutter-индикаторы (зелёные/красные полоски)
- Inline diff внутри строк
- Overview ruler (полоски справа)
- Навигацию по изменениям
- Корректную обработку вставок/удалений строк

## Архитектура

### Новый компонент: `TranslationEditor.tsx`

```tsx
interface TranslationEditorProps {
  value: string;        // текущий перевод
  original: string;     // последняя сохранённая версия
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}
```

Использует `DiffEditor` из `@monaco-editor/react`:
```tsx
import { DiffEditor } from '@monaco-editor/react';

<DiffEditor
  original={original}
  modified={value}
  language="gamescript"
  onMount={handleMount}
  onChange={(val) => onChange(val || '')}
  options={{
    readOnly: false,
    wordWrap: 'on',
    // ... остальные опции
  }}
/>
```

### Изменения в `QuestEditor.tsx`

Заменить:
```tsx
<CodeEditor
  value={translationContent}
  original={savedTranslation}
  onChange={setTranslationContent}
/>
```
на:
```tsx
<TranslationEditor
  value={translationContent}
  original={savedTranslation}
  onChange={setTranslationContent}
/>
```

### Изменения в `CodeEditor.tsx`

Удалить всю логику diff (функции `computeInlineDiff`, `computeLineMappings` и соответствующий блок в `useEffect`). `CodeEditor` останется только для read-only просмотра оригинала (левая панель).

## Файлы для изменения/создания

| Файл | Действие | Описание |
|------|----------|----------|
| [`src/components/TranslationEditor.tsx`](src/components/TranslationEditor.tsx) | **Создать** | Новый компонент на основе Monaco DiffEditor |
| [`src/components/QuestEditor.tsx`](src/components/QuestEditor.tsx) | **Изменить** | Заменить `CodeEditor` на `TranslationEditor` для правой панели |
| [`src/components/CodeEditor.tsx`](src/components/CodeEditor.tsx) | **Изменить** | Удалить всю diff-логику, оставить только read-only редактор |
| [`src/styles/tokens.css`](src/styles/tokens.css) | **Изменить** | Удалить старые diff-классы, добавить стили для DiffEditor |

## Визуальная схема

```
Текущая архитектура:
┌─────────────────────┬──────────────────────┐
│  CodeEditor         │  CodeEditor          │
│  (read-only)        │  (editable)          │
│  originalContent    │  translationContent  │
│                     │  + ручной diff       │
└─────────────────────┴──────────────────────┘

Новая архитектура:
┌─────────────────────┬──────────────────────┐
│  CodeEditor         │  TranslationEditor   │
│  (read-only)        │  (Monaco DiffEditor) │
│  originalContent    │  ┌────────┬────────┐ │
│                     │  │saved   │current │ │
│                     │  │(r/o)   │(edit)  │ │
│                     │  └────────┴────────┘ │
└─────────────────────┴──────────────────────┘
```

## Преимущества

1. **Надёжность** — Monaco DiffEditor используется тысячами разработчиков
2. **Полный функционал** — gutter, inline diff, overview ruler, навигация
3. **Производительность** — Monaco оптимизирован для больших diff
4. **Меньше кода** — не нужно писать и поддерживать свою diff-логику
5. **Привычный UX** — пользователи узнают интерфейс как в VS Code

## Потенциальные риски

1. **Размер бандла** — Monaco DiffEditor может быть тяжелее. Решение: ленивая загрузка через `@monaco-editor/react` (уже используется)
2. **Синхронизация скролла** — в DiffEditor левая и правая панели синхронизируются автоматически
3. **Кастомная подсветка** — нужно убедиться, что `gamescript` language работает в DiffEditor. Решение: регистрируем язык в `onMount` как и сейчас
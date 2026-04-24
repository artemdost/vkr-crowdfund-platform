# SkillsMP API — поиск Claude Skills

> Маркетплейс/индекс публичных Claude Skills (`SKILL.md` файлов) из GitHub-репозиториев.
> Сайт: https://skillsmp.com  · Документация: https://skillsmp.com/docs/api (под Cloudflare-челленджем, обычным curl не открыть)

API ключ хранится в переменной окружения `SKILLSMP_API_KEY` (формат `sk_live_skillsmp_…`).

---

## 1. Базовое

| Параметр | Значение |
|---|---|
| База | `https://skillsmp.com/api/v1` |
| Auth | `Authorization: Bearer sk_live_skillsmp_…` (обязателен) |
| Формат | JSON, GET-запросы |
| Поддоменов нет | `api.skillsmp.com` не существует |

Поведение Cloudflare: пути `/docs/*`, `/sitemaps/*` отдают JS-челлендж и недоступны из CLI; `/api/v1/*` пропускает запросы с правильным Bearer-токеном.

---

## 2. Два эндпоинта поиска

| Эндпоинт | Что делает | Когда использовать |
|---|---|---|
| `GET /api/v1/skills/search` | Полнотекстовый поиск по имени и описанию | Точные термины (`hardhat`, `bpmn`), браузинг с сортировкой и пагинацией |
| `GET /api/v1/skills/ai-search` | Векторный (семантический) поиск | Натуральный язык, концептуальные запросы, «что мне нужно для X» |

См. § 2A и § 2B ниже.

---

## 2A. Полнотекстовый поиск

```
GET /api/v1/skills/search?q=<query>[&page=N][&limit=N][&sortBy=...]
```

### Параметры

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `q` | string | — (обязателен) | Поисковая строка. Минимум 2 символа — `q=a` возвращает 0 результатов. Ищет по имени и описанию скила. |
| `page` | int | `1` | Номер страницы (1-индексация). |
| `limit` | int | `20` | Размер страницы. **Максимум — 50** (значения >50 молча кэпируются). |
| `sortBy` | string | `recent` | `recent` (по `updatedAt` desc) или `stars` (по звёздам репо desc). Невалидные значения молча падают в `recent`. |

Параметры `author`, `category`, `tag` и другие фильтры **молча игнорируются** — поддержки нет.

### Минимальный пример

```bash
curl -s -H "Authorization: Bearer $SKILLSMP_API_KEY" \
  "https://skillsmp.com/api/v1/skills/search?q=python&limit=10&sortBy=stars" | jq
```

### Формат ответа (успех)

```json
{
  "success": true,
  "data": {
    "skills": [
      {
        "id": "imankulov-skills-skills-python-skill-md",
        "name": "python",
        "author": "imankulov",
        "description": "Opinionated Python coding standards…",
        "githubUrl": "https://github.com/imankulov/skills/tree/main/skills/python",
        "skillUrl":  "https://skillsmp.com/skills/imankulov-skills-skills-python-skill-md",
        "stars": 0,
        "updatedAt": "1775473006"
      }
    ],
    "pagination": {
      "page": 1, "limit": 20, "total": 21,
      "totalPages": 2, "hasNext": true, "hasPrev": false,
      "totalIsExact": false
    },
    "filters": { "search": "python", "sortBy": "recent" }
  },
  "meta": { "requestId": "uuid", "responseTimeMs": 1050 }
}
```

**Поля скила:**
- `id` — уникальный slug, используется в URL `skillsmp.com/skills/<id>`.
- `name`, `author`, `description` — метаданные из `SKILL.md` фронт-маттера.
- `githubUrl` — ссылка на папку скила в GitHub (`/tree/<branch>/...`). Здесь живёт настоящий `SKILL.md` и приложенные ассеты.
- `skillUrl` — веб-страница на SkillsMP (для просмотра в браузере).
- `stars` — звёзды **родительского репозитория** на GitHub, а не самого скила. Низко-приоритетный скил в популярном репо получит большое число.
- `updatedAt` — UNIX-эпоха в секундах (строкой).

**`totalIsExact: false`** — счётчик `total` приблизительный, когда совпадений много. Не доверяй точному числу для широких запросов.

> ⚠️ **Подвох с пустым результатом**: при `q=bpmn` с `sortBy=stars&limit=10` бывает полный 0, а с `sortBy=recent&limit=20-30` — десятки результатов. Не доверяй одному прогону: если получил пусто на коротком техническом термине — повтори с другим `sortBy` и без `limit`. Реальный кейс: на `q=bpmn` с одной комбинацией нашло 0 скилов, с другой — топовый `bpmn-generator` от a5c-ai/babysitter ★519.

---

## 2B. Семантический (AI) поиск

```
GET /api/v1/skills/ai-search?q=<query>
```

### Как работает «под капотом»

1. Запрос **пропускается через LLM**, который **перефразирует его в вопрос** (это видно в поле `data.search_query` ответа). Примеры:
   - `python` → `What is Python?`
   - `hardhat solidity erc20 token deployment` → `How to deploy an ERC20 token using Hardhat and Solidity?`
   - `смарт-контракт для краудфандинга` → `Как создать смарт-контракт для краудфандинга?`
2. Перефразированный вопрос **эмбеддится** и идёт против vector store со скилами (под капотом — OpenAI vector_store API, видно по `object: "vector_store.search_results.page"`).
3. Возвращается top-K результатов, отсечённых по similarity threshold.

### Параметры

| Параметр | Значение |
|---|---|
| `q` | Обязателен. Принимает русский и английский. |
| `limit`, `page` | **Молча игнорируются.** Пагинации нет, всегда фиксированный top-K (обычно ≤10). |

### Формат ответа

```json
{
  "success": true,
  "data": {
    "object": "vector_store.search_results.page",
    "search_query": "How to deploy an ERC20 token using Hardhat and Solidity?",
    "data": [
      {
        "file_id": "4e538ec8...",
        "filename": "skills/...-skill-md.md",
        "score": 0.988,
        "skill": { /* те же поля, что в полнотекстовом поиске */ }
      }
    ],
    "has_more": false,
    "next_page": null
  },
  "meta": { "requestId": "...", "responseTimeMs": 1278 }
}
```

- `score` — cosine similarity (0..1). Технические запросы попадают в `≥ 0.9`, концептуальные в `0.5–0.7`.
- `has_more` / `next_page` — **всегда `false`/`null`**, пагинация не реализована.

### Ловушки

- **Запрос слишком абстрактный → 0 результатов.** Например, `"I need to write a smart contract for crowdfunding with milestone-based fund release"` отдаёт пусто — все скилы не дотягивают до порога после перефразировки. Лекарство: дроби на короткие конкретные термы (`milestone smart contract`, `escrow solidity`, …) и объединяй наборы вручную.
- **Русский может терять смысл** при LLM-перефразировке. Если на русском пусто — повтори тот же запрос на английском.
- **Дубликаты.** Один и тот же скил может встретиться несколько раз (форки репозитория с разными `id`, но одинаковым именем/автором). Дедуплицируй по `skill.id` или `(name, author)`.
- **Phantom-результаты** — иногда в массиве есть запись только с `file_id`/`filename`/`score`, **без поля `skill`**. Это «осиротевший» эмбеддинг, чей скил уже удалён из БД. Всегда фильтруй: `[r for r in data if r.get("skill")]`.
- **Score 0.988 у нескольких подряд** обычно означает форки одного и того же скила.

### Минимальный пример

```bash
curl -s -H "Authorization: Bearer $SKILLSMP_API_KEY" \
  --get --data-urlencode "q=How do I write tests for solidity contracts in foundry" \
  "https://skillsmp.com/api/v1/skills/ai-search" \
| jq '.data.data | map(select(.skill)) | unique_by(.skill.name) |
       .[] | "\(.score | tostring | .[0:5])  \(.skill.name)  (\(.skill.author))"'
```

### Когда AI-поиск выгоднее полнотекстового

| Сценарий | Какой поиск |
|---|---|
| «Хочу понять, какой скил мне нужен под фичу X» | **AI-поиск** |
| «Дай мне всё, что есть про BPMN» | Полнотекстовый, `sortBy=stars` |
| «Найди свежие скилы по Solidity за неделю» | Полнотекстовый, `sortBy=recent`, фильтруй по `updatedAt` |
| «Идея пользователя на русском, не знаю английских терминов» | AI-поиск (он сам переведёт), потом проверка ключевых слов через полнотекстовый |

---

## 3. Чего в API НЕТ

- ❌ Получить отдельный скил по id (`/api/v1/skills/{id}` → 404).
- ❌ Получить тело `SKILL.md` через API. Контент скила нужно тянуть с GitHub.
- ❌ Фильтры по автору, категории, тегу.
- ❌ Список всех авторов / категорий / occupation'ов.
- ❌ POST/PUT/DELETE — только чтение.
- ❌ OpenAPI-спецификация наружу не отдаётся.

---

## 4. Ошибки

| HTTP | `error.code` | Когда |
|---|---|---|
| 400 | `MISSING_QUERY` | Нет `q` или `q` пустой |
| 401 | `MISSING_API_KEY` | Нет заголовка `Authorization` |
| 401 | `INVALID_API_KEY` | Неправильный формат / отозванный ключ |

Тело ошибки:
```json
{ "success": false, "error": { "code": "...", "message": "..." } }
```

---

## 5. Алгоритм «найти и применить скилл»

1. **Сформулировать запрос.** Поиск работает по имени и описанию, поэтому используй конкретные ключевые слова: `solidity`, `hardhat`, `erc20`, `bpmn`, `latex`, а не общие («блокчейн», «доку`мент»).
2. **Перебрать сортировки.** Сначала `sortBy=recent` (свежее = ближе к актуальной версии Claude), потом `sortBy=stars` (популярные репозитории — обычно качественнее). Их пересечение часто и даёт хороший выбор.
3. **Отфильтровать кандидатов вручную** по `description` — он содержит фразу `Use when …` / `Activates for …`, по которой видно, под какой случай скил написан.
4. **Скачать `SKILL.md` с GitHub.** API отдаёт только метаданные. Превращаем `githubUrl` в raw-URL:

   ```
   https://github.com/<owner>/<repo>/tree/<branch>/<path>
   →
   https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>/SKILL.md
   ```

   Пример:
   ```bash
   curl -sL https://raw.githubusercontent.com/imankulov/skills/main/skills/python/SKILL.md
   ```

5. **Положить скил в проект.** Для Claude Code локальные скилы лежат в `~/.claude/skills/<имя>/SKILL.md` (глобально) или `<project>/.claude/skills/<имя>/SKILL.md` (для конкретного проекта).
6. **Перезапустить Claude Code** или начать новую сессию — он подхватит скилы автоматически.

---

## 6. Готовые bash-хелперы

```bash
# полнотекстовый поиск
skillsmp() {
  local q="$1" sort="${2:-recent}" limit="${3:-20}"
  curl -s -H "Authorization: Bearer $SKILLSMP_API_KEY" \
    --get --data-urlencode "q=$q" \
    --data "sortBy=$sort&limit=$limit" \
    "https://skillsmp.com/api/v1/skills/search" \
  | jq -r '.data.skills[] | "★\(.stars)\t\(.name)\t(\(.author))\n   \(.description)\n   \(.githubUrl)\n"'
}

# AI / семантический поиск (натуральный язык)
skillsmp-ai() {
  local q="$*"
  curl -s -H "Authorization: Bearer $SKILLSMP_API_KEY" \
    --get --data-urlencode "q=$q" \
    "https://skillsmp.com/api/v1/skills/ai-search" \
  | jq -r '
      "→ перефразировано: " + .data.search_query,
      "",
      (.data.data
        | map(select(.skill))
        | unique_by(.skill.id)
        | .[]
        | "  \(.score | tostring | .[0:5])  \(.skill.name)  (\(.skill.author))  ★\(.skill.stars)\n         \(.skill.description[:160])\n         \(.skill.githubUrl)\n"
      )'
}

# использование:
# skillsmp solidity stars 10
# skillsmp-ai "I need to write tests for ERC20 in foundry"
# skillsmp-ai "как рисовать BPMN диаграммы для бизнес-процессов"
```

Перед использованием:
```bash
export SKILLSMP_API_KEY="sk_live_skillsmp_..."
```

---

## 7. Полезные запросы для текущей ВКР

| Цель | Запрос |
|---|---|
| Смарт-контракты Solidity | `q=solidity`, `q=hardhat`, `q=erc20`, `q=erc721` |
| Аудит / безопасность контрактов | `q=audit`, `q=slither`, `q=foundry` |
| Frontend (React + wagmi) | `q=react`, `q=wagmi`, `q=viem` |
| Бизнес-моделирование | `q=bpmn`, `q=uml` |
| Оформление работы | `q=latex`, `q=docx`, `q=academic` |
| Документирование кода | `q=technical writing`, `q=documentation` |

---

## 8. Безопасность

- Ключ `sk_live_…` — **продакшен**. Не коммить в git, держи в `.env` / переменной окружения.
- При утечке (например, отправили в чат) — **отозвать и перевыпустить** в личном кабинете SkillsMP.
- Этот файл умышленно не содержит сам ключ, только переменную `$SKILLSMP_API_KEY`.

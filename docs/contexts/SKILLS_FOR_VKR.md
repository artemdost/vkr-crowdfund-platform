# Скилы Claude под ВКР — что ставить и зачем

> Подобрано по результатам прогонa SkillsMP (43 запроса, 320 уникальных скилов) под три фронта работы:
> 1. **Текст ВКР** (Введение → Главы 1-3 → Заключение, академический русский, обход AI-детекторов)
> 2. **Прототип** (Solidity-смарт-контракты + React/wagmi/viem фронт)
> 3. **Моделирование** (BPMN AS-IS/TO-BE, ER, UML, ArchiMate, Гант)
>
> Для каждой задачи указан 1 топовый скил (высокий score AI-поиска или популярный репо) и 1-2 запасных. Полный сырой отчёт — `/tmp/skillsmp_report.txt`.

---

## 0. Как ставить скилы

```bash
# 1. Скачать SKILL.md из репо (githubUrl → raw.githubusercontent.com)
mkdir -p ~/.claude/skills/<имя>
curl -sL "<raw URL>/SKILL.md" -o ~/.claude/skills/<имя>/SKILL.md

# 2. Если в папке скила есть приложения (templates/, scripts/, references/) — забрать тоже:
#    проще всего — sparse-checkout или скачать всю папку через GitHub Download Directory.

# 3. Перезапустить Claude Code (или начать новую сессию) — скил подхватится.
```

Альтернатива: положить в **локальный** проект `<project>/.claude/skills/<имя>/SKILL.md` — тогда скил активен только в этой папке. Для ВКР рекомендую делать **локально** в `/Users/artemdostalev/Documents/ВКР/ВКР/.claude/skills/`, чтобы не засорять глобальный конфиг.

---

## 1. ТЕКСТ ВКР (приоритет №1 — без этих скилов работа не пройдёт антиплагиат/AI-детектор)

### 1.1. Обход AI-детекторов (КРИТИЧНО, см. §15.3 PROJECT_CONTEXT.md)

| # | Скил | Автор | ★ | Зачем |
|---|---|---|---|---|
| 🥇 | **avoid-ai-writing** | conorbronsdon | 446 | 21 категория AI-паттернов + таблица из 43 замен. Прямо ловит «комплексный», «ландшафт», em-dash и т.д. |
| 🥈 | **write-skill** | aresbit | 44 | Альтернативный гайд на основе «AI writing characteristics» Wikipedia. Score 0.94. |
| 🥉 | **deai** | jacobdiaz | 0 | Минималистичный, быстрый чистильщик. |

```bash
# Топ-выбор:
mkdir -p .claude/skills/avoid-ai-writing
curl -sL https://raw.githubusercontent.com/conorbronsdon/avoid-ai-writing/main/SKILL.md \
  -o .claude/skills/avoid-ai-writing/SKILL.md
```

> ⚠️ После генерации каждого параграфа главы — прогонять через этот скил перед вставкой в `ВКР.docx`.

### 1.2. Академический ресёрч и литература (40-60 источников)

| # | Скил | Автор | ★ | Зачем |
|---|---|---|---|---|
| 🥇 | **academic-research-writer** | majiayu000 | 178 | Пишет академические разделы по гайдлайнам, тянет из Google Scholar. Score 0.95. |
| 🥈 | **paper-search** | malue-ai | 31 | Поиск по Semantic Scholar / CrossRef / DBLP, отдаёт BibTeX. |
| 🥉 | **literature-research-synthesis** | leeyuyun | 0 | Синтезирует литературу в structured citation-backed нарратив. |

```bash
mkdir -p .claude/skills/academic-research-writer
curl -sL https://raw.githubusercontent.com/majiayu000/claude-skill-registry/main/skills/data/academic-research-writer/SKILL.md \
  -o .claude/skills/academic-research-writer/SKILL.md
```

### 1.3. Сборка финального DOCX

| # | Скил | Автор | ★ | Зачем |
|---|---|---|---|---|
| 🥇 | **docx** | TerminalSkills | 26 | python-docx: параграфы, таблицы, заголовки, нумерованные списки, стили. Самое нужное для длинного документа с разделами. |
| 🥈 | **docx** | xcrrr | 1 | Тоже под длинные документы из outline'ов и шаблонов. Score 0.86. |

```bash
mkdir -p .claude/skills/docx
curl -sL https://raw.githubusercontent.com/TerminalSkills/skills/main/skills/docx/SKILL.md \
  -o .claude/skills/docx/SKILL.md
```

### 1.4. Презентация для защиты (нужна в мае)

| # | Скил | Автор | ★ | Зачем |
|---|---|---|---|---|
| 🥇 | **pptx-generation** | Zaoqu-Liu | 42 | Академические PPT через python-pptx. Score 0.98. |
| 🥈 | **academic-pptx** | Gabberflast | 253 | Заточен именно под thesis defense / conference talks. Score 0.91. |
| 🥉 | **thesis-slide-generator** | dietaler | 0 | Под defense slides из скриншотов/текста. Score 0.95. |

---

## 2. ПРОТОТИП — Solidity + dApp (Глава 3)

### 2.1. Смарт-контракты (язык + паттерны)

| # | Скил | Автор | ★ | Зачем |
|---|---|---|---|---|
| 🥇 | **web3-smart-contracts** | NeverSight | 113 | Solidity development + security review + audit + deploy. Score 0.99. |
| 🥈 | **proxy-upgrade-safety** | quillai-network | 95 | Для ERC-1967/UUPS/Transparent proxy — упгрейдабельность контрактов фонда. Score 0.99. |
| 🥉 | **blockchain-engineer** | jhm1909 | 3 | EVM + Solana, токеномика, DeFi. Score 0.93. |

### 2.2. Безопасность и аудит контрактов (для §3.4 «Тестирование»)

| # | Скил | Автор | ★ | Зачем |
|---|---|---|---|---|
| 🥇 | **solidity-security** | wshobson | 33043 | Самый популярный — основа от wshobson/agents (canonical Solidity security skill). |
| 🥈 | **exploiting-web3-smart-contracts** | trilwu | 13 | Reentrancy, integer overflow, access control, DeFi-specific vulns. Score 0.92. |
| 🥉 | **solidity-security** | Microck | 152 | То же ядро, более сжатый формат. |

### 2.3. Тестирование контрактов (Hardhat/Foundry)

| # | Скил | Автор | ★ | Зачем |
|---|---|---|---|---|
| 🥇 | **hardhat** | TerminalSkills | 26 | Установка окружения + написание/прогон тестов на Hardhat. Score 1.00. |
| 🥈 | **test-hardhat** | max-taylor | 2 | Узкоспециализированный: генерация comprehensive Hardhat test suite. Score 1.00. |
| 🥉 | **web3-testing** | wshobson | 33043 | Hardhat + Foundry + unit/integration/mainnet forking. Score 0.97. |
| 🥉 | **foundry-testing** | sablier-labs | 345 | Если решишь делать на Foundry: fuzz/invariant/fork тесты. |

### 2.4. Frontend dApp (React + wagmi + viem)

| # | Скил | Автор | ★ | Зачем |
|---|---|---|---|---|
| 🥇 | **wagmi** | TerminalSkills | 26 | React + wagmi + viem: подключение кошельков, чтение блокчейн-данных, отправка транзакций. Score 1.00. |
| 🥈 | **dapp-dev** | youugiuhiuh | 0 | Архитектура и best practices для Next.js + Wagmi + Viem + RainbowKit. Score 0.97. |
| 🥉 | **appkit** | reown-com | 1 | Reown AppKit (бывший WalletConnect) — если нужна максимально широкая поддержка кошельков. Score 0.89. |

### 2.5. Быстрая установка стека прототипа

```bash
cd /Users/artemdostalev/Documents/ВКР/ВКР
mkdir -p .claude/skills/{web3-smart-contracts,solidity-security,hardhat,wagmi}

# 1. Solidity core
curl -sL https://raw.githubusercontent.com/NeverSight/learn-skills.dev/main/data/skills-md/absolutelyskilled/absolutelyskilled/web3-smart-contracts/SKILL.md \
  -o .claude/skills/web3-smart-contracts/SKILL.md

# 2. Security (wshobson canonical)
curl -sL https://raw.githubusercontent.com/wshobson/agents/main/plugins/blockchain-web3/skills/solidity-security/SKILL.md \
  -o .claude/skills/solidity-security/SKILL.md

# 3. Hardhat (dev + test)
curl -sL https://raw.githubusercontent.com/TerminalSkills/skills/main/skills/hardhat/SKILL.md \
  -o .claude/skills/hardhat/SKILL.md

# 4. wagmi (frontend)
curl -sL https://raw.githubusercontent.com/TerminalSkills/skills/main/skills/wagmi/SKILL.md \
  -o .claude/skills/wagmi/SKILL.md
```

---

## 3. МОДЕЛИРОВАНИЕ (Главы 1-2 — диаграммы, схемы, ER, UML, BPMN, ArchiMate, Гант)

> 🔥 **Главная находка — `a5c-ai/babysitter` (★519)**. Целая библиотека из ~70 скилов под бизнес-информатику: business-analysis (18), project-management (20), decision-intelligence (32). См. отдельный раздел **§ 3.0** ниже — это приоритет №1 для глав 1-2. Скилы из § 3.1-3.4 — запасные/дополнительные.

### 3.0. Библиотека `a5c-ai/babysitter` (приоритет №1 для глав 1-2)

Все скилы — single `SKILL.md` без приложенных скриптов, легко устанавливаются по одному.
Базовый путь в репо: `library/specializations/domains/business/<sub>/skills/<name>/SKILL.md`

#### `business-analysis/skills/`

| Скил | Под раздел ВКР | Что делает |
|---|---|---|
| **bpmn-generator** ⭐ | §2.2-2.3 AS-IS / TO-BE | BPMN 2.0 XML из natural language; swimlanes; gap-detection; **AS-IS ↔ TO-BE comparison**; экспорт в Camunda/Bizagi/Signavio/draw.io |
| **value-stream-mapping** | §2.2 AS-IS поток | VSM для текущего процесса коллективного инвестирования |
| **gap-analysis-framework** | §1.4 / §2.3 | Выявление разрывов между AS-IS и TO-BE |
| **stakeholder-matrix-generator** | §1.3 стейкхолдеры | Матрица «власть/интерес» — инвесторы, проекты, площадка, регулятор |
| **requirements-quality-analyzer** | §2.4 спецификация | Проверка функциональных требований по INVEST/SMART/IEEE 830 |
| **user-story-writer** | §2.4 | User stories под платформу |
| **traceability-matrix-builder** | §2.4 / §3.4 | Трассировка «требование → реализация → тест» |
| **risk-register-builder** | §2.7 / §3.5 | Реестр рисков платформы |
| **financial-calculator** | §1.2 | Финансовые расчёты фонда (ROI, доходность) |
| **options-scoring** | §3.1 | Сравнительная оценка вариантов (Ethereum vs Polygon vs BSC) |

#### `project-management/skills/`

| Скил | Под раздел ВКР | Что делает |
|---|---|---|
| **gantt-chart-generator** ⭐ | §3.5 диаграмма Ганта | Прямой генератор Ганта (не Mermaid-обёртка) |
| **wbs-generator** | §3.5 | Иерархическая структура работ |
| **critical-path-analyzer** | §3.5 | Critical Path Method |
| **npv-irr-calculator** | §3.5 эффективность | NPV / IRR / payback period для фонда |
| **project-charter-generator** | §1.2 | Устав проекта |

#### `decision-intelligence/skills/`

| Скил | Под раздел ВКР | Что делает |
|---|---|---|
| **ahp-calculator** ⭐ | §3.1 выбор стека | Метод анализа иерархий (AHP) — классический инструмент бизнес-информатики для выбора блокчейн-платформы |
| **topsis-ranker** | §3.1 альтернатива AHP | TOPSIS multi-criteria ranking |
| **monte-carlo-engine** | §1.2 / §3.5 риски | Симуляция распределения исходов фонда |
| **sensitivity-analyzer** | §3.5 | Анализ чувствительности по ключевым параметрам |
| **kpi-tracker** | §3.5 эффективность | KPI платформы |

#### Установка одной командой (16 ключевых скилов)

```bash
cd /Users/artemdostalev/Documents/ВКР/ВКР

BASE="https://raw.githubusercontent.com/a5c-ai/babysitter/main/library/specializations/domains/business"

# business-analysis (10 скилов)
for s in bpmn-generator value-stream-mapping gap-analysis-framework \
         stakeholder-matrix-generator requirements-quality-analyzer \
         user-story-writer traceability-matrix-builder risk-register-builder \
         financial-calculator options-scoring; do
  mkdir -p ".claude/skills/$s"
  curl -sL "$BASE/business-analysis/skills/$s/SKILL.md" -o ".claude/skills/$s/SKILL.md"
done

# project-management (3 скила — Гант + WBS + NPV)
for s in gantt-chart-generator wbs-generator npv-irr-calculator; do
  mkdir -p ".claude/skills/$s"
  curl -sL "$BASE/project-management/skills/$s/SKILL.md" -o ".claude/skills/$s/SKILL.md"
done

# decision-intelligence (3 скила — AHP + TOPSIS + Monte-Carlo)
for s in ahp-calculator topsis-ranker monte-carlo-engine; do
  mkdir -p ".claude/skills/$s"
  curl -sL "$BASE/decision-intelligence/skills/$s/SKILL.md" -o ".claude/skills/$s/SKILL.md"
done
```

> Альтернатива: `git clone https://github.com/a5c-ai/babysitter.git /tmp/babysitter && ln -s /tmp/babysitter/library/specializations/domains/business/business-analysis/skills/bpmn-generator .claude/skills/bpmn-generator` — но симлинки на скилы не всегда подхватываются Claude Code.

---

### 3.1. BPMN / процессное моделирование — запасные варианты

> Основной — `bpmn-generator` из § 3.0. Эти — на случай если нужны альтернативные подходы.

| # | Скил | Автор | ★ | Зачем |
|---|---|---|---|---|
| 🥇 | **bpmn-generator** | a5c-ai | 519 | См. § 3.0 — главный |
| 🥈 | **process-modeling** | spjoshis | 4 | BPMN + flowcharts + swimlane + process improvement (Mermaid-based) |
| 🥉 | **functional-diagrams** | Tyler-R-Kendrick | 6 | DFD/IDEF0/BPMN |
| 🥉 | **business-process-modeling-bpmn** | JH9282026 | 0 | BPMN 2.0 documentation, simulation, automation planning |
| 🥉 | **business-analyst-authority** | ahmedemad3 | 30 | Principal BA: Gherkin/BDD + BPMN 2.0 + Requirement Engineering |

### 3.2. UML и общие диаграммы (§2.5, §3.2 архитектура)

| # | Скил | Автор | ★ | Зачем |
|---|---|---|---|---|
| 🥇 | **draw-io-diagram-generator** ⭐ | github | 28627 | **GitHub-официальный, production-grade.** Генерит `.drawio` файлы напрямую: flowchart, architecture, sequence, ER, UML class, network topology, **BPMN workflow**. С приложениями: 5 templates, Python-валидатор, 3 reference-документа (mxGraph schema, shape libraries, style strings). Под §2.5/§2.6/§3.2 — оптимальный путь, потому что draw.io — стандарт для ВКР по бизнес-информатике HSE. См. § 3.5. |
| 🥈 | **uml-diagramming** | antoinebou12 | 78 | Mermaid + PlantUML код. Использовать когда диаграмма должна попасть в текст работы напрямую через Mermaid (а не PNG-картинкой). |
| 🥉 | **mermaid-expert** | sickn33 | 30937 | Mermaid: flowchart, sequence, ERD, architecture. Самый звёздный по mermaid. |
| 🥉 | **plantuml-ascii** | github | 28627 | PlantUML, если используешь его в работе. |

> ⚠️ `q=archimate` дал **0** ArchiMate-специфичных скилов. **Но**: draw.io имеет встроенную **ArchiMate shape library**, и `draw-io-diagram-generator` знает о ней через `references/shape-libraries.md`. Это не полноценный Archi.exe, но визуально достаточно для §3.2 ВКР — генеришь draw.io скелет с ArchiMate элементами, потом доводишь руками в draw.io VS Code extension.

### 3.2A. Draw.io генератор — когда какой формат

| Задача | Какой скил | Формат |
|---|---|---|
| §2.2-2.3 BPMN AS-IS / TO-BE для рецензента | **`bpmn-generator`** (a5c-ai) | строгий BPMN 2.0 XML, экспорт в Camunda/Bizagi/Signavio |
| §2.2-2.3 BPMN сразу в `.drawio` для приложений | **`draw-io-diagram-generator`** (github) | `.drawio` с BPMN shape library |
| §2.5 UML use case / sequence / class / component | **`draw-io-diagram-generator`** (github) | `.drawio` (есть templates) |
| §2.6 ER-модель | **`draw-io-diagram-generator`** (github) + **`data-modeling`** (a5c-ai для логики) | `.drawio` с ER template |
| §3.2 Архитектура (multi-tier) | **`draw-io-diagram-generator`** (github) | `.drawio` architecture template |
| §3.2 ArchiMate | **`draw-io-diagram-generator`** + ArchiMate shape library + ручная доводка | `.drawio` |
| Диаграмма прямо в DOCX через mermaid-фигуру | **`uml-diagramming`** (antoinebou12) | Mermaid код |

### 3.3. ER-модели и проектирование БД (§2.6)

| # | Скил | Автор | ★ | Зачем |
|---|---|---|---|---|
| 🥇 | **data-modeling** | AlbertoBasaloLabs | 1 | Чисто ER-моделирование под спецификацию фич. Score 0.93. Идеально под §2.6. |
| 🥈 | **db-schema** | zeon-kun | 2 | Реляционные/документные схемы + индексы + миграции. Score 0.87. |
| 🥉 | **database-architect** | majiayu000 | 3 | Архитектура БД, scalability, microservices. Score 0.85. |

### 3.5. Установка `draw-io-diagram-generator` (отдельной командой — у скила есть приложения)

Этот скил **не одиночный** SKILL.md — у него scripts/, references/, assets/templates/. Установка через sparse checkout:

```bash
cd /Users/artemdostalev/Documents/ВКР/ВКР

# Скачать всю папку скила (без полного клона репо)
mkdir -p /tmp/ac && cd /tmp/ac
curl -sL https://github.com/github/awesome-copilot/archive/refs/heads/main.tar.gz | \
  tar xz --strip-components=1 awesome-copilot-main/skills/draw-io-diagram-generator
mkdir -p /Users/artemdostalev/Documents/ВКР/ВКР/.claude/skills/
cp -r skills/draw-io-diagram-generator \
      /Users/artemdostalev/Documents/ВКР/ВКР/.claude/skills/
cd /Users/artemdostalev/Documents/ВКР/ВКР && rm -rf /tmp/ac

# Проверить что встало
ls .claude/skills/draw-io-diagram-generator/
# Должно быть: SKILL.md  assets/  references/  scripts/
```

Альтернатива через git sparse-checkout (если первый способ не сработал):
```bash
git clone --depth=1 --filter=blob:none --sparse \
  https://github.com/github/awesome-copilot.git /tmp/awesome-copilot
cd /tmp/awesome-copilot && git sparse-checkout set skills/draw-io-diagram-generator
cp -r skills/draw-io-diagram-generator \
      /Users/artemdostalev/Documents/ВКР/ВКР/.claude/skills/
cd - && rm -rf /tmp/awesome-copilot
```

После установки скил активируется триггерами вида: «нарисуй sequence-диаграмму», «сделай ER модель», «создай архитектурную диаграмму», «сгенерируй .drawio».

### 3.6. Гант для §3.5 (диаграмма Ганта в эффективности)

| # | Скил | Автор | ★ | Зачем |
|---|---|---|---|---|
| 🥇 | **grant-gantt-chart-gen** | openclaw | 3823 | Прямо генерация Gantt для grant proposals — формально про гранты, но Gantt для ВКР такой же. |
| 🥈 | **pretty-mermaid** | openclaw | 3823 | Красивые Mermaid Gantt с темами/стилями. |
| 🥉 | **mermaid-diagram** | wanshuiyin | 5594 | Базовый Mermaid с сохранением `.mmd`/`.md`, валидация синтаксиса. |

> Mermaid-Gantt — самый простой путь: текстовое описание + автогенерация SVG, потом импорт картинкой в DOCX.

---

## 4. Минимально необходимый набор (если ставить только то, без чего нельзя)

Если хочется поставить **5-6 скилов и не больше**, бери эти:

```bash
cd /Users/artemdostalev/Documents/ВКР/ВКР
mkdir -p .claude/skills/{avoid-ai-writing,academic-research-writer,docx,solidity-security,hardhat,wagmi,uml-diagramming,data-modeling}
```

| Скил | Зачем нельзя без него |
|---|---|
| **avoid-ai-writing** (conorbronsdon) | §15.3 PROJECT_CONTEXT.md строго запрещает AI-isms — без этого скила Originality.ai/GPTZero завалят работу. |
| **academic-research-writer** (majiayu000) | Автор глав 1-3 в академическом регистре. |
| **docx** (TerminalSkills) | Сборка `Текст_ВКР/ВКР.docx` в правильном формате (Times New Roman 14, заголовки, таблицы, оглавление). |
| **solidity-security** (wshobson) | Без security-чеков ни §3.3 «Реализация», ни §3.4 «Тестирование» нормально не пройдут. |
| **hardhat** (TerminalSkills) | Среда разработки + тесты для прототипа. |
| **wagmi** (TerminalSkills) | Минимальный фронт для демо платформы коллективного инвестирования. |
| **draw-io-diagram-generator** (github ★28627) | Все диаграммы в `.drawio`: UML (§2.5), ER (§2.6), архитектура (§3.2), BPMN-fallback. Стандарт draw.io ожидает рецензент. |
| **uml-diagramming** (antoinebou12) | Mermaid/PlantUML — для диаграмм, которые должны попасть прямо в текст ВКР. |
| **data-modeling** (AlbertoBasaloLabs) | ER-логика для §2.6 (потом отрисовать через draw-io). |

---

## 5. Что искалось безуспешно (закрывать руками)

| Тема | Почему пусто | Чем закрывать |
|---|---|---|
| ~~**BPMN** (`q=bpmn` fts)~~ | ~~Якобы пусто~~ | **Это была моя ошибка** в первом прогоне (не та комбинация sortBy/limit). На маркетплейсе **есть** прямой `bpmn-generator` от `a5c-ai/babysitter` ★519 — см. § 3.0. |
| **ArchiMate** (`q=archimate` fts) | Нет ArchiMate-специфичных скилов | Archi.exe вручную; для логики использовать `uml-diagramming` |
| **`draw use case sequence component diagram`** (ai) | LLM-перефразировка не нашла семантической пары | Использовать конкретные имена: `q=mermaid` + `q=plantuml` напрямую |
| **`project planning timeline`** (ai) | Слишком абстрактно | `q=gantt` через fts → `gantt-chart-generator` (a5c-ai/babysitter) |

---

## 6. Что НЕ ставить

- Дубли `solidity-security` от форков (mattmre, Udith-creates, oynozan, AI-Foundry-Core, EngineerWithAI) — это все клоны wshobson/Microck. Бери один.
- `nutrient-document-processing` — это про OCR/PDF обработку через платный API, не про создание ВКР.
- `feishu-doc` — китайский Feishu Cloud, не Word.
- `frontend-slides` (affaan-m) — генерит HTML презентации с анимациями, не для академической защиты.
- `humanize-ai-text` (carterdea, bbanho) — позиционируется как «обход детекторов», но без объяснения паттернов; `avoid-ai-writing` (conorbronsdon) делает то же качественнее.

---

## 7. Workflow «использовать скилы под каждый раздел ВКР»

| Раздел | Активные скилы |
|---|---|
| **Введение → Главы 1-3 (генерация)** | `academic-research-writer` |
| **После каждого параграфа** | `avoid-ai-writing` (обязательно) |
| **§1.3 стейкхолдеры** | `stakeholder-matrix-generator` (a5c-ai) |
| **§2.2-2.3 BPMN AS-IS / TO-BE** | `bpmn-generator` (a5c-ai) ⭐ + `value-stream-mapping` (a5c-ai) + `gap-analysis-framework` (a5c-ai) |
| **§2.4 спецификация требований** | `requirements-quality-analyzer` (a5c-ai) + `user-story-writer` (a5c-ai) + `traceability-matrix-builder` (a5c-ai) |
| **§2.5 UML use case / sequence / component / class** | `draw-io-diagram-generator` (github) ⭐ + `uml-diagramming` (Mermaid backup) |
| **§2.6 ER-модель данных** | `data-modeling` (логика) + `draw-io-diagram-generator` (отрисовка) |
| **§3.1 Выбор стека** | `ahp-calculator` (a5c-ai) ⭐ + `options-scoring` (a5c-ai) + `web3-smart-contracts`, `wagmi` (для аргументации) |
| **§3.2 Архитектура** | `draw-io-diagram-generator` (github) ⭐ для multi-tier + ArchiMate shape library + `uml-diagramming` для C4 |
| **§3.3 Реализация прототипа** | `web3-smart-contracts`, `proxy-upgrade-safety`, `hardhat`, `wagmi` |
| **§3.4 Тестирование** | `hardhat` + `solidity-security` + `web3-testing` (wshobson) |
| **§3.5 Эффективность + Гант** | `gantt-chart-generator` (a5c-ai) ⭐ + `npv-irr-calculator` (a5c-ai) + `monte-carlo-engine` (a5c-ai) + `risk-register-builder` (a5c-ai) |
| **Заключение** | `academic-research-writer` + `avoid-ai-writing` |
| **Сборка `ВКР.docx`** | `docx` (TerminalSkills) |
| **Презентация защиты** | `pptx-generation` (Zaoqu-Liu) или `academic-pptx` (Gabberflast) |

---

**Источник:** прогон `/tmp/skillsmp_hunt.py` (12 категорий × 3-7 запросов = 43 запроса fts+ai). Полный сырой отчёт с 320 скилами — в `/tmp/skillsmp_report.txt`.
**Дата прогона:** 2026-04-08.

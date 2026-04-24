# BPMN Toolchain: JSON -> XML / Promela / SMV / UPPAAL

Инструментарий для построения, валидации и формальной верификации BPMN-моделей бизнес-процессов. Каждая модель проходит 5-шаговый пайплайн проверки.

## Содержимое

| Файл | Назначение |
|---|---|
| `bpmn_json2xml.py` | JSON -> BPMN 2.0 XML + чеклист валидации (17 проверок) |
| `bpmn_json2promela.py` | JSON -> Promela (.pml) + SPIN-верификация (LTL + deadlock) |
| `bpmn_json2smv.py` | JSON -> NuSMV/nuXmv (.smv) — CTL-верификация (soundness) |
| `bpmn_json2uppaal.py` | JSON -> UPPAAL (.uppaal.xml) — TCTL + тайминг |
| `.bpmnlintrc` | Конфигурация правил bpmnlint (npm) |
| `bpmn_as_is.json` | Модель AS-IS (3 пула, классический краудфандинг) |
| `bpmn_to_be.json` | Модель TO-BE (4 пула, токенизированный фонд) |

---

## 1. Формат JSON-модели

Все модели описываются в едином JSON-формате. Это источник истины, из которого генерируются и XML, и Promela.

### Корневая структура

```json
{
  "id": "MODEL_ID",
  "name": "Описание модели",
  "pools": [ ... ],
  "messageFlows": [ ... ]
}
```

### Пул (pool)

Каждый пул = один участник процесса (lane не используются).

```json
{
  "id": "Participant_Author",
  "name": "Автор проекта",
  "processId": "Process_Author",
  "bounds": [x, y, width, height],
  "elements": [ ... ],
  "flows": [ ... ],
  "annotations": [ ... ]
}
```

| Поле | Тип | Описание |
|---|---|---|
| `id` | string | Уникальный ID участника (Participant_*) |
| `name` | string | Отображаемое имя пула |
| `processId` | string | ID процесса (Process_*) — используется в Promela |
| `bounds` | [x, y, w, h] | Координаты и размер пула на диаграмме |
| `elements` | array | Элементы BPMN внутри пула |
| `flows` | array | Sequence flows (потоки управления) внутри пула |
| `annotations` | array | Текстовые аннотации |

### Элемент (element)

```json
{
  "id": "aCreate",
  "type": "userTask",
  "name": "Создать кампанию + milestones",
  "pos": [280, 120],
  "size": [160, 80]
}
```

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| `id` | string | да | Уникальный ID (ASCII, без пробелов) |
| `type` | string | да | Тип элемента (см. таблицу ниже) |
| `name` | string | для задач | Название (отображается на диаграмме) |
| `pos` | [x, y] | да | Координаты верхнего левого угла |
| `size` | [w, h] | нет | Размер (по умолчанию: задачи 140x80, события 36x36, шлюзы 50x50) |
| `trigger` | string | нет | Триггер события: `"message"`, `"timer"`, `"signal"` |
| `signalRef` | string | для signal | ID сигнала из массива `signals` |
| `attachedToRef` | string | для boundary | ID задачи, к которой прикреплено событие |

**Поддерживаемые типы элементов:**

| Тип | BPMN-нотация | Пример |
|---|---|---|
| `startEvent` | Начальное событие (тонкий круг) | Начало процесса |
| `endEvent` | Конечное событие (жирный круг) | Завершение / signal throw |
| `intermediateCatchEvent` | Промежуточное событие-приём | Таймер, message catch, signal catch |
| `boundaryEvent` | Граничное событие на задаче | Прерывание задачи при сигнале |
| `userTask` | Пользовательская задача | Создать кампанию |
| `serviceTask` | Сервисная задача | deploy(), transfer() |
| `manualTask` | Ручная задача | Физическая работа |
| `exclusiveGateway` | XOR-шлюз (ромб с X) | Решение / слияние |
| `eventBasedGateway` | Шлюз на основе событий (ромб с пентагоном) | Гонка message vs signal |

### Сигналы (signals)

```json
{
  "signals": [
    {"id": "Signal_CampaignFailed", "name": "CampaignFailed"}
  ]
}
```

Сигнал = broadcast-событие. Один процесс бросает (`endEvent` с `trigger: "signal"`), все остальные ловят (`intermediateCatchEvent`, `boundaryEvent`).

### Event-based gateway

Гонка между несколькими catch-событиями. Какое событие наступит первым — туда уходит токен.

```json
{"id": "gwAuthorEvt", "type": "eventBasedGateway", "pos": [1800, 145]}
```

Потоки из event-based gateway не требуют подписей условий (в отличие от exclusiveGateway).

### Boundary event

Граничное событие прикреплено к задаче. Если сигнал приходит во время выполнения задачи — задача прерывается, токен уходит по альтернативному пути.

```json
{
  "id": "pBoundarySignal",
  "type": "boundaryEvent",
  "trigger": "signal",
  "signalRef": "Signal_CampaignFailed",
  "attachedToRef": "pVerify",
  "pos": [1807, 412]
}
```

### Sequence flow

```json
{
  "id": "Flow_a1",
  "from": "aStart",
  "to": "aCreate",
  "name": "Да (i = n)",
  "waypoints": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
}
```

| Поле | Обязательное | Описание |
|---|---|---|
| `id` | да | Уникальный ID потока |
| `from` | да | ID элемента-источника |
| `to` | да | ID элемента-приёмника |
| `name` | для split-шлюзов | Подпись условия на ребре |
| `waypoints` | нет | Явные точки маршрута (если не задано — автоматически) |

**Важно:** `from` и `to` должны быть в **одном пуле**. Для связи между пулами используйте `messageFlows`.

### Message flow

```json
{
  "id": "MF_deploy",
  "name": "deploy",
  "from": "pModerate",
  "to": "scStart",
  "waypoints": [[x1,y1], [x2,y2]]
}
```

Message flow = пунктирная стрелка **между разными пулами**. Не несёт токен BPMN — только данные/сигналы.

### Аннотация

```json
{
  "id": "Ann_escrow",
  "text": "Эскроу — средства заблокированы в смарт-контракте",
  "target": "scMint",
  "pos": [640, 625],
  "size": [240, 50]
}
```

---

## 2. Правила построения модели

### 2.1 Обязательные правила (ошибки)

1. **Каждый процесс** (пул) должен иметь хотя бы один `startEvent` и один `endEvent`
2. **Все ID уникальны** — среди элементов, потоков, участников, аннотаций
3. **Sequence flow** — только внутри одного пула (`from` и `to` в одном пуле)
4. **Message flow** — только между разными пулами
5. **startEvent** — должен иметь хотя бы один исходящий поток
6. **endEvent** — должен иметь хотя бы один входящий поток
7. **Задачи** — должны иметь и входящий, и исходящий поток
8. **Нет висящих элементов** — все элементы достижимы от startEvent и ведут к endEvent (токен-анализ)
9. **Нет дублирующих потоков** — пара (from, to) уникальна
10. **Message flow** не подключается к шлюзам

### 2.2 Шлюзы (exclusiveGateway)

Шлюз может быть **split** (разветвление) или **merge** (слияние):

| Роль | Входящие | Исходящие | Подписи |
|---|---|---|---|
| Split | 1 | >= 2 | Каждый исходящий поток должен иметь `name` с условием |
| Merge | >= 2 | 1 | Подпись не требуется |

**Типичный паттерн цикла** (milestone loop):

```
                       "Нет (i < n)"
               +----------------------------+
               |                            |
               v                            |
... ---> <gwMerge> ---> [задача] ---> <gwSplit "Последний этап?">
                                            |
                                            | "Да (i = n)"
                                            v
                                        (endEvent)
```

- `<gwMerge>` (без `name`) — merge-шлюз, принимает поток из начала + loop-back
- `<gwSplit>` (с `name`) — split-шлюз, разветвляет: "Да" вниз к концу, "Нет" назад к merge
- Обозначения: `( )` = событие, `[ ]` = задача, `< >` = шлюз

**Типичный паттерн решения** (decision):

```
                                        "Да"
... ---> <gwDecision "Сумма >= цели?"> --------> [продолжить] ---> ...
                    |
                    | "Нет"
                    v
              [refund_all()] ---> (endFail)
```

### 2.3 Синхронизация между пулами

Каждый пул — **отдельный независимый процесс** со своим токеном. Токены в разных пулах не связаны напрямую. Синхронизация происходит **только** через message flow (пунктирные стрелки).

Message flow при получении **блокирует** токен процесса-получателя до тех пор, пока процесс-отправитель не отправит сообщение. Это обеспечивает порядок выполнения между пулами.

**Пример синхронизации** (TO-BE модель, одна итерация):

```
Автор         Платформа        Смарт-контракт       Инвестор
  |               |                  |                  |
  | --заявка----> |                  |                  |
  |               | ---deploy------> |                  |
  |               |                  | <--invest()---   |
  |               |                  |    (ждёт)        |
  |               |                  |    scTimer       |
  |               |                  |    scGoal        |
  |               | ---voteNotify----|----------------> |
  |               |                  | <--vote()-----   |
  |               |                  |    scQuorum      |
  | <-------------|------------------| ---bi (бюджет)   |
  |  (разблокирован)                 |                  |
  |  aReceive     |                  |                  |
```

Токен Author'а **стоит** на `aReceive`, пока SC не отправит `MF_bi`. SC не может отправить `MF_bi`, пока не получит `MF_invest` от Investor'а и `MF_vote`. Таким образом, milestone-цикл Author'а не может "убежать вперёд" — каждая итерация требует полного прохождения цепочки invest -> vote -> transfer.

### 2.4 Координаты и размеры

- `bounds` пула: `[x, y, width, height]` — все элементы должны быть внутри
- Пулы не должны перекрываться
- Стандартные размеры: задачи 140x80, события 36x36, шлюзы 50x50
- Waypoints для обратных петель задаются явно (массив координат)

### Правила рисования ASCII-схем

При документировании процессов в текстовом виде используйте следующие обозначения:

```
Обозначения:
  (event)       — событие (круг): (start), (end), (endFail)
  [task]        — задача (прямоугольник): [Создать кампанию]
  <gateway>     — шлюз (ромб): <Последний этап?>

Стрелки:
  --->          — горизонтальный поток (слева направо)
  |             — вертикальный участок
  v             — направление вниз
  ^             — направление вверх
  +----+        — угол поворота (через +)
```

**Пример — полный процесс Author'а:**

```
                          "Нет (i < n)"
                  +-------------------------------------+
                  |                                     |
                  v                                     |
(aStart) ---> [Создать] ---> <gwMerge> ---> [Работа] ---> [Отчёт] ---> [bi] ---> <Последний?>
                                                                                    |
                                                                                    | "Да"
                                                                                    v
                                                                                 (aEnd)
```

### 2.5 Именование ID

Рекомендуемые конвенции:

| Тип | Шаблон | Пример |
|---|---|---|
| Пул | `Participant_<Role>` | `Participant_Author` |
| Процесс | `Process_<Role>` | `Process_Author` |
| Элемент | `<prefix><Name>` | `aCreate`, `scDeploy`, `iKYC` |
| Merge-шлюз | `gw<Role>Merge` | `gwAuthorMerge` |
| Loop-шлюз | `gw<Role>Loop` | `gwAuthorLoop` |
| Поток | `Flow_<prefix><num>` | `Flow_a1`, `Flow_s7b` |
| Message flow | `MF_<name>` | `MF_deploy`, `MF_vote` |
| Fail end event | `<prefix>EndFail<N>` | `scEndFail1` — signal throw end event |
| Signal catch | `<prefix>SignalCatch` | `aSignalCatch` |
| Event-based GW | `gw<Role>Evt` | `gwAuthorEvt` |
| Boundary event | `<prefix>Boundary<Trigger>` | `pBoundarySignal` |

**Важно для верификации:** конечные события с `trigger: "signal"` и `signalRef` автоматически бросают broadcast-сигнал. Все catch-события с тем же `signalRef` в других процессах реагируют на него — это моделирует blockchain event.

---

## 3. Пайплайн валидации (5 шагов)

Каждая модель **обязательно** проходит все 5 шагов. Результат считается корректным только при 0 ошибок на каждом шаге.

```
JSON-модель
  |
  +---> [Шаг 1] bpmn_json2xml.py ---- 17 структурных проверок ---- .bpmn
  |
  +---> [Шаг 2] npx bpmnlint -------- 15 правил BPMN 2.0 --------- OK/WARN
  |
  +---> [Шаг 3] bpmn_json2promela.py - SPIN: LTL + deadlock ------- .pml
  |
  +---> [Шаг 4] bpmn_json2smv.py ---- nuXmv: CTL soundness ------- .smv
  |
  +---> [Шаг 5] bpmn_json2uppaal.py - UPPAAL: TCTL + тайминг ----- .uppaal.xml
```

### Шаг 1. Генерация BPMN XML + валидация (17 проверок)

```bash
python3 bpmn_json2xml.py model.json
```

Генерирует `model.bpmn` и проверяет:

| # | Проверка |
|---|---------|
| 1 | ID элементов уникальны |
| 2 | Sequence flow source/target в одном пуле |
| 3 | Message flows между разными пулами |
| 4 | Все startEvent имеют outgoing |
| 5 | Все endEvent имеют incoming |
| 6 | Шлюзы корректны (split ≥2 out или merge ≥2 in) |
| 7 | Шлюзы имеют ≥1 входящий поток |
| 8 | Потоки из split-шлюзов имеют подписи условий |
| 9 | Все элементы в пределах своих пулов |
| 10 | Цели аннотаций существуют |
| 11 | Пулы не перекрываются |
| 12 | Нет дублирующих sequence flows |
| 13 | Все процессы имеют start и end events |
| 14 | Message flows не подключены к шлюзам |
| 15 | Все задачи имеют имена |
| 16 | Токен: все элементы достижимы от start и ведут к end |
| 17 | Все задачи имеют входящий и исходящий потоки |

При наличии FAIL файл не генерируется.

### Шаг 2. Внешний линтинг (bpmnlint)

```bash
npx bpmnlint model.bpmn
```

15 правил из `.bpmnlintrc`: структура шлюзов, подписи, disconnected-элементы. Допустимо: warnings на отсутствие подписей у start/end events.

### Шаг 3. SPIN — LTL + deadlock freedom

```bash
python3 bpmn_json2promela.py model.json --verify
```

| Свойство | Формула | Что проверяет |
|---|---|---|
| Deadlock freedom | `-noclaim` (invalid end states) | Нет зависаний — всегда есть переход |
| Liveness (LTL) | `<>(state == DONE)` | Каждый процесс **обязательно** завершится |

SPIN использует **explicit state enumeration** — перебирает все возможные чередования процессов. Опции: `--max-milestones N` (по умолчанию 3).

### Шаг 4. nuXmv (NuSMV) — CTL soundness

```bash
python3 bpmn_json2smv.py model.json --verify
```

| Свойство | Формула (CTL) | Что проверяет |
|---|---|---|
| Liveness | `AF (state = DONE)` | Каждый процесс обязательно завершится |
| **Soundness** | `AG (!(state = DONE) -> AF (state = DONE))` | **Из любого достижимого состояния** можно завершиться |
| Deadlock freedom | `AG (EX TRUE)` | Всегда существует следующее состояние |
| Liveness (LTL) | `F (state = DONE)` | Перекрёстная проверка с SPIN |

nuXmv использует **BDD-символьную верификацию** — кодирует пространство состояний как булеву формулу. Ключевое отличие от SPIN: **CTL-свойство soundness** (`AG(!DONE -> AF DONE)`) — SPIN не может его проверить.

Установка nuXmv (однократно):
```bash
# Скачать с https://nuxmv.fbk.eu/ -> macOS universal binary
# Распаковать и добавить bin/ в PATH
```

### Шаг 5. UPPAAL — TCTL + тайминг (опционально)

```bash
python3 bpmn_json2uppaal.py model.json --verify
```

| Свойство | Формула (TCTL) | Что проверяет |
|---|---|---|
| Deadlock freedom | `A[] not deadlock` | Нет тупиков в тайминговой модели |
| Liveness | `A<> Process.DONE` | Завершение с учётом реального времени |
| **Timing** | `A[] (timer imply timer <= 60)` | Таймеры не превышают лимит |

UPPAAL уникален поддержкой **clock constraints** — можно задать и проверить `"fundraising timer <= 60 days"`.

Установка UPPAAL: https://uppaal.org/downloads/ (требуется регистрация).

### Визуализация результата

| Формат | Инструмент |
|--------|-----------|
| `.bpmn` | bpmn.io (онлайн), Camunda Modeler, VS Code "BPMN Editor" |
| `.pml` | VS Code "Promela/Spin", iSpin GUI |
| `.smv` | VS Code, любой текстовый редактор |
| `.uppaal.xml` | UPPAAL GUI |

---

## 4. Как работает формальная верификация

### 4.1 Маппинг BPMN -> формальные модели

| BPMN | Promela (SPIN) | SMV (nuXmv) | UPPAAL |
|---|---|---|---|
| Пул | `active proctype` | переменная состояния + `turn` | `<template>` |
| Элемент | `mtype` состояние | enum значение | `<location>` |
| Sequence flow | `state = next` | `next(state) := case...esac` | `<transition>` |
| Message flow | `chan ch = [1] of {bit}` | `boolean ch` | `chan ch` |
| Signal broadcast | `bool sig_X = true` | `bool sig_X` | `broadcast chan` |
| Event-based GW | `if :: ch?1 -> A :: sig -> B fi` | `state & ch : A; state & sig : B` | два `<transition>` с sync |
| Boundary event | `if :: true -> normal :: sig -> boundary fi` | nondeterministic + guard | `<transition>` с sync |
| XOR split (решение) | `if :: true -> A :: true -> B fi` | `{A, B}` nondeterministic | два `<transition>` |
| XOR split (цикл) | `if :: (i<MAX) -> loop :: (i>=MAX) -> exit fi` | guard на milestone | guard на milestone |
| Timer catch | `skip` | `skip` | `clock timer; guard: timer >= 30` |

### 4.2 Обработка отказов (signal-based failure propagation)

Signal end events моделируют **broadcast-событие блокчейна** — когда смарт-контракт делает refund, все участники видят это on-chain.

**BPMN (JSON):** `endEvent` с `trigger: "signal"` и `signalRef`:
```json
{"id": "scEndFail1", "type": "endEvent", "trigger": "signal", "signalRef": "Signal_CampaignFailed"}
```

**Promela:** сигнальный флаг устанавливается при достижении end event:
```promela
bool sig_Signal_CampaignFailed = false;
...
:: (Process_SC_state == scEndFail1) ->
   sig_Signal_CampaignFailed = true;
   Process_SC_state = DONE; break;
```

**Event-based gateway** — гонка между сообщением и сигналом:
```promela
:: (Process_Author_state == gwAuthorEvt) ->
   if
   :: ch_MF_bi ? 1 ->               /* нормальный путь: получить бюджет */
      Process_Author_state = aMsgCatch;
   :: (sig_Signal_CampaignFailed) -> /* отказ: сигнал от SC */
      Process_Author_state = aSignalCatch;
   fi;
```

**Boundary event** — прерывание задачи при сигнале:
```promela
:: (Process_Platform_state == pVerify) ->
   if
   :: true ->                         /* нормальное завершение */
      Process_Platform_state = pStartVote;
   :: (sig_Signal_CampaignFailed) ->  /* прерывание: сигнал */
      Process_Platform_state = pBoundarySignal;
   fi;
```

### 4.3 Сравнение инструментов

| Инструмент | Скорость | Логика | Уникальная проверка |
|---|---|---|---|
| bpmnlint | мгновенно | синтаксис | структура BPMN 2.0 |
| SPIN | < 1 сек | LTL | `<>(DONE)` — liveness через explicit state |
| nuXmv | < 1 сек | CTL + LTL | `AG(!DONE -> AF DONE)` — soundness (BDD) |
| UPPAAL | секунды | TCTL | `timer <= 60` — тайминг (clock constraints) |

---

## 5. Полная команда запуска (все 5 шагов)

```bash
MODEL=bpmn_to_be

# Шаг 1: Валидация + генерация XML (17 проверок)
python3 bpmn_json2xml.py ${MODEL}.json

# Шаг 2: Внешний линтинг (15 правил)
npx bpmnlint ${MODEL}.bpmn

# Шаг 3: SPIN — LTL liveness + deadlock freedom
python3 bpmn_json2promela.py ${MODEL}.json --verify

# Шаг 4: nuXmv — CTL soundness + liveness + deadlock
python3 bpmn_json2smv.py ${MODEL}.json --verify

# Шаг 5 (опционально): UPPAAL — TCTL + тайминг
python3 bpmn_json2uppaal.py ${MODEL}.json --verify
```

**Ожидаемый результат для TO-BE модели:**

| Шаг | Результат |
|-----|----------|
| 1. bpmn_json2xml | 17/17 PASS, 0 FAIL, 0 WARN |
| 2. bpmnlint | 0 errors, 13 warnings (нет подписей у start/end — OK) |
| 3. SPIN | 5/5 PASS (deadlock + 4 LTL) |
| 4. nuXmv | 13/13 PASS (deadlock + 4 AF liveness + 4 AG soundness + 4 F liveness) |
| 5. UPPAAL | модель готова, требуется verifyta |

---

## 6. Установка инструментов

```bash
# Node.js + bpmnlint (однократно)
npm install

# SPIN
brew install spin

# nuXmv — скачать с https://nuxmv.fbk.eu/
# Распаковать и добавить bin/nuXmv в PATH:
export PATH="/path/to/nuXmv-2.1.0-macos-universal/bin:$PATH"

# UPPAAL (опционально) — https://uppaal.org/downloads/
```

---

## 7. Частые ошибки и как их исправить

| Ошибка | Причина | Решение |
|---|---|---|
| `[2] FAIL: flow not in same pool` | Sequence flow между пулами | Используйте `messageFlows` |
| `[6] FAIL: gateway <2 out and <2 in` | Шлюз ни split, ни merge | Добавьте второй out (split) или in (merge) |
| `[16] FAIL: unreachable from start` | Изолированный элемент | Добавьте sequence flow к цепочке |
| `fake-join (bpmnlint)` | 2+ incoming без merge-шлюза | Добавьте `exclusiveGateway` перед элементом |
| `SPIN: deadlock detected` | Блокировка на channel | Проверьте: signal end events уведомляют зависимые процессы |
| `SPIN: LTL terminates FAIL` | Бесконечный цикл | Проверьте: milestone_i растёт, MAX_MILESTONES достижим |
| `nuXmv: AF DONE is false` | Starvation (unfair scheduler) | Добавьте `FAIRNESS turn = t_Process_X` |
| `nuXmv: multiple declaration` | Конфликт имён turn vs state | Turn-значения должны иметь префикс `t_` |

# Промпт для Claude Code: Разработка прототипа токенизированной краудфандинговой платформы

## Контекст проекта

Это прототип для бакалаврской работы (ВКР) на тему "Разработка алгоритма и прототипа токенизированного фонда коллективного инвестирования". Платформа объединяет Web2-интерфейс для обычных пользователей и блокчейн-бэкенд на Ethereum/Polygon для прозрачности и автоматизации.

Стек: Hardhat + Solidity (смарт-контракты), Node.js + Express (бэкенд), React + ethers.js (фронтенд), PostgreSQL (БД), локальный блокчейн Hardhat Network для тестов.

---

## Задача

Создай полный рабочий прототип платформы токенизированного краудфандинга с milestone-based эскроу. Структура проекта - монорепо. Все должно запускаться локально одной командой.

---

## 1. Структура проекта

```
crowdfund-platform/
├── contracts/                # Solidity смарт-контракты
│   ├── FundFactory.sol       # Фабрика контрактов кампаний
│   ├── CrowdFund.sol         # Основной контракт кампании
│   └── InvestToken.sol       # ERC-1155 токен инвестора
├── test/                     # Тесты на Hardhat (Chai + ethers)
│   ├── CrowdFund.test.js     # Тесты контракта кампании
│   ├── FundFactory.test.js   # Тесты фабрики
│   └── InvestToken.test.js   # Тесты токена
├── scripts/
│   └── deploy.js             # Скрипт развертывания контрактов
├── backend/
│   ├── server.js             # Express сервер
│   ├── routes/
│   │   ├── auth.js           # Регистрация, логин (JWT)
│   │   ├── projects.js       # CRUD кампаний
│   │   ├── milestones.js     # Управление этапами
│   │   └── blockchain.js     # Взаимодействие с контрактами
│   ├── models/
│   │   ├── User.js
│   │   ├── Project.js
│   │   ├── Milestone.js
│   │   ├── Investment.js
│   │   ├── Vote.js
│   │   └── Transaction.js
│   ├── middleware/
│   │   └── auth.js           # JWT middleware
│   ├── config/
│   │   └── db.js             # Подключение к PostgreSQL
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx          # Каталог проектов
│   │   │   ├── ProjectDetail.jsx # Детали проекта + инвестирование
│   │   │   ├── CreateProject.jsx # Создание кампании
│   │   │   ├── Dashboard.jsx     # Панель автора
│   │   │   ├── VotingPage.jsx    # Голосование по этапам
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── ProjectCard.jsx
│   │   │   ├── MilestoneList.jsx
│   │   │   ├── VotePanel.jsx
│   │   │   ├── InvestForm.jsx
│   │   │   └── TransactionHistory.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── Web3Context.jsx   # ethers.js provider + signer
│   │   ├── utils/
│   │   │   ├── api.js            # Axios instance
│   │   │   └── contracts.js      # ABI + адреса контрактов
│   │   └── index.jsx
│   ├── public/
│   │   └── index.html
│   └── package.json
├── hardhat.config.js
├── package.json              # Корневой (workspaces или скрипты)
├── .env.example
├── docker-compose.yml        # PostgreSQL
└── README.md
```

---

## 2. Смарт-контракты (Solidity 0.8.20+, Hardhat)

### 2.1 InvestToken.sol (ERC-1155)

```
Наследует: ERC1155 (OpenZeppelin), Ownable

Состояние:
- mapping(uint256 => address) public fundContracts  // tokenId => адрес CrowdFund контракта
- uint256 public nextTokenId

Функции:
- mint(address to, uint256 tokenId, uint256 amount) external
  - Может вызывать только связанный CrowdFund контракт (проверка через fundContracts)
  - Выпускает amount токенов для инвестора

- burn(address from, uint256 tokenId, uint256 amount) external
  - Может вызывать только связанный CrowdFund контракт
  - Сжигает токены при refund

- registerFund(uint256 tokenId, address fundContract) external onlyOwner
  - Привязывает tokenId к адресу CrowdFund контракта

- balanceOf(address account, uint256 tokenId) - стандартный ERC-1155
```

### 2.2 CrowdFund.sol

```
Состояние:
- address public author              // Автор проекта
- address public platform            // Адрес платформы (admin)
- InvestToken public token           // Ссылка на токен-контракт
- uint256 public tokenId             // ID токена этого проекта
- uint256 public goalAmount          // Целевая сумма (в wei)
- uint256 public totalRaised         // Собрано
- uint256 public deadline            // Дедлайн сбора (timestamp)
- uint256 public platformFeePercent  // Комиссия платформы (1-3%)

- enum CampaignState { Funding, Active, Completed, Failed }
- CampaignState public state

- struct MilestoneData {
    string description;
    uint256 budget;         // Бюджет этапа в wei
    uint256 deadline;       // Дедлайн этапа
    MilestoneState status;  // Pending, Voting, Approved, Rejected
    uint256 votesFor;       // Сумма токенов "за"
    uint256 votesAgainst;   // Сумма токенов "против"
    uint256 votingEnd;      // Когда заканчивается голосование
    uint8 attempts;         // Попытки (макс 2)
  }

- enum MilestoneState { Pending, Voting, Approved, Rejected }

- MilestoneData[] public milestones
- uint256 public currentMilestone    // Индекс текущего этапа

- mapping(address => uint256) public investments  // Инвестор => сумма
- mapping(uint256 => mapping(address => bool)) public hasVoted  // milestone => investor => voted

Функции:

invest() external payable
  - require(state == Funding)
  - require(block.timestamp < deadline)
  - Принимает ETH, обновляет totalRaised и investments[msg.sender]
  - Вызывает token.mint(msg.sender, tokenId, msg.value)
  - Если totalRaised >= goalAmount, переводит state в Active

submitMilestone(uint256 milestoneIndex, string calldata reportURI) external
  - require(msg.sender == author)
  - require(state == Active)
  - require(milestoneIndex == currentMilestone)
  - require(milestones[milestoneIndex].status == Pending)
  - Сохраняет reportURI, меняет статус на Voting
  - Устанавливает votingEnd = block.timestamp + 7 days

vote(uint256 milestoneIndex, bool approve) external
  - require(state == Active)
  - require(milestones[milestoneIndex].status == Voting)
  - require(block.timestamp < milestones[milestoneIndex].votingEnd)
  - require(!hasVoted[milestoneIndex][msg.sender])
  - uint256 weight = token.balanceOf(msg.sender, tokenId)
  - require(weight > 0)
  - Обновляет votesFor или votesAgainst
  - hasVoted[milestoneIndex][msg.sender] = true

finishVoting(uint256 milestoneIndex) external
  - require(block.timestamp >= milestones[milestoneIndex].votingEnd)
  - require(milestones[milestoneIndex].status == Voting)
  - uint256 quorum = (votesFor + votesAgainst) * 100 / totalRaised
  - require(quorum >= 10)  // Минимум 10% кворум
  - if (votesFor > votesAgainst):
      - Переводит budget автору (минус комиссия платформы)
      - Переводит комиссию на адрес platform
      - Статус = Approved
      - currentMilestone++
      - Если все этапы одобрены => state = Completed
  - else:
      - attempts++
      - Если attempts >= 2 => Статус = Rejected
      - Иначе сбрасываем голоса, статус = Pending (повторная попытка)

requestRefund() external
  - require(
      (state == Funding && block.timestamp > deadline && totalRaised < goalAmount) ||
      (state == Active && milestones[currentMilestone].status == Rejected)
    )
  - uint256 userTokens = token.balanceOf(msg.sender, tokenId)
  - require(userTokens > 0)
  - uint256 refundAmount = (userTokens * address(this).balance) / totalRaised
  - token.burn(msg.sender, tokenId, userTokens)
  - payable(msg.sender).transfer(refundAmount)
  - state = Failed (если баланс контракта стал 0)

getInfo() external view returns (...)
  - Возвращает всю информацию о кампании одним вызовом

getMilestone(uint256 index) external view returns (MilestoneData memory)

Events:
  - Invested(address investor, uint256 amount)
  - MilestoneSubmitted(uint256 index, string reportURI)
  - Voted(address voter, uint256 milestoneIndex, bool approve, uint256 weight)
  - MilestoneApproved(uint256 index)
  - MilestoneRejected(uint256 index)
  - Refunded(address investor, uint256 amount)
  - CampaignCompleted()
  - CampaignFailed()
```

### 2.3 FundFactory.sol

```
Состояние:
- InvestToken public token
- address public platform
- address[] public campaigns
- mapping(address => address[]) public userCampaigns

Функции:
- constructor(address _token)
  - Сохраняет адрес InvestToken и platform = msg.sender

- createCampaign(
    uint256 goal,
    uint256 durationDays,
    string[] calldata milestoneDescriptions,
    uint256[] calldata milestoneBudgets,
    uint256[] calldata milestoneDurations,
    uint256 platformFeePercent
  ) external returns (address)
  - require(milestoneDescriptions.length > 0)
  - require(sum(milestoneBudgets) == goal)
  - Создает новый CrowdFund контракт через new
  - Регистрирует tokenId в InvestToken
  - Добавляет в campaigns и userCampaigns
  - Возвращает адрес нового контракта

- getCampaigns() external view returns (address[])
- getUserCampaigns(address user) external view returns (address[])
```

---

## 3. Тесты (Hardhat + Chai + ethers.js)

Запускаются на Hardhat Network (локальный блокчейн, встроенный в Hardhat). Покрытие:

### test/CrowdFund.test.js
```
describe("CrowdFund"):
  - "should accept investments and mint tokens"
  - "should reject investment after deadline"
  - "should reject investment if goal already reached"
  - "should transition to Active state when goal is met"
  - "should allow author to submit milestone"
  - "should reject milestone submission from non-author"
  - "should allow investors to vote"
  - "should reject double voting"
  - "should approve milestone if majority votes yes"
  - "should reject milestone if majority votes no"
  - "should allow retry after first rejection"
  - "should permanently reject after two failed votes"
  - "should transfer budget to author on approval (minus fee)"
  - "should transfer fee to platform on approval"
  - "should allow refund if campaign fails (deadline passed, goal not met)"
  - "should allow refund if milestone permanently rejected"
  - "should calculate refund proportionally to token balance"
  - "should burn tokens after refund"
  - "should complete campaign after all milestones approved"
  - "should enforce quorum (10% minimum)"
```

### test/FundFactory.test.js
```
describe("FundFactory"):
  - "should deploy a new CrowdFund contract"
  - "should register tokenId in InvestToken"
  - "should track campaigns by user"
  - "should reject if milestone budgets don't sum to goal"
  - "should store campaign address in array"
```

### test/InvestToken.test.js
```
describe("InvestToken"):
  - "should mint tokens only from registered fund contract"
  - "should burn tokens only from registered fund contract"
  - "should reject mint from unauthorized address"
  - "should track balances correctly"
  - "should support transfers between users (secondary market)"
```

Используй `hardhat-gas-reporter` для отчета по газу. Используй `solidity-coverage` для покрытия.

---

## 4. Backend (Node.js + Express)

### 4.1 База данных (PostgreSQL)

Таблицы (используй Sequelize ORM):

```sql
Users:
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'investor',  -- investor, author, admin
  wallet_address VARCHAR(42),
  kyc_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()

Projects:
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  goal_amount DECIMAL(18,8) NOT NULL,     -- в ETH
  current_amount DECIMAL(18,8) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',     -- draft, moderation, active, completed, failed
  contract_address VARCHAR(42),
  token_id INTEGER,
  author_id INTEGER REFERENCES Users(id),
  deadline TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()

Milestones:
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES Projects(id),
  milestone_index INTEGER NOT NULL,
  description TEXT NOT NULL,
  budget DECIMAL(18,8) NOT NULL,
  deadline TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending',  -- pending, voting, approved, rejected
  report_uri TEXT,
  created_at TIMESTAMP DEFAULT NOW()

Investments:
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES Users(id),
  project_id INTEGER REFERENCES Projects(id),
  amount DECIMAL(18,8) NOT NULL,
  tokens_received DECIMAL(18,8) NOT NULL,
  tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW()

Votes:
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES Users(id),
  milestone_id INTEGER REFERENCES Milestones(id),
  approve BOOLEAN NOT NULL,
  weight DECIMAL(18,8) NOT NULL,
  tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW()

Transactions:
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES Users(id),
  project_id INTEGER REFERENCES Projects(id),
  type VARCHAR(50) NOT NULL,  -- investment, milestone_payout, refund, fee
  amount DECIMAL(18,8) NOT NULL,
  tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW()
```

### 4.2 API Endpoints

```
POST   /api/auth/register       - Регистрация (email, password, role)
POST   /api/auth/login          - Логин (возвращает JWT)
GET    /api/auth/me             - Текущий пользователь

GET    /api/projects            - Список активных проектов
GET    /api/projects/:id        - Детали проекта
POST   /api/projects            - Создать проект (author only)
PUT    /api/projects/:id        - Обновить проект
POST   /api/projects/:id/deploy - Развернуть контракт в блокчейне

GET    /api/projects/:id/milestones          - Этапы проекта
POST   /api/projects/:id/milestones/:idx/submit  - Подать отчет по этапу
POST   /api/projects/:id/milestones/:idx/vote    - Проголосовать

POST   /api/projects/:id/invest   - Инвестировать (сумма в body)
POST   /api/projects/:id/refund   - Запросить возврат

GET    /api/transactions          - История транзакций пользователя
GET    /api/projects/:id/transactions  - Транзакции по проекту
```

### 4.3 Blockchain Service (backend/services/blockchain.js)

```javascript
// Подключение к Hardhat Network (localhost:8545)
// Использует ethers.js v6
// Читает ABI из artifacts/contracts/
// Слушает события контрактов и синхронизирует с PostgreSQL

Функции:
- deployFactory()           - Развертывание FundFactory + InvestToken
- createCampaign(params)    - Создание кампании через Factory
- invest(campaignAddr, amount, signer)
- submitMilestone(campaignAddr, index, reportURI, signer)
- startVoting(campaignAddr, index)
- vote(campaignAddr, index, approve, signer)
- finishVoting(campaignAddr, index)
- requestRefund(campaignAddr, signer)
- getCampaignInfo(campaignAddr)
- listenToEvents(campaignAddr)  - Подписка на события
```

---

## 5. Frontend (React + Vite)

### 5.1 Зависимости
- react, react-router-dom
- ethers (v6)
- axios
- tailwindcss (стилизация)
- react-hot-toast (уведомления)

### 5.2 Страницы

**Home.jsx** - Каталог проектов
- Карточки проектов с прогресс-баром (собрано / цель)
- Фильтры: все, активные, завершенные
- Поиск по названию

**ProjectDetail.jsx** - Страница проекта
- Информация: название, описание, автор, цель, собрано, дедлайн
- Прогресс-бар
- Список этапов (milestones) с их статусами
- Кнопка "Инвестировать" (открывает InvestForm)
- Кнопка "Голосовать" (для текущего этапа, если Voting)
- История транзакций по проекту

**CreateProject.jsx** - Форма создания
- Поля: название, описание, целевая сумма (ETH), длительность (дней)
- Динамическое добавление этапов: описание, бюджет, срок
- Валидация: сумма бюджетов == целевая сумма
- Кнопка "Создать и развернуть контракт"

**Dashboard.jsx** - Панель автора
- Мои проекты с статусами
- Для Active проектов: кнопка "Отправить отчет по этапу"
- Статистика: собрано, переведено, осталось

**VotingPage.jsx** - Голосование
- Информация об этапе: описание, бюджет, отчет автора
- Кнопки "Одобрить" / "Отклонить"
- Текущие результаты голосования (прогресс-бар)
- Таймер до окончания голосования

**Login.jsx / Register.jsx** - Авторизация
- Email + пароль
- При регистрации выбор роли: investor / author

### 5.3 Web3 интеграция

```
Web3Context.jsx:
- Подключение к MetaMask (или Hardhat accounts для тестирования)
- Provider: ethers.BrowserProvider(window.ethereum) или JsonRpcProvider("http://localhost:8545")
- Signer: provider.getSigner()
- Хранение текущего аккаунта, баланса, сети
- Функция connectWallet()
- Функция switchNetwork() - переключение на Hardhat Network (chainId: 31337)
```

---

## 6. Конфигурация

### hardhat.config.js
```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    }
  },
  gasReporter: {
    enabled: true,
    currency: "USD"
  }
};
```

### docker-compose.yml (только PostgreSQL)
```yaml
version: "3.8"
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: crowdfund
      POSTGRES_USER: crowdfund
      POSTGRES_PASSWORD: crowdfund123
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

### .env.example
```
DATABASE_URL=postgresql://crowdfund:crowdfund123@localhost:5432/crowdfund
JWT_SECRET=your-jwt-secret-here
HARDHAT_NETWORK_URL=http://127.0.0.1:8545
PLATFORM_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PLATFORM_FEE_PERCENT=2
```

---

## 7. Скрипты запуска

### package.json (корневой)
```json
{
  "scripts": {
    "compile": "npx hardhat compile",
    "test": "npx hardhat test",
    "test:coverage": "npx hardhat coverage",
    "node": "npx hardhat node",
    "deploy": "npx hardhat run scripts/deploy.js --network localhost",
    "backend": "cd backend && node server.js",
    "frontend": "cd frontend && npm run dev",
    "db:up": "docker-compose up -d",
    "start": "concurrently \"npm run node\" \"npm run db:up\" \"sleep 3 && npm run deploy\" \"npm run backend\" \"npm run frontend\""
  }
}
```

---

## 8. Важные требования

1. **Solidity**: Используй OpenZeppelin v5 (@openzeppelin/contracts). Все контракты должны компилироваться без warnings.

2. **Тесты**: Минимум 20 тестов для смарт-контрактов. Используй `loadFixture` из hardhat-toolbox для оптимизации. Используй `time.increase()` для тестов с дедлайнами.

3. **Безопасность контрактов**:
   - ReentrancyGuard на все функции с переводом ETH
   - Checks-Effects-Interactions паттерн
   - Проверки overflow (встроены в Solidity 0.8+)
   - Модификаторы доступа (onlyAuthor, onlyPlatform)

4. **Backend**: Sequelize для ORM. JWT для auth. Валидация входных данных через express-validator.

5. **Frontend**: React Router v6. Tailwind CSS для стилей. Адаптивная верстка.

6. **Все на английском**: Имена переменных, комментарии в коде, README - на английском. UI текст на русском.

7. **README.md**: Подробная инструкция по запуску: prerequisites, установка зависимостей, запуск, как протестировать каждый сценарий.

---

## 9. Порядок разработки

1. Инициализируй проект: `npx hardhat init`, создай структуру папок
2. Напиши смарт-контракты (InvestToken → CrowdFund → FundFactory)
3. Напиши и запусти тесты (`npx hardhat test`)
4. Напиши скрипт deploy.js
5. Настрой PostgreSQL + Sequelize модели
6. Напиши backend API
7. Создай React фронтенд
8. Протестируй полный flow: создание проекта → инвестирование → голосование → выплата / возврат
9. Напиши README

---

## 10. Полный пользовательский сценарий (для проверки)

1. Автор регистрируется, создает проект с 3 этапами (0.3 + 0.3 + 0.4 ETH = 1 ETH цель)
2. Три инвестора вкладывают по 0.4, 0.3, 0.3 ETH = 1 ETH собрано
3. Кампания переходит в статус Active
4. Автор подает отчет по этапу 1
5. Инвесторы голосуют (2 из 3 за) → этап одобрен → 0.3 ETH автору (минус 2% комиссия)
6. Автор подает отчет по этапу 2
7. Инвесторы голосуют (2 из 3 против) → первый провал → автор подает повторно
8. Голосование повторяется (2 за 1 против) → этап одобрен
9. Этап 3 одобряется → кампания завершена
10. Проверить: балансы всех участников, комиссия платформы, токены, транзакции в БД

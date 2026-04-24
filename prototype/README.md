# CrowdFund Platform

A tokenized crowdfunding platform with milestone-based escrow on Ethereum. Built as a prototype for a bachelor's thesis on tokenized collective investment funds.

## Architecture

- **Smart Contracts** (Solidity 0.8.20 + Hardhat): ERC-1155 investment tokens, milestone-based escrow with investor voting
- **Backend** (Node.js + Express + Sequelize): REST API, JWT authentication, PostgreSQL database
- **Frontend** (React + Vite + Tailwind CSS): SPA with ethers.js for blockchain interaction

## Prerequisites

- Node.js >= 18
- Docker & Docker Compose (for PostgreSQL)
- MetaMask browser extension (optional, for wallet interaction)

## Quick Start

### 1. Clone and install dependencies

```bash
git clone https://github.com/artemdost/Platform.git
cd Platform

# Install root dependencies (Hardhat, OpenZeppelin)
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` if needed. Default values work for local development.

### 3. Start PostgreSQL

```bash
docker-compose up -d
```

### 4. Compile and test smart contracts

```bash
npm run compile
npm test
```

### 5. Start local blockchain node

```bash
npm run node
```

Leave this terminal running. Open a new terminal for the next steps.

### 6. Deploy contracts

```bash
npm run deploy
```

This deploys InvestToken and FundFactory to the local Hardhat network and saves addresses/ABIs to `deployed/`.

### 7. Start backend

```bash
npm run backend
```

Backend runs on http://localhost:3001.

### 8. Start frontend

```bash
npm run frontend
```

Frontend runs on http://localhost:5173.

## Testing Smart Contracts

```bash
# Run all tests
npm test

# Run with gas report
REPORT_GAS=true npm test

# Run with coverage
npm run test:coverage
```

### Test Coverage

The test suite includes 20+ tests covering:

- Investment flow (accept, reject after deadline, state transitions)
- Milestone submission and voting
- Quorum enforcement (10% minimum)
- Approval with budget transfer and platform fee
- Rejection, retry, and permanent rejection after 2 failed votes
- Refund on campaign failure and milestone rejection
- Token minting, burning, and secondary market transfers
- Factory deployment and campaign tracking

## User Flow

1. **Author** registers and creates a project with milestones
2. **Investors** invest ETH into the campaign (receive ERC-1155 tokens)
3. Campaign becomes **Active** when the funding goal is reached
4. **Author** submits milestone reports
5. **Investors** vote to approve/reject milestones (weighted by token balance)
6. Approved milestones release funds to the author (minus platform fee)
7. Rejected milestones allow one retry; permanent rejection enables refunds
8. All milestones approved = campaign **Completed**

## Project Structure

```
Platform/
├── contracts/           # Solidity smart contracts
│   ├── InvestToken.sol  # ERC-1155 investor tokens
│   ├── CrowdFund.sol    # Campaign escrow + voting
│   └── FundFactory.sol  # Campaign factory
├── test/                # Hardhat tests (Chai + ethers)
├── scripts/
│   └── deploy.js        # Deployment script
├── backend/
│   ├── server.js        # Express entry point
│   ├── models/          # Sequelize models
│   ├── routes/          # API routes
│   ├── middleware/       # JWT auth
│   ├── services/        # Blockchain service
│   └── config/          # Database config
├── frontend/
│   └── src/
│       ├── pages/       # React pages
│       ├── components/  # Reusable components
│       ├── context/     # Auth + Web3 contexts
│       └── utils/       # API client, contract helpers
├── hardhat.config.js
├── docker-compose.yml
└── package.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Ethereum (Hardhat local network) |
| Smart Contracts | Solidity 0.8.20, OpenZeppelin v5 |
| Token Standard | ERC-1155 |
| Testing | Hardhat Toolbox, Chai, ethers.js v6 |
| Backend | Node.js, Express, Sequelize ORM |
| Database | PostgreSQL 15 |
| Frontend | React 18, Vite, Tailwind CSS |
| Web3 | ethers.js v6 |
| Auth | JWT (jsonwebtoken + bcryptjs) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login (returns JWT) |
| GET | /api/auth/me | Current user |
| GET | /api/projects | List projects |
| GET | /api/projects/:id | Project details |
| POST | /api/projects | Create project |
| PUT | /api/projects/:id | Update project |
| POST | /api/projects/:id/deploy | Deploy contract |
| GET | /api/projects/:id/milestones | List milestones |
| POST | /api/projects/:id/milestones/:idx/submit | Submit report |
| POST | /api/projects/:id/milestones/:idx/vote | Vote |
| POST | /api/projects/:id/invest | Record investment |
| POST | /api/projects/:id/refund | Record refund |
| GET | /api/transactions | User transactions |

## License

MIT

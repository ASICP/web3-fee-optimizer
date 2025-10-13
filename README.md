# Web3 Fee Optimizer

AI-powered gas fee optimization with intelligent transaction timing and L2 routing.

## 🚀 Features

- 💰 20-40% gas fee savings
- 🧠 AI-powered fee prediction
- 🌉 L2 routing recommendations
- 📊 Real-time savings analytics
- 🔄 Transaction queue management
- 🎯 Multi-DEX aggregation

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Deployment**: Render

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (Neon recommended)

## 🏃 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/ASICP/web3-fee-optimizer.git
   cd web3-fee-optimizer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm run start
   ```

## 📁 Project Structure

```
web3-fee-optimizer/
├── client/src/
│   ├── components/          # React components
│   ├── hooks/               # Custom React hooks
│   ├── services/            # Business logic & API layer
│   ├── types/               # TypeScript types
│   └── App.tsx             # Main app
├── server/                 # Express backend
├── shared/                 # Shared utilities
└── [config files]
```

## 🔑 Environment Variables

Required environment variables:
- `VITE_BLOCKNATIVE_API_KEY` - Blocknative gas API
- `VITE_INFURA_API_KEY` - Infura gas API
- `DATABASE_URL` - PostgreSQL connection

## 🚢 Deployment

This project deploys automatically to Render on push to main branch.

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines.

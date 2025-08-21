# ChatGPT vs Humans - Minigames Platform

A web application platform for creating and playing minigames where humans compete against ChatGPT.

## Features

- 🎮 Modular game system - easily add new games
- 🤖 ChatGPT AI integration via OpenAI API
- ⚡ Real-time gameplay with Socket.IO
- 🎯 Current game: Rock Paper Scissors
- 📊 Score tracking and game history

## Architecture

- **Frontend**: React + TypeScript
- **Backend**: Node.js + Express + Socket.IO
- **AI**: OpenAI GPT-4 API
- **Real-time**: WebSocket communication

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- OpenAI API key

### 1. Clone and Install Dependencies
```bash
npm run install:all
```

### 2. Configure OpenAI API
Create a `.env` file in the `server` directory:
```bash
cd server
cp .env.example .env
```

Edit `server/.env` and add your OpenAI API key:
```
OPENAI_API_KEY=your_actual_api_key_here
PORT=3001
NODE_ENV=development
```

### 3. Start the Development Servers
From the root directory:
```bash
npm run dev
```

This will start:
- Backend server on http://localhost:3001
- Frontend app on http://localhost:3000

### 4. Play!
1. Open http://localhost:3000
2. Enter your name
3. Select a game (currently Rock Paper Scissors)
4. Challenge ChatGPT!

## Adding New Games

To add a new minigame:

1. **Create game class** in `server/src/games/yourGame.ts`:
   - Extend `BaseGame` class
   - Implement required methods
   - Define game logic and AI integration

2. **Register the game** in `server/src/server.ts`:
   ```typescript
   gameManager.registerGameType('your-game', YourGameClass);
   ```

3. **Create React component** in `client/src/components/YourGame.tsx`:
   - Handle game UI and user interactions
   - Connect to socket events

4. **Update App.tsx** to render your new game component

## Game Architecture

### Base Game Structure
```typescript
export abstract class BaseGame {
  abstract config: GameConfig;
  abstract state: GameState;
  
  abstract initialize(players: Player[]): void;
  abstract processMove(move: GameMove): Promise<void>;
  abstract checkWinCondition(): GameResult | null;
  abstract getAIMove(): Promise<any>;
  abstract isValidMove(move: any, playerId: string): boolean;
}
```

### Example: Rock Paper Scissors
- 5-round tournament
- AI uses GPT-4 to analyze patterns and make strategic moves
- Real-time move processing
- Visual feedback with emojis

## Socket Events

### Client to Server
- `create-game`: Create new game session
- `make-move`: Submit player move
- `get-game-types`: Request available games

### Server to Client
- `game-created`: Game session created
- `game-updated`: Game state changed
- `game-finished`: Game completed
- `error`: Error occurred

## Project Structure

```
website-challenge/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # Socket.IO service
│   │   └── types/          # TypeScript types
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── games/          # Game implementations
│   │   ├── services/       # OpenAI & game management
│   │   ├── types/          # Shared types
│   │   └── server.ts       # Main server file
└── package.json            # Root package file
```

## Expanding the Platform

This platform is designed for easy expansion:

- **New Games**: Add any turn-based or real-time game
- **AI Strategies**: Customize ChatGPT prompts per game
- **Game Modes**: Tournament, multiplayer, time-based
- **Features**: Leaderboards, replay system, spectator mode

## Development Commands

```bash
# Install all dependencies
npm run install:all

# Start both servers
npm run dev

# Start only backend
npm run server:dev

# Start only frontend  
npm run client:dev

# Build for production
npm run build
```

## Notes

- Make sure your OpenAI API key has sufficient credits
- The AI makes moves with a 1-second delay for better UX
- Games are cleaned up when players disconnect
- All game state is managed in memory (consider adding persistence for production)
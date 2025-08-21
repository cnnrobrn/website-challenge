# BeatGPT - Tactical AI Combat System

> 🎮 **Engage in strategic warfare against advanced AI opponents**  
> Experience retro-futuristic combat at **beatgpt.org**

## Mission Overview

BeatGPT is a cutting-edge tactical combat platform where human commanders engage in strategic battles against sophisticated AI adversaries. Built with a retro-futuristic aesthetic inspired by classic sci-fi, our system delivers instant real-time combat scenarios with zero-latency AI responses.

## 🎯 Combat Features

- ⚡ **Instant AI Response System** - Pre-fetched moves eliminate combat delays
- 🎮 **Modular Tactical Framework** - Easily deploy new combat scenarios
- 🤖 **Advanced AI Integration** - Powered by OpenAI GPT-4 tactical analysis
- 📡 **Real-time Combat Network** - Socket.IO powered tactical communications
- 🏆 **Elite Ranking System** - Track your tactical superiority across all operations
- 🎨 **Retro-Futuristic Interface** - Immersive terminal-based combat UI

## 🚀 Current Operations

### Tactical RPS Combat
- 5-round strategic engagement protocol
- AI opponent utilizes pattern analysis and strategic countermeasures
- Real-time tactical feedback and engagement analysis
- Military-grade ranking system with combat medals

## 🏗️ System Architecture

**Command Interface**: React + TypeScript with retro-futuristic styling  
**Combat Server**: Node.js + Express + Socket.IO tactical backend  
**AI Tactical Core**: OpenAI GPT-4 strategic analysis engine  
**Communication Network**: WebSocket real-time combat protocols  

## 🛠️ Deployment Instructions

### Prerequisites
- Node.js (v14+ required for tactical systems)
- OpenAI API key with tactical clearance

### 1. Initialize Combat Systems
```bash
npm run install:all
```

### 2. Configure AI Tactical Core
Create tactical configuration in server directory:
```bash
cd server
cp .env.example .env
```

Configure your AI tactical parameters in `server/.env`:
```
OPENAI_API_KEY=your_classified_api_key_here
PORT=4000
NODE_ENV=development
```

### 3. Deploy Tactical Systems
From command center (root directory):
```bash
npm run dev
```

**System Status:**
- 🎯 **Combat Server**: http://localhost:4000
- 💻 **Command Interface**: http://localhost:4001

### 4. Begin Tactical Operations
1. Access command interface at http://localhost:4001
2. Enter your tactical callsign
3. Select combat protocol (RPS Tactical recommended for beginners)
4. Engage AI opponent in strategic warfare!

## 🎮 Adding New Games

Want to add your own game to BeatGPT? Follow this step-by-step guide:

### Step 1: Create the Game Logic (Backend)

Create a new file in `server/src/games/yourGame.ts`:

```typescript
import { BaseGame, GameConfig, GameState, Player, GameMove, GameResult } from '../types/game';
import { OpenAIService } from '../services/openai';

// Define your game's move type
type YourGameMove = 'option1' | 'option2' | 'option3';

// Define your game's data structure
interface YourGameData {
  moves: Record<string, YourGameMove>;
  // Add any other game-specific data
  gameSpecificData: any;
}

export class YourGame extends BaseGame {
  config: GameConfig = {
    name: 'Your Game Name',
    description: 'Description of your game',
    minPlayers: 2,
    maxPlayers: 2,
    maxRounds: 5  // Or however many rounds you want
  };

  state: GameState;
  private openAI = new OpenAIService();

  constructor() {
    super();
    this.state = {} as GameState;
  }

  async initialize(players: Player[]): Promise<void> {
    this.state.data = {
      moves: {},
      gameSpecificData: {}
    } as YourGameData;
    this.state.status = 'playing';
  }

  async processMove(move: GameMove): Promise<void> {
    if (!this.isValidMove(move.move, move.playerId)) {
      throw new Error('Invalid move');
    }

    const gameData = this.state.data as YourGameData;
    gameData.moves[move.playerId] = move.move;

    // Check if all players have moved
    if (Object.keys(gameData.moves).length === this.state.players.length) {
      await this.processRound();
    }
  }

  private async processRound(): Promise<void> {
    const gameData = this.state.data as YourGameData;
    
    // Implement your game logic here
    // Determine round winner, update scores, etc.
    
    // Example: determine winner logic
    const winner = this.determineRoundWinner(gameData.moves);
    
    // Update player scores
    if (winner && winner !== 'tie') {
      const player = this.state.players.find(p => p.id === winner);
      if (player) player.score++;
    }

    // Clear moves for next round
    gameData.moves = {};
    this.state.currentRound++;

    // Check if game is finished
    const result = this.checkWinCondition();
    if (result) {
      this.state.status = 'finished';
      this.state.winner = result.winner;
    }
  }

  private determineRoundWinner(moves: Record<string, YourGameMove>): string | 'tie' {
    // Implement your game's winning logic
    // Return player ID of winner, or 'tie'
    return 'tie'; // placeholder
  }

  checkWinCondition(): GameResult | null {
    if (this.state.currentRound >= this.state.maxRounds) {
      // Find player with highest score
      const winner = this.state.players.reduce((prev, current) => 
        prev.score > current.score ? prev : current
      );
      
      return {
        winner,
        scores: Object.fromEntries(this.state.players.map(p => [p.id, p.score])),
        gameData: this.state.data
      };
    }
    return null;
  }

  async getAIMove(): Promise<YourGameMove> {
    // Implement AI logic using OpenAI
    const prompt = `You are playing [Your Game]. Based on the game state, what's your move?
    Available moves: option1, option2, option3
    
    Game context: ${JSON.stringify(this.state.data)}
    
    Respond with just the move name (option1, option2, or option3).`;

    try {
      const response = await this.openAI.generateMove(prompt);
      const move = response.toLowerCase().trim() as YourGameMove;
      
      if (this.isValidMove(move, 'ai')) {
        return move;
      }
    } catch (error) {
      console.error('AI move generation failed:', error);
    }
    
    // Fallback to random move
    const moves: YourGameMove[] = ['option1', 'option2', 'option3'];
    return moves[Math.floor(Math.random() * moves.length)];
  }

  isValidMove(move: any, playerId: string): boolean {
    const validMoves: YourGameMove[] = ['option1', 'option2', 'option3'];
    return validMoves.includes(move);
  }
}
```

### Step 2: Register Your Game (Backend)

Add your game to `server/src/server.ts`:

```typescript
import { YourGame } from './games/yourGame';

// Find the game registration section and add:
gameManager.registerGameType('your-game-id', YourGame);
```

### Step 3: Create the Game Component (Frontend)

Create `client/src/components/YourGame.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { GameState } from '../types/game';
import { socketService } from '../services/socket';

interface YourGameProps {
  gameState: GameState;
}

type YourGameMove = 'option1' | 'option2' | 'option3';

const YourGame: React.FC<YourGameProps> = ({ gameState }) => {
  const [selectedMove, setSelectedMove] = useState<YourGameMove | null>(null);
  const [waitingForAI, setWaitingForAI] = useState(false);

  const moves: YourGameMove[] = ['option1', 'option2', 'option3'];
  const moveNames = {
    option1: 'Option 1',
    option2: 'Option 2', 
    option3: 'Option 3'
  };
  const moveEmojis = {
    option1: '🎲',
    option2: '🎯',
    option3: '🎮'
  };

  const handleMoveSelect = (move: YourGameMove) => {
    if (selectedMove || gameState.status !== 'playing') return;

    setSelectedMove(move);
    setWaitingForAI(true);

    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('make-move', { move });
    }
  };

  // Add useEffect for socket events similar to RockPaperScissors

  const humanPlayer = gameState.players.find(p => p.type === 'human');
  const aiPlayer = gameState.players.find(p => p.type === 'ai');

  if (gameState.status === 'finished') {
    // Implement game over screen similar to RockPaperScissors
    const isVictory = gameState.winner?.type === 'human';
    
    return (
      <div className="terminal-panel" style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
        <div className="panel-header">
          <h3 className="panel-title">🎮 Game Complete</h3>
        </div>
        
        <div className={`status-message ${isVictory ? 'status-success' : 'status-danger'}`}>
          <div style={{ fontSize: '2rem', marginBottom: '15px' }}>
            {isVictory ? '🏆 You Won!' : '🤖 ChatGPT Wins!'}
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            Final Score: {humanPlayer?.name} [{humanPlayer?.score}] vs ChatGPT [{aiPlayer?.score}]
          </div>
        </div>

        <button onClick={() => window.location.reload()} className="btn btn-primary">
          🎮 Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="game-arena">
      <div className="game-header">
        <h1 className="game-title text-glow">🎮 Your Game Name</h1>
        <div className="game-subtitle terminal-text">
          You vs ChatGPT • Best of {gameState.maxRounds} rounds
        </div>
      </div>

      {/* Score Display */}
      <div className="score-display">
        <div className="score-item">
          <div className="score-label">{humanPlayer?.name}</div>
          <div className="score-value">{humanPlayer?.score}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--accent-orange)' }}>
          <div className="terminal-text" style={{ fontSize: '0.9rem', marginBottom: '5px' }}>
            Round {gameState.currentRound + 1}/{gameState.maxRounds}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>VS</div>
        </div>
        <div className="score-item">
          <div className="score-label">ChatGPT</div>
          <div className="score-value">{aiPlayer?.score}</div>
        </div>
      </div>

      {/* Game Controls */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">✋ Choose Your Move</h3>
        </div>
        
        <div className="game-controls">
          {moves.map(move => (
            <button
              key={move}
              onClick={() => handleMoveSelect(move)}
              disabled={selectedMove !== null || waitingForAI}
              className={`game-btn btn-enhanced-glow ${selectedMove === move ? 'selected' : ''}`}
            >
              <div className="game-btn-icon">{moveEmojis[move]}</div>
              <div className="game-btn-label">{moveNames[move]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Status Messages */}
      {waitingForAI && (
        <div className="status-message" style={{ textAlign: 'center', margin: '20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
            <div className="tactical-spinner"></div>
            <span className="holographic-text"><strong>ChatGPT is thinking...</strong></span>
            <div className="tactical-spinner"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YourGame;
```

### Step 4: Register Component in App (Frontend)

Update `client/src/App.tsx` in the `renderGame()` function:

```tsx
const renderGame = () => {
  if (!gameState) return <div>Loading game...</div>;

  switch (gameState.type) {
    case 'rock-paper-scissors':
      return <RockPaperScissors gameState={gameState} />;
    case 'your-game-id':  // Add this case
      return <YourGame gameState={gameState} />;
    default:
      return <div>Unknown game type: {gameState.type}</div>;
  }
};
```

And import your component:

```tsx
import YourGame from './components/YourGame';
```

### Step 5: Update Game Display Names (Frontend)

Add your game to `client/src/components/GameMenu.tsx`:

```tsx
const gameDisplayNames: Record<string, string> = {
  'rock-paper-scissors': 'Rock Paper Scissors',
  'your-game-id': 'Your Game Name'  // Add this line
};
```

### Step 6: Test Your Game

1. **Start the development server**: `npm run dev`
2. **Select your game** from the game menu
3. **Test the AI integration** - make sure ChatGPT responds appropriately
4. **Verify scoring and win conditions** work correctly
5. **Check the leaderboard** shows results properly

### 🎯 Tips for Success

- **Keep moves simple**: Start with 2-3 options like Rock Paper Scissors
- **Make AI prompts clear**: Give ChatGPT clear context and options
- **Test thoroughly**: Play multiple rounds to ensure logic works
- **Follow the pattern**: Use existing games as templates
- **Maintain the aesthetic**: Use the same CSS classes and styling patterns

### 🔧 Advanced Features

Once you have the basics working, you can add:

- **Complex game states**: Multi-turn games, card games, etc.
- **Enhanced AI prompts**: Give ChatGPT more strategic context
- **Custom animations**: Add unique visual effects for your game
- **Sound effects**: Integrate audio feedback
- **Multiplayer variants**: Support for more than 2 players

### 🐛 Common Issues

- **AI not responding**: Check your OpenAI API key and prompt format
- **Moves not registering**: Verify `isValidMove()` logic
- **Game not appearing**: Ensure it's registered in `server.ts`
- **UI not updating**: Check socket event handling in your component

Need help? Check out `rockPaperScissors.ts` and `RockPaperScissors.tsx` as reference implementations!

## 📡 Tactical Communication Protocols

### Command → Combat Server
- `create-game`: Initialize new tactical engagement
- `make-move`: Execute tactical maneuver  
- `get-game-types`: Request available combat protocols

### Combat Server → Command
- `game-created`: Tactical engagement established
- `game-updated`: Combat status updated
- `game-finished`: Mission completed
- `error`: System malfunction detected

## 🗂️ System Structure

```
beatgpt-tactical-system/
├── client/                 # Command Interface (React)
│   ├── src/
│   │   ├── components/     # Tactical UI Components
│   │   ├── services/       # Communication Protocols
│   │   ├── styles/         # Retro-Futuristic Styling
│   │   └── types/          # Combat Data Types
├── server/                 # Combat Server (Node.js)
│   ├── src/
│   │   ├── games/          # Tactical Scenarios
│   │   ├── services/       # AI Integration & Game Management
│   │   └── types/          # Shared Combat Protocols
└── package.json            # System Configuration
```

## ⚡ Tactical Development Commands

```bash
# Deploy all tactical systems
npm run install:all

# Activate full combat readiness
npm run dev

# Combat server only
npm run server:dev

# Command interface only  
npm run client:dev

# Prepare for production deployment
npm run build
```

## 🎨 Design Philosophy

BeatGPT embraces a retro-futuristic aesthetic combining:
- **Deep space black backgrounds** with **neon orange accents**
- **Terminal-style interfaces** with **tactical green highlights**  
- **Military command terminology** throughout the interface
- **Glowing effects** and **scan-line animations** for immersion
- **ASCII art elements** and **monospace typography**

## 🔧 Advanced Tactical Features

### AI Pre-Fetch System
- AI moves generated at engagement start
- Zero-latency tactical responses
- Seamless combat experience

### Elite Ranking Database
- Track commander performance across all operations
- Recent combat operations log
- Specialized tactical scenario leaderboards

### Retro-Futuristic Interface
- Custom CSS design system with military aesthetics
- Responsive tactical displays
- Immersive audio-visual feedback

## 🌐 Deployment to beatgpt.org

This tactical system is designed for deployment to **beatgpt.org** with:
- Production-ready Docker configuration
- Scalable cloud infrastructure support
- Advanced security protocols for tactical operations

## ⚠️ Operational Notes

- Ensure OpenAI API key has sufficient tactical credits
- AI opponents utilize advanced pattern recognition
- All combat data maintained in secure memory systems
- Automatic cleanup of abandoned tactical sessions
- Consider persistent storage for production tactical archives

---

**🎯 Remember, Commander: In the world of BeatGPT, only tactical superiority matters.**

*Engage • Compete • Dominate*
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from 'dotenv';
import { GameManager } from './services/gameManager';
import { LeaderboardService } from './services/leaderboard';
import { RockPaperScissorsGame } from './games/rockPaperScissors';
import { WordUnscramblerGame } from './games/wordUnscrambler';
import { Player, GameMove } from './types/game';
import { v4 as uuidv4 } from 'uuid';

config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:4001",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const gameManager = new GameManager();
const leaderboardService = new LeaderboardService();
gameManager.registerGameType('rock-paper-scissors', RockPaperScissorsGame);
gameManager.registerGameType('word-unscrambler', WordUnscramblerGame);

console.log('Available games:', gameManager.getAvailableGameTypes());

const activeGames = new Map<string, string>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-game', async (data: { gameType: string, playerName: string }) => {
    try {
      const humanPlayer: Player = {
        id: socket.id,
        name: data.playerName,
        type: 'human',
        score: 0
      };

      const aiPlayer: Player = {
        id: uuidv4(),
        name: 'ChatGPT',
        type: 'ai',
        score: 0
      };

      const gameId = await gameManager.createGame(data.gameType, [humanPlayer, aiPlayer]);
      activeGames.set(socket.id, gameId);

      socket.join(gameId);
      socket.emit('game-created', {
        gameId,
        gameState: gameManager.getGameState(gameId)
      });

      console.log(`Game created: ${gameId} for ${data.playerName}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to create game' });
      console.error('Error creating game:', error);
    }
  });

  socket.on('make-move', async (data: { move: any }) => {
    try {
      const gameId = activeGames.get(socket.id);
      if (!gameId) {
        socket.emit('error', { message: 'No active game found' });
        return;
      }

      const move: GameMove = {
        playerId: socket.id,
        gameId,
        move: data.move,
        timestamp: Date.now()
      };

      await gameManager.processMove(gameId, move);
      let gameState = gameManager.getGameState(gameId);

      socket.to(gameId).emit('game-updated', gameState);
      socket.emit('game-updated', gameState);

      // Check if game finished after human move
      if (gameState?.status === 'finished') {
        // Record scores for both players
        gameState.players.forEach(player => {
          leaderboardService.addEntry(
            player.name,
            player.score,
            gameState!.type
          );
        });
        io.to(gameId).emit('game-finished', gameState);
        return; // Don't process AI move if game is finished
      }

      const game = gameManager.getGame(gameId);
      if (game && gameState?.status === 'playing') {
        // Skip AI processing for word-unscrambler since it handles AI moves internally
        if (gameState.type !== 'word-unscrambler') {
          const aiPlayer = gameState.players.find(p => p.type === 'ai');
          if (aiPlayer) {
            try {
              await gameManager.processAIMove(gameId, aiPlayer.id);
              gameState = gameManager.getGameState(gameId);
              
              io.to(gameId).emit('game-updated', gameState);
              
              if (gameState?.status === 'finished') {
                // Record scores for both players in leaderboard
                gameState.players.forEach(player => {
                  leaderboardService.addEntry(
                    player.name,
                    player.score,
                    gameState!.type
                  );
                });
                
                io.to(gameId).emit('game-finished', gameState);
              }
            } catch (error) {
              console.error('AI move error:', error);
              io.to(gameId).emit('error', { message: 'AI move failed' });
            }
          }
        } else {
          // For word-unscrambler, get updated state since AI is handled internally
          gameState = gameManager.getGameState(gameId);
          io.to(gameId).emit('game-updated', gameState);
          
          if (gameState?.status === 'finished') {
            // Record scores for both players in leaderboard
            gameState.players.forEach(player => {
              leaderboardService.addEntry(
                player.name,
                player.score,
                gameState!.type
              );
            });
            
            io.to(gameId).emit('game-finished', gameState);
          }
        }
      }

    } catch (error) {
      socket.emit('error', { message: 'Invalid move' });
      console.error('Error processing move:', error);
    }
  });

  socket.on('get-game-types', () => {
    socket.emit('game-types', gameManager.getAvailableGameTypes());
  });

  socket.on('disconnect', () => {
    const gameId = activeGames.get(socket.id);
    if (gameId) {
      gameManager.deleteGame(gameId);
      activeGames.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', games: gameManager.getAvailableGameTypes() });
});

// Leaderboard API endpoints
app.get('/api/leaderboard', (req, res) => {
  const { gameType, limit } = req.query;
  const topScores = leaderboardService.getTopScores(
    gameType as string, 
    limit ? parseInt(limit as string) : 10
  );
  res.json(topScores);
});

app.get('/api/leaderboard/recent', (req, res) => {
  const { limit } = req.query;
  const recentGames = leaderboardService.getRecentGames(
    limit ? parseInt(limit as string) : 20
  );
  res.json(recentGames);
});

app.get('/api/leaderboard/stats/:playerName', (req, res) => {
  const { playerName } = req.params;
  const stats = leaderboardService.getPlayerStats(playerName);
  res.json(stats);
});

app.get('/api/leaderboard/game-stats', (req, res) => {
  const gameStats = leaderboardService.getGameTypeStats();
  res.json(gameStats);
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Available games: ${gameManager.getAvailableGameTypes().join(', ')}`);
});
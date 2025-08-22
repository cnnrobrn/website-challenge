import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from 'dotenv';
import { GameManager } from './services/gameManager';
import { LeaderboardService } from './services/leaderboard';
import { RockPaperScissorsGame } from './games/rockPaperScissors';
import { WordUnscramblerGame } from './games/wordUnscrambler';
import { ChessGame } from './games/chess';
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
gameManager.registerGameType('chess', ChessGame);

const activeGames = new Map<string, string>();
const gameStatePolling = new Map<string, NodeJS.Timeout>();

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

      // For word unscrambler, poll for state changes during round transitions
      if (data.gameType === 'word-unscrambler') {
        let lastRoundComplete = false;
        
        const pollInterval = setInterval(() => {
          const gameState = gameManager.getGameState(gameId);
          
          if (gameState?.status === 'finished') {
            // Record scores for both players in leaderboard
            const winner = gameState.winner;
            gameState.players.forEach(player => {
              const isWinner = winner && winner.id === player.id;
              leaderboardService.addEntry(
                player.name,
                player.score,
                gameState.type,
                player.type === 'human',
                isWinner
              );
            });
            
            io.to(gameId).emit('game-finished', gameState);
            
            clearInterval(pollInterval);
            gameStatePolling.delete(gameId);
            return;
          }
          
          // Check if the game state has changed (new round started)
          const gameData = gameState?.data as any;
          if (gameData) {
            // Emit update when transitioning from complete to new round
            if (lastRoundComplete && !gameData.roundComplete && gameData.currentWord) {
              io.to(gameId).emit('game-updated', gameState);
            }
            lastRoundComplete = gameData.roundComplete;
          }
        }, 500);
        
        gameStatePolling.set(gameId, pollInterval);
      }

      // For chess, trigger AI's first move if AI is white
      if (data.gameType === 'chess') {
        const gameState = gameManager.getGameState(gameId);
        if (gameState) {
          const gameData = gameState.data as any;
          const aiPlayer = gameState.players.find(p => p.type === 'ai');
          if (aiPlayer && gameData.playerColors && gameData.playerColors[aiPlayer.id] === 'w') {
            // AI plays white, so make the first move after a short delay
            setTimeout(async () => {
              try {
                console.log('AI making first move as white');
                await gameManager.processAIMove(gameId, aiPlayer.id);
                const updatedGameState = gameManager.getGameState(gameId);
                console.log('AI first move completed');
                io.to(gameId).emit('game-updated', updatedGameState);
              } catch (error) {
                console.error('AI first move error:', error);
                // Still emit the current state so game doesn't freeze
                const currentState = gameManager.getGameState(gameId);
                if (currentState) {
                  io.to(gameId).emit('game-updated', currentState);
                }
              }
            }, 1500);
          }
        }
      }

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
        const winner = gameState.winner;
        gameState.players.forEach(player => {
          const isWinner = winner && winner.id === player.id;
          leaderboardService.addEntry(
            player.name,
            player.score,
            gameState!.type,
            player.type === 'human',
            isWinner
          );
        });
        io.to(gameId).emit('game-finished', gameState);
        return; // Don't process AI move if game is finished
      }

      const game = gameManager.getGame(gameId);
      if (game && gameState?.status === 'playing') {
        const aiPlayer = gameState.players.find(p => p.type === 'ai');
        if (aiPlayer) {
          try {
            console.log('Processing AI move for game:', gameId);
            await gameManager.processAIMove(gameId, aiPlayer.id);
            gameState = gameManager.getGameState(gameId);
            console.log('AI move successful, game status:', gameState?.status);
            
            io.to(gameId).emit('game-updated', gameState);
            
            if (gameState?.status === 'finished') {
              // Record scores for both players in leaderboard
              const winner = gameState.winner;
              gameState.players.forEach(player => {
                const isWinner = winner && winner.id === player.id;
                leaderboardService.addEntry(
                  player.name,
                  player.score,
                  gameState!.type,
                  player.type === 'human',
                  isWinner
                );
              });
              
              io.to(gameId).emit('game-finished', gameState);
            }
          } catch (error) {
            console.error('AI move error:', error);
            // Don't let the game freeze - emit an update even on error
            const currentState = gameManager.getGameState(gameId);
            if (currentState) {
              io.to(gameId).emit('game-updated', currentState);
            }
            // Notify user of the error
            io.to(gameId).emit('error', { message: 'AI had trouble making a move. You can continue playing.' });
          }
        }
      }

    } catch (error) {
      socket.emit('error', { message: 'Invalid move' });
      console.error('Error processing move:', error);
    }
  });

  socket.on('get-game-types', () => {
    const gameTypes = gameManager.getAvailableGameTypes();
    console.log('Sending game types:', gameTypes);
    socket.emit('game-types', gameTypes);
  });

  socket.on('disconnect', () => {
    const gameId = activeGames.get(socket.id);
    if (gameId) {
      // Clean up polling if exists
      const pollInterval = gameStatePolling.get(gameId);
      if (pollInterval) {
        clearInterval(pollInterval);
        gameStatePolling.delete(gameId);
      }
      
      gameManager.deleteGame(gameId);
      activeGames.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', games: gameManager.getAvailableGameTypes() });
});

app.get('/api/win-stats', (_req, res) => {
  const stats = leaderboardService.getWinStatistics();
  res.json(stats);
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

app.get('/api/leaderboard/game-stats', (_req, res) => {
  const gameStats = leaderboardService.getGameTypeStats();
  res.json(gameStats);
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Available games: ${gameManager.getAvailableGameTypes().join(', ')}`);
});
import { Chess } from 'chess.js';
import { BaseGame, GameConfig, GameState, Player, GameMove, GameResult } from '../types/game';
import { OpenAIService } from '../services/openai';

interface ChessMove {
  from: string;
  to: string;
  promotion?: string;
}

interface ChessGameData {
  fen: string;
  playerColors: Record<string, 'w' | 'b'>;
  moveHistory: Array<{
    player: string;
    move: ChessMove;
    fen: string;
    timestamp: number;
  }>;
  lastMove?: { from: string; to: string };
  aiMoveReady?: ChessMove;
  currentTurn: 'w' | 'b';
}

export class ChessGame extends BaseGame {
  config: GameConfig = {
    name: 'Chess',
    description: 'Classical chess game against ChatGPT',
    minPlayers: 2,
    maxPlayers: 2,
    maxRounds: 1
  };

  state: GameState;
  private chess: Chess;
  private openAI = new OpenAIService();

  constructor() {
    super();
    this.chess = new Chess();
    this.state = {} as GameState;
  }

  async initialize(players: Player[]): Promise<void> {
    this.chess.reset();
    
    const humanPlayer = players.find(p => p.type === 'human');
    const aiPlayer = players.find(p => p.type === 'ai');
    
    if (!humanPlayer || !aiPlayer) {
      throw new Error('Chess requires one human and one AI player');
    }

    const humanColor = Math.random() < 0.5 ? 'w' : 'b';
    const aiColor = humanColor === 'w' ? 'b' : 'w';

    this.state.data = {
      fen: this.chess.fen(),
      playerColors: {
        [humanPlayer.id]: humanColor,
        [aiPlayer.id]: aiColor
      },
      moveHistory: [],
      currentTurn: 'w'
    } as ChessGameData;

    this.state.status = 'playing';
    this.state.currentRound = 0;

    if (aiColor === 'w') {
      await this.preFetchAIMove();
    }
  }

  async processMove(move: GameMove): Promise<void> {
    const gameData = this.state.data as ChessGameData;
    const playerColor = gameData.playerColors[move.playerId];
    
    console.log('Processing move:', JSON.stringify(move.move), 'for player:', move.playerId, 'color:', playerColor);
    
    if (!playerColor || this.chess.turn() !== playerColor) {
      throw new Error('Not your turn');
    }

    if (!this.isValidMove(move.move, move.playerId)) {
      console.error('Move validation failed for:', JSON.stringify(move.move));
      throw new Error('Invalid move');
    }

    const chessMove = move.move as ChessMove;
    
    try {
      const result = this.chess.move({
        from: chessMove.from,
        to: chessMove.to,
        promotion: chessMove.promotion || 'q'
      });

      if (!result) {
        throw new Error('Invalid chess move');
      }

      gameData.fen = this.chess.fen();
      gameData.currentTurn = this.chess.turn();
      gameData.lastMove = { from: chessMove.from, to: chessMove.to };
      gameData.moveHistory.push({
        player: move.playerId,
        move: chessMove,
        fen: gameData.fen,
        timestamp: Date.now()
      });

      if (this.chess.isGameOver()) {
        this.state.status = 'finished';
        const result = this.checkWinCondition();
        if (result) {
          this.state.winner = result.winner;
        }
      } else {
        // Pre-fetch next AI move for better performance
        const aiPlayer = this.state.players.find(p => p.type === 'ai');
        if (aiPlayer && gameData.currentTurn === gameData.playerColors[aiPlayer.id]) {
          this.preFetchAIMove().catch(error => {
            console.error('Error pre-fetching AI move:', error);
          });
        }
      }
    } catch (error) {
      console.error('Error processing move:', error);
      throw error;
    }
  }

  async getAIMove(): Promise<ChessMove> {
    const gameData = this.state.data as ChessGameData;
    
    if (gameData.aiMoveReady) {
      const move = gameData.aiMoveReady;
      gameData.aiMoveReady = undefined;
      return move;
    }
    
    const move = await this.generateAIMove();
    if (!move) {
      // Emergency fallback - get any valid move
      const validMoves = this.chess.moves({ verbose: true });
      if (validMoves.length === 0) {
        throw new Error('No valid moves available');
      }
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      return {
        from: randomMove.from,
        to: randomMove.to,
        promotion: randomMove.promotion
      };
    }
    return move;
  }

  private async preFetchAIMove(): Promise<void> {
    const gameData = this.state.data as ChessGameData;
    try {
      const move = await this.generateAIMove();
      if (move) {
        gameData.aiMoveReady = move;
      } else {
        // Set a random move as fallback
        const validMoves = this.chess.moves({ verbose: true });
        if (validMoves.length > 0) {
          const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
          gameData.aiMoveReady = {
            from: randomMove.from,
            to: randomMove.to,
            promotion: randomMove.promotion
          };
        }
      }
    } catch (error) {
      console.error('Error pre-fetching AI move, using random fallback:', error);
      // Set a random move as fallback
      const validMoves = this.chess.moves({ verbose: true });
      if (validMoves.length > 0) {
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        gameData.aiMoveReady = {
          from: randomMove.from,
          to: randomMove.to,
          promotion: randomMove.promotion
        };
      }
    }
  }

  private async generateAIMove(): Promise<ChessMove | null> {
    const gameData = this.state.data as ChessGameData;
    const aiPlayer = this.state.players.find(p => p.type === 'ai');
    
    if (!aiPlayer) return null;
    
    const aiColor = gameData.playerColors[aiPlayer.id];
    const validMoves = this.chess.moves({ verbose: true });
    
    if (validMoves.length === 0) return null;

    const recentMoves = gameData.moveHistory.slice(-10).map(h => {
      return `${h.move.from}-${h.move.to}`;
    }).join(', ');

    const prompt = `You are playing chess as ${aiColor === 'w' ? 'White' : 'Black'}.
    
Current board position (FEN): ${this.chess.fen()}
Recent moves: ${recentMoves || 'Opening position'}

Game state:
- Check: ${this.chess.isCheck()}
- Pieces in play: ${this.getPieceCount()}

Valid moves available:
${validMoves.slice(0, 20).map(m => `${m.from}-${m.to}: ${m.san}`).join('\n')}
${validMoves.length > 20 ? `... and ${validMoves.length - 20} more moves` : ''}

Select the best strategic move. Consider:
1. Tactical opportunities (captures, forks, pins)
2. Positional advantages (center control, piece development)
3. King safety
4. Endgame principles if applicable

Respond with ONLY the move in format: from-to (e.g., "e2-e4")`;

    try {
      const response = await this.openAI.getGameMove('Chess', this.state, prompt);
      console.log('ChatGPT response:', JSON.stringify(response));
      
      let moveStr: string;
      if (typeof response === 'string') {
        moveStr = response.trim();
      } else if (response && typeof response === 'object') {
        // Handle various possible response formats
        if (typeof response.move === 'string') {
          moveStr = response.move.trim();
        } else if (response.from && response.to) {
          moveStr = `${response.from}-${response.to}`;
        } else {
          // Try to extract move from any property
          const possibleMove = Object.values(response).find(v => typeof v === 'string' && v.includes('-'));
          if (possibleMove) {
            moveStr = String(possibleMove).trim();
          } else {
            throw new Error('Invalid AI response format');
          }
        }
      } else {
        throw new Error('Invalid AI response format');
      }

      const [from, to] = moveStr.split('-');
      
      if (from && to && this.chess.get(from as any) && validMoves.some(m => m.from === from && m.to === to)) {
        const moveObj = validMoves.find(m => m.from === from && m.to === to);
        return {
          from,
          to,
          promotion: moveObj?.promotion
        };
      }
      
      console.log('AI suggested invalid move, using random fallback');
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      return {
        from: randomMove.from,
        to: randomMove.to,
        promotion: randomMove.promotion
      };
    } catch (error) {
      console.error('AI move generation error:', error);
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      return {
        from: randomMove.from,
        to: randomMove.to,
        promotion: randomMove.promotion
      };
    }
  }

  private getPieceCount(): string {
    const board = this.chess.board();
    const pieces = { w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }, 
                    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } };
    
    for (const row of board) {
      for (const square of row) {
        if (square) {
          pieces[square.color][square.type]++;
        }
      }
    }
    
    return `White: ${pieces.w.q}Q ${pieces.w.r}R ${pieces.w.b}B ${pieces.w.n}N ${pieces.w.p}P | ` +
           `Black: ${pieces.b.q}Q ${pieces.b.r}R ${pieces.b.b}B ${pieces.b.n}N ${pieces.b.p}P`;
  }

  checkWinCondition(): GameResult | null {
    if (this.state.status !== 'finished') return null;

    const gameData = this.state.data as ChessGameData;
    let winner: Player | undefined;
    let reason = '';

    if (this.chess.isCheckmate()) {
      const loserColor = this.chess.turn();
      const winnerColor = loserColor === 'w' ? 'b' : 'w';
      winner = this.state.players.find(p => 
        gameData.playerColors[p.id] === winnerColor
      );
      reason = 'Checkmate';
    } else if (this.chess.isDraw()) {
      reason = this.chess.isStalemate() ? 'Stalemate' : 
               this.chess.isThreefoldRepetition() ? 'Threefold repetition' :
               this.chess.isInsufficientMaterial() ? 'Insufficient material' : 'Draw';
    }

    if (winner) {
      winner.score = 1;
      const loser = this.state.players.find(p => p.id !== winner!.id);
      if (loser) loser.score = 0;
    } else {
      this.state.players.forEach(p => p.score = 0.5);
    }

    const scores = this.state.players.reduce((acc, player) => {
      acc[player.id] = player.score;
      return acc;
    }, {} as Record<string, number>);

    return {
      winner: winner!,
      scores,
      gameData: { ...gameData, reason }
    };
  }

  isValidMove(move: any, playerId: string): boolean {
    if (this.state.status !== 'playing') return false;
    
    const gameData = this.state.data as ChessGameData;
    const playerColor = gameData.playerColors[playerId];
    
    if (!playerColor || this.chess.turn() !== playerColor) return false;
    
    if (!move || typeof move !== 'object') return false;
    
    const chessMove = move as ChessMove;
    if (!chessMove.from || !chessMove.to) return false;
    
    try {
      const testChess = new Chess(this.chess.fen());
      const result = testChess.move({
        from: chessMove.from,
        to: chessMove.to,
        promotion: chessMove.promotion || 'q'
      });
      return result !== null;
    } catch {
      return false;
    }
  }
}
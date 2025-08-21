import { BaseGame, GameConfig, GameState, Player, GameMove, GameResult } from '../types/game';
import { OpenAIService } from '../services/openai';

type RPSMove = 'rock' | 'paper' | 'scissors';

interface RPSGameData {
  moves: Record<string, RPSMove>;
  aiMoveReady?: RPSMove; // Pre-fetched AI move for current round
  roundHistory: Array<{
    round: number;
    moves: Record<string, RPSMove>;
    winner: string | 'tie';
  }>;
}

export class RockPaperScissorsGame extends BaseGame {
  config: GameConfig = {
    name: 'Rock Paper Scissors',
    description: 'Classic rock paper scissors game',
    minPlayers: 2,
    maxPlayers: 2,
    maxRounds: 5
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
      roundHistory: []
    } as RPSGameData;
    this.state.status = 'playing';
    
    // Pre-fetch AI move for the first round
    await this.preFetchAIMove();
  }

  async processMove(move: GameMove): Promise<void> {
    if (!this.isValidMove(move.move, move.playerId)) {
      throw new Error('Invalid move');
    }

    const gameData = this.state.data as RPSGameData;
    gameData.moves[move.playerId] = move.move;

    if (Object.keys(gameData.moves).length === this.state.players.length) {
      await this.resolveRound();
    }
  }

  private async resolveRound(): Promise<void> {
    const gameData = this.state.data as RPSGameData;
    const players = this.state.players;
    const moves = gameData.moves;

    const [player1, player2] = players;
    const move1 = moves[player1.id];
    const move2 = moves[player2.id];

    let winner: string | 'tie' = 'tie';

    if (this.winsAgainst(move1, move2)) {
      winner = player1.id;
      player1.score++;
    } else if (this.winsAgainst(move2, move1)) {
      winner = player2.id;
      player2.score++;
    }

    gameData.roundHistory.push({
      round: this.state.currentRound + 1,
      moves: { ...moves },
      winner
    });

    this.state.currentRound++;
    gameData.moves = {};

    if (this.state.currentRound >= this.state.maxRounds) {
      this.state.status = 'finished';
      const result = this.checkWinCondition();
      if (result) {
        this.state.winner = result.winner;
      }
    } else {
      // Pre-fetch AI move for the next round
      this.preFetchAIMove().catch(error => {
        console.error('Error pre-fetching AI move for next round:', error);
      });
    }
  }

  private winsAgainst(move1: RPSMove, move2: RPSMove): boolean {
    return (
      (move1 === 'rock' && move2 === 'scissors') ||
      (move1 === 'paper' && move2 === 'rock') ||
      (move1 === 'scissors' && move2 === 'paper')
    );
  }

  checkWinCondition(): GameResult | null {
    if (this.state.status !== 'finished') return null;

    const players = this.state.players;
    const winner = players.reduce((prev, current) => 
      current.score > prev.score ? current : prev
    );

    const scores = players.reduce((acc, player) => {
      acc[player.id] = player.score;
      return acc;
    }, {} as Record<string, number>);

    return {
      winner,
      scores,
      gameData: this.state.data
    };
  }

  async getAIMove(): Promise<RPSMove> {
    const gameData = this.state.data as RPSGameData;
    
    // Use pre-fetched move if available
    if (gameData.aiMoveReady) {
      const move = gameData.aiMoveReady;
      // Clear the pre-fetched move
      gameData.aiMoveReady = undefined;
      return move;
    }
    
    // Fallback to generating move on demand (shouldn't happen in normal flow)
    return this.generateAIMove();
  }

  private async preFetchAIMove(): Promise<void> {
    const gameData = this.state.data as RPSGameData;
    try {
      const move = await this.generateAIMove();
      gameData.aiMoveReady = move;
    } catch (error) {
      console.error('Error pre-fetching AI move:', error);
      // Set a random move as fallback
      gameData.aiMoveReady = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)] as RPSMove;
    }
  }

  private async generateAIMove(): Promise<RPSMove> {
    const gameData = this.state.data as RPSGameData;
    const prompt = `You are playing Rock Paper Scissors. 
    
Round ${this.state.currentRound + 1} of ${this.state.maxRounds}.
Previous rounds: ${JSON.stringify(gameData.roundHistory)}

Your options are: "rock", "paper", or "scissors"
Try to predict your opponent's pattern and counter it.

Respond with only one word: rock, paper, or scissors`;

    try {
      const response = await this.openAI.getGameMove('Rock Paper Scissors', this.state, prompt);
      const move = typeof response === 'string' ? response.toLowerCase() : response.move?.toLowerCase();
      
      if (['rock', 'paper', 'scissors'].includes(move)) {
        return move as RPSMove;
      }
      
      return ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)] as RPSMove;
    } catch (error) {
      console.error('AI move error, using random:', error);
      return ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)] as RPSMove;
    }
  }

  isValidMove(move: any, playerId: string): boolean {
    if (this.state.status !== 'playing') return false;
    if (!['rock', 'paper', 'scissors'].includes(move)) return false;
    
    const gameData = this.state.data as RPSGameData;
    return !gameData.moves[playerId];
  }
}
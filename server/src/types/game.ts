export interface Player {
  id: string;
  name: string;
  type: 'human' | 'ai';
  score: number;
}

export interface GameState {
  id: string;
  type: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  currentRound: number;
  maxRounds: number;
  data: any;
  winner?: Player;
}

export interface GameConfig {
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  maxRounds: number;
}

export interface GameMove {
  playerId: string;
  gameId: string;
  move: any;
  timestamp: number;
}

export interface GameResult {
  winner: Player;
  scores: Record<string, number>;
  gameData: any;
}

export abstract class BaseGame {
  abstract config: GameConfig;
  abstract state: GameState;

  abstract initialize(players: Player[]): void | Promise<void>;
  abstract processMove(move: GameMove): Promise<void>;
  abstract checkWinCondition(): GameResult | null;
  abstract getAIMove(): Promise<any>;
  abstract isValidMove(move: any, playerId: string): boolean;
}
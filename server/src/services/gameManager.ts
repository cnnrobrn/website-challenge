import { BaseGame, GameState, Player, GameMove, GameResult } from '../types/game';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private games: Map<string, BaseGame> = new Map();
  private gameTypes: Map<string, new () => BaseGame> = new Map();

  registerGameType(name: string, gameClass: new () => BaseGame) {
    this.gameTypes.set(name, gameClass);
  }

  async createGame(gameType: string, players: Player[]): Promise<string> {
    const GameClass = this.gameTypes.get(gameType);
    if (!GameClass) {
      throw new Error(`Game type "${gameType}" not found`);
    }

    const gameId = uuidv4();
    const game = new GameClass();
    game.state = {
      id: gameId,
      type: gameType,
      players,
      status: 'waiting',
      currentRound: 0,
      maxRounds: game.config.maxRounds,
      data: {}
    };

    await game.initialize(players);
    this.games.set(gameId, game);
    return gameId;
  }

  getGame(gameId: string): BaseGame | undefined {
    return this.games.get(gameId);
  }

  async processMove(gameId: string, move: GameMove): Promise<GameState> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    await game.processMove(move);
    return game.state;
  }

  async processAIMove(gameId: string, aiPlayerId: string): Promise<GameState> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    const aiMove = await game.getAIMove();
    const move: GameMove = {
      playerId: aiPlayerId,
      gameId,
      move: aiMove,
      timestamp: Date.now()
    };

    await game.processMove(move);
    return game.state;
  }

  getGameState(gameId: string): GameState | undefined {
    const game = this.games.get(gameId);
    return game?.state;
  }

  getAvailableGameTypes(): string[] {
    return Array.from(this.gameTypes.keys());
  }

  deleteGame(gameId: string): boolean {
    return this.games.delete(gameId);
  }
}
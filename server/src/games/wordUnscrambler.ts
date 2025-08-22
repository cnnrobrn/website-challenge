import { BaseGame, GameConfig, GameState, Player, GameMove, GameResult } from '../types/game';
import { getRandomWord, scrambleWord, ALL_WORDS } from '../data/words';
import { OpenAIService } from '../services/openai';

interface WordUnscramblerMove {
  guess: string;
}

interface WordUnscramblerGameData {
  currentWord: string;
  scrambledWord: string;
  roundStartTime: number;
  roundEndTime?: number;
  roundComplete: boolean;
  roundWinner: string | null;
  humanGuess: string | null;
  aiGuess: string | null;
  humanGuessTime: number | null;
  aiGuessTime: number | null;
  aiResponseReady: boolean;
  preFetchedAIGuess?: string;
  lastAIPrompt?: string; // Store the last prompt sent to OpenAI
  wordHistory: Array<{
    round: number;
    word: string;
    scrambled: string;
    humanGuess: string;
    aiGuess: string;
    winner: string | 'tie';
    timeElapsed: number;
    humanResponseTime?: number;
    aiResponseTime?: number;
  }>;
}

export class WordUnscramblerGame extends BaseGame {
  config: GameConfig = {
    name: 'Word Unscrambler',
    description: 'Unscramble words faster than the AI',
    minPlayers: 2,
    maxPlayers: 2,
    maxRounds: 5
  };

  state: GameState;
  private openAI = new OpenAIService();
  private roundTransitionPending = false;

  constructor() {
    super();
    this.state = {} as GameState;
  }

  async initialize(players: Player[]): Promise<void> {
    if (players.length !== 2) {
      throw new Error('Word Unscrambler requires exactly 2 players');
    }

    const humanPlayer = players.find(p => p.type === 'human');
    const aiPlayer = players.find(p => p.type === 'ai');

    if (!humanPlayer || !aiPlayer) {
      throw new Error('Need exactly one human and one AI player');
    }

    this.state = {
      id: '',
      type: 'word-unscrambler',
      players: players.map(p => ({ ...p, score: 0 })),
      status: 'playing',
      currentRound: 0,
      maxRounds: this.config.maxRounds,
      data: {
        currentWord: '',
        scrambledWord: '',
        roundStartTime: Date.now(),
        roundComplete: false,
        roundWinner: null,
        humanGuess: null,
        aiGuess: null,
        humanGuessTime: null,
        aiGuessTime: null,
        aiResponseReady: false,
        wordHistory: []
      } as WordUnscramblerGameData
    };

    await this.startNewRound();
  }

  private async startNewRound(): Promise<void> {
    const gameData = this.state.data as WordUnscramblerGameData;
    
    gameData.currentWord = getRandomWord();
    gameData.scrambledWord = scrambleWord(gameData.currentWord);
    gameData.roundStartTime = Date.now();
    gameData.roundComplete = false;
    gameData.roundWinner = null;
    gameData.humanGuess = null;
    gameData.aiGuess = null;
    gameData.humanGuessTime = null;
    gameData.aiGuessTime = null;
    gameData.aiResponseReady = false;

    this.preFetchAIMove();
  }

  private async preFetchAIMove(): Promise<void> {
    const gameData = this.state.data as WordUnscramblerGameData;
    const aiPlayer = this.state.players.find(p => p.type === 'ai');
    const humanPlayer = this.state.players.find(p => p.type === 'human');
    
    try {
      const prompt = `You are playing Word Unscrambler as ${aiPlayer?.name || 'AI'} against ${humanPlayer?.name || 'opponent'}.
      
      The scrambled letters are: "${gameData.scrambledWord}"
      
      You need to unscramble these letters to form a valid English word.
      The word has ${gameData.scrambledWord.length} letters.
      
      Think step by step:
      1. What are the available letters?
      2. What common English words can be formed from these letters?
      3. Make sure your answer uses ALL the letters exactly once.
      
      Try to solve this quickly to beat ${humanPlayer?.name || 'your opponent'}!
      
      Respond with a JSON object containing only: {"guess": "YOUR_WORD_IN_UPPERCASE"}`;

      // Store the prompt for client display
      gameData.lastAIPrompt = prompt;

      const aiMove = await this.openAI.getGameMove('word-unscrambler', gameData, prompt);

      gameData.preFetchedAIGuess = (aiMove.guess || '').trim().toUpperCase();
      gameData.aiResponseReady = true;
    } catch (error) {
      console.error('Failed to pre-fetch AI move:', error);
      // AI fails - no fallback
      gameData.preFetchedAIGuess = undefined;
      gameData.aiResponseReady = false;
    }
  }



  async processMove(move: GameMove): Promise<void> {
    const gameData = this.state.data as WordUnscramblerGameData;
    
    if (gameData.roundComplete) {
      throw new Error('Round already complete');
    }

    const player = this.state.players.find(p => p.id === move.playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const wordMove = move.move as WordUnscramblerMove;
    const guess = wordMove.guess.toUpperCase();
    const currentTime = Date.now();

    if (player.type === 'human') {
      if (gameData.humanGuess) {
        throw new Error('Human already made a guess this round');
      }
      
      gameData.humanGuess = guess;
      gameData.humanGuessTime = currentTime;

      await this.simulateAIResponse();
      
      if (gameData.aiGuess) {
        await this.evaluateRound();
      }
    }
  }

  private async simulateAIResponse(): Promise<void> {
    const gameData = this.state.data as WordUnscramblerGameData;
    
    if (gameData.aiGuess) return;

    const aiDelay = Math.random() * 1000 + 500;
    await new Promise(resolve => setTimeout(resolve, aiDelay));

    const aiPlayer = this.state.players.find(p => p.type === 'ai');
    if (!aiPlayer) return;

    // If AI has no pre-fetched guess, it fails (gives empty/wrong answer)
    gameData.aiGuess = gameData.preFetchedAIGuess || 'FAILED';
    gameData.aiGuessTime = Date.now();
  }

  private async evaluateRound(): Promise<void> {
    const gameData = this.state.data as WordUnscramblerGameData;
    const humanPlayer = this.state.players.find(p => p.type === 'human');
    const aiPlayer = this.state.players.find(p => p.type === 'ai');

    if (!humanPlayer || !aiPlayer) return;

    const humanCorrect = gameData.humanGuess === gameData.currentWord;
    const aiCorrect = gameData.aiGuess === gameData.currentWord;

    let winner: string | 'tie';
    
    if (humanCorrect && aiCorrect) {
      const humanTime = (gameData.humanGuessTime || 0) - gameData.roundStartTime;
      const aiTime = (gameData.aiGuessTime || 0) - gameData.roundStartTime;
      
      if (humanTime < aiTime) {
        winner = humanPlayer.id;
        humanPlayer.score++;
      } else if (aiTime < humanTime) {
        winner = aiPlayer.id;
        aiPlayer.score++;
      } else {
        winner = 'tie';
      }
    } else if (humanCorrect) {
      winner = humanPlayer.id;
      humanPlayer.score++;
    } else if (aiCorrect) {
      winner = aiPlayer.id;
      aiPlayer.score++;
    } else {
      winner = 'tie';
    }

    gameData.roundWinner = winner;
    gameData.roundComplete = true;
    gameData.roundEndTime = Date.now();

    gameData.wordHistory.push({
      round: this.state.currentRound,
      word: gameData.currentWord,
      scrambled: gameData.scrambledWord,
      humanGuess: gameData.humanGuess || '',
      aiGuess: gameData.aiGuess || '',
      winner: winner,
      timeElapsed: gameData.roundEndTime - gameData.roundStartTime,
      humanResponseTime: gameData.humanGuessTime ? gameData.humanGuessTime - gameData.roundStartTime : undefined,
      aiResponseTime: gameData.aiGuessTime ? gameData.aiGuessTime - gameData.roundStartTime : undefined
    });

    // Mark that we need a round transition after a delay
    this.roundTransitionPending = true;
    
    setTimeout(async () => {
      this.state.currentRound++;
      
      if (this.state.currentRound >= this.state.maxRounds) {
        this.state.status = 'finished';
        const result = this.checkWinCondition();
        if (result) {
          this.state.winner = result.winner;
        }
      } else {
        await this.startNewRound();
      }
      this.roundTransitionPending = false;
    }, 3000);
  }

  checkWinCondition(): GameResult | null {
    if (this.state.status !== 'finished') {
      return null;
    }

    const humanPlayer = this.state.players.find(p => p.type === 'human');
    const aiPlayer = this.state.players.find(p => p.type === 'ai');

    if (!humanPlayer || !aiPlayer) {
      return null;
    }

    let winner: Player;
    if (humanPlayer.score > aiPlayer.score) {
      winner = humanPlayer;
    } else if (aiPlayer.score > humanPlayer.score) {
      winner = aiPlayer;
    } else {
      winner = humanPlayer;
    }

    return {
      winner,
      scores: {
        [humanPlayer.id]: humanPlayer.score,
        [aiPlayer.id]: aiPlayer.score
      },
      gameData: this.state.data
    };
  }

  async getAIMove(): Promise<any> {
    const gameData = this.state.data as WordUnscramblerGameData;
    // If no pre-fetched guess, AI fails
    if (!gameData.preFetchedAIGuess) {
      throw new Error('AI failed to generate a guess');
    }
    return { guess: gameData.preFetchedAIGuess };
  }

  isValidMove(move: any, playerId: string): boolean {
    if (!move || !move.guess) return false;
    
    const gameData = this.state.data as WordUnscramblerGameData;
    const player = this.state.players.find(p => p.id === playerId);
    
    if (!player || player.type !== 'human') return false;
    if (gameData.roundComplete) return false;
    if (gameData.humanGuess) return false;
    
    return typeof move.guess === 'string' && move.guess.length > 0;
  }

  needsStateUpdate(): boolean {
    return this.roundTransitionPending;
  }
}
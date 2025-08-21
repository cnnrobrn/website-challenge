import { BaseGame, GameConfig, GameState, Player, GameMove, GameResult } from '../types/game';
import { OpenAIService } from '../services/openai';
import { getRandomWord } from '../data/words';

interface WordUnscramblerMove {
  guess: string;
}

interface WordUnscramblerGameData {
  currentWord: string;
  scrambledWord: string;
  humanGuess?: string;
  aiGuess?: string;
  humanGuessTime?: number;
  aiGuessTime?: number;
  roundStartTime: number;
  roundEndTime?: number;
  roundComplete: boolean;
  roundWinner?: string | 'tie';
  aiResponseReady?: boolean;
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
  private pendingAIResponse?: Promise<{ guess: string; time: number }>;

  constructor() {
    super();
    this.state = {} as GameState;
  }

  async initialize(players: Player[]): Promise<void> {
    const firstWord = this.selectRandomWord();
    const scrambledWord = this.scrambleWord(firstWord);
    const roundStartTime = Date.now();
    
    this.state.data = {
      currentWord: firstWord,
      scrambledWord: scrambledWord,
      roundStartTime,
      roundComplete: false,
      wordHistory: [],
      aiResponseReady: false
    } as WordUnscramblerGameData;
    
    // Start AI response immediately (race condition)
    this.startAIResponse(scrambledWord, roundStartTime);
    
    this.state.status = 'playing';
  }

  async processMove(move: GameMove): Promise<void> {
    console.log('Processing move:', JSON.stringify(move));
    
    if (!this.isValidMove(move.move, move.playerId)) {
      console.log('Move validation failed');
      throw new Error('Invalid move');
    }

    const gameData = this.state.data as WordUnscramblerGameData;
    const guess = (move.move as WordUnscramblerMove).guess.toUpperCase();
    const humanPlayer = this.state.players.find(p => p.type === 'human');
    const aiPlayer = this.state.players.find(p => p.type === 'ai');
    const guessTime = Date.now();
    
    console.log(`Human guess: "${guess}" for word: "${gameData.currentWord}" (scrambled: "${gameData.scrambledWord}")`);
    
    if (!humanPlayer || !aiPlayer) {
      throw new Error('Invalid player configuration');
    }

    // Only allow human to submit guess, and only once per round
    if (move.playerId !== humanPlayer.id) {
      throw new Error('Only human player can submit guesses');
    }
    
    if (gameData.roundComplete || gameData.humanGuess !== undefined) {
      throw new Error('Round is already complete or guess already submitted');
    }

    // Store human guess and timestamp
    gameData.humanGuess = guess;
    gameData.humanGuessTime = guessTime;
    
    // Check if human got it right
    const humanCorrect = guess === gameData.currentWord;
    
    if (humanCorrect) {
      // Human got it right! Check if AI has responded yet
      if (gameData.aiResponseReady && gameData.aiGuess) {
        // AI already responded - compare times
        const aiCorrect = gameData.aiGuess === gameData.currentWord;
        
        if (aiCorrect && gameData.aiGuessTime! < guessTime) {
          // AI was correct and faster
          await this.endRound(aiPlayer.id, 'AI was faster');
        } else {
          // Human wins (AI wrong or human was faster)
          await this.endRound(humanPlayer.id, humanCorrect && aiCorrect ? 'Human was faster' : 'Human was correct');
        }
      } else {
        // AI hasn't responded yet - human wins immediately
        await this.endRound(humanPlayer.id, 'Human answered correctly first');
      }
    } else {
      // Human was wrong - wait for AI or check if AI already responded
      if (gameData.aiResponseReady && gameData.aiGuess) {
        // AI already responded
        const aiCorrect = gameData.aiGuess === gameData.currentWord;
        if (aiCorrect) {
          await this.endRound(aiPlayer.id, 'AI was correct, human was wrong');
        } else {
          await this.endRound('tie', 'Both were wrong');
        }
      } else {
        // Wait for AI response
        this.waitForAIResponse();
      }
    }
  }

  private startAIResponse(scrambledWord: string, roundStartTime: number): void {
    this.pendingAIResponse = this.getAIMove().then(aiMove => ({
      guess: aiMove.guess.toUpperCase(),
      time: Date.now()
    }));

    // Handle AI response when it arrives
    this.pendingAIResponse.then(aiResponse => {
      const gameData = this.state.data as WordUnscramblerGameData;
      
      if (!gameData.roundComplete) {
        gameData.aiGuess = aiResponse.guess;
        gameData.aiGuessTime = aiResponse.time;
        gameData.aiResponseReady = true;
        
        console.log(`AI guess: "${aiResponse.guess}" at time: ${aiResponse.time - roundStartTime}ms`);
        
        // Check if we need to end the round (if human already guessed wrong)
        if (gameData.humanGuess && gameData.humanGuess !== gameData.currentWord) {
          // Human was wrong, now check AI
          const aiCorrect = aiResponse.guess === gameData.currentWord;
          const humanPlayer = this.state.players.find(p => p.type === 'human');
          const aiPlayer = this.state.players.find(p => p.type === 'ai');
          
          if (aiCorrect) {
            this.endRound(aiPlayer!.id, 'AI was correct, human was wrong');
          } else {
            this.endRound('tie', 'Both were wrong');
          }
        }
      }
    }).catch(error => {
      console.error('AI response failed:', error);
      const gameData = this.state.data as WordUnscramblerGameData;
      gameData.aiGuess = this.attemptBasicUnscramble(gameData.scrambledWord);
      gameData.aiGuessTime = Date.now();
      gameData.aiResponseReady = true;
    });
  }

  private waitForAIResponse(): void {
    // This method is called when human was wrong and we're waiting for AI
    // The AI response handler will complete the round when ready
  }

  private async endRound(winnerId: string | 'tie', reason: string): Promise<void> {
    const gameData = this.state.data as WordUnscramblerGameData;
    const humanPlayer = this.state.players.find(p => p.type === 'human');
    const aiPlayer = this.state.players.find(p => p.type === 'ai');
    
    if (!humanPlayer || !aiPlayer) {
      throw new Error('Invalid player configuration');
    }

    gameData.roundEndTime = Date.now();
    gameData.roundComplete = true;
    gameData.roundWinner = winnerId;

    // Award points
    if (winnerId === humanPlayer.id) {
      humanPlayer.score++;
    } else if (winnerId === aiPlayer.id) {
      aiPlayer.score++;
    }
    // No points for ties

    console.log(`Round ended: ${reason}, Winner: ${winnerId}`);
    
    // Record round history
    gameData.wordHistory.push({
      round: this.state.currentRound + 1,
      word: gameData.currentWord,
      scrambled: gameData.scrambledWord,
      humanGuess: gameData.humanGuess || '',
      aiGuess: gameData.aiGuess || '',
      winner: winnerId,
      timeElapsed: gameData.roundEndTime - gameData.roundStartTime,
      humanResponseTime: gameData.humanGuessTime ? gameData.humanGuessTime - gameData.roundStartTime : undefined,
      aiResponseTime: gameData.aiGuessTime ? gameData.aiGuessTime - gameData.roundStartTime : undefined
    });
    
    this.state.currentRound++;
    
    // Check if game is finished
    const result = this.checkWinCondition();
    if (result) {
      this.state.status = 'finished';
      this.state.winner = result.winner;
    } else {
      // Start next round immediately
      await this.startNextRound();
    }
  }

  private async startNextRound(): Promise<void> {
    const gameData = this.state.data as WordUnscramblerGameData;
    const newWord = this.selectRandomWord();
    const scrambledWord = this.scrambleWord(newWord);
    const roundStartTime = Date.now();
    
    gameData.currentWord = newWord;
    gameData.scrambledWord = scrambledWord;
    gameData.roundStartTime = roundStartTime;
    gameData.roundEndTime = undefined;
    gameData.roundComplete = false;
    gameData.roundWinner = undefined;
    gameData.humanGuess = undefined;
    gameData.aiGuess = undefined;
    gameData.humanGuessTime = undefined;
    gameData.aiGuessTime = undefined;
    gameData.aiResponseReady = false;
    
    // Start AI response immediately for the new round
    this.startAIResponse(scrambledWord, roundStartTime);
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

  async getAIMove(): Promise<WordUnscramblerMove> {
    const gameData = this.state.data as WordUnscramblerGameData;
    
    const prompt = `You are playing a word unscrambling game. You need to unscramble the letters to form a valid English word.

Scrambled letters: ${gameData.scrambledWord}

You get ONE attempt to solve this. What is the unscrambled word? Respond with ONLY the word, nothing else. Think about common English words that use all these letters exactly once.

Examples:
- GAMIZAN could be AMAZING
- RETUPCOM could be COMPUTER

Your guess:`;

    try {
      const response = await this.openAI.getGameMove('Word Unscrambler', this.state.data, prompt);
      const guess = (response.guess || response).toString().toUpperCase().trim();
      
      // Basic validation - check if guess uses only available letters
      if (this.isValidGuess(guess, gameData.scrambledWord)) {
        return { guess };
      }
    } catch (error) {
      console.error('AI move generation failed:', error);
    }
    
    // Fallback: try some basic unscrambling patterns or return scrambled word
    return { guess: this.attemptBasicUnscramble(gameData.scrambledWord) };
  }

  private isValidGuess(guess: string, scrambledLetters: string): boolean {
    if (guess.length !== scrambledLetters.length) return false;
    
    const available = scrambledLetters.split('');
    const needed = guess.split('');
    
    for (const letter of needed) {
      const index = available.indexOf(letter);
      if (index === -1) return false;
      available.splice(index, 1);
    }
    
    return available.length === 0;
  }

  private attemptBasicUnscramble(scrambled: string): string {
    // Very basic fallback - just return the scrambled word or try some common patterns
    const letters = scrambled.split('');
    
    // Try reversing
    const reversed = letters.reverse().join('');
    
    // Return scrambled as last resort
    return scrambled;
  }

  isValidMove(move: any, playerId: string): boolean {
    if (!move || typeof move.guess !== 'string') return false;
    
    const guess = move.guess.trim();
    if (guess.length === 0) return false;
    
    const gameData = this.state.data as WordUnscramblerGameData;
    
    // Check if round is still active
    if (gameData.roundComplete) return false;
    
    // Only human player can submit moves
    const humanPlayer = this.state.players.find(p => p.type === 'human');
    if (!humanPlayer || playerId !== humanPlayer.id) return false;
    
    // Check if human has already submitted a guess this round
    if (gameData.humanGuess !== undefined) return false;
    
    // Allow any non-empty guess - correctness will be determined during scoring
    return true;
  }

  private selectRandomWord(): string {
    return getRandomWord('all'); // Use all difficulties
  }

  private scrambleWord(word: string): string {
    const letters = word.split('');
    
    // Fisher-Yates shuffle
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    
    // Make sure it's actually scrambled (not the same as original)
    const scrambled = letters.join('');
    if (scrambled === word && word.length > 1) {
      // Swap first two letters if we got the same word
      [letters[0], letters[1]] = [letters[1], letters[0]];
      return letters.join('');
    }
    
    return scrambled;
  }
}
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
        
        const aiCorrect = aiResponse.guess === gameData.currentWord;
        const humanPlayer = this.state.players.find(p => p.type === 'human');
        const aiPlayer = this.state.players.find(p => p.type === 'ai');
        
        if (aiCorrect) {
          // AI got it right!
          if (!gameData.humanGuess) {
            // Human hasn't guessed yet - AI wins immediately
            this.endRound(aiPlayer!.id, 'AI answered correctly first');
          } else {
            // Human already guessed - check if human was right and faster
            const humanCorrect = gameData.humanGuess === gameData.currentWord;
            if (humanCorrect && gameData.humanGuessTime! < aiResponse.time) {
              // Human was correct and faster - already handled in processMove
              return;
            } else {
              // AI wins (human wrong or AI was faster)
              this.endRound(aiPlayer!.id, humanCorrect ? 'AI was faster' : 'AI was correct, human was wrong');
            }
          }
        } else {
          // AI was wrong
          if (gameData.humanGuess && gameData.humanGuess !== gameData.currentWord) {
            // Both were wrong
            this.endRound('tie', 'Both were wrong');
          }
          // If human hasn't guessed yet or human was right, wait for human/round already ended
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
    
    const prompt = `Unscramble these letters to form a common English word: ${gameData.scrambledWord}

Rules:
- Use ALL letters exactly once
- Form a valid English word
- Respond with ONLY the unscrambled word, no explanation

Examples:
- GAMIZAN → AMAZING
- RETUPCOM → COMPUTER
- ELAPP → APPLE

Scrambled: ${gameData.scrambledWord}
Answer:`;

    try {
      const response = await this.openAI.getGameMove('Word Unscrambler', this.state.data, prompt);
      console.log('Raw AI response:', response);
      
      let guess: string;
      if (typeof response === 'string') {
        guess = response.toUpperCase().trim();
      } else if (response.guess) {
        guess = response.guess.toString().toUpperCase().trim();
      } else if (response.answer) {
        guess = response.answer.toString().toUpperCase().trim();
      } else {
        // Try to extract any text from the response
        guess = JSON.stringify(response).replace(/[^A-Z]/g, '');
      }
      
      console.log('Processed AI guess:', guess);
      
      // Don't validate - let any guess through for fairness
      if (guess && guess.length > 0) {
        return { guess };
      }
    } catch (error) {
      console.error('AI move generation failed:', error);
    }
    
    // Better fallback: try some actual unscrambling logic
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
    // Try multiple unscrambling strategies
    const letters = scrambled.split('');
    
    // Strategy 1: Try reversing
    const reversed = [...letters].reverse().join('');
    if (this.isCommonWord(reversed)) return reversed;
    
    // Strategy 2: Try some common letter patterns
    const patterns = [
      // Try putting vowels first
      this.arrangeVowelsFirst(letters),
      // Try alphabetical order
      [...letters].sort().join(''),
      // Try reverse alphabetical
      [...letters].sort().reverse().join(''),
      // Try common prefixes
      this.tryCommonPrefixes(letters),
    ];
    
    for (const pattern of patterns) {
      if (pattern && this.isCommonWord(pattern)) {
        return pattern;
      }
    }
    
    // Last resort: just try the original word from our database that matches these letters
    const possibleWord = this.findWordWithLetters(letters);
    return possibleWord || scrambled; // Return something, even if wrong
  }

  private isCommonWord(word: string): boolean {
    // Check against our word database
    return this.getAllPossibleWords().includes(word);
  }

  private getAllPossibleWords(): string[] {
    // Import from our word database
    const { ALL_WORDS } = require('../data/words');
    return ALL_WORDS;
  }

  private arrangeVowelsFirst(letters: string[]): string {
    const vowels = letters.filter(l => 'AEIOU'.includes(l));
    const consonants = letters.filter(l => !'AEIOU'.includes(l));
    return [...vowels, ...consonants].join('');
  }

  private tryCommonPrefixes(letters: string[]): string {
    const prefixes = ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY', 'WHO', 'BOY', 'DID', 'HAS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE'];
    
    for (const prefix of prefixes) {
      if (prefix.split('').every(letter => letters.includes(letter))) {
        // Try building word with this prefix
        const remaining = [...letters];
        for (const letter of prefix) {
          const index = remaining.indexOf(letter);
          if (index > -1) remaining.splice(index, 1);
        }
        const attempt = prefix + remaining.join('');
        if (this.isCommonWord(attempt)) return attempt;
      }
    }
    return '';
  }

  private findWordWithLetters(letters: string[]): string | null {
    const allWords = this.getAllPossibleWords();
    const letterCount = letters.reduce((acc, letter) => {
      acc[letter] = (acc[letter] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const word of allWords) {
      if (word.length === letters.length) {
        const wordLetters = word.split('').reduce((acc, letter) => {
          acc[letter] = (acc[letter] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Check if letter counts match exactly
        const matches = Object.keys(letterCount).every(letter => 
          wordLetters[letter] === letterCount[letter]
        ) && Object.keys(wordLetters).every(letter => 
          letterCount[letter] === wordLetters[letter]
        );

        if (matches) {
          return word;
        }
      }
    }
    return null;
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
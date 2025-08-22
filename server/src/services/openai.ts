import OpenAI from 'openai';
import { config } from 'dotenv';

config();

// Configuration for each game type
interface GameAIConfig {
  responseFormat: 'simple' | 'json';
  maxTokens: number;
  systemPrompt?: string;
}

const GAME_CONFIGS: Record<string, GameAIConfig> = {
  'chess': {
    responseFormat: 'simple',
    maxTokens: 20,
    systemPrompt: 'You are playing chess. Respond with ONLY the move in the exact format requested. No explanations, no JSON, just the move.'
  },
  'rock paper scissors': {
    responseFormat: 'simple',
    maxTokens: 20,
    systemPrompt: 'You are playing Rock Paper Scissors. Respond with ONLY one word: rock, paper, or scissors. No explanations, no JSON, just the single word.'
  },
  'word-unscrambler': {
    responseFormat: 'json',
    maxTokens: 100,
    systemPrompt: 'You are playing Word Unscrambler. You must respond with valid JSON in the exact format requested. Be competitive and try to solve the puzzle correctly.'
  }
};

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async getGameMove(gameType: string, gameState: any, prompt: string): Promise<any> {
    try {
      // Get game-specific configuration
      const gameTypeLower = gameType.toLowerCase();
      const config = GAME_CONFIGS[gameTypeLower] || {
        responseFormat: 'json',
        maxTokens: 500,
        systemPrompt: `You are playing a game called "${gameType}". You must respond with valid JSON that represents your move. Be competitive and strategic.`
      };
      
      const response = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: config.systemPrompt || `You are playing ${gameType}. Follow the instructions exactly.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: config.maxTokens
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No response from OpenAI');

      // Handle response based on format configuration
      if (config.responseFormat === 'simple') {
        return content.trim();
      }
      
      // For JSON responses
      try {
        return JSON.parse(content.trim());
      } catch (e) {
        console.error('Failed to parse JSON response:', content);
        // If JSON parsing fails but we expected JSON, throw error
        throw new Error(`Invalid JSON response from AI: ${content}`);
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  async generateGamePrompt(gameType: string, gameDescription: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: `Generate a strategic prompt for an AI playing "${gameType}". Game description: ${gameDescription}. The prompt should help the AI understand the rules and play competitively.`
          }
        ],
        temperature: 0.5,
        max_tokens: 300
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating game prompt:', error);
      throw error;
    }
  }
}
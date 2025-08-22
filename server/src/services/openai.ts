import OpenAI from 'openai';
import { config } from 'dotenv';

config();

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async getGameMove(gameType: string, gameState: any, prompt: string): Promise<any> {
    try {
      // For chess, we expect a simple string response, not JSON
      const isChess = gameType.toLowerCase() === 'chess';
      
      const response = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: isChess 
              ? `You are playing chess. Respond with ONLY the move in the exact format requested. No explanations, no JSON, just the move.`
              : `You are playing a game called "${gameType}". You must respond with valid JSON that represents your move. Be competitive and strategic.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: isChess ? 20 : 500
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No response from OpenAI');

      // For chess, return the raw string
      if (isChess) {
        return content.trim();
      }
      
      // For other games, parse as JSON
      try {
        return JSON.parse(content.trim());
      } catch (e) {
        // If JSON parsing fails, return the raw content
        return content.trim();
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
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
      const response = await this.client.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are playing a game called "${gameType}". You must respond with valid JSON that represents your move. Be competitive and strategic.`
          },
          {
            role: "user",
            content: `Current game state: ${JSON.stringify(gameState)}\n\n${prompt}\n\nRespond with only valid JSON representing your move.`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No response from OpenAI');

      return JSON.parse(content.trim());
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
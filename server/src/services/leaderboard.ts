export interface LeaderboardEntry {
  playerName: string;
  score: number;
  gameType: string;
  timestamp: number;
}

export interface LeaderboardStats {
  playerName: string;
  totalWins: number;
  totalGames: number;
  winRate: number;
  bestGame: string;
}

export class LeaderboardService {
  private entries: LeaderboardEntry[] = [];

  addEntry(playerName: string, score: number, gameType: string): void {
    const entry: LeaderboardEntry = {
      playerName,
      score,
      gameType,
      timestamp: Date.now()
    };
    
    this.entries.push(entry);
    
    // Keep only the last 1000 entries to prevent memory issues
    if (this.entries.length > 1000) {
      this.entries = this.entries.slice(-1000);
    }
  }

  getTopScores(gameType?: string, limit: number = 10): LeaderboardEntry[] {
    let filteredEntries = this.entries;
    
    if (gameType) {
      filteredEntries = this.entries.filter(entry => entry.gameType === gameType);
    }
    
    return filteredEntries
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  getPlayerStats(playerName: string): LeaderboardStats {
    const playerEntries = this.entries.filter(
      entry => entry.playerName.toLowerCase() === playerName.toLowerCase()
    );
    
    if (playerEntries.length === 0) {
      return {
        playerName,
        totalWins: 0,
        totalGames: 0,
        winRate: 0,
        bestGame: 'N/A'
      };
    }
    
    const totalGames = playerEntries.length;
    const totalWins = playerEntries.filter(entry => entry.score > 0).length;
    const winRate = Math.round((totalWins / totalGames) * 100);
    
    const bestEntry = playerEntries.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    return {
      playerName,
      totalWins,
      totalGames,
      winRate,
      bestGame: bestEntry.gameType
    };
  }

  getRecentGames(limit: number = 20): LeaderboardEntry[] {
    return this.entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getGameTypeStats(): Record<string, { totalGames: number; averageScore: number }> {
    const stats: Record<string, { totalGames: number; totalScore: number }> = {};
    
    this.entries.forEach(entry => {
      if (!stats[entry.gameType]) {
        stats[entry.gameType] = { totalGames: 0, totalScore: 0 };
      }
      stats[entry.gameType].totalGames++;
      stats[entry.gameType].totalScore += entry.score;
    });
    
    const result: Record<string, { totalGames: number; averageScore: number }> = {};
    Object.keys(stats).forEach(gameType => {
      result[gameType] = {
        totalGames: stats[gameType].totalGames,
        averageScore: Math.round(stats[gameType].totalScore / stats[gameType].totalGames * 100) / 100
      };
    });
    
    return result;
  }

  clearLeaderboard(): void {
    this.entries = [];
  }
}
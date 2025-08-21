export interface LeaderboardEntry {
  playerName: string;
  score: number;
  gameType: string;
  timestamp: number;
  isHuman: boolean;
  isWinner: boolean;
}

export interface LeaderboardStats {
  playerName: string;
  totalWins: number;
  totalGames: number;
  winRate: number;
  bestGame: string;
}

export interface WinStatistics {
  overall: {
    humanWins: number;
    aiWins: number;
    totalGames: number;
    humanWinPercentage: number;
    aiWinPercentage: number;
  };
  byGame: Record<string, {
    humanWins: number;
    aiWins: number;
    totalGames: number;
    humanWinPercentage: number;
    aiWinPercentage: number;
  }>;
  byPlayer: Record<string, {
    wins: number;
    losses: number;
    winPercentage: number;
    gameBreakdown: Record<string, {
      wins: number;
      losses: number;
    }>;
  }>;
}

export class LeaderboardService {
  private entries: LeaderboardEntry[] = [];

  addEntry(playerName: string, score: number, gameType: string, isHuman: boolean = true, isWinner: boolean = false): void {
    const entry: LeaderboardEntry = {
      playerName,
      score,
      gameType,
      timestamp: Date.now(),
      isHuman,
      isWinner
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

  getWinStatistics(): WinStatistics {
    const stats: WinStatistics = {
      overall: {
        humanWins: 0,
        aiWins: 0,
        totalGames: 0,
        humanWinPercentage: 0,
        aiWinPercentage: 0
      },
      byGame: {},
      byPlayer: {}
    };

    // Group entries by game session (pairs of human and AI entries with same timestamp)
    const gameSessions = new Map<string, LeaderboardEntry[]>();
    
    this.entries.forEach(entry => {
      const sessionKey = `${entry.gameType}-${entry.timestamp}`;
      if (!gameSessions.has(sessionKey)) {
        gameSessions.set(sessionKey, []);
      }
      gameSessions.get(sessionKey)!.push(entry);
    });

    // Process each game session
    gameSessions.forEach((entries, sessionKey) => {
      if (entries.length !== 2) return; // Skip incomplete sessions
      
      const humanEntry = entries.find(e => e.isHuman);
      const aiEntry = entries.find(e => !e.isHuman);
      
      if (!humanEntry || !aiEntry) return;
      
      const gameType = humanEntry.gameType;
      const humanName = humanEntry.playerName;
      
      // Initialize game stats if needed
      if (!stats.byGame[gameType]) {
        stats.byGame[gameType] = {
          humanWins: 0,
          aiWins: 0,
          totalGames: 0,
          humanWinPercentage: 0,
          aiWinPercentage: 0
        };
      }
      
      // Initialize player stats if needed
      if (!stats.byPlayer[humanName]) {
        stats.byPlayer[humanName] = {
          wins: 0,
          losses: 0,
          winPercentage: 0,
          gameBreakdown: {}
        };
      }
      
      if (!stats.byPlayer[humanName].gameBreakdown[gameType]) {
        stats.byPlayer[humanName].gameBreakdown[gameType] = {
          wins: 0,
          losses: 0
        };
      }
      
      // Count the win
      stats.overall.totalGames++;
      stats.byGame[gameType].totalGames++;
      
      if (humanEntry.isWinner) {
        stats.overall.humanWins++;
        stats.byGame[gameType].humanWins++;
        stats.byPlayer[humanName].wins++;
        stats.byPlayer[humanName].gameBreakdown[gameType].wins++;
      } else if (aiEntry.isWinner) {
        stats.overall.aiWins++;
        stats.byGame[gameType].aiWins++;
        stats.byPlayer[humanName].losses++;
        stats.byPlayer[humanName].gameBreakdown[gameType].losses++;
      }
    });
    
    // Calculate percentages
    if (stats.overall.totalGames > 0) {
      stats.overall.humanWinPercentage = Math.round((stats.overall.humanWins / stats.overall.totalGames) * 100);
      stats.overall.aiWinPercentage = Math.round((stats.overall.aiWins / stats.overall.totalGames) * 100);
    }
    
    Object.keys(stats.byGame).forEach(gameType => {
      const gameStats = stats.byGame[gameType];
      if (gameStats.totalGames > 0) {
        gameStats.humanWinPercentage = Math.round((gameStats.humanWins / gameStats.totalGames) * 100);
        gameStats.aiWinPercentage = Math.round((gameStats.aiWins / gameStats.totalGames) * 100);
      }
    });
    
    Object.keys(stats.byPlayer).forEach(playerName => {
      const playerStats = stats.byPlayer[playerName];
      const totalGames = playerStats.wins + playerStats.losses;
      if (totalGames > 0) {
        playerStats.winPercentage = Math.round((playerStats.wins / totalGames) * 100);
      }
    });
    
    return stats;
  }
}
import Database from 'better-sqlite3';
import path from 'path';
import { LeaderboardEntry } from './leaderboard';

export class DatabaseService {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(__dirname, '../../data/leaderboard.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_name TEXT NOT NULL,
        score INTEGER NOT NULL,
        game_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        is_human BOOLEAN NOT NULL,
        is_winner BOOLEAN NOT NULL
      )
    `;
    
    this.db.exec(createTableSQL);
    
    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_game_type ON leaderboard(game_type);
      CREATE INDEX IF NOT EXISTS idx_player_name ON leaderboard(player_name);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON leaderboard(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_score ON leaderboard(score DESC);
    `;
    
    this.db.exec(createIndexSQL);
  }

  addEntry(entry: LeaderboardEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO leaderboard (player_name, score, game_type, timestamp, is_human, is_winner)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      entry.playerName,
      entry.score,
      entry.gameType,
      entry.timestamp,
      entry.isHuman ? 1 : 0,
      entry.isWinner ? 1 : 0
    );
  }

  getAllEntries(): LeaderboardEntry[] {
    const stmt = this.db.prepare(`
      SELECT 
        player_name as playerName,
        score,
        game_type as gameType,
        timestamp,
        is_human as isHuman,
        is_winner as isWinner
      FROM leaderboard
      ORDER BY timestamp DESC
      LIMIT 1000
    `);
    
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      playerName: row.playerName,
      score: row.score,
      gameType: row.gameType,
      timestamp: row.timestamp,
      isHuman: row.isHuman === 1,
      isWinner: row.isWinner === 1
    }));
  }

  getTopScores(gameType?: string, limit: number = 10): LeaderboardEntry[] {
    let query = `
      SELECT 
        player_name as playerName,
        score,
        game_type as gameType,
        timestamp,
        is_human as isHuman,
        is_winner as isWinner
      FROM leaderboard
    `;
    
    if (gameType) {
      query += ` WHERE game_type = ?`;
    }
    
    query += ` ORDER BY score DESC LIMIT ?`;
    
    const stmt = this.db.prepare(query);
    const rows = gameType 
      ? stmt.all(gameType, limit) as any[]
      : stmt.all(limit) as any[];
    
    return rows.map(row => ({
      playerName: row.playerName,
      score: row.score,
      gameType: row.gameType,
      timestamp: row.timestamp,
      isHuman: row.isHuman === 1,
      isWinner: row.isWinner === 1
    }));
  }

  getPlayerEntries(playerName: string): LeaderboardEntry[] {
    const stmt = this.db.prepare(`
      SELECT 
        player_name as playerName,
        score,
        game_type as gameType,
        timestamp,
        is_human as isHuman,
        is_winner as isWinner
      FROM leaderboard
      WHERE LOWER(player_name) = LOWER(?)
      ORDER BY timestamp DESC
    `);
    
    const rows = stmt.all(playerName) as any[];
    
    return rows.map(row => ({
      playerName: row.playerName,
      score: row.score,
      gameType: row.gameType,
      timestamp: row.timestamp,
      isHuman: row.isHuman === 1,
      isWinner: row.isWinner === 1
    }));
  }

  getRecentGames(limit: number = 20): LeaderboardEntry[] {
    const stmt = this.db.prepare(`
      SELECT 
        player_name as playerName,
        score,
        game_type as gameType,
        timestamp,
        is_human as isHuman,
        is_winner as isWinner
      FROM leaderboard
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(limit) as any[];
    
    return rows.map(row => ({
      playerName: row.playerName,
      score: row.score,
      gameType: row.gameType,
      timestamp: row.timestamp,
      isHuman: row.isHuman === 1,
      isWinner: row.isWinner === 1
    }));
  }

  clearLeaderboard(): void {
    this.db.exec('DELETE FROM leaderboard');
  }

  getEntryCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM leaderboard');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  cleanupOldEntries(keepLatest: number = 1000): void {
    const stmt = this.db.prepare(`
      DELETE FROM leaderboard 
      WHERE id NOT IN (
        SELECT id FROM leaderboard 
        ORDER BY timestamp DESC 
        LIMIT ?
      )
    `);
    
    stmt.run(keepLatest);
  }

  close(): void {
    this.db.close();
  }
}
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'confirmacoes.db');

export function getDB() {
  const db = new Database(DB_PATH);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS confirmacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      verified BOOLEAN DEFAULT true,
      created_at DATE DEFAULT CURRENT_DATE,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_name, created_at)
    )
  `);
  
  return db;
}
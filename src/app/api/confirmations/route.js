import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server';

const DB_PATH = path.join(process.cwd(), 'data', 'confirmacoes.db');

function getDB() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

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

export async function GET() {
  let db;
  try {
    const today = new Date().toISOString().split('T')[0];
    db = getDB();
    
    const confirmations = db.prepare(`
      SELECT user_name, user_id, timestamp 
      FROM confirmacoes 
      WHERE created_at = ? 
      ORDER BY timestamp ASC
    `).all(today);
    
    return NextResponse.json(confirmations);
  } catch (error) {
    console.error('Erro ao buscar confirmações:', error);
    return NextResponse.json([]);
  } finally {
    if (db) db.close();
  }
}

export async function POST(request) {
  let db;
  try {
    const { user_name, user_id } = await request.json();
    
    if (!user_name || !user_id) {
      return NextResponse.json({ error: 'Nome e ID são obrigatórios' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    db = getDB();
    
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO confirmacoes (user_name, user_id, created_at) 
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(user_name, user_id, today);
    const wasAdded = result.changes > 0;
    
    const todayConfirmations = db.prepare(`
      SELECT user_name, user_id, timestamp 
      FROM confirmacoes 
      WHERE created_at = ? 
      ORDER BY timestamp ASC
    `).all(today);
    
    return NextResponse.json({
      success: true,
      added: wasAdded,
      confirmations: todayConfirmations
    });
  } catch (error) {
    console.error('Erro ao salvar confirmação:', error);
    return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });
  } finally {
    if (db) db.close();
  }
}
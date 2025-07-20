import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function POST(request) {
  try {
    const { user } = await request.json();
    const [userName, userId] = user.split(':');
    const today = new Date().toISOString().split('T')[0];
    
    const db = getDB();
    
    // Tenta inserir (IGNORE se já existe)
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO confirmacoes (user_name, user_id, created_at) 
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(userName, userId, today);
    
    // Busca todas confirmações de hoje
    const todayConfirmations = db.prepare(`
      SELECT user_name FROM confirmacoes 
      WHERE created_at = ? 
      ORDER BY timestamp
    `).all(today);
    
    db.close();
    
    return NextResponse.json({
      success: true,
      added: result.changes > 0,
      confirmations: todayConfirmations.map(row => ({ user: `${row.user_name}:` }))
    });
  } catch (error) {
    console.error('Erro ao salvar:', error);
    return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const db = getDB();
    
    const confirmations = db.prepare(`
      SELECT user_name, user_id FROM confirmacoes 
      WHERE created_at = ? 
      ORDER BY timestamp
    `).all(today);
    
    db.close();
    
    // Retorna no formato que o frontend espera
    const formattedData = confirmations.map(row => ({
      user: `${row.user_name}:${row.user_id}`,
      verified: true,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Erro ao ler:', error);
    return NextResponse.json([]);
  }
}

// Frontend permanece o mesmo!
// Só precisa ajustar o markVerified:

const markVerified = async () => {
  localStorage.setItem(STORAGE_VERIFIED, "true");
  setVerified(true);

  if (user && !confirmedUsers.includes(user.name)) {
    setConfirmedUsers(prev => [...prev, user.name]);
  }

  try {
    const response = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        user: `${user.name}:${user.id}`
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Salvo no banco!', result);
      
      // Recarrega lista atualizada
      await loadConfirmedUsers();
    }
  } catch (error) {
    console.log('Erro ao salvar:', error);
  }
};
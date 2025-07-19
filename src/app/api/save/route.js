import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const DATA_FILE = path.join(process.cwd(), 'data', 'dados.json');

export async function POST(request) {
  try {
    const newConfirmation = await request.json();
    const today = new Date().toISOString().split("T")[0];
    
    // Cria diretório se não existir
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // LÊ OS DADOS EXISTENTES PRIMEIRO
    let fileData = { date: today, confirmations: [] };
    
    if (fs.existsSync(DATA_FILE)) {
      try {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        const parsedData = JSON.parse(fileContent);
        
        // Se é do mesmo dia, mantém dados existentes
        if (parsedData.date === today && Array.isArray(parsedData.confirmations)) {
          fileData = parsedData;
        }
        // Se é dia diferente, reseta mas mantém a estrutura
        else {
          fileData = { date: today, confirmations: [] };
        }
      } catch (parseError) {
        console.log('Erro ao parsear arquivo, criando novo:', parseError);
        fileData = { date: today, confirmations: [] };
      }
    }

    // Verifica se usuário já confirmou hoje (evita duplicatas)
    const userName = newConfirmation.user.split(':')[0];
    const userExists = fileData.confirmations.some(conf => 
      conf.user.split(':')[0] === userName
    );
    
    // ADICIONA NOVA CONFIRMAÇÃO SE NÃO EXISTIR
    if (!userExists) {
      fileData.confirmations.push(newConfirmation);
      console.log(`Adicionando confirmação de: ${userName}`);
    } else {
      console.log(`Usuário ${userName} já confirmou hoje`);
    }

    // SALVA A ESTRUTURA COMPLETA
    fs.writeFileSync(DATA_FILE, JSON.stringify(fileData, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      confirmations: fileData.confirmations,
      total: fileData.confirmations.length
    });
  } catch (error) {
    console.error('Erro ao salvar:', error);
    return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });
  }
}

export async function GET() {
  const today = new Date().toISOString().split("T")[0];
  
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const parsedData = JSON.parse(data);
      
      console.log('Arquivo lido:', parsedData);
      
      // Se é do dia atual e tem a estrutura correta
      if (parsedData.date === today && Array.isArray(parsedData.confirmations)) {
        console.log(`Retornando ${parsedData.confirmations.length} confirmações de hoje`);
        return NextResponse.json(parsedData.confirmations);
      }
      
      // Se é dia diferente ou estrutura inválida
      console.log('Data diferente ou estrutura inválida, retornando array vazio');
      return NextResponse.json([]);
    }
    
    // Se arquivo não existe
    console.log('Arquivo não existe, retornando array vazio');
    return NextResponse.json([]);
  } catch (error) {
    console.error('Erro ao ler arquivo:', error);
    return NextResponse.json([]);
  }
}
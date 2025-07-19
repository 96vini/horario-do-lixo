import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'confirmacoes.json');

console.log('API route carregada! Arquivo de dados:', DATA_FILE);

// Garante que o diretório existe
function ensureDataDir() {
  const dataDir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    console.log('Criando diretório data/');
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Lê dados do arquivo
function readData() {
  ensureDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(data);
      console.log('Dados lidos do arquivo:', parsed);
      return parsed;
    } else {
      console.log('Arquivo não existe, criando dados padrão');
    }
  } catch (error) {
    console.error('Erro ao ler dados:', error);
  }
  return { date: null, confirmed: [], hasVerified: [] };
}

// Salva dados no arquivo
function writeData(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('Dados salvos:', data);
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
  }
}

// Verifica e reseta se for um novo dia
function checkAndResetDaily() {
  const today = new Date().toISOString().split("T")[0];
  const data = readData();
  
  console.log('Verificando data. Hoje:', today, 'Arquivo:', data.date);
  
  if (data.date !== today) {
    console.log('Novo dia detectado! Resetando dados...');
    const newData = {
      date: today,
      confirmed: [],
      hasVerified: []
    };
    writeData(newData);
    return newData;
  }
  
  return data;
}

export default function handler(req, res) {
  console.log('API chamada:', req.method, req.url);
  
  if (req.method === 'GET') {
    const data = checkAndResetDaily();
    console.log('Retornando dados GET:', data);
    res.status(200).json(data);
  } 
  else if (req.method === 'POST') {
    const { name, id } = req.body;
    console.log('POST recebido:', { name, id });
    
    if (!name || !id) {
      console.log('Dados inválidos!');
      return res.status(400).json({ error: 'Nome e ID são obrigatórios' });
    }

    const data = checkAndResetDaily();
    
    // Verifica se já confirmou
    if (data.hasVerified.includes(id)) {
      console.log('Usuário já confirmou hoje');
      return res.status(200).json(data);
    }

    // Adiciona à lista se ainda não estiver
    if (!data.confirmed.find(p => p.id === id)) {
      data.confirmed.push({ name, id });
    }
    
    // Marca como verificado
    data.hasVerified.push(id);
    
    writeData(data);
    console.log('Confirmação adicionada com sucesso!');
    res.status(200).json(data);
  } 
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Método ${req.method} não permitido`);
  }
}
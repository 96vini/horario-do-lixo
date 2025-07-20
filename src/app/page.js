"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "usuario_info";
const STORAGE_VERIFIED = "usuario_verified";
const STORAGE_DATE = "usuario_verified_date";

const COLETAS_CONDOMINIO = { days: [1, 3, 5], startHour: 18 };
const OFFICIAL_PERIODS = [
  { dayRange: [1, 5], start: 7.5, end: 12 },
  { dayRange: [1, 5], start: 13.5, end: 17 },
];

function nowDecHour() {
  const n = new Date();
  return { day: n.getDay(), hour: n.getHours() + n.getMinutes() / 60 };
}

function mustBeOpen() {
  const { day, hour } = nowDecHour();
  const cond = COLETAS_CONDOMINIO.days.includes(day) && hour >= COLETAS_CONDOMINIO.startHour;
  const off = OFFICIAL_PERIODS.some(p =>
    day >= p.dayRange[0] && day <= p.dayRange[1] &&
    hour >= p.start && hour < p.end
  );
  return cond || off;
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [confirmedUsers, setConfirmedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carrega lista de usuários confirmados do SQLite
  const loadConfirmedUsers = async () => {
    try {
      const response = await fetch('/api/confirmations');
      if (response.ok) {
        const confirmations = await response.json();
        console.log('📊 Confirmações do SQLite:', confirmations);
        
        if (Array.isArray(confirmations) && confirmations.length > 0) {
          const userNames = confirmations.map(confirmation => confirmation.user_name);
          setConfirmedUsers(userNames);
          console.log('👥 Usuários confirmados:', userNames);
        } else {
          setConfirmedUsers([]);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar confirmações:', error);
      setConfirmedUsers([]);
    }
  };

  // Verifica no SQLite se usuário atual já confirmou hoje
  const checkUserVerification = async (currentUser) => {
    if (!currentUser?.name) return false;
    
    try {
      const response = await fetch(`/api/confirmations/check?user=${encodeURIComponent(currentUser.name)}`);
      if (response.ok) {
        const { verified } = await response.json();
        console.log(`🔍 Verificação para ${currentUser.name}:`, verified ? '✅ já confirmou' : '❌ não confirmou');
        
        setVerified(verified);
        
        // Sincroniza com localStorage
        localStorage.setItem(STORAGE_VERIFIED, verified.toString());
        
        return verified;
      }
    } catch (error) {
      console.error('❌ Erro ao verificar confirmação:', error);
    }
    return false;
  };

  // Carrega dados iniciais
  useEffect(() => {
    async function loadData() {
      console.log('🚀 Iniciando carregamento...');
      
      // 1. Carrega usuário do localStorage
      let currentUser = null;
      const userData = localStorage.getItem(STORAGE_KEY);
      if (userData) {
        try {
          const u = JSON.parse(userData);
          if (u.name && u.id) {
            setUser(u);
            currentUser = u;
            console.log('👤 Usuário carregado:', u.name);
          }
        } catch (error) {
          console.error('❌ Erro ao parsear usuário:', error);
        }
      }

      // 2. Reset diário do localStorage
      const today = new Date().toISOString().split("T")[0];
      const lastDate = localStorage.getItem(STORAGE_DATE);
      if (lastDate !== today) {
        console.log('🗓️ Novo dia detectado, resetando localStorage');
        localStorage.setItem(STORAGE_VERIFIED, "false");
        localStorage.setItem(STORAGE_DATE, today);
      }

      // 3. Define status da lixeira
      setOpen(mustBeOpen());

      // 4. Carrega confirmações do SQLite
      await loadConfirmedUsers();

      // 5. Verifica status do usuário atual no SQLite
      if (currentUser) {
        await checkUserVerification(currentUser);
      } else {
        // Se não tem usuário, usa localStorage como fallback
        const localVerified = localStorage.getItem(STORAGE_VERIFIED) === "true";
        setVerified(localVerified);
      }

      setLoading(false);
      console.log('✅ Carregamento concluído');
    }

    loadData();
  }, []);

  // Salva novo usuário
  const saveUser = () => {
    if (!name.trim()) return;
    
    const u = { name: name.trim(), id: uuidv4() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    setOpen(mustBeOpen());
    
    console.log('💾 Novo usuário salvo:', u.name);
  };

  // Marca confirmação no SQLite
  const markVerified = async () => {
    if (!user) {
      console.error('❌ Nenhum usuário definido');
      return;
    }

    console.log('📝 Marcando confirmação para:', user.name);

    // Atualização otimista da UI
    localStorage.setItem(STORAGE_VERIFIED, "true");
    setVerified(true);

    // Atualiza lista local imediatamente para feedback visual
    if (!confirmedUsers.includes(user.name)) {
      setConfirmedUsers(prev => [...prev, user.name]);
    }

    // Salva no SQLite
    try {
      const response = await fetch('/api/confirmations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_name: user.name,
          user_id: user.id
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Salvo no SQLite:', result);
        
        // Recarrega lista atualizada do banco para sincronizar
        await loadConfirmedUsers();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Erro ao salvar no SQLite:', error);
      
      // Reverte mudanças em caso de erro
      localStorage.setItem(STORAGE_VERIFIED, "false");
      setVerified(false);
      if (confirmedUsers.includes(user.name)) {
        setConfirmedUsers(prev => prev.filter(name => name !== user.name));
      }
    }
  };

  // Tela de entrada do usuário
  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold">Qual é o seu nome?</h1>
        <input
          className="border p-2 rounded w-full max-w-sm"
          placeholder="Seu nome"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && saveUser()}
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded transition-colors"
          onClick={saveUser}
        >
          Continuar
        </button>
      </main>
    );
  }

  // Interface principal
  const bg = open ? "bg-green-100" : "bg-red-100";
  const text = open ? "text-green-800" : "text-red-800";
  const msgOpen = "✅ Lixeira: DEVE ESTAR ABERTA (horário de coleta)";
  const msgClosed = "⚠️ Lixeira: DEVE ESTAR FECHADA (fora dos horários)";
  const msg = open ? msgOpen : msgClosed;

  return (
    <main className={`${bg} min-h-screen flex flex-col items-center justify-center p-8 text-center`}>
      <h1 className={`${text} text-3xl font-bold mb-4`}>{msg}</h1>
      
      {!verified ? (
        <button
          className={`px-6 py-3 rounded transition-colors duration-200 ${
            open 
              ? "bg-red-600 hover:bg-red-700" 
              : "bg-green-600 hover:bg-green-700"
          } text-white shadow-lg`}
          onClick={markVerified}
        >
          {open ? "Marcar que está aberta" : "Marcar que está fechada"}
        </button>
      ) : (
        <p className={`${text} text-lg mt-4 font-medium`}>
          ✅ Você já confirmou que a lixeira está <strong>{open ? "aberta" : "fechada"}</strong> hoje.
        </p>
      )}

      {/* Lista de confirmações */}
      <section className="mt-8 max-w-md w-full text-left bg-white rounded-lg shadow-lg p-6 border border-gray-200">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 border-b border-gray-300 pb-2">
          🏠 Quem já confirmou hoje ({confirmedUsers.length}):
        </h2>
        
        {loading ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            <p className="text-gray-500 italic">Carregando do banco...</p>
          </div>
        ) : confirmedUsers.length === 0 ? (
          <p className="text-gray-500 italic">📭 Nenhuma confirmação ainda.</p>
        ) : (
          <ul className="space-y-2">
            {confirmedUsers.map((userName, index) => (
              <li 
                key={index} 
                className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 transition-colors"
              >
                <span className="text-green-600">✓</span>
                <span className="text-gray-800 font-medium">{userName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 text-center">
        <p className="text-lg text-gray-700">
          👋 Olá, <strong className="text-indigo-700">{user.name}</strong>!
        </p>
        <p className="text-sm text-gray-500 mt-1">
          ID: <code className="bg-gray-100 px-1 rounded">{user.id}</code>
        </p>
      </div>
      
      <footer className="mt-8 text-sm text-gray-600 max-w-md text-center">
        <p className="font-medium mb-1">📅 Horários de Coleta em Guaíra:</p>
        <p>🏢 <strong>Oficial:</strong> Segunda a Sexta, das 07:30–12:00 e 13:30–17:00</p>
        <p>🏠 <strong>Condominial:</strong> Seg, Qua e Sex após 18h</p>
        <p className="mt-2 text-xs text-gray-500">⚠️ Só levar o lixo nestes horários</p>
      </footer>
    </main>
  );
}
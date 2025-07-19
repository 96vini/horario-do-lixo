"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "usuario_info";
const JSONBIN_ENDPOINT = process.env.NEXT_PUBLIC_JSONBIN_ENDPOINT;
const JSONBIN_SECRET = process.env.NEXT_PUBLIC_JSONBIN_SECRET;

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

// Função para buscar dados do JSONBin
async function getJsonBinData() {
  try {
    const response = await fetch(JSONBIN_ENDPOINT, {
      method: "GET",
      headers: {
        "X-Master-Key": JSONBIN_SECRET
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    
    const data = await response.json();
    return data.record || { date: null, confirmed: [], hasVerified: [] };
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    return { date: null, confirmed: [], hasVerified: [] };
  }
}

// Função para salvar dados no JSONBin
async function saveJsonBinData(data) {
  try {
    await fetch(JSONBIN_ENDPOINT, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_SECRET
      },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
  }
}

// Função para buscar lista de confirmados
async function getConfirmados() {
  const data = await getJsonBinData();
  return data.confirmed || [];
}

// Função para adicionar confirmação
async function adicionarConfirmacao({ name, id }) {
  const data = await getJsonBinData();
  const lista = data.confirmed || [];
  
  if (lista.find(p => p.id === id)) return;

  const novaLista = [...lista, { name, id }];
  const hasVerifiedList = data.hasVerified || [];
  
  const newData = {
    date: data.date,
    confirmed: novaLista,
    hasVerified: hasVerifiedList.includes(id) ? hasVerifiedList : [...hasVerifiedList, id]
  };
  
  await saveJsonBinData(newData);
}

// Função para verificar se usuário já confirmou hoje
async function hasUserVerifiedToday(userId) {
  const data = await getJsonBinData();
  return (data.hasVerified || []).includes(userId);
}

// Função para resetar dados diários se necessário
async function checkAndResetDailyData() {
  const today = new Date().toISOString().split("T")[0];
  const data = await getJsonBinData();
  
  if (data.date !== today) {
    const newData = {
      date: today,
      confirmed: [],
      hasVerified: []
    };
    await saveJsonBinData(newData);
    return newData;
  }
  
  return data;
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifiedList, setVerifiedList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      // Carrega usuário do localStorage
      const data = localStorage.getItem(STORAGE_KEY);
      let currentUser = null;
      
      if (data) {
        try {
          const u = JSON.parse(data);
          if (u.name && u.id) {
            setUser(u);
            currentUser = u;
          }
        } catch {}
      }

      // Verifica e reseta dados diários se necessário
      const jsonBinData = await checkAndResetDailyData();
      
      // Carrega lista de confirmados
      setVerifiedList(jsonBinData.confirmed || []);
      
      // Verifica se usuário atual já confirmou hoje
      if (currentUser) {
        const userVerified = await hasUserVerifiedToday(currentUser.id);
        setVerified(userVerified);
      }

      setOpen(mustBeOpen());
      setLoading(false);
    }

    loadData();
  }, []);

  const saveUser = () => {
    if (!name.trim()) return;
    const u = { name: name.trim(), id: uuidv4() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    setOpen(mustBeOpen());
  };

  const markVerified = async () => {
    if (!user) return;
    
    setVerified(true);
    
    // Adiciona confirmação no JSONBin
    await adicionarConfirmacao({ name: user.name, id: user.id });
    
    // Atualiza lista local
    const exists = verifiedList.find(v => v.id === user.id);
    if (!exists) {
      setVerifiedList(prev => [...prev, { name: user.name, id: user.id }]);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Carregando...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold">Qual é o seu nome?</h1>
        <input
          className="border p-2 rounded w-full max-w-sm"
          placeholder="Seu nome"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded"
          onClick={saveUser}
        >
          Continuar
        </button>
      </main>
    );
  }

  const bg = open ? "bg-green-100" : "bg-red-100";
  const text = open ? "text-green-800" : "text-red-800";
  const msgOpen = "✅ Lixeira: DEVE ESTAR ABERTA (horário de coleta)";
  const msgClosed = "⚠️ Lixeira: DEVE ESTAR FECHADA (fora dos horários)";
  const msg = open ? msgOpen : msgClosed;

  return (
    <main className={`${bg} min-h-screen flex flex-col items-center justify-center p-8 text-center font-sans`}>
      <h1 className={`${text} text-3xl font-extrabold mb-6 tracking-tight`}>{msg}</h1>
      {!verified ? (
        <button
          className={`px-6 py-3 rounded shadow-md transition-colors duration-300 ${
            open
              ? "bg-red-700 hover:bg-red-800 focus:ring-red-500"
              : "bg-green-700 hover:bg-green-800 focus:ring-green-500"
          } text-white focus:outline-none focus:ring-2 focus:ring-offset-2`}
          onClick={markVerified}
        >
          {open ? "Marcar que está aberta" : "Marcar que está fechada"}
        </button>
      ) : (
        <p className={`${text} text-lg mt-6 font-medium`}>
          Você já confirmou que a lixeira está <strong>{open ? "aberta" : "fechada"}</strong> hoje.
        </p>
      )}

      <section className="mt-10 max-w-md w-full text-left bg-white rounded-lg shadow-lg p-6 border border-gray-200">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900 border-b border-gray-300 pb-2">
          Quem já confirmou que a lixeira está fechada:
        </h2>
        {verifiedList.length === 0 ? (
          <p className="text-gray-500 italic">Nenhuma confirmação ainda.</p>
        ) : (
          <ul className="list-disc list-inside space-y-2 text-gray-800 font-semibold">
            {verifiedList.map(({ id, name }) => (
              <li key={id} className="hover:text-green-600 transition-colors cursor-default">
                {name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-gray-700 mt-10 text-lg font-normal">
        Olá, <strong className="text-indigo-700">{user.name}</strong>! Seu ID: <strong className="text-indigo-700">{user.id}</strong>
      </p>
      <footer className="mt-10 text-sm text-gray-500 max-w-md leading-relaxed">
        Coleta oficial em Guaíra: Segunda a Sexta, das 07:30–12:00 e 13:30–17:00.<br />
        Condominial: Seg, Qua e Sex após 18h. Só levar o lixo nestes horários.
      </footer>
    </main>
  );
}
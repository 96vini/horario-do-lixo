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

  // Função para carregar usuários que confirmaram hoje
  const loadConfirmedUsers = async () => {
    try {
      const response = await fetch('/api/save');
      if (response.ok) {
        const confirmations = await response.json(); // Array de objetos
        
        if (Array.isArray(confirmations) && confirmations.length > 0) {
          const userNames = confirmations.map(confirmation => 
            confirmation.user.split(':')[0] // Objeto.user.split
          );
          setConfirmedUsers(userNames);
        } else {
          setConfirmedUsers([]);
        }
      }
    } catch (error) {
      console.log('Erro ao carregar usuários confirmados:', error);
      setConfirmedUsers([]);
    }
  };

  useEffect(() => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        const u = JSON.parse(data);
        if (u.name && u.id) setUser(u);
      } catch {}
    }

    const today = new Date().toISOString().split("T")[0];
    const vDate = localStorage.getItem(STORAGE_DATE);
    if (vDate !== today) {
      localStorage.setItem(STORAGE_VERIFIED, "false");
      localStorage.setItem(STORAGE_DATE, today);
    }
    const v = localStorage.getItem(STORAGE_VERIFIED) === "true";
    setVerified(v);

    setOpen(mustBeOpen());
    
    // Carrega usuários que confirmaram
    loadConfirmedUsers().finally(() => setLoading(false));
  }, []);

  const saveUser = () => {
    if (!name.trim()) return;
    const u = { name: name.trim(), id: uuidv4() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    setOpen(mustBeOpen());
  };

const markVerified = async () => {
  // Salva localmente primeiro
  localStorage.setItem(STORAGE_VERIFIED, "true");
  setVerified(true);

  // Salva no arquivo do servidor
  try {
    const response = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        verified: true, 
        timestamp: new Date().toISOString(),
        user: `${user.name}:${user.id}`
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Salvo no arquivo!');
      
      // Atualiza a lista com os dados retornados da API
      if (result.confirmations && Array.isArray(result.confirmations)) {
        const userNames = result.confirmations.map(confirmation => 
          confirmation.user.split(':')[0]
        );
        setConfirmedUsers(userNames);
      }
    }
  } catch (error) {
    console.log('Erro ao salvar no arquivo:', error);
    // Fallback: adiciona na lista local se a API falhou
    if (user && !confirmedUsers.includes(user.name)) {
      setConfirmedUsers(prev => [...prev, user.name]);
    }
  }
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
<main className={`${bg} min-h-screen flex flex-col items-center justify-center p-8 text-center`}>
  <h1 className={`${text} text-3xl font-bold mb-4`}>{msg}</h1>
  
  {!verified ? (
    <button
      className={`px-6 py-3 rounded ${open ? "bg-red-600" : "bg-green-600"} text-white`}
      onClick={markVerified}
    >
      {open ? "Marcar que está aberta" : "Marcar que está fechada"}
    </button>
  ) : (
    <p className={`${text} text-lg mt-4`}>
      Você já confirmou que a lixeira está <strong>{open ? "aberta" : "fechada"}</strong> hoje.
    </p>
  )}

  {/* Lista de usuários que confirmaram hoje */}
  <section className="mt-8 max-w-md w-full text-left bg-white rounded-lg shadow-lg p-6 border border-gray-200">
    <h2 className="text-xl font-semibold mb-4 text-gray-900 border-b border-gray-300 pb-2">
      Quem já confirmou hoje:
    </h2>
    {loading ? (
      <p className="text-gray-500 italic">Carregando...</p>
    ) : confirmedUsers.length === 0 ? (
      <p className="text-gray-500 italic">Nenhuma confirmação ainda.</p>
    ) : (
      <ul className="list-disc list-inside space-y-2 text-gray-800">
        {confirmedUsers.map((userName, index) => (
          <li key={index} className="hover:text-green-600 transition-colors">
            {userName}
          </li>
        ))}
      </ul>
    )}
  </section>

  <p className="text-lg text-gray-700 mt-6">
    Olá, <strong>{user.name}</strong>! Seu ID: <strong>{user.id}</strong>
  </p>
  
  <footer className="mt-6 text-sm text-gray-600 max-w-md">
    Coleta oficial em Guaíra: Segunda a Sexta, das 07:30–12:00 e 13:30–17:00.<br/>
    Condominial: Seg, Qua e Sex após 18h. Só levar o lixo nestes horários.
  </footer>
</main>
  );
}
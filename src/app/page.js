"use client";

// pages/index.js
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "usuario_info";
const STORAGE_VERIFIED = "usuario_verified";
const STORAGE_DATE = "usuario_verified_date";
const STORAGE_VERIFIED_LIST = "usuario_verified_list"; // nova chave para lista

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
  const [verifiedList, setVerifiedList] = useState([]);

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
      localStorage.setItem(STORAGE_VERIFIED_LIST, JSON.stringify([])); // limpa lista todo dia
    }

    const v = localStorage.getItem(STORAGE_VERIFIED) === "true";
    setVerified(v);

    const listRaw = localStorage.getItem(STORAGE_VERIFIED_LIST);
    if (listRaw) {
      try {
        setVerifiedList(JSON.parse(listRaw));
      } catch {
        setVerifiedList([]);
      }
    } else {
      setVerifiedList([]);
    }

    setOpen(mustBeOpen());
  }, []);

  const saveUser = () => {
    if (!name.trim()) return;
    const u = { name: name.trim(), id: uuidv4() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    setOpen(mustBeOpen());
  };

  const markVerified = () => {
    localStorage.setItem(STORAGE_VERIFIED, "true");
    setVerified(true);

    // adiciona usuário à lista, se ainda não tiver
    if (user) {
      const exists = verifiedList.find(v => v.id === user.id);
      if (!exists) {
        const newList = [...verifiedList, { name: user.name, id: user.id }];
        localStorage.setItem(STORAGE_VERIFIED_LIST, JSON.stringify(newList));
        setVerifiedList(newList);
      }
    }
  };

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
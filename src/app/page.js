"use client"

import { useEffect, useState } from "react"
import { v4 as uuidv4 } from "uuid"

const STORAGE_KEY = "usuario_info"
const STORAGE_VERIFIED = "usuario_verified"
const STORAGE_DATE = "usuario_verified_date"

const COLETAS_CONDOMINIO = { days: [1, 3, 5], startHour: 18 }
const OFFICIAL_PERIODS = [
  { dayRange: [1, 5], start: 7.5, end: 12 },
  { dayRange: [1, 5], start: 13.5, end: 17 },
]

function nowDecHour() {
  const n = new Date()
  return { day: n.getDay(), hour: n.getHours() + n.getMinutes() / 60 }
}

function mustBeOpen() {
  const { day, hour } = nowDecHour()
  const cond = COLETAS_CONDOMINIO.days.includes(day) && hour >= COLETAS_CONDOMINIO.startHour
  const off = OFFICIAL_PERIODS.some(
    (p) => day >= p.dayRange[0] && day <= p.dayRange[1] && hour >= p.start && hour < p.end,
  )
  return cond || off
}

export default function Home() {
  const [user, setUser] = useState(null)
  const [name, setName] = useState("")
  const [open, setOpen] = useState(false)
  const [verified, setVerified] = useState(false)
  const [confirmedUsers, setConfirmedUsers] = useState([])
  const [loading, setLoading] = useState(true)

  // Carrega lista de usuários confirmados do SQLite
  const loadConfirmedUsers = async () => {
    try {
      const response = await fetch("/api/confirmations")
      if (response.ok) {
        const confirmations = await response.json()
        console.log("📊 Confirmações do SQLite:", confirmations)
        if (Array.isArray(confirmations) && confirmations.length > 0) {
          const userNames = confirmations.map((confirmation) => confirmation.user_name)
          setConfirmedUsers(userNames)
          console.log("👥 Usuários confirmados:", userNames)
        } else {
          setConfirmedUsers([])
        }
      }
    } catch (error) {
      console.error("❌ Erro ao carregar confirmações:", error)
      setConfirmedUsers([])
    }
  }

  // Verifica no SQLite se usuário atual já confirmou hoje
  const checkUserVerification = async (currentUser) => {
    if (!currentUser?.name) return false
    try {
      const response = await fetch(`/api/confirmations/check?user=${encodeURIComponent(currentUser.name)}`)
      if (response.ok) {
        const { verified } = await response.json()
        console.log(`🔍 Verificação para ${currentUser.name}:`, verified ? "✅ já confirmou" : "❌ não confirmou")
        setVerified(verified)
        // Sincroniza com localStorage
        localStorage.setItem(STORAGE_VERIFIED, verified.toString())
        return verified
      }
    } catch (error) {
      console.error("❌ Erro ao verificar confirmação:", error)
    }
    return false
  }

  // Carrega dados iniciais
  useEffect(() => {
    async function loadData() {
      console.log("🚀 Iniciando carregamento...")
      // 1. Carrega usuário do localStorage
      let currentUser = null
      const userData = localStorage.getItem(STORAGE_KEY)
      if (userData) {
        try {
          const u = JSON.parse(userData)
          if (u.name && u.id) {
            setUser(u)
            currentUser = u
            console.log("👤 Usuário carregado:", u.name)
          }
        } catch (error) {
          console.error("❌ Erro ao parsear usuário:", error)
        }
      }

      // 2. Reset diário do localStorage
      const today = new Date().toISOString().split("T")[0]
      const lastDate = localStorage.getItem(STORAGE_DATE)
      if (lastDate !== today) {
        console.log("🗓️ Novo dia detectado, resetando localStorage")
        localStorage.setItem(STORAGE_VERIFIED, "false")
        localStorage.setItem(STORAGE_DATE, today)
      }

      // 3. Define status da lixeira
      setOpen(mustBeOpen())

      // 4. Carrega confirmações do SQLite
      await loadConfirmedUsers()

      // 5. Verifica status do usuário atual no SQLite
      if (currentUser) {
        await checkUserVerification(currentUser)
      } else {
        // Se não tem usuário, usa localStorage como fallback
        const localVerified = localStorage.getItem(STORAGE_VERIFIED) === "true"
        setVerified(localVerified)
      }

      setLoading(false)
      console.log("✅ Carregamento concluído")
    }
    loadData()
  }, [])

  // Salva novo usuário
  const saveUser = () => {
    if (!name.trim()) return
    const u = { name: name.trim(), id: uuidv4() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    setUser(u)
    setOpen(mustBeOpen())
    console.log("💾 Novo usuário salvo:", u.name)
  }

  // Marca confirmação no SQLite
  const markVerified = async () => {
    if (!user) {
      console.error("❌ Nenhum usuário definido")
      return
    }
    console.log("📝 Marcando confirmação para:", user.name)

    // Atualização otimista da UI
    localStorage.setItem(STORAGE_VERIFIED, "true")
    setVerified(true)

    // Atualiza lista local imediatamente para feedback visual
    if (!confirmedUsers.includes(user.name)) {
      setConfirmedUsers((prev) => [...prev, user.name])
    }

    // Salva no SQLite
    try {
      const response = await fetch("/api/confirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: user.name,
          user_id: user.id,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log("✅ Salvo no SQLite:", result)
        // Recarrega lista atualizada do banco para sincronizar
        await loadConfirmedUsers()
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error("❌ Erro ao salvar no SQLite:", error)
      // Reverte mudanças em caso de erro
      localStorage.setItem(STORAGE_VERIFIED, "false")
      setVerified(false)
      if (confirmedUsers.includes(user.name)) {
        setConfirmedUsers((prev) => prev.filter((name) => name !== user.name))
      }
    }
  }

  // Tela de entrada do usuário
  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col items-center justify-center gap-6 p-8">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-100">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-3xl">👤</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Bem-vindo!</h1>
            <p className="text-gray-600">Digite seu nome para acessar o sistema</p>
          </div>

          <div className="space-y-4">
            <input
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-center text-lg placeholder-gray-400"
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && saveUser()}
            />
            <button
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              onClick={saveUser}
              disabled={!name.trim()}
            >
              Continuar
            </button>
          </div>
        </div>
      </main>
    )
  }

  // Interface principal
  const bg = open
    ? "bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50"
    : "bg-gradient-to-br from-red-50 via-rose-50 to-pink-50"
  const text = open ? "text-green-800" : "text-red-800"
  const cardBg = open ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
  const msgOpen = "✅ Lixeira: DEVE ESTAR ABERTA"
  const msgClosed = "⚠️ Lixeira: DEVE ESTAR FECHADA"
  const msg = open ? msgOpen : msgClosed
  const subtitle = open ? "Horário de coleta ativo" : "Fora dos horários de coleta"

  return (
    <main className={`${bg} min-h-screen p-4 md:p-8`}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header do usuário */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl">👤</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Olá, {user.name}! 👋</h2>
                <p className="text-gray-500 text-sm">ID: {user.id.slice(0, 8)}...</p>
              </div>
            </div>
            <div className="bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-600 font-medium">
              📅 {new Date().toLocaleDateString("pt-BR")}
            </div>
          </div>
        </div>

        {/* Status da lixeira */}
        <div className={`${cardBg} rounded-2xl shadow-xl p-8 border-2 text-center`}>
          <div className="mb-6">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-4xl">🗑️</span>
            </div>
            <h1 className={`${text} text-4xl font-bold mb-2`}>{msg}</h1>
            <p className={`${text} text-xl opacity-80`}>{subtitle}</p>
          </div>

          {!verified ? (
            <button
              className={`px-8 py-4 rounded-xl font-bold text-xl text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 ${
                open
                  ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  : "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
              }`}
              onClick={markVerified}
            >
              ✅ Confirmar que está {open ? "aberta" : "fechada"}
            </button>
          ) : (
            <div
              className={`inline-flex items-center gap-3 px-6 py-3 rounded-xl ${cardBg} border-2 ${open ? "border-green-300" : "border-red-300"}`}
            >
              <span className="text-2xl">✅</span>
              <span className={`${text} text-xl font-bold`}>Você já confirmou hoje!</span>
            </div>
          )}
        </div>

        {/* Lista de confirmações */}
        <section className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">🏠 Confirmações de Hoje</h2>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">{confirmedUsers.length}</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 font-medium">Carregando confirmações...</p>
            </div>
          ) : confirmedUsers.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500 text-lg font-medium">Nenhuma confirmação ainda</p>
              <p className="text-gray-400">Seja o primeiro a confirmar hoje!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {confirmedUsers.map((userName, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors duration-200"
                >
                  <span className="text-green-600 text-xl">✅</span>
                  <span className="text-gray-800 font-semibold flex-1">{userName}</span>
                  <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">Confirmado</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Informações dos horários */}
        <footer className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            ⏰ Horários de Coleta em Guaíra
          </h3>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🏢</span>
                <h4 className="font-bold text-blue-900">Coleta Oficial</h4>
              </div>
              <p className="text-blue-800 font-medium">
                <strong>Segunda a Sexta</strong>
                <br />
                07:30 - 12:00
                <br />
                13:30 - 17:00
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🏠</span>
                <h4 className="font-bold text-purple-900">Coleta Condominial</h4>
              </div>
              <p className="text-purple-800 font-medium">
                <strong>Segunda, Quarta e Sexta</strong>
                <br />
                Após 18:00
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="text-amber-800">
              <p className="font-bold mb-1">Importante:</p>
              <p className="text-sm">
                Só leve o lixo para fora nos horários indicados acima para manter a organização do condomínio.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}

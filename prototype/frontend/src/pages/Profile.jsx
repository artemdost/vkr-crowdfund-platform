import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWeb3, ConnectButton } from "../context/Web3Context";
import api from "../utils/api";
import toast from "react-hot-toast";

const ROLE_LABELS = { investor: "Инвестор", author: "Автор проектов", admin: "Администратор" };
const ROLE_COLORS = { investor: "badge-funding", author: "badge-active", admin: "badge-completed" };

export default function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const { account, balance, isConnected, signer, bindWallet, unbindWallet } = useWeb3();
  const navigate = useNavigate();

  const [investments, setInvestments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [binding, setBinding] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      try { const r = await api.get("/transactions"); setInvestments(r.data || []); } catch { setInvestments([]); }
      try { const r = await api.get("/projects?author=me"); setProjects(r.data || []); } catch { setProjects([]); }
    } finally { setLoading(false); }
  };

  const handleBind = async () => {
    setBinding(true);
    try {
      await bindWallet();
      toast.success("Кошелёк привязан");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Ошибка привязки");
    } finally { setBinding(false); }
  };

  const handleUnbind = async () => {
    setBinding(true);
    try {
      await unbindWallet();
      toast.success("Кошелёк отвязан");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Ошибка отвязки");
    } finally { setBinding(false); }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <h1 className="text-2xl font-bold text-white mb-6">Личный кабинет</h1>

      {/* User info */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-glow">
            <span className="text-2xl text-white font-bold">{user.email?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{user.email}</h2>
            <span className={`badge mt-1 ${ROLE_COLORS[user.role] || "badge-completed"}`}>
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Дата регистрации</p>
            <p className="text-sm font-medium text-white">
              {user.created_at ? new Date(user.created_at).toLocaleDateString("ru-RU") : "---"}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">ID пользователя</p>
            <p className="text-sm font-medium text-white">#{user.id}</p>
          </div>
        </div>
      </div>

      {/* Wallet */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Кошелёк
        </h2>

        {user.wallet_address ? (
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm text-emerald-400 font-medium">Привязан</span>
            </div>
            <div className="bg-white/5 rounded-xl px-4 py-3 font-mono text-sm text-gray-300 break-all mb-3">
              {user.wallet_address}
            </div>
            {balance && isConnected && (
              <p className="text-sm text-gray-500 mb-4">
                Баланс: <span className="font-semibold text-white">{parseFloat(balance).toFixed(4)} ETH</span>
              </p>
            )}
            <button onClick={handleUnbind} disabled={binding || !signer}
              className="text-sm text-red-400 hover:text-red-300 font-medium disabled:opacity-50 transition-colors">
              {binding ? "Подписание..." : "Отвязать кошелёк"}
            </button>
            {!isConnected && (
              <p className="text-xs text-yellow-500 mt-2">Подключите этот кошелёк через кнопку выше для отвязки</p>
            )}
          </div>
        ) : isConnected && account ? (
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
              <span className="text-sm text-yellow-400 font-medium">Подключён, не привязан</span>
            </div>
            <div className="bg-white/5 rounded-xl px-4 py-3 font-mono text-sm text-gray-300 break-all mb-3">
              {account}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Нажмите кнопку ниже и подпишите сообщение в кошельке для привязки.
            </p>
            <button onClick={handleBind} disabled={binding}
              className="btn-primary disabled:opacity-50">
              {binding ? "Подписание..." : "Привязать этот кошелёк"}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2.5 h-2.5 bg-gray-600 rounded-full" />
              <span className="text-sm text-gray-500">Не подключён</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Подключите кошелёк для инвестирования, голосования и создания проектов.
            </p>
            <ConnectButton />
          </div>
        )}
      </div>

      {/* My projects */}
      {user.role === "author" && (
        <div className="glass-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Мои проекты</h2>
          {loading ? (
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          ) : projects.length === 0 ? (
            <p className="text-sm text-gray-500">Нет проектов</p>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div key={p.id} onClick={() => navigate(`/project/${p.contract_address || p.id}`)}
                  className="flex justify-between items-center p-4 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all">
                  <div>
                    <p className="text-sm font-medium text-white">{p.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{p.goal_amount} ETH</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transactions */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Транзакции</h2>
        {loading ? (
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        ) : investments.length === 0 ? (
          <p className="text-sm text-gray-500">Нет транзакций</p>
        ) : (
          <div className="space-y-2">
            {investments.map((tx) => (
              <div key={tx.id} className="flex justify-between items-center p-4 rounded-xl bg-white/5">
                <div>
                  <span className={`badge ${
                    tx.type === "investment" ? "badge-active" :
                    tx.type === "refund" ? "badge-failed" : "badge-completed"
                  }`}>
                    {tx.type === "investment" ? "Инвестиция" :
                     tx.type === "refund" ? "Возврат" :
                     tx.type === "milestone_payout" ? "Выплата" : tx.type}
                  </span>
                  <p className="text-xs text-gray-600 mt-1">{new Date(tx.created_at).toLocaleString("ru-RU")}</p>
                </div>
                <span className="text-sm font-semibold text-white">{tx.amount} ETH</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logout */}
      <button onClick={() => { logout(); navigate("/"); }}
        className="w-full py-3 text-red-400 font-medium border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-all">
        Выйти из аккаунта
      </button>
    </div>
  );
}

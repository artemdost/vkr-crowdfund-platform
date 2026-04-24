import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("investor");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }
    if (password.length < 6) {
      toast.error("Пароль минимум 6 символов");
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, role);
      navigate("/login");
    } catch {
      toast.error("Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
            <span className="text-white font-bold text-xl">CF</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Регистрация</h1>
          <p className="text-gray-500 mt-1">Создайте аккаунт на CrowdFund</p>
        </div>

        <div className="glass-card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com" className="input-field" disabled={loading} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Пароль</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов" className="input-field" disabled={loading} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Подтвердите пароль</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль" className="input-field" disabled={loading} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Роль</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("investor")}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    role === "investor"
                      ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-400"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  <div className="text-lg mb-1">&#x1F4B0;</div>
                  Инвестор
                </button>
                <button
                  type="button"
                  onClick={() => setRole("author")}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    role === "author"
                      ? "bg-purple-600/20 border-purple-500/50 text-purple-400"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  <div className="text-lg mb-1">&#x1F680;</div>
                  Автор проектов
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? (
                <span className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Регистрация...</span>
                </span>
              ) : "Зарегистрироваться"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <span className="text-sm text-gray-500">Уже есть аккаунт? </span>
            <Link to="/login" className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
              Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

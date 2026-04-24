import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWeb3, ConnectButton } from "../context/Web3Context";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { account } = useWeb3();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-glow transition-shadow">
              <span className="text-white font-bold text-sm">CF</span>
            </div>
            <span className="text-lg font-bold text-white">
              Crowd<span className="gradient-text">Fund</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-1">
            <Link to="/" className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all">
              Главная
            </Link>
            {user && user.role === "author" && (
              <>
                <Link to="/create" className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all">
                  Создать
                </Link>
                <Link to="/dashboard" className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all">
                  Панель
                </Link>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center space-x-3">
            {user && <ConnectButton showBalance accountStatus="address" chainStatus="icon" />}

            {user ? (
              <div className="flex items-center space-x-3">
                <Link
                  to="/profile"
                  className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <span className="text-xs text-white font-bold">{user.email?.[0]?.toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-gray-300">{user.email}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-red-400 transition-colors"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to="/login" className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                  Войти
                </Link>
                <Link to="/register" className="btn-primary !px-4 !py-2 text-sm">
                  Регистрация
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-slate-950/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-2">
            <Link to="/" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5">Главная</Link>
            {user && user.role === "author" && (
              <>
                <Link to="/create" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5">Создать</Link>
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5">Панель</Link>
              </>
            )}
            {user && (
              <Link to="/profile" onClick={() => setMobileOpen(false)} className="block px-4 py-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5">Профиль</Link>
            )}
            <div className="pt-2 border-t border-white/5">
              {user && <ConnectButton showBalance={false} accountStatus="address" chainStatus="none" />}
              {!user && (
                <div className="space-y-2">
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-center px-4 py-2 text-gray-400 hover:text-white">Войти</Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)} className="block text-center btn-primary text-sm">Регистрация</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

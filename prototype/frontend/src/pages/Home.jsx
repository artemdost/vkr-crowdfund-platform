import React, { useState, useEffect, useMemo } from "react";
import { useWeb3 } from "../context/Web3Context";
import { getFactoryContract, getCrowdFundContract } from "../utils/contracts";
import { ethers } from "ethers";
import ProjectCard from "../components/ProjectCard";
import api from "../utils/api";

const FILTER_TABS = [
  { key: "all", label: "Все" },
  { key: "funding", label: "Сбор средств" },
  { key: "active", label: "Активные" },
  { key: "completed", label: "Завершённые" },
  { key: "failed", label: "Проваленные" },
];

const STATE_MAP = { funding: 0, active: 1, completed: 2, failed: 3 };

export default function Home() {
  const { provider } = useWeb3();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchFromChain() {
      if (!provider) return;
      setLoading(true);
      try {
        const factory = await getFactoryContract(provider);
        const addresses = await factory.getCampaigns();
        const dbProjectsRes = await api.get("/projects").catch(() => ({ data: [] }));
        const dbByAddr = {};
        for (const p of (dbProjectsRes.data || [])) {
          if (p.contract_address) dbByAddr[p.contract_address.toLowerCase()] = p;
        }
        const items = [];
        for (const addr of addresses) {
          const cf = getCrowdFundContract(addr, provider);
          const info = await cf.getInfo();
          const db = dbByAddr[addr.toLowerCase()];
          items.push({
            contractAddress: addr,
            title: db?.title || `Campaign ${addr.slice(0, 8)}...`,
            description: db?.description || "",
            goalAmount: info._goalAmount,
            totalRaised: info._totalRaised,
            deadline: info._deadline,
            state: Number(info._state),
            milestoneCount: Number(info._milestoneCount),
          });
        }
        setProjects(items);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
        setError("Не удалось загрузить проекты");
      } finally {
        setLoading(false);
      }
    }
    fetchFromChain();
  }, [provider]);

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (filter !== "all") {
      result = result.filter((p) => p.state === STATE_MAP[filter]);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    return result;
  }, [projects, filter, search]);

  const stats = useMemo(() => ({
    total: projects.length,
    raised: projects.reduce((s, p) => s + parseFloat(ethers.formatEther(p.totalRaised || "0")), 0),
    active: projects.filter((p) => p.state === 1).length,
  }), [projects]);

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2 animate-pulse-slow" />
              Powered by Ethereum
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold mb-6">
              <span className="text-white">Краудфандинг</span>
              <br />
              <span className="gradient-text">на блокчейне</span>
            </h1>
            <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Инвестируйте в проекты с прозрачным расходованием средств.
              Голосуйте за каждый этап. Контролируйте свои вложения через смарт-контракты.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
            <div className="stat-card text-center">
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">Проектов</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-2xl font-bold gradient-text">{stats.raised.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">ETH собрано</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
              <p className="text-xs text-gray-500 mt-1">Активных</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск проектов..."
              className="input-field !pl-12"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filter === tab.key
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Projects grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Загрузка проектов...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="glass-card p-8 max-w-md mx-auto">
              <p className="text-red-400 font-medium">{error}</p>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-gray-400 text-lg">Проекты не найдены</p>
            <p className="text-gray-600 text-sm mt-1">Попробуйте изменить фильтры</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.contractAddress} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";

const STATE_CONFIG = {
  0: { label: "Сбор средств", badge: "badge-funding" },
  1: { label: "Активен", badge: "badge-active" },
  2: { label: "Завершён", badge: "badge-completed" },
  3: { label: "Провален", badge: "badge-failed" },
};

function formatCountdown(deadline) {
  const now = Date.now();
  const end = Number(deadline) * 1000;
  const diff = end - now;
  if (diff <= 0) return "Завершено";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}д ${hours}ч`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}ч ${minutes}м`;
}

export default function ProjectCard({ project }) {
  const { title, description, goalAmount, totalRaised, deadline, state, contractAddress } = project;
  const goal = parseFloat(ethers.formatEther(goalAmount || "0"));
  const raised = parseFloat(ethers.formatEther(totalRaised || "0"));
  const progress = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
  const config = STATE_CONFIG[state] || STATE_CONFIG[0];

  return (
    <Link
      to={`/project/${contractAddress}`}
      className="group glass-card hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-glass-lg overflow-hidden animate-slide-up"
    >
      {/* Top gradient line */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity" />

      <div className="p-6">
        {/* Title + badge */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-semibold text-white group-hover:text-indigo-400 transition-colors line-clamp-1 flex-1">
            {title}
          </h3>
          <span className={`badge ml-3 shrink-0 ${config.badge}`}>
            {config.label}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-500 mb-5 line-clamp-2">
          {description || "Описание отсутствует"}
        </p>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-white">{raised.toFixed(4)} ETH</span>
            <span className="text-gray-500">/ {goal.toFixed(4)} ETH</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-right text-xs text-gray-600 mt-1">{progress.toFixed(1)}%</div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-white/5">
          <div className="flex items-center space-x-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatCountdown(deadline)}</span>
          </div>
          <span className="text-indigo-400 font-medium group-hover:translate-x-1 transition-transform inline-flex items-center">
            Подробнее
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

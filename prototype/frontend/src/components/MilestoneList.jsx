import React from "react";
import { ethers } from "ethers";

/**
 * Milestone status labels and colors (maps to MilestoneState enum).
 */
const MILESTONE_STATUS = {
  0: { label: "Ожидание", color: "bg-gray-100 text-gray-700" },
  1: { label: "Голосование", color: "bg-yellow-100 text-yellow-800" },
  2: { label: "Одобрен", color: "bg-green-100 text-green-800" },
  3: { label: "Отклонён", color: "bg-red-100 text-red-800" },
};

export default function MilestoneList({ milestones, currentMilestone }) {
  if (!milestones || milestones.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        Этапы не найдены
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Этапы проекта
      </h3>

      {milestones.map((ms, index) => {
        const statusConfig = MILESTONE_STATUS[ms.status] || MILESTONE_STATUS[0];
        const budget = parseFloat(ethers.formatEther(ms.budget || "0"));
        const isCurrent = index === Number(currentMilestone);
        const isVoting = ms.status === 1;

        // Vote totals for display
        const votesFor = parseFloat(ethers.formatEther(ms.votesFor || "0"));
        const votesAgainst = parseFloat(ethers.formatEther(ms.votesAgainst || "0"));
        const totalVotes = votesFor + votesAgainst;
        const forPercent = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 0;

        return (
          <div
            key={index}
            className={`border rounded-lg p-4 transition-all ${
              isCurrent
                ? "border-indigo-300 bg-indigo-50 shadow-sm"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-3">
                {/* Index badge */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isCurrent
                      ? "bg-indigo-600 text-white"
                      : ms.status === 2
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {index + 1}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    {ms.description}
                  </h4>
                  <p className="text-sm text-gray-500">
                    Бюджет: {budget.toFixed(4)} ETH
                  </p>
                </div>
              </div>

              {/* Status badge */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
            </div>

            {/* Voting progress for milestones in Voting state */}
            {isVoting && totalVotes > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>За: {votesFor.toFixed(4)} ETH</span>
                  <span>Против: {votesAgainst.toFixed(4)} ETH</span>
                </div>
                <div className="w-full bg-red-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${forPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Report link if submitted */}
            {ms.reportURI && (
              <div className="mt-2">
                <a
                  href={ms.reportURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:text-indigo-700 underline"
                >
                  Просмотреть отчёт
                </a>
              </div>
            )}

            {/* Attempt counter */}
            {ms.attempts > 0 && (
              <div className="mt-1 text-xs text-gray-400">
                Попыток: {ms.attempts} из 2
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

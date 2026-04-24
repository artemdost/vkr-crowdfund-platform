import React from "react";
import { ethers } from "ethers";

/**
 * Transaction type labels and icon colors.
 */
const TX_TYPES = {
  invest: { label: "Инвестиция", color: "text-green-600", bg: "bg-green-50" },
  refund: { label: "Возврат", color: "text-red-600", bg: "bg-red-50" },
  milestone_approved: { label: "Этап одобрен", color: "text-blue-600", bg: "bg-blue-50" },
  milestone_rejected: { label: "Этап отклонён", color: "text-orange-600", bg: "bg-orange-50" },
  vote: { label: "Голосование", color: "text-purple-600", bg: "bg-purple-50" },
  payout: { label: "Выплата", color: "text-indigo-600", bg: "bg-indigo-50" },
};

/**
 * Truncate a transaction hash for display.
 */
function truncateHash(hash) {
  if (!hash) return "—";
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

/**
 * Format a date string or timestamp.
 */
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(typeof dateStr === "number" ? dateStr * 1000 : dateStr);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TransactionHistory({ transactions }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          История транзакций
        </h3>
        <p className="text-center text-gray-400 py-6">
          Транзакций пока нет
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        История транзакций
      </h3>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 font-medium text-gray-500">Тип</th>
              <th className="text-left py-3 px-2 font-medium text-gray-500">Сумма</th>
              <th className="text-left py-3 px-2 font-medium text-gray-500">Дата</th>
              <th className="text-left py-3 px-2 font-medium text-gray-500">Хеш транзакции</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => {
              const typeConfig = TX_TYPES[tx.type] || {
                label: tx.type,
                color: "text-gray-600",
                bg: "bg-gray-50",
              };
              const amount = tx.amount
                ? parseFloat(ethers.formatEther(tx.amount)).toFixed(4)
                : "—";

              return (
                <tr
                  key={tx.txHash || index}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${typeConfig.bg} ${typeConfig.color}`}
                    >
                      {typeConfig.label}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-medium text-gray-900">
                    {amount !== "—" ? `${amount} ETH` : "—"}
                  </td>
                  <td className="py-3 px-2 text-gray-500">
                    {formatDate(tx.date || tx.timestamp || tx.createdAt)}
                  </td>
                  <td className="py-3 px-2">
                    {tx.txHash ? (
                      <a
                        href={`https://etherscan.io/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-700 font-mono text-xs"
                      >
                        {truncateHash(tx.txHash)}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {transactions.map((tx, index) => {
          const typeConfig = TX_TYPES[tx.type] || {
            label: tx.type,
            color: "text-gray-600",
            bg: "bg-gray-50",
          };
          const amount = tx.amount
            ? parseFloat(ethers.formatEther(tx.amount)).toFixed(4)
            : "—";

          return (
            <div
              key={tx.txHash || index}
              className="border border-gray-100 rounded-lg p-3"
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${typeConfig.bg} ${typeConfig.color}`}
                >
                  {typeConfig.label}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {amount !== "—" ? `${amount} ETH` : "—"}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {formatDate(tx.date || tx.timestamp || tx.createdAt)}
              </div>
              {tx.txHash && (
                <a
                  href={`https://etherscan.io/tx/${tx.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 text-xs font-mono mt-1 block"
                >
                  {truncateHash(tx.txHash)}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

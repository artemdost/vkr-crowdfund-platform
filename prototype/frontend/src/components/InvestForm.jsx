import React, { useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { useWeb3 } from "../context/Web3Context";
import { getCrowdFundContract } from "../utils/contracts";

export default function InvestForm({ contractAddress, goalAmount, totalRaised, onInvested }) {
  const { signer, account, balance, canTransact } = useWeb3();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const goal = parseFloat(ethers.formatEther(goalAmount || "0"));
  const raised = parseFloat(ethers.formatEther(totalRaised || "0"));
  const remaining = goal - raised;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canTransact) {
      toast.error("Привяжите кошелёк в профиле для инвестирования");
      return;
    }

    const ethAmount = parseFloat(amount);
    if (isNaN(ethAmount) || ethAmount <= 0) {
      toast.error("Введите корректную сумму");
      return;
    }

    if (ethAmount > parseFloat(balance)) {
      toast.error("Недостаточно средств на кошельке");
      return;
    }

    setLoading(true);
    try {
      const contract = getCrowdFundContract(contractAddress, signer);
      const value = ethers.parseEther(amount);
      const tx = await contract.invest({ value });

      toast.loading("Транзакция отправлена...", { id: "invest-tx" });
      await tx.wait();
      toast.success(`Успешно инвестировано ${amount} ETH!`, { id: "invest-tx" });

      setAmount("");
      if (onInvested) onInvested();
    } catch (err) {
      console.error("Invest error:", err);
      const reason = err.reason || err.message || "Ошибка инвестирования";
      toast.error(reason, { id: "invest-tx" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Инвестировать
      </h3>

      {/* Current balance info */}
      {account && (
        <div className="bg-indigo-50 rounded-lg p-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Ваш баланс:</span>
            <span className="font-medium text-indigo-700">
              {parseFloat(balance).toFixed(4)} ETH
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">Осталось собрать:</span>
            <span className="font-medium text-indigo-700">
              {remaining.toFixed(4)} ETH
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="invest-amount"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Сумма (ETH)
          </label>
          <div className="relative">
            <input
              id="invest-amount"
              type="number"
              step="0.0001"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-16 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
              disabled={loading}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              ETH
            </span>
          </div>
        </div>

        {/* Quick amount buttons */}
        <div className="flex space-x-2 mb-4">
          {[0.1, 0.5, 1, 5].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setAmount(String(val))}
              className="flex-1 py-1.5 text-xs font-medium bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 text-gray-600 rounded-lg transition-colors"
            >
              {val} ETH
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || !account || !amount}
          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Обработка...</span>
            </div>
          ) : !account ? (
            "Подключите кошелёк"
          ) : (
            "Инвестировать"
          )}
        </button>
      </form>
    </div>
  );
}

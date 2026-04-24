import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { useWeb3 } from "../context/Web3Context";
import { getCrowdFundContract } from "../utils/contracts";

/**
 * Format seconds into a human-readable countdown.
 */
function formatTimeLeft(seconds) {
  if (seconds <= 0) return "Голосование завершено";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (d > 0) parts.push(`${d} дн.`);
  if (h > 0) parts.push(`${h} ч.`);
  if (m > 0) parts.push(`${m} мин.`);
  if (parts.length === 0) parts.push(`${s} сек.`);

  return parts.join(" ");
}

export default function VotePanel({ contractAddress, milestoneIndex, milestone, onVoted }) {
  const { signer, account, canTransact } = useWeb3();
  const [voting, setVoting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);

  // Calculate time left and check if the user already voted
  useEffect(() => {
    if (!milestone) return;

    const votingEnd = Number(milestone.votingEnd);
    const now = Math.floor(Date.now() / 1000);
    setTimeLeft(Math.max(votingEnd - now, 0));

    // Check vote status
    if (signer && contractAddress && account) {
      const contract = getCrowdFundContract(contractAddress, signer);
      contract
        .hasVoted(milestoneIndex, account)
        .then((voted) => setHasVoted(voted))
        .catch(() => {});
    }
  }, [milestone, signer, contractAddress, milestoneIndex, account]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const votesFor = parseFloat(ethers.formatEther(milestone?.votesFor || "0"));
  const votesAgainst = parseFloat(ethers.formatEther(milestone?.votesAgainst || "0"));
  const totalVotes = votesFor + votesAgainst;
  const forPercent = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 50;

  /**
   * Submit a vote (approve or reject).
   */
  const handleVote = async (approve) => {
    if (!signer) {
      toast.error("Подключите кошелёк для голосования");
      return;
    }

    setVoting(true);
    try {
      const contract = getCrowdFundContract(contractAddress, signer);
      const tx = await contract.vote(milestoneIndex, approve);
      toast.loading("Транзакция отправлена...", { id: "vote-tx" });
      await tx.wait();
      toast.success(
        approve ? "Голос «За» учтён!" : "Голос «Против» учтён!",
        { id: "vote-tx" }
      );
      setHasVoted(true);
      if (onVoted) onVoted();
    } catch (err) {
      console.error("Vote error:", err);
      const reason = err.reason || err.message || "Ошибка голосования";
      toast.error(reason, { id: "vote-tx" });
    } finally {
      setVoting(false);
    }
  };

  /**
   * Finalize the voting after the period ends.
   */
  const handleFinishVoting = async () => {
    if (!signer) {
      toast.error("Подключите кошелёк");
      return;
    }

    setFinishing(true);
    try {
      const contract = getCrowdFundContract(contractAddress, signer);
      const tx = await contract.finishVoting(milestoneIndex);
      toast.loading("Завершение голосования...", { id: "finish-tx" });
      await tx.wait();
      toast.success("Голосование завершено!", { id: "finish-tx" });
      if (onVoted) onVoted();
    } catch (err) {
      console.error("Finish voting error:", err);
      const reason = err.reason || err.message || "Ошибка завершения голосования";
      toast.error(reason, { id: "finish-tx" });
    } finally {
      setFinishing(false);
    }
  };

  if (!milestone || milestone.status !== 1) {
    return null;
  }

  return (
    <div className="bg-white border border-yellow-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
        <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Голосование по этапу #{milestoneIndex + 1}</span>
      </h3>

      {/* Milestone info */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-700 font-medium mb-1">
          {milestone.description}
        </p>
        <p className="text-sm text-gray-500">
          Бюджет: {parseFloat(ethers.formatEther(milestone.budget || "0")).toFixed(4)} ETH
        </p>
        {milestone.reportURI && (
          <a
            href={milestone.reportURI}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-sm text-indigo-600 hover:text-indigo-700 underline"
          >
            Просмотреть отчёт
          </a>
        )}
      </div>

      {/* Voting progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-green-600 font-medium">
            За: {votesFor.toFixed(4)} ETH
          </span>
          <span className="text-red-600 font-medium">
            Против: {votesAgainst.toFixed(4)} ETH
          </span>
        </div>
        <div className="w-full h-4 bg-red-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${forPercent}%` }}
          />
        </div>
      </div>

      {/* Countdown */}
      <div className="text-center mb-4">
        <span className="text-sm text-gray-500">Осталось: </span>
        <span className="text-sm font-semibold text-gray-900">
          {formatTimeLeft(timeLeft)}
        </span>
      </div>

      {/* Vote buttons or status */}
      {timeLeft > 0 ? (
        hasVoted ? (
          <div className="text-center py-3 bg-indigo-50 rounded-lg text-indigo-700 font-medium text-sm">
            Вы уже проголосовали
          </div>
        ) : (
          <div className="flex space-x-3">
            <button
              onClick={() => handleVote(true)}
              disabled={voting}
              className="flex-1 bg-green-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {voting ? "Отправка..." : "Одобрить"}
            </button>
            <button
              onClick={() => handleVote(false)}
              disabled={voting}
              className="flex-1 bg-red-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {voting ? "Отправка..." : "Отклонить"}
            </button>
          </div>
        )
      ) : (
        <button
          onClick={handleFinishVoting}
          disabled={finishing}
          className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {finishing ? "Обработка..." : "Завершить голосование"}
        </button>
      )}
    </div>
  );
}

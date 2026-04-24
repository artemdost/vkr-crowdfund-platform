import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { useWeb3 } from "../context/Web3Context";
import { getCrowdFundContract } from "../utils/contracts";
import api from "../utils/api";

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

export default function VotingPage() {
  const { projectId, milestoneIndex } = useParams();
  const { signer, account, provider, canTransact } = useWeb3();

  const [project, setProject] = useState(null);
  const [milestone, setMilestone] = useState(null);
  const [campaignInfo, setCampaignInfo] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const msIndex = parseInt(milestoneIndex) || 0;

  /**
   * Fetch all data.
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Get project from API
      const res = await api.get(`/projects/${projectId}`);
      const proj = res.data.project || res.data;
      setProject(proj);

      if (!proj.contractAddress || !provider) {
        setLoading(false);
        return;
      }

      // Fetch on-chain data
      const contract = getCrowdFundContract(proj.contractAddress, provider);
      const info = await contract.getInfo();
      setCampaignInfo({
        author: info._author,
        goalAmount: info._goalAmount.toString(),
        totalRaised: info._totalRaised.toString(),
        deadline: info._deadline.toString(),
        state: Number(info._state),
        currentMilestone: Number(info._currentMilestone),
        milestoneCount: Number(info._milestoneCount),
      });

      // Get the specific milestone
      const ms = await contract.getMilestone(msIndex);
      const msData = {
        description: ms.description,
        budget: ms.budget.toString(),
        milestoneDeadline: ms.milestoneDeadline.toString(),
        status: Number(ms.status),
        votesFor: ms.votesFor.toString(),
        votesAgainst: ms.votesAgainst.toString(),
        votingEnd: ms.votingEnd.toString(),
        attempts: Number(ms.attempts),
        reportURI: ms.reportURI,
      };
      setMilestone(msData);

      // Calculate time left
      const votingEnd = Number(ms.votingEnd);
      const now = Math.floor(Date.now() / 1000);
      setTimeLeft(Math.max(votingEnd - now, 0));

      // Check if user has voted
      if (account) {
        const voted = await contract.hasVoted(msIndex, account);
        setHasVoted(voted);
      }
    } catch (err) {
      console.error("Failed to fetch voting data:", err);
      toast.error("Не удалось загрузить данные голосования");
    } finally {
      setLoading(false);
    }
  }, [projectId, msIndex, provider, account]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  /**
   * Submit a vote.
   */
  const handleVote = async (approve) => {
    if (!canTransact || !project?.contractAddress) {
      toast.error("Привяжите кошелёк в профиле для голосования");
      return;
    }

    setVoting(true);
    try {
      const contract = getCrowdFundContract(project.contractAddress, signer);
      const tx = await contract.vote(msIndex, approve);
      toast.loading("Транзакция отправлена...", { id: "vote-page-tx" });
      await tx.wait();
      toast.success(
        approve ? "Голос «За» учтён!" : "Голос «Против» учтён!",
        { id: "vote-page-tx" }
      );
      setHasVoted(true);
      await fetchData();
    } catch (err) {
      console.error("Vote error:", err);
      const reason = err.reason || err.message || "Ошибка голосования";
      toast.error(reason, { id: "vote-page-tx" });
    } finally {
      setVoting(false);
    }
  };

  /**
   * Finalize voting.
   */
  const handleFinishVoting = async () => {
    if (!canTransact || !project?.contractAddress) {
      toast.error("Привяжите кошелёк в профиле");
      return;
    }

    setFinishing(true);
    try {
      const contract = getCrowdFundContract(project.contractAddress, signer);
      const tx = await contract.finishVoting(msIndex);
      toast.loading("Завершение голосования...", { id: "finish-page-tx" });
      await tx.wait();
      toast.success("Голосование завершено!", { id: "finish-page-tx" });
      await fetchData();
    } catch (err) {
      console.error("Finish voting error:", err);
      const reason = err.reason || err.message || "Ошибка завершения голосования";
      toast.error(reason, { id: "finish-page-tx" });
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500">Загрузка голосования...</p>
        </div>
      </div>
    );
  }

  if (!project || !milestone) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="bg-red-50 text-red-600 rounded-lg p-6 max-w-md mx-auto">
          <p className="font-medium">Данные голосования не найдены</p>
        </div>
      </div>
    );
  }

  const votesFor = parseFloat(ethers.formatEther(milestone.votesFor));
  const votesAgainst = parseFloat(ethers.formatEther(milestone.votesAgainst));
  const totalVotes = votesFor + votesAgainst;
  const forPercent = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 50;
  const budget = parseFloat(ethers.formatEther(milestone.budget));
  const isVotingActive = milestone.status === 1;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          to={`/project/${projectId}`}
          className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          &larr; Вернуться к проекту
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Голосование: Этап #{msIndex + 1}
        </h1>
        <p className="text-gray-500 mb-1">
          Проект: {project.title}
        </p>
      </div>

      {/* Milestone info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Информация об этапе
        </h2>
        <div className="space-y-3">
          <div>
            <span className="text-sm text-gray-500">Описание</span>
            <p className="text-gray-900">{milestone.description}</p>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Бюджет</span>
            <span className="font-medium text-gray-900">
              {budget.toFixed(4)} ETH
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Попытка</span>
            <span className="font-medium text-gray-900">
              {milestone.attempts + 1} из 2
            </span>
          </div>
          {milestone.reportURI && (
            <div>
              <span className="text-sm text-gray-500">Отчёт</span>
              <a
                href={milestone.reportURI}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-indigo-600 hover:text-indigo-700 underline mt-1"
              >
                Просмотреть отчёт
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Voting progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Результаты голосования
        </h2>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-green-600 font-medium">
              За: {votesFor.toFixed(4)} ETH
            </span>
            <span className="text-red-600 font-medium">
              Против: {votesAgainst.toFixed(4)} ETH
            </span>
          </div>
          <div className="w-full h-6 bg-red-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500 flex items-center justify-center"
              style={{ width: `${forPercent}%` }}
            >
              {totalVotes > 0 && (
                <span className="text-xs text-white font-medium">
                  {forPercent.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          <div className="text-center text-sm text-gray-500 mt-2">
            Всего голосов: {totalVotes.toFixed(4)} ETH
          </div>
        </div>

        {/* Countdown */}
        <div className="text-center py-3 bg-gray-50 rounded-lg mb-4">
          <span className="text-sm text-gray-500">Осталось времени: </span>
          <span className="text-sm font-bold text-gray-900">
            {formatTimeLeft(timeLeft)}
          </span>
        </div>

        {/* Voting actions */}
        {!isVotingActive ? (
          <div className="text-center py-4 bg-gray-50 rounded-lg text-gray-500">
            Голосование не активно для этого этапа
          </div>
        ) : timeLeft > 0 ? (
          hasVoted ? (
            <div className="text-center py-4 bg-indigo-50 rounded-lg text-indigo-700 font-medium">
              Вы уже проголосовали по этому этапу
            </div>
          ) : (
            <div className="flex space-x-4">
              <button
                onClick={() => handleVote(true)}
                disabled={voting || !account}
                className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 text-lg"
              >
                {voting ? "Отправка..." : "Одобрить"}
              </button>
              <button
                onClick={() => handleVote(false)}
                disabled={voting || !account}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 text-lg"
              >
                {voting ? "Отправка..." : "Отклонить"}
              </button>
            </div>
          )
        ) : (
          <button
            onClick={handleFinishVoting}
            disabled={finishing || !account}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 text-lg"
          >
            {finishing ? "Обработка..." : "Завершить голосование"}
          </button>
        )}

        {!account && (
          <p className="text-center text-sm text-gray-400 mt-3">
            Подключите кошелёк для участия в голосовании
          </p>
        )}
      </div>
    </div>
  );
}

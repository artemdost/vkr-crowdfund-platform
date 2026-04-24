import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { useWeb3 } from "../context/Web3Context";
import { getCrowdFundContract } from "../utils/contracts";
import api from "../utils/api";
import MilestoneList from "../components/MilestoneList";
import VotePanel from "../components/VotePanel";
import InvestForm from "../components/InvestForm";
import TransactionHistory from "../components/TransactionHistory";

/**
 * Campaign state labels.
 */
const STATE_LABELS = {
  0: "Сбор средств",
  1: "Активен",
  2: "Завершён",
  3: "Провален",
};

const STATE_COLORS = {
  0: "bg-blue-100 text-blue-800",
  1: "bg-green-100 text-green-800",
  2: "bg-gray-100 text-gray-800",
  3: "bg-red-100 text-red-800",
};

/**
 * Format deadline to a readable date.
 */
function formatDeadline(timestamp) {
  if (!timestamp) return "—";
  const d = new Date(Number(timestamp) * 1000);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { signer, account, provider, canTransact } = useWeb3();

  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [chainData, setChainData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refunding, setRefunding] = useState(false);

  /**
   * Fetch all data directly from the blockchain.
   * The `id` param is the contract address.
   */
  const fetchData = useCallback(async () => {
    if (!provider || !id) return;
    setLoading(true);
    try {
      const contract = getCrowdFundContract(id, provider);
      const info = await contract.getInfo();

      const onChain = {
        author: info._author,
        goalAmount: info._goalAmount.toString(),
        totalRaised: info._totalRaised.toString(),
        deadline: info._deadline.toString(),
        state: Number(info._state),
        currentMilestone: Number(info._currentMilestone),
        milestoneCount: Number(info._milestoneCount),
        platformFeePercent: Number(info._platformFeePercent),
      };
      setChainData(onChain);
      let dbProject = null;
      try {
        const res = await api.get("/projects");
        dbProject = (res.data || []).find(
          (p) => (p.contract_address || "").toLowerCase() === id.toLowerCase()
        );
      } catch {}
      setProject({
        contractAddress: id,
        title: dbProject?.title || `Campaign ${id.slice(0, 10)}...`,
        description: dbProject?.description || "",
        dbMilestones: dbProject?.milestones || [],
      });

      const msCount = Number(info._milestoneCount);
      const msArr = [];
      for (let i = 0; i < msCount; i++) {
        const ms = await contract.getMilestone(i);
        msArr.push({
          description: ms.description,
          budget: ms.budget.toString(),
          milestoneDeadline: ms.milestoneDeadline.toString(),
          status: Number(ms.status),
          votesFor: ms.votesFor.toString(),
          votesAgainst: ms.votesAgainst.toString(),
          votingEnd: ms.votingEnd.toString(),
          attempts: Number(ms.attempts),
          reportURI: ms.reportURI,
        });
      }
      setMilestones(msArr);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch chain data:", err);
      setError("Не удалось загрузить проект");
    } finally {
      setLoading(false);
    }
  }, [provider, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshData = () => fetchData();

  /**
   * Request a refund from the smart contract.
   */
  const handleRefund = async () => {
    if (!canTransact || !project?.contractAddress) {
      toast.error("Подключите кошелёк");
      return;
    }

    setRefunding(true);
    try {
      const contract = getCrowdFundContract(project.contractAddress, signer);
      const tx = await contract.requestRefund();
      toast.loading("Запрос возврата...", { id: "refund-tx" });
      await tx.wait();
      toast.success("Средства возвращены!", { id: "refund-tx" });
      await refreshData();
    } catch (err) {
      console.error("Refund error:", err);
      const reason = err.reason || err.message || "Ошибка возврата средств";
      toast.error(reason, { id: "refund-tx" });
    } finally {
      setRefunding(false);
    }
  };

  // Merged data from API and chain
  const effectiveState = chainData?.state ?? project?.state ?? 0;
  const effectiveGoal = chainData?.goalAmount || project?.goalAmount || "0";
  const effectiveRaised = chainData?.totalRaised || project?.totalRaised || "0";
  const effectiveDeadline = chainData?.deadline || project?.deadline || "0";
  const effectiveCurrentMs = chainData?.currentMilestone ?? 0;

  const goal = parseFloat(ethers.formatEther(effectiveGoal));
  const raised = parseFloat(ethers.formatEther(effectiveRaised));
  const progress = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;

  // Determine if refund is available
  const isFundingExpired =
    effectiveState === 0 &&
    Number(effectiveDeadline) > 0 &&
    Date.now() / 1000 > Number(effectiveDeadline) &&
    raised < goal;
  const isMilestoneRejected =
    effectiveState === 1 &&
    milestones[effectiveCurrentMs]?.status === 3;
  const canRefund = isFundingExpired || isMilestoneRejected;

  // Check if current milestone is in voting state
  const currentMilestoneData = milestones[effectiveCurrentMs];
  const isVoting = currentMilestoneData?.status === 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500">Загрузка проекта...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="bg-red-50 text-red-600 rounded-lg p-6 max-w-md mx-auto">
            <p className="font-medium">{error || "Проект не найден"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content — left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {project.title}
              </h1>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  STATE_COLORS[effectiveState] || STATE_COLORS[0]
                }`}
              >
                {STATE_LABELS[effectiveState] || "Неизвестно"}
              </span>
            </div>

            <p className="text-gray-600 mb-6 whitespace-pre-line">
              {project.description}
            </p>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-gray-900">
                  {raised.toFixed(4)} ETH собрано
                </span>
                <span className="text-gray-500">
                  Цель: {goal.toFixed(4)} ETH
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{progress.toFixed(1)}%</span>
                <span>Дедлайн: {formatDeadline(effectiveDeadline)}</span>
              </div>
            </div>

            {/* Author and contract info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div>
                <span className="text-xs text-gray-500">Автор</span>
                <p className="text-sm font-mono text-gray-700 break-all">
                  {chainData?.author || project.authorAddress || "—"}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Контракт</span>
                <p className="text-sm font-mono text-gray-700 break-all">
                  {project.contractAddress || "Не развёрнут"}
                </p>
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <MilestoneList
              milestones={milestones}
              currentMilestone={effectiveCurrentMs}
            />
          </div>

          {/* Vote panel (if current milestone is in Voting state) */}
          {isVoting && project.contractAddress && (
            <VotePanel
              contractAddress={project.contractAddress}
              milestoneIndex={effectiveCurrentMs}
              milestone={currentMilestoneData}
              onVoted={refreshData}
            />
          )}

          {/* Transaction history */}
          <TransactionHistory transactions={transactions} />
        </div>

        {/* Sidebar — right 1/3 */}
        <div className="space-y-6">
          {/* Invest form (only during Funding state) */}
          {effectiveState === 0 && project.contractAddress && (
            <InvestForm
              contractAddress={project.contractAddress}
              goalAmount={effectiveGoal}
              totalRaised={effectiveRaised}
              onInvested={refreshData}
            />
          )}

          {/* Refund button */}
          {canRefund && project.contractAddress && (
            <div className="bg-white border border-red-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Возврат средств
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {isFundingExpired
                  ? "Кампания не достигла цели в отведённые сроки. Вы можете вернуть свои средства."
                  : "Этап был отклонён. Вы можете запросить возврат оставшихся средств."}
              </p>
              <button
                onClick={handleRefund}
                disabled={refunding || !account}
                className="w-full bg-red-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {refunding ? "Обработка..." : "Запросить возврат"}
              </button>
            </div>
          )}

          {/* Campaign info card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Информация
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Статус</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {STATE_LABELS[effectiveState]}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Цель</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {goal.toFixed(4)} ETH
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Собрано</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {raised.toFixed(4)} ETH
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Этапы</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {effectiveCurrentMs + (effectiveState === 2 ? 0 : 0)} / {milestones.length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Комиссия платформы</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {chainData?.platformFeePercent ?? "—"}%
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Дедлайн</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatDeadline(effectiveDeadline)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

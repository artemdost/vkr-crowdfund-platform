import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useWeb3 } from "../context/Web3Context";
import { getFactoryContract } from "../utils/contracts";

/**
 * Empty milestone template.
 */
function emptyMilestone() {
  return { description: "", budget: "", duration: "" };
}

export default function CreateProject() {
  const navigate = useNavigate();
  const { signer, account, canTransact } = useWeb3();

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState("");
  const [milestones, setMilestones] = useState([emptyMilestone()]);
  const [loading, setLoading] = useState(false);

  /**
   * Update a specific milestone field.
   */
  const updateMilestone = (index, field, value) => {
    setMilestones((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  /**
   * Add a new milestone row.
   */
  const addMilestone = () => {
    setMilestones((prev) => [...prev, emptyMilestone()]);
  };

  /**
   * Remove a milestone row.
   */
  const removeMilestone = (index) => {
    if (milestones.length <= 1) {
      toast.error("Нужен хотя бы один этап");
      return;
    }
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Compute the sum of milestone budgets.
   */
  const budgetSum = milestones.reduce(
    (sum, ms) => sum + (parseFloat(ms.budget) || 0),
    0
  );

  /**
   * Validate and submit the form.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Client-side validation
    if (!title.trim()) {
      toast.error("Введите название проекта");
      return;
    }
    if (!description.trim()) {
      toast.error("Введите описание проекта");
      return;
    }
    if (!goal || parseFloat(goal) <= 0) {
      toast.error("Укажите корректную цель сбора");
      return;
    }
    if (!duration || parseInt(duration) <= 0) {
      toast.error("Укажите длительность в днях");
      return;
    }

    // Validate milestones
    for (let i = 0; i < milestones.length; i++) {
      const ms = milestones[i];
      if (!ms.description.trim()) {
        toast.error(`Введите описание этапа #${i + 1}`);
        return;
      }
      if (!ms.budget || parseFloat(ms.budget) <= 0) {
        toast.error(`Укажите бюджет этапа #${i + 1}`);
        return;
      }
      if (!ms.duration || parseInt(ms.duration) <= 0) {
        toast.error(`Укажите длительность этапа #${i + 1}`);
        return;
      }
    }

    // Budgets must sum to goal
    const goalNum = parseFloat(goal);
    const tolerance = 0.0001;
    if (Math.abs(budgetSum - goalNum) > tolerance) {
      toast.error(
        `Сумма бюджетов (${budgetSum.toFixed(4)} ETH) должна быть равна цели (${goalNum.toFixed(4)} ETH)`
      );
      return;
    }

    if (!canTransact) {
      toast.error("Привяжите кошелёк в профиле для создания проекта");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create project in API
      const apiPayload = {
        title: title.trim(),
        description: description.trim(),
        goal_amount: parseFloat(goal),
        duration_days: parseInt(duration),
        milestones: milestones.map((ms) => ({
          description: ms.description.trim(),
          budget: parseFloat(ms.budget),
          duration_days: parseInt(ms.duration),
        })),
      };

      toast.loading("Сохранение проекта...", { id: "create-project" });
      const res = await api.post("/projects", apiPayload);
      const projectData = res.data.project || res.data;

      // Step 2: Create campaign on blockchain via factory
      toast.loading("Отправка транзакции в блокчейн...", { id: "create-project" });
      const factory = await getFactoryContract(signer);

      const goalWei = ethers.parseEther(goal);
      const durationDays = parseInt(duration);
      const msDescriptions = milestones.map((ms) => ms.description.trim());
      const msBudgets = milestones.map((ms) => ethers.parseEther(ms.budget));
      const msDurations = milestones.map((ms) => BigInt(parseInt(ms.duration)));
      const platformFee = 2; // 2% platform fee

      const tx = await factory.createCampaign(
        goalWei,
        durationDays,
        msDescriptions,
        msBudgets,
        msDurations,
        platformFee
      );

      toast.loading("Ожидание подтверждения...", { id: "create-project" });
      const receipt = await tx.wait();

      // Extract the campaign address from the CampaignCreated event
      let campaignAddress = null;
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog({
            topics: log.topics,
            data: log.data,
          });
          if (parsed && parsed.name === "CampaignCreated") {
            campaignAddress = parsed.args.campaignAddress;
            break;
          }
        } catch {
          // Not this contract's log
        }
      }

      // Step 3: Update the project in API with the contract address
      if (campaignAddress && projectData._id) {
        try {
          await api.put(`/projects/${projectData._id}`, {
            contractAddress: campaignAddress,
            txHash: receipt.hash,
          });
        } catch {
          // Non-critical: API update might fail
        }
      }

      toast.success("Проект успешно создан!", { id: "create-project" });
      navigate(`/project/${projectData._id}`);
    } catch (err) {
      console.error("Create project error:", err);
      const reason = err.reason || err.response?.data?.message || err.message || "Ошибка создания проекта";
      toast.error(reason, { id: "create-project" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Создать проект</h1>
        <p className="text-gray-500 mt-2">
          Заполните форму для создания нового краудфандингового проекта
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Основная информация
          </h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Название проекта
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Введите название..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Описание
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Опишите ваш проект..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors resize-none"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="goal"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Цель сбора (ETH)
                </label>
                <input
                  id="goal"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="0.0"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                  disabled={loading}
                />
              </div>
              <div>
                <label
                  htmlFor="duration"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Длительность сбора (дней)
                </label>
                <input
                  id="duration"
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="30"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Этапы</h2>
            <button
              type="button"
              onClick={addMilestone}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              disabled={loading}
            >
              + Добавить этап
            </button>
          </div>

          <div className="space-y-4">
            {milestones.map((ms, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 relative"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">
                    Этап #{index + 1}
                  </span>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(index)}
                      className="text-sm text-red-500 hover:text-red-700 transition-colors"
                      disabled={loading}
                    >
                      Удалить
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Описание этапа
                    </label>
                    <input
                      type="text"
                      value={ms.description}
                      onChange={(e) =>
                        updateMilestone(index, "description", e.target.value)
                      }
                      placeholder="Описание..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                      disabled={loading}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Бюджет (ETH)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={ms.budget}
                        onChange={(e) =>
                          updateMilestone(index, "budget", e.target.value)
                        }
                        placeholder="0.0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Длительность (дней)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={ms.duration}
                        onChange={(e) =>
                          updateMilestone(index, "duration", e.target.value)
                        }
                        placeholder="7"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Budget sum validation indicator */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Сумма бюджетов этапов:
              </span>
              <span
                className={`text-sm font-semibold ${
                  goal &&
                  Math.abs(budgetSum - parseFloat(goal || "0")) < 0.0001
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {budgetSum.toFixed(4)} ETH
                {goal && (
                  <span className="text-gray-400 font-normal">
                    {" "}
                    / {parseFloat(goal || "0").toFixed(4)} ETH
                  </span>
                )}
              </span>
            </div>
            {goal &&
              Math.abs(budgetSum - parseFloat(goal || "0")) >= 0.0001 && (
                <p className="text-xs text-red-500 mt-1">
                  Сумма бюджетов должна быть равна цели сбора
                </p>
              )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading || !account}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>Создание...</span>
              </div>
            ) : !account ? (
              "Подключите кошелёк"
            ) : (
              "Создать проект"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

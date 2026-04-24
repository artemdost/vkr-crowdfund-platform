import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";
import { getCrowdFundContract } from "../utils/contracts";

/**
 * State labels.
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

export default function Dashboard() {
  const { user } = useAuth();
  const { signer, account, provider } = useWeb3();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalRaised: 0, totalPaidOut: 0 });

  // Report submission state
  const [reportProject, setReportProject] = useState(null);
  const [reportURI, setReportURI] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  /**
   * Fetch user's projects from API.
   */
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/projects", { params: { author: "me" } });
      const data = res.data.projects || res.data || [];
      setProjects(data);

      // Calculate stats
      let raised = 0;
      let paid = 0;
      for (const p of data) {
        raised += parseFloat(ethers.formatEther(p.totalRaised || "0"));
        // Approximate paid out: sum of approved milestones' budgets
        if (p.milestones) {
          for (const ms of p.milestones) {
            if (ms.status === 2) {
              paid += parseFloat(ethers.formatEther(ms.budget || "0"));
            }
          }
        }
      }
      setStats({ totalRaised: raised, totalPaidOut: paid });
    } catch (err) {
      console.error("Failed to fetch dashboard projects:", err);
      toast.error("Не удалось загрузить проекты");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  /**
   * Submit a milestone report to start voting.
   */
  const handleSubmitReport = async (project) => {
    if (!signer || !project.contractAddress) {
      toast.error("Подключите кошелёк");
      return;
    }

    if (!reportURI.trim()) {
      toast.error("Введите ссылку на отчёт");
      return;
    }

    setSubmittingReport(true);
    try {
      const contract = getCrowdFundContract(project.contractAddress, signer);

      // Get the current milestone index from chain
      const currentMs = await contract.currentMilestone();
      const tx = await contract.submitMilestone(currentMs, reportURI.trim());

      toast.loading("Отправка отчёта...", { id: "submit-report" });
      await tx.wait();
      toast.success("Отчёт отправлен! Голосование началось.", {
        id: "submit-report",
      });

      setReportProject(null);
      setReportURI("");
      await fetchProjects();
    } catch (err) {
      console.error("Submit report error:", err);
      const reason = err.reason || err.message || "Ошибка отправки отчёта";
      toast.error(reason, { id: "submit-report" });
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500">Загрузка панели управления...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Панель управления</h1>
        <p className="text-gray-500 mt-1">
          {user?.email || "Мои проекты"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Всего проектов</div>
          <div className="text-3xl font-bold text-gray-900">
            {projects.length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Всего собрано</div>
          <div className="text-3xl font-bold text-indigo-600">
            {stats.totalRaised.toFixed(4)} ETH
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Выплачено</div>
          <div className="text-3xl font-bold text-green-600">
            {stats.totalPaidOut.toFixed(4)} ETH
          </div>
        </div>
      </div>

      {/* Projects list */}
      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <p className="text-gray-500 text-lg mb-4">У вас пока нет проектов</p>
          <Link
            to="/create"
            className="inline-block bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Создать проект
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => {
            const goal = parseFloat(
              ethers.formatEther(project.goalAmount || "0")
            );
            const raised = parseFloat(
              ethers.formatEther(project.totalRaised || "0")
            );
            const progress = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
            const stateColor =
              STATE_COLORS[project.state] || STATE_COLORS[0];
            const stateLabel =
              STATE_LABELS[project.state] || "Неизвестно";
            const isActive = project.state === 1;

            return (
              <div
                key={project._id || project.contractAddress}
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Link
                        to={`/project/${project._id}`}
                        className="text-lg font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                      >
                        {project.title}
                      </Link>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stateColor}`}
                      >
                        {stateLabel}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full max-w-md">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{raised.toFixed(4)} ETH</span>
                        <span>{goal.toFixed(4)} ETH</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-3">
                    <Link
                      to={`/project/${project._id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      Подробнее
                    </Link>

                    {isActive && (
                      <button
                        onClick={() => {
                          setReportProject(project);
                          setReportURI("");
                        }}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                      >
                        Отправить отчёт
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report submission modal */}
      {reportProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Отправить отчёт по этапу
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Проект: {reportProject.title}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ссылка на отчёт (URI)
              </label>
              <input
                type="url"
                value={reportURI}
                onChange={(e) => setReportURI(e.target.value)}
                placeholder="https://..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                disabled={submittingReport}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setReportProject(null);
                  setReportURI("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={submittingReport}
              >
                Отмена
              </button>
              <button
                onClick={() => handleSubmitReport(reportProject)}
                disabled={submittingReport}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {submittingReport ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>Отправка...</span>
                  </div>
                ) : (
                  "Отправить"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

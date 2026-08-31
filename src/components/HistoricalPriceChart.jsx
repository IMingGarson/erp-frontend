import React, { useState, useEffect, useMemo } from "react";
import { TrendingUp, Loader2, AlertCircle, X, PieChart } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchWithAuth } from "../utils/fetchWithAuth";

export default function HistoricalPriceChart({ materialId, materialType }) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState("ALL");

  // 🌟 控制點擊後彈出的成本結構 Modal
  const [selectedPointData, setSelectedPointData] = useState(null);

  const isRawOrPack = ["RAW", "PACK"].includes(materialType);

  useEffect(() => {
    if (!materialId) return;

    const fetchHistoricalData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchWithAuth(
          `/api/materials/${materialId}/historical_prices`,
        );
        if (!response.ok) throw new Error("無法取得歷史價格資料");

        const json = await response.json();
        const rawData = json.data?.data || [];
        setData(rawData);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistoricalData();
  }, [materialId]);

  const providers = useMemo(() => {
    if (!isRawOrPack || !data.length) return [];
    const uniqueProviders = Array.from(
      new Set(data.map((item) => item.provider).filter(Boolean)),
    );
    return uniqueProviders;
  }, [data, isRawOrPack]);

  const chartData = useMemo(() => {
    let filtered = data;
    if (isRawOrPack && selectedProvider !== "ALL") {
      filtered = data.filter((item) => item.provider === selectedProvider);
    }

    return filtered.map((item) => {
      const unitPrice = parseFloat(item.unit_price) || 0;
      const totalPrice = parseFloat(item.total_price) || 0;
      const qty = parseFloat(item.quantity);
      const isValidQty = !isNaN(qty) && qty > 0;

      return {
        ...item,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        displayQty: isValidQty ? qty : null,
      };
    });
  }, [data, selectedProvider, isRawOrPack]);

  // 🌟 雙重保障一：圖表背景的點擊捕捉
  const handleChartClick = (state) => {
    if (
      !isRawOrPack &&
      state &&
      state.activePayload &&
      state.activePayload.length > 0
    ) {
      setSelectedPointData(state.activePayload[0].payload);
    }
  };

  // 🌟 客製化 Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const pointData = payload[0].payload;

      return (
        <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-slate-200/60">
          <p className="text-[13px] font-black text-slate-800 mb-2 border-b border-slate-200 pb-2">
            {label}
          </p>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center gap-6">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {isRawOrPack ? "單價" : "配方總成本"}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] font-bold text-slate-400">$</span>
                <span className="text-xl font-black text-[#007AFF] font-mono tracking-tight">
                  {pointData.unitPrice.toFixed(2)}
                </span>
              </div>
            </div>

            {/* RAW / PACK 顯示進貨明細 */}
            {isRawOrPack && pointData.displayQty !== null && (
              <>
                <div className="flex justify-between items-center gap-6 pt-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    進貨數量 ({materialType === "RAW" ? "KG" : "個"})
                  </span>
                  <span className="text-sm font-bold text-slate-700 font-mono">
                    {pointData.displayQty}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-6">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    總金額
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-bold text-slate-400">
                      $
                    </span>
                    <span className="text-sm font-bold text-slate-700 font-mono">
                      {pointData.totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* SEMI / PRODUCT 點擊提示 */}
            {!isRawOrPack &&
              pointData.breakdown &&
              pointData.breakdown.length > 0 && (
                <div className="mt-1 pt-2 border-t border-slate-100 text-center">
                  <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">
                    👉 點擊圖表查看完整成本結構
                  </span>
                </div>
              )}
          </div>

          {/* 供應商標籤 */}
          {isRawOrPack && pointData.provider && (
            <div className="mt-3 pt-3 border-t border-slate-200/80 flex justify-between items-center gap-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                供應商
              </span>
              <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100/50 px-2 py-1 rounded-md tracking-wide truncate max-w-[120px]">
                {pointData.provider}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-3xl border border-slate-200/60">
        <Loader2 className="w-8 h-8 animate-spin text-[#007AFF] mb-3" />
        <span className="text-sm font-bold text-slate-400">
          載入歷史資料中...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-red-50 rounded-3xl border border-red-100 text-red-500">
        <AlertCircle className="w-8 h-8 mb-3" />
        <span className="text-sm font-bold">{error}</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
        <span className="text-sm font-bold text-slate-400">
          過去三個月無相關進貨或成本紀錄
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] w-full relative">
        {/* 🌟 徹底清除 Recharts 帶來的藍色 Focus 框 */}
        <style>
          {`
            .recharts-wrapper, 
            .recharts-wrapper *,
            .recharts-surface, 
            .recharts-responsive-container {
              outline: none !important;
            }
          `}
        </style>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h4 className="text-[12px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 w-full sm:w-auto">
            <TrendingUp size={16} className="text-[#007AFF]" />
            {isRawOrPack ? "歷史進貨單價趨勢" : "歷史配方成本趨勢"}
          </h4>

          {isRawOrPack && providers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedProvider("ALL")}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all shadow-sm outline-none ${
                  selectedProvider === "ALL"
                    ? "bg-slate-800 text-white"
                    : "bg-white border border-slate-200 text-slate-500 hover:border-slate-400"
                }`}
              >
                全部供應商
              </button>
              {providers.map((provider) => (
                <button
                  key={provider}
                  onClick={() => setSelectedProvider(provider)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all shadow-sm max-w-[120px] truncate outline-none ${
                    selectedProvider === provider
                      ? "bg-[#007AFF] text-white"
                      : "bg-white border border-slate-200 text-slate-500 hover:border-[#007AFF] hover:text-[#007AFF]"
                  }`}
                >
                  {provider}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 圖表區塊 */}
        <div className="w-full h-[280px]">
          <ResponsiveContainer
            width="100%"
            height="100%"
            className="focus:outline-none"
          >
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              onClick={!isRawOrPack ? handleChartClick : undefined}
              style={{
                cursor: !isRawOrPack ? "pointer" : "default",
                outline: "none",
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#F1F5F9"
              />
              <XAxis
                dataKey={isRawOrPack ? "date" : "month"}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 700 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 700 }}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: "#CBD5E1",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
                isAnimationActive={false}
                wrapperStyle={{ pointerEvents: "none", outline: "none" }} // 讓滑鼠穿透 Tooltip 不干擾點擊
              />
              <Line
                type="monotone"
                dataKey="unitPrice"
                stroke="#007AFF"
                strokeWidth={3}
                dot={{
                  r: 4,
                  fill: "#fff",
                  stroke: "#007AFF",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 7,
                  fill: "#007AFF",
                  stroke: "#fff",
                  strokeWidth: 2,
                  style: { outline: "none" },
                  // 🌟 雙重保障二：精準點擊小圓點時也能觸發彈窗
                  onClick: (e, payload) => {
                    if (!isRawOrPack && payload && payload.payload) {
                      setSelectedPointData(payload.payload);
                    }
                  },
                }}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {!isRawOrPack && selectedPointData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-2xl w-full max-w-md max-h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200/50 animate-in zoom-in-95">
            <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-start shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-1">
                  <PieChart className="text-indigo-500" size={22} />
                  成本結構分析
                </h3>
                <p className="text-sm font-bold text-slate-500 font-mono">
                  {selectedPointData.month}
                </p>
              </div>
              <button
                onClick={() => setSelectedPointData(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-500 p-2 rounded-full transition-colors outline-none"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                配方總計成本
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-slate-400">$</span>
                <span className="text-3xl font-black text-[#007AFF] font-mono tracking-tight">
                  {selectedPointData.unitPrice.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
              {selectedPointData.breakdown?.map((item, idx) => {
                const percentage =
                  selectedPointData.unitPrice > 0
                    ? ((item.cost / selectedPointData.unitPrice) * 100).toFixed(
                        1,
                      )
                    : 0;

                return (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-end">
                      <span className="text-[13px] font-bold text-slate-700 leading-tight">
                        {item.name}
                      </span>
                      <div className="flex items-baseline gap-0.5 shrink-0 pl-4">
                        <span className="text-[11px] font-bold text-slate-400">
                          $
                        </span>
                        <span className="text-sm font-black text-slate-800 font-mono">
                          {item.cost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 font-mono w-8 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

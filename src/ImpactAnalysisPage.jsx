import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  AlertCircle,
  FileText,
  TrendingUp,
  ChevronDown,
  RefreshCw,
  Package,
  Building,
  CheckCircle2,
  TrendingDown,
  Edit2,
  Minus,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";

// 工具函數
const formatDisplayNum = (val) => {
  if (val === null || val === undefined || isNaN(parseFloat(val)))
    return "0.00";
  return parseFloat(val).toFixed(2);
};

const formatDiffCurrency = (val) => {
  const num = parseFloat(val) || 0;
  if (num > 0.001) return `+ $${num.toFixed(2)}`;
  if (num < -0.001) return `- $${Math.abs(num).toFixed(2)}`;
  return `$0.00`;
};

// 🌟 用於合約報價單的精簡版 Badge
const DiffBadge = ({ value }) => {
  const num = parseFloat(value) || 0;
  if (num > 0.001) {
    return (
      <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 px-2.5 py-1 rounded-md border border-rose-200 text-[11px] font-bold shadow-sm whitespace-nowrap">
        <span>成本增加</span>
        <span className="font-mono text-sm">${num.toFixed(2)}</span>
      </div>
    );
  }
  if (num < -0.001) {
    return (
      <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-md border border-emerald-200 text-[11px] font-bold shadow-sm whitespace-nowrap">
        <span>成本減少</span>
        <span className="font-mono text-sm">${Math.abs(num).toFixed(2)}</span>
      </div>
    );
  }
  return <span className="text-slate-300 font-bold">-</span>;
};

// 🌟 用於算式卡片底部的大型純文字顯示
const DiffTextLarge = ({ value }) => {
  const num = parseFloat(value) || 0;
  if (num > 0.001) {
    return (
      <div className="flex items-baseline gap-1.5 text-rose-600">
        <span className="text-[14px] font-bold tracking-wider">增加</span>
        <span className="font-mono text-[28px] font-black tracking-tighter leading-none">
          ${num.toFixed(2)}
        </span>
      </div>
    );
  }
  if (num < -0.001) {
    return (
      <div className="flex items-baseline gap-1.5 text-emerald-600">
        <span className="text-[14px] font-bold tracking-wider">減少</span>
        <span className="font-mono text-[28px] font-black tracking-tighter leading-none">
          ${Math.abs(num).toFixed(2)}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-1.5 text-emerald-600">
      <span className="font-mono text-[28px] font-black tracking-tighter leading-none">
        ${num.toFixed(2)}
      </span>
    </div>
  );
  return null;
};

const TYPE_MAP = {
  RAW: {
    label: "原物料",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SEMI: { label: "半成品", color: "bg-blue-50 text-blue-700 border-blue-200" },
  PRODUCT: {
    label: "成品",
    color: "bg-[#F3E8FF] text-[#9333EA] border-[#D8B4FE]",
  },
  PACK: { label: "包材", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

// 通用的 Searchable Dropdown 元件
const SearchableSelect = ({
  value,
  onChange,
  options,
  placeholder,
  renderItem,
  icon: Icon = Search,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const selectRef = useRef(null);
  const dropdownRef = useRef(null);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lowerTerm = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lowerTerm) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(lowerTerm)),
    );
  }, [options, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !selectRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full min-w-[240px]">
      <div
        ref={selectRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-[40px] px-4 py-2 border rounded-xl text-sm cursor-pointer bg-white flex justify-between items-center transition-all shadow-sm ${
          isOpen
            ? "border-[#007AFF] ring-2 ring-[#007AFF]/20"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden w-full">
          <Icon
            size={16}
            className={value ? "text-[#007AFF]" : "text-slate-400"}
          />
          <span
            className={`truncate font-bold ${value ? "text-slate-800" : "text-slate-400"}`}
          >
            {value || placeholder}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 w-full mt-2 z-[99] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col max-h-[320px] overflow-hidden animate-in fade-in duration-200"
        >
          <div className="p-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <input
              autoFocus
              className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 shadow-sm transition-all"
              placeholder="輸入關鍵字過濾..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  className="px-3 py-2.5 text-sm rounded-xl hover:bg-[#007AFF]/5 cursor-pointer transition-colors"
                >
                  {renderItem ? (
                    renderItem(opt)
                  ) : (
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">
                        {opt.label}
                      </span>
                      {opt.subLabel && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {opt.subLabel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs font-bold">
                查無符合結果
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PriceComparisonWidget = ({
  oldPrice,
  newPrice,
  diffPercent,
  effectiveDate,
}) => {
  const diffVal = newPrice - oldPrice;
  const isUp = diffVal > 0.001;
  const isDown = diffVal < -0.001;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden w-full mx-auto">
      <div className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 text-center md:text-left flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            現行均價
          </span>
          <span className="text-2xl font-mono font-bold text-slate-400 line-through decoration-slate-300 decoration-2">
            ${formatDisplayNum(oldPrice)}
          </span>
        </div>

        <div className="shrink-0 flex flex-col items-center justify-center">
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-full border-2 bg-white z-10 ${
              isUp
                ? "border-rose-100 text-rose-500"
                : isDown
                  ? "border-emerald-100 text-emerald-500"
                  : "border-slate-100 text-slate-400"
            }`}
          >
            {isUp ? (
              <TrendingUp size={20} strokeWidth={3} />
            ) : isDown ? (
              <TrendingDown size={20} strokeWidth={3} />
            ) : (
              <Minus size={20} strokeWidth={3} />
            )}
          </div>
          <div
            className={`mt-2.5 px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-wider border shadow-sm ${
              isUp
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : isDown
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            {isUp ? "調漲" : isDown ? "調降" : "持平"}{" "}
            {formatDisplayNum(Math.abs(diffPercent))}%
          </div>
        </div>

        <div className="flex-1 text-center md:text-right flex flex-col items-center md:items-end">
          <span className="text-[10px] font-bold text-[#007AFF] uppercase tracking-widest mb-1.5">
            廠商新報價
          </span>
          <span
            className={`text-[28px] font-mono font-black tracking-tight ${
              isUp
                ? "text-rose-600"
                : isDown
                  ? "text-emerald-600"
                  : "text-[#007AFF]"
            }`}
          >
            ${formatDisplayNum(newPrice)}
          </span>
          {effectiveDate && (
            <span className="mt-1 text-[9px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 shadow-sm">
              生效日：{effectiveDate}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ImpactAnalysisPage() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [isFetchingMaterials, setIsFetchingMaterials] = useState(false);

  const [alerts, setAlerts] = useState([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const [activeAlertProvider, setActiveAlertProvider] = useState("全部供應商");

  const [selectedMaterial, setSelectedMaterial] = useState(null);

  const [impactData, setImpactData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [activeAnalysisSource, setActiveAnalysisSource] = useState(null);

  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
  });
  const showAlert = (title, message, status = "info") =>
    setDialog({ isOpen: true, type: "alert", status, title, message });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  // 當使用者離開此頁面去編輯配方，返回時自動重刷資料
  useEffect(() => {
    const handleFocus = () => {
      fetchActiveAlerts(true);
      if (selectedMaterial) {
        runImpactAnalysis(selectedMaterial.id, activeAnalysisSource, true);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [selectedMaterial, activeAnalysisSource]);

  useEffect(() => {
    fetchMaterials();
    fetchActiveAlerts();
  }, []);

  const fetchMaterials = async () => {
    setIsFetchingMaterials(true);
    try {
      const response = await fetchWithAuth("/api/materials?lite=true");
      const json = await response.json();
      const rawList = json.data || json || [];
      setMaterials(
        rawList.filter(
          (m) => ["RAW", "SEMI", "PACK"].includes(m.type) && m.is_active,
        ),
      );
    } catch (error) {
      console.error("載入物料失敗:", error);
    } finally {
      setIsFetchingMaterials(false);
    }
  };

  const fetchActiveAlerts = async (isBackground = false) => {
    if (!isBackground) setIsLoadingAlerts(true);
    try {
      const response = await fetchWithAuth("/api/materials/active_alerts");
      if (response.ok) {
        const json = await response.json();
        setAlerts(json.data || json.alerts || json || []);
      }
    } catch (error) {
      console.error("載入預警失敗:", error);
    } finally {
      if (!isBackground) setIsLoadingAlerts(false);
    }
  };

  const providerOptions = useMemo(() => {
    const providers = alerts.map((a) => a.provider_name).filter(Boolean);
    const uniqueProviders = [...new Set(providers)];
    return [
      { label: "全部供應商", value: "全部供應商" },
      ...uniqueProviders.map((p) => ({ label: p, value: p })),
    ];
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    let filtered = alerts;
    if (activeAlertProvider !== "全部供應商") {
      filtered = alerts.filter((a) => a.provider_name === activeAlertProvider);
    }
    return filtered.sort(
      (a, b) => new Date(b.effective_date) - new Date(a.effective_date),
    );
  }, [alerts, activeAlertProvider]);

  const materialOptions = useMemo(() => {
    return materials.map((m) => ({
      label: m.name,
      subLabel: m.code,
      value: m,
      type: m.type,
    }));
  }, [materials]);

  const runImpactAnalysis = async (
    materialId,
    sourceItem = null,
    isBackground = false,
  ) => {
    if (!isBackground) setIsAnalyzing(true);
    setActiveAnalysisSource(sourceItem);
    try {
      const res = await fetchWithAuth(
        `/api/materials/${materialId}/impact_analysis`,
      );
      if (!res.ok) throw new Error("無法取得影響資料");
      const json = await res.json();

      if (!sourceItem && json.data?.provider_quotes?.length > 0) {
        setActiveTabIdx(0);
      }

      setImpactData(json.data || json);
    } catch (error) {
      if (!isBackground)
        showAlert(
          "分析失敗",
          "無法取得此物料的評估資料，請稍後再試。",
          "error",
        );
    } finally {
      if (!isBackground) setIsAnalyzing(false);
    }
  };

  const currentProviderQuote = useMemo(() => {
    if (
      !impactData ||
      !impactData.provider_quotes ||
      impactData.provider_quotes.length === 0
    )
      return null;

    if (activeAnalysisSource && activeAnalysisSource.provider_name) {
      const matchedQuote = impactData.provider_quotes.find(
        (q) => q.provider_name === activeAnalysisSource.provider_name,
      );
      if (matchedQuote) {
        const idx = impactData.provider_quotes.findIndex(
          (q) => q.provider_name === activeAnalysisSource.provider_name,
        );
        if (activeTabIdx !== idx) setActiveTabIdx(idx !== -1 ? idx : 0);
        return matchedQuote;
      }
    }
    return (
      impactData.provider_quotes[activeTabIdx] || impactData.provider_quotes[0]
    );
  }, [impactData, activeAnalysisSource, activeTabIdx]);

  // 🌟 使用 useMemo 提前算好所有配方的成本與價差
  const affectedProductsList = useMemo(() => {
    if (!impactData || !impactData.affected_products || !currentProviderQuote)
      return [];

    return impactData.affected_products.map((prod) => {
      const oldContrib = prod.paths.reduce(
        (s, p) => s + p.target_cost_info.current_cost * p.ratio,
        0,
      );
      const newContrib =
        currentProviderQuote.new_price * prod.accumulated_ratio;
      const costDiff = newContrib - oldContrib;
      const isFullyApplied = Math.abs(costDiff) < 0.001;

      return {
        ...prod,
        oldContrib,
        newContrib,
        costDiff,
        isFullyApplied,
      };
    });
  }, [impactData, currentProviderQuote]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-900 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          成本異動與影響評估
        </h2>
      </div>

      <div className="bg-blue-50/70 text-blue-900 text-sm p-5 md:p-6 rounded-3xl mb-8 border border-blue-200/60 shadow-sm">
        <p className="flex items-center gap-2 font-semibold mb-3 text-lg">
          <span className="text-xl">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-2 ml-2 text-slate-700 font-medium">
          <li>
            系統會精準拆解配方層級，根據 BOM
            當前所設定的「套用報價」或「自訂成本」計算真實成本。
          </li>
          <li>
            若進入 BOM
            編輯畫面套用新報價並儲存，返回此頁面後系統會自動重算，價差歸零代表已套用完畢。
          </li>
        </ul>
      </div>

      {/* 區塊 A：主動式預警清單 */}
      <div className="mb-10 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <AlertCircle
              className="text-rose-500"
              size={20}
              strokeWidth={2.5}
            />{" "}
            近期報價異動預警
          </h3>

          <div className="w-full md:w-[280px]">
            <SearchableSelect
              icon={Building}
              placeholder="過濾供應商..."
              value={
                activeAlertProvider === "全部供應商" ? "" : activeAlertProvider
              }
              options={providerOptions}
              onChange={(val) => setActiveAlertProvider(val)}
            />
          </div>
        </div>

        {isLoadingAlerts ? (
          <div className="py-16 text-center text-slate-400 font-bold animate-pulse">
            掃描全庫預警資料中...
          </div>
        ) : filteredAlerts.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredAlerts.map((item) => {
              const isSelected =
                selectedMaterial?.id === item.material_id &&
                activeAnalysisSource?.provider_name === item.provider_name;
              return (
                <div
                  key={`${item.material_id}-${item.provider_name}`}
                  onClick={() => {
                    setSelectedMaterial({
                      id: item.material_id,
                      name: item.material_name,
                      code: item.material_code,
                    });
                    // 手動點擊預警，非背景更新
                    runImpactAnalysis(item.material_id, item, false);
                  }}
                  className={`p-5 rounded-3xl border cursor-pointer shadow-sm flex flex-col justify-between transition-colors ${
                    isSelected
                      ? "bg-blue-50/30 border-[#007AFF] ring-2 ring-[#007AFF]/20"
                      : "bg-slate-50/50 border-slate-200 hover:border-[#007AFF]/50"
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="font-extrabold text-slate-900 text-lg mr-3 block mb-1">
                        {item.material_name}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-sm">
                        {item.material_code}
                      </span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1.5">
                      <Building size={12} className="text-slate-400" />
                      {item.provider_name}
                    </div>
                  </div>

                  <PriceComparisonWidget
                    oldPrice={item.old_price}
                    newPrice={item.new_price}
                    diffPercent={item.diff_percent}
                    effectiveDate={item.effective_date}
                  />

                  <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-200 text-xs font-bold mt-auto">
                    <span className="text-slate-600 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                      <Package size={14} className="text-[#007AFF]" />
                      波及配方：
                      <span className="text-slate-900 text-sm">
                        {item.affected_products_count}
                      </span>{" "}
                      項
                    </span>
                    <span className="text-slate-600 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                      <FileText size={14} className="text-rose-500" />
                      影響報價：
                      <span className="text-slate-900 text-sm">
                        {item.affected_quotations_count}
                      </span>{" "}
                      張
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400 text-sm font-bold flex flex-col items-center gap-3">
            <CheckCircle2
              size={40}
              className="text-emerald-400 opacity-50"
              strokeWidth={2}
            />{" "}
            目前無近期異動預警
          </div>
        )}
      </div>

      {/* 區塊 B：手動搜尋 */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 mb-8 relative z-20 flex flex-col md:flex-row items-start md:items-center gap-4 border-l-4 border-l-[#007AFF]">
        <label className="text-base font-black text-slate-800 tracking-wide flex items-center gap-2 shrink-0">
          <Search size={20} className="text-[#007AFF]" strokeWidth={3} />{" "}
          分析特定原料
        </label>

        <div className="w-full md:flex-1 max-w-lg">
          <SearchableSelect
            placeholder={
              isFetchingMaterials ? "載入物料中..." : "請輸入原料名稱或代碼..."
            }
            value={
              selectedMaterial
                ? `[${selectedMaterial.code}] ${selectedMaterial.name}`
                : ""
            }
            options={materialOptions}
            onChange={(mat) => {
              setSelectedMaterial({
                id: mat.id,
                name: mat.name,
                code: mat.code,
              });
              setActiveAnalysisSource(null);
              runImpactAnalysis(mat.id, null, false);
            }}
            renderItem={(opt) => (
              <div className="flex items-center gap-3">
                <span
                  className={`px-1.5 py-0.5 border text-[9px] font-bold rounded uppercase ${TYPE_MAP[opt.type]?.color || "bg-slate-50 text-slate-600 border-slate-200"}`}
                >
                  {TYPE_MAP[opt.type]?.label || opt.type}
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {opt.label}
                </span>
                <span className="text-[10px] text-slate-400 font-mono font-semibold ml-auto">
                  {opt.subLabel}
                </span>
              </div>
            )}
          />
        </div>
      </div>

      {/* 區塊 C：分析結果 */}
      {isAnalyzing ? (
        <div className="bg-white rounded-3xl p-16 border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center">
          <RefreshCw className="animate-spin text-[#007AFF] mb-4" size={32} />
          <h3 className="text-lg font-bold text-slate-800 mb-1">
            精算分析中...
          </h3>
        </div>
      ) : impactData ? (
        <div className="space-y-8 animate-in fade-in duration-300">
          {impactData.provider_quotes &&
            impactData.provider_quotes.length > 0 && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
                  {impactData.provider_quotes.map((quote, idx) => (
                    <button
                      key={quote.provider_id}
                      onClick={() => {
                        setActiveTabIdx(idx);
                        setActiveAnalysisSource({
                          provider_name: quote.provider_name,
                        });
                      }}
                      className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap border shadow-sm transition-colors ${
                        activeTabIdx === idx
                          ? "bg-slate-800 text-white border-slate-800"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {quote.provider_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {!currentProviderQuote && (
            <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-600">
                此物料無生效報價供分析
              </p>
            </div>
          )}

          {/* 🌟 1. 受影響配方產品 (改版為一排雙卡、等高、直式排列) */}
          {currentProviderQuote && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-50/80 border-b border-slate-200 px-6 py-4 flex items-center gap-2 shrink-0">
                <Package
                  size={18}
                  className="text-[#007AFF]"
                  strokeWidth={2.5}
                />
                <span className="font-black text-slate-800 text-base">
                  受影響配方產品清單
                </span>
                <span className="ml-2 text-[10px] font-black text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">
                  共 {affectedProductsList.length} 項
                </span>
                <span className="ml-auto text-[11px] font-bold text-slate-400">
                  以{" "}
                  <strong className="text-slate-700">
                    {currentProviderQuote.provider_name}
                  </strong>{" "}
                  的報價為計算基準
                </span>
              </div>

              <div className="p-6 md:p-8 flex-1 bg-slate-50/30">
                {affectedProductsList.length > 0 ? (
                  // 每排兩張卡片，自動伸展高度以對齊底部
                  <div className="grid grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto gap-6 items-stretch">
                    {affectedProductsList.map((prod) => (
                      <div
                        key={prod.id}
                        className={`bg-white border p-6 rounded-[24px] flex flex-col shadow-[0_4px_12px_rgba(0,0,0,0.03)] relative overflow-hidden transition-all h-full ${
                          prod.isFullyApplied
                            ? "border-emerald-300 ring-2 ring-emerald-500/10"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex justify-between items-start relative z-10 mb-6 pr-24 shrink-0">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 border text-[10px] font-bold rounded uppercase whitespace-nowrap ${TYPE_MAP[prod.type]?.color || "bg-slate-100 text-slate-500 border-slate-200"}`}
                              >
                                {TYPE_MAP[prod.type]?.label || prod.type}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-400">
                                {prod.code}
                              </span>
                            </div>
                            <span className="font-black text-slate-900 text-2xl leading-snug">
                              {prod.name}
                            </span>
                          </div>

                          <button
                            onClick={() =>
                              window.open(`/bom-create/${prod.code}`, "_blank")
                            }
                            className="absolute top-0 right-0 px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                            title="另開視窗編輯配方"
                          >
                            <Edit2 size={14} strokeWidth={2.5} /> 編輯配方
                          </button>
                        </div>

                        {/* Card Body (直式算式排版) */}
                        {prod.paths && prod.paths.length > 0 && (
                          <div className="bg-slate-50 border border-slate-200/80 rounded-[20px] p-6 flex flex-col shadow-inner mt-auto flex-grow h-full">
                            {/* 上半部：路徑成本 (Code / Name 疊加) */}
                            <div className="w-full flex flex-col gap-4 font-semibold text-[14px] text-slate-600 mb-8 flex-grow">
                              {prod.paths.map((path, i) => {
                                const costInfo = path.target_cost_info;
                                const pathOldCost =
                                  costInfo.current_cost * path.ratio;
                                const isPathApplied =
                                  costInfo.bound_quote_id ===
                                    currentProviderQuote.id &&
                                  !costInfo.is_expired;
                                const isExpired = costInfo.is_expired;
                                const isSetCost =
                                  costInfo.cost_type === "SET_COST";
                                const isNoData =
                                  costInfo.cost_type === "NO_DATA";

                                return (
                                  <div
                                    key={i}
                                    className="flex justify-between items-center gap-4 px-2 py-1.5"
                                  >
                                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-slate-400 font-mono text-[11px] font-bold">
                                          {path.step_code}
                                        </span>
                                        {path.is_direct ? (
                                          <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-200 shrink-0 font-bold">
                                            原料成本
                                          </span>
                                        ) : (
                                          <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-200 shrink-0 font-bold">
                                            半成品成本
                                          </span>
                                        )}
                                        {isPathApplied && (
                                          <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0 font-bold">
                                            已套用
                                          </span>
                                        )}
                                        {isExpired && (
                                          <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-200 shrink-0 font-bold">
                                            ⚠️ 報價過期
                                          </span>
                                        )}
                                        {isSetCost && !isPathApplied && (
                                          <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-200 shrink-0 font-bold">
                                            自訂成本
                                          </span>
                                        )}
                                        {isNoData && (
                                          <span className="text-[9px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-200 shrink-0 font-bold">
                                            無成本資料
                                          </span>
                                        )}
                                      </div>
                                      <span
                                        className="text-slate-700 text-[14px] font-bold truncate"
                                        title={path.text}
                                      >
                                        {path.step_name}
                                      </span>
                                    </div>
                                    <span className="font-mono text-[17px] font-black text-slate-700 shrink-0">
                                      ${formatDisplayNum(pathOldCost)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* 下半部：總計區 (固定於底部) */}
                            <div className="w-full flex flex-col mt-auto pt-2 shrink-0">
                              <div className="flex justify-between items-center px-2 mb-4">
                                <span className="text-slate-500 font-sans font-bold text-[15px]">
                                  配方總成本
                                </span>
                                <span className="font-mono text-[18px] font-black text-slate-700 tracking-tight">
                                  ${formatDisplayNum(prod.oldContrib)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center px-2 mb-6">
                                <span className="text-slate-800 font-sans font-black text-[15px]">
                                  {prod.isFullyApplied
                                    ? "最新預估成本"
                                    : "報價成本"}
                                </span>
                                <span
                                  className={`font-mono text-[24px] font-black tracking-tight leading-none ${
                                    prod.isFullyApplied
                                      ? "text-emerald-600"
                                      : "text-slate-900"
                                  }`}
                                >
                                  ${formatDisplayNum(prod.newContrib)}
                                </span>
                              </div>

                              {/* 分隔線與成本變化 */}
                              <div className="w-full border-t-2 border-slate-200 pt-5 px-2 flex justify-between items-center">
                                <span className="text-slate-800 font-sans font-black text-[16px] mb-1">
                                  成本變化
                                </span>
                                {prod.isFullyApplied ? (
                                  <span className="text-[16px] font-black text-emerald-500 flex items-center gap-1.5 mb-1">
                                    <CheckCircle2 size={18} />
                                    <DiffTextLarge value={0} />
                                  </span>
                                ) : (
                                  <DiffTextLarge value={prod.costDiff} />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 font-medium text-sm">
                    此原料未套用於任何配方中
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. 關聯客戶報價單 */}
          {currentProviderQuote && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50/80 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
                <FileText
                  size={18}
                  className="text-[#007AFF]"
                  strokeWidth={2.5}
                />
                <span className="font-black text-slate-800 text-base">
                  關聯客戶報價單 (影響追溯)
                </span>
                <span className="ml-2 text-[10px] font-black text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">
                  共 {impactData.affected_quotations?.length || 0} 單
                </span>
                <span className="ml-auto text-[11px] font-bold text-slate-400">
                  以{" "}
                  <strong className="text-slate-700">
                    {currentProviderQuote.provider_name}
                  </strong>{" "}
                  的報價為計算基準
                </span>
              </div>

              <div className="p-6 md:p-8">
                {impactData.affected_quotations &&
                impactData.affected_quotations.length > 0 ? (
                  <div className="space-y-6">
                    {impactData.affected_quotations.map((quote) => (
                      <div
                        key={quote.quotation_id}
                        className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col relative"
                      >
                        <div className="bg-slate-50/70 p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center pr-4 gap-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-white text-slate-700 p-2 rounded-xl border border-slate-200 shadow-sm">
                              <Building size={18} />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-black text-slate-900 text-[15px]">
                                {quote.customer_name}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                單號：{quote.quotation_number}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                              開立日：{quote.date}
                            </span>
                            <button
                              onClick={() =>
                                window.open(
                                  `/quotation/${quote.quotation_id}`,
                                  "_blank",
                                )
                              }
                              className="px-3 py-1.5 bg-white text-[#007AFF] border border-slate-200 rounded-lg hover:bg-blue-50 transition-all text-[10px] font-black flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                            >
                              <Edit2 size={12} strokeWidth={2.5} /> 編輯報價單
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left table-fixed border-collapse">
                            <thead className="bg-slate-50/30 border-b border-slate-100 text-[10px] font-black text-slate-800 uppercase tracking-widest">
                              <tr>
                                <th className="py-3 px-5 w-28">產品代碼</th>
                                <th className="py-3 px-5">受影響合約品項</th>
                                <th className="py-3 px-5 text-center w-28">
                                  報價常數
                                  <br />
                                </th>
                                <th className="py-3 px-5 text-right w-36 border-l border-slate-100">
                                  原總成本
                                  <br />
                                  <span className="text-[9px] font-semibold tracking-normal text-slate-500">
                                    (元/KG)
                                  </span>
                                </th>
                                <th className="py-3 px-5 text-right w-36">
                                  預估成本
                                  <br />
                                  <span className="text-[9px] font-semibold tracking-normal text-slate-500">
                                    (元/KG)
                                  </span>
                                </th>
                                <th className="py-3 px-5 text-right w-40 bg-slate-50/50">
                                  成本調幅
                                  <br />
                                  <span className="text-[9px] font-semibold tracking-normal text-slate-500">
                                    (建議報價)
                                  </span>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[13px]">
                              {quote.affected_items.map((item, idx) => {
                                const productInfo =
                                  impactData.affected_products.find(
                                    (p) => p.id === item.product_id,
                                  );
                                const oldContrib = productInfo
                                  ? productInfo.paths.reduce(
                                      (s, p) =>
                                        s +
                                        p.target_cost_info.current_cost *
                                          p.ratio,
                                      0,
                                    )
                                  : 0;
                                const newContrib =
                                  currentProviderQuote.new_price *
                                  item.accumulated_ratio;
                                const costDiff = newContrib - oldContrib;
                                const quoteAdjustment =
                                  costDiff * item.pricing_multiplier;
                                const isApplied = Math.abs(costDiff) < 0.001;

                                return (
                                  <tr
                                    key={idx}
                                    className="hover:bg-slate-50/50 transition-colors"
                                  >
                                    <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-500 truncate">
                                      {item.product_code}
                                    </td>
                                    <td className="py-3.5 px-5 font-bold text-slate-800 truncate">
                                      {item.product_name}
                                    </td>
                                    <td className="py-3.5 px-5 text-center font-mono font-black text-slate-600">
                                      {formatDisplayNum(
                                        item.pricing_multiplier,
                                      )}
                                    </td>
                                    <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-500 border-l border-slate-100">
                                      ${formatDisplayNum(oldContrib)}
                                    </td>
                                    <td className="py-3.5 px-5 text-right font-mono font-black text-slate-800">
                                      ${formatDisplayNum(newContrib)}
                                    </td>
                                    <td className="py-3.5 px-5 text-right bg-slate-50/50">
                                      {isApplied ? (
                                        <span className="text-emerald-500 text-[11px] font-bold">
                                          ✅ 已無價差
                                        </span>
                                      ) : Math.abs(quoteAdjustment) > 0.001 ? (
                                        <DiffBadge value={quoteAdjustment} />
                                      ) : (
                                        <span className="text-slate-300 font-bold">
                                          -
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center text-slate-400 font-medium text-sm">
                    此產品尚無關聯的有效報價單
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <CustomDialog isOpen={dialog.isOpen} {...dialog} onClose={closeDialog} />
    </div>
  );
}

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
  Calculator,
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
  if (num > 0) return `+ $ ${num.toFixed(2)}`;
  if (num < 0) return `- $ ${Math.abs(num).toFixed(2)}`;
  return `$ 0.00`;
};

const TYPE_MAP = {
  RAW: {
    label: "原物料",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SEMI: { label: "半成品", color: "bg-blue-50 text-blue-700 border-blue-200" },
  PRODUCT: {
    label: "成品",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  PACK: { label: "包材", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

// 🌟 通用的 Searchable Dropdown 元件 (用於供應商與原料搜尋)
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
          className="absolute top-full left-0 w-full mt-2 z-[99] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col max-h-[320px] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
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
  const isUp = newPrice > oldPrice;
  const isDown = newPrice < oldPrice;

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

  // 用來在畫面上追蹤「當前」是由哪一筆 alert 觸發的分析（解決不同廠商報價的問題）
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

  useEffect(() => {
    fetchMaterials();
    fetchActiveAlerts();
  }, []);

  const fetchMaterials = async () => {
    setIsFetchingMaterials(true);
    try {
      const response = await fetchWithAuth("/api/materials");
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

  const fetchActiveAlerts = async () => {
    setIsLoadingAlerts(true);
    try {
      const response = await fetchWithAuth("/api/materials/active_alerts");
      if (response.ok) {
        const json = await response.json();
        setAlerts(json.data || json.alerts || json || []);
      }
    } catch (error) {
      console.error("載入預警失敗:", error);
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  // 🌟 供應商下拉選單選項
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

  // 🌟 物料搜尋下拉選單選項
  const materialOptions = useMemo(() => {
    return materials.map((m) => ({
      label: m.name,
      subLabel: m.code,
      value: m,
      type: m.type,
    }));
  }, [materials]);

  const runImpactAnalysis = async (materialId, sourceItem = null) => {
    setIsAnalyzing(true);
    setImpactData(null);
    setActiveAnalysisSource(sourceItem); // 紀錄當下是由哪張卡片(哪家廠商)點擊進來的
    try {
      const res = await fetchWithAuth(
        `/api/materials/${materialId}/impact_analysis`,
      );
      if (!res.ok) throw new Error("無法取得影響資料");
      const json = await res.json();
      setImpactData(json.data || json);
    } catch (error) {
      showAlert("分析失敗", "無法取得此物料的評估資料，請稍後再試。", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 🌟 智慧判斷當前要分析的報價：如果有來源，直接抓，否則預設抓最低價
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
      if (matchedQuote) return matchedQuote;
    }

    return impactData.provider_quotes[0];
  }, [impactData, activeAnalysisSource]);

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
          <li>系統主動比對「歷史採購平均」與「系統報價」計算成本差異。</li>
          <li>
            下方圖表專注於顯示該原料的獨立貢獻成本，將繁複的 BOM
            計算化為直觀的會計算式。
          </li>
        </ul>
      </div>

      {/* 🌟 區塊 A：主動式預警清單 */}
      <div className="mb-10 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <AlertCircle
              className="text-rose-500"
              size={20}
              strokeWidth={2.5}
            />
            近期報價異動預警
          </h3>

          {/* 🌟 頂部搜尋化：供應商過濾 Dropdown */}
          <div className="w-full md:w-[280px]">
            <SearchableSelect
              icon={Building}
              placeholder="過濾供應商..."
              value={
                activeAlertProvider === "全部供應商" ? "" : activeAlertProvider
              }
              options={providerOptions}
              onChange={(val) => setActiveAlertProvider(val)} // 🌟 修復 ReferenceError
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
                    runImpactAnalysis(item.material_id, item);
                  }}
                  className={`p-5 rounded-3xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
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

                  <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-200 text-xs font-bold">
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
            />
            目前無近期異動預警
          </div>
        )}
      </div>

      {/* 🌟 區塊 B：手動搜尋 (Searchable Dropdown 升級版) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 mb-8 relative z-20 flex flex-col md:flex-row items-start md:items-center gap-4 border-l-4 border-l-[#007AFF]">
        <label className="text-base font-black text-slate-800 tracking-wide flex items-center gap-2 shrink-0">
          <Search size={20} className="text-[#007AFF]" strokeWidth={3} />{" "}
          強制分析特定原料
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
              runImpactAnalysis(mat.id, null);
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

      {/* 🌟 區塊 C：分析結果 */}
      {isAnalyzing ? (
        <div className="bg-white rounded-3xl p-16 border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center">
          <RefreshCw className="animate-spin text-[#007AFF] mb-4" size={32} />
          <h3 className="text-lg font-bold text-slate-800 mb-1">
            精算分析中...
          </h3>
        </div>
      ) : impactData ? (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* 如果沒有供應商報價，顯示提示 */}
          {!currentProviderQuote && (
            <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-600">
                此物料無生效報價供分析
              </p>
            </div>
          )}

          {/* 🌟 1. 受影響配方產品 (小學直式算式) */}
          {currentProviderQuote && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50/80 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
                <Package
                  size={18}
                  className="text-[#007AFF]"
                  strokeWidth={2.5}
                />
                <span className="font-black text-slate-800 text-base">
                  受影響配方產品清單
                </span>
                <span className="ml-2 text-[10px] font-black text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">
                  共 {impactData.affected_products?.length || 0} 項
                </span>
                <span className="ml-auto text-[11px] font-bold text-slate-400">
                  以{" "}
                  <strong className="text-slate-700">
                    {currentProviderQuote.provider_name}
                  </strong>{" "}
                  的報價為計算基準
                </span>
              </div>

              <div className="p-6 md:p-8 bg-slate-50/30">
                {impactData.affected_products &&
                impactData.affected_products.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {impactData.affected_products.map((prod) => {
                      const oldContrib =
                        impactData.material_base_cost * prod.accumulated_ratio;
                      const newContrib =
                        currentProviderQuote.new_price * prod.accumulated_ratio;
                      const costDiff =
                        currentProviderQuote.price_diff *
                        prod.accumulated_ratio;

                      const isUp = costDiff > 0;
                      const isDown = costDiff < 0;

                      return (
                        <div
                          key={prod.id}
                          className="bg-white border border-slate-200 p-5 rounded-[24px] flex flex-col shadow-[0_2px_8px_rgba(0,0,0,0.04)] relative transition-all hover:shadow-md hover:border-slate-300"
                        >
                          <button
                            onClick={() =>
                              window.open(`/bom-create/${prod.code}`, "_blank")
                            }
                            className="absolute top-5 right-5 px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all duration-200 text-[10px] font-black flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                            title="另開視窗編輯配方"
                          >
                            <Edit2 size={12} strokeWidth={2.5} /> 修改配方
                          </button>

                          <div className="flex flex-col gap-1.5 mb-5 pr-24">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 border text-[9px] font-bold rounded uppercase whitespace-nowrap ${TYPE_MAP[prod.type]?.color || "bg-slate-100 text-slate-500 border-slate-200"}`}
                              >
                                {TYPE_MAP[prod.type]?.label || prod.type}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                {prod.code}
                              </span>
                            </div>
                            <span className="font-black text-slate-800 text-[17px] leading-snug">
                              {prod.name}
                            </span>
                          </div>

                          {/* 🌟 核心：直式算式引擎 */}
                          {prod.paths && prod.paths.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col shadow-inner mt-auto">
                              <div className="w-full flex flex-col font-mono text-sm gap-2">
                                {/* 貢獻來源拆解 */}
                                {prod.paths.map((path, i) => {
                                  const pathOldCost =
                                    impactData.material_base_cost * path.ratio;
                                  return (
                                    <div
                                      key={i}
                                      className="flex justify-between items-center gap-4 px-2"
                                    >
                                      <span
                                        className="text-slate-500 text-[11px] font-sans truncate"
                                        title={path.text}
                                      >
                                        {path.short_text || `路徑 ${i + 1}`}
                                      </span>
                                      <span className="text-slate-600 font-semibold">
                                        ${formatDisplayNum(pathOldCost)}
                                      </span>
                                    </div>
                                  );
                                })}

                                {/* 原本總額 */}
                                <div className="flex justify-between items-center px-2 mt-1">
                                  <span className="text-slate-500 text-[11px] font-sans font-bold">
                                    歷史均價總貢獻
                                  </span>
                                  <span className="text-slate-700 font-bold">
                                    ${formatDisplayNum(oldContrib)}
                                  </span>
                                </div>

                                {/* 漲跌額外加上 */}
                                <div
                                  className={`flex justify-between items-center px-2 ${isUp ? "text-rose-500" : isDown ? "text-emerald-500" : "text-slate-400"}`}
                                >
                                  <span className="text-[11px] font-sans font-bold flex items-center gap-1">
                                    {isUp
                                      ? "加: 報價調漲"
                                      : isDown
                                        ? "減: 報價調降"
                                        : "報價持平"}
                                  </span>
                                  <span className="font-bold flex items-center gap-1">
                                    {costDiff !== 0 ? (isUp ? "+" : "-") : ""} $
                                    {formatDisplayNum(Math.abs(costDiff))}
                                  </span>
                                </div>

                                {/* 加總分隔線 */}
                                <div className="w-full border-t border-slate-300 mt-1 mb-1"></div>

                                {/* 最終結果 */}
                                <div className="flex justify-between items-end px-2">
                                  <span className="text-slate-800 text-xs font-sans font-black mb-0.5">
                                    預估新貢獻成本
                                  </span>
                                  <span
                                    className={`text-[22px] font-black tracking-tight leading-none ${isUp ? "text-rose-600" : isDown ? "text-emerald-600" : "text-slate-800"}`}
                                  >
                                    ${formatDisplayNum(newContrib)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 font-medium text-sm">
                    此原料未套用於任何配方中
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. 關聯客戶報價單 (商業決策報表) */}
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
                              <Edit2 size={12} strokeWidth={2.5} /> 審視報價單
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left table-fixed border-collapse">
                            <thead className="bg-slate-50/30 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              <tr>
                                <th className="py-3 px-5 w-28">產品代碼</th>
                                <th className="py-3 px-5">受影響合約品項</th>
                                <th className="py-3 px-5 text-center w-28">
                                  報價常數
                                  <br />
                                  <span className="text-[9px] font-semibold tracking-normal text-slate-300">
                                    (客戶級別)
                                  </span>
                                </th>
                                <th className="py-3 px-5 text-right w-36 border-l border-slate-100">
                                  原原料成本貢獻
                                  <br />
                                  <span className="text-[9px] font-semibold tracking-normal text-slate-300">
                                    (元/KG)
                                  </span>
                                </th>
                                <th className="py-3 px-5 text-right w-36">
                                  新原料成本貢獻
                                  <br />
                                  <span className="text-[9px] font-semibold tracking-normal text-slate-300">
                                    (元/KG)
                                  </span>
                                </th>
                                <th className="py-3 px-5 text-right w-40 bg-slate-50/50">
                                  理論報價調幅
                                  <br />
                                  <span className="text-[9px] font-semibold tracking-normal text-slate-300">
                                    (建議調漲額)
                                  </span>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[13px]">
                              {quote.affected_items.map((item, idx) => {
                                const oldContrib =
                                  impactData.material_base_cost *
                                  item.accumulated_ratio;
                                const newContrib =
                                  currentProviderQuote.new_price *
                                  item.accumulated_ratio;
                                const costDiff =
                                  currentProviderQuote.price_diff *
                                  item.accumulated_ratio;
                                const quoteAdjustment =
                                  costDiff * item.pricing_multiplier;

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
                                      {quoteAdjustment !== 0 ? (
                                        <span
                                          className={`font-mono font-bold text-[13px] ${quoteAdjustment > 0 ? "text-rose-600" : "text-emerald-600"}`}
                                        >
                                          {formatDiffCurrency(quoteAdjustment)}
                                        </span>
                                      ) : (
                                        <span className="text-slate-300">
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

import React, { useState, useEffect, useRef, useMemo } from "react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { Printer, FileText, Search, ChevronDown } from "lucide-react";

// ==========================================
// 列印專用 Template (完美致敬 Excel 格式)
// ==========================================
const RecallReportPrintTemplate = ({
  reportData,
  formData,
  recoveryRate,
  className = "",
}) => {
  if (!reportData) return null;

  return (
    <div
      className={`w-full bg-white text-black font-sans mx-auto ${className}`}
    >
      <style>
        {`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}
      </style>

      <div className="border-2 border-green-600 p-1">
        {/* 表頭 Logo & Title */}
        <table className="w-full border-collapse border-2 border-black text-center mb-2">
          <tbody>
            <tr>
              <td className="border-2 border-black w-32 h-20 align-middle">
                <div className="text-red-600 font-black text-5xl italic font-serif">
                  G
                </div>
              </td>
              <td className="border-2 border-black align-middle">
                <div className="text-2xl font-bold tracking-widest border-b-2 border-black py-1">
                  基香食品有限公司
                </div>
                <div className="text-2xl font-bold tracking-widest py-1">
                  產品回收計畫書
                </div>
              </td>
              <td className="border-2 border-black w-32 align-top text-left text-sm font-bold p-1">
                <div className="border-b border-black pb-1 mb-1">版次： 04</div>
                <div>頁次：</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 區塊一：責任廠商基本資訊 */}
        <div className="font-bold text-[#1f4e78] text-sm mb-0.5 mt-4">
          【責任廠商基本資訊】
        </div>
        <table className="w-full border-collapse border-2 border-black text-sm mb-4">
          <thead>
            <tr className="bg-[#1f4e78] text-white">
              <th className="border border-black px-2 py-1.5 w-40 font-bold">
                項目
              </th>
              <th className="border border-black px-2 py-1.5 font-bold text-left">
                填寫內容
              </th>
            </tr>
          </thead>
          <tbody className="font-bold text-slate-800 text-left">
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                責任廠商名稱
              </td>
              <td className="border border-black px-2 py-1.5">
                基香食品有限公司
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                責任廠商地址
              </td>
              <td className="border border-black px-2 py-1.5">
                桃園市觀音區崙坪里一鄰1-10號
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                責任廠商電話
              </td>
              <td className="border border-black px-2 py-1.5">03-4988228</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                預定完成回收期限
              </td>
              <td className="border border-black px-2 py-1.5 text-slate-500 font-normal">
                {formData.deadline || ""}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                回收保管地點
              </td>
              <td className="border border-black px-2 py-1.5">
                桃園市觀音區崙坪里一鄰1-10號
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                負責保管之人員
              </td>
              <td className="border border-black px-2 py-1.5">余家旺</td>
            </tr>
            {[...Array(6)].map((_, i) => (
              <tr key={i} className="h-7">
                <td className="border border-black bg-slate-100"></td>
                <td className="border border-black"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 區塊二：回收進度統計看板 */}
        <div className="font-bold text-[#1f4e78] text-sm mb-0.5">
          【回收進度統計看板】
        </div>
        <table className="w-full border-collapse border-2 border-black text-sm text-left">
          <thead>
            <tr className="bg-[#1f4e78] text-white">
              <th className="border border-black px-2 py-1.5 w-40 font-bold">
                關鍵指標 (Kg)
              </th>
              <th className="border border-black px-2 py-1.5 font-bold w-48 text-center">
                當前數值
              </th>
              <th className="border border-black px-2 py-1.5 font-bold">
                計算公式 / 來源說明
              </th>
            </tr>
          </thead>
          <tbody className="font-bold text-slate-800">
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                回收原料總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-mono">
                {(
                  parseFloat(reportData.used_raw_total) +
                  parseFloat(reportData.unused_raw_total)
                ).toFixed(5)}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                異常原料進貨總量(kg)
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                尚未使用原料總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-mono">
                {parseFloat(reportData.unused_raw_total).toFixed(5)}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                異常原料在庫總量(kg)
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                產品生產總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-mono">
                {parseFloat(reportData.total_produced_product).toFixed(5)}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                各品項產品之總量(kg)
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                尚未出貨產品總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-mono">
                {parseFloat(reportData.total_in_stock_product).toFixed(5)}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                各品項在庫總量(kg)
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                下游總出貨總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center text-red-600 font-mono">
                {parseFloat(reportData.total_shipped_product).toFixed(5)}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                已出貨至下游廠商之總量
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                實際回收總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-mono">
                {formData.actualRecovered
                  ? parseFloat(formData.actualRecovered).toFixed(5)
                  : ""}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                各品項實際收回之重量/容量
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                整體回收率 (%)
              </td>
              <td className="border border-black px-2 py-1.5 text-center text-red-600 font-mono">
                {recoveryRate !== null ? `${recoveryRate.toFixed(2)}%` : ""}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                (產品實際回收總量+庫存) / 總生產量
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100 align-top">
                最終處置方式
              </td>
              <td
                className="border border-black px-2 py-1.5 align-top"
                colSpan={2}
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-3 h-3 border border-black mt-1 bg-white flex items-center justify-center shrink-0">
                    {formData.disposalMethod === "MEASURE" && "✓"}
                  </div>
                  <span className="text-sm font-normal">
                    採行消毒、改製或其他適當安全措施者，應載明所採用之措施方法與實施程序，及預定完成日期。
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-3 h-3 border border-black mt-1 bg-white flex items-center justify-center shrink-0">
                    {formData.disposalMethod === "DESTROY" && "✓"}
                  </div>
                  <span className="text-sm font-normal">
                    銷毀者，應載明銷毀之方式與期限，及銷毀產品之重量或容量。
                  </span>
                </div>
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                待銷毀產品總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-mono">
                {formData.destroyAmount
                  ? parseFloat(formData.destroyAmount).toFixed(5)
                  : ""}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                最終處置方式為「銷毀」之重量
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==========================================
// 主頁面 Component
// ==========================================
const TracePage = () => {
  const [materials, setMaterials] = useState([]);
  const [traceResults, setTraceResults] = useState([]);
  const [reportData, setReportData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [expandedBatches, setExpandedBatches] = useState({});

  const [formData, setFormData] = useState({
    deadline: "",
    actualRecovered: "",
    disposalMethod: "",
    destroyAmount: "",
  });

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
    onConfirm: null,
  });
  const showAlert = (title, message, status = "info") =>
    setDialog({
      isOpen: true,
      type: "alert",
      status,
      title,
      message,
      onConfirm: null,
    });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await fetchWithAuth("/api/materials");
        if (res.ok) {
          const json = await res.json();
          setMaterials(json.data || []);
        }
      } catch (err) {
        console.error("無法取得物料清單", err);
      }
    };
    fetchMaterials();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredMaterials = useMemo(() => {
    if (!searchTerm) return materials;
    const lowerTerm = searchTerm.toLowerCase();
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerTerm) ||
        m.code.toLowerCase().includes(lowerTerm),
    );
  }, [materials, searchTerm]);

  const toggleExpand = (batchId) => {
    setExpandedBatches((prev) => ({ ...prev, [batchId]: !prev[batchId] }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!selectedMaterial)
      return showAlert(
        "查詢條件為空",
        "請先從下拉選單中選擇要追溯的物料。",
        "warning",
      );

    setLoading(true);
    setError(null);
    setExpandedBatches({});
    setReportData(null);
    setTraceResults([]);

    try {
      const reportUrl = `/api/abnormality_trace/recall_report?material_id=${selectedMaterial.id}`;
      const reportRes = await fetchWithAuth(reportUrl, { method: "GET" });

      if (!reportRes.ok) throw new Error("無法取得異常追溯指標資料");
      const reportJson = await reportRes.json();
      setReportData(reportJson.data);

      const detailUrl = `/api/batches/trace?q=${encodeURIComponent(selectedMaterial.code)}`;
      const detailRes = await fetchWithAuth(detailUrl, { method: "GET" });
      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        const dataList = detailJson.data || [];
        setTraceResults(dataList);
        if (dataList.length === 1)
          setExpandedBatches({ [dataList[0].batch_id]: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedMaterial(null);
    setSearchTerm("");
    setReportData(null);
    setTraceResults([]);
    setError(null);
    setExpandedBatches({});
    setFormData({
      deadline: "",
      actualRecovered: "",
      disposalMethod: "",
      destroyAmount: "",
    });
  };

  const handlePrintAction = () => {
    setTimeout(() => {
      const originalTitle = document.title;
      // 這裡如果希望列印的檔名乾淨，保留這個設定即可
      document.title = `產品回收計畫書_${selectedMaterial?.name || ""}`;
      window.print();
      document.title = originalTitle;
    }, 150);
  };

  const recoveryRate = useMemo(() => {
    if (!reportData) return null;
    if (
      formData.actualRecovered === "" ||
      isNaN(parseFloat(formData.actualRecovered))
    )
      return null;

    const totalProduced = parseFloat(reportData.total_produced_product) || 0;
    const inStock = parseFloat(reportData.total_in_stock_product) || 0;
    const actualRec = parseFloat(formData.actualRecovered) || 0;

    if (totalProduced <= 0) return 0;
    return ((actualRec + inStock) / totalProduced) * 100;
  }, [reportData, formData.actualRecovered]);

  return (
    <>
      <div className="p-6 md:p-8 max-w-7xl mx-auto bg-blue-50/20 min-h-screen font-sans relative text-slate-900 print:hidden">
        {/* 標題區 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-4 border-slate-200 pb-4">
          <h2 className="text-3xl font-black text-black tracking-tight flex items-center gap-2">
            追蹤追溯
          </h2>
        </div>

        {/* 系統功能說明區塊 */}
        <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg mb-6 border border-blue-100">
          <p className="flex items-center gap-2 font-medium mb-1">
            <span className="text-lg">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
            <li>
              條列系統中所有原物料的<strong>批號、庫存</strong>狀態。
            </li>
            <li>
              支援以批號代碼、物料名稱進行<strong>搜尋資料</strong>
              ，產出回收計畫書核心指標。
            </li>
          </ul>
        </div>

        {/* 搜尋操作區 */}
        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row gap-3 w-full items-center p-4 bg-white rounded-xl shadow-md border border-blue-100 mb-6"
        >
          <div className="relative w-full sm:flex-1" ref={dropdownRef}>
            <div
              className={`flex items-center justify-between w-full border ${
                isDropdownOpen
                  ? "border-blue-500 ring-2 ring-blue-100"
                  : "border-blue-200"
              } rounded-md px-4 py-2.5 cursor-pointer bg-blue-50/10 hover:bg-white transition-all`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Search size={16} className="text-slate-400 flex-shrink-0" />
                <span
                  className={`truncate text-sm font-mono ${selectedMaterial ? "text-slate-800" : "text-slate-400"}`}
                >
                  {selectedMaterial
                    ? `[${selectedMaterial.code}] ${selectedMaterial.name}`
                    : "點擊選擇原物料或輸入關鍵字搜尋..."}
                </span>
              </div>
              <ChevronDown
                size={18}
                className="text-slate-400 flex-shrink-0 ml-2"
              />
            </div>

            {isDropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden flex flex-col">
                <div className="p-2 border-b border-slate-100 bg-slate-50">
                  <input
                    type="text"
                    autoFocus
                    placeholder="輸入關鍵字..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                  {filteredMaterials.length > 0 ? (
                    filteredMaterials.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedMaterial(m);
                          setIsDropdownOpen(false);
                          setSearchTerm("");
                        }}
                        className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                      >
                        <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">
                          {m.code}
                        </span>
                        <span className="truncate text-slate-700">
                          {m.name}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-slate-400 text-sm">
                      無相符資料
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="submit"
              disabled={loading || !selectedMaterial}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md shadow-sm transition-colors text-sm font-bold whitespace-nowrap flex-1 sm:flex-none disabled:opacity-50"
            >
              {loading ? "追溯中..." : "搜尋"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium whitespace-nowrap"
            >
              清除
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 mb-6 text-red-900 bg-red-50 rounded-lg border border-red-200 font-bold">
            ⚠️ 提示：{error}
          </div>
        )}

        {/* 1. 指標內容 */}
        {reportData && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              1. 指標內容
            </h3>
            <div className="bg-white border-2 border-blue-100 rounded-xl shadow-sm overflow-hidden relative">
              <div className="overflow-x-auto pb-16">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#1f4e78] text-white">
                      <th className="px-4 py-2.5 font-bold w-48 border border-slate-300">
                        關鍵指標 (Kg)
                      </th>
                      <th className="px-4 py-2.5 font-bold w-48 text-center border border-slate-300">
                        當前數值
                      </th>
                      <th className="px-4 py-2.5 font-bold border border-slate-300">
                        計算公式 / 來源說明
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-bold text-slate-800">
                    <tr>
                      <td className="border border-slate-300 px-4 py-2.5 bg-slate-50">
                        回收原料總量
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-center font-mono">
                        {parseFloat(reportData.total_raw_recalled).toFixed(5)}
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-xs font-normal">
                        異常原料進貨總量(kg)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-4 py-2.5 bg-slate-50">
                        尚未使用原料總量
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-center font-mono">
                        {parseFloat(reportData.unused_raw_total).toFixed(5)}
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-xs font-normal">
                        異常原料在庫總量(kg)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-4 py-2.5 bg-slate-50">
                        產品生產總量
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-center font-mono">
                        {parseFloat(reportData.total_produced_product).toFixed(
                          4,
                        )}
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-xs font-normal">
                        各品項產品之總量(kg)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-4 py-2.5 bg-slate-50">
                        尚未出貨產品總量
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-center font-mono">
                        {parseFloat(reportData.total_in_stock_product).toFixed(
                          4,
                        )}
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-xs font-normal">
                        各品項在庫總量(kg)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-4 py-2.5 bg-slate-50">
                        下游總出貨總量
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-center text-red-600 font-mono">
                        {parseFloat(reportData.total_shipped_product).toFixed(
                          4,
                        )}
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-xs font-normal">
                        已出貨至下游廠商之總量
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-4 py-2.5 bg-slate-50">
                        實際回收總量
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="輸入數量"
                          value={formData.actualRecovered}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              actualRecovered: e.target.value,
                            })
                          }
                          className="w-full max-w-[120px] px-2 py-1 border border-slate-300 rounded font-mono text-sm text-center focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-xs font-normal">
                        各品項實際收回之重量/容量
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-4 py-2.5 bg-slate-50">
                        整體回收率 (%)
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-center text-red-600 font-mono">
                        {recoveryRate !== null
                          ? `${recoveryRate.toFixed(2)}%`
                          : ""}
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-xs font-normal">
                        (產品實際回收總量+庫存) / 總生產量
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-4 py-2.5 bg-slate-50 align-top">
                        最終處置方式
                      </td>
                      <td
                        className="border border-slate-300 px-4 py-2.5 align-top"
                        colSpan={2}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <input
                            type="radio"
                            name="disposal"
                            value="MEASURE"
                            checked={formData.disposalMethod === "MEASURE"}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                disposalMethod: e.target.value,
                              })
                            }
                            className="mt-1 cursor-pointer"
                          />
                          <span
                            className="text-sm font-normal cursor-pointer"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                disposalMethod: "MEASURE",
                              })
                            }
                          >
                            採行消毒、改製或其他適當安全措施者，應載明所採用之措施方法與實施程序，及預定完成日期。
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="disposal"
                            value="DESTROY"
                            checked={formData.disposalMethod === "DESTROY"}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                disposalMethod: e.target.value,
                              })
                            }
                            className="mt-1 cursor-pointer"
                          />
                          <span
                            className="text-sm font-normal cursor-pointer"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                disposalMethod: "DESTROY",
                              })
                            }
                          >
                            銷毀者，應載明銷毀之方式與期限，及銷毀產品之重量或容量。
                          </span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-4 py-2.5 bg-slate-50">
                        待銷毀產品總量
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="輸入數量"
                          disabled={formData.disposalMethod !== "DESTROY"}
                          value={formData.destroyAmount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              destroyAmount: e.target.value,
                            })
                          }
                          className="w-full max-w-[120px] px-2 py-1 border border-slate-300 rounded font-mono text-sm text-center focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
                        />
                      </td>
                      <td className="border border-slate-300 px-4 py-2.5 text-xs font-normal">
                        最終處置方式為「銷毀」之重量
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 預覽按鈕固定於右下角 */}
              <div className="absolute bottom-4 right-4">
                <button
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="px-6 py-2.5 bg-[#1f4e78] hover:bg-blue-900 text-white rounded-lg shadow-md transition-all text-sm font-bold flex items-center gap-2 hover:scale-105"
                >
                  <FileText size={16} /> 預覽與列印計畫書
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. 受影響生產單明細 */}
        {reportData && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              2. 受影響生產單明細
            </h3>
            <div className="bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden min-h-[300px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-blue-50/50 border-b border-blue-100 text-sm text-blue-950">
                      <th className="p-4 whitespace-nowrap">庫存批號</th>
                      <th className="p-4 whitespace-nowrap">物料品號</th>
                      <th className="p-4 whitespace-nowrap">物料名稱</th>
                      <th className="p-4 whitespace-nowrap">剩餘庫存</th>
                      <th className="p-4 whitespace-nowrap">入庫日期</th>
                      <th className="p-4 whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50 text-sm">
                    {loading ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="p-12 text-center text-blue-600"
                        >
                          <div className="text-lg font-bold animate-pulse">
                            追溯中...
                          </div>
                        </td>
                      </tr>
                    ) : traceResults.length > 0 ? (
                      traceResults.map((batch) => {
                        const isExpanded = !!expandedBatches[batch.batch_id];
                        const ordersList = batch.trace_details?.orders || [];
                        const mrpsList = batch.trace_details?.mrps || [];

                        return (
                          <React.Fragment key={batch.batch_id}>
                            <tr
                              className={`transition-colors ${isExpanded ? "bg-blue-50/60" : "hover:bg-blue-50/20"}`}
                            >
                              <td className="p-4 font-mono text-sm text-black">
                                {batch.batch_number}
                              </td>
                              <td className="p-4 font-mono text-sm text-black">
                                {batch.material_code}
                              </td>
                              <td className="p-4 text-black font-sm">
                                {batch.material_name}
                              </td>
                              <td className="p-4 font-mono text-sm text-black">
                                {batch.remaining_qty}
                              </td>
                              <td className="p-4 font-mono text-sm text-black">
                                {batch.received_date}
                              </td>
                              <td className="p-4 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(batch.batch_id)}
                                  className={`px-4 py-1.5 text-xs rounded-md border transition-all shadow-sm ${
                                    isExpanded
                                      ? "bg-blue-600 text-white border-blue-600"
                                      : "bg-white text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white"
                                  }`}
                                >
                                  {isExpanded
                                    ? "收起"
                                    : `展開 (${ordersList.length + mrpsList.length})`}
                                </button>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr>
                                <td
                                  colSpan="7"
                                  className="bg-indigo-50/30 p-6 border-b border-t border-blue-100"
                                >
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                                    {/* 欄位一 */}
                                    <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex flex-col h-full">
                                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                                        1. 現存庫存
                                      </div>
                                      <div className="text-base font-black text-black mb-2">
                                        {batch.material_name}
                                      </div>
                                      <div className="space-y-1.5 text-xs font-mono text-slate-700 bg-blue-50/30 p-3 rounded-lg border border-blue-100 flex-1">
                                        <div>批號: {batch.batch_number}</div>
                                        <div>
                                          入庫日期: {batch.received_date}
                                        </div>
                                      </div>
                                    </div>
                                    {/* 欄位二 */}
                                    <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex flex-col h-full">
                                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                                        2. 生產單 ({ordersList.length})
                                      </div>
                                      <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-1">
                                        {ordersList.length > 0 ? (
                                          ordersList.map((po, idx) => (
                                            <div
                                              key={idx}
                                              className="border border-blue-50 bg-white shadow-sm p-3 rounded-lg hover:border-blue-200 transition-colors"
                                            >
                                              <div className="flex justify-between font-mono text-xs mb-1">
                                                <span className="font-bold text-black">
                                                  {po.order_number}
                                                </span>
                                                <span className="text-slate-400">
                                                  {po.created_at?.split(" ")[0]}
                                                </span>
                                              </div>
                                              <div className="text-xs font-bold text-slate-800 mb-2">
                                                產出產品: {po.product_name}
                                              </div>
                                              <div className="flex justify-between items-center text-[11px] border-t border-dashed border-slate-100 pt-1.5 text-slate-500 font-mono">
                                                <span>
                                                  投入用量:{" "}
                                                  <strong className="text-black font-bold">
                                                    {po.used_qty}
                                                  </strong>{" "}
                                                  {po.unit}
                                                </span>
                                              </div>
                                              {po.vendor_info && (
                                                <div className="mt-2 text-[11px] bg-blue-50/20 p-2 rounded border border-blue-50 text-slate-700 space-y-0.5">
                                                  <div className="font-bold text-black">
                                                    廠商名稱:{" "}
                                                    {po.vendor_info.name}
                                                  </div>
                                                  <div>
                                                    電話:{" "}
                                                    {po.vendor_info.phone ||
                                                      "-"}
                                                  </div>
                                                  <div>
                                                    出貨日期:{" "}
                                                    {po.vendor_info
                                                      .shipping_date ||
                                                      "-"}{" "}
                                                    (
                                                    {po.vendor_info.logistics ||
                                                      "未定"}
                                                    )
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-xs text-slate-400 text-center py-8 font-medium">
                                            無資料
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {/* 欄位三 */}
                                    <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex flex-col h-full">
                                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                                        3. 尚未生產之單據 ({mrpsList.length})
                                      </div>
                                      <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-1">
                                        {mrpsList.length > 0 ? (
                                          mrpsList.map((mrp, idx) => (
                                            <div
                                              key={idx}
                                              className="border border-blue-50 bg-white shadow-sm p-3 rounded-lg"
                                            >
                                              <div className="flex justify-between font-mono text-xs mb-1">
                                                <span className="font-black text-blue-600">
                                                  {mrp.mrp_id}
                                                </span>
                                                <span className="text-slate-400">
                                                  {
                                                    mrp.created_at?.split(
                                                      " ",
                                                    )[0]
                                                  }
                                                </span>
                                              </div>
                                              <div className="text-xs font-semibold text-slate-700">
                                                預計用量:{" "}
                                                <span className="font-mono font-bold text-black">
                                                  {mrp.used_qty}
                                                </span>{" "}
                                                {mrp.unit}
                                              </div>
                                              {mrp.vendor_info?.name && (
                                                <div className="text-[11px] text-slate-500 mt-1 font-sans font-medium">
                                                  對應廠商:{" "}
                                                  {mrp.vendor_info.name}
                                                </div>
                                              )}
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-xs text-slate-400 text-center py-8 font-medium">
                                            無資料
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan="7"
                          className="p-12 text-center text-slate-500 font-medium"
                        >
                          {selectedMaterial
                            ? "找不到符合條件的追溯紀錄"
                            : "請從上方搜尋物料後發動追溯"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 列印預覽 Modal */}
        {isPreviewModalOpen && reportData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-100 max-w-4xl w-full max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10 shrink-0">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="text-[#1f4e78]" /> 計畫書預覽
                </h3>
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="text-slate-400 hover:text-red-500 text-2xl leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="overflow-y-auto p-4 md:p-8 flex-1 bg-slate-200/50">
                <div
                  className="bg-white shadow-xl mx-auto ring-1 ring-black/5"
                  style={{ minWidth: "210mm", minHeight: "297mm" }}
                >
                  <RecallReportPrintTemplate
                    reportData={reportData}
                    formData={formData}
                    recoveryRate={recoveryRate}
                    className="p-8"
                  />
                </div>
              </div>

              <div className="bg-white border-t border-slate-200 p-4 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-5 py-2 bg-white text-slate-700 font-bold border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                >
                  關閉
                </button>
                <button
                  onClick={handlePrintAction}
                  className="px-6 py-2 bg-[#1f4e78] text-white font-bold rounded-md hover:bg-blue-900 shadow-sm transition-colors flex items-center gap-2"
                >
                  <Printer size={16} /> 確認列印
                </button>
              </div>
            </div>
          </div>
        )}

        <CustomDialog
          isOpen={dialog.isOpen}
          type={dialog.type}
          status={dialog.status}
          title={dialog.title}
          message={dialog.message}
          onClose={closeDialog}
          onConfirm={dialog.onConfirm}
        />
      </div>

      {/* 隱藏的實際列印區塊 (移出 print:hidden 之外，以確保能成功列印) */}
      {reportData && (
        <RecallReportPrintTemplate
          reportData={reportData}
          formData={formData}
          recoveryRate={recoveryRate}
          className="hidden print:block print:p-8"
        />
      )}
    </>
  );
};

export default TracePage;

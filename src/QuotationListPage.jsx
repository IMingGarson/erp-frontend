import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Printer, Trash2, FileText, Plus, Edit } from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";

// --- 擬真列印預覽元件 ---
const DocumentPreview = ({ quotation, vendors, allMaterials, boms }) => {
  if (!quotation) return null;

  const customer = vendors.find(
    (v) => String(v.id) === String(quotation.customer),
  );
  const dateStr = quotation.issue_date
    ? quotation.issue_date.replace(/-/g, "/")
    : "";

  // 取得成品的 BOM 原料清單
  const getBomItems = (productId) => {
    if (!productId) return [];
    return boms
      .filter((b) => String(b.parent?.id) === String(productId))
      .map((bom) => {
        const childCode = bom.child?.code || "";
        const childName = bom.child?.name || "";
        const childUnit = bom.child?.unit || "KG";

        const fullMat = allMaterials.find(
          (m) => String(m.id) === String(bom.child?.id),
        );

        const baseQty = parseFloat(bom.base_quantity || 1);
        const reqQty = parseFloat(bom.quantity_required || 0);
        const usageQty = reqQty / baseQty;

        return {
          ...bom,
          childCode,
          childName,
          childUnit,
          cost: Math.round(parseFloat(fullMat?.estimated_cost || 0)),
          qty: usageQty,
        };
      });
  };

  return (
    <div
      className="flex flex-col gap-8 bg-slate-200 p-8 rounded-lg overflow-y-auto max-h-[75vh] custom-scrollbar print:bg-white print:p-0 print:overflow-visible print:block print:max-h-none"
      style={{ fontFamily: "'MingLiU', 'PMingLiU', serif" }}
    >
      <div className="bg-white p-10 shadow-lg mx-auto w-full max-w-[210mm] min-h-[290mm] text-black relative print:shadow-none print:w-full print:max-w-none print:m-0 print:p-[10mm] print:h-[290mm] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 shrink-0">
          <div className="w-1/3 text-xs leading-relaxed">
            <h2 className="text-base font-bold mb-1">基香食品有限公司</h2>
            <p>桃園市觀音區崙坪里1鄰1-10號</p>
            <p>電話: 03-4988228</p>
          </div>
          <div className="w-1/3 text-center">
            <h1 className="text-2xl font-bold tracking-[0.5em] mb-1 pb-1 inline-block border-b-[3px] border-double border-black">
              產品報價單
            </h1>
            <p className="text-xs">傳真: 03-4988159</p>
          </div>
          <div className="w-1/3 text-right text-xs">
            <p>第 1 頁,共 1 頁</p>
          </div>
        </div>

        {/* Meta Data */}
        <div className="flex justify-between text-xs mb-4 shrink-0">
          <div className="space-y-1">
            <p>
              <span className="inline-block w-16">客戶名稱:</span>{" "}
              {customer?.name || quotation.customer_name || ""}
            </p>
            <p>
              <span className="inline-block w-16">客戶統編:</span>{" "}
              {customer?.tax_id || ""}
            </p>
            <p>
              <span className="inline-block w-16">客戶電話:</span>{" "}
              {customer?.phone || ""}
            </p>
            <p>
              <span className="inline-block w-16">送貨地址:</span>{" "}
              {customer?.delivery_address || customer?.address || ""}
            </p>
          </div>
          <div className="space-y-1">
            <p>
              <span className="inline-block w-16">客戶編號:</span>{" "}
              {customer?.code || ""}
            </p>
            <p>
              <span className="inline-block w-16">聯 絡 人:</span>{" "}
              {customer?.contact_person || ""}
            </p>
            <p>
              <span className="inline-block w-16">客戶傳真:</span>{" "}
              {customer?.fax || ""}
            </p>
          </div>
          <div className="space-y-1 text-right">
            <p>
              <span className="inline-block w-16 text-left">單據日期:</span>{" "}
              {dateStr}
            </p>
            <p>
              <span className="inline-block w-16 text-left">單據編號:</span>{" "}
              {quotation.quotation_number || ""}
            </p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-xs border-collapse shrink-0">
          <thead>
            <tr className="border-t border-b border-black text-left">
              <th className="py-2 px-1 w-8">序</th>
              <th className="py-2 px-1 w-24">貨品編號</th>
              <th className="py-2 px-1">品名</th>
              <th className="py-2 px-1 w-28 text-right">單價(元/公斤)</th>
              <th className="py-2 px-1 w-32 text-center">規格</th>
              <th className="py-2 px-1 w-24">附註(未稅)</th>
            </tr>
          </thead>
          <tbody>
            {(quotation.items || []).map((item, idx) => {
              const mat = item.product_detail || {};
              return (
                <tr
                  key={idx}
                  className="border-b border-dashed border-gray-300"
                >
                  <td className="py-3 px-1 text-center">{idx + 1}</td>
                  <td className="py-3 px-1">{mat.code || ""}</td>
                  <td className="py-3 px-1">{mat.name || ""}</td>
                  <td className="py-3 px-1 text-right">
                    {Math.round(parseFloat(item.final_price_per_kg || 0))}
                  </td>
                  <td className="py-3 px-1 text-center">
                    {item.spec_text || item.spec || ""}
                  </td>
                  <td className="py-3 px-1"></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 🌟 拿掉 min-h 限制，單純靠 flex-1 把內容往下推 */}
        <div className="flex-1"></div>

        {/* Footer Notes (🌟 縮小 pt 與 margin) */}
        <div className="mt-auto text-xs leading-relaxed space-y-4 pt-6 shrink-0">
          <div>
            <span className="text-sm">產品備註：</span>
            <div className="pl-6 space-y-0.5 mt-1 text-gray-800">
              <p>
                1.
                接收報價單請於三日內簽名回傳，逾期未簽名回傳則視為同意此報價。
              </p>
              <p>2. 原物料漲幅超過5% 或作業上有其他異動將重新報價。</p>
              <p>3. 訂貨後需一次出貨完畢並結清款項。</p>
              <p>
                4.
                調味粉產品：最低出貨量單品項以『箱』為單位，無庫存產品，單一品項出貨量未滿
                100kg 除負擔運費外須加換線處理費500元。
              </p>
              <p>5. 果醬、調味醬產品：最低訂貨量為『 100 kg』。</p>
              <p className="mt-2 font-bold tracking-widest">
                ** 此報價金額未包含關稅 **
              </p>
            </div>
          </div>

          <div>
            <span className="text-sm">專用原料清單：</span>
          </div>

          <div>
            <span className="text-sm">通用備註：</span>
            <div className="pl-6 space-y-0.5 mt-1 text-gray-800">
              <p>1. 如需內部檢驗報告，請於訂購時提出需求。</p>
              <p>
                2. 累計採購量未達經濟批量之產品，其外部檢驗費用將由客戶負擔。
              </p>
              <p>
                3.
                本報價單30天內有效，非常態庫存產品出貨日期由訂購日起計15～20工作天，請提早訂購。
              </p>
              <p>
                4.
                上述產品專用之原料，若結束生產後尚有剩餘原料，請以當時採購之原價購回。
              </p>
              <p>
                5.
                代客研發產品若有採購計畫異動請提早告知，以利進行製程庫存調整。
              </p>
            </div>
          </div>
        </div>

        {/* Signatures (🌟 縮小 margin-top) */}
        <div className="flex justify-between mt-8 text-sm shrink-0">
          <div className="w-1/4">審 核：</div>
          <div className="w-1/4">經 辦：</div>
          <div className="w-1/4">會 簽：</div>
          <div className="w-1/4">客戶簽回：</div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 內部視角：成本估算單 - 每個品項一頁          */}
      {/* ========================================== */}
      {(quotation.items || []).map((item, idx) => {
        const productId = item.product_detail?.id;
        const mat = item.product_detail || {};
        const bomItems = getBomItems(productId);

        const totalMaterialCost = Math.round(
          bomItems.reduce((sum, b) => sum + b.cost * b.qty, 0),
        );
        const manualCost = Math.round(
          Object.values(item.costs_breakdown || {})
            .filter((c) => c.name !== "原料成本")
            .reduce((sum, c) => sum + (parseFloat(c.value) || 0), 0),
        );
        const totalEstimatedCost = totalMaterialCost + manualCost;

        return (
          /* 🌟 加入 print:h-[296mm] 與 print:p-[10mm] */
          <div
            key={`cost-${idx}`}
            className="page-break bg-white p-10 shadow-lg mx-auto w-full max-w-[210mm] min-h-[297mm] text-black relative print:shadow-none print:w-full print:max-w-none print:m-0 print:p-[10mm] print:h-[296mm] flex flex-col"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-6 shrink-0">
              <div className="w-1/3 text-xs leading-relaxed">
                <h2 className="text-base font-bold mb-1">基香食品有限公司</h2>
                <p>桃園市觀音區崙坪里1鄰1-10號</p>
                <p>電話: 03-4988228</p>
              </div>
              <div className="w-1/3 text-center">
                <p className="text-xs text-right mt-6">傳真: 03-4988159</p>
              </div>
              <div className="w-1/3 text-right">
                <h1 className="text-2xl font-bold tracking-[0.2em] mb-1">
                  成本估算單
                </h1>
                <p className="text-xs">
                  第 {idx + 1} 頁,共 {quotation.items.length} 頁
                </p>
              </div>
            </div>

            {/* Meta Data */}
            <div className="flex justify-between text-xs mb-4 shrink-0">
              <div className="space-y-1 w-[30%]">
                <div className="flex">
                  <span className="w-20 shrink-0">單據日期:</span>
                  <span>{dateStr}</span>
                </div>
                <div className="flex">
                  <span className="w-20 shrink-0">產品編號:</span>
                  <span>{mat.code || item.product_code || ""}</span>
                </div>
                <div className="flex">
                  <span className="w-20 shrink-0">原料總成本:</span>
                  <span>{totalMaterialCost}</span>
                </div>
                <div className="flex">
                  <span className="w-20 shrink-0">估算總成本:</span>
                  <span>{totalEstimatedCost}</span>
                </div>
              </div>
              <div className="space-y-1 w-[35%] flex flex-col items-center">
                <div className="flex w-full justify-center px-2">
                  <span className="shrink-0 mr-2">產品名稱:</span>
                  <span className="text-left font-bold">
                    {mat.name || item.product_name || ""}
                  </span>
                </div>
                <div>
                  <br />
                </div>
                <div className="flex w-full justify-center px-2">
                  <span className="shrink-0 mr-2">含工總成本:</span>
                  <span className="text-left">{totalEstimatedCost}</span>
                </div>
                <div>
                  <br />
                </div>
              </div>
              <div className="space-y-1 w-[35%] flex flex-col items-end">
                <div className="flex w-full max-w-[200px]">
                  <span className="w-24 shrink-0">單據編號:</span>
                  <span className="flex-1 text-left">
                    {quotation.quotation_number || ""}
                  </span>
                </div>
                <div className="flex w-full max-w-[200px]">
                  <span className="w-24 shrink-0">數 量:</span>
                  <span className="flex-1 text-left">1.0000</span>
                </div>
                <div className="flex w-full max-w-[200px]">
                  <span className="w-24 shrink-0">製造總費用:</span>
                  <span className="flex-1 text-left">{manualCost}</span>
                </div>
                <div className="flex w-full max-w-[200px]">
                  <span className="w-24 shrink-0">估算單位成本:</span>
                  <span className="flex-1 text-left">{totalEstimatedCost}</span>
                </div>
              </div>
            </div>

            {/* BOM Table */}
            <table className="w-full text-xs border-collapse mb-8 shrink-0">
              <thead>
                <tr className="border-t border-b border-black text-left">
                  <th className="py-2 px-1 w-8">序</th>
                  <th className="py-2 px-1">原料編號</th>
                  <th className="py-2 px-1">原料名稱</th>
                  <th className="py-2 px-1 w-12 text-center">單位</th>
                  <th className="py-2 px-1 w-20 text-right">使用量</th>
                  <th className="py-2 px-1 w-20 text-right">平均成本</th>
                  <th className="py-2 px-1 w-16 text-center">插件位置</th>
                  <th className="py-2 px-1 w-16">附註</th>
                  <th className="py-2 px-1 w-24 text-right">總材料成本</th>
                </tr>
              </thead>
              <tbody>
                {bomItems.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-4 text-gray-400">
                      尚無配方資料
                    </td>
                  </tr>
                ) : (
                  bomItems.map((b, bIdx) => (
                    <tr
                      key={bIdx}
                      className="border-b border-dashed border-gray-200"
                    >
                      <td className="py-1.5 px-1">{bIdx + 1}</td>
                      <td className="py-1.5 px-1">{b.childCode}</td>
                      <td className="py-1.5 px-1">{b.childName}</td>
                      <td className="py-1.5 px-1 text-center">{b.childUnit}</td>
                      <td className="py-1.5 px-1 text-right">
                        {b.qty.toFixed(4)}
                      </td>
                      <td className="py-1.5 px-1 text-right">{b.cost}</td>
                      <td className="py-1.5 px-1 text-center"></td>
                      <td className="py-1.5 px-1"></td>
                      <td className="py-1.5 px-1 text-right">
                        {Math.round(b.cost * b.qty)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* 🌟 拿掉 min-h 限制 */}
            <div className="flex-1"></div>

            <div className="mt-4 text-xs shrink-0">
              <p>單據備註：</p>
            </div>

            {/* Signatures (🌟 縮小 margin-top) */}
            <div className="flex justify-between mt-auto pt-8 text-sm shrink-0">
              <div>審 核：</div>
              <div>經 辦：</div>
              <div>會 簽：</div>
              <div>倉 管：</div>
              <div>簽 收：</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// --- 列印專用隱藏容器 ---
const QuotationPrintTemplate = ({ data, vendors, allMaterials, boms }) => {
  if (!data) return null;
  return (
    <div className="hidden print:block w-full bg-white text-black font-sans mx-auto print:pt-4">
      <style>
        {`
          @media print {
            .page-break { page-break-before: always; }
            @page { size: A4 portrait; margin: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}
      </style>
      <DocumentPreview
        quotation={data}
        vendors={vendors}
        allMaterials={allMaterials}
        boms={boms}
      />
    </div>
  );
};

// --- 主頁面 ---
const QuotationListPage = () => {
  const navigate = useNavigate();

  const [quotations, setQuotations] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);
  const [boms, setBoms] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [expandedNoteIds, setExpandedNoteIds] = useState([]);
  const [printData, setPrintData] = useState(null);

  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
    onConfirm: null,
  });

  const showAlert = (title, message, status = "info") => {
    setDialog({
      isOpen: true,
      type: "alert",
      status,
      title,
      message,
      onConfirm: null,
    });
  };
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [quotRes, vendorRes, matRes, bomRes] = await Promise.all([
          fetchWithAuth("/api/quotations"),
          fetchWithAuth("/api/vendors"),
          fetchWithAuth("/api/materials"),
          fetchWithAuth("/api/boms"),
        ]);

        const quotJson = await quotRes.json();
        const vendorJson = await vendorRes.json();
        const matJson = await matRes.json();
        const bomJson = await bomRes.json();

        setQuotations(quotJson.data || quotJson || []);
        setVendors(vendorJson.data || vendorJson || []);
        setAllMaterials(matJson.data || matJson || []);
        setBoms(bomJson.data || bomJson || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const handleToggleExpand = (noteId) => {
    if (expandedNoteIds.includes(noteId)) {
      setExpandedNoteIds((prev) => prev.filter((id) => id !== noteId));
    } else {
      setExpandedNoteIds((prev) => [...prev, noteId]);
    }
  };

  const handlePrintRow = (e, quotation) => {
    if (e) e.stopPropagation();
    setPrintData(quotation);
    setTimeout(() => {
      const originalTitle = document.title;
      document.title = `報價單_${quotation.quotation_number}`;
      window.print();
      document.title = originalTitle;
    }, 150);
  };

  const handleDeleteQuotation = (e, quotation) => {
    if (e) e.stopPropagation();

    setDialog({
      isOpen: true,
      type: "confirm",
      status: "warning",
      title: "確認作廢",
      message: `您確定要作廢報價單「${quotation.quotation_number}」嗎？此操作不可逆。`,
      onConfirm: async () => {
        closeDialog();
        try {
          const res = await fetchWithAuth(`/api/quotations/${quotation.id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("作廢失敗");
          showAlert(
            "成功",
            `報價單 ${quotation.quotation_number} 已成功作廢。`,
            "success",
          );

          // 重新抓取資料
          const quotRes = await fetchWithAuth("/api/quotations");
          const quotJson = await quotRes.json();
          setQuotations(quotJson.data || quotJson || []);
        } catch (err) {
          showAlert("錯誤", err.message, "error");
        }
      },
    });
  };

  const processedQuotations = useMemo(() => {
    const list = Array.isArray(quotations) ? quotations : [];
    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(
      (q) =>
        (q.quotation_number &&
          q.quotation_number.toLowerCase().includes(term)) ||
        (q.customer_name && q.customer_name.toLowerCase().includes(term)),
    );
  }, [quotations, searchTerm]);

  if (loading && quotations.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="text-lg font-medium text-slate-500 animate-pulse">
          載入報價單資料中...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans relative text-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              報價單管理
            </h2>
          </div>
        </div>

        <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg border border-blue-100 mb-6">
          <p className="flex items-center gap-2 font-medium mb-1">
            <span className="text-lg">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
            <li>此頁面管理所有開立給客戶的專屬特約報價單。</li>
            <li>
              點擊列表可直接展開檢視<strong>「對外產品報價單」</strong>與
              <strong>「對內成本估算單」</strong>雙視角。
            </li>
            <li>點擊「列印」將生成符合 A4 滿版格式之正式實體單據。</li>
          </ul>
        </div>

        {error && (
          <div className="p-4 mb-6 text-red-700 bg-red-50 rounded-lg border border-red-200">
            ⚠️ {error}
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 mt-2">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
            <div className="relative w-full sm:w-72">
              <Search
                size={16}
                className="absolute left-3 top-2.5 text-slate-400"
              />
              <input
                type="text"
                placeholder="搜尋單號或客戶名稱..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-slate-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full shadow-sm"
              />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="text-sm text-slate-500 hover:text-red-500 whitespace-nowrap transition-colors underline"
              >
                清除條件
              </button>
            )}
          </div>

          <button
            onClick={() => navigate("/quotation")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors text-sm font-bold flex items-center gap-2 w-full md:w-auto justify-center"
          >
            <Plus size={16} /> 建立報價單
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-sm text-slate-600 font-semibold">
                <tr>
                  <th className="p-4 w-10 text-center"></th>
                  <th className="p-4">單據編號</th>
                  <th className="p-4">單據日期</th>
                  <th className="p-4">客戶名稱</th>
                  <th className="p-4 text-center">品項數</th>
                  <th className="p-4 text-center">狀態</th>
                  <th className="p-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {processedQuotations.length > 0 ? (
                  processedQuotations.map((quot) => {
                    const isExpanded = expandedNoteIds.includes(quot.id);
                    const isConfirmed = quot.status === "CONFIRMED";

                    return (
                      <React.Fragment key={quot.id}>
                        <tr
                          className={`hover:bg-blue-50/60 cursor-pointer transition-colors duration-150 ${isExpanded ? "bg-blue-50/30" : ""}`}
                          onClick={() => handleToggleExpand(quot.id)}
                        >
                          <td className="p-4 text-center text-slate-400 font-mono text-[10px]">
                            {isExpanded ? "▼" : "▶"}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-700">
                            {quot.quotation_number}
                          </td>
                          <td className="p-4 text-slate-600 font-mono">
                            {quot.issue_date}
                          </td>
                          <td className="p-4 font-bold text-slate-800">
                            {quot.customer_name || "-"}
                          </td>
                          <td className="p-4 text-slate-600 font-mono text-center">
                            {(quot.items || []).length}
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`inline-block px-2.5 py-1 text-xs font-bold rounded border ${
                                isConfirmed
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {isConfirmed ? "已確認" : "草稿"}
                            </span>
                          </td>
                          <td className="p-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={(e) => handlePrintRow(e, quot)}
                                className="px-3 py-1.5 bg-white text-slate-700 border border-slate-300 rounded hover:bg-slate-50 transition-all duration-200 text-xs font-bold inline-flex items-center gap-1 shadow-sm"
                              >
                                <Printer size={14} /> 列印預覽
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/quotation/${quot.id}`);
                                }}
                                className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-600 hover:text-white transition-all duration-200 text-xs font-bold inline-flex items-center gap-1 shadow-sm"
                                title="編輯單據"
                              >
                                <Edit size={14} /> 編輯
                              </button>
                              <button
                                onClick={(e) => handleDeleteQuotation(e, quot)}
                                className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-600 hover:text-white transition-all duration-200 text-xs font-bold inline-flex items-center gap-1 shadow-sm"
                                title="作廢單據"
                              >
                                <Trash2 size={14} /> 刪除
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* 展開的單據預覽區塊 */}
                        {isExpanded && (
                          <tr>
                            <td
                              colSpan="7"
                              className="p-0 bg-slate-200/50 shadow-inner border-b-4 border-slate-300"
                            >
                              <div className="p-4 md:p-8 overflow-x-auto flex flex-col">
                                <DocumentPreview
                                  quotation={quot}
                                  vendors={vendors}
                                  allMaterials={allMaterials}
                                  boms={boms}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="p-12 text-center text-slate-400">
                      找不到符合的報價單資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <CustomDialog
          isOpen={dialog.isOpen}
          {...dialog}
          onClose={closeDialog}
        />
      </div>

      {/* 隱藏的列印區塊 (透過 @media print 呼叫) */}
      {printData && (
        <QuotationPrintTemplate
          data={printData}
          vendors={vendors}
          allMaterials={allMaterials}
          boms={boms}
        />
      )}
    </>
  );
};

export default QuotationListPage;

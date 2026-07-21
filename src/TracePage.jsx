import { useState } from "react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";

const TracePage = () => {
  const [traceResults, setTraceResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBatches, setExpandedBatches] = useState({});

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

  const closeDialog = () => {
    setDialog((prev) => ({ ...prev, isOpen: false }));
  };

  const toggleExpand = (batchId) => {
    setExpandedBatches((prev) => ({
      ...prev,
      [batchId]: !prev[batchId],
    }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      return showAlert(
        "查詢條件為空",
        "請輸入原物料名稱或批號進行追溯。",
        "warning",
      );
    }

    setLoading(true);
    setError(null);
    setExpandedBatches({});

    try {
      const encodedQuery = encodeURIComponent(searchQuery.trim());
      const url = `/api/batches/trace?q=${encodedQuery}`;
      const res = await fetchWithAuth(url, { method: "GET" });

      if (!res.ok) {
        if (res.status === 404) {
          setTraceResults([]);
          throw new Error("找不到對應的批號或物料資訊");
        }
        throw new Error("追溯資料讀取失敗，請重新嘗試");
      }

      const json = await res.json();
      const dataList = json.data || [];
      setTraceResults(dataList);

      if (dataList.length === 1) {
        setExpandedBatches({ [dataList[0].batch_id]: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearchQuery("");
    setTraceResults([]);
    setError(null);
    setExpandedBatches({});
  };

  // 動態計算上方看板的總數量，並自動擷取批次的單位
  const calculateTotals = () => {
    if (traceResults.length === 0)
      return { currentInput: 0, currentPo: 0, currentMrp: 0, displayUnit: "" };

    let currentInput = 0;
    let currentPo = 0;
    let currentMrp = 0;
    let displayUnit = "";

    traceResults.forEach((batch) => {
      currentInput += parseFloat(batch.remaining_qty || 0);

      // 從生產單撈取單位並加總
      batch.trace_details?.orders?.forEach((po) => {
        currentPo += parseFloat(po.used_qty || 0);
        if (po.unit && !displayUnit) displayUnit = po.unit;
      });

      // 從物料需求單撈取單位並加總
      batch.trace_details?.mrps?.forEach((mrp) => {
        currentMrp += parseFloat(mrp.used_qty || 0);
        if (mrp.unit && !displayUnit) displayUnit = mrp.unit;
      });
    });

    return { currentInput, currentPo, currentMrp, displayUnit };
  };

  const { currentInput, currentPo, currentMrp, displayUnit } =
    calculateTotals();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-blue-50/20 min-h-screen font-sans relative text-slate-900">
      {/* 標題區 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-black text-black tracking-tight">
            追蹤追溯
          </h2>
        </div>
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
            支援以批號代碼、物料名稱進行<strong>搜尋資料</strong>。
          </li>
        </ul>
      </div>

      {/* 搜尋操作區 */}
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row gap-3 w-full items-center p-4 bg-white rounded-xl shadow-md border border-blue-100 mb-6"
      >
        <div className="relative w-full sm:flex-1">
          <input
            type="text"
            placeholder="可輸入原物料批號或中文名稱查詢"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-blue-200 rounded-md pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-blue-50/10 placeholder-slate-400"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md shadow-sm transition-colors text-sm font-bold whitespace-nowrap flex-1 sm:flex-none"
          >
            {loading ? "追溯中" : "追溯"}
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

      {/* 明亮式數據統計看板 */}
      {traceResults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border-2 border-blue-100 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors">
            <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">
              現存庫存
            </span>
            <div className="text-2xl font-black text-black mt-1 font-mono flex items-baseline gap-1.5">
              {currentInput.toFixed(2)}
              {displayUnit && (
                <span className="text-xs font-bold text-slate-500 font-sans">
                  {displayUnit}
                </span>
              )}
            </div>
          </div>
          <div className="bg-white border-2 border-blue-100 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors">
            <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">
              生產單
            </span>
            <div className="text-2xl font-black text-black mt-1 font-mono flex items-baseline gap-1.5">
              {currentPo.toFixed(2)}
              {displayUnit && (
                <span className="text-xs font-bold text-slate-500 font-sans">
                  {displayUnit}
                </span>
              )}
            </div>
          </div>
          <div className="bg-white border-2 border-blue-100 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors">
            <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">
              物料需求單
            </span>
            <div className="text-2xl font-black text-black mt-1 font-mono flex items-baseline gap-1.5">
              {currentMrp.toFixed(2)}
              {displayUnit && (
                <span className="text-xs font-bold text-slate-500 font-sans">
                  {displayUnit}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 主追溯清單表格 */}
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
                <th className="p-4 whitespace-nowrap">有效期限</th>
                <th className="p-4 text-center whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-blue-600">
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
                    <p key={batch.batch_id} className="contents">
                      {/* 主批號橫列 */}
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
                        <td className="p-4 font-mono text-sm text-black">
                          {batch.expiration_date}
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

                      {/* 展開之高亮度柔和三欄網格 */}
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan="7"
                            className="bg-indigo-50/30 p-6 border-b border-t border-blue-100"
                          >
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                              {/* 欄位一：現存庫存基本資料 */}
                              <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex flex-col h-full">
                                <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                                  1. 現存庫存
                                </div>
                                <div className="text-base font-black text-black mb-2">
                                  {batch.material_name}
                                </div>
                                <div className="space-y-1.5 text-xs font-mono text-slate-700 bg-blue-50/30 p-3 rounded-lg border border-blue-100 flex-1">
                                  <div>批號: {batch.batch_number}</div>
                                  <div>入庫日期: {batch.received_date}</div>
                                  <div>有效期限: {batch.expiration_date}</div>
                                </div>
                              </div>

                              {/* 欄位二：生產單內容與關聯資料 */}
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
                                              廠商名稱: {po.vendor_info.name}
                                            </div>
                                            <div>
                                              電話:{" "}
                                              {po.vendor_info.phone || "-"}
                                            </div>
                                            <div>
                                              出貨日期:{" "}
                                              {po.vendor_info.shipping_date ||
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

                              {/* 欄位三：物料需求單項目 */}
                              <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex flex-col h-full">
                                <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                                  3. 物料需求單 ({mrpsList.length})
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
                                            {mrp.created_at?.split(" ")[0]}
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
                                            對應廠商: {mrp.vendor_info.name}
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
                    </p>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="p-12 text-center text-slate-400 font-medium"
                  >
                    {searchQuery
                      ? "找不到符合條件的追溯紀錄"
                      : "請輸入批號或原物料關鍵字發動追溯報告"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
  );
};

export default TracePage;

import { useState } from "react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";

const TracePage = () => {
  const [traceResults, setTraceResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      if (res.ok) {
        const json = await res.json();
        const dataList = json.data.data || [];
        setTraceResults(dataList);
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
  };

  // 動態計算上方看板的總數量
  const calculateTotals = () => {
    if (traceResults.length === 0)
      return { currentInput: 0, currentPo: 0, currentMrp: 0, displayUnit: "" };

    let currentInput = 0;
    let currentPo = 0;
    let currentMrp = 0;
    let displayUnit = "";

    traceResults.forEach((batch) => {
      currentInput += parseFloat(batch.remaining_qty || 0);

      batch.trace_details?.orders?.forEach((po) => {
        currentPo += parseFloat(po.used_qty || 0);
        if (po.unit && !displayUnit) displayUnit = po.unit;
      });

      batch.trace_details?.mrps?.forEach((mrp) => {
        currentMrp += parseFloat(mrp.used_qty || 0);
        if (mrp.unit && !displayUnit) displayUnit = mrp.unit;
      });
    });

    return { currentInput, currentPo, currentMrp, displayUnit };
  };

  const { currentInput, currentPo, currentMrp, displayUnit } =
    calculateTotals();

  // 取得今天日期作為「製表日期」
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 md:p-8 max-w-full mx-auto bg-blue-50/20 min-h-screen font-sans relative text-slate-900 print:bg-white print:p-0">
      {/* 標題區 (列印時隱藏) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
        <div>
          <h2 className="text-3xl font-black text-black tracking-tight">
            批號追溯報表
          </h2>
        </div>
        {traceResults.length > 0 && (
          <button
            onClick={handlePrint}
            className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-md shadow flex items-center gap-2 text-sm font-bold transition-colors"
          >
            <span>🖨️</span> 列印報表 (PDF)
          </button>
        )}
      </div>

      {/* 系統功能說明區塊 (列印時隱藏) */}
      <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg mb-6 border border-blue-100 print:hidden">
        <p className="flex items-center gap-2 font-medium mb-1">
          <span className="text-lg">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
          <li>
            支援以批號代碼、物料名稱進行<strong>完整上下游追溯</strong>。
          </li>
          <li>
            查詢結果可直接點擊右上角「列印報表」輸出符合食品安全稽核之 PDF
            格式。
          </li>
        </ul>
      </div>

      {/* 搜尋操作區 (列印時隱藏) */}
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row gap-3 w-full items-center p-4 bg-white rounded-xl shadow-md border border-blue-100 mb-6 print:hidden"
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
            {loading ? "追溯中..." : "追溯"}
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
        <div className="p-4 mb-6 text-red-900 bg-red-50 rounded-lg border border-red-200 font-bold print:hidden">
          ⚠️ 提示：{error}
        </div>
      )}

      {/* 主追溯清單表格 (列印時顯示的重點區域) */}
      <div className="space-y-8 print:space-y-4">
        {loading ? (
          <div className="p-12 text-center text-blue-600 font-bold text-lg animate-pulse print:hidden">
            資料追溯中，請稍候...
          </div>
        ) : traceResults.length > 0 ? (
          traceResults.map((batch) => {
            const ordersList = batch.trace_details?.orders || [];

            return (
              <div
                key={batch.batch_id}
                className="bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden print:shadow-none print:border-none print:rounded-none"
              >
                {/* 報表標頭 (100% 貼合 PDF 格式) */}
                <div className="p-4 print:p-2 mb-2">
                  <h3 className="text-xl font-bold text-black mb-2 text-center print:text-2xl print:mb-4">
                    {batch.material_code} {batch.material_name}(批號:
                    {batch.batch_number})領用記錄
                  </h3>
                  <div className="flex justify-start text-sm text-black font-medium">
                    <p>製表日期：{getTodayDateString()}</p>
                  </div>
                </div>

                {/* 追溯表格主體 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse border-y border-black text-sm print:text-[11px]">
                    <thead className="print:text-black">
                      <tr>
                        <th className="border border-black p-1">
                          客戶
                          <br />
                          編號
                        </th>
                        <th className="border border-black p-1">客戶名稱</th>
                        <th className="border border-black p-1">
                          貨品編號/
                          <br />
                          產品編號
                        </th>
                        <th className="border border-black p-1">
                          品名/
                          <br />
                          產品名稱
                        </th>
                        <th className="border border-black p-1">規格</th>
                        <th className="border border-black p-1">批號編號</th>
                        <th className="border border-black p-1">銷貨單編號</th>
                        <th className="border border-black p-1">
                          數量
                          <br />
                          (包)
                        </th>
                        <th className="border border-black p-1">KG</th>
                        <th className="border border-black p-1">製令單號</th>
                        <th className="border border-black p-1">產品數量</th>
                        <th className="border border-black p-1">原料數量</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {ordersList.length > 0 ? (
                        ordersList.flatMap((po, poIdx) => {
                          const hasDeliveryNotes =
                            po.delivery_notes && po.delivery_notes.length > 0;

                          if (hasDeliveryNotes) {
                            return po.delivery_notes.map((dn, dnIdx) => {
                              const isKG =
                                dn.unit && dn.unit.toUpperCase().includes("KG");
                              const qtyBag = isKG ? "" : dn.quantity;
                              const qtyKG = isKG ? dn.quantity : "";

                              return (
                                <tr
                                  key={`${po.order_number}-${dn.note_number}`}
                                  className="hover:bg-slate-50 print:hover:bg-white print:text-black align-top"
                                >
                                  <td className="border border-black p-1">
                                    {dn.customer_code ||
                                      po.po_vendor_info?.code ||
                                      ""}
                                  </td>
                                  <td className="border border-black p-1 text-left">
                                    {dn.customer_name ||
                                      po.po_vendor_info?.name ||
                                      ""}
                                  </td>
                                  <td className="border border-black p-1 text-left">
                                    {po.product_code}
                                  </td>
                                  <td className="border border-black p-1 text-left">
                                    {po.product_name}
                                  </td>
                                  <td className="border border-black p-1 text-left">
                                    {dn.spec || po.product_spec || ""}
                                  </td>
                                  <td className="border border-black p-1">
                                    {po?.used_batch_numbers?.map((bn, idx) => {
                                      return <span key={idx}>{bn}</span>;
                                    }) || ""}
                                  </td>
                                  <td className="border border-black p-1">
                                    {dn.note_number}
                                  </td>
                                  <td className="border border-black p-1">
                                    {qtyBag}
                                  </td>
                                  <td className="border border-black p-1">
                                    {qtyKG}
                                  </td>
                                  <td className="border border-black p-1">
                                    {po.order_number}
                                  </td>

                                  {/* 避免重複加總生產量與原料量，僅在該生產單的第一筆銷貨記錄顯示 */}
                                  <td className="border border-black p-1">
                                    {dnIdx === 0 ? po.actual_qty : ""}
                                  </td>
                                  <td className="border border-black p-1 print:text-black">
                                    {dnIdx === 0
                                      ? Number(po.used_qty).toFixed(4)
                                      : ""}
                                  </td>
                                </tr>
                              );
                            });
                          }
                          // 情況 B：生產單已建立，但尚未建立任何銷貨單
                          else {
                            return (
                              <tr
                                key={`po-${po.order_number}`}
                                className="hover:bg-slate-50 print:hover:bg-white text-gray-500 print:text-black align-top"
                              >
                                <td className="border border-black p-1">
                                  {po.po_vendor_info?.code || ""}
                                </td>
                                <td className="border border-black p-1 text-left">
                                  {po.po_vendor_info?.name || ""}
                                </td>
                                <td className="border border-black p-1 text-left">
                                  {po.product_code}
                                </td>
                                <td className="border border-black p-1 text-left">
                                  {po.product_name}
                                </td>
                                <td className="border border-black p-1 text-left">
                                  {po.product_spec || ""}
                                </td>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1">
                                  {po.order_number}
                                </td>
                                <td className="border border-black p-1">
                                  {po.actual_qty || 0}
                                </td>
                                <td className="border border-black p-1 print:text-black">
                                  {Number(po.used_qty).toFixed(4)}
                                </td>
                              </tr>
                            );
                          }
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan="12"
                            className="border border-black p-4 text-center text-gray-400 print:text-black"
                          >
                            此批號目前尚未被任何生產單使用
                          </td>
                        </tr>
                      )}

                      {/* 總計列 */}
                      {ordersList.length > 0 && (
                        <tr className="print:bg-white font-bold print:text-black text-right">
                          <td
                            colSpan="11"
                            className="p-2 border-r border-black"
                          >
                            合計
                          </td>
                          <td className="border border-black p-2 text-center">
                            {ordersList
                              .reduce(
                                (sum, po) => sum + (Number(po.used_qty) || 0),
                                0,
                              )
                              .toFixed(4)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        ) : (
          !loading &&
          searchQuery && (
            <div className="bg-white rounded-xl shadow-md p-12 text-center text-slate-400 font-medium print:hidden">
              找不到符合條件的追溯紀錄
            </div>
          )
        )}
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

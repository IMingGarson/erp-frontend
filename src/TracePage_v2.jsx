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
        const dataList = json.data || [];
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
      <style>
        {`
          @media print {
            @page {
              margin: 0;
            }
            body {
              padding: 1.5cm;
            }
          }
        `}
      </style>

      {/* 標題區 */}
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
            <span>🖨️</span> 列印
          </button>
        )}
      </div>

      {/* 系統功能說明區塊 */}
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

      {/* 搜尋操作區 */}
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

      {/* 預覽報表區 (白底黑字) */}
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
                className="bg-white shadow-xl ring-1 ring-black/5 p-4 md:p-8 max-w-full overflow-x-auto print:shadow-none print:ring-0 print:p-0 rounded-sm"
              >
                <div className="min-w-[800px]">
                  {/* 報表標頭 */}
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-black mb-2 text-center print:text-2xl">
                      {batch.material_code} {batch.material_name}(批號:{" "}
                      {batch.batch_number})領用記錄
                    </h3>
                    <div className="flex justify-start text-sm text-black font-medium">
                      <p>製表日期：{getTodayDateString()}</p>
                    </div>
                  </div>

                  <table className="w-full text-center border-collapse text-sm print:text-[11px] border-2 border-black">
                    <thead className="bg-white text-black">
                      <tr>
                        <th className="p-1.5 font-semibold whitespace-nowrap border border-black">
                          客戶
                          <br className="print:hidden" />
                          編號
                        </th>
                        <th className="p-1.5 font-semibold whitespace-nowrap border border-black">
                          客戶名稱
                        </th>
                        <th className="p-1.5 font-semibold whitespace-nowrap border border-black">
                          貨品編號/
                          <br className="print:hidden" />
                          產品編號
                        </th>
                        <th className="p-1.5 font-semibold whitespace-nowrap border border-black">
                          品名/
                          <br className="print:hidden" />
                          產品名稱
                        </th>
                        <th className="p-1.5 font-semibold whitespace-nowrap border border-black">
                          規格
                        </th>
                        <th className="p-1.5 font-semibold whitespace-nowrap border border-black">
                          批號編號
                        </th>
                        <th className="p-1.5 font-semibold whitespace-nowrap border border-black">
                          銷貨單編號
                        </th>
                        <th className="p-1.5 font-semibold whitespace-nowrap border border-black">
                          數量
                          <br className="print:hidden" />
                          (包)
                        </th>
                        <th className="p-1.5 font-semibold whitespace-nowrap border border-black">
                          KG
                        </th>
                        <th className="p-1.5 font-semibold whitespace-nowrap border border-black">
                          製令單號
                        </th>
                        <th className="p-1.5 font-semibold whitespace-nowrap border border-black">
                          產品數量
                        </th>
                        <th className="p-1.5 font-semibold whitespace-nowrap border border-black">
                          原料數量
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersList.length > 0 ? (
                        ordersList.flatMap((po, poIdx) => {
                          const hasDeliveryNotes =
                            po.delivery_notes && po.delivery_notes.length > 0;

                          const totalDeliveryQty = hasDeliveryNotes
                            ? po.delivery_notes.reduce(
                                (sum, dn) => sum + (Number(dn.quantity) || 0),
                                0,
                              )
                            : 0;

                          let accumulatedRawQty = 0;
                          let accumulatedProductQty = 0;

                          if (hasDeliveryNotes) {
                            return po.delivery_notes.map((dn, dnIdx) => {
                              const isKG =
                                dn.unit && dn.unit.toUpperCase().includes("KG");
                              const baseQty =
                                dn.required_quantity !== undefined
                                  ? dn.required_quantity
                                  : dn.quantity;
                              const qtyBag = isKG ? "" : baseQty;
                              const qtyKG = isKG ? baseQty : "";

                              const isLastNote =
                                dnIdx === po.delivery_notes.length - 1;

                              let allocatedRawQty = 0;
                              let allocatedProductQty = 0;

                              if (totalDeliveryQty > 0) {
                                if (isLastNote) {
                                  // 🌟 尾差調整：直接拿總量去扣掉前面「已經四捨五入並印出」的數字
                                  allocatedRawQty = Number(
                                    (
                                      Number(po.used_qty) - accumulatedRawQty
                                    ).toFixed(4),
                                  );
                                  allocatedProductQty = Number(
                                    (
                                      Number(po.actual_qty || 0) -
                                      accumulatedProductQty
                                    ).toFixed(4),
                                  );
                                } else {
                                  // 先進行四捨五入
                                  const ratio =
                                    Number(dn.quantity) / totalDeliveryQty;
                                  allocatedRawQty = Number(
                                    (Number(po.used_qty) * ratio).toFixed(4),
                                  );
                                  allocatedProductQty = Number(
                                    (
                                      Number(po.actual_qty || 0) * ratio
                                    ).toFixed(4),
                                  );

                                  // 將「四捨五入後」的結果累加，避免誤差累積
                                  accumulatedRawQty += allocatedRawQty;
                                  accumulatedProductQty += allocatedProductQty;
                                }
                              } else if (dnIdx === 0) {
                                allocatedRawQty = Number(
                                  Number(po.used_qty).toFixed(4),
                                );
                                allocatedProductQty = Number(
                                  Number(po.actual_qty || 0).toFixed(4),
                                );
                              }

                              return (
                                <tr
                                  key={`${po.order_number}-${dn.note_number}`}
                                  className="text-black align-top hover:bg-gray-50 print:hover:bg-white transition-colors"
                                >
                                  <td className="p-1.5 border border-black">
                                    {dn.customer_code ||
                                      po.po_vendor_info?.code ||
                                      ""}
                                  </td>
                                  <td className="p-1.5 text-left border border-black">
                                    {dn.customer_name ||
                                      po.po_vendor_info?.name ||
                                      ""}
                                  </td>
                                  <td className="p-1.5 text-left font-mono text-xs print:text-[11px] border border-black">
                                    {po.product_code}
                                  </td>
                                  <td className="p-1.5 text-left border border-black">
                                    {po.product_name}
                                  </td>
                                  <td className="p-1.5 text-left border border-black">
                                    {dn.spec || ""}
                                  </td>
                                  <td className="p-1.5 font-mono text-xs print:text-[11px] border border-black">
                                    {po?.used_batch_numbers?.map((bn, idx) => (
                                      <div key={idx}>{bn}</div>
                                    )) || ""}
                                  </td>
                                  <td className="p-1.5 font-mono text-xs print:text-[11px] border border-black">
                                    {dn.note_number}
                                  </td>
                                  <td className="p-1.5 border border-black">
                                    {qtyBag}
                                  </td>
                                  <td className="p-1.5 border border-black">
                                    {qtyKG}
                                  </td>
                                  <td className="p-1.5 font-mono text-xs print:text-[11px] border border-black">
                                    {po.order_number}
                                  </td>

                                  <td className="p-1.5 border border-black">
                                    {allocatedProductQty > 0
                                      ? allocatedProductQty.toFixed(4)
                                      : 0}
                                  </td>
                                  <td className="p-1.5 border border-black">
                                    {allocatedRawQty > 0
                                      ? allocatedRawQty.toFixed(4)
                                      : ""}
                                  </td>
                                </tr>
                              );
                            });
                          } else {
                            // 情況 B：生產單已建立，但尚未建立任何銷貨單
                            return (
                              <tr
                                key={`po-${po.order_number}`}
                                className="text-black align-top hover:bg-gray-50 print:hover:bg-white transition-colors"
                              >
                                <td className="p-1.5 border border-black">
                                  {po.po_vendor_info?.code || ""}
                                </td>
                                <td className="p-1.5 text-left border border-black">
                                  {po.po_vendor_info?.name || ""}
                                </td>
                                <td className="p-1.5 text-left font-mono text-xs print:text-[11px] border border-black">
                                  {po.product_code}
                                </td>
                                <td className="p-1.5 text-left border border-black">
                                  {po.product_name}
                                </td>
                                <td className="p-1.5 text-left border border-black">
                                  {po.spec || ""}
                                </td>
                                <td className="p-1.5 font-mono text-xs print:text-[11px] border border-black">
                                  {po?.used_batch_numbers?.map((bn, idx) => (
                                    <div key={idx}>{bn}</div>
                                  )) || ""}
                                </td>
                                <td className="p-1.5 border border-black"></td>
                                {/* TODO: 數量（包） */}
                                <td className="p-1.5 border border-black">
                                  {po?.target_pkg_qty || ""}
                                </td>
                                <td className="p-1.5 border border-black">
                                  {po.target_qty || "KG"}
                                </td>
                                <td className="p-1.5 font-mono text-xs print:text-[11px] border border-black">
                                  {po.order_number}
                                </td>
                                <td className="p-1.5 border border-black">
                                  {po.actual_qty || 0}
                                </td>
                                <td className="p-1.5 border border-black">
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
                            className="p-8 text-center text-gray-500 border border-black"
                          >
                            此批號目前尚未被任何生產單使用
                          </td>
                        </tr>
                      )}

                      {/* 總計列 */}
                      {ordersList.length > 0 && (
                        <tr className="bg-white font-bold text-black text-right">
                          <td
                            colSpan="11"
                            className="p-1.5 border border-black"
                          >
                            合計
                          </td>
                          <td className="p-1.5 text-center border border-black">
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

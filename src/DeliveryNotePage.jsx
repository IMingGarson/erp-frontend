import React, { useState, useEffect, useMemo } from "react";
import CustomDialog from "./components/CustomDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useAuthStore } from "./store/authStore";
import { ReceiptText, Printer } from "lucide-react";

const DeliveryNoteTemplate = ({ note }) => {
  console.log("note", note);
  if (!note) return null;
  const customer = note.customer_info || {};
  const qtyStr = Number(note.quantity).toLocaleString(undefined, {
    minimumFractionDigits: 2,
  });

  return (
    <div className="bg-white font-sans text-black relative p-4 print:p-0">
      <div className="flex items-end mb-2 w-full">
        <div className="flex-1 text-[14px] leading-relaxed">
          <span className="text-[18px]">基香食品有限公司</span>
          <br />
          桃園市觀音區崙坪里1鄰1-10號
          <br />電 話：03-4988228 <span></span>傳 真：03-4988159
        </div>

        <h1 className="text-[32px] font-bold tracking-[1em] m-0 text-center pl-[1em]">
          銷貨單
        </h1>

        <div className="flex-1 text-[14px] text-right">第 1 頁,共 1 頁</div>
      </div>

      {/* 客戶與單據資訊表 */}
      <table className="w-full border-collapse border border-black mb-2 text-[14px]">
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1 align-top w-1/3">
              客戶名稱：{customer.name || ""}
            </td>
            <td className="border border-black px-2 py-1 align-top w-1/3">
              客戶編號：{customer.code || ""}
            </td>
            <td className="border border-black px-2 py-1 align-top w-1/3">
              單據日期：{note.note_date || ""}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 align-top">
              客戶統編：{customer.tax_id || ""}
            </td>
            <td className="border border-black px-2 py-1 align-top">
              聯絡人：{customer.contact || ""}
            </td>
            <td className="border border-black px-2 py-1 align-top">
              單據編號：{note.note_number || ""}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 align-top">
              客戶電話：{customer.phone || ""}
            </td>
            <td className="border border-black px-2 py-1 align-top">
              發票號碼：
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 align-top" colSpan="3">
              送貨地址：{customer.address || ""}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse border border-black text-center text-[14px]">
        <thead>
          <tr className="font-normal">
            <th className="border border-black px-1 py-1.5 w-[5%] font-normal">
              序
            </th>
            <th className="border border-black px-1 py-1.5 w-[15%] font-normal">
              貨品編號
            </th>
            <th className="border border-black px-1 py-1.5 w-[20%] font-normal">
              品名
            </th>
            <th className="border border-black px-1 py-1.5 w-[15%] font-normal">
              規格
            </th>
            <th className="border border-black px-1 py-1.5 w-[10%] font-normal">
              數量
            </th>
            <th className="border border-black px-1 py-1.5 w-[5%] font-normal">
              單位
            </th>
            <th className="border border-black px-1 py-1.5 w-[8%] font-normal">
              單價
            </th>
            <th className="border border-black px-1 py-1.5 w-[10%] font-normal">
              銷貨小計
            </th>
            <th className="border border-black px-1 py-1.5 w-[5%] font-normal">
              附註
            </th>
            <th className="border border-black px-1 py-1.5 w-[7%] font-normal">
              批號編號
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black px-1 py-1.5">1</td>
            <td className="border border-black px-1 py-1.5 text-left">
              {note.production_order_detail.product_code || ""}
            </td>
            <td className="border border-black px-1 py-1.5 text-left">
              {note.production_order_detail.product_name || ""}
            </td>
            <td className="border border-black px-1 py-1.5">
              {note.spec || ""}
            </td>
            <td className="border border-black px-1 py-1.5 text-right">
              {qtyStr}
            </td>
            <td className="border border-black px-1 py-1.5">
              {note.unit || "KG"}
            </td>
            <td className="border border-black px-1 py-1.5">
              {note.unit_price || ""}
            </td>
            <td className="border border-black px-1 py-1.5">
              {note.subtotal || ""}
            </td>
            <td className="border border-black px-1 py-1.5">
              {note.note || ""}
            </td>
            <td className="border border-black px-1 py-1.5">
              {note.production_order_detail.used_batch_number || ""}
            </td>
          </tr>
          {/* 預留空白列 */}
          <tr>
            <td className="border border-black px-1 py-1.5 text-transparent">
              .
            </td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-1.5 text-transparent">
              .
            </td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
            <td className="border border-black px-1 py-1.5"></td>
          </tr>
        </tbody>
      </table>

      {/* 底部金額與物流狀態 */}
      <table className="w-full border-collapse border border-black border-t-0 text-[14px]">
        <tbody>
          <tr>
            <td className="border-r border-b border-black px-2 py-1 align-top w-1/3">
              合計金額：{note.total_amount || ""}
            </td>
            <td className="border-r border-b border-black px-2 py-1 align-top w-1/3 text-center">
              營業稅：{note.tax_amount || ""}
            </td>
            <td className="border-b border-black px-2 py-1 align-top w-1/3">
              銷貨總額：{note.grand_total || ""}
            </td>
          </tr>
          <tr>
            <td className="px-2 py-1 align-top" colSpan="3">
              <div className="flex justify-between mb-1">
                <div>單據備註：{note.document_note || ""}</div>
                <div>
                  車輛是否清潔：
                  <span className="inline-block w-3 h-3 border border-black relative top-[2px] ml-[2px]"></span>
                </div>
                <div>
                  車輛是否上鎖：
                  <span className="inline-block w-3 h-3 border border-black relative top-[2px] ml-[2px]"></span>
                </div>
              </div>
              <div className="flex justify-between">
                <div>
                  車輛溫度：________°C 冷藏：凍結點～7°C ，冷凍-12°C以下
                </div>
                <div>運輸方式：___________________</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 簽名區塊 */}
      <div className="flex justify-between mt-4 px-2 text-[14px]">
        <div>主 管：</div>
        <div>經 辦：</div>
        <div>出 貨：</div>
        <div>簽 收：</div>
        <div>表號：C-61</div>
      </div>
    </div>
  );
};

const DeliveryNotePrintTemplate = ({ data }) => {
  if (!data) return null;

  return (
    <div className="hidden print:block w-full bg-white text-black font-sans mx-auto print:pt-4">
      <style>
        {`
          @media print {
            @page {
              size: A4 landscape;
              margin: 15mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}
      </style>
      <DeliveryNoteTemplate note={data} />
    </div>
  );
};

const DeliveryNotePage = () => {
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingPO, setIsFetchingPO] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 展開與列印狀態
  const [expandedNoteIds, setExpandedNoteIds] = useState([]);
  const [printData, setPrintData] = useState(null);

  const [formData, setFormData] = useState({
    production_order: "",
    note_date: new Date().toISOString().split("T")[0],
    customer_name: "",
    customer_tax_id: "",
    phone: "",
    address: "",
    product_name: "",
    product_code: "",
    spec: "",
    quantity: "",
    unit: "KG",
    unit_price: "",
    used_batch_number: "",
    note: "",
    total_amount: "",
    tax_amount: "",
    grand_total: "",
    document_note: "",
    status: "DRAFT",
  });

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
    fetchDeliveryNotes();
    fetchProductionOrders();
  }, []);

  const fetchDeliveryNotes = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/delivery_notes");
      const json = await res.json();
      setDeliveryNotes(json.data || json || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductionOrders = async () => {
    try {
      const res = await fetchWithAuth("/api/production_orders?is_root=true");
      const json = await res.json();
      setProductionOrders(json.data || json || []);
    } catch (err) {
      console.error("無法載入生產單清單", err);
    }
  };

  const openModal = () => {
    setFormData({
      production_order: "",
      note_date: new Date().toISOString().split("T")[0],
      customer_name: "",
      customer_tax_id: "",
      customer_code: "",
      contact: "",
      phone: "",
      address: "",
      product_name: "",
      product_code: "",
      spec: "",
      quantity: "",
      unit: "KG",
      unit_price: "",
      used_batch_number: "",
      note: "",
      total_amount: "",
      tax_amount: "",
      grand_total: "",
      document_note: "",
      status: "DRAFT",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleProductionOrderChange = async (e) => {
    const poId = e.target.value;
    setFormData((prev) => ({ ...prev, production_order: poId }));
    if (!poId) return;

    setIsFetchingPO(true);
    try {
      const res = await fetchWithAuth(`/api/production_orders/${poId}`);
      if (!res.ok) throw new Error("無法取得生產單資料");

      const poJson = await res.json();
      const data = poJson.data || poJson;
      const vendor = data.vendor_info || {};

      let vendor_detail = {};
      if (vendor?.code) {
        const vres = await fetchWithAuth(
          `/api/vendors/search?q=${vendor.code}`,
        );
        vendor_detail = vres.ok ? (await vres.json()).data : {};
      }
      setFormData((prev) => ({
        ...prev,
        customer_name: vendor.name || vendor_detail.name || "",
        customer_tax_id: vendor.tax_id || vendor_detail.tax_id || "",
        customer_code: vendor?.code || vendor_detail.code || "",
        used_batch_number: data?.used_batch_number || "",
        contact: vendor.contact_person || vendor_detail.contact_person || "",
        phone: vendor.phone || vendor_detail.phone || "",
        address: vendor.address || vendor_detail.address || "",
        product_name: data.product_name || "",
        product_code: data.product_code || "",
        spec: data.spec || "",
        quantity: data.remaining_qty || data.target_qty || "",
      }));
    } catch (error) {
      console.error("載入生產單與客戶資料失敗", error);
    } finally {
      setIsFetchingPO(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const price = parseFloat(formData.unit_price) || 0;
    if (qty > 0 && price > 0) {
      const total = Math.round(qty * price);
      const tax = Math.round(total * 0.05);
      setFormData((prev) => ({
        ...prev,
        total_amount: total,
        tax_amount: tax,
        grand_total: total + tax,
      }));
    }
  }, [formData.quantity, formData.unit_price]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      production_order: parseInt(formData.production_order, 10),
      note: formData.note,
      note_date: formData.note_date,
      quantity: formData.quantity,
      unit: formData.unit,
      spec: formData.spec,
      unit_price: formData.unit_price || null,
      batch_number: formData.batch_number,
      total_amount: formData.total_amount || null,
      tax_amount: formData.tax_amount || null,
      grand_total: formData.grand_total || null,
      document_note: formData.document_note,
      status: formData.status,
      customer_info: {
        name: formData.customer_name,
        tax_id: formData.customer_tax_id,
        contact: formData.contact,
        code: formData.customer_code,
        phone: formData.phone,
        address: formData.address,
      },
    };

    try {
      const res = await fetchWithAuth("/api/delivery_notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("新增失敗");
      await fetchDeliveryNotes();
      closeModal();
      showAlert("儲存成功", "已成功開立銷貨單。", "success");
    } catch (error) {
      showAlert("發生錯誤", error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 展開縮放邏輯
  const handleToggleExpand = (noteId) => {
    if (expandedNoteIds.includes(noteId)) {
      setExpandedNoteIds((prev) => prev.filter((id) => id !== noteId));
    } else {
      setExpandedNoteIds((prev) => [...prev, noteId]);
    }
  };

  const handlePrintRow = (e, note) => {
    if (e) e.stopPropagation();

    setPrintData(note);

    setTimeout(() => {
      const originalTitle = document.title;
      document.title = `銷貨單_${note.note_number}`;
      window.print();
      document.title = originalTitle;
    }, 150);
  };

  const processedNotes = useMemo(() => {
    const list = Array.isArray(deliveryNotes) ? deliveryNotes : [];
    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(
      (n) =>
        (n.note_number && n.note_number.toLowerCase().includes(term)) ||
        (n.customer_info?.name &&
          n.customer_info.name.toLowerCase().includes(term)) ||
        (n.customer_info?.code && n.customer_info.code.includes(term)),
    );
  }, [deliveryNotes, searchTerm]);

  if (loading && deliveryNotes.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="text-lg font-medium text-slate-500 animate-pulse">
          載入銷貨單資料中...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans relative text-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <ReceiptText size={28} strokeWidth={2.5} />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              銷貨單管理
            </h2>
          </div>
        </div>

        <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg border border-blue-100 mb-6">
          <p className="flex items-center gap-2 font-medium mb-1">
            <span className="text-lg">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
            <li>此頁面管理客戶分批出貨的銷貨單據。</li>
            <li>點擊列表可直接展開檢視銷貨單實體樣貌。</li>
            <li>
              點擊「列印」將生成符合格式之實體單據，部分物流相關資訊請於列印後手寫填入。
            </li>
          </ul>
        </div>

        {error && (
          <div className="p-4 mb-6 text-red-700 bg-red-50 rounded-lg border border-red-200">
            ⚠️ {error}
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 mt-2">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
            <input
              type="text"
              placeholder="搜尋單號或客戶名稱..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-72 shadow-sm"
            />
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
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors text-sm font-medium whitespace-nowrap w-full md:w-auto"
          >
            + 開立銷貨單
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-sm text-slate-600 font-semibold">
                <tr>
                  <th className="p-4 w-10 text-center"></th>
                  <th className="p-4 whitespace-nowrap">單據編號</th>
                  <th className="p-4 whitespace-nowrap">單據日期</th>
                  <th className="p-4 whitespace-nowrap">客戶名稱</th>
                  <th className="p-4 whitespace-nowrap text-right">出貨量</th>
                  <th className="p-4 whitespace-nowrap text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {processedNotes.length > 0 ? (
                  processedNotes.map((note) => {
                    const isExpanded = expandedNoteIds.includes(note.id);
                    return (
                      <React.Fragment key={note.id}>
                        <tr
                          className={`hover:bg-blue-50/60 cursor-pointer transition-colors duration-150 ${isExpanded ? "bg-blue-50/30" : ""}`}
                          onClick={() => handleToggleExpand(note.id)}
                        >
                          <td className="p-4 text-center text-slate-400 font-mono text-[10px]">
                            {isExpanded ? "▼" : "▶"}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-700 text-sm">
                            {note.note_number}
                          </td>
                          <td className="p-4 text-slate-600 font-mono text-sm">
                            {note.note_date}
                          </td>
                          <td className="p-4 font-bold text-slate-800">
                            {note.customer_info?.name || "-"}
                          </td>
                          <td className="p-4 text-slate-800 font-mono font-bold text-right text-sm">
                            {Number(note.quantity).toLocaleString()} {note.unit}
                          </td>
                          <td className="p-4 text-center whitespace-nowrap">
                            <button
                              onClick={(e) => handlePrintRow(e, note)}
                              className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-600 hover:text-white transition-all duration-200 text-xs font-bold inline-flex items-center gap-1 shadow-sm"
                            >
                              <Printer size={14} /> 列印
                            </button>
                          </td>
                        </tr>

                        {/* 展開的單據預覽區塊 */}
                        {isExpanded && (
                          <tr>
                            <td
                              colSpan="6"
                              className="p-0 bg-slate-200/50 shadow-inner border-b-4 border-slate-300"
                            >
                              <div className="p-4 md:p-8 overflow-x-auto flex flex-col">
                                <div className="min-w-[800px] max-w-5xl mx-auto w-full shadow-xl ring-1 ring-black/5 bg-white">
                                  <DeliveryNoteTemplate note={note} />
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
                    <td colSpan="6" className="p-12 text-center text-slate-400">
                      找不到符合的銷貨單資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal 表單區塊 (未更動) */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
            <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-xl">
              <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
                <h3 className="text-xl font-bold text-slate-800 tracking-wider">
                  開立銷貨單
                </h3>
                <button
                  onClick={closeModal}
                  className="text-slate-500 hover:text-slate-800 text-2xl leading-none"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 font-sans">
                <div className="flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      連動生產單
                    </label>
                    <select
                      name="production_order"
                      value={formData.production_order}
                      onChange={handleProductionOrderChange}
                      required
                      className="border border-slate-300 rounded text-blue-800 px-3 py-2 w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" disabled>
                        -- 請先選擇生產單 --
                      </option>
                      {productionOrders.map((po) => (
                        <option key={po.id} value={po.id}>
                          #{po.order_number} {po.product_name}
                        </option>
                      ))}
                    </select>
                    {isFetchingPO && (
                      <span className="ml-2 text-blue-500 text-xs">
                        載入中...
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1 text-right">
                      單據日期
                    </label>
                    <input
                      type="date"
                      name="note_date"
                      value={formData.note_date}
                      onChange={handleFormChange}
                      required
                      className="border border-slate-300 rounded px-3 py-2 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-md border border-slate-200 text-sm">
                  <div className="flex border-b border-slate-200 pb-1">
                    <span className="w-20 font-bold text-slate-700">
                      客戶名稱
                    </span>
                    <input
                      type="text"
                      name="customer_name"
                      value={formData.customer_name}
                      onChange={handleFormChange}
                      className="flex-1 bg-transparent focus:outline-none"
                      required
                    />
                  </div>
                  <div className="flex border-b border-slate-200 pb-1">
                    <span className="w-20 font-bold text-slate-700">
                      統一編號
                    </span>
                    <input
                      type="text"
                      name="customer_tax_id"
                      value={formData.customer_tax_id}
                      onChange={handleFormChange}
                      className="flex-1 bg-transparent focus:outline-none"
                    />
                  </div>
                  <div className="flex border-b border-slate-200 pb-1">
                    <span className="w-20 font-bold text-slate-700">電話</span>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleFormChange}
                      className="flex-1 bg-transparent focus:outline-none"
                    />
                  </div>
                  <div className="flex border-b border-slate-200 pb-1">
                    <span className="w-20 font-bold text-slate-700">
                      聯絡人
                    </span>
                    <input
                      type="text"
                      name="contact"
                      value={formData.contact}
                      onChange={handleFormChange}
                      className="flex-1 bg-transparent focus:outline-none"
                    />
                  </div>
                  <div className="flex border-b border-slate-200 pb-1">
                    <span className="w-20 font-bold text-slate-700">
                      送貨地址
                    </span>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleFormChange}
                      className="flex-1 bg-transparent focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border border-slate-300 rounded-md overflow-hidden mb-6">
                  <table className="w-full text-sm text-left bg-white">
                    <thead className="bg-slate-100 border-b border-slate-300">
                      <tr>
                        <th className="p-2 font-bold w-1/4">貨品編號</th>
                        <th className="p-2 font-bold w-1/4">規格</th>
                        <th className="p-2 font-bold w-24">數量</th>
                        <th className="p-2 font-bold w-16">單位</th>
                        <th className="p-2 font-bold w-24">單價</th>
                        <th className="p-2 font-bold w-32">批號編號</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2">
                          <input
                            type="text"
                            name="product_code"
                            value={formData.product_code}
                            onChange={handleFormChange}
                            className="w-full border-b focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            name="spec"
                            value={formData.spec}
                            onChange={handleFormChange}
                            className="w-full border-b focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.0001"
                            name="quantity"
                            value={formData.quantity}
                            onChange={handleFormChange}
                            required
                            className="w-full border-b focus:outline-none font-bold text-blue-700"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            name="unit"
                            value={formData.unit}
                            onChange={handleFormChange}
                            className="w-full border-b focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            name="unit_price"
                            value={formData.unit_price}
                            onChange={handleFormChange}
                            className="w-full border-b focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            name="used_batch_number"
                            value={formData.used_batch_number}
                            onChange={handleFormChange}
                            className="w-full border-b focus:outline-none"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-md border border-slate-200 text-sm">
                  <div className="space-y-3 font-mono">
                    <div className="flex justify-between">
                      <span className="font-bold">合計金額：</span>
                      <input
                        type="number"
                        name="total_amount"
                        value={formData.total_amount}
                        onChange={handleFormChange}
                        className="text-right border-b bg-transparent"
                      />
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">營業稅：</span>
                      <input
                        type="number"
                        name="tax_amount"
                        value={formData.tax_amount}
                        onChange={handleFormChange}
                        className="text-right border-b bg-transparent"
                      />
                    </div>
                    <div className="flex justify-between text-blue-800 font-bold">
                      <span className="text-base">銷貨總額：</span>
                      <input
                        type="number"
                        name="grand_total"
                        value={formData.grand_total}
                        onChange={handleFormChange}
                        className="text-right border-b-2 border-blue-400 bg-transparent text-base"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      單據備註
                    </label>
                    <textarea
                      name="document_note"
                      value={formData.document_note}
                      onChange={handleFormChange}
                      className="w-full border border-slate-300 rounded p-2 focus:outline-none"
                      rows="3"
                    ></textarea>
                    <p className="text-xs text-slate-500 mt-2">
                      *
                      註：車輛溫度、運輸方式等物流資訊，請於列印後交由人員現場手寫填入。
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-5 py-2 bg-slate-100 text-slate-700 font-bold rounded-md"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.production_order}
                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-md disabled:opacity-50"
                  >
                    {isSubmitting ? "處理中..." : "儲存並產生單據號碼"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <CustomDialog
          isOpen={dialog.isOpen}
          {...dialog}
          onClose={closeDialog}
        />
      </div>

      {/* 隱藏的列印區塊 (透過 @media print 呼叫) */}
      {printData && <DeliveryNotePrintTemplate data={printData} />}
    </>
  );
};

export default DeliveryNotePage;

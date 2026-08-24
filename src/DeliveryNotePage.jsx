import React, { useState, useEffect, useMemo } from "react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { ReceiptText, Printer, Trash2, PackageCheck } from "lucide-react";

// ==========================================
// 輔助函數：將浮點數轉字串並移除結尾的 0 與小數點
// ==========================================
const formatDisplayNum = (val) => {
  if (val === null || val === undefined || isNaN(parseFloat(val))) return "";
  return parseFloat(val).toString();
};

const DeliveryNoteTemplate = ({ note }) => {
  if (!note) return null;
  const customer = note.customer_info || {};

  // 取得轉換係數
  const profile = note.production_order_detail?.product_profile || {};
  const unitQty = parseFloat(profile.sales_unit_quantity) || 1;
  const packQty = parseFloat(profile.sales_pack_quantity) || 1;

  // 從規格字串 (spec) 自動萃取每包/桶的淨重 KG (例如 "1KG*25包/箱" 或是 "10KG/桶")
  const specString = note.spec || profile.spec || "";
  const specMatch = specString.match(/([\d.]+)\s*KG/i);
  const weightPerPack = specMatch ? parseFloat(specMatch[1]) : 1;

  // 總出貨包數
  const totalPacks = parseFloat(note.quantity) * (packQty / unitQty);
  // 總出貨重量
  const estimatedWeight = totalPacks * weightPerPack;

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
            <td className="border border-black px-2 py-1 align-top" colSpan="2">
              送貨地址：{customer.address || ""}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse border border-black text-center text-[14px]">
        <thead>
          <tr className="font-normal bg-slate-50/80">
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
            <th className="border border-black px-1 py-1.5 w-[8%] font-normal">
              數量
            </th>
            <th className="border border-black px-1 py-1.5 w-[5%] font-normal">
              單位
            </th>
            <th className="border border-black px-1 py-1.5 w-[8%] font-normal">
              出貨重(KG)
            </th>
            <th className="border border-black px-1 py-1.5 w-[8%] font-normal">
              單價
            </th>
            <th className="border border-black px-1 py-1.5 w-[10%] font-normal">
              小計
            </th>
            <th className="border border-black px-1 py-1.5 w-[7%] font-normal">
              生產批號
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black px-1 py-1.5">1</td>
            <td className="border border-black px-1 py-1.5 text-left">
              {profile?.code || ""}
            </td>
            <td className="border border-black px-1 py-1.5 text-left">
              {profile?.name || ""}
            </td>
            <td className="border border-black px-1 py-1.5">
              {note.spec || ""}
            </td>
            <td className="border border-black px-1 py-1.5 text-right font-bold font-mono">
              {formatDisplayNum(note.quantity)}
            </td>
            <td className="border border-black px-1 py-1.5">
              {note.unit || "箱"}
            </td>
            <td className="border border-black px-1 py-1.5 text-right font-mono">
              {formatDisplayNum(estimatedWeight)}
            </td>
            <td className="border border-black px-1 py-1.5 text-right font-mono">
              {formatDisplayNum(note.sales_price)}
            </td>
            <td className="border border-black px-1 py-1.5 text-right font-mono font-bold">
              {formatDisplayNum(note.total_amount)}
            </td>
            <td className="border border-black px-1 py-1.5 text-[10px] tracking-tighter">
              {note.production_order_detail?.used_batch_number || ""}
            </td>
          </tr>
          {[...Array(2)].map((_, i) => (
            <tr key={i}>
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
          ))}
        </tbody>
      </table>

      {/* 底部金額與物流狀態 */}
      <table className="w-full border-collapse border border-black border-t-0 text-[14px]">
        <tbody>
          <tr>
            <td className="border-r border-b border-black px-2 py-1 align-top w-1/3">
              合計金額：
              <span className="font-mono">
                {formatDisplayNum(note.total_amount)}
              </span>
            </td>
            <td className="border-r border-b border-black px-2 py-1 align-top w-1/3 text-center">
              營業稅：
              <span className="font-mono">
                {formatDisplayNum(note.tax_amount)}
              </span>
            </td>
            <td className="border-b border-black px-2 py-1 align-top w-1/3 text-right">
              銷貨總額：
              <span className="font-mono font-bold text-lg">
                {formatDisplayNum(note.grand_total)}
              </span>
            </td>
          </tr>
          <tr>
            <td className="px-2 py-1 align-top" colSpan="3">
              <div className="flex justify-between mb-1">
                <div className="w-[50%]">
                  單據備註：{note.document_note || ""}
                </div>
                <div className="w-[25%] flex items-center">
                  車輛是否清潔：
                  <span className="inline-block w-4 h-4 border border-black relative ml-[4px]"></span>
                </div>
                <div className="w-[25%] flex items-center">
                  車輛是否上鎖：
                  <span className="inline-block w-4 h-4 border border-black relative ml-[4px]"></span>
                </div>
              </div>
              <div className="flex justify-between">
                <div className="w-[65%]">
                  車輛溫度：
                  <span className="inline-block w-16 border-b border-black"></span>
                  °C 冷藏：凍結點～7°C ，冷凍-12°C以下
                </div>
                <div className="w-[35%]">
                  運輸方式：
                  <span className="inline-block w-32 border-b border-black"></span>
                </div>
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
            @page { size: A4 landscape; margin: 15mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
    customer_code: "",
    contact: "",
    phone: "",
    address: "",
    product_name: "",
    product_code: "",
    spec: "",
    quantity: "",
    unit: "箱",
    sales_unit: "箱",
    sales_pack_unit: "包",
    sales_unit_quantity: 1,
    sales_pack_quantity: 1,
    sales_price: "",
    used_batch_number: "",
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
      unit: "箱",
      sales_unit: "箱",
      sales_pack_unit: "包",
      sales_unit_quantity: 1,
      sales_pack_quantity: 1,
      sales_price: "",
      used_batch_number: "",
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
      const profile = data.product_profile || {};

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
        product_name: profile.name || "",
        product_code: profile.code || "",
        spec: profile.spec || "",
        unit: profile.sales_unit || "箱",
        sales_unit: profile.sales_unit || "箱",
        sales_pack_unit: profile.sales_pack_unit || "包",
        sales_unit_quantity: parseFloat(profile.sales_unit_quantity) || 1,
        sales_pack_quantity: parseFloat(profile.sales_pack_quantity) || 1,
        sales_price: profile.sales_price || 0,
        quantity:
          data.remaining_qty > 0 ? formatDisplayNum(data.remaining_qty) : 1,
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
    const price = parseFloat(formData.sales_price) || 0;
    if (qty > 0 && price >= 0) {
      const total = Math.round(qty * price);
      const tax = Math.round(total * 0.05);
      setFormData((prev) => ({
        ...prev,
        total_amount: total,
        tax_amount: tax,
        grand_total: total + tax,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        total_amount: "",
        tax_amount: "",
        grand_total: "",
      }));
    }
  }, [formData.quantity, formData.sales_price]);

  // 動態計算 Modal 內的出貨重量提示
  const { estimatedModalWeight, weightPerPack } = useMemo(() => {
    const q = parseFloat(formData.quantity) || 0;
    const packQty = parseFloat(formData.sales_pack_quantity) || 1;
    const unitQty = parseFloat(formData.sales_unit_quantity) || 1;

    const specMatch = (formData.spec || "").match(/([\d.]+)\s*KG/i);
    const wPerPack = specMatch ? parseFloat(specMatch[1]) : 1;

    const totalPacks = q * (packQty / unitQty);
    return {
      estimatedModalWeight: totalPacks * wPerPack,
      weightPerPack: wPerPack,
    };
  }, [
    formData.quantity,
    formData.sales_pack_quantity,
    formData.sales_unit_quantity,
    formData.spec,
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      production_order: parseInt(formData.production_order, 10),
      note_date: formData.note_date,
      quantity: formData.quantity,
      unit: formData.unit,
      spec: formData.spec,
      sales_price: formData.sales_price || null,
      batch_number: formData.used_batch_number, // 把批號送出但隱藏於介面
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

  const handleDeleteNote = (e, note) => {
    if (e) e.stopPropagation();
    setDialog({
      isOpen: true,
      type: "confirm",
      status: "warning",
      title: "確認刪除",
      message: `您確定要刪除銷貨單「${note.note_number}」嗎？此操作會標記為作廢並歸還生產單剩餘產量。`,
      onConfirm: async () => {
        closeDialog();
        try {
          const res = await fetchWithAuth(`/api/delivery_notes/${note.id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("刪除失敗");
          showAlert(
            "刪除成功",
            `銷貨單 ${note.note_number} 已作廢。`,
            "success",
          );
          fetchDeliveryNotes();
          fetchProductionOrders();
        } catch (error) {
          showAlert("刪除錯誤", error.message, "error");
        }
      },
    });
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
                            {formatDisplayNum(note.quantity)} {note.unit}
                          </td>
                          <td className="p-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={(e) => handlePrintRow(e, note)}
                                className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-600 hover:text-white transition-all duration-200 text-xs font-bold inline-flex items-center gap-1 shadow-sm"
                              >
                                <Printer size={14} /> 列印
                              </button>
                              <button
                                onClick={(e) => handleDeleteNote(e, note)}
                                className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-600 hover:text-white transition-all duration-200 text-xs font-bold inline-flex items-center gap-1 shadow-sm"
                                title="刪除單據"
                              >
                                <Trash2 size={14} /> 刪除
                              </button>
                            </div>
                          </td>
                        </tr>

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

        {/* ========================================== */}
        {/* 開立銷貨單 Modal (Apple UI/UX 升級版) */}
        {/* ========================================== */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
            <div className="bg-slate-50 max-w-5xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
              <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 p-5 flex justify-between items-center z-10">
                <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                  <ReceiptText className="text-blue-600" />
                  開立銷貨單
                </h3>
                <button
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-700 text-3xl leading-none transition-colors"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 md:p-8 font-sans">
                {/* 頂部：連動生產單與日期 */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end pb-5 mb-6 gap-4 border-b border-slate-200">
                  <div className="w-full md:w-auto">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      連動生產單 <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="production_order"
                      value={formData.production_order}
                      onChange={handleProductionOrderChange}
                      required
                      className="border border-blue-300 rounded-xl text-blue-900 bg-white px-4 py-2.5 w-full md:w-80 focus:outline-none focus:ring-4 focus:ring-blue-500/10 font-bold shadow-sm cursor-pointer transition-all"
                    >
                      <option value="" disabled>
                        -- 請下拉選擇生產單 --
                      </option>
                      {productionOrders.map((po) => (
                        <option
                          key={po.id}
                          value={po.id}
                          disabled={po.is_fully_delivered}
                        >
                          [{po.order_number}] {po.product_profile?.name || ""}{" "}
                          {po.is_fully_delivered ? " (已出清)" : ""}
                        </option>
                      ))}
                    </select>
                    {isFetchingPO && (
                      <span className="ml-3 text-blue-500 text-xs font-bold animate-pulse">
                        資料載入中...
                      </span>
                    )}
                  </div>
                  <div className="w-full md:w-auto">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 md:text-right">
                      單據日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="note_date"
                      value={formData.note_date}
                      onChange={handleFormChange}
                      required
                      className="border border-slate-300 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm w-full md:w-48 font-mono text-sm font-bold text-slate-700 transition-all"
                    />
                  </div>
                </div>

                {/* 客戶資訊表單 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      客戶名稱
                    </span>
                    <input
                      type="text"
                      name="customer_name"
                      value={formData.customer_name}
                      onChange={handleFormChange}
                      className="w-full bg-transparent focus:outline-none text-slate-800 font-bold text-sm"
                      required
                    />
                  </div>
                  <div className="flex flex-col border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      統一編號
                    </span>
                    <input
                      type="text"
                      name="customer_tax_id"
                      value={formData.customer_tax_id}
                      onChange={handleFormChange}
                      className="w-full bg-transparent focus:outline-none text-slate-700 font-mono text-sm"
                    />
                  </div>
                  <div className="flex flex-col border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      聯絡電話
                    </span>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleFormChange}
                      className="w-full bg-transparent focus:outline-none text-slate-700 font-mono text-sm"
                    />
                  </div>
                  <div className="flex flex-col border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      聯絡人
                    </span>
                    <input
                      type="text"
                      name="contact"
                      value={formData.contact}
                      onChange={handleFormChange}
                      className="w-full bg-transparent focus:outline-none text-slate-700 text-sm"
                    />
                  </div>
                  <div className="flex flex-col md:col-span-2 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      送貨地址
                    </span>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleFormChange}
                      className="w-full bg-transparent focus:outline-none text-slate-700 text-sm"
                    />
                  </div>
                </div>

                {/* 卡片式的出貨明細設定 (Apple Style) */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-8 shadow-sm">
                  <div className="bg-slate-50/80 border-b border-slate-200 px-5 py-3.5 flex items-center gap-2">
                    <PackageCheck size={18} className="text-slate-700" />
                    <span className="font-bold text-slate-700 text-sm">
                      出貨明細設定
                    </span>
                  </div>
                  <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 區塊 1: 產品資訊 */}
                    <div className="flex flex-col gap-4">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        產品資訊
                      </label>
                      <div className="flex flex-col gap-3">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-center min-h-[4.5rem]">
                          <span className="text-[10px] font-bold text-slate-400 mb-1 font-mono tracking-wider">
                            {formData.product_code || "-"}
                          </span>
                          <span className="font-extrabold text-slate-800 text-[15px] leading-tight truncate">
                            {formData.product_name || "-"}
                          </span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between min-h-[3.5rem]">
                          <span className="text-xs font-bold text-slate-500">
                            包裝規格
                          </span>
                          <span className="text-sm font-bold text-slate-700 font-mono">
                            {formData.spec || "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 區塊 2: 數量與重量換算 */}
                    <div className="flex flex-col gap-4">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        出貨數量與重量估算
                      </label>
                      <div className="flex flex-col gap-3 h-full">
                        {/* 輸入框 */}
                        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                          <span className="text-sm font-bold text-slate-700">
                            出貨量 <span className="text-red-500">*</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              name="quantity"
                              value={formData.quantity}
                              onChange={handleFormChange}
                              required
                              className="w-20 text-right font-black text-blue-600 text-lg focus:outline-none bg-transparent"
                              placeholder="0"
                            />
                            <span className="font-bold text-slate-500 text-sm">
                              {formData.sales_unit}
                            </span>
                          </div>
                        </div>

                        {/* 換算公式面板 */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex-1 flex flex-col justify-center gap-2">
                          {formData.sales_pack_unit !== formData.sales_unit && (
                            <div className="flex justify-between items-center text-xs font-bold text-slate-500 font-mono">
                              <span>包材結構</span>
                              <span className="text-slate-700">
                                1 {formData.sales_unit} ={" "}
                                {formData.sales_pack_quantity}{" "}
                                {formData.sales_pack_unit}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs font-bold text-slate-500 font-mono pb-2 border-b border-slate-200/60">
                            <span>包材重量</span>
                            <span className="text-slate-700">
                              1 {formData.sales_pack_unit} ={" "}
                              {formatDisplayNum(weightPerPack)} KG
                            </span>
                          </div>
                          <div className="flex justify-between items-end pt-1">
                            <span className="text-sm font-bold text-slate-700">
                              總出貨重
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-black text-slate-700 font-mono tracking-tight">
                                {formatDisplayNum(estimatedModalWeight)}
                              </span>
                              <span className="text-xs font-bold text-slate-700">
                                KG
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 區塊 3: 銷售金額 */}
                    <div className="flex flex-col gap-4">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        銷售金額 (未稅)
                      </label>
                      <div className="flex flex-col gap-3 h-full">
                        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                          <span className="text-sm font-bold text-slate-700">
                            單價
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-mono font-bold">
                              $
                            </span>
                            <input
                              type="number"
                              name="sales_price"
                              value={formData.sales_price}
                              onChange={handleFormChange}
                              className="w-24 text-right font-bold text-slate-800 text-base focus:outline-none bg-transparent"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex-1 flex flex-col justify-end items-end">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            小計金額
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm text-slate-500 font-mono font-bold">
                              $
                            </span>
                            <span className="text-3xl font-black font-mono text-slate-800 tracking-tight">
                              {formatDisplayNum(
                                parseFloat(formData.quantity || 0) *
                                  parseFloat(formData.sales_price || 0),
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-sm">
                  <div className="space-y-4 font-mono bg-slate-50 p-5 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="font-bold text-slate-500 font-sans">
                        合計金額 (未稅)
                      </span>
                      <span className="font-bold text-slate-700">
                        $ {formatDisplayNum(formData.total_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="font-bold text-slate-500 font-sans">
                        營業稅 (5%)
                      </span>
                      <span className="font-bold text-slate-700">
                        $ {formatDisplayNum(formData.tax_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-base font-extrabold text-[#1f4e78] font-sans">
                        銷貨總額
                      </span>
                      <span className="text-3xl font-black text-blue-600 tracking-tight">
                        $ {formatDisplayNum(formData.grand_total)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col h-full">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      單據備註事項
                    </label>
                    <textarea
                      name="document_note"
                      value={formData.document_note}
                      onChange={handleFormChange}
                      className="w-full flex-1 border border-slate-200 rounded-xl p-4 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 bg-slate-50 focus:bg-white transition-all resize-none text-slate-700 text-sm"
                      placeholder="請輸入欲顯示於銷貨單上的備註事項..."
                    ></textarea>
                    <p className="text-[10px] font-bold text-slate-400 mt-2 text-right">
                      * 註：物流車輛溫度等資訊，請於列印單據後手寫。
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.production_order}
                    className="px-8 py-2.5 bg-[#1f4e78] text-white font-bold rounded-xl disabled:opacity-50 hover:bg-blue-900 shadow-md transition-all hover:-translate-y-0.5"
                  >
                    {isSubmitting ? "處理中..." : "儲存並產生單據"}
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

      {/* 隱藏的列印區塊 */}
      {printData && <DeliveryNotePrintTemplate data={printData} />}
    </>
  );
};

export default DeliveryNotePage;

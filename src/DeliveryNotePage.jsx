import React, { useState, useEffect, useMemo } from "react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import {
  ReceiptText,
  Printer,
  Trash2,
  PackageCheck,
  Search,
  Plus,
} from "lucide-react";

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
    <div className="bg-white font-sans text-black relative p-6 print:p-0">
      <div className="flex items-end mb-2 w-full">
        <div className="flex-1 text-sm leading-relaxed">
          <span className="text-lg font-bold">基香食品有限公司</span>
          <br />
          桃園市觀音區崙坪里1鄰1-10號
          <br />電 話：03-4988228 <span className="ml-4"></span>傳
          真：03-4988159
        </div>

        <h1 className="text-3xl font-bold tracking-[1em] m-0 text-center pl-[1em] whitespace-nowrap">
          銷貨單
        </h1>

        <div className="flex-1 text-sm text-right">第 1 頁,共 1 頁</div>
      </div>

      {/* 客戶與單據資訊表 */}
      <table className="w-full border-collapse border border-black mb-2 text-sm">
        <tbody>
          <tr>
            <td className="border border-black px-3 py-1 align-top w-1/3">
              客戶名稱：{customer.name || ""}
            </td>
            <td className="border border-black px-3 py-1 align-top w-1/3">
              客戶編號：{customer.code || ""}
            </td>
            <td className="border border-black px-3 py-1 align-top w-1/3">
              單據日期：{note.note_date || ""}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 align-top">
              客戶統編：{customer.tax_id || ""}
            </td>
            <td className="border border-black px-3 py-1 align-top">
              聯絡人：{customer.contact || ""}
            </td>
            <td className="border border-black px-3 py-1 align-top">
              單據編號：{note.note_number || ""}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1 align-top">
              客戶電話：{customer.phone || ""}
            </td>
            <td className="border border-black px-3 py-1 align-top" colSpan="2">
              送貨地址：{customer.address || ""}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse border border-black text-center text-sm">
        <thead>
          <tr className="font-normal">
            <th className="border border-black px-2 py-1 w-[5%] font-normal">
              序
            </th>
            <th className="border border-black px-2 py-1 w-[15%] font-normal">
              貨品編號
            </th>
            <th className="border border-black px-2 py-1 w-[20%] font-normal">
              品名
            </th>
            <th className="border border-black px-2 py-1 w-[15%] font-normal">
              規格
            </th>
            <th className="border border-black px-2 py-1 w-[8%] font-normal">
              數量
            </th>
            <th className="border border-black px-2 py-1 w-[5%] font-normal">
              單位
            </th>
            <th className="border border-black px-2 py-1 w-[8%] font-normal">
              出貨重(KG)
            </th>
            <th className="border border-black px-2 py-1 w-[8%] font-normal">
              單價
            </th>
            <th className="border border-black px-2 py-1 w-[10%] font-normal">
              小計
            </th>
            <th className="border border-black px-2 py-1 w-[7%] font-normal">
              生產批號
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1">1</td>
            <td className="border border-black px-2 py-1 text-left">
              {profile?.code || ""}
            </td>
            <td className="border border-black px-2 py-1 text-left">
              {profile?.name || ""}
            </td>
            <td className="border border-black px-2 py-1">{note.spec || ""}</td>
            <td className="border border-black px-2 py-1 text-right font-mono font-medium">
              {formatDisplayNum(note.quantity)}
            </td>
            <td className="border border-black px-2 py-1">
              {note.unit || "箱"}
            </td>
            <td className="border border-black px-2 py-1 text-right font-mono font-medium">
              {formatDisplayNum(estimatedWeight)}
            </td>
            <td className="border border-black px-2 py-1 text-right font-mono font-medium">
              {formatDisplayNum(note.sales_price)}
            </td>
            <td className="border border-black px-2 py-1 text-right font-mono font-bold">
              {formatDisplayNum(note.total_amount)}
            </td>
            <td className="border border-black px-2 py-1 text-xs tracking-tighter font-mono">
              {note.production_order_detail?.used_batch_number || ""}
            </td>
          </tr>
          {[...Array(2)].map((_, i) => (
            <tr key={i}>
              <td className="border border-black px-2 py-1 text-transparent">
                .
              </td>
              <td className="border border-black px-2 py-1"></td>
              <td className="border border-black px-2 py-1"></td>
              <td className="border border-black px-2 py-1"></td>
              <td className="border border-black px-2 py-1"></td>
              <td className="border border-black px-2 py-1"></td>
              <td className="border border-black px-2 py-1"></td>
              <td className="border border-black px-2 py-1"></td>
              <td className="border border-black px-2 py-1"></td>
              <td className="border border-black px-2 py-1"></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 底部金額與物流狀態 */}
      <table className="w-full border-collapse border border-black border-t-0 text-sm">
        <tbody>
          <tr>
            <td className="border-r border-b border-black px-3 py-1 align-top w-1/3">
              合計金額：
              <span className="font-mono">
                {formatDisplayNum(note.total_amount)}
              </span>
            </td>
            <td className="border-r border-b border-black px-3 py-1 align-top w-1/3 text-center">
              營業稅：
              <span className="font-mono">
                {formatDisplayNum(note.tax_amount)}
              </span>
            </td>
            <td className="border-b border-black px-3 py-1 align-top w-1/3 text-right">
              銷貨總額：
              <span className="font-mono font-bold">
                {formatDisplayNum(note.grand_total)}
              </span>
            </td>
          </tr>
          <tr>
            <td className="px-3 py-2 align-top" colSpan="3">
              <div className="flex justify-between mb-2">
                <div className="w-[50%]">
                  單據備註：{note.document_note || ""}
                </div>
                <div className="w-[25%] flex items-center">
                  車輛是否清潔：
                  <div className="w-5 h-5 border border-black ml-2 inline-block"></div>
                </div>
                <div className="w-[25%] flex items-center">
                  車輛是否上鎖：
                  <div className="w-5 h-5 border border-black ml-2 inline-block"></div>
                </div>
              </div>
              <div className="flex justify-between">
                <div className="w-[65%]">
                  車輛溫度：
                  <span className="inline-block w-16 border-b border-black mx-1"></span>
                  °C 冷藏：凍結點～7°C ，冷凍-12°C以下
                </div>
                <div className="w-[35%]">
                  運輸方式：
                  <span className="inline-block w-32 border-b border-black mx-1"></span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 簽名區塊 */}
      <div className="flex justify-between mt-3 px-6 text-sm">
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
        <div className="animate-pulse text-slate-500 font-semibold text-xl">
          載入銷貨單資料中...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-900 w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              銷貨單管理
            </h2>
          </div>
        </div>

        {/* 系統功能說明 Banner（完全對齊 Template） */}
        <div className="bg-blue-50/70 backdrop-blur-md text-blue-900 text-sm p-5 md:p-6 rounded-3xl mb-10 border border-blue-200/60 shadow-sm print:hidden">
          <p className="flex items-center gap-2 font-semibold mb-3 text-lg">
            <span className="text-xl">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-700 font-medium">
            <li>此頁面管理客戶分批出貨的銷貨單據。</li>
            <li>點擊列表可直接展開檢視銷貨單實體樣貌。</li>
            <li>
              點擊「列印」將生成符合格式之實體單據，部分物流相關資訊請於列印後手寫填入。
            </li>
          </ul>
        </div>

        {error && (
          <div className="p-5 mb-8 text-red-700 bg-red-50/80 rounded-2xl border border-red-200 shadow-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* 頂部操作工具列 */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-5 w-full">
          <div className="relative w-full md:w-80">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="搜尋單號或客戶名稱..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-[48px] pl-11 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none shadow-sm transition-all text-slate-800"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 bg-slate-200/60 rounded-lg px-2 py-1 transition-colors"
              >
                清除
              </button>
            )}
          </div>

          <button
            onClick={() => openModal()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm hover:-translate-y-1 w-full md:w-auto whitespace-nowrap"
          >
            <Plus size={18} strokeWidth={2.5} /> 開立銷貨單
          </button>
        </div>

        {/* 銷貨單表格 */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8 min-h-[400px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500 font-medium tracking-wide">
                <tr>
                  <th className="py-4 px-5 w-12 text-center"></th>
                  <th className="py-4 px-5">單據編號</th>
                  <th className="py-4 px-5">單據日期</th>
                  <th className="py-4 px-5">客戶名稱</th>
                  <th className="py-4 px-5 text-right">出貨量</th>
                  <th className="py-4 px-5 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm bg-white">
                {processedNotes.length > 0 ? (
                  processedNotes.map((note) => {
                    const isExpanded = expandedNoteIds.includes(note.id);
                    return (
                      <React.Fragment key={note.id}>
                        <tr
                          className={`hover:bg-blue-50/30 cursor-pointer transition-colors group ${isExpanded ? "bg-blue-50/30" : ""}`}
                          onClick={() => handleToggleExpand(note.id)}
                        >
                          <td className="py-4 px-5 text-center text-slate-300 text-sm font-semibold group-hover:text-blue-500 transition-colors">
                            {isExpanded ? "▼" : "▶"}
                          </td>
                          <td className="py-4 px-5 font-mono font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                            {note.note_number}
                          </td>
                          <td className="py-4 px-5 text-slate-500 font-mono text-sm">
                            {note.note_date}
                          </td>
                          <td className="py-4 px-5 font-semibold text-slate-800 text-base">
                            {note.customer_info?.name || "-"}
                          </td>
                          <td className="py-4 px-5 text-slate-900 font-mono font-bold text-right text-base">
                            {formatDisplayNum(note.quantity)}{" "}
                            <span className="text-slate-400 font-medium text-sm ml-1">
                              {note.unit}
                            </span>
                          </td>
                          <td
                            className="py-4 px-5 text-center whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={(e) => handlePrintRow(e, note)}
                                className="px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all duration-300 text-sm font-semibold shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
                              >
                                <Printer size={14} strokeWidth={2.5} /> 列印
                              </button>
                              <button
                                onClick={(e) => handleDeleteNote(e, note)}
                                className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-500 hover:text-white transition-all duration-300 font-semibold text-sm shadow-sm whitespace-nowrap flex items-center justify-center gap-1.5"
                                title="刪除單據"
                              >
                                <Trash2 size={14} strokeWidth={2.5} /> 刪除
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td
                              colSpan="6"
                              className="p-0 bg-slate-50/50 shadow-[inset_0_4px_12px_-4px_rgba(0,0,0,0.05)] border-b border-slate-200"
                            >
                              <div className="p-6 md:p-8 overflow-x-auto flex flex-col">
                                <div className="min-w-[800px] max-w-5xl mx-auto w-full shadow-xl ring-1 ring-black/5 rounded-2xl overflow-hidden bg-white">
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
                    <td
                      colSpan="6"
                      className="py-16 text-center text-slate-400 font-medium"
                    >
                      找不到符合的銷貨單資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================== */}
        {/* 開立銷貨單 Modal */}
        {/* ========================================== */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-slate-50 max-w-5xl w-full max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
              {/* Modal Header */}
              <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200 p-6 flex justify-between items-center z-10 shadow-sm shrink-0">
                <h3 className="text-xl font-bold text-slate-900 tracking-wide flex items-center gap-3">
                  <ReceiptText className="text-blue-600" size={26} />
                  開立銷貨單
                </h3>
                <button
                  onClick={closeModal}
                  className="text-slate-400 hover:text-red-500 text-3xl leading-none transition-colors"
                >
                  &times;
                </button>
              </div>

              {/* Modal Body */}
              <form
                onSubmit={handleSubmit}
                className="overflow-y-auto p-6 md:p-8 flex-1 bg-slate-50/50 font-sans space-y-8"
              >
                {/* 頂部：連動生產單與日期 */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">
                        連動生產單 <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          name="production_order"
                          value={formData.production_order}
                          onChange={handleProductionOrderChange}
                          required
                          className="appearance-none w-full h-11 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer text-slate-800"
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
                              [{po.order_number}]{" "}
                              {po.product_profile?.name || ""}{" "}
                              {po.is_fully_delivered ? " (已出清)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      {isFetchingPO && (
                        <span className="mt-2 inline-block text-blue-600 text-xs font-semibold animate-pulse">
                          資料載入中...
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">
                        單據日期 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="note_date"
                        value={formData.note_date}
                        onChange={handleFormChange}
                        required
                        className="w-full h-11 px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-slate-800 text-sm font-medium transition-all shadow-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 客戶資訊表單 */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  <h4 className="text-base font-semibold text-slate-700 tracking-wide border-b border-slate-100 pb-3">
                    客戶基本資料
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">
                        客戶名稱 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="customer_name"
                        value={formData.customer_name}
                        onChange={handleFormChange}
                        className="w-full h-11 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white text-slate-800 text-sm font-medium transition-all shadow-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">
                        統一編號
                      </label>
                      <input
                        type="text"
                        name="customer_tax_id"
                        value={formData.customer_tax_id}
                        onChange={handleFormChange}
                        className="w-full h-11 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white text-slate-800 text-sm font-medium transition-all shadow-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">
                        聯絡電話
                      </label>
                      <input
                        type="text"
                        name="phone"
                        value={formData.phone}
                        onChange={handleFormChange}
                        className="w-full h-11 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white text-slate-800 text-sm font-medium transition-all shadow-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">
                        聯絡人
                      </label>
                      <input
                        type="text"
                        name="contact"
                        value={formData.contact}
                        onChange={handleFormChange}
                        className="w-full h-11 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white text-slate-800 text-sm font-medium transition-all shadow-sm"
                      />
                    </div>
                    <div className="md:col-span-2 lg:col-span-4">
                      <label className="block text-sm font-medium text-slate-500 mb-2">
                        送貨地址
                      </label>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleFormChange}
                        className="w-full h-11 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white text-slate-800 text-sm font-medium transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* 出貨明細設定 */}
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50/80 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
                    <PackageCheck size={20} className="text-blue-600" />
                    <span className="font-semibold text-slate-800 text-base">
                      出貨明細設定
                    </span>
                  </div>
                  <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 區塊 1: 產品資訊 */}
                    <div className="flex flex-col gap-4">
                      <label className="text-sm font-semibold text-slate-500 tracking-wide">
                        產品資訊
                      </label>
                      <div className="flex flex-col gap-3">
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-center min-h-[5rem]">
                          <span className="text-xs font-medium text-slate-400 mb-1 font-mono tracking-wider">
                            {formData.product_code || "-"}
                          </span>
                          <span className="font-bold text-slate-800 text-base leading-tight truncate">
                            {formData.product_name || "-"}
                          </span>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex items-center justify-between min-h-[4rem]">
                          <span className="text-sm font-medium text-slate-500">
                            包裝規格
                          </span>
                          <span className="text-sm font-semibold text-slate-700 font-mono">
                            {formData.spec || "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 區塊 2: 數量與重量換算 */}
                    <div className="flex flex-col gap-4">
                      <label className="text-sm font-semibold text-slate-500 tracking-wide">
                        出貨數量與重量估算
                      </label>
                      <div className="flex flex-col gap-3 h-full">
                        {/* 輸入框 */}
                        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                          <span className="text-sm font-semibold text-slate-700">
                            出貨量 <span className="text-red-500">*</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              name="quantity"
                              value={formData.quantity}
                              onChange={handleFormChange}
                              required
                              className="w-24 text-right font-mono font-bold text-blue-600 text-xl focus:outline-none bg-transparent"
                              placeholder="0"
                            />
                            <span className="font-medium text-slate-500 text-sm">
                              {formData.sales_unit}
                            </span>
                          </div>
                        </div>

                        {/* 換算公式面板 */}
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex-1 flex flex-col justify-center gap-2.5">
                          {formData.sales_pack_unit !== formData.sales_unit && (
                            <div className="flex justify-between items-center text-sm font-medium text-slate-500 font-mono">
                              <span>包材結構</span>
                              <span className="text-slate-700 font-semibold">
                                1 {formData.sales_unit} ={" "}
                                {formData.sales_pack_quantity}{" "}
                                {formData.sales_pack_unit}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-sm font-medium text-slate-500 font-mono pb-2 border-b border-slate-200/60">
                            <span>包材重量</span>
                            <span className="text-slate-700 font-semibold">
                              1 {formData.sales_pack_unit} ={" "}
                              {formatDisplayNum(weightPerPack)} KG
                            </span>
                          </div>
                          <div className="flex justify-between items-end pt-1">
                            <span className="text-sm font-semibold text-slate-700">
                              總出貨重
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold text-slate-800 font-mono tracking-tight">
                                {formatDisplayNum(estimatedModalWeight)}
                              </span>
                              <span className="text-sm font-semibold text-slate-500">
                                KG
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 區塊 3: 銷售金額 */}
                    <div className="flex flex-col gap-4">
                      <label className="text-sm font-semibold text-slate-500 tracking-wide">
                        銷售金額 (未稅)
                      </label>
                      <div className="flex flex-col gap-3 h-full">
                        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                          <span className="text-sm font-semibold text-slate-700">
                            單價
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-mono font-medium">
                              $
                            </span>
                            <input
                              type="number"
                              name="sales_price"
                              value={formData.sales_price}
                              onChange={handleFormChange}
                              className="w-28 text-right font-mono font-bold text-slate-800 text-lg focus:outline-none bg-transparent"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-blue-50/50 to-blue-100/30 border border-blue-200 rounded-2xl p-5 flex-1 flex flex-col justify-end items-end shadow-sm">
                          <span className="text-xs font-semibold text-blue-700 tracking-wide mb-1">
                            小計金額
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-semibold font-mono text-blue-600">
                              $
                            </span>
                            <span className="text-3xl font-bold font-mono text-blue-700 tracking-tight">
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

                {/* 底部總計與備註 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <label className="block text-base font-semibold text-slate-600 tracking-wide mb-4">
                      單據備註事項
                    </label>
                    <textarea
                      name="document_note"
                      value={formData.document_note}
                      onChange={handleFormChange}
                      className="w-full flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none resize-none text-sm font-medium transition-all shadow-inner text-slate-800 min-h-[120px]"
                      placeholder="請輸入欲顯示於銷貨單上的備註事項..."
                    ></textarea>
                    <p className="text-xs font-medium text-slate-400 mt-3 text-right">
                      * 註：物流車輛溫度等資訊，請於列印單據後手寫。
                    </p>
                  </div>

                  <div className="flex flex-col justify-end bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-base text-slate-500 font-semibold tracking-wide">
                          合計金額 (未稅)
                        </span>
                        <span className="text-xl font-mono font-medium text-slate-800">
                          $ {formatDisplayNum(formData.total_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-base text-slate-500 font-semibold tracking-wide">
                          營業稅 (5%)
                        </span>
                        <span className="text-xl font-mono font-medium text-slate-800">
                          $ {formatDisplayNum(formData.tax_amount)}
                        </span>
                      </div>
                      <div className="pt-5 mt-4 border-t-2 border-slate-100 flex justify-between items-end">
                        <span className="text-lg font-bold text-slate-900 tracking-wide">
                          銷貨總額
                        </span>
                        <span className="text-4xl font-bold font-mono text-blue-600 tracking-tighter">
                          $ {formatDisplayNum(formData.grand_total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 表單送出按鈕 */}
                <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-8 py-3.5 bg-white text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors border border-slate-200 text-base shadow-sm"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.production_order}
                    className="px-10 py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-md hover:-translate-y-1 transition-all disabled:opacity-50 disabled:transform-none disabled:shadow-none flex items-center gap-2 text-base"
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

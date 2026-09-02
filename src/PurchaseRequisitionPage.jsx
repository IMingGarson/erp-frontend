import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  ChevronDown,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { CompanyLogo } from "./components/companyLogo";
import { useAuthStore } from "./store/authStore";

const ITEMS_PER_PAGE = 10;

const STATUS_MAP = {
  WAITING: {
    label: "等待進貨",
    css: "bg-amber-100 text-amber-700 border-amber-200",
  },
  STOCKED: {
    label: "已經入庫",
    css: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
};

const StatusTag = ({ status }) => {
  const statusData = STATUS_MAP[(status || "").toUpperCase()] || {
    label: status,
    css: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`inline-block text-center min-w-[64px] px-3 py-1 rounded-full text-[11px] tracking-wide font-bold border ${statusData.css}`}
    >
      {statusData.label}
    </span>
  );
};

// ==========================================
// 輔助函數：將浮點數轉字串並移除結尾的 0 與小數點
// ==========================================
const formatDisplayNum = (val) => {
  if (val === null || val === undefined || val === "") return "";
  const n = Number(val);
  return isNaN(n) ? val : n.toString();
};

// ==========================================
// 核心：規格正則解析引擎
// ==========================================
const parseSpecString = (specStr, baseUnit = "KG") => {
  if (!specStr) return null;

  let str = specStr.toString().toUpperCase().replace(/\s+/g, "");

  const abbrMap = {
    CTN: "箱",
    CARTON: "箱",
    PCS: "件",
    EA: "件",
    BTL: "瓶",
    公升: "L",
    公斤: "KG",
    公克: "G",
  };

  for (const [key, val] of Object.entries(abbrMap)) {
    str = str.split(key).join(val);
  }

  const isWeightOrVolume = ["KG", "K", "G", "L", "ML"].includes(
    baseUnit.toUpperCase(),
  );

  const complexMatch = str.match(
    /([\d.]+)[A-Z\u4e00-\u9fa5\/]*[*X]([\d.]+)[A-Z\u4e00-\u9fa5]*\/([A-Z\u4e00-\u9fa5]+)/,
  );

  if (complexMatch) {
    const innerWeight = parseFloat(complexMatch[1]);
    const count = parseFloat(complexMatch[2]);
    const outerUnit = complexMatch[3];

    const finalQty = isWeightOrVolume
      ? parseFloat((innerWeight * count).toFixed(4))
      : count;

    return { auxQuantity: finalQty, auxUnit: outerUnit };
  }

  const simpleMatch = str.match(
    /([\d.]+)[A-Z\u4e00-\u9fa5]*\/([A-Z\u4e00-\u9fa5]+)/,
  );
  if (simpleMatch) {
    let unit = simpleMatch[2].replace(/紙袋/g, "袋");
    return { auxQuantity: parseFloat(simpleMatch[1]), auxUnit: unit };
  }

  if (
    str.includes("*") &&
    (str.includes("CM") || str.includes("MM") || /[\d]+\*[\d]+/.test(str))
  ) {
    return { auxQuantity: 1, auxUnit: "件" };
  }

  if (str.includes("KG/包") || str.includes("K/包")) {
    return { auxQuantity: 1, auxUnit: "包" };
  }

  const weightMatch = str.match(/(?:^|[^\d.])([\d.]+)(?:KG|K|G|L|件)/);
  if (weightMatch) {
    return { auxQuantity: parseFloat(weightMatch[1]), auxUnit: "件" };
  }

  return null;
};

// ==========================================
// 列印專用 Template
// ==========================================
const PurchaseRequisitionPrintTemplate = ({ data }) => {
  if (!data) return null;

  const printItems = [...(data.items || [])];
  while (printItems.length < 7) {
    printItems.push({});
  }

  const [printYear, printMonth, printDay] = data.request_date
    ? data.request_date.split("-")
    : ["      ", "    ", "    "];

  return (
    <div
      className="hidden print:block w-full bg-white text-black font-sans mx-auto print:p-8"
      style={{ maxWidth: "210mm" }}
    >
      <style>{`@media print { @page { margin: 0; } }`}</style>
      <div className="flex border-2 border-black">
        <div className="w-[15%] border-r-2 border-black flex items-center justify-center p-3 overflow-hidden">
          <CompanyLogo className="w-16 h-16 scale-110" />
        </div>
        <div className="w-[85%] flex flex-col text-center">
          <div className="text-2xl font-bold border-b-2 border-black py-2 tracking-[0.2em]">
            基香食品有限公司
          </div>
          <div className="text-2xl font-bold py-2 tracking-[0.5em]">請購單</div>
        </div>
      </div>

      <div className="border-x-2 border-black px-2 py-3 text-[15px] font-bold">
        填單日期：<span className="mx-1">{printYear}</span>年
        <span className="mx-1">{printMonth}</span>月
        <span className="mx-1">{printDay}</span>日
      </div>

      <table className="w-full border-collapse border-2 border-black text-center text-sm font-bold">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="border-r border-black p-2 font-normal w-10">NO</th>
            <th className="border-r border-black p-2 font-normal">
              物料名稱與包裝規格
            </th>
            <th className="border-r border-black p-2 font-normal w-24">
              總基本數量
            </th>
            <th className="border-r border-black p-2 font-normal w-20">
              指定到貨日
            </th>
            <th className="border-r border-black p-2 font-normal w-24">
              供應商
            </th>
            <th className="border-r border-black p-2 font-normal w-24">
              現庫存量
            </th>
            <th className="p-2 font-normal w-16">備註</th>
          </tr>
        </thead>
        <tbody>
          {printItems.map((item, idx) => {
            let deliveryStr = "";
            if (item.expected_delivery_date) {
              const parts = item.expected_delivery_date.split("-");
              if (parts.length === 3) deliveryStr = `${parts[1]}/${parts[2]}`;
            }

            return (
              <tr
                key={idx}
                className="border-b border-black last:border-b-0 h-10"
              >
                <td className="border-r border-black p-1">{idx + 1}</td>
                <td className="border-r border-black p-1 text-left px-2 text-lg">
                  {item.material_name || ""}
                  {item.in_stock_spec ? ` (${item.in_stock_spec})` : ""}
                </td>
                <td className="border-r border-black p-1 text-xl">
                  {item.quantity
                    ? `${formatDisplayNum(item.quantity)} ${item.unit || ""}`
                    : ""}
                </td>
                <td className="border-r border-black p-1 text-lg">
                  {deliveryStr}
                </td>
                <td className="border-r border-black p-1 text-lg">
                  {item.provider_name || ""}
                </td>
                <td className="border-r border-black p-1"></td>
                <td className="p-1 text-lg">{item.note || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex justify-between items-end mt-4 px-4 font-bold text-lg">
        <div className="w-1/3">主管：</div>
        <div className="w-1/3">採購：</div>
        <div className="w-1/3">
          請購：
          <span className="ml-2 font-normal italic text-xl border-b border-black min-w-[80px] inline-block text-center">
            {data.applicant}
          </span>
        </div>
      </div>

      <div className="text-right mt-6 pr-4 font-bold text-sm">表號：C-53</div>
    </div>
  );
};

// ==========================================
// 表格卡片 Component (Apple UI/UX Friendly Diff View)
// ==========================================
const RequisitionNode = ({
  req,
  isExpanded,
  toggleExpand,
  onEdit,
  onDelete,
  onPrint,
}) => {
  const hasItems = req.items && req.items.length > 0;
  const isStocked = (req.status || "").toUpperCase() === "STOCKED";

  return (
    <div className="mb-4 overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300">
      <div
        className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer group"
        onClick={() => toggleExpand(req.id)}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
          <span
            className={`w-8 h-8 flex items-center justify-center text-slate-400 text-sm flex-shrink-0 bg-slate-50 border border-slate-100 rounded-full transition-transform duration-300 group-hover:bg-slate-100 ${isExpanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          <div className="flex-shrink-0">
            <span className="font-mono text-[13px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
              #{req.id}
            </span>
          </div>
          <StatusTag status={req.status} />
          <div className="flex flex-col ml-3 truncate flex-1">
            <span className="font-bold text-slate-900 text-base truncate tracking-tight">
              填單日：{req.request_date}
            </span>
            <span className="text-[13px] text-slate-500 font-medium mt-0.5">
              請購人：{req.applicant}
            </span>
          </div>
        </div>

        <div className="mt-4 md:mt-0 flex-shrink-0 flex items-center w-full md:w-auto md:pl-0 justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
          <div className="text-slate-500 text-sm font-medium flex items-center gap-2">
            <span>品項數量</span>
            <span className="text-lg font-black text-slate-800">
              {req.items?.length || 0}
            </span>
          </div>

          <div className="flex gap-2.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onPrint(req)}
              className="px-4 py-2 text-slate-600 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 transition-colors text-xs font-bold shadow-sm"
            >
              列印
            </button>
            <button
              onClick={() => onEdit(req)}
              className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors text-xs font-bold shadow-sm"
            >
              {isStocked ? "檢視內容" : "編輯"}
            </button>
            <button
              onClick={() => onDelete(req.id)}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 transition-colors text-xs font-bold shadow-sm"
            >
              刪除
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-slate-50/50 p-6 border-t border-slate-100">
          {hasItems ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {req.items.map((item, idx) => {
                return (
                  <div
                    key={item.id || idx}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden transition-shadow hover:shadow-md"
                  >
                    <div className="p-5 border-b border-slate-100 flex justify-between items-start gap-3 bg-white">
                      <span className="font-bold text-slate-900 text-lg leading-tight tracking-tight">
                        {item.material_name}
                      </span>
                    </div>

                    <div className="p-5 flex-1 flex flex-col gap-4 bg-white">
                      {/* 🌟 Apple Friendly UI/UX 膠囊對比視角 (移除箭頭) */}
                      <div className="flex flex-col gap-3">
                        {/* 預計採購膠囊 */}
                        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                              預計採購
                            </span>
                            <span className="text-sm font-semibold text-slate-700">
                              {formatDisplayNum(item.package_qty)}{" "}
                              {item.aux_unit}{" "}
                              {item.in_stock_spec
                                ? `(${item.in_stock_spec})`
                                : ""}
                            </span>
                          </div>
                          <span className="font-mono text-sm font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            {formatDisplayNum(item.quantity)} {item.unit}
                          </span>
                        </div>

                        {/* 實際入庫膠囊 */}
                        {isStocked && item.actual_package_qty && (
                          <div className="flex items-center justify-between p-3.5 bg-emerald-50/70 border border-emerald-200/70 rounded-xl shadow-2xs">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs">
                                實際入庫
                              </span>
                              <span className="text-sm font-bold text-emerald-900">
                                {formatDisplayNum(item.actual_package_qty)}{" "}
                                {item.actual_aux_unit}{" "}
                                {item.actual_in_stock_spec
                                  ? `(${item.actual_in_stock_spec})`
                                  : ""}
                              </span>
                              {item.batch_number && (
                                <span className="font-mono text-[10px] bg-white text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 font-bold shadow-2xs">
                                  批號: {item.batch_number}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-sm font-extrabold text-emerald-900 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                              {formatDisplayNum(item.actual_quantity)}{" "}
                              {item.unit}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex text-[15px] mt-1">
                        <span className="text-slate-400 font-bold w-16 shrink-0">
                          供應商
                        </span>
                        <span className="text-slate-800 font-medium truncate">
                          {item.provider_name || "-"}
                        </span>
                      </div>
                      <div className="flex text-[15px]">
                        <span className="text-slate-400 font-bold w-16 shrink-0">
                          備註
                        </span>
                        <span className="text-slate-600 italic line-clamp-2 leading-relaxed">
                          {item.batch_note || "-"}
                        </span>
                      </div>

                      {item.expected_delivery_date && (
                        <div className="flex text-sm mt-1">
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 shadow-2xs">
                            預計 {item.expected_delivery_date} 到貨
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50/80 p-5 border-t border-slate-100 flex justify-between items-center mt-auto">
                      <div className="text-sm text-slate-500 font-mono flex items-center">
                        <span className="font-bold text-slate-800 text-lg">
                          {formatDisplayNum(item.quantity)}
                        </span>
                        <span className="ml-1 mr-2 text-sm text-slate-500 font-bold">
                          {item.unit}
                        </span>
                        <span className="text-slate-300 mx-1">×</span>
                        <span className="font-bold text-[15px]">
                          ${formatDisplayNum(item.purchased_price)}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-slate-400 font-bold">
                          小計
                        </span>
                        <span className="font-black text-2xl text-blue-700 tracking-tight">
                          $
                          {formatDisplayNum(
                            (parseFloat(item.quantity) || 0) *
                              (parseFloat(item.purchased_price) || 0),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-slate-400 py-8 text-center bg-white rounded-xl border border-dashed border-slate-200 font-medium">
              此單據目前無任何請購品項。
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 主頁面 Component
// ==========================================
const PurchaseRequisitionPage = () => {
  const me = useAuthStore((state) => state.me());
  const [requisitions, setRequisitions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [materialProviders, setMaterialProviders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchMaterial, setSearchMaterial] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState([]);
  const [printData, setPrintData] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequisition, setEditingRequisition] = useState(null);
  const [formData, setFormData] = useState({
    request_date: "",
    applicant: "",
    status: "WAITING",
    items: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
    onConfirm: null,
  });

  const isReadOnly = editingRequisition?.status === "STOCKED";
  const isSettingToStocked = formData.status === "STOCKED";

  const showAlert = (title, message, status = "info") =>
    setDialog({
      isOpen: true,
      type: "alert",
      status,
      title,
      message,
      onConfirm: null,
    });

  const showConfirm = (title, message, onConfirm) =>
    setDialog({
      isOpen: true,
      type: "confirm",
      status: "warning",
      title,
      message,
      onConfirm,
    });

  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    Promise.all([
      fetchRequisitions(),
      fetchMaterials(),
      fetchMaterialProviders(),
    ]);
  }, []);

  useEffect(() => {
    if (me?.full_name && !editingRequisition) {
      setFormData((prev) => ({ ...prev, applicant: me.full_name }));
    }
  }, [me, editingRequisition]);

  const fetchRequisitions = async () => {
    setLoading(true);
    try {
      let url = "/api/purchase_requisitions";
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error("無法載入請購單資料");
      const json = await res.json();
      setRequisitions(json.data || json);
      setCurrentPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await fetchWithAuth("/api/materials");
      if (response.ok) {
        const data = await response.json();
        setMaterials(data.data || data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMaterialProviders = async () => {
    try {
      const response = await fetchWithAuth("/api/material_providers");
      if (response.ok) {
        const data = await response.json();
        setMaterialProviders(data.data || data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const filteredRequisitions = useMemo(() => {
    const list = Array.isArray(requisitions) ? requisitions : [];
    return list.filter((req) => {
      if (filterStatus !== "ALL" && req.status !== filterStatus) return false;
      if (searchMaterial) {
        const term = searchMaterial.toLowerCase();
        const hasMatchingItem = req.items.some(
          (item) =>
            item.material_name &&
            item.material_name.toLowerCase().includes(term),
        );
        if (!hasMatchingItem) return false;
      }
      return true;
    });
  }, [requisitions, searchMaterial, filterStatus]);

  const totalPages =
    Math.ceil(filteredRequisitions.length / ITEMS_PER_PAGE) || 1;

  const paginatedRequisitions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequisitions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequisitions, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchMaterial, filterStatus]);

  const toggleRowExpand = (id) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id],
    );
  };

  const handlePrint = (req) => {
    setPrintData(req);
    setTimeout(() => {
      const originalTitle = document.title;
      document.title = `${req.request_date}_請購單_請購人_${req.applicant}`;
      window.print();
      document.title = originalTitle;
    }, 150);
  };

  const handleDelete = (id) => {
    showConfirm(
      "刪除確認",
      `確定要刪除請購單嗎？\n刪除後該單無法恢復。`,
      async () => {
        closeDialog();
        try {
          const res = await fetchWithAuth(`/api/purchase_requisitions/${id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("刪除失敗");
          setRequisitions((prev) => prev.filter((r) => r.id !== id));
          showAlert("刪除成功", `已成功刪除請購單 #${id}。`, "success");
        } catch (err) {
          showAlert("刪除失敗", err.message, "error");
        }
      },
    );
  };

  const openModal = (requisition = null) => {
    if (requisition) {
      setEditingRequisition(requisition);
      setFormData({
        request_date: requisition.request_date || "",
        applicant: requisition.applicant || "",
        status: (requisition.status || "WAITING").toUpperCase(),
        items: JSON.parse(JSON.stringify(requisition.items)),
      });
    } else {
      const today = new Date().toISOString().split("T")[0];
      setEditingRequisition(null);
      setFormData({
        request_date: today,
        applicant: me?.full_name || "",
        status: "WAITING",
        items: [],
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRequisition(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.applicant || !formData.request_date)
      return showAlert("資料不完整", "請填寫申請人與填單日期", "warning");
    if (formData.items.length === 0)
      return showAlert("資料不完整", "請至少新增一筆請購明細", "warning");

    setIsSubmitting(true);
    const payload = {
      ...formData,
      status: formData.status.toLowerCase(),
      items: formData.items.map((item) => ({
        ...item,
        expected_delivery_date: item.expected_delivery_date || null,
      })),
    };

    const url = editingRequisition
      ? `/api/purchase_requisitions/${editingRequisition.id}`
      : "/api/purchase_requisitions";

    try {
      const res = await fetchWithAuth(url, {
        method: editingRequisition ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("儲存失敗");
      await fetchRequisitions();
      closeModal();
      showAlert(
        "儲存成功",
        `已成功${editingRequisition ? "更新" : "新增"}請購單。`,
        "success",
      );
    } catch (err) {
      showAlert("發生錯誤", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMasterChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddItem = () =>
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          material_name: null,
          material_id: null,
          in_stock_spec: "",
          package_qty: "",
          aux_unit: "",
          aux_quantity: "",
          quantity: "",
          unit: "KG",
          purchased_price: "",
          expected_delivery_date: null,
          material_provider_id: null,
          remark: "",
        },
      ],
    }));

  const handleRemoveItem = (index) =>
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));

  const handleItemChange = (index, field, value) =>
    setFormData((prev) => {
      const newItems = [...prev.items];
      const item = { ...newItems[index], [field]: value };

      if (field === "in_stock_spec" && value) {
        const parsed = parseSpecString(value, item.unit || "KG");
        if (parsed) {
          item.aux_quantity = parsed.auxQuantity;
          item.aux_unit = parsed.auxUnit;
        }
      }

      if (
        field === "package_qty" ||
        field === "aux_quantity" ||
        field === "in_stock_spec"
      ) {
        const pq = parseFloat(item.package_qty) || 0;
        const aq = parseFloat(item.aux_quantity) || 0;
        if (pq > 0 && aq > 0) {
          item.quantity = Number((pq * aq).toFixed(4)).toString();
        } else {
          item.quantity = "";
        }
      }

      newItems[index] = item;
      return { ...prev, items: newItems };
    });

  // ========== UI Components ==========

  const MaterialSelect = ({ value, onChange, options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [dropdownStyle, setDropdownStyle] = useState({});
    const selectRef = useRef(null);
    const dropdownMenuRef = useRef(null);

    const filtered = options.filter((m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const handleToggle = () => {
      if (!isOpen && selectRef.current) {
        const rect = selectRef.current.getBoundingClientRect();
        setDropdownStyle({
          top: `${rect.bottom + 8}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
        });
      }
      setIsOpen(!isOpen);
    };

    useEffect(() => {
      const handleScroll = (e) => {
        if (
          dropdownMenuRef.current &&
          dropdownMenuRef.current.contains(e.target)
        )
          return;
        if (isOpen) setIsOpen(false);
      };
      if (isOpen) {
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", () => setIsOpen(false), true);
      }
      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", () => setIsOpen(false), true);
      };
    }, [isOpen]);

    return (
      <>
        <div
          ref={selectRef}
          onClick={handleToggle}
          className={`w-full h-11 px-4 py-2 border rounded-xl text-sm cursor-pointer bg-white flex justify-between items-center transition-all duration-200 ${
            isOpen
              ? "border-blue-500 ring-4 ring-blue-500/10"
              : "border-slate-200 hover:border-slate-300 shadow-sm"
          }`}
        >
          <span
            className={
              value
                ? "text-slate-800 truncate font-bold text-[15px]"
                : "text-slate-400 truncate"
            }
          >
            {value || "搜尋與選擇物料..."}
          </span>
          <ChevronDown
            size={18}
            className={`text-slate-400 flex-shrink-0 ml-2 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setIsOpen(false)}
            ></div>
            <div
              ref={dropdownMenuRef}
              style={dropdownStyle}
              className="fixed z-[9999] bg-white border border-slate-100 rounded-2xl shadow-xl flex flex-col max-h-72 overflow-hidden"
            >
              <div className="p-3 border-b border-slate-50 bg-slate-50/80 shrink-0">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3 top-2.5 text-slate-400"
                  />
                  <input
                    autoFocus
                    className="w-full border-none bg-white rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm font-medium text-slate-700"
                    placeholder="輸入關鍵字..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                {filtered.length > 0 ? (
                  filtered.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        onChange(m);
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                      className="px-4 py-3 text-[15px] text-slate-700 rounded-xl hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors flex justify-between items-center font-bold"
                    >
                      <span>{m.name}</span>
                      <span className="text-[11px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-sm">
                        {m.unit}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-8 text-center text-slate-400 text-sm font-medium">
                    查無符合的物料
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </>
    );
  };

  const SupplierSelect = ({ valueId, onChange, options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [dropdownStyle, setDropdownStyle] = useState({});
    const selectRef = useRef(null);
    const dropdownMenuRef = useRef(null);

    const selectedProvider = useMemo(() => {
      if (!valueId) return null;
      return options.find((opt) => opt.id === valueId) || null;
    }, [valueId, options]);

    const filtered = useMemo(() => {
      if (!searchTerm) return options;
      const lowerTerm = searchTerm.toLowerCase();
      return options.filter(
        (m) =>
          (m.name && m.name.toLowerCase().includes(lowerTerm)) ||
          (m.code && m.code.toLowerCase().includes(lowerTerm)),
      );
    }, [options, searchTerm]);

    const handleToggle = () => {
      if (!isOpen && selectRef.current) {
        const rect = selectRef.current.getBoundingClientRect();
        setDropdownStyle({
          top: `${rect.bottom + 8}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
        });
      }
      setIsOpen(!isOpen);
    };

    useEffect(() => {
      const handleScroll = (e) => {
        if (
          dropdownMenuRef.current &&
          dropdownMenuRef.current.contains(e.target)
        )
          return;
        if (isOpen) setIsOpen(false);
      };
      if (isOpen) {
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", () => setIsOpen(false), true);
      }
      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", () => setIsOpen(false), true);
      };
    }, [isOpen]);

    return (
      <>
        <div
          ref={selectRef}
          onClick={handleToggle}
          className={`w-full h-11 px-4 py-2 border rounded-xl text-sm cursor-pointer bg-white flex justify-between items-center transition-all duration-200 ${
            isOpen
              ? "border-blue-500 ring-4 ring-blue-500/10"
              : "border-slate-200 hover:border-slate-300 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden w-full">
            <Search size={16} className="text-slate-400 flex-shrink-0" />
            <span
              className={`truncate ${
                selectedProvider
                  ? "text-slate-800 font-bold text-[15px]"
                  : "text-slate-400 font-medium text-[15px]"
              }`}
            >
              {selectedProvider
                ? `[${selectedProvider.code}] ${selectedProvider.name}`
                : "選擇供應商..."}
            </span>
          </div>
          <ChevronDown
            size={18}
            className={`text-slate-400 flex-shrink-0 ml-1 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setIsOpen(false)}
            ></div>
            <div
              ref={dropdownMenuRef}
              style={dropdownStyle}
              className="fixed z-[9999] bg-white border border-slate-100 rounded-2xl shadow-xl flex flex-col max-h-72 overflow-hidden"
            >
              <div className="p-3 border-b border-slate-50 bg-slate-50/80 shrink-0">
                <input
                  autoFocus
                  className="w-full border-none bg-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm font-medium"
                  placeholder="輸入代碼或名稱..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                {filtered.length > 0 ? (
                  filtered.map((m) => {
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          onChange(m.id);
                          setIsOpen(false);
                          setSearchTerm("");
                        }}
                        className="px-3 py-3 text-sm text-slate-700 rounded-xl hover:bg-blue-50 cursor-pointer transition-colors flex items-center gap-3 font-bold"
                      >
                        <span className="text-[11px] font-mono bg-white shadow-sm px-2 py-0.5 rounded-lg text-slate-500 border border-slate-200 whitespace-nowrap">
                          {m.code}
                        </span>
                        <span className="truncate text-slate-800 text-[15px]">
                          {m.name}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-8 text-center text-slate-400 text-sm font-medium">
                    查無符合的供應商
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </>
    );
  };

  if (loading && requisitions.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="text-lg font-bold text-slate-400 animate-pulse">
          載入請購單資料中...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden p-6 md:p-10 max-w-[1400px] mx-auto bg-slate-50/50 min-h-screen font-sans text-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
              請購單管理
            </h2>
            <p className="text-slate-500 mt-2 font-semibold">
              高效管理廠內食材與包材進貨流程
            </p>
          </div>
        </div>

        {/* 🌟 依照你的要求復原此指定樣式的系統功能說明區塊 */}
        <div className="bg-blue-50/80 text-blue-800 text-sm p-4 rounded-2xl mb-6 border border-blue-100/50 shadow-sm">
          <p className="flex items-center gap-2 font-bold mb-2">
            <span className="text-lg leading-none">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
            <li>
              條列系統中所有原物料的<strong>批號、庫存</strong>狀態。
            </li>
            <li>
              支援以批號代碼、物料名稱進行<strong>搜尋資料</strong>
              ，產出回收計畫書 4 大報表。
            </li>
          </ul>
        </div>

        {error && (
          <div className="p-4 mb-8 text-red-700 bg-red-50 rounded-2xl border border-red-200 shadow-sm flex items-center gap-3">
            <span className="text-xl">⚠️</span>{" "}
            <span className="font-bold">{error}</span>
          </div>
        )}

        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-5">
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
              <div className="relative w-full sm:w-72">
                <Search
                  size={18}
                  className="absolute left-4 top-3 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="搜尋原物料名稱..."
                  value={searchMaterial}
                  onChange={(e) => setSearchMaterial(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-200 font-medium placeholder-slate-400"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-200 font-bold text-slate-700"
              >
                <option value="ALL">全部狀態</option>
                <option value="WAITING">等待進貨</option>
                <option value="STOCKED">已經入庫</option>
              </select>
              {(searchMaterial || filterStatus !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchMaterial("");
                    setFilterStatus("ALL");
                  }}
                  className="text-sm text-slate-400 hover:text-red-500 font-bold transition-colors ml-2"
                >
                  清除
                </button>
              )}
            </div>
            <button
              onClick={() => openModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all duration-200 text-sm font-bold w-full md:w-auto hover:shadow-[0_6px_16px_rgba(37,99,235,0.3)] hover:-translate-y-0.5"
            >
              + 新增請購單
            </button>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-8 rounded-3xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col justify-between">
          <div>
            {paginatedRequisitions.length > 0 ? (
              <div>
                {paginatedRequisitions.map((req) => (
                  <RequisitionNode
                    key={req.id}
                    req={req}
                    isExpanded={expandedRows.includes(req.id)}
                    toggleExpand={toggleRowExpand}
                    onEdit={openModal}
                    onDelete={handleDelete}
                    onPrint={handlePrint}
                  />
                ))}
              </div>
            ) : (
              <div className="py-24 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-5 border border-slate-100">
                  <Search size={32} />
                </div>
                <span className="text-slate-400 font-bold text-lg">
                  找不到符合條件的請購單資料
                </span>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-6 px-4">
              <div className="text-sm text-slate-500 font-bold">
                顯示第 {(currentPage - 1) * ITEMS_PER_PAGE + 1} 到{" "}
                {Math.min(
                  currentPage * ITEMS_PER_PAGE,
                  filteredRequisitions.length,
                )}{" "}
                筆， 共 {filteredRequisitions.length} 筆
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-black text-slate-700 px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-opacity duration-300">
            <div className="bg-white rounded-[2rem] w-full max-w-[1200px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {editingRequisition
                    ? isReadOnly
                      ? `檢視請購單 #${editingRequisition.id}`
                      : `編輯請購單 #${editingRequisition.id}`
                    : "新增請購單"}
                </h3>
                <button
                  onClick={closeModal}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors font-bold text-xl"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col overflow-hidden flex-1 bg-slate-50/50"
              >
                <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
                  {isReadOnly && (
                    <div className="mb-6 p-4 bg-emerald-50/80 text-emerald-800 border border-emerald-200/60 rounded-2xl text-[15px] font-bold flex items-center gap-3 shadow-sm">
                      <span className="text-xl bg-white rounded-full p-1 shadow-sm">
                        ✅
                      </span>
                      此單據已入庫並自動產生實體批號。為了確保庫存資料一致性，單據已鎖定為唯讀狀態。
                    </div>
                  )}
                  {!isReadOnly && isSettingToStocked && (
                    <div className="mb-6 p-4 bg-amber-50/80 text-amber-800 border border-amber-200/60 rounded-2xl text-[15px] font-bold flex items-center gap-3 shadow-sm">
                      <span className="text-xl bg-white rounded-full p-1 shadow-sm animate-pulse">
                        ⚠️
                      </span>
                      注意：設定為「已經入庫」並儲存後，系統將自動為明細產生批號庫存，且此單據將無法再被修改。
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                        填單日期
                      </label>
                      <input
                        type="date"
                        name="request_date"
                        required
                        disabled={isReadOnly}
                        value={formData.request_date}
                        onChange={handleMasterChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all disabled:opacity-70 disabled:cursor-not-allowed font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                        請購人
                      </label>
                      <input
                        type="text"
                        name="applicant"
                        readOnly
                        value={formData.applicant}
                        className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-[15px] text-slate-700 font-bold cursor-not-allowed outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                        單據狀態
                      </label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleMasterChange}
                        disabled={isReadOnly}
                        className={`w-full px-4 py-3 border rounded-xl text-[15px] outline-none transition-all font-bold disabled:opacity-80 disabled:cursor-not-allowed ${
                          formData.status === "STOCKED"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                        }`}
                      >
                        <option value="WAITING">等待進貨</option>
                        <option value="STOCKED">已經入庫 (產生批號)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-5 pl-2">
                    <h4 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                      請購明細
                      <span className="bg-slate-200 text-slate-700 text-[13px] py-1 px-3 rounded-full">
                        {formData.items.length}
                      </span>
                    </h4>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="text-sm bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 font-bold shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all hover:shadow-[0_6px_16px_rgba(37,99,235,0.3)] hover:-translate-y-0.5"
                      >
                        + 加入品項
                      </button>
                    )}
                  </div>

                  <div className="space-y-6">
                    {formData.items.length === 0 ? (
                      <div className="p-16 text-center border-2 border-dashed border-slate-300 rounded-3xl text-slate-400 bg-white/50 font-bold text-lg">
                        請點擊右上方按鈕加入請購品項
                      </div>
                    ) : (
                      formData.items.map((item, index) => {
                        const isWeight = ["KG", "K", "G", "L", "ML"].includes(
                          (item.unit || "KG").toUpperCase(),
                        );
                        const auxLabel = isWeight ? "單件基本重" : "單件基本數";
                        const totalLabel = isWeight
                          ? "總基本重量"
                          : "總基本數量";

                        return (
                          <div
                            key={index}
                            className={`bg-white border rounded-[2rem] p-7 shadow-sm relative transition-all duration-300 group ${
                              isReadOnly
                                ? "border-slate-200"
                                : "border-slate-200 hover:border-blue-300 hover:shadow-md"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                              <h5 className="font-extrabold text-slate-800 flex items-center gap-3 text-lg tracking-tight">
                                <span className="bg-slate-100 text-slate-500 w-9 h-9 flex items-center justify-center rounded-full text-[15px] border border-slate-200">
                                  {index + 1}
                                </span>
                                品項內容
                              </h5>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(index)}
                                  className="text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 px-3 py-2 rounded-xl transition-colors flex items-center gap-2 text-[13px] font-bold opacity-60 group-hover:opacity-100 border border-transparent hover:border-red-100"
                                >
                                  <Trash2 size={16} /> 移除
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              <div className="lg:col-span-4">
                                <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                  原物料名稱{" "}
                                  <span className="text-red-500">*</span>
                                </label>
                                {isReadOnly ? (
                                  <input
                                    type="text"
                                    readOnly
                                    value={item.material_name}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-[15px] bg-slate-50 text-slate-800 font-bold"
                                  />
                                ) : (
                                  <MaterialSelect
                                    value={item.material_name}
                                    options={materials}
                                    onChange={async (m) => {
                                      handleItemChange(
                                        index,
                                        "material_name",
                                        m.name,
                                      );
                                      handleItemChange(
                                        index,
                                        "material_id",
                                        m.id,
                                      );
                                      handleItemChange(
                                        index,
                                        "unit",
                                        m.unit || "KG",
                                      );

                                      try {
                                        const res = await fetchWithAuth(
                                          `/api/purchase_requisitions/prev_purchase_price?material_id=${m.id}`,
                                        );
                                        if (res.ok) {
                                          const data = await res.json();
                                          const {
                                            latest_price,
                                            latest_spec,
                                            latest_aux_unit,
                                            latest_aux_quantity,
                                          } = data.data;

                                          handleItemChange(
                                            index,
                                            "purchased_price",
                                            latest_price ?? "",
                                          );

                                          if (latest_spec) {
                                            handleItemChange(
                                              index,
                                              "in_stock_spec",
                                              latest_spec,
                                            );
                                          } else if (latest_aux_quantity) {
                                            handleItemChange(
                                              index,
                                              "aux_quantity",
                                              latest_aux_quantity,
                                            );
                                            handleItemChange(
                                              index,
                                              "aux_unit",
                                              latest_aux_unit ?? "",
                                            );
                                          }
                                        }
                                      } catch (error) {
                                        console.error(error);
                                      }
                                    }}
                                  />
                                )}
                              </div>

                              <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-5 bg-slate-50/70 p-5 rounded-3xl border border-slate-100">
                                <div>
                                  {/* 🌟 依照你的要求將 wording 改為「下單規格」 */}
                                  <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                    {isReadOnly
                                      ? "真實入庫規格"
                                      : "下單規格 (可修改)"}
                                  </label>
                                  <input
                                    type="text"
                                    disabled={isReadOnly}
                                    value={
                                      isReadOnly
                                        ? (item.actual_in_stock_spec ??
                                          item.in_stock_spec)
                                        : item.in_stock_spec
                                    }
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "in_stock_spec",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all disabled:opacity-80 disabled:bg-slate-100 disabled:text-emerald-800"
                                    placeholder="如: 30KG/袋 或 1500 PCS/箱"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                    {isReadOnly ? "真實入庫件數" : "採購件數"}{" "}
                                    <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    disabled={isReadOnly}
                                    value={
                                      isReadOnly
                                        ? formatDisplayNum(
                                            item.actual_package_qty ??
                                              item.package_qty,
                                          )
                                        : item.package_qty
                                    }
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "package_qty",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-mono font-bold transition-all disabled:opacity-80 disabled:bg-slate-100 disabled:text-emerald-800"
                                    placeholder="例如: 5"
                                  />
                                </div>
                                <div className="flex gap-3">
                                  <div className="w-1/2">
                                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                      輔助單位
                                    </label>
                                    <input
                                      type="text"
                                      disabled={isReadOnly}
                                      value={
                                        isReadOnly
                                          ? (item.actual_aux_unit ??
                                            item.aux_unit)
                                          : item.aux_unit
                                      }
                                      onChange={(e) =>
                                        handleItemChange(
                                          index,
                                          "aux_unit",
                                          e.target.value,
                                        )
                                      }
                                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all disabled:opacity-80 disabled:bg-slate-100 disabled:text-emerald-800"
                                      placeholder="袋, 箱"
                                    />
                                  </div>
                                  <div className="w-1/2">
                                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1 truncate">
                                      {auxLabel}
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      disabled={isReadOnly}
                                      value={
                                        isReadOnly
                                          ? formatDisplayNum(
                                              item.actual_aux_quantity ??
                                                item.aux_quantity,
                                            )
                                          : item.aux_quantity
                                      }
                                      onChange={(e) =>
                                        handleItemChange(
                                          index,
                                          "aux_quantity",
                                          e.target.value,
                                        )
                                      }
                                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-mono font-bold transition-all disabled:opacity-80 disabled:bg-slate-100 disabled:text-emerald-800"
                                      placeholder="如: 30"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <div className="flex-1 relative">
                                    <label className="block text-xs font-extrabold text-blue-700 mb-2 ml-1 truncate">
                                      {totalLabel}{" "}
                                      {item.unit ? `(${item.unit})` : ""}{" "}
                                      <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                      type="number"
                                      required
                                      step="0.01"
                                      disabled={isReadOnly}
                                      value={
                                        isReadOnly
                                          ? formatDisplayNum(
                                              item.actual_quantity ??
                                                item.quantity,
                                            )
                                          : item.quantity
                                      }
                                      onChange={(e) =>
                                        handleItemChange(
                                          index,
                                          "quantity",
                                          e.target.value,
                                        )
                                      }
                                      className={`w-full px-4 py-3 border rounded-xl text-[15px] outline-none font-mono font-black transition-all ${
                                        isReadOnly
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                          : "border-blue-200 bg-blue-50 text-blue-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 placeholder-blue-300"
                                      }`}
                                      placeholder="自動計算..."
                                    />
                                  </div>
                                  <div className="w-20">
                                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1 text-center">
                                      單位
                                    </label>
                                    <input
                                      type="text"
                                      readOnly
                                      value={item.unit}
                                      className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-[15px] font-black text-slate-600 outline-none text-center shadow-sm"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                  基本單價 (每 {item.unit || "件"}){" "}
                                  <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                  <span className="absolute left-4 top-3 text-slate-400 font-bold">
                                    $
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    disabled={isReadOnly}
                                    value={item.purchased_price ?? ""}
                                    placeholder="無前次紀錄"
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "purchased_price",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-mono font-bold transition-all disabled:opacity-80 disabled:bg-slate-100"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                  供應商
                                </label>
                                {isReadOnly ? (
                                  <input
                                    type="text"
                                    readOnly
                                    value={item.provider_name || "-"}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-[15px] bg-slate-50 text-slate-700 font-bold"
                                  />
                                ) : (
                                  <SupplierSelect
                                    valueId={item.material_provider_id}
                                    options={materialProviders}
                                    onChange={(valId) =>
                                      handleItemChange(
                                        index,
                                        "material_provider_id",
                                        valId,
                                      )
                                    }
                                  />
                                )}
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                  指定到貨日
                                </label>
                                <input
                                  type="date"
                                  disabled={isReadOnly}
                                  value={item.expected_delivery_date || ""}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "expected_delivery_date",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all disabled:opacity-80 disabled:bg-slate-100"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                  備註說明
                                </label>
                                <input
                                  type="text"
                                  disabled={isReadOnly}
                                  value={item.remark || ""}
                                  placeholder="特殊要求或附註..."
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "remark",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all disabled:opacity-80 disabled:bg-slate-100"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="p-6 md:px-10 md:py-6 border-t border-slate-100 flex justify-end gap-4 bg-white shrink-0 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)] z-10">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-8 py-3.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all text-[15px] font-bold shadow-sm"
                  >
                    {isReadOnly ? "關閉視窗" : "取消"}
                  </button>
                  {!isReadOnly && (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-10 py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all text-[15px] font-bold disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(37,99,235,0.3)] tracking-wide"
                    >
                      {isSubmitting ? "處理中..." : "確認儲存"}
                    </button>
                  )}
                </div>
              </form>
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

      {printData && <PurchaseRequisitionPrintTemplate data={printData} />}
    </>
  );
};

export default PurchaseRequisitionPage;

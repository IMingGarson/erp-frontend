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

const ITEMS_PER_PAGE = 10; // 🌟 每頁顯示 10 筆資料

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
      className={`inline-block text-center min-w-[64px] px-2.5 py-0.5 rounded text-xs font-bold border ${statusData.css}`}
    >
      {statusData.label}
    </span>
  );
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
      <style>
        {`
            @media print {
                @page {
                margin: 0; 
                }
            }
            `}
      </style>
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
              原物料名稱(含規格)
            </th>
            <th className="border-r border-black p-2 font-normal w-24">
              欲採購數量
              <br />
              (Kg)
            </th>
            <th className="border-r border-black p-2 font-normal w-20">
              指定到
              <br />
              貨日
            </th>
            <th className="border-r border-black p-2 font-normal w-24">
              供應商
            </th>
            <th className="border-r border-black p-2 font-normal w-24">
              現庫存量(Kg)
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
                </td>
                <td className="border-r border-black p-1 text-xl">
                  {item.quantity ? `${item.quantity}` : ""}
                </td>
                <td className="border-r border-black p-1 text-lg">
                  {deliveryStr}
                </td>
                <td className="border-r border-black p-1 text-lg">
                  {item.provider_name || ""}
                </td>
                <td className="border-r border-black p-1"></td>
                <td className="p-1 text-lg">{item.remark || ""}</td>
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
// 表格卡片 Component
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

  return (
    <div className="mb-3 overflow-hidden rounded-lg shadow-sm bg-white border border-slate-200 transition-all hover:border-blue-300">
      <div
        className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer"
        onClick={() => toggleExpand(req.id)}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
          <span className="w-5 h-5 flex items-center justify-center text-slate-400 text-xs flex-shrink-0 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
            {isExpanded ? "▼" : "▶"}
          </span>
          <div className="flex-shrink-0">
            <span className="font-mono text-sm font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
              #{req.id}
            </span>
          </div>
          <StatusTag status={req.status} />
          <div className="flex flex-col ml-2 truncate flex-1">
            <span className="font-bold text-slate-800 text-base truncate">
              填單日：{req.request_date}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              請購人：{req.applicant}
            </span>
          </div>
        </div>

        <div className="mt-4 md:mt-0 flex-shrink-0 flex items-center w-full md:w-auto md:pl-0 justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
          <div className="text-slate-500 text-sm font-medium flex items-center gap-2">
            <span>品項數量：</span>
            <span className="text-lg font-black text-slate-700">
              {req.items?.length || 0}
            </span>
            <span className="text-xs font-normal">項</span>
          </div>

          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onPrint(req)}
              className="px-3 py-1.5 text-slate-600 border border-slate-200 bg-white rounded-md hover:bg-slate-50 transition-colors text-xs font-bold shadow-sm"
            >
              列印
            </button>
            <button
              onClick={() => onEdit(req)}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors text-xs font-bold shadow-sm"
            >
              編輯
            </button>
            <button
              onClick={() => onDelete(req.id)}
              className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 transition-colors text-xs font-bold shadow-sm"
            >
              刪除
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-slate-50 p-4 border-t border-slate-200">
          <div className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            請購品項明細
          </div>
          {hasItems ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {req.items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden"
                >
                  <div className="p-4 border-b border-slate-100 flex justify-between items-start gap-3 bg-white">
                    <span className="font-bold text-slate-800 text-base leading-tight">
                      {item.material_name}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-2.5 bg-white">
                    <div className="flex text-sm">
                      <span className="text-slate-400 font-bold w-14 shrink-0">
                        供應商
                      </span>
                      <span className="text-slate-700 font-medium truncate">
                        {item.provider_name || "-"}
                      </span>
                    </div>
                    <div className="flex text-sm">
                      <span className="text-slate-400 font-bold w-14 shrink-0">
                        備註
                      </span>
                      <span className="text-slate-600 italic line-clamp-2 leading-snug">
                        {item.remark || "-"}
                      </span>
                    </div>
                    <div className="flex text-sm">
                      {item.expected_delivery_date && (
                        <span className="text-sm font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1 rounded-md whitespace-nowrap shrink-0">
                          預計 {item.expected_delivery_date} 到貨
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center mt-auto">
                    <div className="text-xs text-slate-500 font-mono flex items-center">
                      <span className="font-bold text-slate-700 text-sm">
                        {parseFloat(item.quantity || 0).toLocaleString()}
                      </span>
                      <span className="ml-1 mr-1.5 text-[10px] text-slate-400">
                        {item.unit}
                      </span>
                      <span className="text-slate-300 mx-1">×</span>
                      <span>
                        $
                        {item.purchased_price
                          ? parseFloat(item.purchased_price).toLocaleString()
                          : "0"}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs text-slate-400 font-bold">
                        小計
                      </span>
                      <span className="font-black text-lg text-blue-700 tracking-tight">
                        $
                        {(
                          (parseFloat(item.quantity) || 0) *
                          (parseFloat(item.purchased_price) || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400 italic py-4 text-center border border-dashed border-slate-200 rounded bg-white">
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

  // 🌟 分頁狀態
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
      setRequisitions(json.data || []);
      setCurrentPage(1); // 重新載入時回到第一頁
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
        setMaterials(data.data || []);
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
        setMaterialProviders(data.data || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // 🌟 1. 篩選後的完整清單
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

  // 🌟 2. 計算總頁數
  const totalPages =
    Math.ceil(filteredRequisitions.length / ITEMS_PER_PAGE) || 1;

  // 🌟 3. 當前頁面實際要顯示的 10 筆資料
  const paginatedRequisitions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequisitions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequisitions, currentPage]);

  // 當搜尋條件改變時，自動將頁碼重置為 1
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
          quantity: "",
          unit: "Kg",
          purchased_price: "",
          expected_delivery_date: null,
          material_provider_id: null,
          remark: null,
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
      newItems[index] = { ...newItems[index], [field]: value };
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
          top: `${rect.bottom + 4}px`,
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
          className={`w-full h-[38px] px-3 py-2 border rounded-md text-sm cursor-pointer bg-white flex justify-between items-center transition-colors ${
            isOpen
              ? "border-blue-500 ring-2 ring-blue-500/20"
              : "border-slate-300 hover:border-slate-400"
          }`}
        >
          <span
            className={
              value
                ? "text-slate-800 truncate font-medium"
                : "text-slate-400 truncate"
            }
          >
            {value || "選擇物料..."}
          </span>
          <ChevronDown
            size={16}
            className="text-slate-400 flex-shrink-0 ml-2"
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
              className="fixed z-[9999] bg-white border border-slate-200 rounded-md shadow-xl flex flex-col max-h-60 overflow-hidden"
            >
              <div className="p-2 border-b border-slate-100 bg-slate-50 shrink-0">
                <input
                  autoFocus
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="搜尋物料..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                {filtered.length > 0 ? (
                  filtered.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        onChange(m.id, m.name);
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                      className="px-3 py-2 text-sm text-slate-700 rounded hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors"
                    >
                      {m.name}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-slate-400 text-sm">
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
          top: `${rect.bottom + 4}px`,
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
          className={`w-full h-[38px] px-3 py-2 border rounded-md text-sm cursor-pointer bg-white flex justify-between items-center transition-colors ${
            isOpen
              ? "border-blue-500 ring-2 ring-blue-500/20"
              : "border-slate-300 hover:border-slate-400"
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-hidden w-full">
            <Search size={14} className="text-slate-400 flex-shrink-0" />
            <span
              className={`truncate ${
                selectedProvider
                  ? "text-slate-800 font-medium"
                  : "text-slate-400"
              }`}
            >
              {selectedProvider
                ? `[${selectedProvider.code}] ${selectedProvider.name}`
                : "選擇供應商..."}
            </span>
          </div>
          <ChevronDown
            size={16}
            className="text-slate-400 flex-shrink-0 ml-1"
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
              className="fixed z-[9999] bg-white border border-slate-200 rounded-md shadow-xl flex flex-col max-h-60 overflow-hidden"
            >
              <div className="p-2 border-b border-slate-100 bg-slate-50 shrink-0">
                <input
                  autoFocus
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="輸入代碼或名稱..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
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
                        className="px-2 py-2 text-sm text-slate-700 rounded hover:bg-blue-50 cursor-pointer transition-colors flex items-center gap-2"
                      >
                        <span className="text-[11px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200 whitespace-nowrap">
                          {m.code}
                        </span>
                        <span className="truncate text-slate-700 font-medium">
                          {m.name}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-4 text-center text-slate-400 text-sm">
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
        <div className="text-lg font-medium text-slate-500 animate-pulse">
          載入請購單資料中...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              請購單管理
            </h2>
          </div>
        </div>

        <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg mb-6 border border-blue-100">
          <p className="flex items-center gap-2 font-medium mb-1">
            <span className="text-lg">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
            <li>
              預設載入過去 14
              天的請購單，您可以使用「日期區間」向伺服器查詢歷史單據。
            </li>
            <li>
              下方的「品項搜尋」與「狀態篩選」為即時過濾，不需重新載入畫面。
            </li>
            <li>
              點擊單據卡片任一處，可展開查看明細；點擊
              <strong className="text-slate-800">「列印」</strong>
              即可輸出實體表單。
            </li>
          </ul>
        </div>

        {error && (
          <div className="p-4 mb-6 text-red-700 bg-red-50 rounded-lg border border-red-200">
            ⚠️ {error}
          </div>
        )}

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5 mb-5">
            <div className="flex flex-col sm:flex-row items-end gap-3 w-full md:w-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  起始日期
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-40 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  結束日期
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full sm:w-40 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={fetchRequisitions}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded-lg shadow-sm transition-colors text-sm font-medium w-full sm:w-auto h-[34px]"
              >
                套用搜尋
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
              <input
                type="text"
                placeholder="搜尋原物料名稱..."
                value={searchMaterial}
                onChange={(e) => setSearchMaterial(e.target.value)}
                className="w-full sm:w-64 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full sm:w-40 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  className="text-sm text-slate-500 hover:text-red-500 underline"
                >
                  清除
                </button>
              )}
            </div>
            <button
              onClick={() => openModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors text-sm font-medium w-full md:w-auto"
            >
              + 新增請購單
            </button>
          </div>
        </div>

        <div className="bg-slate-50/50 p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col justify-between">
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
              <div className="py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg bg-white/50">
                <span className="text-3xl mb-2 block">📄</span>
                找不到符合條件的請購單資料。
              </div>
            )}
          </div>

          {/* 🌟 分頁控制元件 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 mt-6 px-2">
              <div className="text-xs text-slate-500 font-medium">
                顯示第 {(currentPage - 1) * ITEMS_PER_PAGE + 1} 到{" "}
                {Math.min(
                  currentPage * ITEMS_PER_PAGE,
                  filteredRequisitions.length,
                )}{" "}
                筆， 共 {filteredRequisitions.length} 筆資料
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
                  title="上一頁"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-bold text-slate-700 px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
                  title="下一頁"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 新增/編輯表單 Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-5xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingRequisition
                    ? `編輯請購單 #${editingRequisition.id}`
                    : "新增請購單"}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col overflow-hidden flex-1"
              >
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                        填單日期 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="request_date"
                        required
                        value={formData.request_date}
                        onChange={handleMasterChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                        請購人 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="applicant"
                        readOnly
                        value={formData.applicant}
                        onChange={handleMasterChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 focus:outline-none text-sm text-slate-600 font-medium"
                        placeholder="請輸入姓名"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                        單據狀態
                      </label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleMasterChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-sm"
                      >
                        <option value="WAITING">等待進貨</option>
                        <option value="STOCKED">已經入庫</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block"></span>
                      請購明細 ({formData.items.length})
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-bold transition-colors shadow-sm"
                    >
                      + 加入品項
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formData.items.length === 0 ? (
                      <div className="p-12 text-center border-2 border-dashed border-slate-300 rounded-xl text-slate-500 bg-white text-sm font-medium">
                        請點擊右上方按鈕加入請購品項
                      </div>
                    ) : (
                      formData.items.map((item, index) => (
                        <div
                          key={index}
                          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative transition-all hover:border-blue-300 hover:shadow-md group"
                        >
                          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                            <h5 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                              <span className="bg-slate-100 text-slate-600 w-6 h-6 flex items-center justify-center rounded-full text-xs border border-slate-200">
                                {index + 1}
                              </span>
                              品項內容
                            </h5>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors flex items-center gap-1 text-sm font-bold opacity-80 group-hover:opacity-100"
                            >
                              <Trash2 size={16} /> 移除
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">
                                原物料名稱{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <MaterialSelect
                                value={item.material_name}
                                options={materials}
                                onChange={async (id, name) => {
                                  handleItemChange(
                                    index,
                                    "material_name",
                                    name,
                                  );
                                  handleItemChange(index, "material_id", id);
                                  try {
                                    const res = await fetchWithAuth(
                                      `/api/purchase_requisitions/prev_purchase_price?material_id=${id}`,
                                    );
                                    if (res.ok) {
                                      const data = await res.json();
                                      const pvp = data.data.latest_price;
                                      handleItemChange(
                                        index,
                                        "purchased_price",
                                        pvp !== null ? pvp : "",
                                      );
                                    }
                                  } catch (error) {
                                    console.error(error);
                                  }
                                }}
                              />
                            </div>

                            <div className="flex gap-3">
                              <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                  數量 <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  required
                                  min="0.01"
                                  step="0.01"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "quantity",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono placeholder-slate-300"
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="w-24 shrink-0">
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                  單位
                                </label>
                                <input
                                  type="text"
                                  value={item.unit}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "unit",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">
                                單價 <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400">
                                  $
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.purchased_price ?? ""}
                                  placeholder="無前次紀錄"
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "purchased_price",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">
                                供應商
                              </label>
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
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">
                                指定到貨日
                              </label>
                              <input
                                type="date"
                                value={item.expected_delivery_date || ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "expected_delivery_date",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">
                                備註說明
                              </label>
                              <input
                                type="text"
                                value={item.remark || ""}
                                placeholder="特殊要求或附註..."
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "remark",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-white shrink-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-5 py-2.5 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors text-sm font-bold"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-[#1f4e78] text-white rounded-md hover:bg-blue-900 shadow-md transition-colors text-sm font-bold disabled:opacity-50"
                  >
                    {isSubmitting ? "儲存中..." : "確認儲存"}
                  </button>
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

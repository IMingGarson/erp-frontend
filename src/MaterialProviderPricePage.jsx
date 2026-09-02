import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, Trash2, Edit, FileText } from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useAuthStore } from "./store/authStore";

const ITEMS_PER_PAGE = 10;

// 輔助函數：移除小數點尾數 0
const formatDisplayNum = (val) => {
  if (val === null || val === undefined || val === "") return "";
  const num = parseFloat(val);
  return isNaN(num) ? val : num.toString();
};

// 核心：規格正則解析引擎
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
  )
    return { auxQuantity: 1, auxUnit: "件" };
  if (str.includes("KG/包") || str.includes("K/包"))
    return { auxQuantity: 1, auxUnit: "包" };
  const weightMatch = str.match(/(?:^|[^\d.])([\d.]+)(?:KG|K|G|L|件)/);
  if (weightMatch)
    return { auxQuantity: parseFloat(weightMatch[1]), auxUnit: "件" };

  return null;
};

export default function MaterialProviderQuotationPage() {
  const me = useAuthStore((state) => state.me());
  const [quotations, setQuotations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterProviderId, setFilterProviderId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedRows, setExpandedRows] = useState([]);

  const initialFormData = {
    provider_id: "",
    quote_date: "",
    valid_until: "",
    effective_date: "",
    is_tax_included: true,
    remark: "",
    items: [],
  };
  const [formData, setFormData] = useState(initialFormData);

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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [quoteRes, matRes, provRes] = await Promise.all([
        fetchWithAuth("/api/provider_quotations"),
        fetchWithAuth("/api/materials"),
        fetchWithAuth("/api/material_providers"),
      ]);

      if (quoteRes.ok) setQuotations((await quoteRes.json()).data || []);
      if (matRes.ok) setMaterials((await matRes.json()).data || []);
      if (provRes.ok) setProviders((await provRes.json()).data || []);
    } catch (error) {
      showAlert("載入失敗", "無法載入資料，請稍後再試。", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterProviderId]);

  const filteredQuotations = useMemo(() => {
    const list = Array.isArray(quotations) ? quotations : [];
    return list.filter((q) => {
      const matchSearch = (q.provider_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchProvider =
        filterProviderId === ""
          ? true
          : q.provider === parseInt(filterProviderId);
      return matchSearch && matchProvider;
    });
  }, [quotations, searchTerm, filterProviderId]);

  const totalPages = Math.ceil(filteredQuotations.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentData = filteredQuotations.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  const handleMasterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          material: "",
          material_name: "",
          material_unit: "KG",
          spec_text: "",
          aux_unit: "",
          aux_quantity: "",
          quoted_price: "",
          quoted_unit: "",
          price: "",
        },
      ],
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // 🌟 自動換算引擎
  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      const item = { ...newItems[index], [field]: value };

      if (field === "spec_text" && value) {
        const parsed = parseSpecString(value, item.material_unit || "KG");
        if (parsed) {
          item.aux_quantity = parsed.auxQuantity;
          item.aux_unit = parsed.auxUnit;
          item.quoted_unit = parsed.auxUnit;
        }
      }

      if (["spec_text", "quoted_price", "aux_quantity"].includes(field)) {
        const qPrice = parseFloat(item.quoted_price) || 0;
        const aQty = parseFloat(item.aux_quantity) || 0;
        if (qPrice > 0 && aQty > 0) {
          item.price = Number((qPrice / aQty).toFixed(4)).toString();
        } else {
          item.price = "";
        }
      }

      newItems[index] = item;
      return { ...prev, items: newItems };
    });
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      ...initialFormData,
      effective_date: new Date().toISOString().split("T")[0],
      items: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (quote) => {
    setEditingId(quote.id);
    setFormData({
      provider_id: quote.provider,
      quote_date: quote.quote_date || "",
      valid_until: quote.valid_until || "",
      effective_date: quote.effective_date || "",
      is_tax_included: quote.is_tax_included,
      remark: quote.remark || "",
      items: JSON.parse(JSON.stringify(quote.items || [])),
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.provider_id || !formData.effective_date)
      return showAlert("資料不完整", "請填寫供應商與生效日期。", "warning");
    if (formData.items.length === 0)
      return showAlert("資料不完整", "請至少新增一筆報價品項", "warning");

    setIsSubmitting(true);
    const isEditing = editingId !== null;
    const url = isEditing
      ? `/api/provider_quotations/${editingId}`
      : "/api/provider_quotations";

    const payload = {
      ...formData,
      provider: formData.provider_id,
      quote_date: formData.quote_date || null,
      valid_until: formData.valid_until || null,
    };

    try {
      const response = await fetchWithAuth(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("儲存失敗，請檢查資料。");
      await fetchData();
      handleCloseModal();
      showAlert(
        "儲存成功",
        `已成功${isEditing ? "更新" : "新增"}報價單。`,
        "success",
      );
    } catch (error) {
      showAlert("發生錯誤", error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    showConfirm("刪除確認", "確定要刪除這張報價單嗎？", async () => {
      closeDialog();
      try {
        const response = await fetchWithAuth(`/api/provider_quotations/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("刪除失敗");
        await fetchData();
        showAlert("刪除成功", "已成功移除報價單。", "success");
      } catch (error) {
        showAlert("發生錯誤", error.message, "error");
      }
    });
  };

  // ==========================================
  // 🌟 Portal Searchable Dropdown (完美解決截斷問題)
  // ==========================================
  const SearchableDropdown = ({ value, onChange, options, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [dropdownStyle, setDropdownStyle] = useState({});
    const selectRef = useRef(null);
    const dropdownMenuRef = useRef(null);

    const selectedOption = useMemo(
      () => options.find((opt) => opt.id === value),
      [value, options],
    );

    const filteredOptions = useMemo(() => {
      if (!search) return options;
      const lowerSearch = search.toLowerCase();
      return options.filter(
        (opt) =>
          (opt.name && opt.name.toLowerCase().includes(lowerSearch)) ||
          (opt.code && opt.code.toLowerCase().includes(lowerSearch)),
      );
    }, [options, search]);

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
      const handleScrollOrClick = (e) => {
        if (
          dropdownMenuRef.current &&
          dropdownMenuRef.current.contains(e.target)
        )
          return;
        if (selectRef.current && selectRef.current.contains(e.target)) return;
        if (isOpen) setIsOpen(false);
      };

      const updatePosition = () => {
        if (isOpen && selectRef.current) {
          const rect = selectRef.current.getBoundingClientRect();
          setDropdownStyle({
            top: `${rect.bottom + 8}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
          });
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleScrollOrClick);
        // 設定 true 攔截 Modal 內的滾動事件，讓下拉選單隨之跟上
        document.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition, true);
      }
      return () => {
        document.removeEventListener("mousedown", handleScrollOrClick);
        document.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition, true);
      };
    }, [isOpen]);

    return (
      <>
        <div
          ref={selectRef}
          onClick={handleToggle}
          className={`w-full px-4 py-2.5 border rounded-xl text-sm cursor-pointer bg-white flex justify-between items-center transition-all ${
            isOpen
              ? "border-blue-500 ring-4 ring-blue-500/10"
              : "border-slate-300 hover:border-slate-400"
          }`}
        >
          <span
            className={
              selectedOption
                ? "text-slate-800 font-bold"
                : "text-slate-400 font-medium"
            }
          >
            {selectedOption
              ? `[${selectedOption.code}] ${selectedOption.name}`
              : placeholder}
          </span>
          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>

        {isOpen &&
          createPortal(
            <div
              ref={dropdownMenuRef}
              style={dropdownStyle}
              className="fixed bg-white border border-slate-200 shadow-2xl rounded-2xl max-h-72 flex flex-col z-[99999] overflow-hidden"
            >
              <div className="p-3 border-b border-slate-100 bg-slate-50 shrink-0">
                <input
                  autoFocus
                  type="text"
                  placeholder="搜尋代碼或名稱..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm font-medium text-slate-800"
                />
              </div>
              <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => {
                        onChange(opt);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer rounded-xl flex items-center gap-3 transition-colors"
                    >
                      <span className="text-[11px] font-mono bg-white shadow-sm border border-slate-200 px-2 py-0.5 rounded-lg text-slate-500 font-bold">
                        {opt.code}
                      </span>
                      <span className="text-sm font-bold text-slate-700">
                        {opt.name}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-slate-400 font-medium">
                    查無結果
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )}
      </>
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto bg-slate-50/50 min-h-screen font-sans text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            供應商報價管理
          </h2>
          <p className="text-slate-500 mt-2 font-semibold">
            紀錄並自動換算供應商的歷史報價與未來調漲資訊
          </p>
        </div>
      </div>

      <div className="bg-blue-50/80 text-blue-800 text-sm p-5 rounded-2xl border border-blue-100/50 mb-8 shadow-sm">
        <p className="flex items-center gap-2 font-bold mb-2">
          <span className="text-xl">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1.5 ml-6 text-slate-700 font-medium">
          <li>
            此表單用於預先登記廠商發出的<strong>未來調漲通知</strong>
            與包裝變更，單據內可動態條列新增多筆物料。
          </li>
          <li>
            輸入下單規格與總價，系統將為您{" "}
            <strong className="text-blue-700">自動換算系統基本單價</strong>。
          </li>
          <li>
            請購單在建立時，系統將自動比對此處的{" "}
            <strong className="text-blue-700">生效日期</strong>
            ，並帶入最新且已生效的單價。
          </li>
        </ul>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 mb-8 flex justify-between items-center gap-5">
        <div className="flex gap-4 w-full md:w-auto items-center flex-1">
          <div className="relative w-full sm:w-72">
            <Search
              className="absolute left-4 top-3 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="搜尋供應商..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-medium transition-all duration-200"
            />
          </div>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)] font-bold transition-all hover:-translate-y-0.5 whitespace-nowrap"
        >
          + 建立報價單
        </button>
      </div>

      <div className="space-y-4">
        {currentData.length > 0 ? (
          currentData.map((q) => (
            <div
              key={q.id}
              className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors"
            >
              <div
                className="p-6 flex justify-between items-center cursor-pointer"
                onClick={() =>
                  setExpandedRows((prev) =>
                    prev.includes(q.id)
                      ? prev.filter((id) => id !== q.id)
                      : [...prev, q.id],
                  )
                }
              >
                <div className="flex items-center gap-5">
                  <span
                    className={`w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-full text-slate-400 transition-transform ${expandedRows.includes(q.id) ? "rotate-90" : ""}`}
                  >
                    ▶
                  </span>
                  <span className="font-mono text-[13px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
                    #{q.id}
                  </span>
                  <div className="flex flex-col ml-1">
                    <span className="font-extrabold text-xl text-slate-800 tracking-tight">
                      {q.provider_name}
                    </span>
                    <span className="text-sm text-slate-500 font-semibold mt-1">
                      系統生效日:{" "}
                      <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded ml-1">
                        {q.effective_date}
                      </span>
                      <span className="mx-3 text-slate-300">|</span>
                      單據品項:{" "}
                      <span className="text-slate-700 font-bold">
                        {q.items?.length || 0}
                      </span>{" "}
                      項
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditModal(q);
                    }}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-600 hover:text-white transition-all duration-200 text-xs font-bold inline-flex items-center gap-1 shadow-sm"
                  >
                    <Edit size={14} /> 編輯
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(q.id);
                    }}
                    className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-600 hover:text-white transition-all duration-200 text-xs font-bold inline-flex items-center gap-1 shadow-sm"
                  >
                    <Trash2 size={14} /> 刪除
                  </button>
                </div>
              </div>
              {expandedRows.includes(q.id) && (
                <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100">
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[11px] text-slate-400 tracking-widest uppercase border-b border-slate-100 bg-slate-50/50">
                          <th className="py-4 px-5">物料名稱</th>
                          <th className="py-4 px-5 text-center">下單規格</th>
                          <th className="py-4 px-5 text-center">
                            廠商原始報價
                          </th>
                          <th className="py-4 px-5 text-center">報價單位</th>
                          <th className="py-4 px-5 text-center">
                            系統換算單價
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {q.items?.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-blue-50/30 transition-colors"
                          >
                            <td className="py-4 px-5 font-bold text-slate-800 text-[15px]">
                              {item.material_name}
                            </td>
                            <td className="py-4 px-5 text-[15px] font-bold text-slate-600 text-center">
                              {item.spec_text || "-"}
                            </td>
                            <td className="py-4 px-5 text-center font-mono font-bold text-slate-600 text-[15px]">
                              {item.quoted_price
                                ? `$${formatDisplayNum(item.quoted_price)}`
                                : "-"}
                            </td>
                            <td className="py-4 px-5 text-center font-bold text-slate-600 text-[15px]">
                              {item.quoted_unit || "-"}
                            </td>
                            <td className="py-4 px-5 text-center">
                              <span className="font-mono font-black text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg shadow-sm text-base">
                                $
                                {parseFloat(
                                  formatDisplayNum(item.price),
                                ).toFixed(2)}{" "}
                                <span className="text-xs text-blue-500 ml-1">
                                  / {item.material_unit}
                                </span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {q.remark && (
                    <div className="mt-4 text-sm font-medium text-slate-500 italic bg-white p-4 rounded-xl border border-slate-200">
                      備註：{q.remark}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-16 text-center text-slate-400 font-bold bg-white rounded-3xl border border-slate-200">
            查無任何報價單資料
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-opacity">
          <div className="bg-slate-50 rounded-[2rem] shadow-2xl w-full max-w-[1200px] max-h-[90vh] flex flex-col overflow-hidden border border-white/20">
            <div className="p-6 md:px-8 border-b border-slate-200/60 flex justify-between items-center bg-white/90 backdrop-blur-md z-10 shrink-0">
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {editingId ? "編輯供應商報價單" : "新增供應商報價單"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 md:p-8 pb-16 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                      供應商 <span className="text-red-500">*</span>
                    </label>
                    <SearchableDropdown
                      value={formData.provider_id}
                      options={providers}
                      onChange={(opt) =>
                        handleMasterChange({
                          target: { name: "provider_id", value: opt.id },
                        })
                      }
                      placeholder="請選擇供應商..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                      報價日期
                    </label>
                    <input
                      type="date"
                      name="quote_date"
                      value={formData.quote_date}
                      onChange={handleMasterChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                      生效日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      name="effective_date"
                      value={formData.effective_date}
                      onChange={handleMasterChange}
                      className="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[15px] font-black text-blue-900 outline-none focus:ring-4 focus:ring-blue-500/20 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                      報價效期 (至)
                    </label>
                    <input
                      type="date"
                      name="valid_until"
                      value={formData.valid_until || ""}
                      onChange={handleMasterChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        name="is_tax_included"
                        checked={formData.is_tax_included}
                        onChange={handleMasterChange}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5.5 after:transition-all peer-checked:bg-blue-600 transition-colors shadow-inner"></div>
                      <span className="ml-3 text-[13px] font-bold text-slate-600 tracking-wider group-hover:text-slate-800 transition-colors">
                        單價已含稅
                      </span>
                    </label>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
                  <div className="flex justify-between items-center mb-6 pl-2">
                    <h4 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                      <FileText size={18} className="text-blue-500" />{" "}
                      報價品項清單
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition-transform hover:-translate-y-0.5"
                    >
                      + 新增品項
                    </button>
                  </div>

                  {formData.items.length === 0 ? (
                    <div className="p-12 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400 font-bold">
                      請點擊右上方新增報價品項
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                          <tr>
                            <th className="px-4 py-3 min-w-[280px]">
                              物料名稱
                            </th>
                            <th className="px-4 py-3 min-w-[150px] text-center">
                              下單規格
                            </th>
                            <th className="px-4 py-3 min-w-[130px] text-center">
                              廠商報價
                            </th>
                            <th className="px-4 py-3 min-w-[100px] text-center">
                              報價單位
                            </th>
                            <th className="px-4 py-3 min-w-[160px] text-center">
                              系統單價(自動換算)
                            </th>
                            <th className="px-4 py-3 w-[60px] text-center">
                              操作
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {formData.items.map((item, index) => (
                            <tr
                              key={index}
                              className="hover:bg-blue-50/20 transition-colors"
                            >
                              <td className="px-4 py-3 relative">
                                <SearchableDropdown
                                  value={item.material}
                                  options={materials}
                                  onChange={(m) => {
                                    handleItemChange(index, "material", m.id);
                                    handleItemChange(
                                      index,
                                      "material_name",
                                      m.name,
                                    );
                                    handleItemChange(
                                      index,
                                      "material_unit",
                                      m.unit || "KG",
                                    );
                                  }}
                                  placeholder="選擇物料"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={item.spec_text}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "spec_text",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-bold text-center outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={item.quoted_price}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "quoted_price",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-mono font-bold text-center outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={item.quoted_unit}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "quoted_unit",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-bold text-center outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all"
                                />
                              </td>
                              <td className="px-4 py-3 relative flex items-center justify-center gap-1.5 h-full pt-[18px]">
                                <span className="text-blue-500 font-black text-sm">
                                  $
                                </span>
                                <input
                                  type="text"
                                  required
                                  value={parseFloat(item.price || 0).toFixed(2)}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "price",
                                      e.target.value,
                                    )
                                  }
                                  className="w-24 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-[15px] font-mono font-black text-blue-800 text-center outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all"
                                />
                                <span className="text-slate-400 font-bold text-xs whitespace-nowrap">
                                  / {item.material_unit || "KG"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(index)}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-6">
                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                      整單備註說明
                    </label>
                    <textarea
                      name="remark"
                      value={formData.remark}
                      onChange={handleMasterChange}
                      rows={2}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all resize-none custom-scrollbar"
                      placeholder="任何需要特別注意的調漲說明..."
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 md:px-10 md:py-6 border-t border-slate-100 bg-white/90 backdrop-blur-md flex justify-end gap-4 z-10 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)]">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-8 py-3.5 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 text-[15px] font-bold rounded-xl shadow-sm transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-10 py-3.5 text-white bg-blue-600 hover:bg-blue-700 text-[15px] font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:-translate-y-0.5 transition-all disabled:opacity-50 tracking-wide"
                >
                  {isSubmitting ? "儲存中..." : "確認儲存報價"}
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
  );
}

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  ChevronDown,
  Trash2,
  Plus,
  Save,
  Package,
  Loader2,
  Edit2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";

// ==========================================
// 🌟 輔助函數
// ==========================================
const formatNum = (num, maxDecimals = 4) => {
  if (num === null || num === undefined || isNaN(num) || num === "") return "0";
  return parseFloat(Number(num).toFixed(maxDecimals)).toString();
};

const formatCurrency = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Number(num).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
};

const handleNumericTextInput = (val, allowDecimal = true) => {
  if (val === "") return "";
  let clean = val.replace(/[^0-9.]/g, "");
  if (!allowDecimal) clean = clean.replace(/\./g, "");
  const parts = clean.split(".");
  if (parts.length > 2) clean = parts[0] + "." + parts.slice(1).join("");
  return clean;
};

// ==========================================
// 🌟 客製化下拉選單 (FilterableDropdown)
// ==========================================
const FilterableDropdown = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  disabledIds = [],
  renderItem,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const selectRef = useRef(null);
  const dropdownMenuRef = useRef(null);

  const filteredOptions = options.filter(
    (opt) =>
      (opt.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.code || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedOpt = options.find((o) => String(o.id) === String(value));

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && selectRef.current) {
      const rect = selectRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 260;

      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        setDropdownStyle({
          bottom: `${window.innerHeight - rect.top + 6}px`,
          top: "auto",
          left: `${rect.left}px`,
          width: `${rect.width}px`,
        });
      } else {
        setDropdownStyle({
          top: `${rect.bottom + 6}px`,
          bottom: "auto",
          left: `${rect.left}px`,
          width: `${rect.width}px`,
        });
      }
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleScroll = (e) => {
      if (dropdownMenuRef.current && dropdownMenuRef.current.contains(e.target))
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
        className={`w-full h-11 px-3.5 py-2 border rounded-xl text-[14px] flex justify-between items-center transition-all shadow-sm cursor-pointer ${
          disabled
            ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
            : isOpen
              ? "border-blue-400 ring-2 ring-blue-500/10 bg-white"
              : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 font-medium"
        }`}
      >
        <span className="truncate pr-2">
          {selectedOpt ? (
            renderItem ? (
              renderItem(selectedOpt)
            ) : (
              selectedOpt.name
            )
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 transition-transform ${isOpen ? "rotate-180 text-blue-500" : "text-slate-400"}`}
        />
      </div>

      {isOpen && !disabled && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
          ></div>
          <div
            ref={dropdownMenuRef}
            style={dropdownStyle}
            className="fixed z-[9999] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl flex flex-col max-h-64 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-2 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  autoFocus
                  className="w-full border border-slate-200 bg-white rounded-xl pl-8 pr-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm"
                  placeholder="輸入代碼或名稱搜尋..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-1.5 custom-scrollbar">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isSelected = String(value) === String(opt.id);
                  const isItemDisabled =
                    opt.id &&
                    disabledIds.includes(String(opt.id)) &&
                    !isSelected;

                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        if (isItemDisabled) return;
                        onChange(opt.id);
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                      className={`px-3 py-2.5 text-[13px] rounded-xl transition-colors font-medium flex justify-between items-center ${
                        isSelected
                          ? "bg-blue-50 text-blue-700 font-bold"
                          : isItemDisabled
                            ? "text-slate-400 bg-slate-50/50 cursor-not-allowed"
                            : "text-slate-700 hover:bg-slate-50 cursor-pointer"
                      }`}
                    >
                      <span>{renderItem ? renderItem(opt) : opt.name}</span>
                      {isItemDisabled && (
                        <span className="text-[10px] text-slate-400 font-bold border border-slate-200 bg-white px-1.5 py-0.5 rounded">
                          已選
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-3 py-6 text-center text-slate-400 text-[13px] font-medium">
                  查無資料
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

// ==========================================
// 🌟 主頁面
// ==========================================
export default function PackageOrderPage() {
  const [packageOrders, setPackageOrders] = useState([]);
  const [semiMaterials, setSemiMaterials] = useState([]);
  const [packMaterials, setPackMaterials] = useState([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formError, setFormError] = useState("");

  const initialForm = {
    order_number: "",
    new_product_code: "",
    semi_material: "",
    outer_pack: "",
    inner_pack: "",
    additional_packs: [],
    sales_unit: "箱",
    sales_unit_quantity: "1",
    sales_pack_unit: "包",
    sales_pack_quantity: "0",
    spec: "",
  };
  const [formData, setFormData] = useState(initialForm);

  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
    onConfirm: null,
  });

  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));
  const showAlert = (title, message, status = "info") =>
    setDialog({
      isOpen: true,
      type: "alert",
      status,
      title,
      message,
      onConfirm: null,
    });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [ordersRes, materialsRes] = await Promise.all([
        fetchWithAuth("/api/package_orders"),
        fetchWithAuth("/api/materials"),
      ]);

      if (!ordersRes.ok || !materialsRes.ok) throw new Error("載入資料失敗");

      const ordersData = await ordersRes.json();
      const materialsData = await materialsRes.json();

      setPackageOrders(ordersData.data || ordersData || []);

      const allMats = materialsData.data || materialsData || [];
      setSemiMaterials(allMats.filter((m) => m.type === "SEMI"));
      setPackMaterials([
        { id: "", name: "-- 無需對應包材 --", code: "", pack_capacity: null },
        ...allMats.filter((m) => ["PACK", "STICKER", "OTHER"].includes(m.type)),
      ]);
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const updateFormField = (field, value) => {
    setFormData((prev) => {
      let updated = { ...prev, [field]: value };

      // 🌟 自動帶入預設的新成品代碼
      if (field === "semi_material" && !editingId) {
        const selectedSemi = semiMaterials.find(
          (m) => String(m.id) === String(value),
        );
        if (selectedSemi && selectedSemi.code) {
          updated.new_product_code = `${selectedSemi.code}-`;
        }
      }

      if (
        [
          "outer_pack",
          "inner_pack",
          "sales_unit",
          "sales_pack_unit",
          "sales_pack_quantity",
          "sales_unit_quantity",
        ].includes(field)
      ) {
        let nextOuterPack = field === "outer_pack" ? value : updated.outer_pack;
        let nextInnerPack = field === "inner_pack" ? value : updated.inner_pack;
        let nextSalesUnit = field === "sales_unit" ? value : updated.sales_unit;
        let nextPackUnit =
          field === "sales_pack_unit" ? value : updated.sales_pack_unit;
        let nextSalesQtyStr =
          field === "sales_unit_quantity" ? value : updated.sales_unit_quantity;
        let nextPackQtyStr =
          field === "sales_pack_quantity" ? value : updated.sales_pack_quantity;

        const outerMat = packMaterials.find(
          (m) => String(m.id) === String(nextOuterPack),
        );
        const innerMat = packMaterials.find(
          (m) => String(m.id) === String(nextInnerPack),
        );

        if (field === "outer_pack") {
          if (!value) {
            nextSalesQtyStr = "0";
            nextSalesUnit = "";
          } else if (outerMat) {
            const match = outerMat.name.match(/([箱桶袋包罐瓶])/);
            if (match) nextSalesUnit = match[1];
          }
          updated.sales_unit_quantity = nextSalesQtyStr;
          updated.sales_unit = nextSalesUnit;
        }

        if (field === "inner_pack") {
          if (!value) {
            nextPackQtyStr = "0";
            nextPackUnit = "";
          } else if (innerMat) {
            const match = innerMat.name.match(/([箱桶袋包罐瓶])/);
            if (match) nextPackUnit = match[1];
          }
          updated.sales_pack_quantity = nextPackQtyStr;
          updated.sales_pack_unit = nextPackUnit;
        }

        const parsedSalesQty = Number(nextSalesQtyStr) || 0;
        const parsedPackQty = Number(nextPackQtyStr) || 0;

        const outerCap = outerMat?.pack_capacity
          ? parseInt(outerMat.pack_capacity)
          : 0;
        const innerCap = innerMat?.pack_capacity
          ? parseInt(innerMat.pack_capacity)
          : 0;

        if (nextInnerPack && parsedPackQty > 0) {
          const weight = innerCap ? `${innerCap}KG` : "1KG";
          updated.spec = `${weight}*${parsedPackQty}${nextPackUnit || "包"}/${nextSalesUnit || "箱"}`;
        } else if (nextOuterPack && parsedSalesQty > 0) {
          const weight = outerCap ? `${outerCap}KG` : "10KG";
          updated.spec = `${weight}/${nextSalesUnit || "桶"}`;
        } else {
          updated.spec = "";
        }
      }

      return updated;
    });
  };

  const addAdditionalPack = () => {
    setFormData((prev) => ({
      ...prev,
      additional_packs: [
        ...prev.additional_packs,
        { id: `temp_${Date.now()}`, material_id: "", qty: "1" },
      ],
    }));
  };

  const updateAdditionalPack = (index, field, value) => {
    setFormData((prev) => {
      const newPacks = [...prev.additional_packs];
      newPacks[index] = { ...newPacks[index], [field]: value };
      return { ...prev, additional_packs: newPacks };
    });
  };

  const removeAdditionalPack = (index) => {
    setFormData((prev) => ({
      ...prev,
      additional_packs: prev.additional_packs.filter((_, i) => i !== index),
    }));
  };

  const handleOpenModal = (order = null) => {
    setFormError("");
    if (order) {
      setEditingId(order.id);

      const additional_packs = [];
      const packagingInfo = order.packaging_info || [];

      packagingInfo.forEach((item, index) => {
        if (item.layer === "outer" || item.layer === "inner") {
          // handled by serializer directly
        } else {
          additional_packs.push({
            id: `exist_${index}`,
            material_id: String(item.material_id),
            qty: String(item.qty || 1),
          });
        }
      });

      setFormData({
        order_number: order.order_number || "",
        new_product_code: order.product_code || "",
        semi_material: String(order.semi_material) || "",
        outer_pack: order.outer_pack ? String(order.outer_pack) : "",
        inner_pack: order.inner_pack ? String(order.inner_pack) : "",
        additional_packs,
        sales_unit: order.sales_unit || "箱",
        sales_unit_quantity: order.sales_unit_quantity
          ? String(order.sales_unit_quantity)
          : "1",
        sales_pack_unit: order.sales_pack_unit || "包",
        sales_pack_quantity: order.sales_pack_quantity
          ? String(order.sales_pack_quantity)
          : "0",
        spec: order.spec || "",
      });
    } else {
      setEditingId(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formData.semi_material) return setFormError("請選擇半成品 (SEMI)");
    if (!formData.order_number) return setFormError("請填寫包裝單號");

    // 🌟 成品代碼結尾格式防呆 (僅新建時判斷)
    if (!editingId) {
      if (!formData.new_product_code) return setFormError("請填寫成品代碼");
      if (!/[a-zA-Z0-9]$/.test(formData.new_product_code)) {
        return setFormError("成品代碼必須以英文字母或數字結尾");
      }
    }

    setIsSubmitting(true);
    try {
      const packaging_info = [];
      if (formData.outer_pack) {
        packaging_info.push({
          layer: "outer",
          material_id: formData.outer_pack,
          qty: Number(formData.sales_unit_quantity) || 1,
        });
      }
      if (formData.inner_pack) {
        packaging_info.push({
          layer: "inner",
          material_id: formData.inner_pack,
          qty: Number(formData.sales_pack_quantity) || 1,
        });
      }

      formData.additional_packs.forEach((pack) => {
        if (pack.material_id) {
          packaging_info.push({
            layer: "other",
            material_id: pack.material_id,
            qty: Number(pack.qty) || 1,
          });
        }
      });

      const payload = {
        ...formData,
        packaging_info,
      };

      const url = editingId
        ? `/api/package_orders/${editingId}`
        : "/api/package_orders";
      const method = editingId ? "PUT" : "POST";

      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();

      if (!res.ok) {
        let errStr = "儲存失敗，請檢查輸入內容";
        if (responseData.data && typeof responseData.data === "object") {
          const values = Object.values(responseData.data);
          if (values.length > 0 && Array.isArray(values[0])) {
            errStr = values[0][0];
          }
        } else if (responseData.error) {
          errStr = responseData.error;
        } else if (responseData.detail) {
          errStr = responseData.detail;
        } else if (responseData.message && responseData.message !== "error") {
          errStr = responseData.message;
        }
        throw new Error(errStr);
      }

      setIsModalOpen(false);
      showAlert(
        "成功",
        `已成功${editingId ? "更新" : "建立"}包裝單，並連動成品資料！`,
        "success",
      );
      fetchInitialData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id, orderNumber) => {
    setDialog({
      isOpen: true,
      type: "confirm",
      status: "warning",
      title: "刪除確認",
      message: `確定要刪除包裝單 [${orderNumber}] 嗎？這將無法復原。`,
      onConfirm: async () => {
        closeDialog();
        try {
          const res = await fetchWithAuth(`/api/package_orders/${id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("刪除失敗");
          showAlert("成功", "已成功刪除包裝單", "success");
          fetchInitialData();
        } catch (err) {
          showAlert("錯誤", err.message, "error");
        }
      },
    });
  };

  const calculatePackCostPreview = () => {
    let cost = 0;

    const outerMat = packMaterials.find(
      (m) => String(m.id) === String(formData.outer_pack),
    );
    const innerMat = packMaterials.find(
      (m) => String(m.id) === String(formData.inner_pack),
    );

    if (outerMat)
      cost +=
        (parseFloat(outerMat.estimated_cost) || 0) *
        (Number(formData.sales_unit_quantity) || 1);
    if (innerMat)
      cost +=
        (parseFloat(innerMat.estimated_cost) || 0) *
        (Number(formData.sales_pack_quantity) || 1);

    formData.additional_packs.forEach((pack) => {
      const addMat = packMaterials.find(
        (m) => String(m.id) === String(pack.material_id),
      );
      if (addMat) {
        cost +=
          (parseFloat(addMat.estimated_cost) || 0) * (Number(pack.qty) || 1);
      }
    });

    return Math.round(cost);
  };

  const disabledMaterialIds = useMemo(() => {
    const ids = [];
    if (formData.outer_pack) ids.push(String(formData.outer_pack));
    if (formData.inner_pack) ids.push(String(formData.inner_pack));
    formData.additional_packs.forEach((p) => {
      if (p.material_id) ids.push(String(p.material_id));
    });
    return ids;
  }, [formData.outer_pack, formData.inner_pack, formData.additional_packs]);

  const filteredOrders = useMemo(() => {
    return packageOrders.filter(
      (order) =>
        (order.order_number || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (order.product_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (order.product_code || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (order.semi_material_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (order.semi_material_code || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
    );
  }, [packageOrders, searchTerm]);

  const canSave = useMemo(() => {
    if (!formData.order_number) return false;
    if (!editingId && !formData.new_product_code) return false;
    if (!formData.semi_material) return false;

    const hasMainPack = !!formData.outer_pack || !!formData.inner_pack;
    const hasAdditionalPack = formData.additional_packs.some(
      (p) => !!p.material_id,
    );

    return hasMainPack || hasAdditionalPack;
  }, [formData, editingId]);

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto bg-slate-50 min-h-screen font-sans text-slate-800">
      <div className="flex justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
          包裝單管理
        </h2>
      </div>

      <div className="bg-blue-50 text-blue-800 text-[13px] p-5 rounded-2xl mb-8 border border-blue-100 shadow-sm leading-relaxed">
        <p className="flex items-center gap-2 font-bold mb-1.5 text-[14px]">
          <Package size={18} /> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700 font-medium">
          <li>
            建立包裝單時，系統將根據您輸入的自訂代號，
            <strong>自動產生對應的新成品</strong>。
          </li>
          <li>系統便會自動推算規格文本並試算包材總成本。</li>
          <li>設定好的包裝單，可在報價單以及訂購單產生頁面使用。</li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            placeholder="搜尋包裝單號、成品或半成品..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 shadow-sm transition-all"
          />
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"
        >
          <Plus size={16} /> 建立包裝單
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto w-full custom-scrollbar">
          <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
            <thead className="bg-slate-50 text-[12px] text-slate-500 font-medium uppercase tracking-wider border-b border-slate-200">
              <tr>
                {/* 🌟 調整百分比配重 */}
                <th className="p-4 w-[15%]">包裝單號</th>
                <th className="p-4 w-[22%]">成品</th>
                <th className="p-4 w-[22%]">半成品</th>
                <th className="p-4 w-[15%]">規格</th>
                <th className="p-4 w-[25%] text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {loading ? (
                <tr>
                  <td
                    colSpan="5"
                    className="p-16 text-center text-slate-400 font-medium"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                      載入資料中...
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="p-16 text-center text-slate-400 font-medium"
                  >
                    找不到符合條件的包裝單
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="p-4 align-middle">
                      <span className="font-mono text-[14px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {order.order_number}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex flex-col gap-0.5 pr-2">
                        <span className="font-mono text-[14px] font-bold text-blue-700">
                          {order.product_code}
                        </span>
                        <span className="font-medium text-slate-600 line-clamp-1 text-[12px]">
                          {order.product_name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex flex-col gap-0.5 pr-2">
                        <span className="font-mono text-[14px] font-bold text-purple-700">
                          {order.semi_material_code}
                        </span>
                        <span className="font-medium text-slate-600 line-clamp-1 text-[12px]">
                          {order.semi_material_name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 align-middle font-medium text-slate-600">
                      {order.spec || "-"}
                    </td>
                    <td className="p-4 align-middle text-center">
                      <div className="flex justify-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenModal(order)}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-all text-[12px] font-medium shadow-sm flex items-center gap-1.5"
                        >
                          <Edit2 size={13} /> 編輯
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(order.id, order.order_number)
                          }
                          className="px-3 py-1.5 bg-red-50 border border-red-100 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-all text-[12px] font-medium shadow-sm flex items-center gap-1.5"
                        >
                          <Trash2 size={13} /> 刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================== */}
      {/* 🌟 建立/編輯 Modal */}
      {/* ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center rounded-t-3xl bg-white shrink-0">
              <h3 className="text-[18px] font-bold text-slate-800 flex items-center gap-2.5">
                <Package
                  className="text-blue-500"
                  size={20}
                  strokeWidth={2.5}
                />
                {editingId ? "編輯包裝單" : "建立包裝單"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto custom-scrollbar flex flex-col"
            >
              <div className="p-6 md:p-8 space-y-8 flex-1">
                {/* 區塊 1：基本與連動資訊 */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="sm:col-span-2">
                      <label className="block text-[12px] font-bold text-slate-600 mb-1.5">
                        選擇物料 <span className="text-red-500">*</span>
                      </label>
                      <FilterableDropdown
                        value={formData.semi_material}
                        onChange={(val) =>
                          updateFormField("semi_material", val)
                        }
                        options={semiMaterials}
                        placeholder="搜尋半成品料號或名稱"
                        renderItem={(m) => (
                          <div className="flex justify-between items-center w-full">
                            <span className="text-[13px] text-slate-400 font-mono">
                              [{m.code}]
                            </span>
                            <span className="text-[13px] text-slate-700 font-medium ml-2 truncate">
                              {m.name}
                            </span>
                          </div>
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-slate-600 mb-1.5">
                        自訂成品代碼 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={!editingId}
                        disabled={!!editingId}
                        value={formData.new_product_code}
                        onChange={(e) =>
                          updateFormField("new_product_code", e.target.value)
                        }
                        placeholder="例如: P-001"
                        className="w-full px-3.5 py-2.5 h-[42px] bg-white border border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none text-[14px] font-mono font-medium text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 shadow-sm transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-slate-600 mb-1.5">
                        自訂包裝單號 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!!editingId}
                        value={formData.order_number}
                        onChange={(e) =>
                          updateFormField("order_number", e.target.value)
                        }
                        placeholder="例如: PKG-001"
                        className="w-full px-3.5 py-2.5 h-[42px] bg-white border border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none text-[14px] font-mono font-medium text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 shadow-sm transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* 區塊 2：包材結構與換算設定 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-[12px] font-bold text-blue-500 uppercase tracking-widest">
                      包材結構與換算設定
                    </h4>
                    <button
                      type="button"
                      onClick={addAdditionalPack}
                      className="text-[12px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <Plus size={14} /> 新增包材
                    </button>
                  </div>

                  <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100 flex flex-col gap-4">
                    {/* 銷售大單位 */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                      <span className="text-[12px] font-bold text-slate-500 tracking-wide block">
                        包材單位
                      </span>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-4 sm:col-span-2">
                          <FilterableDropdown
                            value={formData.outer_pack}
                            onChange={(val) =>
                              updateFormField("outer_pack", val)
                            }
                            options={packMaterials.filter(
                              (pm) => pm.type === "PACK" || !pm.id,
                            )}
                            disabledIds={disabledMaterialIds}
                            placeholder="-- 無需對應外包裝 --"
                            renderItem={(m) =>
                              m.id ? `[${m.code}] ${m.name}` : m.name
                            }
                          />
                        </div>
                        {/* 🌟 數量與單位交換位置 */}
                        <div className="col-span-2 sm:col-span-1 relative flex items-center">
                          <span className="absolute left-3 text-slate-400 font-bold text-[13px] z-10">
                            x
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="數量"
                            value={formData.sales_unit_quantity}
                            onChange={(e) =>
                              updateFormField(
                                "sales_unit_quantity",
                                handleNumericTextInput(e.target.value),
                              )
                            }
                            className="w-full h-11 pl-7 pr-3 bg-white border border-slate-200 rounded-xl text-center font-mono font-medium text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none shadow-sm transition-all"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <input
                            type="text"
                            placeholder="單位 (箱)"
                            value={formData.sales_unit}
                            onChange={(e) =>
                              updateFormField("sales_unit", e.target.value)
                            }
                            className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-center font-medium text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none shadow-sm transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 內部小單位 */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                      <span className="text-[12px] font-bold text-slate-500 tracking-wide block">
                        輔助單位 (選填)
                      </span>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-4 sm:col-span-2">
                          <FilterableDropdown
                            value={formData.inner_pack}
                            onChange={(val) =>
                              updateFormField("inner_pack", val)
                            }
                            options={packMaterials.filter(
                              (pm) => pm.type === "PACK" || !pm.id,
                            )}
                            disabledIds={disabledMaterialIds}
                            placeholder="-- 無需對應內包裝 --"
                            renderItem={(m) =>
                              m.id ? `[${m.code}] ${m.name}` : m.name
                            }
                          />
                        </div>
                        {/* 🌟 數量與單位交換位置 */}
                        <div className="col-span-2 sm:col-span-1 relative flex items-center">
                          <span className="absolute left-3 text-slate-400 font-bold text-[13px] z-10">
                            x
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="數量"
                            value={formData.sales_pack_quantity}
                            onChange={(e) =>
                              updateFormField(
                                "sales_pack_quantity",
                                handleNumericTextInput(e.target.value),
                              )
                            }
                            className="w-full h-11 pl-7 pr-3 bg-white border border-slate-200 rounded-xl text-center font-mono font-medium text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none shadow-sm transition-all"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <input
                            type="text"
                            placeholder="單位 (包)"
                            value={formData.sales_pack_unit}
                            onChange={(e) =>
                              updateFormField("sales_pack_unit", e.target.value)
                            }
                            className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-center font-medium text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none shadow-sm transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 動態新增的包裝清單 */}
                    {formData.additional_packs.length > 0 && (
                      <div className="space-y-3">
                        {formData.additional_packs.map((pack, idx) => (
                          <div
                            key={pack.id}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2"
                          >
                            <div className="flex-1">
                              <FilterableDropdown
                                value={pack.material_id}
                                onChange={(val) =>
                                  updateAdditionalPack(idx, "material_id", val)
                                }
                                options={packMaterials}
                                disabledIds={disabledMaterialIds}
                                placeholder="選擇額外包材 / 標籤"
                                renderItem={(m) =>
                                  m.id ? `[${m.code}] ${m.name}` : m.name
                                }
                              />
                            </div>
                            <div className="w-[110px] shrink-0 relative flex items-center">
                              <span className="absolute left-3 text-slate-400 font-bold text-[13px] z-10">
                                x
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="數量"
                                value={pack.qty}
                                onChange={(e) =>
                                  updateAdditionalPack(
                                    idx,
                                    "qty",
                                    handleNumericTextInput(e.target.value),
                                  )
                                }
                                className="w-full h-11 pl-7 pr-3 bg-white border border-slate-200 rounded-xl text-center font-mono font-medium text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all shadow-sm"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAdditionalPack(idx)}
                              className="w-11 h-11 flex items-center justify-center shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            >
                              <XCircle size={20} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 預覽與規格 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-bold text-slate-500 uppercase">
                          包裝規格
                        </label>
                        <input
                          type="text"
                          value={formData.spec}
                          onChange={(e) =>
                            updateFormField("spec", e.target.value)
                          }
                          placeholder="如：1KG*10包/箱"
                          className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl font-medium text-[14px] text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none shadow-sm transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-bold text-slate-500 uppercase">
                          預估包材成本
                        </label>
                        <div className="w-full h-11 px-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between shadow-inner">
                          <span className="text-blue-700 font-bold text-[14px] font-mono">
                            ${formatCurrency(calculatePackCostPreview())}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-[13px] font-bold flex items-start gap-2.5 shadow-sm animate-in slide-in-from-top-2">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-[14px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !canSave}
                  className="px-7 py-2.5 text-[14px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {editingId ? "儲存變更" : "確認建立"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomDialog isOpen={dialog.isOpen} {...dialog} onClose={closeDialog} />
    </div>
  );
}

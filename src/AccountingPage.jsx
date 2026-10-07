import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Database,
  Calculator,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Plus,
  Edit2,
  Wallet,
  Receipt,
  FileText,
  Landmark,
  CreditCard,
  CalendarDays,
  AlertCircle,
  ChevronDown,
  CheckSquare,
  Square,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useAuthStore } from "./store/authStore";

// ==========================================
// 🌟 輔助函數
// ==========================================
const formatMoney = (val) => {
  if (val === null || val === undefined || val === "") return "0";
  const num = parseFloat(val);
  return isNaN(num)
    ? "0"
    : num.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
};

const getFirstDayOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
};

const getLastDayOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
};

const extractArrayData = (json) => {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.data)) return json.data;
  if (json && Array.isArray(json.results)) return json.results;
  return [];
};

// ==========================================
// 🌟 客製化下拉選單 (共用元件)
// ==========================================
const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder = "請選擇...",
  disabled = false,
  className = "",
  menuClassName = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectRef.current && !selectRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value),
  );

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold transition-all shadow-sm ${
          disabled
            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
            : "cursor-pointer hover:border-blue-400 text-slate-800"
        } ${isOpen ? "ring-4 ring-blue-500/10 border-blue-500" : ""}`}
      >
        <span
          className={`truncate ${selectedOption ? "text-slate-800" : "text-slate-400"}`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? "rotate-180 text-blue-500" : ""}`}
        />
      </div>
      {/* 這裡的下拉選單維持 absolute，會自然蓋在外部 */}
      {isOpen && !disabled && (
        <div
          className={`absolute z-[100] top-[calc(100%+8px)] left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar ${menuClassName}`}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`px-4 py-3 text-sm font-bold cursor-pointer transition-colors ${
                String(value) === String(opt.value)
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================
// Main Page Component
// ==========================================
export default function AccountingPage() {
  const isRD = useAuthStore((state) => state.isRD());

  const [activeTab, setActiveTab] = useState("REPORTS");
  const [reportSubTab, setReportSubTab] = useState("AR");
  const [paymentSubTab, setPaymentSubTab] = useState("ALL");
  const [isLoading, setIsLoading] = useState(false);

  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getLastDayOfMonth());

  const [arData, setArData] = useState([]);
  const [apData, setApData] = useState([]);
  const [debtData, setDebtData] = useState([]);
  const [miscRecords, setMiscRecords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pendingChecks, setPendingChecks] = useState([]);

  const [customers, setCustomers] = useState([]);
  const [providers, setProviders] = useState([]);

  // 用於金流 Modal 內選取客戶時的近期銷貨單
  const [customerDeliveryNotes, setCustomerDeliveryNotes] = useState([]);
  const [selectedNotes, setSelectedNotes] = useState([]);

  const [isMiscModalOpen, setIsMiscModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingMisc, setEditingMisc] = useState(null);

  const initialMiscForm = {
    transaction_date: new Date().toISOString().split("T")[0],
    transaction_type: "EXPENSE",
    amount: "",
    category: "",
    note: "",
    is_active: true,
  };
  const [miscForm, setMiscForm] = useState(initialMiscForm);

  const initialPaymentForm = {
    payment_date: new Date().toISOString().split("T")[0],
    partner_type: "CUSTOMER",
    customer_id: "",
    provider_id: "",
    amount: "",
    payment_method: "TRANSFER",
    reference_notes: "",
    check_target_bank: "",
    check_title: "基香食品",
    check_cash_date: "",
  };
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);

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

  // ==========================================
  // API 呼叫區塊
  // ==========================================
  const fetchBaseData = async () => {
    try {
      const [cusRes, provRes] = await Promise.all([
        fetchWithAuth("/api/vendors"),
        fetchWithAuth("/api/material_providers"),
      ]);
      if (cusRes.ok) {
        const data = await cusRes.json();
        setCustomers(extractArrayData(data));
      }
      if (provRes.ok) {
        const data = await provRes.json();
        setProviders(extractArrayData(data));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const dateParams = `?start_date=${startDate}&end_date=${endDate}`;
      if (reportSubTab === "AR") {
        const res = await fetchWithAuth(
          `/api/accounting_report/ar_report${dateParams}`,
        );
        if (res.ok) {
          const data = await res.json();
          setArData(extractArrayData(data));
        }
      } else if (reportSubTab === "AP") {
        const res = await fetchWithAuth(
          `/api/accounting_report/ap_report${dateParams}`,
        );
        if (res.ok) {
          const data = await res.json();
          setApData(extractArrayData(data));
        }
      } else if (reportSubTab === "DEBT") {
        const res = await fetchWithAuth(
          `/api/accounting_report/accumulated_debt`,
        );
        if (res.ok) {
          const data = await res.json();
          setDebtData(extractArrayData(data));
        }
      }
    } catch (e) {
      showAlert("錯誤", "報表載入失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMisc = async () => {
    setIsLoading(true);
    try {
      const res = await fetchWithAuth(
        `/api/misc_trans_record/?start_date=${startDate}&end_date=${endDate}`,
      );
      if (res.ok) {
        const data = await res.json();
        setMiscRecords(extractArrayData(data));
      }
    } catch (e) {
      showAlert("錯誤", "雜支紀錄載入失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      if (paymentSubTab === "ALL") {
        const res = await fetchWithAuth(`/api/payment_record/`);
        if (res.ok) {
          const data = await res.json();
          setPayments(extractArrayData(data));
        }
      } else {
        const res = await fetchWithAuth(`/api/payment_record/pending_checks/`);
        if (res.ok) {
          const data = await res.json();
          setPendingChecks(extractArrayData(data));
        }
      }
    } catch (e) {
      showAlert("錯誤", "金流紀錄載入失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchDeliveryNotesForCustomer = async () => {
      if (paymentForm.partner_type === "CUSTOMER" && paymentForm.customer_id) {
        const targetCustomer = customers.find(
          (c) => String(c.id) === String(paymentForm.customer_id),
        );
        if (targetCustomer) {
          try {
            const res = await fetchWithAuth(
              `/api/delivery_notes/?customer_code=${targetCustomer.code}`,
            );
            if (res.ok) {
              const data = await res.json();
              setCustomerDeliveryNotes(extractArrayData(data));
            }
          } catch (e) {
            console.error("無法取得客戶銷貨單", e);
          }
        }
      } else {
        setCustomerDeliveryNotes([]);
        setSelectedNotes([]);
      }
    };
    fetchDeliveryNotesForCustomer();
  }, [paymentForm.customer_id, paymentForm.partner_type, customers]);

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    if (activeTab === "REPORTS") fetchReports();
    else if (activeTab === "MISC") fetchMisc();
    else if (activeTab === "PAYMENTS") fetchPayments();
  }, [activeTab, reportSubTab, paymentSubTab, startDate, endDate]);

  // ==========================================
  // 事件處理：雜支 (Misc)
  // ==========================================
  const handleSaveMisc = async (e) => {
    e.preventDefault();
    const payload = { ...miscForm };
    const url = editingMisc
      ? `/api/misc_trans_record/${editingMisc.id}/`
      : "/api/misc_trans_record/";
    const method = editingMisc ? "PUT" : "POST";

    try {
      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("儲存失敗");
      showAlert("成功", "雜支紀錄已儲存", "success");
      setIsMiscModalOpen(false);
      fetchMisc();
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    }
  };

  const handleDeleteMisc = (id) => {
    showConfirm("刪除確認", "確定要刪除這筆雜支紀錄嗎？", async () => {
      closeDialog();
      try {
        const res = await fetchWithAuth(`/api/misc_trans_record/${id}/`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("刪除失敗");
        showAlert("成功", "已成功刪除", "success");
        fetchMisc();
      } catch (err) {
        showAlert("錯誤", err.message, "error");
      }
    });
  };

  // ==========================================
  // 事件處理：金流 (Payments)
  // ==========================================
  const handleToggleNote = (note) => {
    let newSelected;
    if (selectedNotes.find((n) => n.id === note.id)) {
      newSelected = selectedNotes.filter((n) => n.id !== note.id);
    } else {
      newSelected = [...selectedNotes, note];
    }
    setSelectedNotes(newSelected);

    const totalAutoAmount = newSelected.reduce(
      (sum, n) => sum + (parseFloat(n.grand_total) || 0),
      0,
    );
    const noteNumbers = newSelected.map((n) => n.note_number).join(", ");

    setPaymentForm((prev) => ({
      ...prev,
      amount: totalAutoAmount > 0 ? totalAutoAmount : prev.amount,
      reference_notes: noteNumbers ? `沖銷單號: ${noteNumbers}` : "",
    }));
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    let check_info = {};
    if (paymentForm.payment_method === "CHECK") {
      check_info = {
        target_bank: paymentForm.check_target_bank,
        title: paymentForm.check_title,
        cash_date: paymentForm.check_cash_date,
        is_cleared: false,
      };
    }

    const payload = {
      payment_date: paymentForm.payment_date,
      partner_type: paymentForm.partner_type,
      customer:
        paymentForm.partner_type === "CUSTOMER"
          ? paymentForm.customer_id
          : null,
      provider:
        paymentForm.partner_type === "VENDOR" ? paymentForm.provider_id : null,
      amount: paymentForm.amount,
      payment_method: paymentForm.payment_method,
      reference_notes: paymentForm.reference_notes,
      check_info: Object.keys(check_info).length > 0 ? check_info : null,
    };

    try {
      const res = await fetchWithAuth("/api/payment_record/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("儲存金流失敗，請檢查客戶/廠商是否已選取");
      showAlert("成功", "金流紀錄已建立", "success");
      setIsPaymentModalOpen(false);
      setPaymentForm(initialPaymentForm);
      setSelectedNotes([]);
      fetchPayments();
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    }
  };

  const handleClearCheck = (id) => {
    showConfirm("兌現確認", "確定此支票已經於銀行兌現入帳了嗎？", async () => {
      closeDialog();
      try {
        const res = await fetchWithAuth(
          `/api/payment_record/${id}/clear_check/`,
          { method: "POST" },
        );
        if (!res.ok) throw new Error("兌現處理失敗");
        showAlert("成功", "支票已標記為兌現", "success");
        fetchPayments();
      } catch (err) {
        showAlert("錯誤", err.message, "error");
      }
    });
  };

  const handleDeletePayment = (id) => {
    showConfirm(
      "作廢確認",
      "確定要作廢這筆金流紀錄嗎？(這將會影響累積欠款計算)",
      async () => {
        closeDialog();
        try {
          const res = await fetchWithAuth(`/api/payment_record/${id}/`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("作廢失敗");
          showAlert("成功", "已成功作廢", "success");
          fetchPayments();
        } catch (err) {
          showAlert("錯誤", err.message, "error");
        }
      },
    );
  };

  const TabButton = ({ label, icon: Icon, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`px-6 py-3.5 rounded-2xl text-sm font-bold flex items-center gap-2.5 transition-all shadow-sm ${
        isActive
          ? "bg-white text-blue-600 border border-slate-200/80 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] scale-100"
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 scale-95 border border-transparent"
      }`}
    >
      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
      {label}
    </button>
  );

  const SubTabButton = ({ label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
        isActive
          ? "bg-slate-800 text-white shadow-md"
          : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );

  const DateFilter = () => (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-1 shadow-sm h-[44px]">
      <div className="flex items-center gap-2 pl-3">
        <CalendarDays size={16} className="text-slate-400" />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-transparent outline-none text-sm font-bold text-slate-700"
        />
      </div>
      <span className="text-slate-300 font-bold">-</span>
      <div className="flex items-center gap-2 pr-3">
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-transparent outline-none text-sm font-bold text-slate-700"
        />
      </div>
      <button
        onClick={() => {
          if (activeTab === "REPORTS") fetchReports();
          else if (activeTab === "MISC") fetchMisc();
        }}
        className="h-full px-4 bg-slate-100 text-slate-600 font-bold text-sm rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
      >
        查詢
      </button>
    </div>
  );

  // ==========================================
  // Render: 報表對帳單 (Reports)
  // ==========================================
  const renderReports = () => {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl border border-slate-200/50 w-fit">
            <SubTabButton
              label="應收貨款 (對帳單)"
              isActive={reportSubTab === "AR"}
              onClick={() => setReportSubTab("AR")}
            />
            <SubTabButton
              label="應付貨款 (廠商對帳)"
              isActive={reportSubTab === "AP"}
              onClick={() => setReportSubTab("AP")}
            />
            <SubTabButton
              label="客戶累積欠款"
              isActive={reportSubTab === "DEBT"}
              onClick={() => setReportSubTab("DEBT")}
            />
          </div>
          {reportSubTab !== "DEBT" && <DateFilter />}
        </div>

        <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[11px] uppercase tracking-widest text-slate-400 font-black">
                <th className="p-5 w-[25%]">
                  {reportSubTab === "AP" ? "廠商名稱" : "客戶名稱"}
                </th>
                {reportSubTab === "DEBT" ? (
                  <>
                    <th className="p-5 text-right">歷史總應收</th>
                    <th className="p-5 text-right">歷史總已收</th>
                    <th className="p-5 text-right text-red-500">累積欠額</th>
                  </>
                ) : (
                  <>
                    <th className="p-5 text-right">未稅金額</th>
                    <th className="p-5 text-right">稅額</th>
                    <th className="p-5 text-right text-blue-600">
                      區間含稅總額
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td
                    colSpan="4"
                    className="p-16 text-center text-slate-400 font-bold"
                  >
                    資料計算中...
                  </td>
                </tr>
              ) : reportSubTab === "AR" ? (
                arData.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="p-16 text-center text-slate-400 font-bold"
                    >
                      此區間無應收紀錄
                    </td>
                  </tr>
                ) : (
                  arData.map((row) => (
                    <tr
                      key={row.customer_code}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="p-5 font-black text-slate-800">
                        [{row.customer_code}] {row.customer_name}
                        <div className="text-[10px] text-slate-400 font-bold mt-1">
                          共 {row.delivery_notes?.length || 0} 筆銷貨單
                        </div>
                      </td>
                      <td className="p-5 text-right font-mono font-bold text-slate-500">
                        ${formatMoney(row.total_sales_amount)}
                      </td>
                      <td className="p-5 text-right font-mono font-bold text-slate-500">
                        ${formatMoney(row.total_tax_amount)}
                      </td>
                      <td className="p-5 text-right font-mono font-black text-blue-700 text-lg">
                        ${formatMoney(row.grand_total)}
                      </td>
                    </tr>
                  ))
                )
              ) : reportSubTab === "AP" ? (
                apData.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="p-16 text-center text-slate-400 font-bold"
                    >
                      此區間無應付紀錄
                    </td>
                  </tr>
                ) : (
                  apData.map((row) => (
                    <tr
                      key={row.provider_id}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="p-5 font-black text-slate-800">
                        {row.provider_name}
                        <div className="text-[10px] text-slate-400 font-bold mt-1">
                          共 {row.items?.length || 0} 筆入庫單
                        </div>
                      </td>
                      <td className="p-5 text-right font-mono font-bold text-slate-400">
                        -
                      </td>
                      <td className="p-5 text-right font-mono font-bold text-slate-400">
                        -
                      </td>
                      <td className="p-5 text-right font-mono font-black text-emerald-700 text-lg">
                        ${formatMoney(row.grand_total)}
                      </td>
                    </tr>
                  ))
                )
              ) : debtData.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="p-16 text-center text-slate-400 font-bold"
                  >
                    目前無客戶欠款
                  </td>
                </tr>
              ) : (
                debtData.map((row) => (
                  <tr
                    key={row.customer_id}
                    className="hover:bg-red-50/30 transition-colors"
                  >
                    <td className="p-5 font-black text-slate-800">
                      [{row.customer_code}] {row.customer_name}
                    </td>
                    <td className="p-5 text-right font-mono font-bold text-slate-500">
                      ${formatMoney(row.total_ar)}
                    </td>
                    <td className="p-5 text-right font-mono font-bold text-emerald-600">
                      ${formatMoney(row.total_paid)}
                    </td>
                    <td className="p-5 text-right font-mono font-black text-red-600 text-lg">
                      <span className="flex items-center justify-end gap-2">
                        {row.accumulated_debt > 0 && <AlertCircle size={16} />}$
                        {formatMoney(row.accumulated_debt)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ==========================================
  // Render: 雜支與零用金 (Misc)
  // ==========================================
  const renderMisc = () => {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <DateFilter />
          <button
            onClick={() => {
              setEditingMisc(null);
              setMiscForm(initialMiscForm);
              setIsMiscModalOpen(true);
            }}
            className="bg-[#007AFF] hover:bg-[#0056b3] text-white px-6 py-2.5 rounded-xl shadow-[0_2px_8px_rgba(0,122,255,0.3)] transition-all text-sm font-bold flex items-center gap-2 hover:-translate-y-0.5"
          >
            <Plus size={18} strokeWidth={2.5} /> 紀錄新收支
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[11px] uppercase tracking-widest text-slate-400 font-black">
                <th className="p-5">日期</th>
                <th className="p-5">類型</th>
                <th className="p-5">類別 (摘要)</th>
                <th className="p-5 text-right">金額</th>
                <th className="p-5">備註</th>
                <th className="p-5">登錄人</th>
                <th className="p-5 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="p-16 text-center text-slate-400 font-bold"
                  >
                    資料載入中...
                  </td>
                </tr>
              ) : miscRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="p-16 text-center text-slate-400 font-bold"
                  >
                    此區間無雜支紀錄
                  </td>
                </tr>
              ) : (
                miscRecords.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="p-4 font-mono font-bold text-slate-600">
                      {row.transaction_date}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-black border ${row.transaction_type === "INCOME" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}
                      >
                        {row.transaction_type === "INCOME"
                          ? "收入(入零用金)"
                          : "支出(各項費用)"}
                      </span>
                    </td>
                    <td className="p-4 font-black text-slate-800">
                      {row.category}
                    </td>
                    <td
                      className={`p-4 text-right font-mono font-black text-base ${row.transaction_type === "INCOME" ? "text-emerald-600" : "text-slate-700"}`}
                    >
                      {row.transaction_type === "EXPENSE" ? "-" : ""}$
                      {formatMoney(row.amount)}
                    </td>
                    <td
                      className="p-4 text-slate-500 font-medium max-w-xs truncate"
                      title={row.note}
                    >
                      {row.note || "-"}
                    </td>
                    <td className="p-4 text-slate-500 text-xs font-bold">
                      {row.creator_name}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex w-full justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingMisc(row);
                            setMiscForm({ ...row });
                            setIsMiscModalOpen(true);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteMisc(row.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
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
    );
  };

  // ==========================================
  // Render: 金流與票據 (Payments)
  // ==========================================
  const renderPayments = () => {
    const tableData = paymentSubTab === "ALL" ? payments : pendingChecks;

    return (
      <div className="animate-in fade-in slide-in-from-bottom-2">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl border border-slate-200/50 w-fit">
            <SubTabButton
              label="所有收付款明細"
              isActive={paymentSubTab === "ALL"}
              onClick={() => setPaymentSubTab("ALL")}
            />
            <SubTabButton
              label="待兌現支票匣"
              isActive={paymentSubTab === "PENDING_CHECKS"}
              onClick={() => setPaymentSubTab("PENDING_CHECKS")}
            />
          </div>
          <button
            onClick={() => {
              setPaymentForm(initialPaymentForm);
              setSelectedNotes([]);
              setIsPaymentModalOpen(true);
            }}
            className="bg-[#007AFF] hover:bg-[#0056b3] text-white px-6 py-2.5 rounded-xl shadow-[0_2px_8px_rgba(0,122,255,0.3)] transition-all text-sm font-bold flex items-center gap-2 hover:-translate-y-0.5"
          >
            <Wallet size={18} strokeWidth={2.5} /> 新增金流沖銷
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[11px] uppercase tracking-widest text-slate-400 font-black">
                <th className="p-5">日期</th>
                <th className="p-5">對象</th>
                <th className="p-5">方式</th>
                <th className="p-5 text-right">金額</th>
                <th className="p-5 w-[25%]">沖銷備註 / 支票細節</th>
                <th className="p-5 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="p-16 text-center text-slate-400 font-bold"
                  >
                    資料載入中...
                  </td>
                </tr>
              ) : tableData.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="p-16 text-center text-slate-400 font-bold"
                  >
                    查無紀錄
                  </td>
                </tr>
              ) : (
                tableData.map((row) => {
                  const isCheck = row.payment_method === "CHECK";
                  const chk = row.check_info || {};

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/50 transition-colors group ${isCheck && !chk.is_cleared && paymentSubTab === "ALL" ? "bg-amber-50/30" : ""}`}
                    >
                      <td className="p-4 font-mono font-bold text-slate-600">
                        {row.payment_date}
                      </td>
                      <td className="p-4 font-black text-slate-800">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded border mr-2 font-black ${row.partner_type === "CUSTOMER" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-purple-50 text-purple-600 border-purple-200"}`}
                        >
                          {row.partner_type === "CUSTOMER" ? "收" : "付"}
                        </span>
                        {row.partner_type === "CUSTOMER"
                          ? row.customer_name
                          : row.provider_name}
                      </td>
                      <td className="p-4">
                        <span className="text-[11px] font-bold text-slate-600 px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">
                          {row.payment_method === "CASH"
                            ? "現金"
                            : row.payment_method === "TRANSFER"
                              ? "匯款"
                              : "票據"}
                        </span>
                      </td>
                      <td
                        className={`p-4 text-right font-mono font-black text-base ${row.partner_type === "CUSTOMER" ? "text-blue-600" : "text-slate-700"}`}
                      >
                        ${formatMoney(row.amount)}
                      </td>
                      <td className="p-4">
                        <div className="text-xs font-bold text-slate-500 mb-1">
                          {row.reference_notes || "-"}
                        </div>
                        {isCheck && (
                          <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2 text-[10px] font-bold text-amber-800 font-mono mt-2">
                            銀行: {chk.target_bank} <br />
                            抬頭: {chk.title} <br />
                            兌現日: {chk.cash_date} <br />
                            狀態:{" "}
                            {chk.is_cleared ? (
                              <span className="text-emerald-600">
                                ✅ 已入帳
                              </span>
                            ) : (
                              <span className="text-red-500">⏳ 待兌現</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex w-full justify-center gap-2">
                          {isCheck && !chk.is_cleared && (
                            <button
                              onClick={() => handleClearCheck(row.id)}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-500 hover:text-white rounded-lg transition-all text-[11px] font-bold shadow-sm whitespace-nowrap"
                            >
                              確認兌現
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePayment(row.id)}
                            className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white rounded-lg transition-all text-[11px] font-bold shadow-sm whitespace-nowrap opacity-60 group-hover:opacity-100"
                          >
                            作廢
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto bg-slate-50 min-h-screen font-sans text-slate-800 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            財務與會計中心
          </h2>
        </div>
      </div>

      <div className="flex bg-slate-200/60 p-1.5 rounded-3xl mb-8 w-fit shadow-inner">
        <TabButton
          label="對帳與欠款"
          icon={FileText}
          isActive={activeTab === "REPORTS"}
          onClick={() => setActiveTab("REPORTS")}
        />
        <TabButton
          label="雜支與零用金"
          icon={Receipt}
          isActive={activeTab === "MISC"}
          onClick={() => setActiveTab("MISC")}
        />
        <TabButton
          label="金流與票據"
          icon={Landmark}
          isActive={activeTab === "PAYMENTS"}
          onClick={() => setActiveTab("PAYMENTS")}
        />
      </div>

      {activeTab === "REPORTS" && renderReports()}
      {activeTab === "MISC" && renderMisc()}
      {activeTab === "PAYMENTS" && renderPayments()}

      {/* 🌟 雜支 Modal (透過把 overflow 交給外層 Backdrop 來避免下拉選單被裁切) */}
      {isMiscModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto custom-scrollbar flex justify-center items-start p-4 pt-12 pb-20">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg h-fit animate-in fade-in zoom-in-95 duration-200 relative">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Receipt className="text-blue-500" />{" "}
                {editingMisc ? "編輯雜支紀錄" : "紀錄新收支"}
              </h3>
              <button
                onClick={() => setIsMiscModalOpen(false)}
                className="text-slate-400 hover:text-red-500 text-2xl transition-colors"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveMisc} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    收支類型 <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    options={[
                      { label: "支出 (如: 費用)", value: "EXPENSE" },
                      { label: "收入 (如: 入零用金)", value: "INCOME" },
                    ]}
                    value={miscForm.transaction_type}
                    onChange={(v) =>
                      setMiscForm({ ...miscForm, transaction_type: v })
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={miscForm.transaction_date}
                    onChange={(e) =>
                      setMiscForm({
                        ...miscForm,
                        transaction_date: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                  金額 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={miscForm.amount}
                    onChange={(e) =>
                      setMiscForm({ ...miscForm, amount: e.target.value })
                    }
                    className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl text-lg font-mono font-black text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                  類別摘要 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={miscForm.category}
                  onChange={(e) =>
                    setMiscForm({ ...miscForm, category: e.target.value })
                  }
                  placeholder="例如: 電話費、購買文具"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                  備註說明
                </label>
                <textarea
                  value={miscForm.note}
                  onChange={(e) =>
                    setMiscForm({ ...miscForm, note: e.target.value })
                  }
                  rows="3"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none"
                  placeholder="選填..."
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMiscModalOpen(false)}
                  className="px-6 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 text-sm font-bold rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 text-white bg-[#007AFF] hover:bg-[#0056b3] text-sm font-bold rounded-xl shadow-md transition-all"
                >
                  儲存紀錄
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 金流 Modal (透過把 overflow 交給外層 Backdrop 來避免下拉選單被裁切) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto custom-scrollbar flex justify-center items-start p-4 pt-12 pb-20">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl h-fit animate-in fade-in zoom-in-95 duration-200 relative">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Wallet className="text-blue-500" /> 建立金流沖銷紀錄
              </h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-red-500 text-2xl transition-colors"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSavePayment} className="p-6 md:p-8 space-y-6">
              <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 grid grid-cols-2 gap-5 relative z-10">
                <div>
                  <label className="block text-[11px] font-bold text-blue-700 mb-1.5 uppercase">
                    收付款方向 <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    options={[
                      { label: "向客戶收款 (應收沖銷)", value: "CUSTOMER" },
                      { label: "付給廠商 (應付沖銷)", value: "VENDOR" },
                    ]}
                    value={paymentForm.partner_type}
                    onChange={(v) =>
                      setPaymentForm({
                        ...paymentForm,
                        partner_type: v,
                        customer_id: "",
                        provider_id: "",
                      })
                    }
                    className="border-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-blue-700 mb-1.5 uppercase">
                    指定對象 <span className="text-red-500">*</span>
                  </label>
                  {paymentForm.partner_type === "CUSTOMER" ? (
                    <CustomSelect
                      options={customers.map((c) => ({
                        label: `[${c.code}] ${c.name}`,
                        value: c.id,
                      }))}
                      value={paymentForm.customer_id}
                      onChange={(v) =>
                        setPaymentForm({ ...paymentForm, customer_id: v })
                      }
                      placeholder="搜尋並選擇客戶"
                      className="border-blue-200"
                    />
                  ) : (
                    <CustomSelect
                      options={providers.map((p) => ({
                        label: `[${p.code}] ${p.name}`,
                        value: p.id,
                      }))}
                      value={paymentForm.provider_id}
                      onChange={(v) =>
                        setPaymentForm({ ...paymentForm, provider_id: v })
                      }
                      placeholder="搜尋並選擇廠商"
                      className="border-blue-200"
                    />
                  )}
                </div>
              </div>

              {/* 🌟 選取近期銷貨單 (自動加總) */}
              {paymentForm.partner_type === "CUSTOMER" &&
                paymentForm.customer_id &&
                customerDeliveryNotes.length > 0 && (
                  <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-[11px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-emerald-200/50 pb-2 mb-3">
                      <CheckCircle2 size={14} /> 選擇要沖銷的近期銷貨單
                      (可多選，自動加總)
                    </h4>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                      {customerDeliveryNotes.map((note) => {
                        const isSelected = selectedNotes.some(
                          (n) => n.id === note.id,
                        );
                        return (
                          <div
                            key={note.id}
                            onClick={() => handleToggleNote(note)}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${isSelected ? "bg-emerald-100 border-emerald-300" : "bg-white border-slate-200 hover:bg-slate-50"}`}
                          >
                            <div className="flex items-center gap-3">
                              {isSelected ? (
                                <CheckSquare
                                  size={18}
                                  className="text-emerald-600"
                                />
                              ) : (
                                <Square size={18} className="text-slate-300" />
                              )}
                              <div>
                                <div
                                  className={`text-sm font-bold ${isSelected ? "text-emerald-800" : "text-slate-700"}`}
                                >
                                  {note.note_number}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {note.note_date}
                                </div>
                              </div>
                            </div>
                            <div
                              className={`font-mono font-black ${isSelected ? "text-emerald-700" : "text-slate-600"}`}
                            >
                              ${formatMoney(note.grand_total)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              <div className="grid grid-cols-2 gap-5 relative z-0">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    交易日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentForm.payment_date}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_date: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    交易金額 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      $
                    </span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={paymentForm.amount}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          amount: e.target.value,
                        })
                      }
                      className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl text-lg font-mono font-black text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                <div className="relative z-[5]">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    付款方式 <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    options={[
                      { label: "銀行匯款", value: "TRANSFER" },
                      { label: "現金", value: "CASH" },
                      { label: "支票/票據", value: "CHECK" },
                    ]}
                    value={paymentForm.payment_method}
                    onChange={(v) =>
                      setPaymentForm({ ...paymentForm, payment_method: v })
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    沖銷備註 (單號)
                  </label>
                  <input
                    type="text"
                    value={paymentForm.reference_notes}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        reference_notes: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                    placeholder="對應單號..."
                  />
                </div>
              </div>

              {paymentForm.payment_method === "CHECK" && (
                <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 animate-in fade-in slide-in-from-top-2 space-y-4 relative z-0">
                  <h4 className="text-[11px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-amber-200/50 pb-2">
                    <CreditCard size={14} /> 支票詳細資訊
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-700 mb-1 uppercase">
                        目標銀行 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={paymentForm.check_target_bank}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            check_target_bank: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2.5 border border-amber-200 rounded-lg text-sm font-bold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                        placeholder="如: 玉山銀行"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-amber-700 mb-1 uppercase">
                        抬頭 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={paymentForm.check_title}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            check_title: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2.5 border border-amber-200 rounded-lg text-sm font-bold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-amber-700 mb-1 uppercase">
                        預計兌現日 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={paymentForm.check_cash_date}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            check_cash_date: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2.5 border border-amber-200 rounded-lg text-sm font-bold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-amber-600 pt-1 flex items-center gap-1.5">
                    <AlertCircle size={12} />{" "}
                    支票建立後預設為「未兌現」，請至「待兌現支票匣」核銷入帳。
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-6 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 text-sm font-bold rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 text-white bg-[#007AFF] hover:bg-[#0056b3] text-sm font-bold rounded-xl shadow-md transition-all"
                >
                  確認建立金流
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 共用 Dialog */}
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

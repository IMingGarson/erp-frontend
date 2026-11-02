import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Banknote,
  ArrowRightLeft,
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

  // 統一儲存未銷單據的 Pool
  const [unpaidNotesList, setUnpaidNotesList] = useState([]);

  const [isMiscModalOpen, setIsMiscModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingMisc, setEditingMisc] = useState(null);

  // 🌟 將展開列的 State 移到頂層
  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleRow = (id) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRows(newSet);
  };

  const initialMiscForm = {
    transaction_date: new Date().toISOString().split("T")[0],
    transaction_type: "EXPENSE",
    sub_category: "OTHER",
    amount: "",
    category: "",
    note: "",
    is_active: true,
  };
  const [miscForm, setMiscForm] = useState(initialMiscForm);

  // 🌟 三種金流區塊的 Initial State
  const initialBlockState = {
    amount: "",
    account_in: "",
    account_out: "",
    title_in: "",
    title_out: "",
    tax_id_in: "",
    tax_id_out: "",
    check_number: "",
    due_date: "",
    issuer_bank: "",
    note: "",
    selected_notes: [],
  };

  const initialPaymentGlobal = {
    payment_date: new Date().toISOString().split("T")[0],
    partner_type: "CUSTOMER",
    customer_id: "",
    provider_id: "",
  };

  const [paymentGlobal, setPaymentGlobal] = useState(initialPaymentGlobal);
  const [transferBlock, setTransferBlock] = useState(initialBlockState);
  const [cashBlock, setCashBlock] = useState(initialBlockState);
  const [checkBlock, setCheckBlock] = useState(initialBlockState);

  // 用於金流 Modal 內的 Tab 切換
  const [activePaymentMode, setActivePaymentMode] = useState("TRANSFER");

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
      if (cusRes.ok) setCustomers(extractArrayData(await cusRes.json()));
      if (provRes.ok) setProviders(extractArrayData(await provRes.json()));
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
        if (res.ok) setArData(extractArrayData(await res.json()));
      } else if (reportSubTab === "AP") {
        const res = await fetchWithAuth(
          `/api/accounting_report/ap_report${dateParams}`,
        );
        if (res.ok) setApData(extractArrayData(await res.json()));
      } else if (reportSubTab === "DEBT") {
        const res = await fetchWithAuth(
          `/api/accounting_report/accumulated_debt`,
        );
        if (res.ok) setDebtData(extractArrayData(await res.json()));
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
        `/api/misc_trans_record?start_date=${startDate}&end_date=${endDate}`,
      );
      if (res.ok) {
        const data = await res.json();
        setMiscRecords(data.data);
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
        const res = await fetchWithAuth(`/api/payment_record`);
        if (res.ok) setPayments(extractArrayData(await res.json()));
      } else {
        const res = await fetchWithAuth(`/api/payment_record/pending_checks`);
        if (res.ok) setPendingChecks(extractArrayData(await res.json()));
      }
    } catch (e) {
      showAlert("錯誤", "金流紀錄載入失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // 🌟 動態獲取該對象的未付清單據
  useEffect(() => {
    const fetchUnpaidNotes = async () => {
      setTransferBlock((prev) => ({ ...prev, selected_notes: [] }));
      setCashBlock((prev) => ({ ...prev, selected_notes: [] }));
      setCheckBlock((prev) => ({ ...prev, selected_notes: [] }));
      setUnpaidNotesList([]);

      if (
        paymentGlobal.partner_type === "CUSTOMER" &&
        paymentGlobal.customer_id
      ) {
        const targetCustomer = customers.find(
          (c) => String(c.id) === String(paymentGlobal.customer_id),
        );
        if (targetCustomer) {
          try {
            const res = await fetchWithAuth(
              `/api/delivery_notes?customer_code=${targetCustomer.code}&unpaid_only=true`,
            );
            if (res.ok) {
              const data = await res.json();
              const normalized = extractArrayData(data).map((d) => ({
                id: d.id,
                display_number: d.note_number,
                display_date: d.note_date,
                unpaid_amount: parseFloat(
                  d.unpaid_amount || d.grand_total || 0,
                ),
                grand_total: parseFloat(d.grand_total || 0),
                type: "DELIVERY_NOTE",
              }));
              setUnpaidNotesList(normalized);
            }
          } catch (e) {
            console.error("無法取得客戶銷貨單", e);
          }
        }
      } else if (
        paymentGlobal.partner_type === "VENDOR" &&
        paymentGlobal.provider_id
      ) {
        try {
          const res = await fetchWithAuth(
            `/api/purchase_requisitions?unpaid_only=true`,
          );
          if (res.ok) {
            const data = await res.json();
            const filtered = extractArrayData(data).filter(
              (pr) =>
                pr.items &&
                pr.items.some(
                  (i) =>
                    String(i.material_provider_id) ===
                    String(paymentGlobal.provider_id),
                ),
            );
            const normalized = filtered.map((d) => ({
              id: d.id,
              display_number: `PR#${d.id}`,
              display_date: d.request_date,
              unpaid_amount: parseFloat(d.unpaid_amount || d.grand_total || 0),
              grand_total: parseFloat(d.grand_total || 0),
              type: "PURCHASE_REQUISITION",
            }));
            setUnpaidNotesList(normalized);
          }
        } catch (e) {
          console.error("無法取得廠商進貨單", e);
        }
      }
    };
    fetchUnpaidNotes();
  }, [
    paymentGlobal.partner_type,
    paymentGlobal.customer_id,
    paymentGlobal.provider_id,
    customers,
  ]);

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
      ? `/api/misc_trans_record/${editingMisc.id}`
      : "/api/misc_trans_record";
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
        const res = await fetchWithAuth(`/api/misc_trans_record/${id}`, {
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
  // 🌟 核心：跨區塊水位分配計算 (Waterfall Allocation)
  // ==========================================
  const { globalAllocations, finalNotes } = useMemo(() => {
    const notesState = unpaidNotesList.map((n) => ({
      ...n,
      current_unpaid: n.unpaid_amount,
    }));

    const allocations = {
      TRANSFER: {},
      CASH: {},
      CHECK: {},
    };

    const blocks = [
      {
        name: "TRANSFER",
        amount: parseFloat(transferBlock.amount) || 0,
        selected: transferBlock.selected_notes,
      },
      {
        name: "CASH",
        amount: parseFloat(cashBlock.amount) || 0,
        selected: cashBlock.selected_notes,
      },
      {
        name: "CHECK",
        amount: parseFloat(checkBlock.amount) || 0,
        selected: checkBlock.selected_notes,
      },
    ];

    blocks.forEach((block) => {
      let remainingAmount = block.amount;
      block.selected.forEach((noteId) => {
        const note = notesState.find((n) => n.id === noteId);
        if (note && remainingAmount > 0 && note.current_unpaid > 0) {
          const alloc = Math.min(remainingAmount, note.current_unpaid);
          allocations[block.name][noteId] = alloc;
          remainingAmount -= alloc;
          note.current_unpaid -= alloc;
        } else {
          allocations[block.name][noteId] = 0;
        }
      });
    });

    return { globalAllocations: allocations, finalNotes: notesState };
  }, [unpaidNotesList, transferBlock, cashBlock, checkBlock]);

  // 切換單據勾選狀態 (解除 disabled 限制，完全依照金額控制)
  const handleToggleNoteForBlock = (blockName, noteId) => {
    if (blockName === "TRANSFER") {
      setTransferBlock((prev) => ({
        ...prev,
        selected_notes: prev.selected_notes.includes(noteId)
          ? prev.selected_notes.filter((id) => id !== noteId)
          : [...prev.selected_notes, noteId],
      }));
    } else if (blockName === "CASH") {
      setCashBlock((prev) => ({
        ...prev,
        selected_notes: prev.selected_notes.includes(noteId)
          ? prev.selected_notes.filter((id) => id !== noteId)
          : [...prev.selected_notes, noteId],
      }));
    } else if (blockName === "CHECK") {
      setCheckBlock((prev) => ({
        ...prev,
        selected_notes: prev.selected_notes.includes(noteId)
          ? prev.selected_notes.filter((id) => id !== noteId)
          : [...prev.selected_notes, noteId],
      }));
    }
  };

  const buildExtNote = (block, type) => {
    const parts = [];
    if (type === "TRANSFER") {
      if (block.account_out) parts.push(`轉出帳號:${block.account_out}`);
      if (block.tax_id_out) parts.push(`轉出統編:${block.tax_id_out}`);
      if (block.title_out) parts.push(`轉出抬頭:${block.title_out}`);
      if (block.tax_id_in) parts.push(`轉入統編:${block.tax_id_in}`);
      if (block.title_in) parts.push(`轉入抬頭:${block.title_in}`);
    } else if (type === "CASH") {
      if (block.tax_id_in) parts.push(`轉入統編:${block.tax_id_in}`);
      if (block.title_in) parts.push(`轉入抬頭:${block.title_in}`);
    }
    return parts.join(" | ");
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();

    const tAmt = parseFloat(transferBlock.amount) || 0;
    const cAmt = parseFloat(cashBlock.amount) || 0;
    const chkAmt = parseFloat(checkBlock.amount) || 0;
    const totalAmount = tAmt + cAmt + chkAmt;

    // 1. 驗證總金額
    if (totalAmount <= 0) {
      showAlert("提示", "請至少在其中一種付款方式中輸入金額", "warning");
      return;
    }

    // 2. 進行嚴格的必填驗證
    if (tAmt > 0) {
      if (
        !transferBlock.account_out ||
        !transferBlock.account_in ||
        !transferBlock.tax_id_out ||
        !transferBlock.tax_id_in ||
        !transferBlock.title_out ||
        !transferBlock.title_in
      ) {
        showAlert(
          "提示",
          "請完整填寫「銀行轉帳」區塊的所有必填欄位",
          "warning",
        );
        return;
      }
    }
    if (cAmt > 0) {
      if (
        !cashBlock.account_in ||
        !cashBlock.tax_id_in ||
        !cashBlock.title_in
      ) {
        showAlert("提示", "請完整填寫「現金」區塊的所有必填欄位", "warning");
        return;
      }
    }
    if (chkAmt > 0) {
      if (
        !checkBlock.check_number ||
        !checkBlock.due_date ||
        !checkBlock.issuer_bank ||
        !checkBlock.account_in
      ) {
        showAlert(
          "提示",
          "請完整填寫「支票/票據」區塊的所有必填欄位",
          "warning",
        );
        return;
      }
    }

    // 3. 封裝 API Payload
    const globalNotes = [];
    if (transferBlock.note) globalNotes.push(`[轉帳] ${transferBlock.note}`);
    if (cashBlock.note) globalNotes.push(`[現金] ${cashBlock.note}`);
    if (checkBlock.note) globalNotes.push(`[支票] ${checkBlock.note}`);

    const payload = {
      payment_date: paymentGlobal.payment_date,
      partner_type: paymentGlobal.partner_type,
      customer:
        paymentGlobal.partner_type === "CUSTOMER"
          ? paymentGlobal.customer_id
          : null,
      provider:
        paymentGlobal.partner_type === "VENDOR"
          ? paymentGlobal.provider_id
          : null,
      amount: totalAmount,
      payment_method: "MIXED",
      reference_notes: globalNotes.join(" | "),
      method_details: [],
      checks: [],
      write_offs: [],
    };

    if (tAmt > 0) {
      payload.method_details.push({
        payment_method: "TRANSFER",
        amount: tAmt,
        company_bank_account: transferBlock.account_in,
        note: buildExtNote(transferBlock, "TRANSFER"),
      });

      transferBlock.selected_notes.forEach((noteId) => {
        const allocated = globalAllocations["TRANSFER"][noteId];
        if (allocated > 0) {
          const writeOff = {
            payment_method: "TRANSFER",
            allocated_amount: allocated,
          };
          const noteData = unpaidNotesList.find((n) => n.id === noteId);
          if (noteData.type === "DELIVERY_NOTE")
            writeOff.delivery_note = noteId;
          if (noteData.type === "PURCHASE_REQUISITION")
            writeOff.purchase_requisition = noteId;
          payload.write_offs.push(writeOff);
        }
      });
    }

    if (cAmt > 0) {
      payload.method_details.push({
        payment_method: "CASH",
        amount: cAmt,
        company_bank_account: cashBlock.account_in,
        note: buildExtNote(cashBlock, "CASH"),
      });

      cashBlock.selected_notes.forEach((noteId) => {
        const allocated = globalAllocations["CASH"][noteId];
        if (allocated > 0) {
          const writeOff = {
            payment_method: "CASH",
            allocated_amount: allocated,
          };
          const noteData = unpaidNotesList.find((n) => n.id === noteId);
          if (noteData.type === "DELIVERY_NOTE")
            writeOff.delivery_note = noteId;
          if (noteData.type === "PURCHASE_REQUISITION")
            writeOff.purchase_requisition = noteId;
          payload.write_offs.push(writeOff);
        }
      });
    }

    if (chkAmt > 0) {
      payload.checks.push({
        check_number: checkBlock.check_number,
        due_date: checkBlock.due_date,
        amount: chkAmt,
        issuer_bank: checkBlock.issuer_bank,
        deposit_bank_account: checkBlock.account_in,
        title: checkBlock.title_in || checkBlock.title_out,
        note: checkBlock.note,
      });

      checkBlock.selected_notes.forEach((noteId) => {
        const allocated = globalAllocations["CHECK"][noteId];
        if (allocated > 0) {
          const writeOff = {
            payment_method: "CHECK",
            allocated_amount: allocated,
          };
          const noteData = unpaidNotesList.find((n) => n.id === noteId);
          if (noteData.type === "DELIVERY_NOTE")
            writeOff.delivery_note = noteId;
          if (noteData.type === "PURCHASE_REQUISITION")
            writeOff.purchase_requisition = noteId;
          payload.write_offs.push(writeOff);
        }
      });
    }

    try {
      const res = await fetchWithAuth("/api/payment_record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error("儲存金流失敗，請檢查輸入與單據分配是否正確");
      showAlert("成功", "金流紀錄已建立，並自動完成沖銷！", "success");
      setIsPaymentModalOpen(false);
      setPaymentGlobal(initialPaymentGlobal);
      setTransferBlock(initialBlockState);
      setCashBlock(initialBlockState);
      setCheckBlock(initialBlockState);
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
          `/api/payment_record/${id}/clear_check`,
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
      "確定要作廢這筆金流紀錄嗎？(單據沖銷金額將自動回滾並恢復欠款)",
      async () => {
        closeDialog();
        try {
          const res = await fetchWithAuth(`/api/payment_record/${id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("作廢失敗");
          showAlert("成功", "已成功作廢，金額已回滾", "success");
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
                <th className="p-5 text-center w-[120px]">日期</th>
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
                    <td className="p-4 align-middle text-center font-mono font-bold text-slate-600">
                      {row.transaction_date}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-black border ${row.transaction_type === "INCOME" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}
                      >
                        {row.transaction_type === "INCOME"
                          ? "收入(入零用金)"
                          : "應付費用"}
                      </span>
                    </td>
                    <td className="p-4 font-black text-slate-800">
                      <div className="flex items-center gap-2">
                        {row.category}
                        {row.sub_category && row.sub_category !== "OTHER" && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">
                            {row.sub_category}
                          </span>
                        )}
                      </div>
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
              setPaymentGlobal(initialPaymentGlobal);
              setTransferBlock(initialBlockState);
              setCashBlock(initialBlockState);
              setCheckBlock(initialBlockState);
              setActivePaymentMode("TRANSFER");
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
                <th className="p-5 text-center w-[120px]">日期</th>
                <th className="p-5">對象</th>
                <th className="p-5">方式</th>
                <th className="p-5 text-right">總金額</th>
                <th className="p-5 w-[25%]">沖銷備註 / 摘要</th>
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
                  const isCheck =
                    row.payment_method === "CHECK" ||
                    row.payment_method === "MIXED";
                  const checks =
                    row.checks && row.checks.length > 0 ? row.checks : [];
                  const chkLegacy = row.check_info || {};

                  // 只要有任何一張未兌現的支票，就視為未兌現
                  const hasUnclearedChecks =
                    checks.length > 0
                      ? checks.some((c) => !c.is_cleared)
                      : isCheck && !chkLegacy.is_cleared;

                  // 檢查是否可展開 (有 method_details 或 checks)
                  const isExpandable =
                    row.method_details?.length > 0 || checks.length > 0;
                  const isExpanded = expandedRows.has(row.id);

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className={`transition-colors group ${isCheck && hasUnclearedChecks && paymentSubTab === "ALL" ? "bg-amber-50/30" : ""} ${isExpandable ? "hover:bg-slate-50/80 cursor-pointer" : "hover:bg-slate-50/50"}`}
                        onClick={() => isExpandable && toggleRow(row.id)}
                      >
                        <td className="p-4 align-middle relative text-center">
                          {isExpandable && (
                            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                              <ChevronDown
                                size={16}
                                className={`text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </div>
                          )}
                          <span className="font-mono font-bold text-slate-600">
                            {row.payment_date}
                          </span>
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
                                : row.payment_method === "MIXED"
                                  ? "混合支付"
                                  : "票據"}
                          </span>
                        </td>
                        <td
                          className={`p-4 text-right font-mono font-black text-base ${row.partner_type === "CUSTOMER" ? "text-blue-600" : "text-slate-700"}`}
                        >
                          ${formatMoney(row.amount)}
                        </td>
                        <td className="p-4">
                          <div
                            className="text-xs font-bold text-slate-500 mb-1 line-clamp-2"
                            title={row.reference_notes}
                          >
                            {row.reference_notes || "-"}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex w-full justify-center gap-2">
                            {isCheck && hasUnclearedChecks && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // 阻止展開收合
                                  handleClearCheck(row.id);
                                }}
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-500 hover:text-white rounded-lg transition-all text-[11px] font-bold shadow-sm whitespace-nowrap"
                              >
                                確認兌現
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePayment(row.id);
                              }}
                              className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white rounded-lg transition-all text-[11px] font-bold shadow-sm whitespace-nowrap opacity-60 group-hover:opacity-100"
                            >
                              作廢
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* 展開的詳細資訊區塊 */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-200 shadow-inner">
                          <td colSpan={6} className="p-4 px-6 md:px-12">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {row.method_details?.length > 0 && (
                                <div className="space-y-3">
                                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1">
                                    支付方式細節
                                  </h4>
                                  {row.method_details.map((detail, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                                    >
                                      <div
                                        className={`absolute left-0 top-0 bottom-0 w-1 ${detail.payment_method === "TRANSFER" ? "bg-blue-500" : "bg-emerald-500"}`}
                                      ></div>
                                      <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`p-1.5 rounded-lg ${detail.payment_method === "TRANSFER" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}
                                          >
                                            {detail.payment_method ===
                                            "TRANSFER" ? (
                                              <ArrowRightLeft size={14} />
                                            ) : (
                                              <Banknote size={14} />
                                            )}
                                          </span>
                                          <span className="font-black text-slate-700 text-sm">
                                            {detail.payment_method ===
                                            "TRANSFER"
                                              ? "銀行轉帳"
                                              : "現金"}
                                          </span>
                                        </div>
                                        <span className="font-mono text-base font-black text-slate-800">
                                          ${formatMoney(detail.amount)}
                                        </span>
                                      </div>

                                      {detail.company_bank_account && (
                                        <div className="text-slate-500 text-xs font-medium bg-slate-50 p-2 rounded-lg mb-2 flex items-center gap-2">
                                          <Landmark
                                            size={12}
                                            className="text-slate-400"
                                          />
                                          <span>
                                            轉入帳戶:{" "}
                                            <span className="font-mono font-bold text-slate-600">
                                              {detail.company_bank_account}
                                            </span>
                                          </span>
                                        </div>
                                      )}

                                      {detail.note && (
                                        <div className="text-slate-500 text-xs mt-2 pt-2 border-t border-slate-100 flex items-start gap-2">
                                          <FileText
                                            size={12}
                                            className="text-slate-400 mt-0.5 shrink-0"
                                          />
                                          <span className="leading-relaxed">
                                            {detail.note}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {checks.length > 0 && (
                                <div className="space-y-3">
                                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1">
                                    支票細節
                                  </h4>
                                  {checks.map((chk, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                                    >
                                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>
                                      <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                          <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                                            <CreditCard size={14} />
                                          </span>
                                          <span className="font-black text-slate-700 text-sm">
                                            票號:{" "}
                                            <span className="font-mono text-amber-700">
                                              {chk.check_number || "未指定"}
                                            </span>
                                          </span>
                                        </div>
                                        <span className="font-mono text-base font-black text-slate-800">
                                          ${formatMoney(chk.amount)}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 mb-2">
                                        <div className="text-slate-500 text-xs font-medium bg-slate-50 p-2 rounded-lg">
                                          <div className="text-slate-400 mb-0.5">
                                            銀行
                                          </div>
                                          <div className="font-bold text-slate-600 truncate">
                                            {chk.issuer_bank || "未指定"}
                                          </div>
                                        </div>
                                        <div className="text-slate-500 text-xs font-medium bg-slate-50 p-2 rounded-lg">
                                          <div className="text-slate-400 mb-0.5">
                                            到期日
                                          </div>
                                          <div className="font-bold font-mono text-slate-600">
                                            {chk.due_date}
                                          </div>
                                        </div>
                                        {chk.title && (
                                          <div className="col-span-2 text-slate-500 text-xs font-medium bg-slate-50 p-2 rounded-lg flex items-center gap-2">
                                            <span className="text-slate-400 shrink-0">
                                              抬頭:
                                            </span>
                                            <span className="font-bold text-slate-600 truncate">
                                              {chk.title}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                                        <div className="flex items-center gap-1.5 text-xs font-bold">
                                          {chk.is_cleared ? (
                                            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-600">
                                              <CheckCircle2 size={12} /> 已入帳
                                            </span>
                                          ) : (
                                            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-600">
                                              <AlertCircle size={12} /> 待兌現
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {chk.note && (
                                        <div className="text-slate-500 text-xs mt-2 pt-2 border-t border-slate-100 flex items-start gap-2">
                                          <FileText
                                            size={12}
                                            className="text-slate-400 mt-0.5 shrink-0"
                                          />
                                          <span className="leading-relaxed">
                                            {chk.note}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ==========================================
  // 🌟 共用的 Notes Pool 渲染組件
  // ==========================================
  const renderNotesPool = (blockName, blockState) => {
    if (paymentGlobal.partner_type === "CUSTOMER" && !paymentGlobal.customer_id)
      return null;
    if (paymentGlobal.partner_type === "VENDOR" && !paymentGlobal.provider_id)
      return null;

    if (unpaidNotesList.length === 0) {
      return (
        <div className="mt-4 p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 font-bold text-sm mx-6">
          查無任何未結清的單據
        </div>
      );
    }

    const noteTypeLabel =
      paymentGlobal.partner_type === "CUSTOMER" ? "銷貨單" : "進貨單";
    const totalCheckedUnpaid = blockState.selected_notes.reduce((sum, id) => {
      const note = unpaidNotesList.find((n) => n.id === id);
      return sum + (note ? note.unpaid_amount : 0);
    }, 0);

    return (
      <div className="mt-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200 mx-6">
        <div className="flex justify-between items-center mb-3 border-b border-slate-200/60 pb-2">
          <h4 className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-blue-500" /> 選擇要沖銷的
            {noteTypeLabel} (金額由上往下依序扣抵)
          </h4>
          {blockState.selected_notes.length > 0 && (
            <span className="text-[10px] font-bold text-slate-500 bg-slate-200/50 px-2 py-1 rounded">
              已選欠款總計: ${formatMoney(totalCheckedUnpaid)}
            </span>
          )}
        </div>

        <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-1">
          {unpaidNotesList.map((note) => {
            const isSelectedHere = blockState.selected_notes.includes(note.id);
            const allocInfo = globalAllocations[blockName]?.[note.id] || 0;
            const finalRemainAmount =
              finalNotes.find((n) => n.id === note.id)?.current_unpaid || 0;

            // 判斷是否已被其他區塊扣光且當前區塊未選 -> disabled
            const isExhaustedElsewhere =
              !isSelectedHere && finalRemainAmount <= 0;

            return (
              <div
                key={note.id}
                onClick={() =>
                  !isExhaustedElsewhere &&
                  handleToggleNoteForBlock(blockName, note.id)
                }
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  isExhaustedElsewhere
                    ? "bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed"
                    : isSelectedHere
                      ? "bg-blue-50 border-blue-300 cursor-pointer"
                      : "bg-white border-slate-200 hover:bg-blue-50/50 cursor-pointer shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isSelectedHere ? (
                    <CheckSquare
                      size={18}
                      className="text-blue-600 flex-shrink-0"
                    />
                  ) : (
                    <Square
                      size={18}
                      className={`flex-shrink-0 ${isExhaustedElsewhere ? "text-slate-200" : "text-slate-300"}`}
                    />
                  )}
                  <div>
                    <div
                      className={`text-sm font-bold ${isSelectedHere ? "text-blue-800" : "text-slate-700"}`}
                    >
                      {note.display_number}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isExhaustedElsewhere
                        ? "已由其他付款方式扣抵完畢"
                        : note.display_date}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-mono font-black ${isSelectedHere ? "text-blue-700" : "text-slate-600"}`}
                  >
                    未結清: ${formatMoney(note.unpaid_amount)}
                  </div>
                  <div
                    className={`text-[10px] font-bold mt-0.5 ${allocInfo > 0 ? "text-emerald-600" : "text-slate-400"}`}
                  >
                    已銷: ${formatMoney(allocInfo)} <br />
                    需付: $
                    {formatMoney(
                      isSelectedHere ? finalRemainAmount : note.unpaid_amount,
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* 🌟 雜支 Modal */}
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
              <div className="grid grid-cols-2 gap-4 relative z-20">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    收支大項 <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    options={[
                      { label: "應付費用", value: "EXPENSE" },
                      { label: "應收費用", value: "INCOME" },
                    ]}
                    value={miscForm.transaction_type}
                    onChange={(v) =>
                      setMiscForm({ ...miscForm, transaction_type: v })
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    次項分類 <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    options={[
                      { label: "修繕", value: "FIX" },
                      { label: "水電", value: "FACILITY" },
                      { label: "人事", value: "LABOR" },
                      { label: "佣金", value: "COMMISSION" },
                      { label: "設備", value: "EQUIPPMENT" },
                      { label: "其他", value: "OTHER" },
                    ]}
                    value={miscForm.sub_category}
                    onChange={(v) =>
                      setMiscForm({ ...miscForm, sub_category: v })
                    }
                  />
                </div>
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

      {/* 🌟 金流 Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto custom-scrollbar flex justify-center items-start p-4 pt-12 pb-20">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-fit animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
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

            <form
              onSubmit={handleSavePayment}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 pb-0 shrink-0">
                {/* 1. Global 上半部資訊 */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-5 relative z-20">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                      交易日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentGlobal.payment_date}
                      onChange={(e) =>
                        setPaymentGlobal({
                          ...paymentGlobal,
                          payment_date: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                      方向 <span className="text-red-500">*</span>
                    </label>
                    <CustomSelect
                      options={[
                        { label: "向客戶收款 (應收)", value: "CUSTOMER" },
                        { label: "付給廠商 (應付)", value: "VENDOR" },
                      ]}
                      value={paymentGlobal.partner_type}
                      onChange={(v) =>
                        setPaymentGlobal({
                          ...paymentGlobal,
                          partner_type: v,
                          customer_id: "",
                          provider_id: "",
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                      指定對象 <span className="text-red-500">*</span>
                    </label>
                    {paymentGlobal.partner_type === "CUSTOMER" ? (
                      <CustomSelect
                        options={customers.map((c) => ({
                          label: `[${c.code}] ${c.name}`,
                          value: c.id,
                        }))}
                        value={paymentGlobal.customer_id}
                        onChange={(v) =>
                          setPaymentGlobal({ ...paymentGlobal, customer_id: v })
                        }
                        placeholder="選擇客戶"
                      />
                    ) : (
                      <CustomSelect
                        options={providers.map((p) => ({
                          label: `[${p.code}] ${p.name}`,
                          value: p.id,
                        }))}
                        value={paymentGlobal.provider_id}
                        onChange={(v) =>
                          setPaymentGlobal({ ...paymentGlobal, provider_id: v })
                        }
                        placeholder="選擇廠商"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* 🌟 單據 Pool 拉到 Global 區塊下方、Tabs 上方 */}
              {renderNotesPool(
                activePaymentMode,
                activePaymentMode === "TRANSFER"
                  ? transferBlock
                  : activePaymentMode === "CASH"
                    ? cashBlock
                    : checkBlock,
              )}

              {/* 2. 切換 Tab UI */}
              <div className="px-6 shrink-0 mt-4">
                <div className="flex gap-4 border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActivePaymentMode("TRANSFER")}
                    className={`pb-3 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activePaymentMode === "TRANSFER" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                  >
                    <ArrowRightLeft size={16} /> 銀行轉帳
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePaymentMode("CASH")}
                    className={`pb-3 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activePaymentMode === "CASH" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                  >
                    <Banknote size={16} /> 現金
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePaymentMode("CHECK")}
                    className={`pb-3 px-1 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activePaymentMode === "CHECK" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                  >
                    <CreditCard size={16} /> 支票/票據
                  </button>
                </div>
              </div>

              {/* 3. Tab Content 區塊 */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-4">
                {/* ===================== TRANSFER ===================== */}
                {activePaymentMode === "TRANSFER" && (
                  <div className="animate-in fade-in space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                          轉帳金額
                        </label>
                        <div className="relative max-w-sm">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                            $
                          </span>
                          <input
                            type="number"
                            placeholder="0"
                            value={transferBlock.amount}
                            onChange={(e) =>
                              setTransferBlock({
                                ...transferBlock,
                                amount: e.target.value,
                              })
                            }
                            className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl text-lg font-mono font-black outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          轉出帳號 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={transferBlock.account_out}
                          onChange={(e) =>
                            setTransferBlock({
                              ...transferBlock,
                              account_out: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          轉入帳號 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={transferBlock.account_in}
                          onChange={(e) =>
                            setTransferBlock({
                              ...transferBlock,
                              account_in: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          轉出統編 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={transferBlock.tax_id_out}
                          onChange={(e) =>
                            setTransferBlock({
                              ...transferBlock,
                              tax_id_out: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          轉入統編 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={transferBlock.tax_id_in}
                          onChange={(e) =>
                            setTransferBlock({
                              ...transferBlock,
                              tax_id_in: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          轉出抬頭 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={transferBlock.title_out}
                          onChange={(e) =>
                            setTransferBlock({
                              ...transferBlock,
                              title_out: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          轉入抬頭 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={transferBlock.title_in}
                          onChange={(e) =>
                            setTransferBlock({
                              ...transferBlock,
                              title_in: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          本筆備註
                        </label>
                        <input
                          type="text"
                          value={transferBlock.note}
                          onChange={(e) =>
                            setTransferBlock({
                              ...transferBlock,
                              note: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                          placeholder="選填..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ===================== CASH ===================== */}
                {activePaymentMode === "CASH" && (
                  <div className="animate-in fade-in space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                          現金金額
                        </label>
                        <div className="relative max-w-sm">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                            $
                          </span>
                          <input
                            type="number"
                            placeholder="0"
                            value={cashBlock.amount}
                            onChange={(e) =>
                              setCashBlock({
                                ...cashBlock,
                                amount: e.target.value,
                              })
                            }
                            className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl text-lg font-mono font-black outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          轉入帳號 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={cashBlock.account_in}
                          onChange={(e) =>
                            setCashBlock({
                              ...cashBlock,
                              account_in: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          轉入統編 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={cashBlock.tax_id_in}
                          onChange={(e) =>
                            setCashBlock({
                              ...cashBlock,
                              tax_id_in: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          轉入抬頭 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={cashBlock.title_in}
                          onChange={(e) =>
                            setCashBlock({
                              ...cashBlock,
                              title_in: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          本筆備註
                        </label>
                        <input
                          type="text"
                          value={cashBlock.note}
                          onChange={(e) =>
                            setCashBlock({ ...cashBlock, note: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                          placeholder="選填..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ===================== CHECK ===================== */}
                {activePaymentMode === "CHECK" && (
                  <div className="animate-in fade-in space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                          支票金額
                        </label>
                        <div className="relative max-w-sm">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                            $
                          </span>
                          <input
                            type="number"
                            placeholder="0"
                            value={checkBlock.amount}
                            onChange={(e) =>
                              setCheckBlock({
                                ...checkBlock,
                                amount: e.target.value,
                              })
                            }
                            className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl text-lg font-mono font-black outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          票號 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={checkBlock.check_number}
                          onChange={(e) =>
                            setCheckBlock({
                              ...checkBlock,
                              check_number: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          到期日 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={checkBlock.due_date}
                          onChange={(e) =>
                            setCheckBlock({
                              ...checkBlock,
                              due_date: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          開票人的銀行 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="如: 玉山銀行"
                          value={checkBlock.issuer_bank}
                          onChange={(e) =>
                            setCheckBlock({
                              ...checkBlock,
                              issuer_bank: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          存入的銀行帳號 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={checkBlock.account_in}
                          onChange={(e) =>
                            setCheckBlock({
                              ...checkBlock,
                              account_in: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          本筆備註
                        </label>
                        <input
                          type="text"
                          value={checkBlock.note}
                          onChange={(e) =>
                            setCheckBlock({
                              ...checkBlock,
                              note: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:border-blue-500 outline-none"
                          placeholder="選填..."
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Bottom Footer (Summary & Submit) */}
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0 rounded-b-3xl">
                <div className="text-slate-500 text-sm font-bold">
                  本次預計沖銷總額:
                  <span className="text-xl text-blue-600 font-mono ml-2">
                    $
                    {formatMoney(
                      (parseFloat(transferBlock.amount) || 0) +
                        (parseFloat(cashBlock.amount) || 0) +
                        (parseFloat(checkBlock.amount) || 0),
                    )}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 block mt-1">
                    (轉帳: ${formatMoney(parseFloat(transferBlock.amount) || 0)}{" "}
                    | 現金: ${formatMoney(parseFloat(cashBlock.amount) || 0)} |
                    支票: ${formatMoney(parseFloat(checkBlock.amount) || 0)})
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="px-6 py-3 text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 text-sm font-bold rounded-xl transition-colors"
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

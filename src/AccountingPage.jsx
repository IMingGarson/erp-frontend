import React, { useState, useEffect, useRef, useMemo } from "react";
import {
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
  Printer,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";

// ==========================================
// 輔助函數
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

const formatLocalDate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getFirstDayOfPrevMonth = () => {
  const d = new Date();
  return formatLocalDate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
};

const getFifthDayOfCurrentMonth = () => {
  const d = new Date();
  return formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 5));
};

const extractArrayData = (json) => {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.data)) return json.data;
  if (json && Array.isArray(json.results)) return json.results;
  return [];
};

const STATUS_BADGE_MAP = {
  UNPAID: {
    label: "未付款",
    className: "bg-rose-50 text-rose-600 border-rose-200",
  },
  PARTIAL: {
    label: "仍欠款",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  PAID: {
    label: "已付款",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

// ==========================================
// 客製化下拉選單 (共用元件)
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
        className={`w-full flex justify-between items-center px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold transition-all shadow-sm ${
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
          className={`absolute z-[100] top-[calc(100%+6px)] left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150 custom-scrollbar ${menuClassName}`}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`px-4 py-2.5 text-sm font-bold cursor-pointer transition-colors ${
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
// 🌟 正式列印：單一客戶收款對帳單明細表 (對應截圖 1)
// ==========================================
const SingleCustomerStatementPrintTemplate = ({
  customerRow,
  startDate,
  endDate,
  debtMap,
}) => {
  if (!customerRow) return null;
  const todayStr = new Date()
    .toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "/");

  const notes = customerRow.delivery_notes || [];
  const totalSales = customerRow.grand_total || 0;
  const totalPaid = customerRow.total_paid_amount || 0;
  const unpaid = customerRow.total_unpaid_amount || 0;
  const priorDebt = debtMap[customerRow.customer_code] || 0;
  const grandTotalUnpaid = priorDebt + unpaid;

  return (
    <div className="hidden print:block w-full bg-white text-black font-serif">
      <style>{`
          @media print {
            .page-break { page-break-before: always; }
            @page { size: A4 portrait; margin: 0; }
          }
        `}</style>

      <div className="text-right text-xs mb-1 font-serif">第 1 頁</div>
      <div className="text-center mb-4">
        <h1 className="text-2xl font-black tracking-widest">
          基香食品有限公司
        </h1>
        <h2 className="text-xl font-bold tracking-widest mt-1">
          收款對帳單明細表
        </h2>
      </div>

      <div className="flex justify-between text-xs mb-3 border-b-2 border-black pb-2 leading-relaxed">
        <div className="space-y-0.5">
          <div>
            對象編號：{customerRow.customer_code} {customerRow.customer_name}
          </div>
          <div>統一編號：{customerRow.customer_tax_id}</div>
          <div>電 話：{customerRow.customer_phone}</div>
          <div>
            公司地址：
            {customerRow.customer_address}
          </div>
          <div>
            結帳日期：{startDate.replace(/-/g, "/")} 到{" "}
            {endDate.replace(/-/g, "/")}
          </div>
          <div>製表日期：{todayStr}</div>
        </div>
        <div className="space-y-0.5 text-right">
          <div>傳真：(02)8786-9139</div>
        </div>
      </div>

      <table className="w-full text-xs border-collapse border border-black mb-4">
        <thead>
          <tr className="border-b border-black text-center font-bold">
            <th className="border border-black py-1.5 px-2">單據日期</th>
            <th className="border border-black py-1.5 px-2">單據編號</th>
            <th className="border border-black py-1.5 px-2 text-left">
              貨品名稱
            </th>
            <th className="border border-black py-1.5 px-2">規格</th>
            <th className="border border-black py-1.5 px-2 text-right">單價</th>
            <th className="border border-black py-1.5 px-2 text-right">KG</th>
            <th className="border border-black py-1.5 px-2 text-right">小計</th>
            <th className="border border-black py-1.5 px-2 text-right">
              總計金額
            </th>
          </tr>
        </thead>
        <tbody>
          {notes.map((dn, idx) => (
            <tr key={idx} className="border-b border-black h-7">
              <td className="border border-black text-center font-mono">
                {dn.note_date}
              </td>
              <td className="border border-black text-center font-mono">
                {dn.note_number}
              </td>
              <td className="border border-black text-left px-2 font-bold">
                {dn.product_name}
              </td>
              <td className="border border-black text-center">
                {dn.spec || "-"}
              </td>
              <td className="border border-black text-right font-mono px-2">
                {formatMoney(dn.sales_price || 0)}
              </td>
              <td className="border border-black text-right font-mono px-2">
                {formatMoney(dn.quantity)}
              </td>
              <td className="border border-black text-right font-mono px-2">
                {formatMoney(dn.grand_total)}
              </td>
              <td className="border border-black text-right font-mono px-2 font-bold">
                {formatMoney(dn.grand_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 底部結算彙總 (符合截圖格式的三組 stack layout) */}
      <div className="border-2 border-black p-3 text-xs space-y-1.5 font-bold">
        <div className="grid grid-cols-3 gap-4">
          <div>
            合計金額：
            <span className="font-mono text-sm">{formatMoney(totalSales)}</span>
          </div>
          <div>
            折讓金額：<span className="font-mono text-sm">0</span>
          </div>
          <div>
            可沖銷金額：<span className="font-mono text-sm">0</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 border-t border-black pt-1.5">
          <div>
            營業稅：
            <span className="font-mono text-sm">
              {formatMoney(totalSales * 0.05)}
            </span>
          </div>
          <div>
            已收金額：
            <span className="font-mono text-sm">{formatMoney(totalPaid)}</span>
          </div>
          <div>
            前期欠款：
            <span className="font-mono text-sm">{formatMoney(priorDebt)}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 font-black text-sm border-t-2 border-black pt-1.5">
          <div>
            總計金額：
            <span className="font-mono">{formatMoney(totalSales * 1.05)}</span>
          </div>
          <div>
            本期未清金額：
            <span className="font-mono">{formatMoney(unpaid)}</span>
          </div>
          <div>
            總未清金額：
            <span className="font-mono text-base">
              {formatMoney(grandTotalUnpaid)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 🌟 正式列印：應收帳款統計表全表 (對應截圖 2)
// ==========================================
const AllCustomersSummaryPrintTemplate = ({
  arData,
  startDate,
  endDate,
  debtMap,
}) => {
  const todayStr = new Date()
    .toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "/");

  return (
    <div className="hidden print:block w-full bg-white text-black font-serif p-6 mx-auto">
      <style>{`
          @media print {
            .page-break { page-break-before: always; }
            @page { size: A4 portrait; margin: 0; }
          }
        `}</style>

      <div className="text-right text-xs mb-1 font-serif">第 1 頁</div>
      <div className="text-center mb-4">
        <h1 className="text-2xl font-black tracking-widest">
          基香食品有限公司
        </h1>
        <h2 className="text-xl font-bold tracking-widest mt-1">
          應收帳款統計表
        </h2>
      </div>

      {/* 結帳日期與製表日期垂直堆疊 (stack) */}
      <div className="text-xs mb-3 border-b-2 border-black pb-2 space-y-0.5 font-bold">
        <div>
          結帳日期：{startDate.replace(/-/g, "/")} 到{" "}
          {endDate.replace(/-/g, "/")}
        </div>
        <div>製表日期：{todayStr}</div>
      </div>

      <table className="w-full text-xs border-collapse border border-black mb-4 text-center">
        <thead>
          <tr className="border-b border-black font-bold">
            <th className="border border-black py-1.5 px-2">客戶編號</th>
            <th className="border border-black py-1.5 px-2 text-left">
              客戶名稱
            </th>
            <th className="border border-black py-1.5 px-2 text-right">
              營業稅
            </th>
            <th className="border border-black py-1.5 px-2 text-right">
              合計金額
            </th>
            <th className="border border-black py-1.5 px-2 text-right">
              總計金額
            </th>
            <th className="border border-black py-1.5 px-2 text-right">
              折讓金額
            </th>
            <th className="border border-black py-1.5 px-2 text-right">
              已收金額
            </th>
            <th className="border border-black py-1.5 px-2 text-right">
              前期未收款
            </th>
            <th className="border border-black py-1.5 px-2 text-right">
              總未清金額
            </th>
          </tr>
        </thead>
        <tbody>
          {arData.map((row, idx) => {
            const prior = debtMap[row.customer_code] || 0;
            return (
              <tr key={idx} className="border-b border-black h-7">
                <td className="border border-black font-mono">
                  {row.customer_code}
                </td>
                <td className="border border-black text-left px-2 font-bold">
                  {row.customer_name}
                </td>
                <td className="border border-black text-right font-mono px-2">
                  {formatMoney(row.total_tax_amount)}
                </td>
                <td className="border border-black text-right font-mono px-2">
                  {formatMoney(row.total_sales_amount)}
                </td>
                <td className="border border-black text-right font-mono px-2 font-bold">
                  {formatMoney(row.grand_total)}
                </td>
                <td className="border border-black text-right font-mono px-2">
                  0
                </td>
                <td className="border border-black text-right font-mono px-2">
                  {formatMoney(row.total_paid_amount)}
                </td>
                <td className="border border-black text-right font-mono px-2">
                  {formatMoney(prior)}
                </td>
                <td className="border border-black text-right font-mono px-2 font-bold">
                  {formatMoney(prior + row.total_unpaid_amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ==========================================
// Main Page Component
// ==========================================
export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState("REPORTS");
  const [reportSubTab, setReportSubTab] = useState("AR");
  const [paymentSubTab, setPaymentSubTab] = useState("ALL");
  const [isLoading, setIsLoading] = useState(false);

  const [startDate, setStartDate] = useState(getFirstDayOfPrevMonth());
  const [endDate, setEndDate] = useState(getFifthDayOfCurrentMonth());

  const [arCustomerCode, setArCustomerCode] = useState("");
  const [arStatusFilter, setArStatusFilter] = useState("");
  const [expandedArCustomers, setExpandedArCustomers] = useState(new Set());

  const [printCustomerData, setPrintCustomerData] = useState(null);
  const [isPrintAllSummary, setIsPrintAllSummary] = useState(false);

  const [arData, setArData] = useState([]);
  const [apData, setApData] = useState([]);
  const [debtData, setDebtData] = useState([]);
  const [miscRecords, setMiscRecords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pendingChecks, setPendingChecks] = useState([]);

  const [customers, setCustomers] = useState([]);
  const [providers, setProviders] = useState([]);

  const [unpaidNotesList, setUnpaidNotesList] = useState([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);

  const [isMiscModalOpen, setIsMiscModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingMisc, setEditingMisc] = useState(null);

  const [clearCheckModal, setClearCheckModal] = useState({
    isOpen: false,
    recordId: null,
    checkId: null,
    clearedDate: new Date().toISOString().split("T")[0],
  });

  const [expandedPaymentRows, setExpandedPaymentRows] = useState(new Set());

  const togglePaymentRow = (id) => {
    const next = new Set(expandedPaymentRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedPaymentRows(next);
  };

  const toggleArCustomerRow = (code) => {
    const next = new Set(expandedArCustomers);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setExpandedArCustomers(next);
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

  const initialPaymentGlobal = {
    payment_date: new Date().toISOString().split("T")[0],
    partner_type: "CUSTOMER",
    customer_id: "",
    provider_id: "",
    reference_notes: "",
  };
  const initialCheckData = {
    amount: "",
    check_number: "",
    due_date: "",
    received_date: new Date().toISOString().split("T")[0],
    cleared_date: "",
    issuer_bank: "",
    note: "",
  };

  const [paymentGlobal, setPaymentGlobal] = useState(initialPaymentGlobal);
  const [transferAmount, setTransferAmount] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [checkData, setCheckData] = useState(initialCheckData);

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
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });

      if (reportSubTab === "AR") {
        if (arCustomerCode) params.append("customer_code", arCustomerCode);
        if (arStatusFilter) params.append("payment_status", arStatusFilter);

        const [arRes, debtRes] = await Promise.all([
          fetchWithAuth(
            `/api/accounting_report/ar_report?${params.toString()}`,
          ),
          fetchWithAuth(`/api/accounting_report/accumulated_debt`),
        ]);

        if (arRes.ok) {
          const data = extractArrayData(await arRes.json());
          setArData(data);
          if (arCustomerCode || data.length === 1) {
            setExpandedArCustomers(new Set(data.map((d) => d.customer_code)));
          }
        }
        if (debtRes.ok) {
          setDebtData(extractArrayData(await debtRes.json()));
        }
      } else if (reportSubTab === "AP") {
        const res = await fetchWithAuth(
          `/api/accounting_report/ap_report?${params.toString()}`,
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

  const customerDebtMap = useMemo(() => {
    const map = {};
    debtData.forEach((d) => {
      map[d.customer_code] = d.accumulated_debt || 0;
    });
    return map;
  }, [debtData]);

  useEffect(() => {
    const fetchUnpaidNotes = async () => {
      setSelectedNoteIds([]);
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
                paid_amount: parseFloat(d.paid_amount || 0),
                unpaid_amount: parseFloat(
                  d.unpaid_amount ?? d.grand_total ?? 0,
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
              paid_amount: parseFloat(d.paid_amount || 0),
              unpaid_amount: parseFloat(d.unpaid_amount ?? d.grand_total ?? 0),
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
  }, [
    activeTab,
    reportSubTab,
    paymentSubTab,
    startDate,
    endDate,
    arCustomerCode,
    arStatusFilter,
  ]);

  const poolSummary = useMemo(() => {
    const tAmt = parseFloat(transferAmount) || 0;
    const cAmt = parseFloat(cashAmount) || 0;
    const chkAmt = parseFloat(checkData.amount) || 0;
    const totalPool = tAmt + cAmt + chkAmt;

    let remainingPool = totalPool;
    const allocationsMap = {};

    selectedNoteIds.forEach((noteId, idx) => {
      const note = unpaidNotesList.find((n) => n.id === noteId);
      if (!note) return;

      const alloc =
        remainingPool > 0 ? Math.min(remainingPool, note.unpaid_amount) : 0;
      remainingPool = Math.max(remainingPool - alloc, 0);
      const remainUnpaid = Math.max(note.unpaid_amount - alloc, 0);

      allocationsMap[noteId] = {
        orderIndex: idx + 1,
        allocated: alloc,
        remainUnpaid,
        isFullyCovered: alloc > 0 && remainUnpaid <= 0,
        isPartiallyCovered: alloc > 0 && remainUnpaid > 0,
      };
    });

    const totalAllocated = totalPool - remainingPool;
    return {
      tAmt,
      cAmt,
      chkAmt,
      totalPool,
      totalAllocated,
      remainingPool,
      allocationsMap,
    };
  }, [
    transferAmount,
    cashAmount,
    checkData.amount,
    selectedNoteIds,
    unpaidNotesList,
  ]);

  const handleToggleSelectNote = (noteId) => {
    setSelectedNoteIds((prev) =>
      prev.includes(noteId)
        ? prev.filter((id) => id !== noteId)
        : [...prev, noteId],
    );
  };

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

  const resetPaymentModal = () => {
    setPaymentGlobal(initialPaymentGlobal);
    setTransferAmount("");
    setCashAmount("");
    setCheckData(initialCheckData);
    setSelectedNoteIds([]);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    const { tAmt, cAmt, chkAmt, totalPool, allocationsMap } = poolSummary;

    if (
      paymentGlobal.partner_type === "CUSTOMER" &&
      !paymentGlobal.customer_id
    ) {
      showAlert("提示", "請選擇收款客戶", "warning");
      return;
    }
    if (paymentGlobal.partner_type === "VENDOR" && !paymentGlobal.provider_id) {
      showAlert("提示", "請選擇付款廠商", "warning");
      return;
    }
    if (totalPool <= 0) {
      showAlert(
        "提示",
        "請至少在「現金」、「銀行轉帳」或「支票」輸入大於 0 的金額",
        "warning",
      );
      return;
    }

    if (chkAmt > 0) {
      if (
        !checkData.check_number ||
        !checkData.received_date ||
        !checkData.due_date ||
        !checkData.issuer_bank
      ) {
        showAlert(
          "提示",
          "有輸入支票金額時，請完整填寫「票號」、「收票日」、「到期日」與「開票銀行」",
          "warning",
        );
        return;
      }
    }

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
      amount: totalPool,
      reference_notes: paymentGlobal.reference_notes.trim(),
      method_details: [],
      checks: [],
      write_offs: [],
    };

    if (tAmt > 0) {
      payload.method_details.push({
        payment_method: "TRANSFER",
        amount: tAmt,
      });
    }
    if (cAmt > 0) {
      payload.method_details.push({
        payment_method: "CASH",
        amount: cAmt,
      });
    }
    if (chkAmt > 0) {
      payload.checks.push({
        check_number: checkData.check_number.trim(),
        received_date: checkData.received_date,
        due_date: checkData.due_date,
        cleared_date: checkData.cleared_date || null,
        is_cleared: Boolean(checkData.cleared_date),
        amount: chkAmt,
        issuer_bank: checkData.issuer_bank.trim(),
        note: checkData.note.trim(),
      });
    }

    selectedNoteIds.forEach((noteId) => {
      const allocInfo = allocationsMap[noteId];
      if (allocInfo && allocInfo.allocated > 0) {
        const noteData = unpaidNotesList.find((n) => n.id === noteId);
        if (!noteData) return;

        const wo = { allocated_amount: allocInfo.allocated };
        if (noteData.type === "DELIVERY_NOTE") wo.delivery_note = noteId;
        if (noteData.type === "PURCHASE_REQUISITION")
          wo.purchase_requisition = noteId;
        payload.write_offs.push(wo);
      }
    });

    try {
      const res = await fetchWithAuth("/api/payment_record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error("儲存金流失敗，請檢查輸入資料與單據狀態是否正確");

      showAlert("成功", "金流紀錄已建立，並完成單據沖銷！", "success");
      setIsPaymentModalOpen(false);
      resetPaymentModal();
      fetchPayments();
      if (activeTab === "REPORTS") fetchReports();
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    }
  };

  const handleExecuteClearCheck = async () => {
    const { recordId, checkId, clearedDate } = clearCheckModal;
    if (!recordId) return;

    try {
      const res = await fetchWithAuth(
        `/api/payment_record/${recordId}/clear_check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            check_id: checkId,
            cleared_date: clearedDate,
          }),
        },
      );
      if (!res.ok) throw new Error("兌現處理失敗");

      showAlert("成功", "支票已成功標記為兌現", "success");
      setClearCheckModal({
        isOpen: false,
        recordId: null,
        checkId: null,
        clearedDate: "",
      });
      fetchPayments();
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    }
  };

  const handleDeletePayment = (id) => {
    showConfirm(
      "作廢確認",
      "確定要作廢這筆金流紀錄嗎？(關聯單據的沖銷金額將自動回滾並恢復欠款)",
      async () => {
        closeDialog();
        try {
          const res = await fetchWithAuth(`/api/payment_record/${id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("作廢失敗");
          showAlert("成功", "已成功作廢，單據欠款金額已回滾", "success");
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
      className={`px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2.5 transition-all ${
        isActive
          ? "bg-white text-blue-600 border border-slate-200/80 shadow-sm"
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent"
      }`}
    >
      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
      {label}
    </button>
  );

  const SubTabButton = ({ label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
        isActive
          ? "bg-slate-800 text-white shadow-sm"
          : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );

  const DateFilter = () => (
    <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl p-1 shadow-sm h-[42px]">
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
      <div className="flex items-center gap-2 pr-2">
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-transparent outline-none text-sm font-bold text-slate-700"
        />
      </div>
      <button
        type="button"
        onClick={() => {
          if (activeTab === "REPORTS") fetchReports();
          else if (activeTab === "MISC") fetchMisc();
        }}
        className="h-full px-4 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
      >
        查詢
      </button>
    </div>
  );

  const renderReports = () => {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl border border-slate-200/50 w-fit shrink-0 overflow-x-auto">
              <SubTabButton
                label="應收貨款 (客戶銷貨單對帳)"
                isActive={reportSubTab === "AR"}
                onClick={() => setReportSubTab("AR")}
              />
              <SubTabButton
                label="應付貨款 (廠商對帳)"
                isActive={reportSubTab === "AP"}
                onClick={() => setReportSubTab("AP")}
              />
              <SubTabButton
                label="客戶累積欠款總覽"
                isActive={reportSubTab === "DEBT"}
                onClick={() => setReportSubTab("DEBT")}
              />
            </div>

            {reportSubTab !== "DEBT" && (
              <div className="flex flex-wrap items-center gap-3">
                {reportSubTab === "AR" && (
                  <>
                    <div className="w-52 shrink-0">
                      <CustomSelect
                        options={[
                          { label: "所有客戶", value: "" },
                          ...customers.map((c) => ({
                            label: `[${c.code}] ${c.name}`,
                            value: c.code,
                          })),
                        ]}
                        value={arCustomerCode}
                        onChange={(val) => setArCustomerCode(val)}
                        placeholder="篩選單一客戶..."
                      />
                    </div>
                    <div className="w-40 shrink-0">
                      <CustomSelect
                        options={[
                          { label: "全部付款狀態", value: "" },
                          { label: "未付款", value: "UNPAID" },
                          { label: "仍欠款 (部分)", value: "PARTIAL" },
                          { label: "已付款", value: "PAID" },
                        ]}
                        value={arStatusFilter}
                        onChange={(val) => setArStatusFilter(val)}
                        placeholder="付款狀態..."
                      />
                    </div>
                  </>
                )}
                <DateFilter />

                {reportSubTab === "AR" && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintAllSummary(true);
                      setTimeout(() => window.print(), 200);
                    }}
                    className="px-4 h-[42px] bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <Printer size={16} /> 應收帳款統計表
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-widest text-slate-400 font-black">
                <th className="p-5 w-[25%]">
                  {reportSubTab === "AP" ? "廠商名稱" : "客戶名稱"}
                </th>
                {reportSubTab === "DEBT" ? (
                  <>
                    <th className="p-5 text-right">歷史總應收</th>
                    <th className="p-5 text-right">歷史總已收</th>
                    <th className="p-5 text-right text-rose-600">累積欠額</th>
                  </>
                ) : reportSubTab === "AR" ? (
                  <>
                    <th className="p-5 text-right">區間未稅總額</th>
                    <th className="p-5 text-right">營業稅</th>
                    <th className="p-5 text-right text-blue-600">
                      區間含稅總額
                    </th>
                    <th className="p-5 text-right text-emerald-600">
                      已收金額
                    </th>
                    <th className="p-5 text-right text-rose-600">尚欠金額</th>
                    <th className="p-5 text-center w-[140px]">操作</th>
                  </>
                ) : (
                  <>
                    <th className="p-5 text-right">單據筆數</th>
                    <th className="p-5 text-right text-emerald-700">
                      區間應付總額
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={reportSubTab === "AR" ? 7 : 4}
                    className="p-16 text-center text-slate-400 font-bold"
                  >
                    資料載入中...
                  </td>
                </tr>
              ) : reportSubTab === "AR" ? (
                arData.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="p-16 text-center text-slate-400 font-bold"
                    >
                      此區間查無符合條件的銷貨單紀錄
                    </td>
                  </tr>
                ) : (
                  arData.map((row) => {
                    const isExpanded = expandedArCustomers.has(
                      row.customer_code,
                    );
                    const notes = row.delivery_notes || [];

                    return (
                      <React.Fragment key={row.customer_code}>
                        <tr
                          onClick={() => toggleArCustomerRow(row.customer_code)}
                          className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                        >
                          <td className="p-5 font-black text-slate-800">
                            <div className="flex items-center gap-2.5">
                              <ChevronDown
                                size={16}
                                className={`text-slate-400 transition-transform ${
                                  isExpanded ? "rotate-180 text-blue-600" : ""
                                }`}
                              />
                              <div>
                                <span>
                                  [{row.customer_code}] <br />
                                  {row.customer_name} <br />
                                </span>
                                <span className="ml-2 px-2 py-0.5 text-[11px] bg-slate-100 text-slate-600 rounded-md font-bold">
                                  {notes.length} 筆銷貨單
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-5 text-right font-mono font-bold text-slate-500">
                            ${formatMoney(row.total_sales_amount)}
                          </td>
                          <td className="p-5 text-right font-mono font-bold text-slate-500">
                            ${formatMoney(row.total_tax_amount)}
                          </td>
                          <td className="p-5 text-right font-mono font-black text-blue-700 text-base">
                            ${formatMoney(row.grand_total)}
                          </td>
                          <td className="p-5 text-right font-mono font-bold text-emerald-600">
                            ${formatMoney(row.total_paid_amount)}
                          </td>
                          <td className="p-5 text-right font-mono font-black text-rose-600 text-base">
                            ${formatMoney(row.total_unpaid_amount)}
                          </td>
                          {/* 產生對帳單按鈕放在每個 row 最右側 */}
                          <td
                            className="p-5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setIsPrintAllSummary(false);
                                setPrintCustomerData(row);
                                setTimeout(() => window.print(), 200);
                              }}
                              className="px-4 h-[42px] bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                            >
                              <Printer size={13} /> 預覽單據
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/90">
                            <td colSpan="7" className="p-4 md:px-10">
                              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 bg-slate-100/70 border-b border-slate-200 flex justify-between items-center">
                                  <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                                    銷貨單明細 ({row.customer_name})
                                  </span>
                                  <span className="text-xs font-bold text-slate-500">
                                    點擊「金流與票據」可進行收款沖銷
                                  </span>
                                </div>
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/50">
                                      <th className="py-3 px-4">銷貨單號</th>
                                      <th className="py-3 px-4">單據日期</th>
                                      <th className="py-3 px-4">
                                        產品名稱 / 規格
                                      </th>
                                      <th className="py-3 px-4 text-right">
                                        出貨數量
                                      </th>
                                      <th className="py-3 px-4 text-right">
                                        含稅總額
                                      </th>
                                      <th className="py-3 px-4 text-right">
                                        已收金額
                                      </th>
                                      <th className="py-3 px-4 text-right">
                                        尚欠金額
                                      </th>
                                      <th className="py-3 px-4 text-center">
                                        付款狀態
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {notes.map((dn) => {
                                      const badge =
                                        STATUS_BADGE_MAP[dn.payment_status] ||
                                        STATUS_BADGE_MAP.UNPAID;
                                      return (
                                        <tr
                                          key={dn.id}
                                          className="hover:bg-slate-50 transition-colors"
                                        >
                                          <td className="py-3 px-4 font-mono font-bold text-slate-800">
                                            {dn.note_number}
                                          </td>
                                          <td className="py-3 px-4 font-mono text-slate-600">
                                            {dn.note_date}
                                          </td>
                                          <td className="py-3 px-4 font-bold text-slate-700">
                                            {dn.product_name || "-"}
                                            {dn.spec && (
                                              <span className="ml-1.5 text-slate-400 font-normal">
                                                ({dn.spec})
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-600">
                                            {dn.quantity} {dn.unit}
                                          </td>
                                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                                            ${formatMoney(dn.grand_total)}
                                          </td>
                                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                                            ${formatMoney(dn.paid_amount)}
                                          </td>
                                          <td className="py-3 px-4 text-right font-mono font-black text-rose-600">
                                            ${formatMoney(dn.unpaid_amount)}
                                          </td>
                                          <td className="py-3 px-4 text-center">
                                            <span
                                              className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-black border ${badge.className}`}
                                            >
                                              {badge.label}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )
              ) : reportSubTab === "AP" ? (
                apData.length === 0 ? (
                  <tr>
                    <td
                      colSpan="3"
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
                      </td>
                      <td className="p-5 text-right font-mono font-bold text-slate-500">
                        {row.items?.length || 0} 筆入庫明細
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
                    className="hover:bg-rose-50/30 transition-colors"
                  >
                    <td className="p-5 font-black text-slate-800">
                      [{row.customer_code}] <br /> {row.customer_name}
                    </td>
                    <td className="p-5 text-right font-mono font-bold text-slate-500">
                      ${formatMoney(row.total_ar)}
                    </td>
                    <td className="p-5 text-right font-mono font-bold text-emerald-600">
                      ${formatMoney(row.total_paid)}
                    </td>
                    <td className="p-5 text-right font-mono font-black text-rose-600 text-lg">
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

  const renderMisc = () => {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <DateFilter />
          <button
            onClick={() => {
              setEditingMisc(null);
              setMiscForm(initialMiscForm);
              setIsMiscModalOpen(true);
            }}
            className="bg-[#007AFF] hover:bg-[#0056b3] text-white px-6 py-2.5 rounded-xl shadow-sm transition-all text-sm font-bold flex items-center gap-2"
          >
            <Plus size={18} strokeWidth={2.5} /> 紀錄新收支
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-widest text-slate-400 font-black">
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
                    <td className="p-4 text-center font-mono font-bold text-slate-600">
                      {row.transaction_date}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-black border ${
                          row.transaction_type === "INCOME"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
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
                      className={`p-4 text-right font-mono font-black text-base ${
                        row.transaction_type === "INCOME"
                          ? "text-emerald-600"
                          : "text-slate-700"
                      }`}
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
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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

  const renderPayments = () => {
    const tableData = paymentSubTab === "ALL" ? payments : pendingChecks;

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
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
              resetPaymentModal();
              setIsPaymentModalOpen(true);
            }}
            className="bg-[#007AFF] hover:bg-[#0056b3] text-white px-6 py-2.5 rounded-xl shadow-sm transition-all text-sm font-bold flex items-center gap-2"
          >
            <Wallet size={18} strokeWidth={2.5} /> 新增金流沖銷
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-widest text-slate-400 font-black">
                <th className="p-5 pl-8 w-[30%]">日期</th>
                <th className="p-5">對象</th>
                <th className="p-5">收付方式</th>
                <th className="p-5 text-right">收付總額</th>
                {/* <th className="p-5 w-[30%]">沖銷單據與備註</th> */}
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
                    查無金流紀錄
                  </td>
                </tr>
              ) : (
                tableData.map((row) => {
                  const checks = row.checks || [];
                  const writeOffs = row.write_offs || [];
                  const hasUnclearedChecks = checks.some((c) => !c.is_cleared);
                  const isExpandable =
                    row.method_details?.length > 0 ||
                    checks.length > 0 ||
                    writeOffs.length > 0;
                  const isExpanded = expandedPaymentRows.has(row.id);

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className={`transition-colors group ${
                          hasUnclearedChecks && paymentSubTab === "ALL"
                            ? "bg-amber-50/30"
                            : ""
                        } ${
                          isExpandable
                            ? "hover:bg-slate-50/80 cursor-pointer"
                            : "hover:bg-slate-50/50"
                        }`}
                        onClick={() => isExpandable && togglePaymentRow(row.id)}
                      >
                        <td className="p-4 pl-6 relative text-left">
                          <div className="flex items-center gap-3">
                            {isExpandable ? (
                              <ChevronDown
                                size={16}
                                className={`text-slate-400 transition-transform shrink-0 ${
                                  isExpanded ? "rotate-180 text-blue-600" : ""
                                }`}
                              />
                            ) : (
                              <div className="w-4 shrink-0"></div>
                            )}
                            <span className="font-mono font-bold text-slate-700">
                              {row.payment_date}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 font-black text-slate-800">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border mr-2 font-black ${
                              row.partner_type === "CUSTOMER"
                                ? "bg-blue-50 text-blue-600 border-blue-200"
                                : "bg-purple-50 text-purple-600 border-purple-200"
                            }`}
                          >
                            {row.partner_type === "CUSTOMER" ? "收" : "付"}
                          </span>
                          {row.partner_type === "CUSTOMER"
                            ? row.customer_name
                            : row.provider_name}
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-bold text-slate-600 px-3 py-1 bg-slate-100 rounded-xl border border-slate-200">
                            {row.payment_method === "CASH"
                              ? "現金"
                              : row.payment_method === "TRANSFER"
                                ? "銀行轉帳"
                                : row.payment_method === "MIXED"
                                  ? "複合收付"
                                  : "支票"}
                          </span>
                        </td>
                        <td
                          className={`p-4 text-right font-mono font-black text-base ${
                            row.partner_type === "CUSTOMER"
                              ? "text-blue-600"
                              : "text-slate-700"
                          }`}
                        >
                          ${formatMoney(row.amount)}
                        </td>
                        {/* <td className="p-4">
                          <div
                            className="text-xs font-bold text-slate-600 line-clamp-2 leading-relaxed"
                            title={row.reference_notes}
                          >
                            {row.reference_notes || "-"}
                          </div>
                        </td> */}
                        <td className="p-4 text-center">
                          <div className="flex w-full justify-center gap-2">
                            {hasUnclearedChecks && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setClearCheckModal({
                                    isOpen: true,
                                    recordId: row.id,
                                    checkId:
                                      checks.find((c) => !c.is_cleared)?.id ||
                                      null,
                                    clearedDate: new Date()
                                      .toISOString()
                                      .split("T")[0],
                                  });
                                }}
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-500 hover:text-white rounded-lg transition-all text-xs font-bold shadow-sm whitespace-nowrap"
                              >
                                確認兌現
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePayment(row.id);
                              }}
                              className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-500 hover:text-white rounded-lg transition-all text-xs font-bold shadow-sm whitespace-nowrap opacity-70 group-hover:opacity-100"
                            >
                              作廢
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-100/60 border-b border-slate-200 shadow-inner">
                          <td colSpan={6} className="p-6 md:px-12">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
                                  收付款方式組成
                                </h4>
                                <div className="space-y-2.5">
                                  {row.method_details?.length > 0 ? (
                                    row.method_details.map((md, idx) => (
                                      <div
                                        key={idx}
                                        className="flex justify-between items-center py-2.5 px-4 bg-slate-50/80 rounded-xl border border-slate-100"
                                      >
                                        <span className="text-xs font-bold text-slate-600">
                                          {md.payment_method === "TRANSFER"
                                            ? "銀行轉帳"
                                            : md.payment_method === "CASH"
                                              ? "現金"
                                              : "支票彙整"}
                                        </span>
                                        <span className="font-mono text-base font-black text-slate-800">
                                          ${formatMoney(md.amount)}
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-slate-400 font-medium py-3 text-center">
                                      無直接明細
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
                                  支票明細
                                </h4>
                                <div className="space-y-3">
                                  {checks.length > 0 ? (
                                    checks.map((chk) => (
                                      <div
                                        key={chk.id}
                                        className="p-4 bg-amber-50/40 border border-amber-200/80 rounded-xl space-y-2 text-xs shadow-sm"
                                      >
                                        <div className="flex justify-between items-center font-black">
                                          <span className="font-mono text-sm text-amber-800">
                                            #{chk.check_number}
                                          </span>
                                          <span className="font-mono text-base font-black text-slate-900">
                                            ${formatMoney(chk.amount)}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 text-slate-600 font-bold pt-1">
                                          <div>
                                            銀行: {chk.issuer_bank || "-"}
                                          </div>
                                          <div>到期日: {chk.due_date}</div>
                                          <div className="col-span-2">
                                            收票日: {chk.received_date || "-"}
                                          </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-amber-200/50">
                                          <span
                                            className={`px-2.5 py-1 rounded-md text-[11px] font-black ${
                                              chk.is_cleared
                                                ? "bg-emerald-100 text-emerald-700"
                                                : "bg-rose-100 text-rose-700"
                                            }`}
                                          >
                                            {chk.is_cleared
                                              ? `已兌現 (${chk.cleared_date || ""})`
                                              : "待兌現"}
                                          </span>
                                          {!chk.is_cleared && (
                                            <button
                                              onClick={() =>
                                                setClearCheckModal({
                                                  isOpen: true,
                                                  recordId: row.id,
                                                  checkId: chk.id,
                                                  clearedDate: new Date()
                                                    .toISOString()
                                                    .split("T")[0],
                                                })
                                              }
                                              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
                                            >
                                              確認兌現
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-slate-400 font-medium py-3 text-center">
                                      無包含支票
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
                                  本次沖銷單據明細
                                </h4>
                                <div className="space-y-3">
                                  {writeOffs.length > 0 ? (
                                    writeOffs.map((wo, idx) => (
                                      <div
                                        key={idx}
                                        className="p-3 bg-blue-50/50 border border-blue-200/70 rounded-xl flex justify-between items-center shadow-sm"
                                      >
                                        <div>
                                          <div className="font-mono font-black text-slate-800 text-sm">
                                            {wo.delivery_note_number ||
                                              `PR#${wo.purchase_requisition}`}
                                          </div>
                                          <div className="text-[11px] font-bold text-slate-400">
                                            {wo.delivery_note_date ||
                                              wo.purchase_requisition_date}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-mono text-blue-700 font-black text-sm">
                                            沖銷 $
                                            {formatMoney(wo.allocated_amount)}
                                          </div>
                                          {wo.delivery_note_grand_total && (
                                            <div className="text-[10px] text-slate-400 font-mono font-bold">
                                              單據總額 $
                                              {formatMoney(
                                                wo.delivery_note_grand_total,
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-slate-400 font-medium py-3 text-center">
                                      無綁定沖銷單據
                                    </div>
                                  )}
                                </div>
                              </div>
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

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto bg-slate-50 min-h-screen font-sans text-slate-800 w-full">
      {/* 隱藏操作介面，確保列印時只有純列印樣板 */}
      <div className="print:hidden">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            財務與會計中心
          </h2>
        </div>

        <div className="flex bg-slate-200/60 p-1.5 rounded-3xl mb-8 w-fit">
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
      </div>

      {/* 隱藏式列印樣板 */}
      {isPrintAllSummary ? (
        <AllCustomersSummaryPrintTemplate
          arData={arData}
          startDate={startDate}
          endDate={endDate}
          debtMap={customerDebtMap}
        />
      ) : (
        <SingleCustomerStatementPrintTemplate
          customerRow={printCustomerData}
          startDate={startDate}
          endDate={endDate}
          debtMap={customerDebtMap}
        />
      )}

      {clearCheckModal.isOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-black text-emerald-700 flex items-center gap-2 mb-2">
                <CheckCircle2 size={20} /> 確認支票兌現
              </h3>
              <p className="text-xs text-slate-500 font-bold mb-4">
                請輸入或確認該支票實際在銀行的兌現日期：
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                  實際兌現日 *
                </label>
                <input
                  type="date"
                  required
                  value={clearCheckModal.clearedDate}
                  onChange={(e) =>
                    setClearCheckModal({
                      ...clearCheckModal,
                      clearedDate: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setClearCheckModal({
                    isOpen: false,
                    recordId: null,
                    checkId: null,
                    clearedDate: "",
                  })
                }
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 text-sm font-bold rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleExecuteClearCheck}
                className="px-5 py-2 text-white bg-emerald-600 hover:bg-emerald-700 text-sm font-bold rounded-xl shadow-sm transition-colors"
              >
                確認入帳
              </button>
            </div>
          </div>
        </div>
      )}

      {isMiscModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto flex justify-center items-start p-4 pt-12 pb-20">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Receipt className="text-blue-500" />
                {editingMisc ? "編輯雜支紀錄" : "紀錄新收支"}
              </h3>
              <button
                onClick={() => setIsMiscModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveMisc} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    收支大項 *
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
                    次項分類 *
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
                  日期 *
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
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                  金額 *
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
                    className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-xl text-lg font-mono font-black text-slate-800 outline-none focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                  類別摘要 *
                </label>
                <input
                  type="text"
                  required
                  value={miscForm.category}
                  onChange={(e) =>
                    setMiscForm({ ...miscForm, category: e.target.value })
                  }
                  placeholder="例如: 電話費、購買文具"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
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
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-blue-500 resize-none"
                  placeholder="選填..."
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMiscModalOpen(false)}
                  className="px-6 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 text-sm font-bold rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 text-white bg-[#007AFF] hover:bg-[#0056b3] text-sm font-bold rounded-xl shadow-sm transition-all"
                >
                  儲存紀錄
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto flex justify-center items-start p-4 pt-8 pb-16">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Wallet className="text-blue-600" /> 建立金流沖銷紀錄
              </h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 text-2xl transition-colors"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-6 space-y-6">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    交易日期 *
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
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    收付方向 *
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
                    指定對象 *
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
                      placeholder="選擇客戶..."
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
                      placeholder="選擇廠商..."
                    />
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    金流備註 (選填)
                  </label>
                  <input
                    type="text"
                    value={paymentGlobal.reference_notes}
                    onChange={(e) =>
                      setPaymentGlobal({
                        ...paymentGlobal,
                        reference_notes: e.target.value,
                      })
                    }
                    placeholder="自訂備註說明..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">
                    1. 輸入收付款金額 (可單選或組合多種方式，自動匯總為沖銷水庫)
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700 font-black text-sm">
                      <Banknote size={18} /> 現金金額
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-xl text-lg font-mono font-black text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-blue-700 font-black text-sm">
                      <ArrowRightLeft size={18} /> 銀行轉帳金額
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-xl text-lg font-mono font-black text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 font-black text-sm">
                      <CreditCard size={18} /> 支票金額與資訊
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={checkData.amount}
                        onChange={(e) =>
                          setCheckData({ ...checkData, amount: e.target.value })
                        }
                        className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-xl text-lg font-mono font-black text-slate-800 outline-none focus:border-amber-500"
                      />
                    </div>

                    {(parseFloat(checkData.amount) || 0) > 0 && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            票號 *
                          </label>
                          <input
                            type="text"
                            required
                            value={checkData.check_number}
                            onChange={(e) =>
                              setCheckData({
                                ...checkData,
                                check_number: e.target.value,
                              })
                            }
                            placeholder="支票號碼"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            收票日 *
                          </label>
                          <input
                            type="date"
                            required
                            value={checkData.received_date}
                            onChange={(e) =>
                              setCheckData({
                                ...checkData,
                                received_date: e.target.value,
                              })
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            到期日 *
                          </label>
                          <input
                            type="date"
                            required
                            value={checkData.due_date}
                            onChange={(e) =>
                              setCheckData({
                                ...checkData,
                                due_date: e.target.value,
                              })
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            開票銀行 *
                          </label>
                          <input
                            type="text"
                            required
                            value={checkData.issuer_bank}
                            onChange={(e) =>
                              setCheckData({
                                ...checkData,
                                issuer_bank: e.target.value,
                              })
                            }
                            placeholder="例如: 玉山銀行"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      2. 點選要沖銷的單據 (依勾選先後順序自動從總額水庫扣抵)
                    </h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm text-xs font-bold">
                    <div>
                      <span className="text-slate-400 mr-1.5">收付總水庫:</span>
                      <span className="font-mono font-black text-slate-800 text-sm">
                        ${formatMoney(poolSummary.totalPool)}
                      </span>
                    </div>
                    <div className="text-slate-300">|</div>
                    <div>
                      <span className="text-slate-400 mr-1.5">已分配沖銷:</span>
                      <span className="font-mono font-black text-blue-600 text-sm">
                        ${formatMoney(poolSummary.totalAllocated)}
                      </span>
                    </div>
                    <div className="text-slate-300">|</div>
                    <div>
                      <span className="text-slate-400 mr-1.5">
                        水庫剩餘可抵:
                      </span>
                      <span
                        className={`font-mono font-black text-sm ${
                          poolSummary.remainingPool > 0
                            ? "text-emerald-600"
                            : "text-slate-500"
                        }`}
                      >
                        ${formatMoney(poolSummary.remainingPool)}
                      </span>
                    </div>
                  </div>
                </div>

                {!paymentGlobal.customer_id && !paymentGlobal.provider_id ? (
                  <div className="p-8 text-center text-slate-400 font-bold text-sm">
                    請先於上方選擇「客戶」或「廠商」以載入未結清單據
                  </div>
                ) : unpaidNotesList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-bold text-sm">
                    該對象目前無任何未結清單據
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {unpaidNotesList.map((note) => {
                      const isSelected = selectedNoteIds.includes(note.id);
                      const allocInfo = poolSummary.allocationsMap[note.id];
                      const allocated = allocInfo ? allocInfo.allocated : 0;
                      const remainUnpaid = allocInfo
                        ? allocInfo.remainUnpaid
                        : note.unpaid_amount;

                      return (
                        <div
                          key={note.id}
                          onClick={() => handleToggleSelectNote(note.id)}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? allocated > 0
                                ? "bg-blue-50/70 border-blue-400 shadow-sm"
                                : "bg-amber-50/50 border-amber-300"
                              : "bg-white border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isSelected ? (
                              <CheckSquare
                                size={18}
                                className="text-blue-600 flex-shrink-0"
                              />
                            ) : (
                              <Square
                                size={18}
                                className="text-slate-300 flex-shrink-0"
                              />
                            )}
                            {isSelected && allocInfo && (
                              <span className="px-2 py-0.5 bg-blue-600 text-white font-mono text-[11px] font-black rounded-md">
                                #{allocInfo.orderIndex}
                              </span>
                            )}
                            <div>
                              <div className="text-sm font-black text-slate-800 font-mono">
                                {note.display_number}
                              </div>
                              <div className="text-[11px] font-bold text-slate-400">
                                單據日期: {note.display_date} | 單據總額: $
                                {formatMoney(note.grand_total)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 text-right">
                            <div>
                              <div className="text-[10px] font-bold text-slate-400">
                                原未結清欠款
                              </div>
                              <div className="font-mono font-bold text-slate-700 text-sm">
                                ${formatMoney(note.unpaid_amount)}
                              </div>
                            </div>

                            {isSelected && (
                              <>
                                <div>
                                  <div className="text-[10px] font-bold text-blue-600">
                                    本次沖銷扣除
                                  </div>
                                  <div className="font-mono font-black text-blue-600 text-sm">
                                    -${formatMoney(allocated)}
                                  </div>
                                </div>
                                <div className="min-w-[110px]">
                                  <div className="text-[10px] font-bold text-slate-400">
                                    沖銷後剩餘欠款
                                  </div>
                                  <div
                                    className={`font-mono font-black text-sm ${
                                      remainUnpaid === 0
                                        ? "text-emerald-600"
                                        : "text-amber-600"
                                    }`}
                                  >
                                    ${formatMoney(remainUnpaid)}{" "}
                                    <span className="text-[10px] font-sans">
                                      (
                                      {allocated === 0
                                        ? "水庫已用罄"
                                        : remainUnpaid === 0
                                          ? "結清"
                                          : "仍欠款"}
                                      )
                                    </span>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-xs font-bold text-slate-500">
                  現金: ${formatMoney(poolSummary.cAmt)} | 轉帳: $
                  {formatMoney(poolSummary.tAmt)} | 支票: $
                  {formatMoney(poolSummary.chkAmt)}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="px-6 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 text-sm font-bold rounded-xl transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 text-white bg-[#007AFF] hover:bg-[#0056b3] text-sm font-bold rounded-xl shadow-sm transition-all"
                  >
                    確認建立金流與沖銷
                  </button>
                </div>
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

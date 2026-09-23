import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Loader2,
  Activity,
  CheckCircle2,
  ShieldAlert,
  ChevronDown,
} from "lucide-react";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import CustomDialog from "./components/customDialog";

// 🌟 二元判定的選項常數 (移除合格)
const QC_BOOL_OPTIONS = [
  { value: "NEGATIVE", label: "陰性 (Negative)" },
  { value: "POSITIVE", label: "陽性 (Positive)" },
];

// 🌟 完全自訂的下拉選單元件 (不使用瀏覽器預設)
const CustomSelect = ({
  value,
  onChange,
  options,
  disabled,
  placeholder = "請選擇...",
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
    <div className="relative w-full h-10" ref={selectRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full h-full flex justify-between items-center px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold shadow-sm transition-all ${
          disabled
            ? "bg-slate-100 cursor-not-allowed text-slate-400"
            : "cursor-pointer hover:border-indigo-400 text-slate-800"
        } ${isOpen ? "ring-2 ring-indigo-500/20 border-indigo-500" : ""}`}
      >
        <span
          className={`truncate text-left ${selectedOption ? "text-slate-800" : "text-slate-400"}`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? "rotate-180 text-indigo-500" : ""}`}
        />
      </div>
      {isOpen && !disabled && (
        <div className="absolute z-[100] top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar">
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`px-3 py-2.5 text-sm font-bold cursor-pointer text-left transition-colors ${
                String(value) === String(opt.value)
                  ? "bg-indigo-50 text-indigo-700"
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

// 🌟 輔助函數：格式化範圍顯示字樣 (處理單邊極限)
const getRangeLabel = (min, max) => {
  if (min && !max) return `${min} 以上（含）`;
  if (!min && max) return `${max} 以下（含）`;
  if (min && max) return `${min} ~ ${max}`;
  return "-";
};

export default function ProductionOrderQCPage() {
  const { production_order_id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // qcForm 將用來存放現場填寫的數值，格式為: { [name]: value }
  const [qcForm, setQcForm] = useState({});
  // 總判定結果 (合格 / 不合格 / 尚未判定)
  const [qcPassed, setQcPassed] = useState(null);

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
    fetchOrderQC();
  }, [production_order_id]);

  const fetchOrderQC = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `/api/production_orders/${production_order_id}`,
      );
      if (!res.ok) throw new Error("載入檢驗資料失敗");
      const json = await res.json();
      const data = json.data || json;
      setOrder(data);

      // 載入時將已經存在的 qc_metrics 倒回 Form 中 (以 name 為 Key)
      const initialForm = {};
      if (Array.isArray(data.qc_metrics)) {
        data.qc_metrics.forEach((metric) => {
          initialForm[metric.name] = metric.actual_value;
        });
      }
      setQcForm(initialForm);
      setQcPassed(data.qc_passed);
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (name, value) => {
    setQcForm((prev) => ({ ...prev, [name]: value }));
  };

  // 自動輔助判定
  const checkIsPassed = (qcItem, actualValue) => {
    if (actualValue === undefined || actualValue === "") return null;

    if (qcItem.type === "range") {
      const val = parseFloat(actualValue);
      // 如果輸入的不是純數字 (如 N.D. 未檢出)，就無法比對，預設給 true 由主管判定
      if (isNaN(val)) return true;
      if (qcItem.target_min && val < parseFloat(qcItem.target_min))
        return false;
      if (qcItem.target_max && val > parseFloat(qcItem.target_max))
        return false;
      return true;
    }

    if (qcItem.type === "boolean") {
      return actualValue === qcItem.target_bool;
    }

    return true;
  };

  const executeUpdate = async () => {
    if (qcPassed === null) {
      return showAlert(
        "尚未判定",
        "請在頁面下方選擇「最終品管判定」結果。",
        "warning",
      );
    }

    setSubmitting(true);
    try {
      // 組合後端需要的 QC Metrics 陣列
      const qcStandards = order.product_profile?.qc_standards || [];
      const updatedMetrics = qcStandards.map((qc) => ({
        id: qc.id || qc.name, // 確保有值
        name: qc.name,
        type: qc.type,
        actual_value: qcForm[qc.name] !== undefined ? qcForm[qc.name] : "",
      }));

      const res = await fetchWithAuth(
        `/api/production_orders/${production_order_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qc_metrics: updatedMetrics,
            qc_passed: qcPassed,
          }),
        },
      );

      if (!res.ok) throw new Error("品管檢驗報告儲存失敗");

      setDialog({
        isOpen: true,
        type: "alert",
        status: "success",
        title: "成功",
        message: "檢驗紀錄已成功儲存！",
        onConfirm: () => navigate(-1),
      });
    } catch (err) {
      showAlert("儲存失敗", err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-50 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <div className="text-slate-500 font-bold">載入檢驗標準中...</div>
      </div>
    );
  }

  const qcStandards = order?.product_profile?.qc_standards || [];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800 w-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            品管與檢驗報告回填
            <span className="text-sm px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-mono font-bold">
              單號: {order?.order_number}
            </span>
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-sm text-slate-500 hover:text-slate-800 transition-colors mb-2 font-medium mt-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回列表
          </button>
        </div>
      </div>

      <div className="flex-1 w-full mb-8">
        {/* 🌟 拔除 overflow-hidden，避免 CustomSelect 下拉選單被裁切 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full">
          <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between rounded-t-xl">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              檢驗目標：{order?.product_profile?.code}{" "}
              {order?.product_profile?.name || order?.product_name}
            </h3>
          </div>

          <div className="w-full pb-4">
            <table className="w-full text-left border-collapse table-fixed text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4 w-[25%]">檢驗項目</th>
                  <th className="p-4 w-[25%]">標準範圍</th>
                  <th className="p-4 w-[35%]">實際檢驗結果</th>
                  <th className="p-4 text-center w-[15%]">系統初判</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {qcStandards.length > 0 ? (
                  qcStandards.map((qc, idx) => {
                    const actualVal = qcForm[qc.name];
                    const isPassed = checkIsPassed(qc, actualVal);

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/50 transition-colors h-16"
                      >
                        <td className="p-4 font-bold text-slate-800 border-r border-slate-100 align-middle">
                          {qc.name}
                        </td>

                        <td className="p-4 font-bold text-slate-600 border-r border-slate-100 align-middle whitespace-nowrap">
                          {qc.type === "range" ? (
                            getRangeLabel(qc.target_min, qc.target_max)
                          ) : qc.type === "boolean" ? (
                            qc.target_bool === "NEGATIVE" ? (
                              "陰性 (Negative)"
                            ) : (
                              "陽性 (Positive)"
                            )
                          ) : (
                            <span
                              className="text-slate-500 font-normal truncate max-w-xs block"
                              title={qc.target_text}
                            >
                              {qc.target_text || "-"}
                            </span>
                          )}
                        </td>

                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-3 relative">
                            {/* 🌟 統一輸入框寬度為 w-[200px] 與固定高度 h-10，且內容強制靠左 */}
                            <div className="w-[200px] shrink-0">
                              {qc.type === "range" && (
                                <input
                                  type="text"
                                  value={actualVal || ""}
                                  onChange={(e) =>
                                    handleInputChange(qc.name, e.target.value)
                                  }
                                  placeholder="數值 (或描述)..."
                                  className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-left text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none shadow-sm transition-all"
                                />
                              )}

                              {qc.type === "boolean" && (
                                <CustomSelect
                                  options={[
                                    { label: "未檢測", value: "" },
                                    ...QC_BOOL_OPTIONS,
                                  ]}
                                  value={actualVal || ""}
                                  onChange={(val) =>
                                    handleInputChange(qc.name, val)
                                  }
                                  placeholder="未檢測"
                                />
                              )}

                              {qc.type === "text" && (
                                <input
                                  type="text"
                                  value={actualVal || ""}
                                  onChange={(e) =>
                                    handleInputChange(qc.name, e.target.value)
                                  }
                                  placeholder="文字描述..."
                                  className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-left text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none shadow-sm transition-all"
                                />
                              )}
                            </div>

                            {/* 錯誤提示 */}
                            {isPassed === false && (
                              <span className="text-rose-500 font-bold flex items-center gap-1 text-sm bg-rose-50 px-2 py-1.5 rounded-md shrink-0 border border-rose-100">
                                <ShieldAlert size={16} />{" "}
                                {qc.type === "boolean"
                                  ? "判定異常"
                                  : "超出標準"}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 text-center align-middle">
                          {isPassed === true && (
                            <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-200 shadow-sm min-w-[72px]">
                              <CheckCircle2 size={14} /> 合格
                            </div>
                          )}
                          {isPassed === false && (
                            <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded bg-rose-50 text-rose-600 font-bold text-xs border border-rose-200 shadow-sm min-w-[72px]">
                              <ShieldAlert size={14} /> 異常
                            </div>
                          )}
                          {isPassed === null && (
                            <span className="text-slate-400 font-bold text-xs">
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="p-16 text-center">
                      <Activity
                        size={32}
                        className="mx-auto text-slate-300 mb-3"
                        strokeWidth={1.5}
                      />
                      <div className="text-slate-500 font-bold">
                        此產品目前尚未設定任何品管標準
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-200 sticky bottom-6 p-5 md:p-6 flex flex-col md:flex-row justify-between items-center gap-6 z-20">
        <div className="w-full md:w-1/2 flex flex-col sm:flex-row sm:items-center gap-4">
          <label className="text-sm font-black text-slate-700 whitespace-nowrap">
            最終品管判定 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3 w-full">
            <label
              className={`flex-1 flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg border-2 cursor-pointer transition-all ${
                qcPassed === true
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                className="hidden"
                checked={qcPassed === true}
                onChange={() => setQcPassed(true)}
              />
              <CheckCircle2
                size={18}
                className={
                  qcPassed === true ? "text-emerald-500" : "text-slate-300"
                }
              />
              <span className="font-black text-sm">判定合格</span>
            </label>
            <label
              className={`flex-1 flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg border-2 cursor-pointer transition-all ${
                qcPassed === false
                  ? "border-rose-500 bg-rose-50 text-rose-700 shadow-sm"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                className="hidden"
                checked={qcPassed === false}
                onChange={() => setQcPassed(false)}
              />
              <ShieldAlert
                size={18}
                className={
                  qcPassed === false ? "text-rose-500" : "text-slate-300"
                }
              />
              <span className="font-black text-sm">判定異常</span>
            </label>
          </div>
        </div>

        <button
          onClick={executeUpdate}
          disabled={submitting}
          className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-all font-bold text-sm shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:transform-none"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          儲存檢驗報告
        </button>
      </div>

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

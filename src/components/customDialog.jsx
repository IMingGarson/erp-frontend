const CustomDialog = ({ isOpen, type, status, title, message, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          {/* 動態 Icon */}
          <div className="mb-4 flex justify-center">
            {status === 'success' && (
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-3xl text-emerald-500">
                ✅
              </div>
            )}
            {status === 'error' && (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl text-red-500">
                ❌
              </div>
            )}
            {status === 'warning' && (
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-3xl text-amber-500">
                ⚠️
              </div>
            )}
            {status === 'info' && (
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-3xl text-blue-500">
                ℹ️
              </div>
            )}
          </div>
          
          <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
          <p className="text-slate-600 text-sm whitespace-pre-line">{message}</p>
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center gap-3">
          {type === 'confirm' ? (
            <>
              <button 
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 font-bold rounded-lg transition-colors outline-none"
              >
                取消
              </button>
              <button 
                onClick={onConfirm}
                className="flex-1 px-4 py-2.5 text-white bg-red-600 hover:bg-red-700 font-bold rounded-lg shadow-sm transition-colors outline-none"
              >
                確定
              </button>
            </>
          ) : (
            <button 
              onClick={onClose}
              className="w-full px-4 py-2.5 text-white bg-blue-600 hover:bg-blue-700 font-bold rounded-lg shadow-sm transition-colors outline-none"
            >
              我知道了
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomDialog;
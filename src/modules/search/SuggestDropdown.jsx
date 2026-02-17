
import React from 'react';
import { Search, Music, Sparkles } from 'lucide-react';

const SuggestDropdown = ({ suggestions, isLoading, onSelect, selectedIndex = -1 }) => {
    if (isLoading) {
        return (
            <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-b-xl border border-slate-200 mt-1 z-50 p-4">
                <div className="flex items-center justify-center gap-2 text-slate-400">
                    <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                    <span className="text-sm font-medium">Đang tìm ý tưởng...</span>
                </div>
            </div>
        );
    }

    if (!suggestions || suggestions.length === 0) return null;

    return (
        <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-b-xl border border-slate-200 z-50 overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                {suggestions.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    const isFirstAI = item.source === 'ai' && (index === 0 || suggestions[index - 1].source !== 'ai');

                    return (
                        <React.Fragment key={index}>
                            {isFirstAI && (
                                <div className="px-4 py-2 bg-indigo-50 text-xs font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-2 mt-1 border-t border-indigo-100">
                                    <Sparkles size={12} />
                                    Gợi ý từ AI
                                </div>
                            )}
                            <div
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent input blur
                                    onSelect(item.query);
                                }}
                                className={`flex items-center gap-4 p-4 cursor-pointer transition-colors border-b border-slate-50 last:border-0 group
                                    ${isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-indigo-50 border-l-4 border-l-transparent'}
                                    ${item.source === 'ai' ? 'bg-indigo-50/30' : ''}
                                `}
                            >
                                <div className={`p-2 rounded-full transition-colors ${isSelected ? 'bg-indigo-100 text-indigo-600' :
                                    item.source === 'ai' ? 'bg-purple-100/50 text-purple-500' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                                    {item.source === 'ai' ? <Sparkles size={20} /> : <Music size={20} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {/* Large, Bold Title for readability */}
                                    <div className={`text-lg font-bold truncate transition-colors ${isSelected ? 'text-indigo-700' : 'text-slate-800 group-hover:text-indigo-700'}`}>
                                        {item.title}
                                    </div>

                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Footer / Branding for trust */}
            <div className="bg-slate-50 p-2 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                Thông minh bởi Gemini AI
            </div>
        </div>
    );
};

export default SuggestDropdown;

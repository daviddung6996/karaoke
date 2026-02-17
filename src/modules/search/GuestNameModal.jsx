import React, { useState, useEffect, useRef } from 'react';
import { X, Check, User } from 'lucide-react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { suggestNames } from '../core/nameSuggester';

const GuestNameModal = ({ isOpen, onClose, onConfirm, songTitle }) => {
    const [name, setName] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setName('');
            setSuggestions([]);
            setSelectedIndex(0);
            setIsSubmitting(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        setSuggestions(suggestNames(name));
        setSelectedIndex(0);
    }, [name]);

    // Click gợi ý = điền tên vào input (không thêm queue)
    const handlePick = (picked) => {
        setName(picked);
        inputRef.current?.focus();
    };

    // Chỉ hàm này mới thực sự thêm vào queue
    const handleSubmit = (isPriority = false) => {
        const finalName = name.trim();
        if (!finalName || isSubmitting) return;
        setIsSubmitting(true);
        // Ensure onConfirm is a function before calling
        if (typeof onConfirm === 'function') {
            onConfirm(finalName, isPriority);
        }
        onClose();
    };

    const handleKeyDown = (e) => {
        // Change to 1 column list for better UX
        const COLS = 1;
        let nextIndex = selectedIndex;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            nextIndex = selectedIndex + 1;
            if (nextIndex >= suggestions.length) nextIndex = 0; // Wrap around? Or stop? User might prefer stop.
            // Let's stop at end for standard behavior, or loop. Loop is nice.
            // But usually dropdowns loop.
            if (nextIndex >= suggestions.length) nextIndex = suggestions.length - 1; // Stop at end
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            nextIndex = selectedIndex - 1;
            if (nextIndex < 0) nextIndex = 0; // Stop at start
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // Enter = chọn gợi ý đang highlight (điền vào input)
            // KHÔNG tự động submit (theo yêu cầu user)
            if (suggestions.length > 0) {
                handlePick(suggestions[selectedIndex]);
            }
            return;
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (suggestions.length > 0) {
                handlePick(suggestions[selectedIndex]);
            }
            return;
        }

        if (nextIndex !== selectedIndex) {
            setSelectedIndex(nextIndex);
            scrollIntoView(nextIndex);
        }
    };

    const scrollIntoView = (index) => {
        if (listRef.current) {
            const element = listRef.current.children[index];
            if (element) {
                element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Thêm Bài Hát & Khách Mời</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={28} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
                    {/* Song Info */}
                    <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-wide mb-1">Bài hát đã chọn</p>
                        <p className="text-xl font-bold text-indigo-900 leading-tight">{songTitle}</p>
                    </div>

                    {/* Input Area */}
                    <div className="space-y-3 flex-shrink-0">
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wide ml-1">Tên Khách Hát</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                            <Input
                                ref={inputRef}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Nhập tên (ví dụ: anh 7...)"
                                className="pl-12 h-14 text-xl font-black border-2 border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 rounded-2xl w-full transition-all text-slate-800 placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    {/* Live Suggestions - click = điền tên, không thêm queue */}
                    {suggestions.length > 0 && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 ml-1">Gợi ý (Chọn bằng phím mũi tên)</p>
                            <div ref={listRef} className="flex flex-col gap-2">
                                {suggestions.map((sug, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handlePick(sug)}
                                        className={`p-3 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer border
                                            ${index === selectedIndex
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200'
                                                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-100 hover:border-slate-200'
                                            }`}
                                    >
                                        <span className="text-xl font-bold">{sug}</span>
                                        {index === selectedIndex && <Check size={24} className="animate-in fade-in zoom-in" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {suggestions.length === 0 && name.length > 0 && (
                        <div className="text-center p-4 text-slate-400">
                            <p>Nhấn Enter để xác nhận: <span className="font-bold text-slate-600">"{name}"</span></p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                    <Button variant="ghost" onClick={onClose} size="lg" className="text-slate-500 hover:text-slate-700 font-bold text-lg">
                        Hủy
                    </Button>
                    <Button
                        onClick={() => handleSubmit(false)}
                        disabled={!name.trim()}
                        size="lg"
                        className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-lg"
                    >
                        Thêm Vào Hàng Chờ
                    </Button>
                    <Button
                        onClick={() => handleSubmit(true)}
                        disabled={!name.trim()}
                        size="lg"
                        className="px-8 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-lg shadow-lg shadow-green-200"
                    >
                        Ưu Tiên (Lên Đầu)
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default GuestNameModal;

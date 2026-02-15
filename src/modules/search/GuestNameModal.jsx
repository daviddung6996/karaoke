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
    const handleSubmit = () => {
        const finalName = name.trim();
        if (!finalName || isSubmitting) return;
        setIsSubmitting(true);
        onConfirm(finalName);
        onClose();
    };

    const handleKeyDown = (e) => {
        const COLS = 3;
        let nextIndex = selectedIndex;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            nextIndex = selectedIndex + COLS;
            if (nextIndex >= suggestions.length) nextIndex = selectedIndex;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            nextIndex = selectedIndex - COLS;
            if (nextIndex < 0) nextIndex = selectedIndex;
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextIndex = Math.min(suggestions.length - 1, selectedIndex + 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            nextIndex = Math.max(0, selectedIndex - 1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // Enter = chọn gợi ý đang highlight (điền vào input)
            // Enter lần 2 (khi không có gợi ý hoặc tên đã chọn) = submit
            if (suggestions.length > 0 && name !== suggestions[selectedIndex]) {
                handlePick(suggestions[selectedIndex]);
            } else {
                handleSubmit();
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
            <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">

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
                            <div ref={listRef} className="grid grid-cols-3 gap-2">
                                {suggestions.map((sug, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handlePick(sug)}
                                        className={`p-2.5 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer
                                            ${index === selectedIndex
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200'
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
                        onClick={handleSubmit}
                        disabled={!name.trim()}
                        size="lg"
                        className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-lg"
                    >
                        Thêm Vào Queue
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default GuestNameModal;

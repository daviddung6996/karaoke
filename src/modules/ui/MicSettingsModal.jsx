import { useEffect, useRef, useState } from 'react';
import { X, Mic, RefreshCcw, Info, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { useAppStore } from '../core/store';

const FREQ_BANDS = {
    LOW: [20, 150],
    MID: [150, 3400],
    HIGH: [3400, 8000]
};

const MicSettingsModal = () => {
    const {
        showMicSettingsModal, setShowMicSettingsModal,
        micSensitivity, setMicSensitivity,
        micDelay, setMicDelay,
        micMinVol, setMicMinVol,
        // Advanced
        micBassFilter, setMicBassFilter,
        micTransient, setMicTransient,
        micAdaptation, setMicAdaptation
    } = useAppStore();

    const canvasRef = useRef(null);
    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const streamRef = useRef(null);
    const animationRef = useRef(null);

    // Local state for detected trigger
    const [isTriggered, setIsTriggered] = useState(false);
    const triggeredTimer = useRef(null);

    // Collapsible state
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Start/Stop Mic Visualization
    useEffect(() => {
        if (!showMicSettingsModal) {
            cleanup();
            return;
        }

        const startMic = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });
                streamRef.current = stream;

                const audioCtx = new AudioContext();
                audioCtxRef.current = audioCtx;
                await audioCtx.resume();

                const source = audioCtx.createMediaStreamSource(stream);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 2048;
                analyser.smoothingTimeConstant = 0.5;
                source.connect(analyser);
                analyserRef.current = analyser;

                draw();
            } catch (err) {
                console.error("Mic access failed for settings:", err);
            }
        };

        startMic();

        return () => cleanup();
    }, [showMicSettingsModal]);

    const cleanup = () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (audioCtxRef.current) audioCtxRef.current.close();
    };

    const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const analyser = analyserRef.current;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        analyser.getFloatFrequencyData(dataArray);

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Compute band levels
        const sampleRate = audioCtxRef.current.sampleRate;
        const getBinRange = ([lo, hi]) => [
            Math.floor(lo / (sampleRate / analyser.fftSize)),
            Math.ceil(hi / (sampleRate / analyser.fftSize))
        ];

        const [lowLo, lowHi] = getBinRange(FREQ_BANDS.LOW);
        const [midLo, midHi] = getBinRange(FREQ_BANDS.MID);
        const [highLo, highHi] = getBinRange(FREQ_BANDS.HIGH);

        const getBandDb = (lo, hi) => {
            let sum = 0;
            let count = 0;
            for (let i = lo; i <= hi; i++) {
                sum += Math.pow(10, dataArray[i] / 10);
                count++;
            }
            return count > 0 ? 10 * Math.log10(sum / count) : -100;
        };

        const lowDb = getBandDb(lowLo, lowHi);
        const midDb = getBandDb(midLo, midHi);
        const highDb = getBandDb(highLo, highHi);

        // Normalize for display (-100dB to -30dB range approx)
        const normalize = (db) => Math.min(1, Math.max(0, (db - micMinVol) / (Math.abs(micMinVol))));

        const bars = [
            { label: 'BASS', value: normalize(lowDb), color: '#3b82f6' }, // blue
            { label: 'MID (VOICE)', value: normalize(midDb), color: '#8b5cf6' }, // violet
            { label: 'TREBLE', value: normalize(highDb), color: '#10b981' }, // green
        ];

        // Draw bars
        const barWidth = width / 3;
        bars.forEach((bar, i) => {
            const x = i * barWidth;
            const barHeight = bar.value * height;
            const y = height - barHeight;

            // Gradient
            const gradient = ctx.createLinearGradient(0, height, 0, y);
            gradient.addColorStop(0, bar.color + '40'); // Transparent bottom
            gradient.addColorStop(1, bar.color);

            ctx.fillStyle = gradient;
            ctx.fillRect(x + 10, y, barWidth - 20, barHeight);

            // Cap
            ctx.fillStyle = bar.color;
            ctx.fillRect(x + 10, y - 2, barWidth - 20, 2);

            // Label
            ctx.fillStyle = '#64748b';
            ctx.font = '10px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(bar.label, x + barWidth / 2, height - 5);
        });


        // Fake "Trigger" check for visual feedback (simplified version of real logic)
        const relativeLift = midDb - lowDb;
        const thresholdDb = Math.max(2, 12 - micSensitivity);

        // Simple logic check for visualization only
        // Must match core logic: midDelta > threshold AND midVsLow > micBassFilter
        // but here we just check relativeLift vs bassFilter and mid abs level for UX
        if (relativeLift > micBassFilter && midDb > (lowDb + thresholdDb) && midDb > -60) {
            setIsTriggered(true);
            if (triggeredTimer.current) clearTimeout(triggeredTimer.current);
            triggeredTimer.current = setTimeout(() => setIsTriggered(false), 200);
        }

        animationRef.current = requestAnimationFrame(draw);
    };

    if (!showMicSettingsModal) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col transition-all duration-300 ${showAdvanced ? 'h-[90vh]' : 'h-auto'}`}>

                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-full transition-colors duration-300 ${isTriggered ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            <Mic size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800">Cấu hình Micro</h2>
                            <p className="text-xs text-slate-500 font-medium">Điều chỉnh độ nhạy để tự động phát</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowMicSettingsModal(false)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Visualizer */}
                <div className="relative bg-slate-900 h-48 w-full flex-shrink-0">
                    <canvas
                        ref={canvasRef}
                        width={500}
                        height={200}
                        className="w-full h-full block"
                    />
                    {/* Trigger Indicator Line (Approximate) */}
                    <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                        <div className={`px-2 py-1 rounded text-xs font-bold transition-all duration-200 ${isTriggered ? 'bg-green-500 text-white scale-110' : 'bg-slate-700 text-slate-400'}`}>
                            {isTriggered ? 'DETECTED' : 'LISTENING'}
                        </div>
                    </div>
                </div>

                {/* Controls - Scrollable if expanded */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                    {/* Sensitivity Slider */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                Độ Nhạy (Sensitivity)
                                <div className="group relative">
                                    <Info size={14} className="text-slate-400 cursor-help" />
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                        Độ nhạy càng cao thì micro càng dễ bắt giọng nói. Giảm nếu bị nhiễu.
                                    </div>
                                </div>
                            </label>
                            <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                {micSensitivity} / 10
                            </span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="0.5"
                            value={micSensitivity}
                            onChange={(e) => setMicSensitivity(parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                            <span>Khó bắt (Ồn)</span>
                            <span>Dễ bắt (Yên tĩnh)</span>
                        </div>
                    </div>

                    {/* Delay Slider */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                Thời gian xác nhận (Delay)
                                <div className="group relative">
                                    <Info size={14} className="text-slate-400 cursor-help" />
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                        Thời gian cần duy trì giọng nói để xác nhận. Tăng lên nếu bị bắt nhầm tiếng ho.
                                    </div>
                                </div>
                            </label>
                            <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                {micDelay}s
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0.2"
                            max="2.0"
                            step="0.1"
                            value={micDelay}
                            onChange={(e) => setMicDelay(parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                            <span>Nhanh (0.2s)</span>
                            <span>Chậm (2.0s)</span>
                        </div>
                    </div>

                    {/* Advanced Toggle */}
                    <div className="pt-2">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 uppercase tracking-widest transition-colors w-full justify-center py-2 border-t border-slate-100"
                        >
                            <Settings size={14} />
                            Cài đặt nâng cao (Advanced)
                            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {/* Advanced Controls */}
                        {showAdvanced && (
                            <div className="pt-4 space-y-6 animate-in slide-in-from-top-2 duration-300">

                                {/* Bass Filter */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                            Lọc Bass (Bass Filter)
                                            <div className="group relative">
                                                <Info size={14} className="text-slate-400 cursor-help" />
                                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                    Độ chênh lệch bắt buộc giữa giọng (Mid) và nền (Bass). Tăng cao để lọc tiếng ù/bass.
                                                </div>
                                            </div>
                                        </label>
                                        <span className="text-sm font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                            {micBassFilter} dB
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10"
                                        step="0.5"
                                        value={micBassFilter}
                                        onChange={(e) => setMicBassFilter(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                                        <span>Ít lọc</span>
                                        <span>Lọc mạnh</span>
                                    </div>
                                </div>

                                {/* Transient Tolerance */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                            Chống Gai (Transient)
                                            <div className="group relative">
                                                <Info size={14} className="text-slate-400 cursor-help" />
                                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                    Ngưỡng bỏ qua các tiếng động lớn đột ngột (gõ mic, vỗ tay).
                                                </div>
                                            </div>
                                        </label>
                                        <span className="text-sm font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                            {micTransient}x
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.5"
                                        max="5.0"
                                        step="0.1"
                                        value={micTransient}
                                        onChange={(e) => setMicTransient(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                                        <span>Nhạy cảm</span>
                                        <span>Bỏ qua nhiều</span>
                                    </div>
                                </div>

                                {/* Adaptation Speed */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                            Học Môi Trường (Adaptation)
                                            <div className="group relative">
                                                <Info size={14} className="text-slate-400 cursor-help" />
                                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                    Tốc độ micro làm quen với tiếng ồn nền mới.
                                                </div>
                                            </div>
                                        </label>
                                        <span className="text-sm font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                            {micAdaptation}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.005"
                                        max="0.1"
                                        step="0.005"
                                        value={micAdaptation}
                                        onChange={(e) => setMicAdaptation(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                                        <span>Chậm (Ổn định)</span>
                                        <span>Nhanh (Thích ứng tốt)</span>
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                        <button
                            onClick={() => {
                                setMicSensitivity(6);
                                setMicDelay(0.8);
                                setMicBassFilter(2);
                                setMicTransient(2.5);
                                setMicAdaptation(0.02);
                            }}
                            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                        >
                            <RefreshCcw size={14} />
                            Khôi phục mặc định
                        </button>

                        <button
                            onClick={() => setShowMicSettingsModal(false)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg shadow-indigo-200 transition-all active:scale-95"
                        >
                            Xong
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MicSettingsModal;

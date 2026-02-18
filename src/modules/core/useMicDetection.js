import { useCallback, useRef } from 'react';
import { useAppStore } from './store';

const MAX_WAIT_MS = 45000;
const WARMUP_MS = 5000;           // 5s warmup (guest walks to stage) — also collects noise floor
const ANALYSIS_INTERVAL_MS = 50;  // Fixed 50ms interval (not requestAnimationFrame which throttles)

// ── Multi-band detection config ──
// Laptop mic 3m from amli speakers in bar/club environment.
// Signal path: karaoke mic → amplifier → loud speakers → laptop mic
// Must ignore: TTS bleed, ambient bar noise, background music, crowd chatter.
// Must detect: guest voice through karaoke mic (causes mid-band lift relative to baseline).

// 3 frequency bands for spectral analysis
const BAND_LOW = [20, 150];       // Bass / kicks / subwoofer rumble
const BAND_MID = [150, 3400];     // Voice presence (fundamentals + harmonics)
const BAND_HIGH = [3400, 8000];   // Sibilance / cymbals / brightness

// Detection thresholds (in dB above baseline)
const MID_DELTA_TRIGGER_DB = 6;       // Mid-band must rise 6dB above baseline (relaxed from 8)
const MID_VS_LOW_DELTA_DB = 2;        // Mid delta must exceed low delta by 2dB (relaxed from 3)
const SUSTAINED_MS = 800;             // Must sustain for 0.8s to confirm (relaxed from 1.2s)
const SPIKE_RMS_MULTIPLIER = 2.5;     // RMS spike: 2.5x baseline RMS for instant detect (relaxed from 3.5)
const SPIKE_CONFIRM_FRAMES = 3;       // Must hold spike for 3 frames (150ms) (relaxed from 5)

// Rolling baseline config
const BASELINE_EMA_ALPHA = 0.02;      // Slow EMA update for baseline (adapts over ~2.5s)
const BASELINE_FREEZE_ON_CANDIDATE = true; // Don't update baseline when candidate vocal detected

export const useMicDetection = () => {
    const streamRef = useRef(null);
    const audioCtxRef = useRef(null);
    const intervalRef = useRef(null);

    const cleanup = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (audioCtxRef.current) {
            try { audioCtxRef.current.close(); } catch (e) { }
            audioCtxRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    }, []);

    /**
     * Wait for mic activity using multi-band delta detection.
     * Collects noise floor during warmup (10s while guest walks to stage),
     * then detects mid-band lift relative to rolling baseline.
     *
     * @param {AbortSignal} signal
     * @param {(secondsLeft: number) => void} onTick
     * @param {(level: 'weak'|'medium') => void} onMicAttempt
     * @returns {Promise<'mic'|'timeout'|'abort'>}
     */
    const waitForPresence = useCallback((signal, onTick, onMicAttempt) => {
        return new Promise(async (resolve) => {
            if (signal?.aborted) { resolve('abort'); return; }

            let resolved = false;
            let lastAttemptTime = 0;
            let activeElapsed = 0;
            let lastTickTime = Date.now();

            const tickInterval = setInterval(() => {
                const now = Date.now();
                const isPaused = useAppStore?.getState?.()?.countdownPaused || false;
                if (!isPaused) {
                    activeElapsed += (now - lastTickTime);
                }
                lastTickTime = now;
                const secondsLeft = Math.max(0, Math.ceil((MAX_WAIT_MS - activeElapsed) / 1000));
                if (onTick) onTick(secondsLeft);
                if (activeElapsed >= MAX_WAIT_MS) done('timeout');
            }, 1000);

            const done = (reason) => {
                if (resolved) return;
                resolved = true;
                clearInterval(tickInterval);
                cleanup();
                resolve(reason);
            };

            if (signal) {
                signal.addEventListener('abort', () => done('abort'), { once: true });
            }

            if (onTick) onTick(Math.ceil(MAX_WAIT_MS / 1000));

            try {
                // ── Disable browser DSP to get raw signal ──
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        channelCount: 1,
                    },
                });
                streamRef.current = stream;
                if (resolved) { cleanup(); return; }

                const audioCtx = new AudioContext();
                audioCtxRef.current = audioCtx;
                if (audioCtx.state === 'suspended') {
                    await audioCtx.resume();
                }
                const source = audioCtx.createMediaStreamSource(stream);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 2048;
                analyser.smoothingTimeConstant = 0.3; // Lower smoothing for faster response
                source.connect(analyser);

                const sampleRate = audioCtx.sampleRate;
                const binCount = analyser.frequencyBinCount;
                const freqPerBin = sampleRate / analyser.fftSize;

                // ── Compute bin ranges for each band ──
                const getBinRange = ([lo, hi]) => [
                    Math.max(0, Math.floor(lo / freqPerBin)),
                    Math.min(binCount - 1, Math.ceil(hi / freqPerBin)),
                ];
                const [lowBinLo, lowBinHi] = getBinRange(BAND_LOW);
                const [midBinLo, midBinHi] = getBinRange(BAND_MID);
                const [highBinLo, highBinHi] = getBinRange(BAND_HIGH);

                const freqData = new Float32Array(binCount); // dB values
                const timeData = new Float32Array(analyser.fftSize);

                // ── State ──
                let baselineLow = null;   // EMA baseline for low band (dB)
                let baselineMid = null;   // EMA baseline for mid band (dB)
                let baselineRms = null;   // EMA baseline for time-domain RMS
                let warmupSamples = 0;
                let voiceAboveSince = null;
                let spikeFrames = 0;
                let isCandidate = false;  // True when partial detection in progress

                // ── Helper: compute band RMS in dB ──
                const bandRmsDb = (binLo, binHi) => {
                    let sum = 0;
                    let count = 0;
                    for (let i = binLo; i <= binHi; i++) {
                        // freqData is in dB, convert to linear power, average, then back to dB
                        const linearPower = Math.pow(10, freqData[i] / 10);
                        sum += linearPower;
                        count++;
                    }
                    if (count === 0) return -100;
                    return 10 * Math.log10(sum / count);
                };

                // ── Helper: compute time-domain RMS ──
                const computeRms = () => {
                    let sum = 0;
                    for (let i = 0; i < timeData.length; i++) {
                        sum += timeData[i] * timeData[i];
                    }
                    return Math.sqrt(sum / timeData.length);
                };

                // ── Main analysis loop (fixed interval, not rAF) ──
                const check = () => {
                    if (resolved) return;
                    if (signal?.aborted) { done('abort'); return; }

                    // ── Read audio data ──
                    analyser.getFloatFrequencyData(freqData);   // dB per bin
                    analyser.getFloatTimeDomainData(timeData);

                    const lowDb = bandRmsDb(lowBinLo, lowBinHi);
                    const midDb = bandRmsDb(midBinLo, midBinHi);
                    const rms = computeRms();

                    // ── WARMUP phase: collect noise floor (guest walking to stage) ──
                    // Skip first 2s (TTS echo still ringing), then collect from 2s-10s
                    if (activeElapsed < WARMUP_MS) {
                        if (activeElapsed >= 2000) {
                            warmupSamples++;
                            if (baselineLow === null) {
                                baselineLow = lowDb;
                                baselineMid = midDb;
                                baselineRms = rms;
                            } else {
                                // Fast EMA during warmup (converge quickly)
                                const alpha = 0.1;
                                baselineLow = baselineLow * (1 - alpha) + lowDb * alpha;
                                baselineMid = baselineMid * (1 - alpha) + midDb * alpha;
                                baselineRms = baselineRms * (1 - alpha) + rms * alpha;
                            }
                        }
                        return;
                    }

                    // If no warmup samples collected (edge case), use current as baseline
                    if (baselineMid === null) {
                        baselineLow = lowDb;
                        baselineMid = midDb;
                        baselineRms = rms;
                        return;
                    }

                    // ── Active detection phase ──
                    const midDelta = midDb - baselineMid;      // How much mid-band rose vs baseline
                    const lowDelta = lowDb - baselineLow;      // How much low-band rose vs baseline
                    const midVsLowDelta = midDelta - lowDelta; // Mid rose MORE than low? → voice signal
                    const rmsRatio = baselineRms > 0.0001 ? rms / baselineRms : 0;

                    // ── Dynamic Settings from Store ──
                    const {
                        micSensitivity, micDelay,
                        micBassFilter, micTransient, micAdaptation
                    } = useAppStore.getState();

                    // Map sensitivity (1-10) to Threshold dB
                    // 1 (Hard) -> 11dB
                    // 6 (Default) -> 6dB
                    // 10 (Easy) -> 2dB
                    const dynamicTriggerDb = Math.max(2, 12 - micSensitivity);

                    // Map delay (seconds) to ms
                    const dynamicSustainMs = micDelay * 1000;


                    // ── 1. RMS spike detection (mic tap, pop, switch-on) ──
                    if (rmsRatio > micTransient) {
                        spikeFrames++;
                        if (spikeFrames >= SPIKE_CONFIRM_FRAMES) {
                            done('mic');
                            return;
                        }
                    } else {
                        spikeFrames = Math.max(0, spikeFrames - 1); // Decay slowly (tolerate brief dips)
                    }

                    // ── 2. Sustained mid-band lift (voice through karaoke mic → amli → speakers) ──
                    // Condition: mid-band rose significantly AND mid rose more than bass
                    // This filters out: bass drops, general volume increase, crowd noise (broadband)
                    const isVoiceLift = midDelta > dynamicTriggerDb && midVsLowDelta > micBassFilter;

                    if (isVoiceLift) {
                        isCandidate = true;
                        if (!voiceAboveSince) {
                            voiceAboveSince = Date.now();
                        } else if (Date.now() - voiceAboveSince >= dynamicSustainMs) {
                            done('mic');
                            return;
                        }
                    } else {
                        if (voiceAboveSince && (Date.now() - voiceAboveSince < 300)) {
                            // Allow brief 300ms dips (natural speech gaps) without resetting
                        } else {
                            voiceAboveSince = null;
                            isCandidate = false;
                        }
                    }

                    // ── 3. Near-miss detection (feedback to UI) ──
                    if (onMicAttempt) {
                        const now = Date.now();
                        if (now - lastAttemptTime > 2000) {
                            // How close are we to triggering?
                            const midStrength = dynamicTriggerDb > 0 ? midDelta / dynamicTriggerDb : 0;
                            const spikeStrength = rmsRatio / micTransient;
                            const strength = Math.max(midStrength, spikeStrength);

                            if (strength > 0.5 && strength < 1.0) {
                                lastAttemptTime = now;
                                onMicAttempt('medium');
                            } else if (strength > 0.25 && strength < 0.5) {
                                lastAttemptTime = now;
                                onMicAttempt('weak');
                            }
                        }
                    }

                    // ── 4. Update rolling baseline (only when NOT in candidate state) ──
                    if (!isCandidate || !BASELINE_FREEZE_ON_CANDIDATE) {
                        baselineLow = baselineLow * (1 - micAdaptation) + lowDb * micAdaptation;
                        baselineMid = baselineMid * (1 - micAdaptation) + midDb * micAdaptation;
                        baselineRms = baselineRms * (1 - micAdaptation) + rms * micAdaptation;
                    }
                };

                // Use fixed interval instead of requestAnimationFrame
                // rAF throttles in background tabs; setInterval is consistent
                intervalRef.current = setInterval(check, ANALYSIS_INTERVAL_MS);
            } catch (err) {
                console.warn("Mic detection unavailable:", err.message);
            }
        });
    }, [cleanup]);

    return { waitForPresence, cancelDetection: cleanup };
};

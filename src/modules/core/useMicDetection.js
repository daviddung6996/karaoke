import { useCallback, useRef } from 'react';
import { useAppStore } from './store';

const MAX_WAIT_MS = 45000;

// ── Strict detection config ──
// Laptop mic 3m from amli speakers. Must ignore TTS bleed, ambient bar noise,
// background music, crowd chatter. Only trigger on karaoke mic → amli → loud output.
const SPIKE_THRESHOLD = 0.5;         // Lowered from 0.75
const SPIKE_CONFIRM_FRAMES = 4;      // Lowered from 6 (~60ms)
const VOICE_SUSTAINED_MS = 1500;     // Lowered from 2500ms
const RMS_JUMP_MULTIPLIER = 2.0;     // Lowered from 3.0
const SETTLE_MS = 3000;              // 3s settle - wait for TTS echo to fully die

// Voice frequency band (human voice ~85-1100 Hz)
const VOICE_FREQ_LOW = 85;
const VOICE_FREQ_HIGH = 1100;

// Adaptive noise floor
const NOISE_FLOOR_SAMPLES = 30;      // Collect 30 samples during settle to establish baseline

export const useMicDetection = () => {
    const streamRef = useRef(null);
    const audioCtxRef = useRef(null);

    const cleanup = useCallback(() => {
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
     * Wait for mic activity: tap, pop, switch-on, or sustained voice.
     * Uses adaptive noise floor to handle varying ambient environments.
     * @param {AbortSignal} signal
     * @param {(secondsLeft: number) => void} onTick
     * @param {(level: 'weak'|'medium') => void} onMicAttempt - fires when partial mic activity detected
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
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
                analyser.smoothingTimeConstant = 0.6; // Heavier smoothing
                source.connect(analyser);

                const sampleRate = audioCtx.sampleRate;
                const binCount = analyser.frequencyBinCount;
                const freqPerBin = sampleRate / analyser.fftSize;

                const voiceBinLow = Math.floor(VOICE_FREQ_LOW / freqPerBin);
                const voiceBinHigh = Math.min(Math.ceil(VOICE_FREQ_HIGH / freqPerBin), binCount - 1);
                const voiceBinRange = voiceBinHigh - voiceBinLow + 1;

                const timeData = new Float32Array(analyser.fftSize);
                const freqData = new Uint8Array(binCount);

                // ── Adaptive noise floor state ──
                const noiseFloorSamples = [];
                let noiseFloorPeak = 0;
                let noiseFloorVoiceRms = 0;
                let noiseEstablished = false;

                let voiceAboveSince = null;
                let settled = false;
                let debugCounter = 0;
                let spikeFrames = 0;
                let settleTime = 0; // Will be set after warmup

                const check = () => {
                    if (resolved) return;
                    if (signal?.aborted) { done('abort'); return; }

                    // WARMUP: Ignore first 10s (active time) to avoid handling noise from previous song/walking
                    if (activeElapsed < 10000) {
                        requestAnimationFrame(check);
                        return;
                    }

                    // Start settle timer once warmup is done
                    if (!settleTime) {
                        settleTime = Date.now() + SETTLE_MS;
                    }

                    // ── Time-domain: peak ──
                    analyser.getFloatTimeDomainData(timeData);
                    let peak = 0;
                    for (let i = 0; i < timeData.length; i++) {
                        const abs = Math.abs(timeData[i]);
                        if (abs > peak) peak = abs;
                    }

                    // ── Frequency-domain: voice-band RMS ──
                    analyser.getByteFrequencyData(freqData);
                    let sumAll = 0;
                    let sumVoice = 0;
                    for (let i = 0; i < binCount; i++) {
                        const val = (freqData[i] / 255) ** 2;
                        sumAll += val;
                        if (i >= voiceBinLow && i <= voiceBinHigh) {
                            sumVoice += val;
                        }
                    }
                    const rms = Math.sqrt(sumAll / binCount);
                    const voiceRms = Math.sqrt(sumVoice / voiceBinRange);
                    const voiceRatio = rms > 0.001 ? voiceRms / rms : 0;

                    // ── Settle phase: collect noise floor samples ──
                    if (!settled) {
                        if (Date.now() > settleTime) {
                            settled = true;
                            // Calculate noise floor from samples
                            if (noiseFloorSamples.length > 0) {
                                const peaks = noiseFloorSamples.map(s => s.peak).sort((a, b) => a - b);
                                const voiceRmses = noiseFloorSamples.map(s => s.voiceRms).sort((a, b) => a - b);
                                // Use 90th percentile as noise floor (ignore outliers)
                                const p90 = Math.floor(noiseFloorSamples.length * 0.9);
                                noiseFloorPeak = peaks[p90] || peaks[peaks.length - 1];
                                noiseFloorVoiceRms = voiceRmses[p90] || voiceRmses[voiceRmses.length - 1];
                                noiseEstablished = true;
                            }
                        } else {
                            // Collect samples every ~3 frames for variety
                            if (debugCounter % 3 === 0) {
                                noiseFloorSamples.push({ peak, voiceRms, rms });
                            }
                            debugCounter++;
                        }
                        requestAnimationFrame(check);
                        return;
                    }

                    // ── Active detection phase ──
                    debugCounter++;

                    // Dynamic thresholds based on noise floor
                    const effectiveSpike = Math.max(SPIKE_THRESHOLD, noiseFloorPeak * 2.5);
                    const effectiveVoiceThreshold = noiseEstablished
                        ? Math.max(noiseFloorVoiceRms * RMS_JUMP_MULTIPLIER, 0.15)
                        : 0.25;

                    // ── 1. Spike detection (loud sustained burst from amli) ──
                    if (peak > effectiveSpike) {
                        spikeFrames++;
                        if (spikeFrames >= SPIKE_CONFIRM_FRAMES) {
                            done('mic');
                            return;
                        }
                    } else {
                        spikeFrames = 0;
                    }

                    // ── 2. Sustained voice from karaoke mic → amli → laptop mic ──
                    // Voice-band energy must be significantly above noise floor AND
                    // voice ratio must be dominant (not just general loud noise)
                    if (voiceRms > effectiveVoiceThreshold && voiceRatio > 0.5) {
                        if (!voiceAboveSince) {
                            voiceAboveSince = Date.now();
                        } else if (Date.now() - voiceAboveSince >= VOICE_SUSTAINED_MS) {
                            done('mic');
                            return;
                        }
                    } else {
                        voiceAboveSince = null;
                    }

                    // ── 3. Near-miss detection: guest is trying but not loud enough ──
                    if (onMicAttempt && noiseEstablished) {
                        const now = Date.now();
                        if (now - lastAttemptTime > 2000) {
                            const peakRatio = peak / effectiveSpike;
                            const voiceRatio2 = voiceRms / effectiveVoiceThreshold;
                            const strength = Math.max(peakRatio, voiceRatio2);

                            if (strength > 0.5 && strength < 1.0) {
                                lastAttemptTime = now;
                                onMicAttempt('medium');
                            } else if (strength > 0.2 && strength < 0.5) {
                                lastAttemptTime = now;
                                onMicAttempt('weak');
                            }
                        }
                    }

                    requestAnimationFrame(check);
                };

                check();
            } catch (err) {
                console.warn("Mic detection unavailable:", err.message);
            }
        });
    }, [cleanup]);

    return { waitForPresence, cancelDetection: cleanup };
};

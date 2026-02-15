import { useCallback, useRef } from 'react';

const MAX_WAIT_MS = 30000;

// Detection config - bar environment, mic ~3m from laptop
const SPIKE_THRESHOLD = 0.30;   // Deliberate mic tap/pop from 3m
const VOICE_THRESHOLD = 0.12;   // Clear "alo" into mic from 3m
const VOICE_SUSTAINED_MS = 1000; // Must persist 1s
const RMS_JUMP_THRESHOLD = 0.10; // Deliberate sound change
const RMS_MIN_AFTER_JUMP = 0.08; // Above bar ambient floor

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
     * Also provides a countdown callback for UI.
     * @param {AbortSignal} signal
     * @param {(secondsLeft: number) => void} onTick - Called every second with remaining time
     * @returns {Promise<'mic'|'timeout'|'abort'>}
     */
    const waitForPresence = useCallback((signal, onTick) => {
        return new Promise(async (resolve) => {
            if (signal?.aborted) { resolve('abort'); return; }

            let resolved = false;
            const startTime = Date.now();

            // Countdown ticker
            const tickInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const secondsLeft = Math.max(0, Math.ceil((MAX_WAIT_MS - elapsed) / 1000));
                if (onTick) onTick(secondsLeft);
            }, 1000);

            const timeoutId = setTimeout(() => done('timeout'), MAX_WAIT_MS);

            const done = (reason) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeoutId);
                clearInterval(tickInterval);
                cleanup();
                resolve(reason);
            };

            if (signal) {
                signal.addEventListener('abort', () => done('abort'), { once: true });
            }

            // Fire initial tick
            if (onTick) onTick(Math.ceil(MAX_WAIT_MS / 1000));

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
                if (resolved) { cleanup(); return; }

                const audioCtx = new AudioContext();
                audioCtxRef.current = audioCtx;
                // CRITICAL: AudioContext may be suspended without user gesture
                if (audioCtx.state === 'suspended') {
                    console.log('[Mic] AudioContext suspended, resuming...');
                    await audioCtx.resume();
                }
                console.log('[Mic] AudioContext state:', audioCtx.state, '| Stream active:', stream.active);
                const source = audioCtx.createMediaStreamSource(stream);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 1024;
                analyser.smoothingTimeConstant = 0.3;
                source.connect(analyser);

                const timeData = new Float32Array(analyser.fftSize);
                const freqData = new Uint8Array(analyser.frequencyBinCount);
                let voiceAboveSince = null;
                let prevRms = 0;
                let settled = false;
                let debugCounter = 0;
                const settleTime = Date.now() + 500; // 500ms settle

                const check = () => {
                    if (resolved) return;

                    analyser.getFloatTimeDomainData(timeData);
                    let peak = 0;
                    for (let i = 0; i < timeData.length; i++) {
                        const abs = Math.abs(timeData[i]);
                        if (abs > peak) peak = abs;
                    }

                    analyser.getByteFrequencyData(freqData);
                    let sum = 0;
                    for (let i = 0; i < freqData.length; i++) {
                        sum += (freqData[i] / 255) ** 2;
                    }
                    const rms = Math.sqrt(sum / freqData.length);

                    if (!settled) {
                        if (Date.now() > settleTime) settled = true;
                        prevRms = rms;
                        requestAnimationFrame(check);
                        return;
                    }

                    // Debug: log levels every ~60 frames (~1s)
                    debugCounter++;
                    if (debugCounter % 60 === 0) {
                        console.log(`[Mic] peak=${peak.toFixed(3)} rms=${rms.toFixed(3)} prevRms=${prevRms.toFixed(3)}`);
                    }

                    // 1. Spike detection
                    if (peak > SPIKE_THRESHOLD) {
                        console.log("Mic detection: SPIKE detected! Peak:", peak.toFixed(3));
                        done('mic');
                        return;
                    }

                    // 2. Sudden RMS jump
                    const rmsJump = rms - prevRms;
                    if (rmsJump > RMS_JUMP_THRESHOLD && rms > RMS_MIN_AFTER_JUMP) {
                        console.log("Mic detection: RMS JUMP detected!", prevRms.toFixed(3), "->", rms.toFixed(3));
                        done('mic');
                        return;
                    }

                    // 3. Sustained voice
                    if (rms > VOICE_THRESHOLD) {
                        if (!voiceAboveSince) {
                            voiceAboveSince = Date.now();
                        } else if (Date.now() - voiceAboveSince >= VOICE_SUSTAINED_MS) {
                            console.log("Mic detection: sustained voice! RMS:", rms.toFixed(3));
                            done('mic');
                            return;
                        }
                    } else {
                        voiceAboveSince = null;
                    }

                    prevRms = rms * 0.3 + prevRms * 0.7;
                    requestAnimationFrame(check);
                };

                check();
            } catch (err) {
                console.warn("Mic detection unavailable:", err.message);
                // No mic → will just wait for timeout
            }
        });
    }, [cleanup]);

    return { waitForPresence, cancelDetection: cleanup };
};

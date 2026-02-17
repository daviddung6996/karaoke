import { useState, useRef, useEffect, useCallback } from 'react';
import Input from '../ui/Input';
import { Search, Plus, Music, Sparkles, ExternalLink, Link, Mic } from 'lucide-react';
import { useAppStore } from '../core/store';
import { searchVideos } from '../core/videoSearch';
import { useSuggestions } from './useSuggestions';
import SuggestDropdown from './SuggestDropdown';
import GuestNameModal from './GuestNameModal';

import { cleanYoutubeTitle } from '../../utils/titleUtils';

// Extract YouTube video ID from various URL formats
function extractYoutubeId(text) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/ // Raw video ID
    ];
    for (const pattern of patterns) {
        const match = text.trim().match(pattern);
        if (match) return match[1];
    }
    return null;
}

const SearchBar = ({ isExpanded = false }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState(null);

    // Voice Search State
    const [isListening, setIsListening] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState(''); // 'listening' | 'processing' | ''
    const [voiceError, setVoiceError] = useState('');
    const [interimText, setInterimText] = useState(''); // Real-time preview
    const recognitionRef = useRef(null);
    // Gemini fallback refs (only used when Web Speech API unavailable)
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const maxTimerRef = useRef(null);
    const useGeminiFallback = useRef(!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window));

    const { suggestions, isLoading: isSuggesting } = useSuggestions(query, isFocused);
    const { addToQueue, updateQueueItem, queueMode } = useAppStore();

    const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;

    // Transcribe audio via Gemini API
    const transcribeWithGemini = async (audioBlob) => {
        const buffer = await audioBlob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                inlineData: {
                                    mimeType: audioBlob.type || 'audio/webm',
                                    data: base64
                                }
                            },
                            { text: 'Transcribe this Vietnamese audio. Return ONLY the spoken text, nothing else. If no speech is detected, return empty string.' }
                        ]
                    }],
                    generationConfig: {
                        max_output_tokens: 200,
                        temperature: 0.1,
                        thinkingConfig: { thinkingBudget: 0 }
                    }
                })
            }
        );

        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    };

    // === Web Speech API (FREE - primary method) ===
    const startWebSpeech = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognitionRef.current = recognition;
        let gotFinalResult = false;
        let gotError = false;

        setIsListening(true);
        setVoiceStatus('listening');
        setVoiceError('');
        setInterimText('');

        recognition.onresult = (event) => {
            let finalText = '';
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalText += transcript;
                } else {
                    interim += transcript;
                }
            }

            if (finalText) {
                gotFinalResult = true;
                setInterimText('');
                setQuery(finalText);
                handleSearch(finalText);
                setIsListening(false);
                setVoiceStatus('');
            } else {
                setInterimText(interim);
            }
        };

        recognition.onerror = (event) => {
            gotError = true;
            console.error('[Voice] Web Speech error:', event.error);
            if (event.error === 'no-speech') {
                setVoiceError('Không nghe thấy giọng nói, thử lại nhé');
            } else if (event.error === 'not-allowed') {
                setVoiceError('Không thể truy cập microphone');
            } else {
                setVoiceError('Lỗi nhận dạng giọng nói');
            }
            setTimeout(() => {
                setIsListening(false);
                setVoiceStatus('');
                setInterimText('');
            }, 1500);
        };

        recognition.onend = () => {
            // If ended without final result or error (e.g., silence timeout)
            if (!gotFinalResult && !gotError) {
                setIsListening(false);
                setVoiceStatus('');
                setInterimText('');
            }
        };

        recognition.start();
    }, []);

    // === Gemini fallback (only for browsers without Web Speech API) ===
    const startGeminiFallback = useCallback(async () => {
        if (!GEMINI_KEY) return;

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
        clearTimeout(maxTimerRef.current);

        setIsListening(true);
        setVoiceStatus('listening');
        setVoiceError('');
        chunksRef.current = [];

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                streamRef.current = null;

                if (chunksRef.current.length === 0) {
                    setIsListening(false);
                    setVoiceStatus('');
                    return;
                }

                setVoiceStatus('processing');
                try {
                    const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
                    const text = await transcribeWithGemini(blob);
                    if (text) {
                        setQuery(text);
                        handleSearch(text);
                    } else {
                        setVoiceError('Không nghe thấy giọng nói, thử lại nhé');
                        await new Promise(r => setTimeout(r, 1500));
                    }
                } catch (err) {
                    console.error('[Voice] Gemini transcribe failed:', err);
                    setVoiceError('Lỗi nhận dạng giọng nói');
                    await new Promise(r => setTimeout(r, 1500));
                } finally {
                    setIsListening(false);
                    setVoiceStatus('');
                }
            };

            recorder.start();
            maxTimerRef.current = setTimeout(() => stopVoiceSearch(), 10000);
        } catch (err) {
            console.error('[Voice] Mic access failed:', err);
            setVoiceError('Không thể truy cập microphone');
            setTimeout(() => {
                setIsListening(false);
                setVoiceStatus('');
            }, 1500);
        }
    }, [GEMINI_KEY]);

    const startVoiceSearch = useCallback(() => {
        if (useGeminiFallback.current) {
            startGeminiFallback();
        } else {
            startWebSpeech();
        }
    }, [startWebSpeech, startGeminiFallback]);

    const stopVoiceSearch = useCallback(() => {
        // Stop Web Speech API
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        // Stop Gemini fallback
        clearTimeout(maxTimerRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) recognitionRef.current.abort();
            clearTimeout(maxTimerRef.current);
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const handleSearch = async (searchQuery) => {
        const q = searchQuery || query;
        if (!q.trim()) return;

        if (searchQuery) setQuery(searchQuery);

        setIsFocused(false);
        setSelectedIndex(-1);
        setIsSearching(true);

        try {
            // Check if input is a YouTube URL
            const videoId = extractYoutubeId(q);
            if (videoId) {
                const res = await fetch(`/api/yt/video?id=${encodeURIComponent(videoId)}`);
                if (res.ok) {
                    const video = await res.json();
                    setResults([video]);
                } else {
                    setResults([]);
                }
            } else {
                const videos = await searchVideos(q);
                setResults(videos);
            }
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > -1 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                handleSearch(suggestions[selectedIndex].query);
            } else {
                handleSearch();
            }
        }
    };

    // Step 1: User clicks add -> Open Modal
    const handleAddClick = (track) => {
        if (!track || !track.title) return;
        setSelectedTrack(track);
        setShowModal(true);
    };

    // Step 2: User confirms name -> Add to Queue
    const handleConfirmAdd = async (guestName, isPriority = false) => {
        if (!selectedTrack) return;

        const rawTitle = selectedTrack.title;
        const rawArtist = selectedTrack.artist;

        // Determine Clean Title for TTS
        let displayTitle = rawTitle;
        if (selectedTrack.source === 'local') {
            displayTitle = selectedTrack.title;
        } else {
            displayTitle = cleanYoutubeTitle(rawTitle);
        }

        // 1. Push to Firebase FIRST (priority for sync)
        let firebaseKey = null;
        try {
            const { pushToFirebaseQueue } = await import('../../services/firebaseQueueService');
            const result = await pushToFirebaseQueue({
                videoId: selectedTrack.videoId,
                title: rawTitle,
                cleanTitle: displayTitle,
                artist: rawArtist,
                addedBy: guestName,
                thumbnail: selectedTrack.thumbnail,
                isPriority: isPriority
            });
            firebaseKey = result?.key; // Get Firebase key
        } catch (err) {
            console.warn('Firebase push failed, will add locally:', err);
            // If Firebase fails, use timestamp as fallback
            firebaseKey = Date.now().toString();
        }

        // 2. Add to local queue with Firebase key
        // NOTE: Do NOT call addToQueue here if Firebase succeeded!
        // useFirebaseSync will pick it up from Firebase listener
        if (firebaseKey && firebaseKey !== Date.now().toString()) {
            // Firebase key means it came from Firebase, wait for sync
        } else {
            // Only add locally if Firebase failed (fallback mode)
            addToQueue({
                id: firebaseKey,
                firebaseKey: null, // Local-only, no Firebase key
                videoId: selectedTrack.videoId,
                title: rawTitle,
                cleanTitle: displayTitle,
                artist: rawArtist,
                addedBy: guestName,
                thumbnail: selectedTrack.thumbnail,
            });
        }

        setShowModal(false);
        setSelectedTrack(null);

        // 3. Analytics / History
        import('../../services/smartSuggestionService').then(({ recordPlay, cacheYoutubeId }) => {
            recordPlay(rawTitle, rawArtist);
            if (selectedTrack.videoId) {
                cacheYoutubeId(rawTitle, rawArtist, selectedTrack.videoId);
            }
        });

        // 4. Background: Clean Title via Gemini
        import('../core/geminiService').then(({ cleanSongTitle }) => {
            cleanSongTitle(rawTitle).then(cleaned => {
                if (cleaned && firebaseKey) {
                    // Update Firebase if we have a key
                    if (firebaseKey && firebaseKey !== Date.now().toString()) {
                        import('firebase/database').then(({ ref, update, getDatabase }) => {
                            const db = getDatabase();
                            const itemRef = ref(db, `queue/${firebaseKey}`);
                            update(itemRef, {
                                cleanTitle: cleaned.title,
                                cleanArtist: cleaned.artist
                            }).catch(() => { });
                        });
                    } else {
                        // Local-only fallback
                        updateQueueItem(firebaseKey, {
                            cleanTitle: cleaned.title,
                            cleanArtist: cleaned.artist
                        });
                    }
                }
            });
        });
    };

    // Scroll to top when results change
    const resultsContainerRef = useRef(null);

    useEffect(() => {
        if (resultsContainerRef.current) {
            resultsContainerRef.current.scrollTop = 0;
        }
    }, [results]);

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            {/* Search Header — compact */}
            <div className="p-2 bg-white border-b border-slate-100 sticky top-0 z-30">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <Input
                        placeholder="Tìm bài hát..."
                        className="pl-8 pr-10 h-9 text-sm font-bold rounded-lg border-slate-200 focus:border-indigo-500 focus:ring-indigo-100 block w-full bg-slate-50 text-slate-800 placeholder:text-slate-300 transition-all"
                        value={query}
                        onChange={(e) => {
                            const val = e.target.value;
                            setQuery(val);
                            setSelectedIndex(-1);
                            if (!isFocused) setIsFocused(true);
                            // Auto-search if YouTube URL is pasted
                            if (extractYoutubeId(val)) {
                                handleSearch(val);
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    />

                    {/* Voice Search / Loading indicator */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                        {isSearching ? (
                            <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                        ) : (
                            <button
                                type="button"
                                onClick={isListening ? stopVoiceSearch : startVoiceSearch}
                                className={`p-1 rounded-full transition-all cursor-pointer ${isListening
                                    ? 'text-red-500 bg-red-50 animate-pulse'
                                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                }`}
                                title={isListening ? 'Đang nghe...' : 'Tìm bằng giọng nói'}
                            >
                                <Mic size={16} strokeWidth={2.5} />
                            </button>
                        )}
                    </div>

                    {/* Smart Suggestion Dropdown */}
                    {isFocused && (query.trim().length >= 2) && (
                        <SuggestDropdown
                            suggestions={suggestions}
                            isLoading={isSuggesting}
                            onSelect={handleSearch}
                            selectedIndex={selectedIndex}
                        />
                    )}
                </div>

                {/* Quick Tags — scrollable, compact */}
                <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5 scrollbar-hide">
                    {['Tone Nam', 'Tone Nữ', 'Song Ca', 'Remix'].map(tag => (
                        <button
                            key={tag}
                            onClick={() => {
                                if (!query.toLowerCase().includes(tag.toLowerCase())) {
                                    const newQuery = (query + ' ' + tag).trim();
                                    setQuery(newQuery);
                                    handleSearch(newQuery);
                                }
                            }}
                            className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-full text-[10px] font-bold transition-all whitespace-nowrap border border-slate-200 hover:border-indigo-200 cursor-pointer active:scale-95"
                        >
                            + {tag}
                        </button>
                    ))}
                    {/* YouTube Fallback Search Button */}
                    <button
                        onClick={() => {
                            const searchQ = query.trim() || 'karaoke';
                            window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchQ + ' karaoke')}`, '_blank', 'noopener');
                        }}
                        className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 flex items-center gap-1"
                    >
                        <ExternalLink size={10} />
                        YouTube
                    </button>
                </div>
            </div>

            {/* Results Area */}
            <div
                ref={resultsContainerRef}
                className="flex-1 overflow-y-auto p-1.5 custom-scrollbar"
            >
                {!isSearching && results.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-3">
                        <Music size={48} strokeWidth={1} />
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                            {query.trim() ? 'Không tìm thấy kết quả' : 'Nhập tên để tìm kiếm'}
                        </p>
                        {query.trim() && (
                            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                                <Link size={12} />
                                Bấm <span className="text-red-500 font-bold">YouTube</span> → sao chép link → dán vào ô tìm kiếm
                            </p>
                        )}
                    </div>
                )}

                <div className={`gap-2 pb-16 ${isExpanded ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-max' : 'flex flex-col'}`}>
                    {results.map((result) => (
                        <div
                            key={result.id || result.videoId}
                            className={`flex ${isExpanded ? 'flex-col p-3 gap-3' : 'flex-row items-center p-1.5 gap-2'} bg-white hover:bg-indigo-50 rounded-lg cursor-pointer group transition-all border border-transparent hover:border-indigo-100 active:scale-[0.98] shadow-sm hover:shadow-md h-full`}
                            onClick={() => handleAddClick(result)}
                        >
                            {/* Thumbnail */}
                            <div className={`relative ${isExpanded ? 'w-full aspect-video rounded-lg' : 'w-14 h-10 rounded-md'} overflow-hidden bg-slate-200 flex-shrink-0`}>
                                <img src={result.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                                {result.duration && (
                                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-bold px-1 py-0.5 rounded backdrop-blur-sm">
                                        {result.duration}
                                    </span>
                                )}
                            </div>

                            {/* Info */}
                            <div className={`flex-1 min-w-0 flex flex-col ${isExpanded ? 'justify-between gap-1' : ''}`}>
                                <div>
                                    <h4
                                        className={`font-bold text-slate-800 leading-snug group-hover:text-indigo-700 transition-colors ${isExpanded ? 'text-base line-clamp-2 mb-1' : 'text-xs line-clamp-2'}`}
                                        title={result.title}
                                    >
                                        {result.cleanTitle || result.title}
                                    </h4>

                                    {/* Expanded Metadata: Views & Recommended Badge */}
                                    {isExpanded && (
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            {result.score > 50000 && ( // Threshold for "Recommended"
                                                <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                                                    <Sparkles size={10} fill="currentColor" />
                                                    NGON
                                                </span>
                                            )}
                                            {result.views && (
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                                                    {result.views} lượt xem
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1 flex-wrap">
                                        {result.tags && result.tags.slice(0, isExpanded ? 4 : 2).map((tag, i) => (
                                            <span key={i} className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide
                                                ${tag.includes('Tone') ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                    tag === 'Remix' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                                                        'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className={`flex items-center justify-between mt-1 ${isExpanded ? 'border-t border-slate-100 pt-2' : ''}`}>
                                    <span className="text-[10px] font-bold text-slate-400 truncate max-w-[120px] uppercase flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                        {result.artist}
                                    </span>
                                    {isExpanded && (
                                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 shadow-lg shadow-indigo-200">
                                            CHỌN
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Compact Add button (hidden in Expanded) */}
                            {!isExpanded && (
                                <button className="p-1.5 rounded-full text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all flex-shrink-0">
                                    <Plus size={16} strokeWidth={3} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Voice Search Overlay */}
            {isListening && (
                <div className="fixed inset-0 z-[9999] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center">
                    {/* Mic button with ripple */}
                    <div className="relative mb-8">
                        {voiceStatus === 'listening' && !voiceError && (
                            <>
                                <div className="absolute inset-0 w-28 h-28 -m-6 rounded-full bg-red-100 animate-ping opacity-30" />
                                <div className="absolute inset-0 w-24 h-24 -m-4 rounded-full bg-red-50 animate-pulse opacity-50" />
                            </>
                        )}
                        <button
                            onClick={voiceStatus === 'listening' ? stopVoiceSearch : undefined}
                            className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer active:scale-95 ${
                                voiceStatus === 'processing'
                                    ? 'bg-indigo-500 shadow-indigo-200'
                                    : voiceError
                                        ? 'bg-slate-400 shadow-slate-200'
                                        : 'bg-red-500 hover:bg-red-600 shadow-red-200'
                            } text-white`}
                        >
                            {voiceStatus === 'processing'
                                ? <div className="animate-spin h-6 w-6 border-3 border-white border-t-transparent rounded-full" />
                                : <Mic size={28} strokeWidth={2.5} />
                            }
                        </button>
                    </div>

                    {/* Real-time interim text */}
                    {interimText && !voiceError && (
                        <p className="text-xl font-bold text-indigo-600 mb-3 px-8 text-center animate-pulse">
                            "{interimText}"
                        </p>
                    )}

                    <p className={`text-lg font-bold mb-2 ${voiceError ? 'text-red-500' : 'text-slate-700'}`}>
                        {voiceError
                            || (voiceStatus === 'processing' ? 'Đang nhận dạng...' : 'Đang nghe...')}
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                        {voiceError
                            ? ''
                            : voiceStatus === 'listening'
                                ? useGeminiFallback.current
                                    ? 'Nói xong thì bấm nút mic để tìm'
                                    : 'Nói tên bài hát...'
                                : 'Đang xử lý giọng nói'}
                    </p>

                    {voiceStatus === 'listening' && (
                        <button
                            onClick={() => {
                                // Stop Web Speech API
                                if (recognitionRef.current) {
                                    recognitionRef.current.abort();
                                    recognitionRef.current = null;
                                }
                                // Stop Gemini fallback
                                clearTimeout(maxTimerRef.current);
                                if (streamRef.current) {
                                    streamRef.current.getTracks().forEach(t => t.stop());
                                    streamRef.current = null;
                                }
                                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                                    mediaRecorderRef.current.stop();
                                    mediaRecorderRef.current = null;
                                }
                                setIsListening(false);
                                setVoiceStatus('');
                                setInterimText('');
                            }}
                            className="mt-8 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer uppercase tracking-widest"
                        >
                            Huỷ
                        </button>
                    )}
                </div>
            )}

            {/* Guest Name Modal */}
            <GuestNameModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onConfirm={handleConfirmAdd}
                songTitle={selectedTrack?.title || ''}
            />
        </div>
    );
};

export default SearchBar;

import React, { useEffect } from 'react';
import { useAppStore } from '../core/store';
import YouTubePlayer from '../player/YouTubePlayer';
import WaitingOverlay from '../player/WaitingOverlay';
import MarqueeOverlay from './MarqueeOverlay';
import { usePlayerSync } from '../player/usePlayerSync';

import bgVideo from '../../assets/bg.mp4';

class PlayerErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorKey: 0 };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error) {
        console.warn('[TV] Player crashed, recovering...', error.message);
    }

    componentDidUpdate(prevProps) {
        // Auto-recover when song changes
        if (prevProps.videoId !== this.props.videoId && this.state.hasError) {
            this.setState({ hasError: false });
        }
    }

    render() {
        if (this.state.hasError) {
            // Auto-retry after short delay
            setTimeout(() => this.setState({ hasError: false }), 500);
            return (
                <div className="w-full h-full bg-black flex items-center justify-center">
                    <div className="text-white/50 text-xl animate-pulse">Đang tải...</div>
                </div>
            );
        }
        return this.props.children;
    }
}

const ValidationView = () => {
    usePlayerSync('projection');
    const { currentSong } = useAppStore();

    useEffect(() => {
        const requestFS = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => { });
            }
            document.removeEventListener('click', requestFS);
        };
        document.addEventListener('click', requestFS);
        return () => document.removeEventListener('click', requestFS);
    }, []);

    return (
        <div className="h-screen w-screen bg-black overflow-hidden flex items-center justify-center relative">
            {currentSong ? (
                <div className="w-full h-full relative">
                    <PlayerErrorBoundary videoId={currentSong.videoId}>
                        <YouTubePlayer className="w-full h-full" />
                    </PlayerErrorBoundary>
                    <MarqueeOverlay />
                </div>
            ) : (
                <div className="w-full h-full absolute inset-0 z-0 bg-black overflow-hidden">
                    {/* Background Video with fade */}
                    <video
                        src={bgVideo}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                    />

                    {/* Cinematic Overlay Gradient */}
                    {/* Cinematic Overlay Gradient Removed */}

                    {/* Central Content */}
                    {/* Central Content Removed by Request */}

                    {/* Infinite Marquee still visible */}
                    <MarqueeOverlay />
                </div>
            )}
            <WaitingOverlay />
        </div>
    );
};

export default ValidationView;

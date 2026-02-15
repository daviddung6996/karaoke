/**
 * Module-level registry for the YouTube player instance.
 * Each browser window (host / projection) has its own.
 */
let _player = null;
let _ready = false;

export const registerPlayer = (player) => {
    _player = player;
    _ready = true;
};

export const unregisterPlayer = () => {
    _player = null;
    _ready = false;
};

export const isPlayerReady = () => _ready && _player !== null;

export const getPlayer = () => _player;

export const getPlayerTime = () => {
    try {
        if (!_player || !_ready) return 0;
        return _player.getCurrentTime() || 0;
    } catch {
        return 0;
    }
};

export const getDuration = () => {
    try {
        if (!_player || !_ready) return 0;
        return _player.getDuration() || 0;
    } catch {
        return 0;
    }
};

export const seekPlayer = (time) => {
    try {
        if (!_player || !_ready) return;
        if (typeof time !== 'number' || time < 0) return;
        const iframe = _player.getIframe?.();
        if (!iframe || !iframe.src) return;
        _player.seekTo(time, true);
    } catch (err) {
        console.warn('[playerRegistry] seekPlayer skipped:', err.message);
    }
};

export const getVolume = () => {
    try {
        if (!_player || !_ready) return 100;
        return _player.getVolume() || 100;
    } catch {
        return 100;
    }
};

export const setVolume = (vol) => {
    try {
        if (!_player || !_ready) return;
        const v = Math.max(0, Math.min(100, vol));
        _player.setVolume(v);
        // YouTube API quirk: setVolume doesn't unmute if player was muted
        if (v > 0) {
            _player.unMute();
        }
    } catch (err) {
        console.warn('[playerRegistry] setVolume skipped:', err.message);
    }
};

export const mutePlayer = () => {
    try {
        if (!_player || !_ready) return;
        _player.mute();
    } catch { }
};

export const unmutePlayer = () => {
    try {
        if (!_player || !_ready) return;
        _player.unMute();
    } catch { }
};

export const getPlayerState = () => {
    try {
        if (!_player || !_ready) return -1;
        return _player.getPlayerState() ?? -1;
    } catch {
        return -1;
    }
};

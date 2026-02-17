/**
 * Module-level registry for the YouTube player instance.
 * Each browser window (host / projection) has its own.
 */
let _player = null;
let _ready = false;

// Track the last intentional volume so unmutePlayer() can restore correctly
let _lastIntendedVolume = 100;

// Track whether the HOST user explicitly muted (vs system mute for song transitions)
let _isUserMuted = false;

// Remote state (for Host when TV is playing)
let _remoteTime = 0;
let _remoteDuration = 0;
let _remoteSongEndedCallbacks = new Set();

export const registerPlayer = (player) => {
    _player = player;
    _ready = true;
};

export const unregisterPlayer = () => {
    _player = null;
    _ready = false;
};

export const updateRemoteState = (time, duration) => {
    _remoteTime = time;
    if (duration > 0) _remoteDuration = duration;
};

export const onRemoteSongEnded = (callback) => {
    _remoteSongEndedCallbacks.add(callback);
    return () => _remoteSongEndedCallbacks.delete(callback);
};

export const triggerRemoteSongEnded = () => {
    _remoteSongEndedCallbacks.forEach(cb => cb());
};

export const isPlayerReady = () => {
    if (!_ready || !_player) return false;
    try {
        const iframe = _player.getIframe?.();
        return !!(iframe && iframe.src);
    } catch { return false; }
};

export const getPlayer = () => _player;

export const getPlayerTime = () => {
    try {
        if (!_player || !_ready) return _remoteTime;
        return _player.getCurrentTime() || 0;
    } catch {
        return _remoteTime;
    }
};

export const getDuration = () => {
    try {
        if (!_player || !_ready) return _remoteDuration;
        return _player.getDuration() || 0;
    } catch {
        return _remoteDuration;
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

export const setVolume = (vol, allowUnmute = true) => {
    try {
        if (!_player || !_ready) return;
        const v = Math.max(0, Math.min(100, vol));
        if (v > 0) _lastIntendedVolume = v;
        _player.setVolume(v);
        // YouTube API quirk: setVolume doesn't unmute if player was muted
        if (v > 0 && allowUnmute) {
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
        // Respect user mute — don't unmute if HOST user explicitly muted
        if (_isUserMuted) return;
        _player.unMute();
        // Always restore volume — new songs reset YouTube player to default 100,
        // and HOST won't re-send SET_VOLUME if store value hasn't changed.
        _player.setVolume(_lastIntendedVolume);
    } catch { }
};

// Called from SET_MUTE handler — tracks explicit user mute intent
export const setUserMuted = (muted) => {
    _isUserMuted = muted;
    try {
        if (!_player || !_ready) return;
        if (muted) {
            _player.mute();
        } else {
            _player.unMute();
            _player.setVolume(_lastIntendedVolume);
        }
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

const _iframeSafe = () => {
    try {
        if (!_player || !_ready) return false;
        const iframe = _player.getIframe?.();
        return !!(iframe && iframe.src);
    } catch { return false; }
};

export const playPlayer = () => {
    try {
        if (_iframeSafe()) _player.playVideo();
    } catch (err) {
        console.warn('[playerRegistry] playPlayer skipped:', err.message);
    }
};

export const pausePlayer = () => {
    try {
        if (_iframeSafe()) _player.pauseVideo();
    } catch (err) {
        console.warn('[playerRegistry] pausePlayer skipped:', err.message);
    }
};

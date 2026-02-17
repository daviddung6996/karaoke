
const STORAGE_KEY = 'karaoke_device_id';

export function getDeviceId() {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
        id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
}

export function setDeviceName(name) {
    localStorage.setItem('karaoke_user_name', name);
}

export function getDeviceName() {
    return localStorage.getItem('karaoke_user_name') || 'Khách mới';
}

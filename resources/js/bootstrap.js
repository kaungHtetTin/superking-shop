import axios from 'axios';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

/**
 * We'll load the axios HTTP library which allows us to easily issue requests
 * to our Laravel back-end. This library automatically handles sending the
 * CSRF token as a header based on the value of the "XSRF" token cookie.
 */

window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.headers.common['Accept'] = 'application/json';
window.axios.defaults.withCredentials = true;

const csrfMeta = () => document.querySelector('meta[name="csrf-token"]');

const readCookie = (name) => {
    const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`));

    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
};

const currentCsrfToken = () => csrfMeta()?.getAttribute('content') || readCookie('XSRF-TOKEN');

const syncCsrfToken = (token) => {
    if (!token) return;

    const meta = csrfMeta();
    if (meta) {
        meta.setAttribute('content', token);
    }

    window.axios.defaults.headers.common['X-CSRF-TOKEN'] = token;
};

syncCsrfToken(currentCsrfToken());

window.setCsrfRefreshUrl = (url) => {
    window.__csrfRefreshUrl = url;
};

const refreshCsrfToken = async () => {
    const response = await window.axios.get(window.__csrfRefreshUrl || '/csrf-token', {
        __csrfRefreshRequest: true,
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
        },
    });
    const token = response.data?.csrf_token || response.headers?.['x-csrf-token'];
    syncCsrfToken(token);

    return token;
};

window.axios.interceptors.request.use((config) => {
    if (!config.__csrfRefreshRequest) {
        const token = currentCsrfToken();
        if (token) {
            config.headers = config.headers || {};
            config.headers['X-CSRF-TOKEN'] = token;
        }
    }

    return config;
});

window.axios.interceptors.response.use(
    (response) => {
        syncCsrfToken(response.headers?.['x-csrf-token']);

        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        const canRefresh = error.response?.status === 419
            && originalRequest
            && !originalRequest.__csrfRetry
            && !originalRequest.__csrfRefreshRequest;

        if (!canRefresh) {
            return Promise.reject(error);
        }

        originalRequest.__csrfRetry = true;

        try {
            const token = await refreshCsrfToken();
            if (token) {
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers['X-CSRF-TOKEN'] = token;
            }

            return window.axios(originalRequest);
        } catch {
            return Promise.reject(error);
        }
    }
);

/**
 * Echo exposes an expressive API for subscribing to channels and listening
 * for events that are broadcast by Laravel. Echo and event broadcasting
 * allows your team to easily build robust real-time web applications.
 */

window.configureRealtime = (appBase = '') => {
    if (window.Echo || !import.meta.env.VITE_PUSHER_APP_KEY) {
        return window.Echo || null;
    }

    const cleanBase = appBase && appBase !== '/' ? `/${String(appBase).replace(/^\/+|\/+$/g, '')}` : '';
    const scheme = import.meta.env.VITE_PUSHER_SCHEME || 'https';
    const host = import.meta.env.VITE_PUSHER_HOST || undefined;
    const port = import.meta.env.VITE_PUSHER_PORT || (scheme === 'https' ? 443 : 80);

    window.Pusher = Pusher;
    window.Echo = new Echo({
        broadcaster: 'pusher',
        key: import.meta.env.VITE_PUSHER_APP_KEY,
        cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1',
        wsHost: host,
        wsPort: Number(port),
        wssPort: Number(port),
        forceTLS: scheme === 'https',
        enabledTransports: ['ws', 'wss'],
        authEndpoint: `${cleanBase}/broadcasting/auth`,
        auth: {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            },
        },
    });

    return window.Echo;
};

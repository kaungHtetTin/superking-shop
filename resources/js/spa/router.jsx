import React, { Children, createContext, forwardRef, isValidElement, useContext, useEffect, useMemo, useRef, useState } from 'react';

const PageContext = createContext({ component: null, props: {}, url: '/' });
const listeners = new Map();

let spaState = {
    page: null,
    setPage: null,
    resolve: null,
    beginNavigation: null,
    finishNavigation: null,
};
let visitSequence = 0;
let latestGetVisitId = 0;
let activeGetController = null;

function emit(event, payload) {
    (listeners.get(event) || new Set()).forEach((callback) => callback(payload));
}

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
}

function syncCsrfToken(token) {
    if (!token) return;

    let meta = document.querySelector('meta[name="csrf-token"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'csrf-token');
        document.head.appendChild(meta);
    }

    meta.setAttribute('content', token);

    if (window.axios) {
        window.axios.defaults.headers.common['X-CSRF-TOKEN'] = token;
    }
}

async function refreshCsrfToken() {
    const response = await fetch(window.__csrfRefreshUrl || '/csrf-token', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    if (!response.ok) {
        return null;
    }

    const headerToken = response.headers.get('x-csrf-token');
    let payloadToken = null;

    try {
        const payload = await response.json();
        payloadToken = payload?.csrf_token || null;
    } catch {
        // The endpoint should return JSON, but the header is enough if present.
    }

    const token = payloadToken || headerToken;
    syncCsrfToken(token);

    return token;
}

function isModifiedClick(event) {
    return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

function normalizeUrl(url) {
    if (!url) return window.location.pathname + window.location.search;
    return String(url);
}

function appendQuery(url, data = {}) {
    const parsed = new URL(normalizeUrl(url), window.location.origin);

    Object.entries(data || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            parsed.searchParams.delete(key);
        } else {
            parsed.searchParams.set(key, String(value));
        }
    });

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function hasFiles(value) {
    if (!value) return false;
    if (value instanceof File || value instanceof Blob || value instanceof FileList) return true;
    if (Array.isArray(value)) return value.some(hasFiles);
    if (typeof value === 'object') return Object.values(value).some(hasFiles);
    return false;
}

function appendFormValue(formData, key, value) {
    if (value === undefined || value === null) {
        formData.append(key, '');
        return;
    }

    if (value instanceof FileList) {
        Array.from(value).forEach((file, index) => formData.append(`${key}[${index}]`, file));
        return;
    }

    if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => appendFormValue(formData, `${key}[${index}]`, item));
        return;
    }

    if (typeof value === 'object') {
        Object.entries(value).forEach(([childKey, childValue]) => appendFormValue(formData, `${key}[${childKey}]`, childValue));
        return;
    }

    if (typeof value === 'boolean') {
        formData.append(key, value ? '1' : '0');
        return;
    }

    formData.append(key, value);
}

function objectToFormData(data) {
    const formData = new FormData();
    Object.entries(data || {}).forEach(([key, value]) => appendFormValue(formData, key, value));
    return formData;
}

function flattenErrors(errors = {}) {
    return Object.fromEntries(
        Object.entries(errors).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
    );
}

function valueAtPath(source, path) {
    return path.split('.').reduce((value, key) => value?.[key], source);
}

function interpolate(value, replacements = {}) {
    return Object.entries(replacements).reduce(
        (text, [key, replacement]) => text.replaceAll(`:${key}`, replacement),
        value,
    );
}

function translatePhrase(page, text) {
    if (typeof text !== 'string' || text === '') {
        return text;
    }

    const phrases = valueAtPath(page?.props?.translations || {}, 'navigation.phrases') || {};
    if (typeof phrases[text] === 'string') {
        return phrases[text];
    }

    const dynamicPatterns = [
        ['Order ', 'Order :value'],
        ['Customer ', 'Customer :value'],
        ['Edit ', 'Edit :value'],
        ['Chat • ', 'Chat • :value'],
    ];

    for (const [prefix, key] of dynamicPatterns) {
        if (text.startsWith(prefix) && typeof phrases[key] === 'string') {
            return interpolate(phrases[key], { value: text.slice(prefix.length) });
        }
    }

    if (text.endsWith(' Inventory') && typeof phrases[':value Inventory'] === 'string') {
        return interpolate(phrases[':value Inventory'], { value: text.slice(0, -10) });
    }

    return text;
}

function requestBody(data, method, options = {}) {
    if (method === 'get') return { body: undefined, headers: {} };
    if (data instanceof FormData) return { body: data, headers: {} };
    if (options.forceFormData || hasFiles(data)) return { body: objectToFormData(data), headers: {} };

    return {
        body: JSON.stringify(data || {}),
        headers: { 'Content-Type': 'application/json' },
    };
}

async function applyPage(page, options = {}) {
    if (!page?.component || !spaState.setPage) return;

    spaState.setPage(page);
    emit('navigate', { detail: { page } });

    if (!options.preserveScroll) {
        window.scrollTo({ top: 0, left: 0 });
    }
}

async function parseSpaResponse(response, options = {}) {
    const contentType = response.headers.get('content-type') || '';

    if (response.status === 422 && contentType.includes('application/json')) {
        const payload = await response.json();
        const errors = flattenErrors(payload.errors || {});
        options.onError?.(errors);
        return { errors };
    }

    if (!response.ok && response.status !== 409) {
        if (contentType.includes('application/json')) {
            const payload = await response.json();
            options.onError?.(flattenErrors(payload.errors || payload || {}));
            return payload;
        }

        window.location.assign(response.url || window.location.href);
        return null;
    }

    if (!contentType.includes('application/json')) {
        window.location.assign(response.url || window.location.href);
        return null;
    }

    const page = await response.json();
    await applyPage(page, options);
    const pageErrors = flattenErrors(page?.props?.errors || {});
    const hasPageErrors = Object.keys(pageErrors).length > 0;

    if (hasPageErrors && String(options.method || 'get').toLowerCase() !== 'get') {
        options.onError?.(pageErrors);
        return page;
    }

    options.onSuccess?.(page);
    return page;
}

export const router = {
    on(event, callback) {
        if (!listeners.has(event)) {
            listeners.set(event, new Set());
        }

        listeners.get(event).add(callback);
        return () => listeners.get(event)?.delete(callback);
    },

    async visit(url, options = {}) {
        const method = String(options.method || 'get').toLowerCase();
        const target = method === 'get' ? appendQuery(url, options.data || {}) : normalizeUrl(url);
        const isGet = method === 'get';
        const visitId = ++visitSequence;
        const previousUrl = window.location.pathname + window.location.search + window.location.hash;
        const showSkeleton = isGet && options.showSkeleton !== false;
        const controller = isGet ? new AbortController() : null;

        options.onStart?.();

        if (isGet) {
            activeGetController?.abort();
            activeGetController = controller;
            latestGetVisitId = visitId;

            if (options.replace) {
                window.history.replaceState({}, '', target);
            } else if (target !== previousUrl) {
                window.history.pushState({}, '', target);
            }

            if (showSkeleton) {
                spaState.beginNavigation?.({
                    id: visitId,
                    method,
                    url: target,
                });
                emit('start', { detail: { method, url: target } });
            }

            if (!options.preserveScroll) {
                window.scrollTo({ top: 0, left: 0 });
            }
        }

        try {
            const send = () => {
                const { body, headers } = requestBody(options.data, method, options);

                return fetch(target, {
                    method: method.toUpperCase(),
                    body,
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-SPA': 'true',
                        'X-CSRF-TOKEN': csrfToken(),
                        ...headers,
                    },
                    signal: controller?.signal,
                });
            };

            let response = await send();
            syncCsrfToken(response.headers.get('x-csrf-token'));

            if (response.status === 419 && !options.__csrfRetry) {
                const token = await refreshCsrfToken();
                if (token) {
                    response = await send();
                    syncCsrfToken(response.headers.get('x-csrf-token'));
                }
            }

            if (isGet && visitId !== latestGetVisitId) {
                return null;
            }

            const page = await parseSpaResponse(response, {
                ...options,
                // Defer success until the follow-up GET when a mutation redirected.
                onSuccess: (!isGet && response.redirected && response.url) ? undefined : options.onSuccess,
            });

            if (response.redirected && response.url) {
                const redirectedUrl = new URL(response.url);
                window.history.replaceState({}, '', redirectedUrl.pathname + redirectedUrl.search + redirectedUrl.hash);

                // Mutations that redirect can leave stale props; refresh with an explicit GET.
                if (!isGet && page?.component) {
                    return this.visit(redirectedUrl.pathname + redirectedUrl.search, {
                        method: 'get',
                        replace: true,
                        preserveScroll: options.preserveScroll,
                        showSkeleton: false,
                        onSuccess: options.onSuccess,
                        onError: options.onError,
                        onFinish: options.onFinish,
                    });
                }
            } else if (isGet && !page?.component && visitId === latestGetVisitId) {
                window.history.replaceState({}, '', previousUrl);
            }

            return page;
        } catch (error) {
            if (error?.name === 'AbortError') {
                return null;
            }

            if (isGet && visitId === latestGetVisitId) {
                window.history.replaceState({}, '', previousUrl);
            }

            throw error;
        } finally {
            if (isGet && activeGetController === controller) {
                activeGetController = null;
            }
            if (showSkeleton) {
                spaState.finishNavigation?.(visitId);
                emit('finish', { detail: { method, url: target } });
            }
            options.onFinish?.();
        }
    },

    get(url, data = {}, options = {}) {
        return this.visit(url, { ...options, method: 'get', data });
    },

    post(url, data = {}, options = {}) {
        return this.visit(url, { ...options, method: 'post', data });
    },

    put(url, data = {}, options = {}) {
        return this.visit(url, { ...options, method: 'put', data });
    },

    patch(url, data = {}, options = {}) {
        return this.visit(url, { ...options, method: 'patch', data });
    },

    delete(url, data = {}, options = {}) {
        const optionKeys = ['preserveScroll', 'preserveState', 'replace', 'onSuccess', 'onError', 'onFinish', 'onStart', 'only'];
        const dataLooksLikeOptions = options && Object.keys(options).length === 0
            && data
            && typeof data === 'object'
            && !(data instanceof FormData)
            && Object.keys(data).some((key) => optionKeys.includes(key));

        if (dataLooksLikeOptions) {
            return this.visit(url, { ...data, method: 'delete', data: {} });
        }

        return this.visit(url, { ...options, method: 'delete', data });
    },

    reload(options = {}) {
        return this.visit(window.location.pathname + window.location.search, { ...options, replace: true });
    },
};

export function usePage() {
    return useContext(PageContext);
}

export const Link = forwardRef(function Link(
    { as, href = '#', method = 'get', data = {}, replace = false, preserveScroll = false, preserveState = false, onClick, children, ...props },
    ref,
) {
    const tag = as || (String(method).toLowerCase() === 'get' ? 'a' : 'button');
    const Tag = tag;
    const resolvedHref = normalizeUrl(href);

    const handleClick = (event) => {
        onClick?.(event);
        if (event.defaultPrevented || isModifiedClick(event)) return;

        event.preventDefault();
        router.visit(resolvedHref, {
            method,
            data,
            replace,
            preserveScroll,
            preserveState,
        });
    };

    const tagProps = tag === 'a'
        ? { href: resolvedHref }
        : { type: props.type || 'button' };

    return (
        <Tag ref={ref} {...tagProps} {...props} onClick={handleClick}>
            {children}
        </Tag>
    );
});

export function Head({ title, children }) {
    const page = useContext(PageContext);
    const translatedTitle = translatePhrase(page, title);

    useEffect(() => {
        if (translatedTitle) {
            document.title = translatedTitle;
        }
    }, [translatedTitle]);

    useEffect(() => {
        const nodes = [];

        const appendNode = (element) => {
            if (!isValidElement(element)) return;

            if (element.type === React.Fragment) {
                Children.forEach(element.props.children, appendNode);
                return;
            }

            if (!['link', 'meta'].includes(element.type)) return;

            const node = document.createElement(element.type);
            Object.entries(element.props || {}).forEach(([key, value]) => {
                if (key === 'children' || value === false || value == null) return;
                node.setAttribute(key === 'className' ? 'class' : key, String(value));
            });
            node.setAttribute('data-spa-head', 'true');
            document.head.appendChild(node);
            nodes.push(node);
        };

        Children.forEach(children, appendNode);

        return () => {
            nodes.forEach((node) => node.remove());
        };
    }, [children]);

    return null;
}

export function useForm(initialData = {}) {
    const defaults = useRef(initialData);
    const transformRef = useRef((data) => data);
    const [data, setFormData] = useState(initialData);
    const [errors, setErrors] = useState({});
    const [processing, setProcessing] = useState(false);
    const [recentlySuccessful, setRecentlySuccessful] = useState(false);

    const setData = (key, value) => {
        if (typeof key === 'object') {
            setFormData(key);
            return;
        }

        setFormData((current) => ({ ...current, [key]: value }));
    };

    const reset = (...fields) => {
        if (fields.length === 0) {
            setFormData(defaults.current);
            return;
        }

        setFormData((current) => {
            const next = { ...current };
            fields.forEach((field) => {
                next[field] = defaults.current[field] ?? '';
            });
            return next;
        });
    };

    const clearErrors = (...fields) => {
        if (fields.length === 0) {
            setErrors({});
            return;
        }

        setErrors((current) => {
            const next = { ...current };
            fields.forEach((field) => delete next[field]);
            return next;
        });
    };

    const setError = (key, value) => {
        if (typeof key === 'object') {
            setErrors(flattenErrors(key));
            return;
        }

        setErrors((current) => ({ ...current, [key]: value }));
    };

    const transform = (callback) => {
        transformRef.current = callback;
        return form;
    };

    const submit = async (method, url, options = {}) => {
        setProcessing(true);
        setRecentlySuccessful(false);
        setErrors({});

        const payload = transformRef.current(data);

        return router.visit(url, {
            ...options,
            method,
            data: payload,
            onError: (nextErrors) => {
                setErrors(nextErrors);
                options.onError?.(nextErrors);
            },
            onSuccess: (page) => {
                setRecentlySuccessful(true);
                window.setTimeout(() => setRecentlySuccessful(false), 2000);
                options.onSuccess?.(page);
            },
            onFinish: () => {
                setProcessing(false);
                options.onFinish?.();
            },
        });
    };

    const form = useMemo(() => ({
        data,
        setData,
        errors,
        processing,
        recentlySuccessful,
        transform,
        reset,
        clearErrors,
        setError,
        submit,
        get: (url, options) => submit('get', url, options),
        post: (url, options) => submit('post', url, options),
        put: (url, options) => submit('put', url, options),
        patch: (url, options) => submit('patch', url, options),
        delete: (url, options) => submit('delete', url, options),
    }), [data, errors, processing, recentlySuccessful]);

    return form;
}

export function SpaApp({ initialPage, resolve, render }) {
    const [page, setPage] = useState(initialPage);
    const [componentEntry, setComponentEntry] = useState(null);
    const [navigation, setNavigation] = useState(null);

    useEffect(() => {
        spaState = {
            page,
            setPage,
            resolve,
            beginNavigation: setNavigation,
            finishNavigation: (visitId) => {
                setNavigation((current) => current?.id === visitId ? null : current);
            },
        };
    }, [page, resolve]);

    useEffect(() => {
        let mounted = true;

        resolve(page.component).then((module) => {
            if (mounted) {
                setComponentEntry({
                    name: page.component,
                    Component: module.default || module,
                });
            }
        });

        return () => {
            mounted = false;
        };
    }, [page.component, resolve]);

    useEffect(() => {
        const onPopState = () => {
            router.visit(window.location.pathname + window.location.search, {
                replace: true,
                preserveScroll: true,
            });
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const isCurrentComponentReady = componentEntry && componentEntry.name === page.component;
    const Component = isCurrentComponentReady ? componentEntry.Component : null;
    const displayPage = navigation
        ? { ...page, url: navigation.url }
        : page;
    const loading = Boolean(navigation) || !isCurrentComponentReady;

    return (
        <PageContext.Provider value={displayPage}>
            {render({
                Component: loading ? null : Component,
                page: displayPage,
                loading,
                pendingUrl: navigation?.url || null,
            })}
        </PageContext.Provider>
    );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, usePage } from '@/spa/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { StatusBadge } from '@/Components/Admin/shared';
import { apiUrl, routeWithBase, storageUrl } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import {
    compressImageFile,
    ensureSanctumCookie,
    markOptimisticFailed,
    mergeIncomingMessages,
    replaceOptimistic,
} from '@/lib/chat/supportChatCore';

function usePageVisible() {
    const [visible, setVisible] = useState(() => (typeof document !== 'undefined' ? !document.hidden : true));
    useEffect(() => {
        const onChange = () => setVisible(!document.hidden);
        document.addEventListener('visibilitychange', onChange);
        return () => document.removeEventListener('visibilitychange', onChange);
    }, []);
    return visible;
}

function newClientTempId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function AdminChatPanel({ customer, showBackLink = false, backHref = null, onBack = null, className = '' }) {
    const { app_base, auth, app_url } = usePage().props;
    const t = usePhraseTranslation();
    const queryClient = useQueryClient();
    const pageVisible = usePageVisible();

    const scrollRef = useRef(null);
    const stickToBottomRef = useRef(true);
    const maxServerIdRef = useRef(0);

    const [messages, setMessages] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [customerPreview, setCustomerPreview] = useState(customer || {});
    const [draft, setDraft] = useState('');
    const [preview, setPreview] = useState(null);
    const [previewFile, setPreviewFile] = useState(null);
    const [lightbox, setLightbox] = useState(null);
    const [hasMoreOlder, setHasMoreOlder] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [uploadPct, setUploadPct] = useState(null);
    const [csrfReady, setCsrfReady] = useState(false);

    useEffect(() => {
        setCustomerPreview(customer || {});
        setConversationId(null);
        setMessages([]);
        setDraft('');
        setPreview(null);
        setPreviewFile(null);
        setLightbox(null);
        setHasMoreOlder(false);
        setUploadPct(null);
        stickToBottomRef.current = true;
        maxServerIdRef.current = 0;
    }, [customer?.id]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await ensureSanctumCookie(app_base);
                if (!cancelled) setCsrfReady(true);
            } catch {
                if (!cancelled) setCsrfReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [app_base]);

    const metaQuery = useQuery({
        queryKey: ['admin-support-meta', customer?.id],
        enabled: csrfReady && !!customer?.id,
        queryFn: async () => {
            const { data } = await axios.get(apiUrl(`/admin/conversations/by-customer/${customer.id}`, app_base));
            return data;
        },
    });

    useEffect(() => {
        const data = metaQuery.data;
        if (!data?.conversation?.id) return;
        setConversationId(data.conversation.id);
        if (data.customer) setCustomerPreview(data.customer);
    }, [metaQuery.dataUpdatedAt]);

    const messagesBootstrap = useQuery({
        queryKey: ['admin-support-messages-bootstrap', conversationId],
        enabled: csrfReady && !!conversationId,
        queryFn: async () => {
            const { data } = await axios.get(apiUrl(`/admin/conversations/${conversationId}/messages`, app_base), {
                params: { limit: 45 },
            });
            return data;
        },
    });

    useEffect(() => {
        const data = messagesBootstrap.data;
        if (!data) return;
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setHasMoreOlder(!!data.has_more);
    }, [messagesBootstrap.dataUpdatedAt]);

    const maxServerId = useMemo(() => {
        let max = 0;
        for (const m of messages) {
            if (typeof m.id === 'number') max = Math.max(max, m.id);
        }
        return max;
    }, [messages]);

    useEffect(() => {
        maxServerIdRef.current = maxServerId;
    }, [maxServerId]);

    const pollQuery = useQuery({
        queryKey: ['admin-support-latest', conversationId],
        enabled: csrfReady && !!conversationId && pageVisible,
        refetchInterval: pageVisible ? 2600 : false,
        queryFn: async () => {
            const { data } = await axios.get(apiUrl('/admin/messages/latest', app_base), {
                params: {
                    conversation_id: conversationId,
                    after_id: maxServerIdRef.current,
                },
            });
            return data.messages || [];
        },
    });

    useEffect(() => {
        const incoming = pollQuery.data;
        if (!incoming?.length) return;
        setMessages((prev) => mergeIncomingMessages(prev, incoming));
    }, [pollQuery.dataUpdatedAt]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !stickToBottomRef.current) return;
        el.scrollTop = el.scrollHeight;
    }, [messages.length]);

    const onScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
        stickToBottomRef.current = gap < 120;
    }, []);

    const sendMutation = useMutation({
        mutationFn: async ({ body, image_path, client_temp_id }) => {
            const { data } = await axios.post(apiUrl('/admin/messages/send', app_base), {
                conversation_id: conversationId,
                body,
                image_path,
                client_temp_id,
            });
            return data.message;
        },
        onSuccess: (serverMessage, vars) => {
            setMessages((prev) => replaceOptimistic(prev, vars.client_temp_id, serverMessage));
            queryClient.invalidateQueries({ queryKey: ['admin-support-inbox'] });
            queryClient.invalidateQueries({ queryKey: ['admin-support-meta', customer?.id] });
            setDraft('');
            setPreview(null);
            setPreviewFile(null);
            setUploadPct(null);
            stickToBottomRef.current = true;
        },
        onError: (_err, vars) => {
            setMessages((prev) => markOptimisticFailed(prev, vars.client_temp_id));
        },
    });

    const uploadMutation = useMutation({
        mutationFn: async (file) => {
            const fd = new FormData();
            fd.append('image', file);
            const { data } = await axios.post(apiUrl('/admin/messages/upload-image', app_base), fd, {
                onUploadProgress: (evt) => {
                    if (!evt.total) return;
                    setUploadPct(Math.round((evt.loaded / evt.total) * 100));
                },
            });
            return data;
        },
    });

    const loadOlder = async () => {
        if (!conversationId || loadingOlder) return;
        const numericIds = messages.filter((m) => typeof m.id === 'number').map((m) => m.id);
        const beforeId = numericIds.length ? Math.min(...numericIds) : null;
        if (!beforeId) return;

        setLoadingOlder(true);
        try {
            const { data } = await axios.get(apiUrl(`/admin/conversations/${conversationId}/messages`, app_base), {
                params: { before_id: beforeId, limit: 35 },
            });
            const older = data.messages || [];
            setHasMoreOlder(!!data.has_more);
            setMessages((prev) => mergeIncomingMessages([...older, ...prev], []));
        } finally {
            setLoadingOlder(false);
        }
    };

    const pickImage = async (file) => {
        if (!file) return;
        const compressed = await compressImageFile(file);
        setPreviewFile(compressed);
        setPreview(URL.createObjectURL(compressed));
    };

    const sendNow = async () => {
        const text = draft.trim();
        if (!csrfReady || !conversationId) return;
        if (!text && !previewFile) return;

        const client_temp_id = newClientTempId();
        let image_path = null;
        let optimisticImageUrl = null;

        try {
            if (previewFile) {
                setUploadPct(0);
                const up = await uploadMutation.mutateAsync(previewFile);
                image_path = up.path;
                optimisticImageUrl = up.url || storageUrl(up.path, app_url);
                setUploadPct(100);
            }

            if (preview) URL.revokeObjectURL(preview);
            setPreview(null);
            setPreviewFile(null);

            const optimistic = {
                id: `temp:${client_temp_id}`,
                conversation_id: conversationId,
                body: text || null,
                image_url: optimisticImageUrl,
                sender: { id: auth.user.id, name: auth.user.name },
                seen_at: null,
                created_at: new Date().toISOString(),
                client_temp_id,
                optimistic: true,
                failed: false,
            };

            setMessages((prev) => [...prev, optimistic]);
            stickToBottomRef.current = true;
            sendMutation.mutate({ body: text || null, image_path, client_temp_id });
            setDraft('');
        } catch {
            setUploadPct(null);
        }
    };

    const retryOptimistic = (m) => {
        if (!m?.optimistic || !m.failed) return;
        const client_temp_id = m.client_temp_id;
        setMessages((prev) =>
            prev.map((x) =>
                x.client_temp_id === client_temp_id ? { ...x, failed: false, optimistic: true } : x,
            ),
        );
        sendMutation.mutate({ body: m.body, image_path: null, client_temp_id });
    };

    const busy =
        sendMutation.isPending ||
        uploadMutation.isPending ||
        metaQuery.isLoading ||
        messagesBootstrap.isLoading ||
        !csrfReady ||
        !conversationId;

    return (
        <>
            {showBackLink && (
                onBack ? (
                    <button type="button" className="back-link as-button" onClick={onBack}>
                        <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} />
                        {t('Back to inbox')}
                    </button>
                ) : (
                    <Link href={backHref || routeWithBase('/admin/chats', app_base)} className="back-link">
                        <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} />
                        {t('Back to inbox')}
                    </Link>
                )
            )}

            <div className={`chat-layout ${className}`.trim()}>
                <section className="panel glass chat-header">
                    <div className="stack-row">
                        <div className="rider-cell">
                            <span>{(customerPreview?.name || 'C')[0]}</span>
                            <div>
                                <strong>{customerPreview?.name || t('Select a conversation')}</strong>
                                <small>
                                    {customerPreview?.email || t('Choose a customer from the inbox.')}
                                    {customerPreview.phone ? ` - ${customerPreview.phone}` : ''}
                                </small>
                            </div>
                        </div>
                        <StatusBadge
                            status={pollQuery.isFetching ? 'info' : 'success'}
                            label={pollQuery.isFetching ? t('Syncing...') : t('Live')}
                        />
                    </div>
                </section>

                <section className="panel glass chat-panel">
                    {!customer?.id ? (
                        <div className="chat-empty-state">
                            <Icon name="chat" size={26} />
                            <strong>{t('Select a conversation')}</strong>
                            <p>{t('Pick a customer from the inbox to view and reply to messages.')}</p>
                        </div>
                    ) : !csrfReady || metaQuery.isLoading || messagesBootstrap.isLoading ? (
                        <div className="chat-skeleton">
                            <div className="bar" />
                            <div className="bar" />
                            <div className="bar" />
                        </div>
                    ) : metaQuery.isError ? (
                        <div className="flash error" style={{ margin: 14 }}>
                            {t('Could not load conversation.')}
                        </div>
                    ) : (
                        <>
                            <div ref={scrollRef} className="chat-messages" onScroll={onScroll}>
                                {hasMoreOlder && (
                                    <div style={{ textAlign: 'center', marginBottom: 8 }}>
                                        <button
                                            type="button"
                                            className="btn secondary"
                                            onClick={loadOlder}
                                            disabled={loadingOlder}
                                            style={{ minHeight: 32, fontSize: 11 }}
                                        >
                                            {loadingOlder ? t('Loading...') : t('Load older messages')}
                                        </button>
                                    </div>
                                )}

                                {messages.map((m) => {
                                    const mine = m.sender?.id === auth.user.id;
                                    const time = new Date(m.created_at).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    });

                                    return (
                                        <div key={`${m.id}-${m.client_temp_id || ''}`} className={`chat-bubble ${mine ? 'mine' : 'theirs'}`}>
                                            {m.image_url ? (
                                                <img src={m.image_url} alt="" onClick={() => setLightbox(m.image_url)} />
                                            ) : null}
                                            {m.body ? <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div> : null}
                                            <div className="meta">
                                                <span>{time}</span>
                                                {mine && !m.failed && !m.seen_at && <span>{t('Sent')}</span>}
                                                {mine && m.failed && (
                                                    <button
                                                        type="button"
                                                        className="text-btn"
                                                        style={{ color: 'inherit' }}
                                                        onClick={() => retryOptimistic(m)}
                                                    >
                                                        {t('Retry')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {preview && (
                                <div style={{ padding: '8px 14px 0', position: 'relative' }}>
                                    <img
                                        src={preview}
                                        alt=""
                                        style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }}
                                    />
                                    <button
                                        type="button"
                                        className="icon-btn small"
                                        style={{ position: 'absolute', top: 14, right: 18 }}
                                        onClick={() => {
                                            URL.revokeObjectURL(preview);
                                            setPreview(null);
                                            setPreviewFile(null);
                                        }}
                                    >
                                        <Icon name="close" size={13} />
                                    </button>
                                </div>
                            )}

                            {uploadPct !== null && uploadPct < 100 && (
                                <div style={{ padding: '8px 14px 0' }}>
                                    <div className="progress-bar">
                                        <span style={{ width: `${uploadPct}%` }} />
                                    </div>
                                    <small>{t('Uploading...')} {uploadPct}%</small>
                                </div>
                            )}

                            <div
                                className="chat-compose"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const f = e.dataTransfer.files?.[0];
                                    if (f && /^image\/(jpeg|png|webp)$/i.test(f.type)) pickImage(f);
                                }}
                            >
                                <label className="icon-btn" aria-label={t('Upload image')}>
                                    <Icon name="image" size={16} />
                                    <input
                                        hidden
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(e) => pickImage(e.target.files?.[0])}
                                    />
                                </label>
                                <textarea
                                    placeholder={t('Reply...')}
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendNow();
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    className="icon-btn"
                                    style={{ background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }}
                                    onClick={sendNow}
                                    disabled={busy || (!draft.trim() && !previewFile)}
                                    aria-label={t('Send')}
                                >
                                    <Icon name="navigation" size={16} />
                                </button>
                            </div>
                        </>
                    )}
                </section>
            </div>

            {lightbox && (
                <div className="modal-backdrop" onClick={() => setLightbox(null)}>
                    <div style={{ maxWidth: '94vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                        <img src={lightbox} alt="" style={{ width: '100%', height: 'auto', borderRadius: 8 }} />
                    </div>
                </div>
            )}
        </>
    );
}

export default function AdminChatsShow({ customer }) {
    const t = usePhraseTranslation();

    return (
        <AdminLayout title={customer.name} eyebrow={t('Customer chat')}>
            <Head title={t('Chat :value', { value: customer.name })} />
            <AdminChatPanel customer={customer} showBackLink />
        </AdminLayout>
    );
}

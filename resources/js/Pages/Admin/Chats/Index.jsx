import { useEffect, useMemo, useState } from 'react';
import { Head, Link, usePage } from '@/spa/router';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { apiUrl, routeWithBase } from '@/Utils/url';
import { ensureSanctumCookie } from '@/lib/chat/supportChatCore';
import { AdminChatPanel } from './Show';
import { usePhraseTranslation } from '@/Utils/i18n';

function useDebouncedValue(value, delayMs) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(value), delayMs);
        return () => window.clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

export default function AdminChatsIndex() {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [q, setQ] = useState('');
    const debouncedQ = useDebouncedValue(q, 350);
    const [page, setPage] = useState(1);
    const [csrfReady, setCsrfReady] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [isLargeScreen, setIsLargeScreen] = useState(() => (typeof window === 'undefined' ? true : window.matchMedia('(min-width: 900px)').matches));

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

    useEffect(() => {
        setPage(1);
    }, [debouncedQ]);

    useEffect(() => {
        const media = window.matchMedia('(min-width: 900px)');
        const update = () => setIsLargeScreen(media.matches);
        update();
        media.addEventListener?.('change', update);
        return () => media.removeEventListener?.('change', update);
    }, []);

    const conversationsQuery = useQuery({
        queryKey: ['admin-support-inbox', debouncedQ, page],
        enabled: csrfReady,
        queryFn: async () => {
            const { data } = await axios.get(apiUrl('/admin/conversations', app_base), {
                params: { q: debouncedQ || undefined, page, per_page: 24 },
            });
            return data;
        },
        placeholderData: (prev) => prev,
    });

    const rows = conversationsQuery.data?.data || [];
    const meta = conversationsQuery.data?.meta || null;
    const unreadTotal = useMemo(() => rows.reduce((sum, r) => sum + (r.unread_count || 0), 0), [rows]);

    useEffect(() => {
        if (!isLargeScreen) return;
        if (rows.length === 0) {
            setSelectedCustomer(null);
            return;
        }
        if (!selectedCustomer || !rows.some((row) => row.customer?.id === selectedCustomer.id)) {
            setSelectedCustomer(rows[0].customer);
        }
    }, [isLargeScreen, rows, selectedCustomer]);

    return (
        <AdminLayout
            title={t('Customer chats')}
            eyebrow={t('Support inbox')}
            mainClassName="admin-main-chat"
            contentClassName="admin-content-chat"
            showPageHeading={false}
        >
            <Head title={t('Chats')} />

            <div className="chat-split-shell">
            <section className="panel glass chat-inbox-panel">
                <PanelHeading
                    eyebrow={t('Inbox')}
                    title={t('Customer conversations')}
                    action={
                        unreadTotal > 0 ? (
                            <StatusBadge status="danger" label={t(':count unread', { count: unreadTotal })} />
                        ) : (
                            <StatusBadge status="success" label={t('All read')} />
                        )
                    }
                />

                <div className="search-box" style={{ marginBottom: 12 }}>
                    <Icon name="search" size={16} />
                    <input
                        placeholder={t('Search name or email...')}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>

                {!csrfReady || conversationsQuery.isLoading || conversationsQuery.isFetching ? (
                    <div className="chat-skeleton">
                        <div className="bar" />
                        <div className="bar" />
                        <div className="bar" />
                    </div>
                ) : conversationsQuery.isError ? (
                    <div className="flash error">{t('Failed to load conversations.')}</div>
                ) : rows.length === 0 ? (
                    <p>{t('No conversations match your search.')}</p>
                ) : (
                    <div className="chat-list">
                        {rows.map((row) => {
                            const c = row.customer;
                            const last = row.last_message;
                            const subtitle = last?.body || (last?.image_url ? t('Photo') : t('Open conversation'));
                            const active = selectedCustomer?.id === c.id;

                            return (
                                <Link
                                    key={row.conversation.id}
                                    href={routeWithBase(`/admin/chats/${c.id}`, app_base)}
                                    className={active ? 'active' : ''}
                                    onClick={(e) => {
                                        if (!isLargeScreen) return;
                                        e.preventDefault();
                                        setSelectedCustomer(c);
                                    }}
                                >
                                    <span className="avatar">
                                        {(c.name || 'C')[0]}
                                        {row.unread_count > 0 && (
                                            <span className="unread">
                                                {row.unread_count > 99 ? '99+' : row.unread_count}
                                            </span>
                                        )}
                                    </span>
                                    <span className="info">
                                        <strong>{c.name}</strong>
                                        <small>{subtitle}</small>
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                )}

                {!conversationsQuery.isFetching && meta && meta.last_page > 1 && (
                    <div className="ledger-pagination">
                        <small>
                            {t('Page :current of :last - :total conversations', { current: meta.current_page, last: meta.last_page, total: meta.total })}
                        </small>
                        <div className="pagination-links">
                            <button
                                type="button"
                                className={`pagination-link ${meta.current_page <= 1 ? 'disabled' : ''}`}
                                disabled={meta.current_page <= 1}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                            >
                                {t('Previous')}
                            </button>
                            <button
                                type="button"
                                className={`pagination-link ${meta.current_page >= meta.last_page ? 'disabled' : ''}`}
                                disabled={meta.current_page >= meta.last_page}
                                onClick={() => setPage((current) => Math.min(meta.last_page, current + 1))}
                            >
                                {t('Next')}
                            </button>
                        </div>
                    </div>
                )}
            </section>
            <div className="chat-detail-pane">
                <AdminChatPanel customer={selectedCustomer} className="chat-layout-split" />
            </div>
            </div>
        </AdminLayout>
    );
}

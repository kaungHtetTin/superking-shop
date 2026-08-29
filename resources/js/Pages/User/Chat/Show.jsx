import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, usePage } from '@/spa/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
    Alert,
    Avatar,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogContent,
    IconButton,
    LinearProgress,
    Paper,
    Skeleton,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import {
    AddPhotoAlternate,
    Close,
    DoneAll,
    ErrorOutlineOutlined,
    Send,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MOBILE_BOTTOM_NAV_HEIGHT } from '@/Components/User/MobileBottomNav';
import UserBrandHead from '@/Components/User/UserBrandHead';
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

export default function UserChatShow() {
    const theme = useTheme();
    const { app_base, auth, app_url, app_settings } = usePage().props;
    const t = usePhraseTranslation();
    const appName = app_settings?.app_name || 'Harmony House';
    const queryClient = useQueryClient();
    const pageVisible = usePageVisible();

    const scrollRef = useRef(null);
    const stickToBottomRef = useRef(true);
    const maxServerIdRef = useRef(0);

    const [messages, setMessages] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [counterpart, setCounterpart] = useState(null);
    const [draft, setDraft] = useState('');
    const [preview, setPreview] = useState(null);
    const [previewFile, setPreviewFile] = useState(null);
    const [lightbox, setLightbox] = useState(null);
    const [hasMoreOlder, setHasMoreOlder] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [uploadPct, setUploadPct] = useState(null);
    const [typingOn, setTypingOn] = useState(false);
    const [csrfReady, setCsrfReady] = useState(false);
    const [awaitingSupportEcho, setAwaitingSupportEcho] = useState(false);

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

    const overviewQuery = useQuery({
        queryKey: ['support-chat', 'customer-overview'],
        enabled: csrfReady && !!auth?.user,
        queryFn: async () => {
            const { data } = await axios.get(apiUrl('/chats', app_base));
            return data;
        },
    });

    useEffect(() => {
        const data = overviewQuery.data;
        if (!data) return;

        setConversationId(data.conversation?.id ?? null);
        setCounterpart(data.counterpart ?? null);
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setHasMoreOlder((data.messages?.length ?? 0) >= 45);
    }, [overviewQuery.dataUpdatedAt]);

    const pollQuery = useQuery({
        queryKey: ['support-chat', 'customer-latest', conversationId],
        enabled: csrfReady && !!conversationId && pageVisible,
        refetchInterval: pageVisible ? 2600 : false,
        queryFn: async () => {
            const { data } = await axios.get(apiUrl('/messages/latest', app_base), {
                params: { after_id: maxServerIdRef.current },
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
        if (!el) return;
        if (!stickToBottomRef.current) return;
        el.scrollTop = el.scrollHeight;
    }, [messages.length, typingOn]);

    const onScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
        stickToBottomRef.current = gap < 120;
    }, []);

    const sendMutation = useMutation({
        mutationFn: async ({ body, image_path, client_temp_id }) => {
            const { data } = await axios.post(apiUrl('/messages/send', app_base), {
                body,
                image_path,
                client_temp_id,
            });
            return data.message;
        },
        onSuccess: (serverMessage, vars) => {
            setMessages((prev) => replaceOptimistic(prev, vars.client_temp_id, serverMessage));
            queryClient.invalidateQueries({ queryKey: ['support-chat', 'customer-overview'] });
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
            const { data } = await axios.post(apiUrl('/messages/upload-image', app_base), fd, {
                onUploadProgress: (evt) => {
                    if (!evt.total) return;
                    const pct = Math.round((evt.loaded / evt.total) * 100);
                    setUploadPct(pct);
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
            const { data } = await axios.get(apiUrl(`/chats/${conversationId}/messages`, app_base), {
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
        if (!csrfReady) return;

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

            if (preview) {
                URL.revokeObjectURL(preview);
            }

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

            setTypingOn(false);
            sendMutation.mutate({ body: text || null, image_path, client_temp_id });

            setAwaitingSupportEcho(!!text || !!image_path);
            setDraft('');
        } catch {
            setUploadPct(null);
        }
    };

    useEffect(() => {
        if (!awaitingSupportEcho) return undefined;

        setTypingOn(true);
        const stop = window.setTimeout(() => setTypingOn(false), 4200);
        return () => window.clearTimeout(stop);
    }, [awaitingSupportEcho]);

    useEffect(() => {
        if (!counterpart?.id) return;
        const last = messages[messages.length - 1];
        if (!last) return;
        if (last.sender?.id === counterpart.id) {
            setAwaitingSupportEcho(false);
            setTypingOn(false);
        }
    }, [messages, counterpart?.id]);

    const retryOptimistic = (m) => {
        if (!m?.optimistic || !m.failed) return;
        const client_temp_id = m.client_temp_id;
        setMessages((prev) =>
            prev.map((x) =>
                x.client_temp_id === client_temp_id ? { ...x, failed: false, optimistic: true } : x,
            ),
        );

        sendMutation.mutate({
            body: m.body,
            image_path: null,
            client_temp_id,
        });
    };

    const busy =
        sendMutation.isPending ||
        uploadMutation.isPending ||
        overviewQuery.isLoading ||
        !csrfReady;

    return (
        <Box
            sx={{
                height: '100dvh',
                maxHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: 'background.default',
                /* Reserve space for fixed MobileBottomNav + safe area + small gap so composer is never hidden */
                pb: {
                    xs: `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 10px)`,
                    md: 1.5,
                },
            }}
        >
            <UserBrandHead title={t('Support Chat')} />
            <Navbar />

            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%', maxWidth: 840, mx: 'auto' }}>
                <Box sx={{ px: { xs: 1, sm: 1.5 }, pt: { xs: 1, md: 1.25 }, pb: 0.75, flexShrink: 0 }}>
                    <BackLink
                        href={routeWithBase('/profile', app_base)}
                        sx={{
                            mb: 0.75,
                            py: 0.3,
                            px: 0.4,
                            pr: 0.9,
                            fontSize: '0.68rem',
                            '& .MuiButton-startIcon span': {
                                width: 20,
                                height: 20,
                            },
                            '& .MuiSvgIcon-root': {
                                fontSize: 15,
                            },
                        }}
                    >
                        Back to profile
                    </BackLink>

                    <Paper
                        elevation={0}
                        sx={{
                            px: { xs: 1, sm: 1.1 },
                            py: { xs: 0.75, sm: 0.85 },
                            borderRadius: 1.5,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                            background: '#fff',
                            boxShadow: `0 8px 22px ${alpha(theme.palette.primary.main, 0.06)}`,
                        }}
                    >
                        <Stack direction="row" spacing={0.85} alignItems="center">
                            <Avatar
                                sx={{
                                    width: { xs: 30, sm: 32 },
                                    height: { xs: 30, sm: 32 },
                                    background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                }}
                            >
                                {(counterpart?.name || 'S')[0]}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                                    {appName} Support
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem', lineHeight: 1.3 }}>
                                    {counterpart?.name ? `${counterpart.name} • ${counterpart.role || 'support'}` : 'Connecting you with our team…'}
                                </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '0.75rem' }}>
                                    {pollQuery.isFetching ? t('Updating...') : t('Live')}
                                </Typography>
                            </Box>
                        </Stack>
                    </Paper>
                </Box>

                <Paper
                    elevation={0}
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        mx: { xs: 1, sm: 1.5 },
                        mb: { xs: 0, md: 1.25 },
                        borderRadius: 1.75,
                        overflow: 'hidden',
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                        background: '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {overviewQuery.isLoading ? (
                            <Stack spacing={0.75} sx={{ p: 1 }}>
                                <Skeleton variant="rounded" height={36} sx={{ borderRadius: 1.25 }} />
                                <Skeleton variant="rounded" height={36} sx={{ borderRadius: 1.25, alignSelf: 'flex-end', width: '78%' }} />
                                <Skeleton variant="rounded" height={36} sx={{ borderRadius: 1.25 }} />
                                <Skeleton variant="rounded" height={36} sx={{ borderRadius: 1.25, alignSelf: 'flex-end', width: '70%' }} />
                            </Stack>
                        ) : overviewQuery.isError ? (
                            <Alert severity="error" sx={{ m: 2 }}>
                                {t('Could not load chat. Please refresh the page.')}
                            </Alert>
                        ) : (
                            <>
                                <Box
                                    ref={scrollRef}
                                    onScroll={onScroll}
                                    sx={{
                                        flex: 1,
                                        minHeight: 0,
                                        overflowY: 'auto',
                                        WebkitOverflowScrolling: 'touch',
                                        px: { xs: 0.85, sm: 1.1 },
                                        py: { xs: 0.9, sm: 1 },
                                        background: 'background.default',
                                    }}
                                >
                                    {hasMoreOlder && (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.85 }}>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={loadOlder}
                                                disabled={loadingOlder}
                                                sx={{ borderRadius: 1.25, fontWeight: 700, fontSize: '0.68rem', py: 0.25 }}
                                            >
                                                {loadingOlder ? t('Loading...') : t('Load older messages')}
                                            </Button>
                                        </Box>
                                    )}

                                    <Stack spacing={0.55}>
                                        {messages.map((m) => {
                                            const mine = m.sender?.id === auth.user.id;
                                            const time = new Date(m.created_at).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            });

                                            return (
                                                <Box
                                                    key={`${m.id}-${m.client_temp_id || ''}`}
                                                    sx={{
                                                        alignSelf: mine ? 'flex-end' : 'flex-start',
                                                        maxWidth: { xs: '86%', sm: '64%' },
                                                        animation: 'fadeUp 0.22s ease both',
                                                        '@keyframes fadeUp': {
                                                            from: { opacity: 0, transform: 'translateY(10px)' },
                                                            to: { opacity: 1, transform: 'translateY(0)' },
                                                        },
                                                    }}
                                                >
                                                    <Paper
                                                        elevation={0}
                                                        sx={{
                                                            px: { xs: 0.8, sm: 0.9 },
                                                            py: { xs: 0.5, sm: 0.55 },
                                                            borderRadius: mine ? '9px 9px 3px 9px' : '9px 9px 9px 3px',
                                                            border: mine ? 'none' : `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                                            background: mine
                                                                ? `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 55%, ${theme.palette.primary.dark} 100%)`
                                                                : 'rgba(255,255,255,0.92)',
                                                            color: mine ? '#fff' : 'text.primary',
                                                            boxShadow: mine
                                                                ? `0 6px 16px ${alpha(theme.palette.primary.main, 0.2)}`
                                                                : '0 6px 18px rgba(0,0,0,0.04)',
                                                            transition: 'transform 180ms ease, box-shadow 180ms ease',
                                                            '&:hover': {
                                                                transform: 'translateY(-1px)',
                                                                boxShadow: mine
                                                                    ? `0 8px 20px ${alpha(theme.palette.primary.main, 0.24)}`
                                                                    : '0 8px 22px rgba(0,0,0,0.05)',
                                                            },
                                                            opacity: m.failed ? 0.72 : 1,
                                                        }}
                                                    >
                                                        {m.image_url ? (
                                                            <Box
                                                                component="img"
                                                                src={m.image_url}
                                                                alt=""
                                                                onClick={() => setLightbox(m.image_url)}
                                                                sx={{
                                                                    display: 'block',
                                                                    maxWidth: 'min(68vw, 260px)',
                                                                    borderRadius: 1,
                                                                    cursor: 'zoom-in',
                                                                    mb: m.body ? 0.65 : 0,
                                                                }}
                                                            />
                                                        ) : null}

                                                        {m.body ? (
                                                            <Typography
                                                                variant="body2"
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    whiteSpace: 'pre-wrap',
                                                                    fontSize: '0.875rem',
                                                                    lineHeight: 1.45,
                                                                }}
                                                            >
                                                                {m.body}
                                                            </Typography>
                                                        ) : null}

                                                        <Stack direction="row" spacing={0.45} alignItems="center" justifyContent="flex-end" sx={{ mt: 0.3 }}>
                                                            <Typography
                                                                variant="caption"
                                                                sx={{
                                                                    color: mine ? 'rgba(255,255,255,0.82)' : 'text.secondary',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.7rem',
                                                                }}
                                                            >
                                                                {time}
                                                            </Typography>
                                                            {mine ? (
                                                                m.seen_at ? (
                                                                    <DoneAll sx={{ fontSize: 13, color: 'rgba(255,255,255,0.92)' }} />
                                                                ) : (
                                                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.78)', fontWeight: 700, fontSize: '0.7rem' }}>
                                                                        {t('Sent')}
                                                                    </Typography>
                                                                )
                                                            ) : null}
                                                            {mine && m.failed ? (
                                                                <Button
                                                                    size="small"
                                                                    color="inherit"
                                                                    startIcon={<ErrorOutlineOutlined />}
                                                                    onClick={() => retryOptimistic(m)}
                                                                    sx={{ fontWeight: 700, color: '#fff' }}
                                                                >
                                                                    {t('Retry')}
                                                                </Button>
                                                            ) : null}
                                                        </Stack>
                                                    </Paper>
                                                </Box>
                                            );
                                        })}
                                    </Stack>

                                    {typingOn && (
                                        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.85, opacity: 0.85 }}>
                                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '0.65rem' }}>
                                                Support is typing
                                            </Typography>
                                            <Stack direction="row" spacing={0.5}>
                                                {[0, 1, 2].map((i) => (
                                                    <Box
                                                        key={i}
                                                        sx={{
                                                            width: 5,
                                                            height: 5,
                                                            borderRadius: 999,
                                                            bgcolor: 'primary.main',
                                                            animation: 'pulse 1.1s ease-in-out infinite',
                                                            animationDelay: `${i * 0.15}s`,
                                                            '@keyframes pulse': {
                                                                '0%, 100%': { opacity: 0.25, transform: 'translateY(0)' },
                                                                '50%': { opacity: 1, transform: 'translateY(-3px)' },
                                                            },
                                                        }}
                                                    />
                                                ))}
                                            </Stack>
                                        </Stack>
                                    )}
                                </Box>

                                {preview ? (
                                    <Box sx={{ px: { xs: 0.9, sm: 1.1 }, pt: 0.55, flexShrink: 0 }}>
                                        <Paper
                                            variant="outlined"
                                            sx={{
                                                p: 0.55,
                                                borderRadius: 1.25,
                                                borderColor: alpha(theme.palette.primary.main, 0.22),
                                                position: 'relative',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    URL.revokeObjectURL(preview);
                                                    setPreview(null);
                                                    setPreviewFile(null);
                                                }}
                                                sx={{
                                                    position: 'absolute',
                                                    top: 5,
                                                    right: 5,
                                                    bgcolor: 'rgba(255,255,255,0.85)',
                                                    width: 30,
                                                    height: 30,
                                                    p: 0,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    '& .MuiSvgIcon-root': { display: 'block' },
                                                }}
                                            >
                                                <Close sx={{ fontSize: 17 }} />
                                            </IconButton>
                                            <Box
                                                component="img"
                                                src={preview}
                                                alt=""
                                                sx={{ width: '100%', maxHeight: 150, objectFit: 'cover', borderRadius: 1 }}
                                            />
                                        </Paper>
                                    </Box>
                                ) : null}

                                {uploadPct !== null && uploadPct < 100 ? (
                                    <Box sx={{ px: { xs: 0.9, sm: 1.1 }, pt: 0.55, flexShrink: 0 }}>
                                        <LinearProgress variant="determinate" value={uploadPct} sx={{ borderRadius: 1, height: 4 }} />
                                        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mt: 0.45, fontSize: '0.65rem' }}>
                                            {t('Uploading...')} {uploadPct}%
                                        </Typography>
                                    </Box>
                                ) : null}

                                <Box
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const f = e.dataTransfer.files?.[0];
                                        if (f && /^image\/(jpeg|png|webp)$/i.test(f.type)) pickImage(f);
                                    }}
                                    sx={{
                                        flexShrink: 0,
                                        zIndex: 6,
                                        borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                                        background: '#fff',
                                        px: { xs: 0.75, sm: 0.95 },
                                        py: { xs: 0.65, sm: 0.75 },
                                        pb: { xs: 'calc(7px + env(safe-area-inset-bottom, 0px))', sm: 0.8 },
                                    }}
                                >
                                    <Stack direction="row" spacing={0.55} alignItems="center">
                                        <IconButton
                                            component="label"
                                            sx={{
                                                width: 44,
                                                height: 44,
                                                p: 0,
                                                flexShrink: 0,
                                                borderRadius: 1.5,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                                                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
                                                '& .MuiSvgIcon-root': { display: 'block', fontSize: 18 },
                                            }}
                                            aria-label={t('Upload image')}
                                        >
                                            <AddPhotoAlternate />
                                            <input
                                                hidden
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                onChange={(e) => pickImage(e.target.files?.[0])}
                                            />
                                        </IconButton>

                                        <TextField
                                            fullWidth
                                            multiline
                                            maxRows={4}
                                            placeholder={t('Message...')}
                                            value={draft}
                                            onChange={(e) => setDraft(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    sendNow();
                                                }
                                            }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 1.5,
                                                    backgroundColor: 'rgba(255,255,255,0.92)',
                                                    fontSize: '0.875rem',
                                                    minHeight: 44,
                                                    px: { xs: 1, sm: 1.1 },
                                                    py: 0,
                                                },
                                                '& .MuiOutlinedInput-input': {
                                                    py: 0.72,
                                                    px: 0,
                                                    lineHeight: 1.35,
                                                },
                                                '& .MuiInputBase-input::placeholder': {
                                                    fontSize: '0.875rem',
                                                    opacity: 0.72,
                                                },
                                            }}
                                        />

                                        <IconButton
                                            color="primary"
                                            onClick={sendNow}
                                            disabled={busy || (!draft.trim() && !previewFile)}
                                            sx={{
                                                width: 44,
                                                height: 44,
                                                p: 0,
                                                flexShrink: 0,
                                                borderRadius: 1.5,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
                                                color: '#fff',
                                                boxShadow: `0 8px 18px ${alpha(theme.palette.primary.main, 0.24)}`,
                                                '&:hover': {
                                                    background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.dark} 100%)`,
                                                },
                                                '&.Mui-disabled': {
                                                    background: 'rgba(0,0,0,0.08)',
                                                    color: 'rgba(0,0,0,0.26)',
                                                    boxShadow: 'none',
                                                },
                                                '& .MuiSvgIcon-root': { display: 'block', fontSize: 18 },
                                            }}
                                            aria-label={t('Send')}
                                        >
                                            {sendMutation.isPending || uploadMutation.isPending ? (
                                                <CircularProgress size={18} thickness={5} sx={{ color: '#fff' }} />
                                            ) : (
                                                <Send />
                                            )}
                                        </IconButton>
                                    </Stack>
                                </Box>
                            </>
                        )}
                    </Box>
                </Paper>
            </Box>

            <Dialog open={!!lightbox} onClose={() => setLightbox(null)} maxWidth="lg" fullWidth>
                <DialogContent sx={{ p: 1, bgcolor: 'rgba(0,0,0,0.92)' }}>
                    {lightbox ? (
                        <Box
                            component="img"
                            src={lightbox}
                            alt=""
                            sx={{ width: '100%', height: 'auto', display: 'block', borderRadius: 1 }}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>

            <MobileBottomNav />
        </Box>
    );
}

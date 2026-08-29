import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@/spa/router';

const normalizeIds = (ids = []) => [...new Set(ids.map((id) => Number(id)).filter(Boolean))];

const reloadPage = (only) => {
    router.reload({
        only,
        preserveScroll: true,
        preserveState: true,
        showSkeleton: false,
    });
};

export default function useInventoryRealtime({
    locationIds = [],
    includeAll = false,
    productId = null,
    transferId = null,
    only = [],
    pollIntervalMs = 20000,
    listenBalance = true,
    listenTransfers = true,
    disabled = false,
} = {}) {
    const normalizedLocationIds = useMemo(() => normalizeIds(locationIds), [locationIds]);
    const [state, setState] = useState(() => (window.Echo ? 'connecting' : 'polling'));
    const [lastEventAt, setLastEventAt] = useState(null);
    const reloadTimer = useRef(null);

    const scheduleReload = (eventAt = new Date().toISOString()) => {
        setLastEventAt(eventAt);
        window.clearTimeout(reloadTimer.current);
        reloadTimer.current = window.setTimeout(() => reloadPage(only), 200);
    };

    useEffect(() => () => window.clearTimeout(reloadTimer.current), []);

    useEffect(() => {
        if (disabled) return undefined;

        const echo = window.Echo;
        if (!echo) {
            setState('polling');
            return undefined;
        }

        const channelNames = includeAll ? ['inventory.all'] : normalizedLocationIds.map((id) => `inventory.location.${id}`);
        if (channelNames.length === 0) {
            setState('idle');
            return undefined;
        }

        const onBalanceChanged = (payload) => {
            if (productId && Number(payload.product_id) !== Number(productId)) return;
            scheduleReload(payload.event_time);
        };
        const onTransferChanged = (payload) => {
            if (transferId && Number(payload.transfer_id) !== Number(transferId)) return;
            scheduleReload(payload.event_time);
        };

        channelNames.forEach((name) => {
            const channel = echo.private(name);
            if (listenBalance) channel.listen('.inventory.balance.changed', onBalanceChanged);
            if (listenTransfers) channel.listen('.inventory.transfer.status.changed', onTransferChanged);
        });

        const connection = echo.connector?.pusher?.connection;
        const updateConnectionState = ({ current } = {}) => setState(current || connection?.state || 'connected');
        if (connection) {
            setState(connection.state || 'connecting');
            connection.bind('state_change', updateConnectionState);
        } else {
            setState('connected');
        }

        return () => {
            if (connection) {
                connection.unbind('state_change', updateConnectionState);
            }
            channelNames.forEach((name) => echo.leave(name));
        };
    }, [
        disabled,
        includeAll,
        listenBalance,
        listenTransfers,
        normalizedLocationIds.join(','),
        only.join(','),
        productId,
        transferId,
    ]);

    useEffect(() => {
        if (disabled || !pollIntervalMs) return undefined;

        const shouldPoll = !window.Echo || !['connected', 'connecting'].includes(state);
        if (!shouldPoll) return undefined;

        const timer = window.setInterval(() => reloadPage(only), pollIntervalMs);
        return () => window.clearInterval(timer);
    }, [disabled, only.join(','), pollIntervalMs, state]);

    return { state, lastEventAt };
}

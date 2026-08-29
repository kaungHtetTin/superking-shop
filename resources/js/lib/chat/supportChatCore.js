import axios from 'axios';
import { routeWithBase } from '@/Utils/url';

export async function ensureSanctumCookie(appBase) {
    await axios.get(routeWithBase('/sanctum/csrf-cookie', appBase));
}

export async function compressImageFile(file, { maxEdge = 1680, quality = 0.82 } = {}) {
    try {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0, w, h);
        bmp.close();

        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, mime, mime === 'image/png' ? undefined : quality),
        );
        if (!blob) return file;

        const name = `${file.name.replace(/\.[^.]+$/, '')}${mime === 'image/png' ? '.png' : '.jpg'}`;
        return new File([blob], name, { type: blob.type });
    } catch {
        return file;
    }
}

export function mergeIncomingMessages(prev, incoming) {
    if (!incoming?.length) return prev;

    let next = [...prev];

    for (const m of incoming) {
        next = next.filter(
            (x) =>
                !(x?.optimistic && x?.client_temp_id && m?.client_temp_id && x.client_temp_id === m.client_temp_id),
        );

        const idx = next.findIndex((x) => String(x.id) === String(m.id));
        if (idx >= 0) next[idx] = { ...m, optimistic: false, failed: false };
        else next.push({ ...m, optimistic: false, failed: false });
    }

    next.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    return next;
}

export function replaceOptimistic(prev, clientTempId, serverMessage) {
    const next = prev.map((m) =>
        m.optimistic && m.client_temp_id === clientTempId ? { ...serverMessage, optimistic: false, failed: false } : m,
    );

    if (!next.some((m) => String(m.id) === String(serverMessage.id))) {
        next.push({ ...serverMessage, optimistic: false, failed: false });
    }

    next.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    return next;
}

export function markOptimisticFailed(prev, clientTempId) {
    return prev.map((m) => (m.optimistic && m.client_temp_id === clientTempId ? { ...m, failed: true } : m));
}

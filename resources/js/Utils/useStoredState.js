import { useEffect, useState } from 'react';

export function useStoredState(key, defaultValue) {
    const read = () => {
        if (typeof window === 'undefined') return defaultValue;
        try {
            const raw = window.localStorage.getItem(key);
            return raw !== null ? JSON.parse(raw) : defaultValue;
        } catch {
            return defaultValue;
        }
    };

    const [value, setValue] = useState(read);

    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // ignore quota / private mode
        }
    }, [key, value]);

    return [value, setValue];
}

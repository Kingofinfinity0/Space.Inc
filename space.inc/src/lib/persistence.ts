import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'space.inc';

type PersistedEnvelope<T> = {
    version: number;
    value: T;
    updatedAt: string;
};

type PersistOptions<T> = {
    version?: number;
    validate?: (value: unknown) => value is T;
};

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const storageKey = (key: string) => `${STORAGE_PREFIX}.${key}`;

export function readPersistedValue<T>(key: string, fallback: T, options: PersistOptions<T> = {}): T {
    if (!canUseStorage()) return fallback;

    try {
        const raw = window.localStorage.getItem(storageKey(key));
        if (!raw) return fallback;

        const parsed = JSON.parse(raw) as PersistedEnvelope<T> | T;
        const version = options.version ?? 1;
        const value = typeof parsed === 'object' && parsed !== null && 'value' in parsed
            ? (parsed as PersistedEnvelope<T>).value
            : parsed;
        const storedVersion = typeof parsed === 'object' && parsed !== null && 'version' in parsed
            ? (parsed as PersistedEnvelope<T>).version
            : 1;

        if (storedVersion !== version) return fallback;
        if (options.validate && !options.validate(value)) return fallback;

        return value as T;
    } catch {
        return fallback;
    }
}

export function writePersistedValue<T>(key: string, value: T, options: PersistOptions<T> = {}) {
    if (!canUseStorage()) return;

    try {
        const envelope: PersistedEnvelope<T> = {
            version: options.version ?? 1,
            value,
            updatedAt: new Date().toISOString()
        };
        window.localStorage.setItem(storageKey(key), JSON.stringify(envelope));
    } catch {
        // Ignore quota and private-mode failures; persistence should never block the UI.
    }
}

export function removePersistedValue(key: string) {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(storageKey(key));
}

export function usePersistentState<T>(
    key: string,
    fallback: T,
    options: PersistOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => readPersistedValue(key, fallback, options));

    useEffect(() => {
        setValue(readPersistedValue(key, fallback, options));
    }, [key, options.version]);

    const setPersistedValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
        setValue((current) => {
            const resolved = typeof next === 'function' ? (next as (current: T) => T)(current) : next;
            writePersistedValue(key, resolved, options);
            return resolved;
        });
    }, [key, options.version]);

    return [value, setPersistedValue];
}

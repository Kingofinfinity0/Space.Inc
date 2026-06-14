import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isOneOf, patchSearchParams } from '../lib/urlState';

type SetUrlParamOptions = {
    replace?: boolean;
};

type UrlParamStateOptions<T extends string> = {
    allowedValues?: readonly T[];
    enabled?: boolean;
    removeWhenDefault?: boolean;
    replace?: boolean;
};

export function useUrlParamState<T extends string>(
    paramName: string,
    defaultValue: T,
    options: UrlParamStateOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>] {
    const location = useLocation();
    const navigate = useNavigate();
    const enabled = options.enabled ?? true;
    const replace = options.replace ?? true;
    const removeWhenDefault = options.removeWhenDefault ?? true;

    const readFromUrl = useCallback(() => {
        if (!enabled) return defaultValue;

        const value = new URLSearchParams(location.search).get(paramName);
        if (!value) return defaultValue;
        if (options.allowedValues && !isOneOf(value, options.allowedValues)) return defaultValue;
        return value as T;
    }, [defaultValue, enabled, location.search, options.allowedValues, paramName]);

    const [value, setValue] = useState<T>(() => readFromUrl());

    useEffect(() => {
        setValue(readFromUrl());
    }, [readFromUrl]);

    const setUrlValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
        setValue((current) => {
            const resolved = typeof next === 'function' ? (next as (current: T) => T)(current) : next;
            if (!enabled) return resolved;

            const updates: Record<string, string | null> = {
                [paramName]: removeWhenDefault && resolved === defaultValue ? null : resolved
            };
            const nextSearch = patchSearchParams(location.search, updates);
            navigate(
                {
                    pathname: location.pathname,
                    search: nextSearch,
                    hash: location.hash
                },
                { replace: replace }
            );
            return resolved;
        });
    }, [defaultValue, enabled, location.hash, location.pathname, location.search, navigate, paramName, removeWhenDefault, replace]);

    return [value, setUrlValue];
}

export function useSetUrlParam() {
    const location = useLocation();
    const navigate = useNavigate();

    return useCallback((
        updates: Record<string, string | number | boolean | null | undefined>,
        options: SetUrlParamOptions = {}
    ) => {
        const nextSearch = patchSearchParams(location.search, updates);
        navigate(
            {
                pathname: location.pathname,
                search: nextSearch,
                hash: location.hash
            },
            { replace: options.replace ?? true }
        );
    }, [location.hash, location.pathname, location.search, navigate]);
}

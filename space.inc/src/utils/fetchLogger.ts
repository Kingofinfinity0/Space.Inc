// Global Fetch Logger - Add to App.tsx bootstrap
// This detects phantom POST / requests

export function initializeFetchLogger() {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
        const [resource, config] = args;
        let url = '';
        if (typeof resource === 'string') {
            url = resource;
        } else if (resource instanceof URL) {
            url = resource.href;
        } else {
            url = (resource as Request).url;
        }
        const method = config?.method || 'GET';

        console.log('🚨 FETCH CALL DETECTED:', {
            method,
            url,
            stack: new Error().stack?.split('\n').slice(2, 5).join('\n')
        });

        // Highlight suspicious calls
        if (url === '/' || url === '') {
            console.error('⚠️ PHANTOM REQUEST TO ROOT:', {
                method,
                url,
                fullStack: new Error().stack
            });
        }

        return originalFetch(...args);
    };

    console.log('🔍 Global fetch logger initialized');
}

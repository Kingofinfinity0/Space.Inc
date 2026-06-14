import { ViewState } from '../types';

export type SpaceDetailTab = 'Dashboard' | 'Chat' | 'Meetings' | 'Tasks' | 'Docs';

export const SPACE_DETAIL_TABS: SpaceDetailTab[] = ['Dashboard', 'Chat', 'Meetings', 'Tasks', 'Docs'];

export const VIEW_STATE_TO_URL: Record<ViewState, string> = {
    [ViewState.DASHBOARD]: 'dashboard',
    [ViewState.SPACES]: 'spaces',
    [ViewState.SPACE_DETAIL]: 'space',
    [ViewState.INBOX]: 'inbox',
    [ViewState.MEETINGS]: 'meetings',
    [ViewState.FILES]: 'files',
    [ViewState.TASKS]: 'tasks',
    [ViewState.STAFF]: 'staff',
    [ViewState.SETTINGS]: 'settings',
    [ViewState.ACTIVITY_LEDGER]: 'dashboard',
    [ViewState.CLIENTS]: 'clients'
};

export const URL_TO_VIEW_STATE = Object.entries(VIEW_STATE_TO_URL).reduce<Record<string, ViewState>>(
    (acc, [state, value]) => {
        if (state === ViewState.ACTIVITY_LEDGER) return acc;
        acc[value] = state as ViewState;
        return acc;
    },
    {}
);

export type WorkspaceUrlState = {
    view: ViewState;
    selectedSpaceId: string | null;
    selectedSpaceTab: SpaceDetailTab;
    workspaceKey: string | null;
};

export const isOneOf = <T extends string>(value: string | null, values: readonly T[]): value is T => (
    Boolean(value && values.includes(value as T))
);

export function parseWorkspaceUrlState(search: string): WorkspaceUrlState {
    const params = new URLSearchParams(search);
    const viewParam = params.get('view');
    const selectedSpaceId = params.get('space') || params.get('project');
    const inferredView = selectedSpaceId ? ViewState.SPACE_DETAIL : ViewState.DASHBOARD;
    const parsedView = viewParam && URL_TO_VIEW_STATE[viewParam] ? URL_TO_VIEW_STATE[viewParam] : inferredView;
    const activeView = parsedView === ViewState.ACTIVITY_LEDGER ? ViewState.DASHBOARD : parsedView;
    const view = activeView === ViewState.SPACE_DETAIL && !selectedSpaceId ? ViewState.DASHBOARD : activeView;
    const tabParam = params.get('tab');

    return {
        view,
        selectedSpaceId,
        selectedSpaceTab: isOneOf(tabParam, SPACE_DETAIL_TABS) ? tabParam : 'Dashboard',
        workspaceKey: params.get('workspace')
    };
}

export function patchSearchParams(
    search: string,
    updates: Record<string, string | number | boolean | null | undefined>,
    defaults: Record<string, string | number | boolean | null | undefined> = {}
) {
    const params = new URLSearchParams(search);

    Object.entries(updates).forEach(([key, value]) => {
        const normalized = value === undefined || value === null ? '' : String(value);
        const defaultValue = defaults[key];

        if (!normalized || (defaultValue !== undefined && normalized === String(defaultValue))) {
            params.delete(key);
            return;
        }

        params.set(key, normalized);
    });

    params.sort();
    const next = params.toString();
    return next ? `?${next}` : '';
}

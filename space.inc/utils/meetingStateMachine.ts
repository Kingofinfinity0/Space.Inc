// Meeting State Machine
// Single source of truth for meeting lifecycle

export enum MeetingState {
    IDLE = 'IDLE',
    JOINING = 'JOINING',
    JOINED = 'JOINED',
    LEAVING = 'LEAVING',
    LEFT = 'LEFT',
    ERROR = 'ERROR'
}

export interface MeetingStateContext {
    state: MeetingState;
    error?: string;
    joinedAt?: number;
    leftAt?: number;
}

export function getInitialState(): MeetingStateContext {
    return {
        state: MeetingState.IDLE
    };
}

export function canJoin(state: MeetingState): boolean {
    return state === MeetingState.IDLE || state === MeetingState.LEFT || state === MeetingState.ERROR;
}

export function canLeave(state: MeetingState): boolean {
    return state === MeetingState.JOINED;
}

export function isLoading(state: MeetingState): boolean {
    return state === MeetingState.JOINING || state === MeetingState.LEAVING;
}

export function isInMeeting(state: MeetingState): boolean {
    return state === MeetingState.JOINED;
}

export const isSafeInviteRedirect = (path: string | null | undefined) => {
  return typeof path === 'string' && (path.startsWith('/invite/') || path.startsWith('/join/'));
};

export const getSafeInviteRedirect = (path: string | null | undefined) => {
  return isSafeInviteRedirect(path) ? path : null;
};

export const getInvitePath = (token: string) => {
  return `/invite/${encodeURIComponent(token)}`;
};

export const getJoinPath = (token: string) => {
  return `/join/${encodeURIComponent(token)}`;
};

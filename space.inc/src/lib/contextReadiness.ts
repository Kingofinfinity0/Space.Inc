import { ContextsResponse, UserContext } from '../types/context';

export type ContextReadinessKind =
  | 'invalid'
  | 'no_contexts'
  | 'switcher_required'
  | 'activation_required'
  | 'auto_route_safe'
  | 'not_ready';

export interface ContextReadinessDecision {
  kind: ContextReadinessKind;
  reason: string;
}

export const normalizeWorkspaceRoute = (path?: string | null) => {
  if (!path) return null;

  const clientSpaceMatch = path.match(/^\/client\/space\/([^/?#]+)(.*)?$/);
  if (clientSpaceMatch) {
    return `/spaces/${clientSpaceMatch[1]}${clientSpaceMatch[2] || ''}`;
  }

  return path;
};

export const getAvailableContexts = (contexts: ContextsResponse | null | undefined): UserContext[] => {
  if (!contexts) return [];
  return [...(contexts.org_contexts || []), ...(contexts.client_contexts || [])];
};

export const getSingleAvailableContext = (contexts: ContextsResponse | null | undefined) => {
  const available = getAvailableContexts(contexts);
  return available.length === 1 ? available[0] : null;
};

export const isContextAvailable = (
  context: UserContext | null | undefined,
  contexts: ContextsResponse | null | undefined
) => {
  if (!context) return false;
  return getAvailableContexts(contexts).some(
    (availableContext) =>
      availableContext.context_type === context.context_type &&
      availableContext.context_id === context.context_id
  );
};

export const getContextRoute = (context: UserContext | null | undefined) => {
  if (!context) return null;

  if (context.context_type === 'client_space') {
    return normalizeWorkspaceRoute(context.route) || `/spaces/${context.space_id || context.context_id}`;
  }

  return normalizeWorkspaceRoute(context.route) || '/dashboard';
};

const hasReadinessContract = (contexts: ContextsResponse) =>
  Boolean(contexts.available && contexts.activation);

export const getContextReadinessDecision = (
  contexts: ContextsResponse | null | undefined
): ContextReadinessDecision => {
  if (!contexts || contexts.success === false) {
    return { kind: 'invalid', reason: 'Context response was missing or unsuccessful.' };
  }

  if (contexts.available?.has_zero === true) {
    return { kind: 'no_contexts', reason: 'No usable contexts are available.' };
  }

  if (contexts.activation?.switcher_required === true) {
    return { kind: 'switcher_required', reason: 'Multiple usable contexts require an explicit user choice.' };
  }

  if (contexts.activation?.required === true) {
    return { kind: 'activation_required', reason: 'A usable context exists, but the active snapshot is not ready.' };
  }

  if (contexts.activation?.auto_route_safe === true) {
    return { kind: 'auto_route_safe', reason: 'Exactly one usable context exists and the active snapshot matches it.' };
  }

  if (hasReadinessContract(contexts)) {
    return { kind: 'not_ready', reason: 'Readiness fields are present but no safe routing state was advertised.' };
  }

  // Legacy compatibility only for older deployments that do not expose readiness fields.
  if (contexts.total === 0 || contexts.routing === 'onboarding') {
    return { kind: 'no_contexts', reason: 'Legacy context response reported onboarding.' };
  }

  if (contexts.routing === 'switcher') {
    return { kind: 'switcher_required', reason: 'Legacy context response reported multiple choices.' };
  }

  if (contexts.routing === 'auto_org' || contexts.routing === 'auto_client') {
    return { kind: 'auto_route_safe', reason: 'Legacy context response reported a single auto-route context.' };
  }

  return { kind: 'not_ready', reason: 'No route-ready state could be derived.' };
};

export const getActivationTarget = (contexts: ContextsResponse | null | undefined) => {
  const decision = getContextReadinessDecision(contexts);
  if (decision.kind !== 'activation_required') return null;
  return getSingleAvailableContext(contexts);
};

export const getAutoRouteTarget = (contexts: ContextsResponse | null | undefined) => {
  const decision = getContextReadinessDecision(contexts);
  if (decision.kind !== 'auto_route_safe') return null;
  return getSingleAvailableContext(contexts);
};

export const getActiveSnapshotContext = (contexts: ContextsResponse | null | undefined) => {
  if (!contexts?.active_snapshot?.matches_available) return null;

  const { role, organization_id: organizationId } = contexts.active_snapshot;
  if (!role || !organizationId) return null;

  if (role === 'client') {
    const matches = (contexts.client_contexts || []).filter((context) => context.org_id === organizationId);
    return matches.length === 1 ? matches[0] : null;
  }

  const matches = (contexts.org_contexts || []).filter(
    (context) => context.org_id === organizationId && context.context_role === role
  );
  return matches.length === 1 ? matches[0] : null;
};

export const getRouteFromReadiness = (
  contexts: ContextsResponse | null | undefined,
  fallbackRoute = '/dashboard'
) => {
  const decision = getContextReadinessDecision(contexts);

  if (decision.kind === 'invalid') return null;
  if (decision.kind === 'no_contexts') return '/spaces/pending';
  if (decision.kind === 'switcher_required') return '/dashboard';

  const singleContext = getSingleAvailableContext(contexts);

  if (decision.kind === 'activation_required' || decision.kind === 'not_ready') {
    if (singleContext) {
      return getContextRoute(singleContext) || fallbackRoute;
    }
    const available = getAvailableContexts(contexts);
    if (available.length > 1) return '/dashboard';
    if (available.length === 1) {
      return getContextRoute(available[0]) || fallbackRoute;
    }
    return decision.kind === 'activation_required' ? '/spaces/pending' : null;
  }

  const target = getAutoRouteTarget(contexts);
  return getContextRoute(target) || fallbackRoute;
};

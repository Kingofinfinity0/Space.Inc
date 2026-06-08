import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Link as LinkIcon, Search, UserPlus, Users, X } from 'lucide-react';
import { Button, LoadingScreen, Text, useLoadingScreenGate } from '@/components/UI';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/apiService';
import type { StaffMember } from '@/types';
import {
  useCreateInvitation,
  usePendingInvitations,
  useRotateShareLink,
  useShareLink,
  useSpaceMembers,
  useUpdateShareLinkConfig,
} from '@/hooks/useInvitationQueries';
import { getInviteErrorCode, getJoinUrl, inviteErrorMessages, InviteMemberType } from './inviteTypes';

type InviteMemberModalProps = {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  forcedMemberType?: InviteMemberType;
  initialClientToken?: string | null;
};

type InviteMemberCardProps = {
  spaceId: string;
  forcedMemberType?: InviteMemberType;
  initialClientToken?: string | null;
  className?: string;
  compact?: boolean;
};

type InviteTab = 'client' | 'staff';

const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();

const getInitials = (name?: string | null, email?: string | null) => {
  const label = name || email || 'Member';
  return label
    .split(/[.@\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'M';
};

const teamRoleOptions = [
  { value: 'member', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
] as const;

export const InviteMemberCard: React.FC<InviteMemberCardProps> = ({
  spaceId,
  forcedMemberType,
  initialClientToken,
  className = '',
  compact = false,
}) => {
  const { organizationId } = useAuth();
  const createInvitation = useCreateInvitation(spaceId);
  const updateShareLink = useUpdateShareLinkConfig(spaceId);
  const rotateShareLink = useRotateShareLink(spaceId);
  const { data: shareLink, isLoading: shareLinkLoading } = useShareLink(spaceId);
  const { data: existingMembers = [] } = useSpaceMembers(spaceId);
  const { data: pendingInvitations = [] } = usePendingInvitations(spaceId);

  const [activeTab, setActiveTab] = useState<InviteTab>(forcedMemberType || 'client');
  const [tabMotion, setTabMotion] = useState<InviteTab>(forcedMemberType || 'client');
  const [teamMembers, setTeamMembers] = useState<StaffMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [roleByEmail, setRoleByEmail] = useState<Record<string, 'member' | 'admin'>>({});
  const [rawToken, setRawToken] = useState(initialClientToken || '');
  const [teamNotice, setTeamNotice] = useState('');
  const teamLoadingGate = useLoadingScreenGate(teamLoading);
  const [error, setError] = useState('');
  const attemptedAutoLink = useRef(false);

  useEffect(() => {
    const nextTab = forcedMemberType || 'client';
    setActiveTab(nextTab);
    setTabMotion(nextTab);
  }, [forcedMemberType]);

  useEffect(() => {
    if (initialClientToken) setRawToken(initialClientToken);
  }, [initialClientToken]);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;

    const loadTeamMembers = async () => {
      setTeamLoading(true);
      try {
        const result = await apiService.getStaffMembers(organizationId);
        if (!cancelled) setTeamMembers(Array.isArray(result) ? result : []);
      } catch {
        if (!cancelled) setError('Failed to load team members.');
      } finally {
        if (!cancelled) setTeamLoading(false);
      }
    };

    void loadTeamMembers();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (forcedMemberType === 'staff') return;
    if (activeTab !== 'client') return;
    if (rawToken || initialClientToken || attemptedAutoLink.current) return;
    if (shareLinkLoading) return;

    attemptedAutoLink.current = true;
    const prepareClientLink = async () => {
      setError('');
      try {
        await updateShareLink.mutateAsync({
          default_member_type: 'client',
          default_role: 'member',
        });
        const result = await rotateShareLink.mutateAsync();
        setRawToken(result?.raw_token || '');
      } catch (err) {
        const code = getInviteErrorCode(err);
        setError(code ? inviteErrorMessages[code] : 'Failed to prepare client invite link.');
      }
    };

    void prepareClientLink();
  }, [activeTab, forcedMemberType, initialClientToken, rawToken, rotateShareLink, shareLinkLoading, updateShareLink]);

  const memberEmails = useMemo(() => {
    return new Set(existingMembers.map((member) => normalizeEmail(member.email || member.profiles?.email)));
  }, [existingMembers]);

  const pendingEmails = useMemo(() => {
    return new Set(pendingInvitations.map((invite) => normalizeEmail(invite.email)));
  }, [pendingInvitations]);

  const filteredTeamMembers = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    return teamMembers
      .filter((member) => member.is_active !== false)
      .filter((member) => {
        if (!query) return true;
        return `${member.full_name || ''} ${member.email || ''}`.toLowerCase().includes(query);
      });
  }, [teamMembers, teamSearch]);

  const inviteTeamMember = async (member: StaffMember) => {
    const email = member.email;
    const normalizedEmail = normalizeEmail(email);
    if (!email) return;

    if (memberEmails.has(normalizedEmail)) {
      setError('This team member is already in the space.');
      return;
    }

    if (pendingEmails.has(normalizedEmail)) {
      setError(inviteErrorMessages.INVITE_ALREADY_PENDING);
      return;
    }

    setError('');
    setTeamNotice('');
    try {
      const role = roleByEmail[normalizedEmail] || 'member';
      await createInvitation.mutateAsync({ email, memberType: 'staff', role });
      setTeamNotice(`Notification sent to ${member.full_name || email}.`);
    } catch (err) {
      const code = getInviteErrorCode(err);
      setError(code ? inviteErrorMessages[code] : 'Failed to invite team member.');
    }
  };

  const clientUrl = rawToken ? getJoinUrl(rawToken) : '';
  const activeTitle = activeTab === 'client' ? 'Invite Client/s' : 'Invite Team Member';
  const activeSubtitle =
    activeTab === 'client'
      ? 'Share a standing link with clients so they can enter this space.'
      : 'Notify an existing team member to accept access to this space.';

  return (
    <section className={`flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white ${className}`}>
      <div className={`shrink-0 border-b border-[#EDEDED] ${compact ? 'px-4 py-3' : 'px-6 pt-6 pb-5'}`}>
        <div className="flex items-start gap-3">
          <div className={`${compact ? 'h-10 w-10 rounded-[12px]' : 'h-14 w-14 rounded-[16px]'} flex shrink-0 items-center justify-center border border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]`}>
            <UserPlus size={compact ? 19 : 25} />
          </div>
          <div className="min-w-0">
            <h2 className={`${compact ? 'text-[17px]' : 'text-[25px]'} font-semibold leading-tight tracking-[-0.04em] text-[#0D0D0D]`}>
              {activeTitle}
            </h2>
            <Text variant="secondary" className={`${compact ? 'mt-1 line-clamp-2 text-xs' : 'mt-1 text-[15px]'} leading-relaxed`}>
              {activeSubtitle}
            </Text>
          </div>
        </div>

        {!forcedMemberType ? (
          <div className={`${compact ? 'mt-3' : 'mt-5'} relative grid grid-cols-2 overflow-hidden rounded-[14px] bg-[#F2F2F3] p-1`}>
            <span
              className="absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-[11px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform duration-[920ms] ease-[cubic-bezier(0.2,0.86,0.24,1)]"
              style={{
                transform: activeTab === 'staff' ? 'translateX(100%)' : 'translateX(0)',
                animation:
                  tabMotion === 'staff'
                    ? 'invite-tab-slide-right 920ms cubic-bezier(0.2,0.86,0.24,1)'
                    : 'invite-tab-slide-left 920ms cubic-bezier(0.2,0.86,0.24,1)',
              }}
              aria-hidden="true"
            />
            {[
              { key: 'client' as const, label: 'Clients', icon: LinkIcon },
              { key: 'staff' as const, label: 'Team Members', icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    if (tab.key !== activeTab) setTabMotion(tab.key);
                    setActiveTab(tab.key);
                    setError('');
                    setTeamNotice('');
                  }}
                  className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-[11px] px-2 py-2 text-xs font-semibold transition-colors duration-500 ease-[cubic-bezier(0.2,0.86,0.24,1)] ${
                    isActive ? 'text-[#0D0D0D]' : 'text-[#6E6E80] hover:text-[#0D0D0D]'
                  }`}
                >
                  <Icon size={14} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className={`${compact ? 'p-4' : 'p-6'} min-h-0 flex-1 overflow-y-auto`}>
        <div key={activeTab} className="animate-[invite-content-in_620ms_cubic-bezier(0.2,0.86,0.24,1)]">
          {activeTab === 'client' ? (
          <div>
            <p className="mb-2 px-0.5 text-[12px] font-semibold tracking-normal text-[#6E6E80]">Client Invite Link</p>
            <div className="rounded-[14px] border border-[#E5E5E5] bg-[#FAFAFA] p-3">
              {clientUrl ? (
                <>
                  <div className="flex items-center gap-2">
                    <LinkIcon size={15} className="shrink-0 text-[#6E6E80]" />
                    <input
                      readOnly
                      value={clientUrl}
                      className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[#0D0D0D] outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(clientUrl)}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-xs font-semibold text-[#0D0D0D] transition hover:bg-[#F7F7F8]"
                  >
                    Copy link
                  </button>
                </>
              ) : (
                <div className="text-sm text-[#6E6E80]">
                  {shareLinkLoading || rotateShareLink.isPending || updateShareLink.isPending
                    ? 'Preparing client invite link...'
                    : shareLink?.is_active
                      ? 'Preparing a copyable client link...'
                      : 'Client invite link could not be prepared.'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {teamNotice ? (
              <div className="flex items-center gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                <Check size={14} />
                {teamNotice}
              </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-[14px] border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2.5">
              <Search size={15} className="shrink-0 text-[#8A8A98]" />
              <input
                value={teamSearch}
                onChange={(event) => setTeamSearch(event.target.value)}
                placeholder="Search team members..."
                className="min-w-0 flex-1 bg-transparent text-xs text-[#0D0D0D] outline-none placeholder:text-[#8A8A98]"
              />
            </div>

            <div>
              <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A8A98]">Team members</p>
              <div>
                {teamLoadingGate.isVisible ? (
                  <LoadingScreen
                    key={teamLoadingGate.cycleKey}
                    message="Loading team..."
                    isComplete={teamLoadingGate.isComplete}
                    onExitComplete={teamLoadingGate.handleExitComplete}
                  />
                ) : filteredTeamMembers.length === 0 ? (
                  <div className="rounded-[12px] border border-dashed border-[#E5E5E5] p-4 text-xs text-[#6E6E80]">
                    No organization team members found.
                  </div>
                ) : (
                  filteredTeamMembers.slice(0, compact ? 4 : 8).map((member) => {
                    const normalizedEmail = normalizeEmail(member.email);
                    const alreadyInSpace = memberEmails.has(normalizedEmail);
                    const alreadyPending = pendingEmails.has(normalizedEmail);
                    const disabled = alreadyInSpace || alreadyPending || createInvitation.isPending;
                    return (
                      <div key={member.id || member.email} className="flex items-center gap-2 border-b border-[#EDEDED] py-2.5 last:border-b-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0D0D0D] text-[10px] font-semibold text-white">
                          {getInitials(member.full_name, member.email)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[#0D0D0D]">{member.full_name || member.email}</p>
                          <p className="truncate text-[11px] text-[#6E6E80]">{member.email}</p>
                        </div>
                        <select
                          value={roleByEmail[normalizedEmail] || 'member'}
                          onChange={(event) =>
                            setRoleByEmail((current) => ({
                              ...current,
                              [normalizedEmail]: event.target.value as 'member' | 'admin',
                            }))
                          }
                          disabled={disabled}
                          className="h-8 max-w-[76px] rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2 text-[11px] font-semibold text-[#0D0D0D] outline-none disabled:opacity-50"
                        >
                          {teamRoleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => inviteTeamMember(member)}
                          disabled={disabled}
                          className="h-8 rounded-full border border-[#E5E5E5] bg-white px-3 text-[11px] font-semibold text-[#0D0D0D] transition hover:bg-[#F7F7F8] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {alreadyInSpace ? 'Added' : alreadyPending ? 'Pending' : 'Notify'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

          {error ? (
            <div className="mt-3 rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#B42318]">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ isOpen, onClose, spaceId, forcedMemberType, initialClientToken }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-4 backdrop-blur-[8px] md:items-center">
      <div className="relative h-auto w-full max-w-[560px]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#6E6E80] transition hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
          aria-label="Close invitation modal"
        >
          <X size={17} />
        </button>
        <InviteMemberCard
          spaceId={spaceId}
          forcedMemberType={forcedMemberType}
          initialClientToken={initialClientToken}
          className="max-h-[82vh] rounded-[24px] shadow-[0_24px_70px_rgba(0,0,0,0.18)]"
        />
      </div>
    </div>
  );
};

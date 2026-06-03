import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MailPlus, Users } from 'lucide-react';
import { Button, GlassCard, Heading, SkeletonText, Text } from '@/components/UI';
import { useAuth } from '@/contexts/AuthContext';
import { useSpaceMembers } from '@/hooks/useInvitationQueries';
import { InviteListTable } from './InviteListTable';
import { InviteMemberModal } from './InviteMemberModal';
import { SpaceInviteLinkCard } from './SpaceInviteLinkCard';
import { InviteMemberType, SpaceMemberRow } from './inviteTypes';

type Tab = 'members' | 'pending';
type Filter = 'all' | InviteMemberType;

const normalizeMember = (member: SpaceMemberRow) => {
  const role = member.membership_role || member.role || member.profiles?.role || 'member';
  const memberType = member.member_type || (role === 'client' ? 'client' : 'staff');

  return {
    id: member.profile_id || member.member_id || member.id || member.profiles?.id || `${member.email}-${role}`,
    name: member.full_name || member.profiles?.full_name || member.email || member.profiles?.email || 'Unknown member',
    email: member.email || member.profiles?.email || '',
    role,
    memberType: memberType as InviteMemberType,
    joinedAt: member.joined_at,
  };
};

export const SpaceMembersPage: React.FC = () => {
  const { spaceId = '' } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userRole, can } = useAuth();
  const { data = [], isLoading, error } = useSpaceMembers(spaceId);
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [filter, setFilter] = useState<Filter>('all');
  const [inviteOpen, setInviteOpen] = useState(false);

  const canManageInvites =
    userRole === 'owner' ||
    userRole === 'admin' ||
    can('can_manage_team', spaceId) ||
    can('manage_team', spaceId) ||
    can('can_invite_clients', spaceId);

  const members = useMemo(() => data.map(normalizeMember), [data]);
  const filteredMembers = filter === 'all' ? members : members.filter((member) => member.memberType === filter);
  const forcedInviteType = searchParams.get('invite') === 'staff' ? 'staff' : undefined;

  useEffect(() => {
    if (forcedInviteType && canManageInvites) {
      setInviteOpen(true);
    }
  }, [canManageInvites, forcedInviteType]);

  const closeInvite = () => {
    setInviteOpen(false);
    if (forcedInviteType) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('invite');
      setSearchParams(nextParams, { replace: true });
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F7F8] px-2 py-4 text-[#0D0D0D] sm:px-3 md:px-4 md:py-5">
      <div className="w-full min-w-0 space-y-5">
        <div className="flex flex-col gap-4 rounded-[8px] border border-[#E5E5E5] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <Button type="button" variant="outline" size="sm" className="rounded-[8px]" onClick={() => navigate(`/spaces/${spaceId}`)}>
              <ArrowLeft size={14} />
              Space
            </Button>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6E6E80]">People & invitations</p>
              <Heading level={1} className="mt-1 text-3xl tracking-[-0.04em]">Members</Heading>
            </div>
          </div>
          <Button type="button" variant="primary" className="rounded-[8px]" onClick={() => setInviteOpen(true)} disabled={!canManageInvites}>
            <MailPlus size={16} />
            Invite
          </Button>
        </div>

        {!canManageInvites ? (
          <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-4 text-sm text-[#6E6E80]">
            Your current role may not be allowed to manage invitations. The backend remains the source of truth for access.
          </div>
        ) : null}

        <GlassCard className="border border-[#E5E5E5] bg-white/95 p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="inline-flex rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-1">
              {(['members', 'pending'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`h-9 rounded-[6px] px-4 text-sm font-medium ${
                    activeTab === tab ? 'bg-white text-[#0D0D0D] shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'text-[#6E6E80]'
                  }`}
                >
                  {tab === 'members' ? 'Members' : 'Pending invitations'}
                </button>
              ))}
            </div>

            {activeTab === 'members' ? (
              <div className="flex gap-2">
                {(['all', 'staff', 'client'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFilter(option)}
                    className={`h-8 rounded-[8px] border px-3 text-xs font-medium uppercase tracking-[0.12em] ${
                      filter === option
                        ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white'
                        : 'border-[#E5E5E5] bg-white text-[#6E6E80]'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {activeTab === 'members' ? (
            <div className="space-y-3">
              {isLoading ? <SkeletonText lines={5} /> : null}
              {error ? (
                <div className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B42318]">
                  Failed to load members.
                </div>
              ) : null}
              {!isLoading && !error && filteredMembers.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[#DADADA] bg-[#F7F7F8] p-8 text-center">
                  <Users className="mx-auto mb-3 text-[#6E6E80]" size={24} />
                  <Text variant="secondary">No members match this filter.</Text>
                </div>
              ) : null}
              {!isLoading && !error && filteredMembers.map((member) => (
                <div key={member.id} className="flex flex-col gap-3 rounded-[8px] border border-[#E5E5E5] bg-white p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0D0D0D]">{member.name}</p>
                    <p className="truncate text-xs text-[#6E6E80]">{member.email || 'No email available'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0D0D0D]">
                      {member.memberType}
                    </span>
                    <span className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E6E80]">
                      {member.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <SpaceInviteLinkCard spaceId={spaceId} />
              <InviteListTable spaceId={spaceId} />
            </div>
          )}
        </GlassCard>
      </div>

      <InviteMemberModal isOpen={inviteOpen} onClose={closeInvite} spaceId={spaceId} forcedMemberType={forcedInviteType} />
    </main>
  );
};

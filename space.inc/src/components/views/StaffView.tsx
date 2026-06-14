import React, { useMemo, useState } from 'react';
import {
  Hash,
  Mail,
  MailPlus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { GlassCard, Button, Heading } from '../UI/index';
import { ClientSpace, StaffMember } from '../../types';
import { InviteMemberModal } from '../invite/InviteMemberModal';

const getRoleLabel = (role: StaffMember['role']) => {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Staff member';
};

const getInitials = (fullName: string, email: string) => {
  const source = fullName?.trim() || email;
  return source
    .split(/[ @.]+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const getAssignedSpaceNames = (member: StaffMember, spaces: ClientSpace[]) =>
  (member.assigned_spaces || [])
    .map((assigned) => spaces.find((space) => space.id === assigned.space_id)?.name)
    .filter(Boolean) as string[];

const StaffView: React.FC<{
  staff: StaffMember[];
  spaces: ClientSpace[];
  onUpdateCapability: (staffId: string, spaceId: string, allowed: boolean) => void;
  onRefresh?: () => void;
}> = ({ staff, spaces }) => {
  const { showToast } = useToast();
  const { userRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'all' | StaffMember['role']>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteAnchorSpaceId = spaces[0]?.id || '';

  const teamMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return staff
      .map((member) => {
        const assignedSpaceNames = getAssignedSpaceNames(member, spaces);
        return {
          ...member,
          initials: getInitials(member.full_name, member.email),
          roleLabel: getRoleLabel(member.role),
          assignedSpaceNames,
        };
      })
      .filter((member) => {
        const searchable = [
          member.full_name,
          member.email,
          member.roleLabel,
          ...member.assignedSpaceNames,
        ]
          .join(' ')
          .toLowerCase();

        const matchesSearch = !query || searchable.includes(query);
        const matchesRole = selectedRole === 'all' || member.role === selectedRole;
        return matchesSearch && matchesRole;
      });
  }, [searchQuery, selectedRole, spaces, staff]);

  const activeMembers = teamMembers.filter((member) => member.is_active);
  const canInviteTeam = userRole === 'owner' || userRole === 'admin';

  const openInvite = () => {
    if (!inviteAnchorSpaceId) {
      showToast('Create a space before inviting team members.', 'error');
      return;
    }
    setInviteOpen(true);
  };

  return (
    <div className="space-y-4 page-enter">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Heading level={1}>Team</Heading>

        <div className="flex flex-wrap items-center gap-3">
          {canInviteTeam ? (
            <Button
              type="button"
              variant="primary"
              className="rounded-[8px]"
              onClick={openInvite}
              icon={<MailPlus size={16} />}
            >
              Invite teammate
            </Button>
          ) : null}
          <div className="surface-chip px-3 py-1.5 text-[11px] uppercase tracking-[0.18em]">
            {activeMembers.length} people
          </div>
        </div>
      </header>

      <InviteMemberModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        spaceId={inviteAnchorSpaceId}
        forcedMemberType="staff"
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <GlassCard className="sheet-panel p-4 md:p-5">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Channels</p>
              <div className="mt-3 space-y-2">
                {[
                  { label: 'Team room', icon: Hash, active: true },
                  { label: 'People', icon: Users, active: false },
                  { label: 'Roles', icon: ShieldCheck, active: false },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                        item.active
                          ? 'bg-[#0D0D0D] text-white'
                          : 'text-[#6E6E80] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[12px] border border-[#E5E5E5] bg-[#F7F7F8] p-4">
              <p className="text-sm font-semibold text-[#0D0D0D]">Team note</p>
              <p className="mt-2 text-sm leading-6 text-[#6E6E80]">
                This area is for knowing who your teammates are. Detailed user statistics and workload scoring stay out of the team room.
              </p>
            </div>
          </div>
        </GlassCard>

        <div className="space-y-5">
          <GlassCard className="sheet-panel p-4 md:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full xl:max-w-md">
                <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6E6E80]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search teammates"
                  className="w-full rounded-[10px] border border-[#DADADA] bg-white py-3 pl-10 pr-4 text-sm text-[#0D0D0D] placeholder:text-[#6E6E80] focus:border-black focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(['all', 'owner', 'admin', 'staff'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={`h-9 rounded-[8px] border px-3 text-xs font-medium uppercase tracking-[0.12em] ${
                      selectedRole === role
                        ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white'
                        : 'border-[#E5E5E5] bg-white text-[#6E6E80]'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          {teamMembers.length === 0 ? (
            <GlassCard className="sheet-panel p-8 text-center">
              <UserRound className="mx-auto mb-3 text-[#6E6E80]" size={24} />
              <p className="text-sm font-semibold text-[#0D0D0D]">No teammates found</p>
              <p className="mt-2 text-sm text-[#6E6E80]">Try a different search or invite a new team member.</p>
            </GlassCard>
          ) : (
            <div className="overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white">
              {teamMembers.map((member) => (
                <div key={member.id} className="border-b border-[#E5E5E5] p-4 last:border-b-0 md:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] border border-[#E5E5E5] bg-[#F7F7F8] text-sm font-semibold text-[#0D0D0D]">
                        {member.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">
                            {member.full_name || member.email}
                          </h3>
                          <span className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">
                            {member.roleLabel}
                          </span>
                          <span className={`surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${member.is_active ? 'surface-chip-active' : ''}`}>
                            {member.is_active ? 'Available' : 'Pending'}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-sm text-[#6E6E80]">
                          <Mail size={14} />
                          <span className="truncate">{member.email}</span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {member.assignedSpaceNames.length > 0 ? (
                            member.assignedSpaceNames.slice(0, 3).map((spaceName) => (
                              <span key={spaceName} className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]">
                                {spaceName}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm italic text-[#6E6E80]">
                              - not yet assigned -
                            </span>
                          )}
                          {member.assignedSpaceNames.length > 3 ? (
                            <span className="surface-chip px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]">
                              +{member.assignedSpaceNames.length - 3} more
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="self-start rounded-[8px] border border-[#E5E5E5] px-3 py-2 text-sm font-medium text-[#6E6E80] hover:bg-[#F7F7F8] xl:self-auto"
                    >
                      ...
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffView;

import React, { useMemo, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { UserPlus, User, ShieldCheck, Sparkles, Search, LayoutGrid, List } from 'lucide-react';
import { GlassCard, Button, Toggle } from '../UI/index';
import { ClientSpace, StaffMember } from '../../types';

const StaffView: React.FC<{
  staff: StaffMember[];
  spaces: ClientSpace[];
  onInvite: () => void;
  onUpdateCapability: (staffId: string, spaceId: string, allowed: boolean) => void;
  onRefresh?: () => void;
}> = ({ staff, spaces, onInvite, onUpdateCapability }) => {
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'admin' | 'staff'>('all');

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staff.filter((member) => {
      const matchesSearch =
        !q ||
        [member.full_name, member.email, member.role].some((value) =>
          String(value || '').toLowerCase().includes(q)
        );
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [roleFilter, searchQuery, staff]);

  const handleToggleSpace = async (staffUserId: string, spaceId: string, currentValue: boolean) => {
    onUpdateCapability(staffUserId, spaceId, !currentValue);
  };

  return (
    <div className="space-y-6 page-enter">
      <GlassCard className="glass-elevated overflow-hidden p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#6E6E80]">
              <ShieldCheck size={14} className="text-[#6E6E80]" />
              Staff control
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#0D0D0D] md:text-4xl">Staffs</h1>
            <p className="text-sm leading-6 text-[#6E6E80] md:text-base">
              Manage staff assignments, active spaces, and client feedback with tighter density and fewer dead spaces.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#6E6E80]">
              {filteredStaff.length} staff
            </div>
            <Button onClick={onInvite} icon={<UserPlus size={16} />}>
              Add human
            </Button>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6E6E80]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff"
              className="w-full rounded-[8px] border border-[#E5E5E5] bg-white py-3 pl-10 pr-4 text-sm text-[#0D0D0D] placeholder:text-[#6E6E80] focus:border-black focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setViewMode('board')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${viewMode === 'board' ? 'border-black bg-black text-white' : 'border-[#E5E5E5] bg-white text-[#6E6E80] hover:bg-[#F7F7F8]'}`}>
              <LayoutGrid size={14} /> Board
            </button>
            <button onClick={() => setViewMode('list')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${viewMode === 'list' ? 'border-black bg-black text-white' : 'border-[#E5E5E5] bg-white text-[#6E6E80] hover:bg-[#F7F7F8]'}`}>
              <List size={14} /> List
            </button>
            {(['all', 'owner', 'admin', 'staff'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`rounded-full border px-3 py-2 text-xs font-medium capitalize ${roleFilter === role ? 'border-[#0D0D0D] bg-[#F7F7F8] text-[#0D0D0D]' : 'border-[#E5E5E5] bg-white text-[#6E6E80] hover:bg-[#F7F7F8]'}`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {viewMode === 'board' ? (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {filteredStaff.map((member, memberIndex) => (
          <GlassCard
            key={member.id}
            className="overflow-hidden p-5 md:p-6"
          >
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-4 md:gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#6E6E80]">
                  <User size={26} />
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#0D0D0D]">{member.full_name}</h3>
                    <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#6E6E80]">
                      {member.role}
                    </span>
                    {member.is_active ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#0D0D0D]">
                        <span className="h-1.5 w-1.5 rounded-full bg-black" />
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#6E6E80]">
                        Awaiting setup
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-[#6E6E80]">{member.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#6E6E80]">
                  {(member.assigned_spaces as any[])?.length || 0} spaces
                </div>
                <Button variant="outline" size="sm">Edit</Button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#6E6E80]">
                <Sparkles size={12} className="text-[#6E6E80]" />
                Space authority matrix
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {spaces.map((space, spaceIndex) => {
                  const isAssigned = (member.assigned_spaces as any[])?.some((assignedSpace) => assignedSpace.space_id === space.id);

                  return (
                    <div
                      key={space.id}
                      style={{ animationDelay: `${(memberIndex + spaceIndex) * 20}ms` }}
                        className={`page-enter rounded-[8px] border px-4 py-4 transition-all duration-[260ms] ${
                          isAssigned
                          ? 'border-[#E5E5E5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                          : 'border-[#E5E5E5] bg-[#F7F7F8] opacity-90 hover:opacity-100'
                        }`}
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[#0D0D0D]">{space.name}</div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#6E6E80]">
                            {isAssigned ? 'Assigned' : 'No access'}
                          </div>
                        </div>
                        <Toggle
                          checked={isAssigned}
                          onChange={() => handleToggleSpace(member.id, space.id, isAssigned)}
                        />
                      </div>

                      {isAssigned ? (
                        <button
                          onClick={() => {
                            onUpdateCapability(member.id, space.id, true);
                            showToast('Capability refreshed.', 'success');
                          }}
                          className="interactive-surface inline-flex rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[#0D0D0D]"
                        >
                          Full access
                        </button>
                      ) : (
                        <div className="text-xs leading-5 text-[#6E6E80]">
                          Toggle access on to make this workspace available to the staff member.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredStaff.map((member) => (
            <GlassCard key={member.id} className="p-4 md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-[#0D0D0D]">{member.full_name}</h3>
                    <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#6E6E80]">{member.role}</span>
                    <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#6E6E80]">
                      {(member.assigned_spaces as any[])?.length || 0} spaces
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#6E6E80]">{member.email}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setViewMode('board')}>Open board</Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default StaffView;

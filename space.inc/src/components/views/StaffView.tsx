import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import { UserPlus, User, ShieldCheck, Sparkles } from 'lucide-react';
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

  const handleToggleSpace = async (staffUserId: string, spaceId: string, currentValue: boolean) => {
    onUpdateCapability(staffUserId, spaceId, !currentValue);
  };

  return (
    <div className="space-y-6 page-enter">
      <GlassCard className="glass-elevated overflow-hidden p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
              <ShieldCheck size={14} className="text-emerald-300" />
              Staff control
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">Staff Engine</h1>
            <p className="text-sm leading-6 text-slate-300 md:text-base">
              Manage human authority and space assignments with tighter density, clearer status, and less chrome.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-white/8 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              {staff.length} staff
            </div>
            <Button onClick={onInvite} icon={<UserPlus size={16} />}>
              Add human
            </Button>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-5">
        {staff.map((member, memberIndex) => (
          <GlassCard
            key={member.id}
            className="overflow-hidden p-5 md:p-6"
          >
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-4 md:gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.08] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <User size={26} />
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">{member.full_name}</h3>
                    <span className="rounded-full border border-white/8 bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                      {member.role}
                    </span>
                    {member.is_active ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-400/14 bg-amber-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-200">
                        Awaiting setup
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-slate-400">{member.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-full border border-white/8 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  {(member.assigned_spaces as any[])?.length || 0} spaces
                </div>
                <Button variant="outline" size="sm">Edit</Button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <Sparkles size={12} className="text-violet-300" />
                Space authority matrix
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {spaces.map((space, spaceIndex) => {
                  const isAssigned = (member.assigned_spaces as any[])?.some((assignedSpace) => assignedSpace.space_id === space.id);

                  return (
                    <div
                      key={space.id}
                      style={{ animationDelay: `${(memberIndex + spaceIndex) * 20}ms` }}
                      className={`page-enter rounded-[22px] border px-4 py-4 transition-all duration-[260ms] ${
                        isAssigned
                          ? 'border-white/10 bg-white/[0.08] shadow-[0_18px_40px_rgba(0,0,0,0.18)]'
                          : 'border-white/6 bg-white/[0.03] opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-100">{space.name}</div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
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
                          className="interactive-surface inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/12 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-emerald-200"
                        >
                          Full access
                        </button>
                      ) : (
                        <div className="text-xs leading-5 text-slate-500">
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
    </div>
  );
};

export default StaffView;

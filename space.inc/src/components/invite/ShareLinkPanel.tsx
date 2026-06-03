import React, { useEffect, useMemo, useState } from 'react';
import { Link as LinkIcon, RefreshCw, Save } from 'lucide-react';
import { Button, GlassCard, Heading, Input, Modal, Text, Toggle } from '@/components/UI';
import {
  useRotateShareLink,
  useSetShareLinkEnabled,
  useShareLink,
  useUpdateShareLinkConfig,
} from '@/hooks/useInvitationQueries';
import { getInviteErrorCode, inviteErrorMessages, InviteMemberType } from './inviteTypes';
import { CopyableTokenField } from './CopyableTokenField';

type ShareLinkPanelProps = {
  spaceId: string;
};

const roleOptions = ['owner', 'admin', 'manager', 'member', 'viewer'] as const;

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export const ShareLinkPanel: React.FC<ShareLinkPanelProps> = ({ spaceId }) => {
  const { data, isLoading, error } = useShareLink(spaceId);
  const rotate = useRotateShareLink(spaceId);
  const updateConfig = useUpdateShareLinkConfig(spaceId);
  const setEnabled = useSetShareLinkEnabled(spaceId);
  const [memberType, setMemberType] = useState<InviteMemberType>('client');
  const [role, setRole] = useState<'owner' | 'admin' | 'manager' | 'member' | 'viewer'>('member');
  const [domain, setDomain] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [rawToken, setRawToken] = useState('');
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!data) return;
    setMemberType(data.default_member_type || 'client');
    setRole((data.default_role as typeof role) || 'member');
    setDomain(data.allowed_email_domain || '');
    setMaxUses(data.max_uses ? String(data.max_uses) : '');
    setExpiresAt(toDateTimeLocal(data.expires_at));
  }, [data]);

  const errorMessage = useMemo(() => {
    const code = getInviteErrorCode(error || rotate.error || updateConfig.error || setEnabled.error);
    return code ? inviteErrorMessages[code] : null;
  }, [error, rotate.error, setEnabled.error, updateConfig.error]);

  const rotateNow = async () => {
    setMessage('');
    const result = await rotate.mutateAsync();
    setRawToken(result?.raw_token || '');
    setConfirmRotate(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    await updateConfig.mutateAsync({
      default_member_type: memberType,
      default_role: role,
      allowed_email_domain: domain.trim() || null,
      max_uses: maxUses ? Number(maxUses) : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
    setMessage('Invite link settings saved.');
  };

  if (!spaceId) return null;

  return (
    <>
      <GlassCard className="p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Heading level={3} className="mb-2">Invite link</Heading>
            <Text variant="secondary" size="sm">
              Every space has a standing join link. Regenerating it invalidates the previous link and shows the new one once.
            </Text>
          </div>
          <Button type="button" variant="outline" className="rounded-[8px]" onClick={() => setConfirmRotate(true)} disabled={isLoading}>
            <RefreshCw size={16} />
            Regenerate link
          </Button>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B42318]">
            {errorMessage}
          </div>
        ) : null}

        {rawToken ? (
          <div className="mb-5 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#0D0D0D]">
              <LinkIcon size={16} />
              New share link generated
            </div>
            <CopyableTokenField rawToken={rawToken} linkType="join" label="Join link" />
          </div>
        ) : null}

        <form onSubmit={save} className="space-y-5">
          <div className="flex items-center justify-between rounded-[8px] border border-[#E5E5E5] bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-[#0D0D0D]">Link enabled</p>
              <p className="text-xs text-[#6E6E80]">Disabled links stop working immediately.</p>
            </div>
            <Toggle
              checked={Boolean(data?.is_active)}
              onChange={(checked) => {
                if (!data || setEnabled.isPending) return;
                setEnabled.mutate(checked);
              }}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#6E6E80]">Member type</span>
              <select
                value={memberType}
                onChange={(event) => setMemberType(event.target.value as InviteMemberType)}
                className="w-full rounded-[8px] border border-[#DADADA] bg-white px-4 py-3 text-sm text-[#0D0D0D] focus:border-black focus:outline-none"
              >
                <option value="client">client</option>
                <option value="staff">staff</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#6E6E80]">Role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as typeof role)}
                className="w-full rounded-[8px] border border-[#DADADA] bg-white px-4 py-3 text-sm text-[#0D0D0D] focus:border-black focus:outline-none"
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <Input
            label="Allowed email domain"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="acme.com"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              type="number"
              min="1"
              label="Max uses"
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
              placeholder="Unlimited"
            />
            <Input
              type="datetime-local"
              label="Expires at"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>

          {message ? <p className="text-sm text-[#047857]">{message}</p> : null}

          <div className="flex justify-end border-t border-[#E5E5E5] pt-5">
            <Button type="submit" variant="primary" className="rounded-[8px]" isLoading={updateConfig.isPending}>
              <Save size={16} />
              Save settings
            </Button>
          </div>
        </form>
      </GlassCard>

      <Modal isOpen={confirmRotate} onClose={() => setConfirmRotate(false)} title="Regenerate invite link">
        <div className="space-y-5">
          <Text variant="secondary" className="leading-6">
            This will invalidate the previous space invite link immediately and show a new copyable link once.
          </Text>
          <div className="flex gap-3 border-t border-[#E5E5E5] pt-5">
            <Button type="button" variant="ghost" className="flex-1 rounded-[8px]" onClick={() => setConfirmRotate(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" className="flex-1 rounded-[8px]" isLoading={rotate.isPending} onClick={rotateNow}>
              Regenerate
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

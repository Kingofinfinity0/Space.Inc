import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/UI';
import { getInviteUrl, getJoinUrl } from './inviteTypes';

type CopyableTokenFieldProps = {
  rawToken: string;
  linkType?: 'invite' | 'join';
  label?: string;
};

export const CopyableTokenField: React.FC<CopyableTokenFieldProps> = ({ rawToken, linkType = 'invite', label = 'Invitation link' }) => {
  const [copied, setCopied] = useState(false);
  const url = linkType === 'join' ? getJoinUrl(rawToken) : getInviteUrl(rawToken);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-2">
      <label className="block px-0.5 text-xs font-medium uppercase tracking-[0.18em] text-[#6E6E80]">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          title={`Generated ${linkType} link`}
          className="min-w-0 flex-1 rounded-[8px] border border-[#DADADA] bg-white px-3 py-2 text-xs text-[#0D0D0D]"
        />
        <Button type="button" variant="outline" size="sm" className="rounded-[8px]" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="text-xs leading-5 text-[#B45309]">
        This link is shown once. Copy it now; the raw token cannot be retrieved again.
      </p>
    </div>
  );
};

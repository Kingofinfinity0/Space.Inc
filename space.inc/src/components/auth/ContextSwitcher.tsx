import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/apiService';
import { UserContext, OrgContext, ClientContext } from '../../types/context';
import { GlassCard } from '../UI/GlassCard';
import { Building2, UserCircle, ArrowRight } from 'lucide-react';
import { getContextRoute } from '../../lib/contextReadiness';

export const ContextSwitcher: React.FC = () => {
    const { contexts, setActiveContext, refreshContexts, refreshCapabilities } = useAuth();
    const navigate = useNavigate();
    const [activatingContextId, setActivatingContextId] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    if (!contexts) return null;

    const handleSelect = async (context: UserContext) => {
        setActivatingContextId(context.context_id);
        setError(null);

        try {
            const activation = await apiService.activateMembershipContext(context.context_type, context.context_id);
            if (!activation.success) {
                throw new Error(`Failed to activate selected context: ${activation.error_code || 'UNKNOWN_ERROR'}`);
            }

            setActiveContext(context);
            setActivatingContextId(null);
            navigate(getContextRoute(context) || '/dashboard', { replace: true });

            void Promise.all([refreshContexts(), refreshCapabilities()]).catch((syncError) => {
                console.warn('[ContextSwitcher] Background context refresh failed:', syncError);
            });
        } catch (err: any) {
            setError(err?.message || 'Failed to activate this workspace. Please try again.');
            setActivatingContextId(null);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F7F8] p-6">
            <div className="max-w-4xl w-full">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-semibold text-[#0D0D0D] mb-4 tracking-tight">Welcome back</h1>
                    <p className="text-[#6E6E80] text-lg">Select a workspace to continue</p>
                </div>

                {error && (
                    <div className="mb-6 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Organization Contexts */}
                    {contexts.org_contexts.map((ctx: OrgContext) => (
                        <ContextCard
                            key={ctx.context_id}
                            title={ctx.org_name}
                            subtitle={ctx.base_role.charAt(0).toUpperCase() + ctx.base_role.slice(1)}
                            badge="Team"
                            icon={<Building2 className="text-[#0D0D0D]" size={24} />}
                            disabled={activatingContextId !== null}
                            isActivating={activatingContextId === ctx.context_id}
                            onClick={() => void handleSelect(ctx)}
                        />
                    ))}

                    {/* Client Contexts */}
                    {contexts.client_contexts.map((ctx: ClientContext) => (
                        <ContextCard
                            key={ctx.context_id}
                            title={ctx.space_name}
                            subtitle={ctx.org_name}
                            badge="Client"
                            icon={<UserCircle className="text-[#0D0D0D]" size={24} />}
                            disabled={activatingContextId !== null}
                            isActivating={activatingContextId === ctx.context_id}
                            onClick={() => void handleSelect(ctx)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

interface ContextCardProps {
    title: string;
    subtitle: string;
    badge: string;
    icon: React.ReactNode;
    disabled?: boolean;
    isActivating?: boolean;
    onClick: () => void;
}

const ContextCard: React.FC<ContextCardProps> = ({ title, subtitle, badge, icon, disabled, isActivating, onClick }) => (
    <GlassCard
        onClick={disabled ? undefined : onClick}
        className={`p-8 transition-all group relative overflow-hidden ${disabled ? 'cursor-wait opacity-70' : 'cursor-pointer hover:border-[#0D0D0D]'}`}
    >
        <div className="flex items-start justify-between mb-6">
            <div className="h-12 w-12 rounded-[12px] bg-[#F7F7F8] border border-[#E5E5E5] flex items-center justify-center group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <span className="px-3 py-1 rounded-full bg-[#F7F7F8] border border-[#E5E5E5] text-[10px] font-bold uppercase tracking-widest text-[#6E6E80]">
                {badge}
            </span>
        </div>

        <div>
            <h3 className="text-xl font-semibold text-[#0D0D0D] mb-1 group-hover:text-[#0D0D0D]">{title}</h3>
            <p className="text-[#6E6E80] text-sm">{isActivating ? 'Activating workspace...' : subtitle}</p>
        </div>

        <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowRight size={20} className="text-[#0D0D0D]" />
        </div>
    </GlassCard>
);

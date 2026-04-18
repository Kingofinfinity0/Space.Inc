import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserContext, OrgContext, ClientContext } from '../../types/context';
import { GlassCard } from '../UI/GlassCard';
import { Building2, UserCircle, ArrowRight } from 'lucide-react';

export const ContextSwitcher: React.FC = () => {
    const { contexts, setActiveContext } = useAuth();

    if (!contexts) return null;

    const handleSelect = (context: UserContext) => {
        setActiveContext(context);
        // Routing will be handled by the parent App component based on activeContext
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F7F8] p-6">
            <div className="max-w-4xl w-full">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-semibold text-[#0D0D0D] mb-4 tracking-tight">Welcome back</h1>
                    <p className="text-[#6E6E80] text-lg">Select a workspace to continue</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Organization Contexts */}
                    {contexts.org_contexts.map((ctx: OrgContext) => (
                        <ContextCard
                            key={ctx.context_id}
                            title={ctx.org_name}
                            subtitle={ctx.base_role.charAt(0).toUpperCase() + ctx.base_role.slice(1)}
                            badge="Team"
                            icon={<Building2 className="text-[#0D0D0D]" size={24} />}
                            onClick={() => handleSelect(ctx)}
                        />
                    ))}

                    {/* Client Contexts */}
                    {contexts.client_contexts.map((ctx: ClientContext) => (
                        <ContextCard
                            key={ctx.context_id}
                            title={ctx.space_name}
                            subtitle={`Invited by ${ctx.org_name}`}
                            badge="Client"
                            icon={<UserCircle className="text-[#0D0D0D]" size={24} />}
                            onClick={() => handleSelect(ctx)}
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
    onClick: () => void;
}

const ContextCard: React.FC<ContextCardProps> = ({ title, subtitle, badge, icon, onClick }) => (
    <GlassCard
        onClick={onClick}
        className="p-8 cursor-pointer hover:border-[#0D0D0D] transition-all group relative overflow-hidden"
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
            <p className="text-[#6E6E80] text-sm">{subtitle}</p>
        </div>

        <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowRight size={20} className="text-[#0D0D0D]" />
        </div>
    </GlassCard>
);

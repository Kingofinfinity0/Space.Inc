
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, ArrowRight, Check, Briefcase, User, Building, Mail, Lock } from 'lucide-react';

interface OnboardingProps {
    onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const { signUp } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        purpose: '',
        role: '',
        orgName: '',
        email: '',
        password: '',
        fullName: ''
    });

    const handleNext = async () => {
        if (step < 4) {
            setStep(step + 1);
        } else {
            setLoading(true);
            setError('');
            try {
                const { error: signUpError } = await signUp(formData.email, formData.password, {
                    full_name: formData.fullName || 'New User',
                    organization_name: formData.orgName,
                    role: formData.role,
                    purpose: formData.purpose
                });

                if (signUpError) throw signUpError;
                onComplete();
            } catch (err: any) {
                setError(err.message || 'Failed to create account. Please try again.');
                setLoading(false);
            }
        }
    };

    const isStepValid = () => {
        if (step === 1 && formData.purpose) return true;
        if (step === 2 && formData.role) return true;
        if (step === 3 && formData.orgName.length > 2) return true;
        if (step === 4 && formData.email && formData.password.length >= 6) return true;
        return false;
    };

    return (
        <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center p-6 text-[#1D1D1D] font-sans relative overflow-hidden">
            {/* Simple Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-[#D1D5DB]">
                <div
                    className="h-full bg-[#10A37F] transition-all duration-700 ease-out"
                    style={{ width: `${(step / 4) * 100}%` }}
                />
            </div>

            <div className="w-full max-w-xl bg-white p-10 rounded-lg border border-[#D1D5DB] shadow-sm relative z-10">
                {loading ? (
                    <div className="text-center py-10">
                        <div className="w-10 h-10 border-2 border-[#10A37F]/30 border-t-[#10A37F] rounded-full animate-spin mx-auto mb-6" />
                        <h2 className="text-xl font-semibold mb-2">Setting up your workplace...</h2>
                        <p className="text-[#565869] text-sm">Building your organization and secure client spaces.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2 text-center">
                            <span className="text-[10px] font-bold text-[#10A37F] uppercase tracking-widest border border-[#10A37F]/30 px-2 py-0.5 rounded">Step {step} of 4</span>
                            <h1 className="text-3xl font-bold tracking-tight mt-4">
                                {step === 1 && "What brings you here?"}
                                {step === 2 && "What is your role?"}
                                {step === 3 && "Name your Workspace."}
                                {step === 4 && "Final Details."}
                            </h1>
                            <p className="text-[#565869] text-sm">
                                {step === 1 && "Help us tailor your experience."}
                                {step === 2 && "Knowing your role helps us optimize your workflow."}
                                {step === 3 && "This will be the identity of your firm's portal."}
                                {step === 4 && "Just a few more specifics to get started."}
                            </p>
                        </div>

                        <div className="min-h-[200px]">
                            {step === 1 && (
                                <div className="grid grid-cols-1 gap-3">
                                    {['Freelancing', 'Agency', 'Consulting', 'Internal Team'].map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => setFormData({ ...formData, purpose: opt })}
                                            className={`
                                                p-5 text-left rounded-md border transition-all duration-200 flex items-center justify-between group
                                                ${formData.purpose === opt
                                                    ? 'bg-[#F7F7F8] border-[#10A37F] text-[#1D1D1D]'
                                                    : 'bg-white border-[#D1D5DB] text-[#565869] hover:bg-[#F7F7F8] hover:border-[#10A37F]/50'
                                                }
                                            `}
                                        >
                                            <span className="text-base font-medium">{opt}</span>
                                            {formData.purpose === opt && <Check className="text-[#10A37F]" size={20} />}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <select
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            className="w-full bg-white border border-[#D1D5DB] rounded-md p-4 text-base appearance-none focus:outline-none focus:ring-1 focus:ring-[#10A37F] focus:border-[#10A37F] transition-all text-[#1D1D1D]"
                                        >
                                            <option value="" disabled>Select your role...</option>
                                            <option value="Founder">Founder / Owner</option>
                                            <option value="Project Manager">Project Manager</option>
                                            <option value="Agency Owner">Agency Owner</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8E8EA0]">
                                            <User size={20} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-4">
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            placeholder="e.g. Acme Studio"
                                            value={formData.orgName}
                                            onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                                            className="w-full bg-white border border-[#D1D5DB] rounded-md p-4 text-2xl font-semibold focus:outline-none focus:ring-1 focus:ring-[#10A37F] focus:border-[#10A37F] transition-all placeholder-[#D1D5DB]"
                                            autoFocus
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D1D5DB] group-focus-within:text-[#10A37F] transition-colors">
                                            <Building size={24} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8EA0]" size={16} />
                                        <input
                                            type="email"
                                            placeholder="Email Address"
                                            className="w-full bg-white border border-[#D1D5DB] rounded-md py-3 pl-12 pr-4 text-[#1D1D1D] focus:ring-1 focus:ring-[#10A37F] focus:border-[#10A37F] outline-none transition-all"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8EA0]" size={16} />
                                        <input
                                            type="password"
                                            placeholder="Password (min 6 chars)"
                                            className="w-full bg-white border border-[#D1D5DB] rounded-md py-3 pl-12 pr-4 text-[#1D1D1D] focus:ring-1 focus:ring-[#10A37F] focus:border-[#10A37F] outline-none transition-all"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8EA0]" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Full Name"
                                            className="w-full bg-white border border-[#D1D5DB] rounded-md py-3 pl-12 pr-4 text-[#1D1D1D] focus:ring-1 focus:ring-[#10A37F] focus:border-[#10A37F] outline-none transition-all"
                                            value={formData.fullName}
                                            onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-8 border-t border-[#F7F7F8]">
                            {step > 1 ? (
                                <button onClick={() => setStep(step - 1)} className="text-[#8E8EA0] hover:text-[#1D1D1D] font-medium text-sm flex items-center gap-2 transition-colors">
                                    <ArrowLeft size={16} /> Previous
                                </button>
                            ) : <div />}

                            <button
                                onClick={handleNext}
                                disabled={!isStepValid()}
                                className={`
                                    group flex items-center gap-2 px-6 py-2.5 rounded-md font-semibold text-sm transition-all duration-200
                                    ${isStepValid()
                                        ? 'bg-[#10A37F] text-white hover:bg-[#0E8A6B]'
                                        : 'bg-[#ECECF1] text-[#8E8EA0] cursor-not-allowed'
                                    }
                                `}
                            >
                                {step === 4 ? 'Complete Setup' : 'Continue'}
                                {step !== 4 && <ArrowRight size={16} className={`transition-transform duration-200 ${isStepValid() ? 'group-hover:translate-x-1' : ''}`} />}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

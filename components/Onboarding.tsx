
import React, { useState } from 'react';
import { ArrowRight, Check, Briefcase, User, Building } from 'lucide-react';

interface OnboardingProps {
    onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        purpose: '',
        role: '',
        orgName: ''
    });

    const handleNext = () => {
        if (step < 3) {
            setStep(step + 1);
        } else {
            // Simulate API call
            setTimeout(onComplete, 1500);
            setStep(4); // Loading step
        }
    };

    const isStepValid = () => {
        if (step === 1 && formData.purpose) return true;
        if (step === 2 && formData.role) return true;
        if (step === 3 && formData.orgName.length > 2) return true;
        return false;
    };

    return (
        <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6 text-white font-sans relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-2 bg-zinc-900">
                <div 
                    className="h-full bg-emerald-500 transition-all duration-700 ease-out"
                    style={{ width: `${(step / 3) * 100}%` }}
                />
            </div>
            
            <div className="absolute inset-0 pointer-events-none">
                 <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[100px]" />
                 <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-xl relative z-10">
                {step === 4 ? (
                    <div className="text-center animate-fade-in-up">
                        <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6" />
                        <h2 className="text-2xl font-light mb-2">Setting up your HQ...</h2>
                        <p className="text-zinc-500">Creating database shards and encrypting storage.</p>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in-up">
                        <div className="space-y-2">
                            <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Step 0{step}</span>
                            <h1 className="text-4xl md:text-5xl font-medium tracking-tight">
                                {step === 1 && "What brings you to Nexus?"}
                                {step === 2 && "What is your role?"}
                                {step === 3 && "Name your Workspace."}
                            </h1>
                        </div>

                        <div className="min-h-[200px]">
                            {step === 1 && (
                                <div className="grid gap-4">
                                    {['Freelancing', 'Agency', 'Consulting', 'Internal Team'].map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => setFormData({...formData, purpose: opt})}
                                            className={`
                                                p-6 text-left rounded-2xl border transition-all duration-200 flex items-center justify-between group
                                                ${formData.purpose === opt 
                                                    ? 'bg-zinc-800 border-emerald-500/50 text-white shadow-lg shadow-emerald-900/10' 
                                                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700'
                                                }
                                            `}
                                        >
                                            <span className="text-lg">{opt}</span>
                                            {formData.purpose === opt && <Check className="text-emerald-500" />}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-4">
                                     <div className="relative">
                                        <select 
                                            value={formData.role}
                                            onChange={(e) => setFormData({...formData, role: e.target.value})}
                                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-xl appearance-none focus:outline-none focus:border-emerald-500/50 transition-colors text-white"
                                        >
                                            <option value="" disabled>Select your role...</option>
                                            <option value="Founder">Founder / Owner</option>
                                            <option value="Project Manager">Project Manager</option>
                                            <option value="Account Manager">Account Manager</option>
                                            <option value="Developer">Developer</option>
                                            <option value="Designer">Designer</option>
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                            <User size={24} />
                                        </div>
                                     </div>
                                     <p className="text-zinc-500 text-sm ml-2">This helps us customize your dashboard widgets.</p>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-4">
                                    <div className="relative group">
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Acme Studio"
                                            value={formData.orgName}
                                            onChange={(e) => setFormData({...formData, orgName: e.target.value})}
                                            className="w-full bg-transparent border-b-2 border-zinc-800 p-4 text-4xl font-light focus:outline-none focus:border-emerald-500 transition-colors placeholder-zinc-700"
                                            autoFocus
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-emerald-500 transition-colors">
                                            <Building size={32} />
                                        </div>
                                    </div>
                                    <p className="text-zinc-500 text-sm">This will be your dedicated URL: nexus.inc/{formData.orgName.toLowerCase().replace(/\s+/g, '-')}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-8">
                            <button
                                onClick={handleNext}
                                disabled={!isStepValid()}
                                className={`
                                    group flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300
                                    ${isStepValid() 
                                        ? 'bg-white text-black hover:bg-emerald-400 hover:scale-105' 
                                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                    }
                                `}
                            >
                                {step === 3 ? 'Launch Space' : 'Continue'}
                                <ArrowRight className={`transition-transform duration-300 ${isStepValid() ? 'group-hover:translate-x-1' : ''}`} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

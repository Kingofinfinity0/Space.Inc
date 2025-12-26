
import React, { useEffect } from 'react';

interface LandingPageProps {
  onStartOnboarding: () => void;
}

// This component is no longer used but kept for reference
const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
    <div className="max-w-7xl mx-auto flex justify-between items-center rounded-full px-6 py-3 shadow-lg bg-[#ffefcb] border border-[#0b2519]/10">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-[#0b2519] rounded-lg flex items-center justify-center">
            <span className="font-bold text-[#ffefcb]">N</span>
        </div>
        <span className="font-medium text-[#0b2519] tracking-tight">Nexus</span>
      </div>
      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#0b2519]/80">
        <a href="#features" className="hover:text-[#0b2519] transition-colors">Philosophy</a>
        <a href="#pricing" className="hover:text-[#0b2519] transition-colors">Pricing</a>
        <a href="#manifesto" className="hover:text-[#0b2519] transition-colors">Manifesto</a>
      </div>
      <div className="bg-[#0b2519] text-[#ffefcb] px-5 py-2 rounded-full text-sm font-semibold inline-block">
        Loading...
      </div>
    </div>
  </nav>
);

// This component is no longer used but kept for reference
const Hero = () => (
  <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 overflow-hidden bg-[#ffefcb]">
    <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
      <h1 className="text-5xl md:text-7xl lg:text-8xl font-medium text-[#0b2519] tracking-tight leading-[1.1] mb-8 animate-fade-in-up">
        One Space.<br/>
        <span className="text-[#0b2519]">
          Total Clarity.
        </span>
      </h1>
      
      <p className="text-lg md:text-xl text-[#0b2519]/90 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up delay-100">
        Ditch the 12-tool sprawl. One link for every client relationship. 
        Simpler. Faster. Human.
      </p>

      <div className="flex items-center justify-center animate-fade-in-up delay-200">
        <div className="w-full sm:w-auto px-8 py-4 bg-[#0b2519]/90 text-[#ffefcb] rounded-full font-semibold text-lg flex items-center justify-center gap-2">
          Loading...
        </div>
      </div>
    </div>

    {/* Floating UI Element */}
    <div className="mt-20 relative w-full max-w-5xl mx-auto animate-float hidden md:block px-6">
      <div className="glass-panel rounded-2xl border border-zinc-800/50 shadow-2xl overflow-hidden aspect-[16/9] relative group">
         <div className="absolute inset-0 bg-gradient-to-tr from-zinc-900 via-zinc-900 to-zinc-800 opacity-90"></div>
         
         {/* Abstract UI representation */}
         <div className="absolute inset-0 flex">
            <div className="w-64 border-r border-white/5 p-6 space-y-4">
                <div className="h-8 w-8 bg-zinc-800 rounded-lg mb-8"></div>
                <div className="h-4 w-3/4 bg-zinc-800/50 rounded"></div>
                <div className="h-4 w-1/2 bg-zinc-800/50 rounded"></div>
                <div className="mt-auto h-20 bg-zinc-800/20 rounded-xl"></div>
            </div>
            <div className="flex-1 p-8">
                <div className="flex justify-between mb-8">
                    <div className="h-8 w-48 bg-zinc-800/50 rounded"></div>
                    <div className="h-8 w-24 bg-zinc-800/50 rounded"></div>
                </div>
                <div className="grid grid-cols-3 gap-6">
                    <div className="aspect-square bg-zinc-800/20 rounded-2xl border border-white/5"></div>
                    <div className="aspect-square bg-zinc-800/20 rounded-2xl border border-white/5"></div>
                    <div className="aspect-square bg-zinc-800/20 rounded-2xl border border-white/5"></div>
                </div>
            </div>
         </div>

         {/* Glow effect on hover */}
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none"></div>
      </div>
    </div>
  </section>
);

const AntiClickUpManifesto = () => (
  <section className="py-24 bg-[#0b2519] text-[#ffefcb] relative overflow-hidden">
    <div className="max-w-7xl mx-auto px-6 relative z-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-4xl md:text-5xl font-medium mb-6 leading-tight">
            Productivity apps became the noise.
          </h2>
          <p className="text-lg md:text-xl text-[#ffefcb]/80 mb-8 max-w-2xl">
            We saw ClickUp try to be "everything" and fail the mission. 
            Feature bloat kills focus. Nexus removes the noise so you can scale the human connection.
          </p>
          <div className="flex items-center text-[#ffefcb]/60">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Built for the scaling entrepreneur</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Tool Sprawl Card */}
          <div className="bg-[#0b2519] border border-[#ffefcb]/10 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
              <h3 className="text-xl font-medium">THE TOOL SPRAWL</h3>
            </div>
            <ul className="space-y-3">
              {["Fragmented communication", "Endless context switching", "Multiple logins & tabs", "Lost client history", "No single source of truth"].map((item) => (
                <li key={item} className="flex items-center text-[#ffefcb]/80">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Nexus Space Card */}
          <div className="bg-[#ffefcb] border border-[#0b2519]/10 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h3 className="text-xl font-medium text-[#0b2519]">THE NEXUS SPACE</h3>
            </div>
            <ul className="space-y-3">
              {["Unified communication", "One link, one space", "Client-first design", "Complete history", "Single source of truth"].map((item) => (
                <li key={item} className="flex items-center text-[#0b2519]/80">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const FeatureCard = ({ icon: Icon, title, desc, isCheck = true }: { icon: any, title: string, desc: string, isCheck?: boolean }) => (
  <div className="p-8 rounded-3xl bg-white/50 border border-[#0b2519]/10 hover:border-[#0b2519]/30 transition-all hover:bg-white/70 group">
    <div className="h-12 w-12 bg-[#0b2519] rounded-2xl flex items-center justify-center mb-6 text-[#ffefcb] group-hover:scale-110 transition-transform duration-300">
      <Icon size={24} strokeWidth={1.5} />
    </div>
    <h3 className="text-xl font-medium text-[#0b2519] mb-3">{title}</h3>
    <p className="text-[#0b2519]/80 leading-relaxed font-light">{desc}</p>
  </div>
);

const Features = () => (
  <section id="features" className="py-32 bg-[#ffefcb] relative">
    <div className="max-w-7xl mx-auto px-6">
      <div className="mb-20 text-center max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-5xl font-medium text-[#0b2519] mb-6 tracking-tight">Productivity apps became the noise.</h2>
        <p className="text-[#0b2519]/80 text-lg font-light">
          The Status Quo: Multiple tabs, fragmented history, and management overhead.
          The Nexus Way: One space, total clarity, and meaningful connections.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-6">
          <FeatureCard 
            icon={Layers} 
            title="The Lie" 
            desc="More features equal more productivity. The truth? They create more complexity and less clarity." 
            isCheck={false}
          />
          <div className="p-6 bg-red-50/50 border-l-4 border-red-500 rounded-r-lg">
            <h4 className="font-medium text-red-800 mb-2">Trust-Eroding Friction</h4>
            <p className="text-red-700/80 text-sm">Fragmented communication breaks trust and slows progress.</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <FeatureCard 
            icon={Zap} 
            title="The Signal" 
            desc="Nexus cuts through the noise with one space for every client relationship." 
          />
          <div className="p-6 bg-emerald-50/50 border-l-4 border-emerald-500 rounded-r-lg">
            <h4 className="font-medium text-emerald-800 mb-2">Context Cohesion</h4>
            <p className="text-emerald-700/80 text-sm">All communication in one place means no more digging for context.</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <FeatureCard 
            icon={Shield} 
            title="The Result" 
            desc="Clarity for you, simplicity for your clients, and growth for your business." 
          />
          <div className="p-6 bg-amber-50/50 border-l-4 border-amber-500 rounded-r-lg">
            <h4 className="font-medium text-amber-800 mb-2">Effortless Scaling</h4>
            <p className="text-amber-700/80 text-sm">More clients, less chaos. Scale without the overhead.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const PricingCard = ({ title, price, description, features, highlight = false, isPopular = false }: any) => (
  <div className={`
    relative p-8 rounded-3xl border flex flex-col h-full transition-all duration-300
    bg-white/50 border-[#0b2519]/10 hover:border-[#0b2519]/30 hover:bg-white/70
    ${highlight ? 'shadow-2xl scale-105 z-10' : ''}
  `}>
    {isPopular && (
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#0b2519] to-[#1a4731] text-[#ffefcb] text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
        Most Popular
      </div>
    )}
    <div className="mb-8">
      <h3 className="text-lg font-medium text-[#0b2519] mb-2">{title}</h3>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-4xl font-light text-[#0b2519]">${price}</span>
        <span className="text-sm text-[#0b2519]/60">/month</span>
      </div>
      <p className="text-sm text-[#0b2519]/80 font-light min-h-[40px]">{description}</p>
    </div>

    <div className="space-y-4 mb-8 flex-1">
      {features.map((feat: string, i: number) => (
        <div key={i} className="flex items-start gap-3 text-sm text-[#0b2519]/80">
          <Check size={16} className="text-[#0b2519] mt-0.5 shrink-0" />
          <span className="font-light">{feat}</span>
        </div>
      ))}
    </div>

    <a 
      href="https://buy.polar.sh/polar_cl_cugYS6Kfcy651OZLVk1jvxp6gl3KOGikSe6aa3HNqdq"
      target="_blank"
      rel="noopener noreferrer"
      className={`
        w-full py-3 rounded-xl font-medium text-sm transition-all text-center block
        bg-[#0b2519] text-[#ffefcb] hover:bg-[#0b2519]/90
      `}
    >
      Get Started
    </a>
  </div>
);

const Pricing = () => (
  <section id="pricing" className="py-32 bg-[#ffefcb] relative overflow-hidden">
    <div className="max-w-7xl mx-auto px-6 relative z-10">
      <div className="mb-20 text-center">
        <h2 className="text-3xl md:text-5xl font-medium text-[#0b2519] mb-6">Honest Pricing. Select Your Rank.</h2>
        <p className="text-[#0b2519]/80 text-lg font-light max-w-xl mx-auto">
          Simple, transparent pricing that grows with your business.
          No hidden fees. Cancel anytime.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        <PricingCard 
          title="Starter" 
          price="29" 
          description="For the solo operator aiming for higher ranks."
          features={[
            "3 Client Spaces",
            "1 Staff Seat",
            "5 GB Storage",
            "500 Video Minutes",
            "Basic Analytics"
          ]}
        />
        <PricingCard 
          title="Growth" 
          price="79" 
          description="Optimized for agency scaling."
          isPopular={true}
          features={[
            "10 Client Spaces",
            "3 Staff Seats",
            "20 GB Storage",
            "2,000 Video Minutes",
            "AI Summaries"
          ]}
        />
        <PricingCard 
          title="Scale" 
          price="199" 
          description="For established agencies."
          features={[
            "30 Client Spaces",
            "10 Staff Seats",
            "100 GB Storage",
            "10,000 Video Minutes",
            "Automation Rules"
          ]}
        />
        <PricingCard 
          title="Pro Agency" 
          price="399" 
          description="Maximum power. Total domination."
          features={[
            "50 Client Spaces",
            "20 Staff Seats",
            "250 GB Storage",
            "20,000 Video Minutes",
            "Priority Support"
          ]}
        />
      </div>
    </div>
  </section>
);

const Footer = () => (
    <footer className="bg-[#0b2519] py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
                <div className="w-6 h-6 bg-[#ffefcb] rounded flex items-center justify-center text-xs text-[#0b2519] font-bold">N</div>
                <span className="text-[#ffefcb]/80 text-sm">Nexus Inc. © 2024</span>
            </div>
            <div className="flex gap-6 text-sm text-[#ffefcb]/60">
                <a href="#" className="hover:text-[#ffefcb] transition-colors">Privacy</a>
                <a href="#" className="hover:text-[#ffefcb] transition-colors">Terms</a>
                <a href="#" className="hover:text-[#ffefcb] transition-colors">Twitter</a>
            </div>
        </div>
    </footer>
);

export const LandingPage = ({ onStartOnboarding }: LandingPageProps) => {
  // Auto-navigate to dashboard when component mounts
  useEffect(() => {
    onStartOnboarding();
  }, [onStartOnboarding]);

  return (
    <div className="min-h-screen bg-[#ffefcb] text-[#0b2519] flex items-center justify-center">
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b2519] mx-auto mb-4"></div>
        <p className="text-lg font-medium">Loading your dashboard...</p>
      </div>
    </div>
  );
};

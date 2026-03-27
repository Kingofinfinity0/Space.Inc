import React from 'react';
import {
  ArrowRight,
  Check,
  MessageSquare,
  Video,
  FileText,
  Layers,
  Zap,
  Shield,
  Users,
  Clock,
  Layout,
  Rocket
} from 'lucide-react';
import { Button } from './UI/Button';
import { GlassCard } from './UI/GlassCard';
import { Heading } from './UI/Heading';

interface LandingPageProps {
  onStartOnboarding: () => void;
}

const Navbar = ({ onStartOnboarding }: LandingPageProps) => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-[#ffefcb]/80 backdrop-blur-md border-b border-[#0b2519]/5">
    <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-[#0b2519] rounded-lg flex items-center justify-center text-[#ffefcb] font-bold">S</div>
        <span className="text-xl font-bold tracking-tighter text-[#0b2519]">Space.inc</span>
      </div>
      <div className="hidden md:flex items-center gap-8">
        <a href="#features" className="text-sm font-medium text-[#0b2519]/60 hover:text-[#0b2519] transition-colors">Features</a>
        <a href="#comparison" className="text-sm font-medium text-[#0b2519]/60 hover:text-[#0b2519] transition-colors">Why Us</a>
        <a href="#pricing" className="text-sm font-medium text-[#0b2519]/60 hover:text-[#0b2519] transition-colors">Pricing</a>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={onStartOnboarding}
          className="text-sm font-bold uppercase tracking-widest text-[#0b2519] hover:opacity-70 transition-opacity"
        >
          Sign In
        </button>
        <Button
          variant="primary"
          size="sm"
          onClick={onStartOnboarding}
          className="bg-[#0b2519] text-[#ffefcb] hover:bg-[#0b2519]/90 font-bold uppercase tracking-widest text-[10px] px-6"
        >
          Get Started
        </Button>
      </div>
    </div>
  </nav>
);

const Hero = ({ onStartOnboarding }: LandingPageProps) => (
  <section className="pt-40 pb-20 md:pt-52 md:pb-32 px-6 bg-[#ffefcb] overflow-hidden">
    <div className="max-w-7xl mx-auto">
      <div className="text-center max-w-4xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0b2519]/5 border border-[#0b2519]/10 mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b2519]/60">Beta Access Now Open</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-medium tracking-tight text-[#0b2519] mb-8 leading-[0.95]">
          Your Entire Client Relationship, <br/>
          <span className="italic font-light">In One Space.</span>
        </h1>
        <p className="text-lg md:text-xl text-[#0b2519]/70 font-light leading-relaxed mb-10 max-w-2xl mx-auto">
          Stop juggling tabs. Space.inc unifies your communication, files, and meetings
          into a single, beautiful dashboard for every client.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            variant="primary"
            size="lg"
            onClick={onStartOnboarding}
            className="w-full sm:w-auto bg-[#0b2519] text-[#ffefcb] hover:bg-[#0b2519]/90 py-6 px-10 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-[#0b2519]/10"
          >
            Create Your First Space <ArrowRight size={18} className="ml-2" />
          </Button>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0b2519]/40">
            Free for up to 3 clients
          </p>
        </div>
      </div>

      <div className="relative max-w-5xl mx-auto">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-[#0b2519]/20 rounded-[2.5rem] blur-2xl" />
        <GlassCard className="relative border-[#0b2519]/10 p-2 rounded-[2.5rem] shadow-2xl">
          <div className="rounded-[2rem] overflow-hidden border border-[#0b2519]/5 bg-white shadow-inner">
            <img
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426&ixlib=rb-4.0.3"
              alt="Space.inc Dashboard"
              className="w-full h-auto opacity-90 mix-blend-multiply grayscale hover:grayscale-0 transition-all duration-700"
            />
          </div>
        </GlassCard>
      </div>
    </div>
  </section>
);

const Comparison = () => (
  <section id="comparison" className="py-32 bg-white">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-[#0b2519] mb-6">
            The friction of the <br/>
            Status Quo.
          </h2>
          <p className="text-[#0b2519]/70 font-light mb-10 text-lg">
            Fragmented communication breaks trust. When your client has to check Slack, Email,
            Zoom, and Drive just to see an update, you've already lost the momentum.
          </p>

          <div className="space-y-4">
            {[
              "Buried email threads",
              "Lost file versions",
              "Meeting fatigue",
              "Context switching costs"
            ].map(item => (
              <div key={item} className="flex items-center gap-3 text-red-500/80">
                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center">
                  <Clock size={12} />
                </div>
                <span className="text-sm font-medium uppercase tracking-wider">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <GlassCard className="p-8 md:p-12 bg-[#ffefcb]/30 border-[#0b2519]/10 rounded-[2.5rem]">
          <h3 className="text-2xl font-bold text-[#0b2519] mb-8 uppercase tracking-tighter">The Space Way</h3>
          <div className="space-y-6">
            {[
              { title: "Unified Context", desc: "Every message, file, and meeting in one timeline." },
              { title: "Instant Trust", desc: "Give clients a dedicated portal they actually want to use." },
              { title: "Zero Noise", desc: "Separate internal strategy from client-facing delivery." }
            ].map(item => (
              <div key={item.title} className="group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Check size={14} />
                  </div>
                  <h4 className="font-black uppercase tracking-widest text-xs text-[#0b2519]">{item.title}</h4>
                </div>
                <p className="pl-9 text-sm text-[#0b2519]/60 font-light">{item.desc}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  </section>
);

const FeatureCard = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <div className="p-8 rounded-[2rem] bg-[#ffefcb]/20 border border-[#0b2519]/5 hover:border-[#0b2519]/20 transition-all group">
    <div className="w-12 h-12 rounded-2xl bg-[#0b2519] flex items-center justify-center text-[#ffefcb] mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-[#0b2519]/10">
      <Icon size={24} strokeWidth={1.5} />
    </div>
    <h3 className="text-lg font-bold text-[#0b2519] mb-3 uppercase tracking-tight">{title}</h3>
    <p className="text-[#0b2519]/60 text-sm leading-relaxed font-light">{desc}</p>
  </div>
);

const Features = () => (
  <section id="features" className="py-32 bg-white">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center max-w-3xl mx-auto mb-20">
        <h2 className="text-3xl md:text-5xl font-medium text-[#0b2519] mb-6 tracking-tight">Everything you need, <br/>nothing you don't.</h2>
        <p className="text-[#0b2519]/60 text-lg font-light">
          We stripped away the complexity of traditional CRMs and project management tools
          to focus on what matters: the relationship.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FeatureCard
          icon={MessageSquare}
          title="Unified Inbox"
          desc="Real-time messaging with distinct client and internal channels. Keep strategy private, results public."
        />
        <FeatureCard
          icon={Video}
          title="Integrated Meetings"
          desc="Launch video calls instantly. Record outcomes and track engagement automatically."
        />
        <FeatureCard
          icon={FileText}
          title="Smart Files"
          desc="Version-controlled document management. No more 'v2_final_final' email attachments."
        />
        <FeatureCard
          icon={Layers}
          title="Task Tracking"
          desc="Simple, transparent task lists that keep projects moving without the bloat."
        />
      </div>
    </div>
  </section>
);

const PricingCard = ({ title, price, desc, features, isPopular, onStartOnboarding }: any) => (
  <div className={`
    p-10 rounded-[2.5rem] border flex flex-col h-full transition-all duration-500
    ${isPopular
      ? 'bg-[#0b2519] text-[#ffefcb] border-[#0b2519] shadow-2xl scale-105 z-10'
      : 'bg-white text-[#0b2519] border-[#0b2519]/10 hover:border-[#0b2519]/30'}
  `}>
    <div className="mb-8">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] opacity-80">{title}</h3>
        {isPopular && (
          <span className="bg-[#ffefcb] text-[#0b2519] text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded">Best Value</span>
        )}
      </div>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-5xl font-medium tracking-tighter">${price}</span>
        <span className="text-xs opacity-60 font-medium">/mo</span>
      </div>
      <p className="text-sm opacity-70 font-light leading-relaxed">{desc}</p>
    </div>

    <div className="space-y-4 mb-10 flex-1">
      {features.map((feat: string) => (
        <div key={feat} className="flex items-center gap-3 text-xs font-medium">
          <Check size={14} className={isPopular ? 'text-emerald-400' : 'text-emerald-600'} />
          <span className="opacity-80">{feat}</span>
        </div>
      ))}
    </div>

    <Button
      variant={isPopular ? 'secondary' : 'primary'}
      size="lg"
      onClick={onStartOnboarding}
      className={`
        w-full py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px]
        ${isPopular
          ? 'bg-[#ffefcb] text-[#0b2519] hover:bg-white shadow-xl shadow-black/20'
          : 'bg-[#0b2519] text-[#ffefcb] hover:bg-[#0b2519]/90'}
      `}
    >
      Select Plan
    </Button>
  </div>
);

const Pricing = ({ onStartOnboarding }: LandingPageProps) => (
  <section id="pricing" className="py-32 bg-[#ffefcb]/50">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center max-w-2xl mx-auto mb-20">
        <h2 className="text-4xl md:text-5xl font-medium text-[#0b2519] mb-6 tracking-tight">Scale your agency.</h2>
        <p className="text-[#0b2519]/60 text-lg font-light">
          Simple, transparent pricing that grows as you add more clients.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PricingCard
          title="Starter"
          price="29"
          desc="Perfect for solo operators."
          features={["3 Client Spaces", "1 Staff Seat", "5GB Storage", "500 Meeting Mins"]}
          onStartOnboarding={onStartOnboarding}
        />
        <PricingCard
          title="Growth"
          price="79"
          desc="Ideal for small teams."
          isPopular={true}
          features={["10 Client Spaces", "3 Staff Seats", "20GB Storage", "2,000 Meeting Mins"]}
          onStartOnboarding={onStartOnboarding}
        />
        <PricingCard
          title="Scale"
          price="199"
          desc="For growing agencies."
          features={["30 Client Spaces", "10 Staff Seats", "100GB Storage", "10,000 Meeting Mins"]}
          onStartOnboarding={onStartOnboarding}
        />
        <PricingCard
          title="Pro"
          price="399"
          desc="The ultimate powerhouse."
          features={["50 Client Spaces", "20 Staff Seats", "250GB Storage", "Unlimited Meetings"]}
          onStartOnboarding={onStartOnboarding}
        />
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-[#0b2519] py-20 text-[#ffefcb]">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-[#ffefcb] rounded-lg flex items-center justify-center text-[#0b2519] font-bold">S</div>
            <span className="text-2xl font-bold tracking-tighter">Space.inc</span>
          </div>
          <p className="text-[#ffefcb]/60 font-light max-w-sm leading-relaxed">
            The nexus for high-performance client relationships.
            Built for those who value clarity, trust, and speed.
          </p>
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 opacity-40">Product</h4>
          <ul className="space-y-4 text-sm font-medium opacity-80">
            <li><a href="#features" className="hover:opacity-100 transition-opacity">Features</a></li>
            <li><a href="#pricing" className="hover:opacity-100 transition-opacity">Pricing</a></li>
            <li><a href="#" className="hover:opacity-100 transition-opacity">Changelog</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 opacity-40">Company</h4>
          <ul className="space-y-4 text-sm font-medium opacity-80">
            <li><a href="#" className="hover:opacity-100 transition-opacity">About</a></li>
            <li><a href="#" className="hover:opacity-100 transition-opacity">Privacy</a></li>
            <li><a href="#" className="hover:opacity-100 transition-opacity">Terms</a></li>
          </ul>
        </div>
      </div>
      <div className="pt-8 border-t border-[#ffefcb]/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">© 2024 Space.inc. All rights reserved.</p>
        <div className="flex gap-6 opacity-40 text-xs font-bold uppercase tracking-widest">
          <a href="#" className="hover:opacity-100 transition-opacity">Twitter</a>
          <a href="#" className="hover:opacity-100 transition-opacity">LinkedIn</a>
        </div>
      </div>
    </div>
  </footer>
);

export const LandingPage = ({ onStartOnboarding }: LandingPageProps) => {
  return (
    <div className="min-h-screen bg-[#ffefcb] font-sans selection:bg-[#0b2519] selection:text-[#ffefcb]">
      <Navbar onStartOnboarding={onStartOnboarding} />
      <Hero onStartOnboarding={onStartOnboarding} />
      <Comparison />
      <Features />
      <Pricing onStartOnboarding={onStartOnboarding} />
      <Footer />
    </div>
  );
};

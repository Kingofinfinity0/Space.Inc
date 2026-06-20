import React from 'react';
import { ArrowRight, Check, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { VeroBrand } from './brand/VeroLogo';

type Plan = {
  name: string;
  price: string;
  clientSpaces: string;
  staffSeats: string;
  storage: string;
  videoMinutes: string;
  bestFor: string;
};

const plans: Plan[] = [
  {
    name: 'Starter',
    price: '$29/mo',
    clientSpaces: '5 spaces',
    staffSeats: '1 seat included',
    storage: '10 GB',
    videoMinutes: '500 / mo',
    bestFor: 'Solo operators & freelancers'
  },
  {
    name: 'Studio',
    price: '$89/mo',
    clientSpaces: '15 spaces',
    staffSeats: '3 seats included',
    storage: '50 GB',
    videoMinutes: '2,500 / mo',
    bestFor: 'Small agencies & consultants'
  },
  {
    name: 'Agency',
    price: '$249/mo',
    clientSpaces: '50 spaces',
    staffSeats: '10 seats included',
    storage: '200 GB',
    videoMinutes: '10,000 / mo',
    bestFor: 'Established service teams'
  }
];

const addons = [
  ['Extra client space', '$15/mo for 5 new spaces'],
  ['Extra staff seat', '$15/mo per seat'],
  ['Extra storage', '$0.15 per GB/mo'],
  ['Extra video minutes', '$0.01 per participant-minute']
];

const PublicHeader = () => (
  <header className="fixed inset-x-0 top-0 z-40 border-b border-[#E5E5E5] bg-white/92 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
      <Link to="/" aria-label="Vero home">
        <VeroBrand
          markTone="dark"
          markClassName="h-7 w-7"
          textClassName="text-[15px] font-semibold tracking-[0.01em] text-[#0D0D0D]"
        />
      </Link>
      <nav className="flex items-center gap-2">
        <Link
          to="/pricing"
          className="hidden rounded-[8px] px-3 py-2 text-sm font-medium text-[#52525B] hover:bg-[#F7F7F8] hover:text-[#0D0D0D] sm:inline-flex"
        >
          Pricing
        </Link>
        <Link
          to="/login"
          className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#DADADA] bg-white px-4 text-sm font-semibold text-[#0D0D0D] hover:bg-[#F7F7F8]"
        >
          <LogIn size={16} />
          Sign in
        </Link>
      </nav>
    </div>
  </header>
);

const PublicFooter = () => (
  <footer className="border-t border-[#E5E5E5] bg-white">
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[#6E6E80] sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <VeroBrand
        markTone="dark"
        markClassName="h-6 w-6"
        textClassName="font-semibold text-[#0D0D0D]"
      />
      <p>Built for service teams that need one clear place for every client.</p>
    </div>
  </footer>
);

const HeroPreview = () => (
  <div className="mx-auto w-full max-w-[520px] border border-[#0D0D0D] bg-white p-3 shadow-[12px_12px_0_#0D0D0D]">
    <div className="flex items-center justify-between border-b border-[#E5E5E5] px-2 pb-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#0D0D0D]" />
        <span className="text-xs font-semibold text-[#0D0D0D]">Client OS</span>
      </div>
      <span className="text-xs text-[#6E6E80]">Live workspace</span>
    </div>
    <div className="grid gap-3 p-2 pt-4 sm:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-2">
        {['Strategy room', 'Files', 'Meetings', 'Tasks'].map((item, index) => (
          <div
            key={item}
            className={`flex h-10 items-center justify-between border px-3 text-xs ${
              index === 0 ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white' : 'border-[#E5E5E5] bg-[#FAFAFA] text-[#52525B]'
            }`}
          >
            <span>{item}</span>
            <span>{index === 0 ? '12' : `0${index + 2}`}</span>
          </div>
        ))}
      </div>
      <div className="border border-[#E5E5E5] bg-[#FAFAFA] p-4">
        <div className="mb-6 h-3 w-24 bg-[#0D0D0D]" />
        <div className="space-y-3">
          <div className="h-3 w-full bg-[#DADADA]" />
          <div className="h-3 w-10/12 bg-[#DADADA]" />
          <div className="h-3 w-7/12 bg-[#DADADA]" />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <div className="border border-[#E5E5E5] bg-white p-3">
            <div className="text-2xl font-semibold text-[#0D0D0D]">10</div>
            <div className="text-xs text-[#6E6E80]">spaces</div>
          </div>
          <div className="border border-[#E5E5E5] bg-white p-3">
            <div className="text-2xl font-semibold text-[#0D0D0D]">3</div>
            <div className="text-xs text-[#6E6E80]">staff</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PlanCard = ({ plan, featured = false }: { plan: Plan; featured?: boolean }) => (
  <article className={`flex h-full flex-col border p-6 ${featured ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white' : 'border-[#E5E5E5] bg-white text-[#0D0D0D]'}`}>
    <div className="mb-7">
      <h3 className="text-xl font-semibold tracking-tight">{plan.name}</h3>
      <div className="mt-4 flex items-end gap-2">
        <span className="text-4xl font-semibold tracking-tight">{plan.price.replace('/mo', '')}</span>
        <span className={`pb-1 text-sm ${featured ? 'text-white/62' : 'text-[#6E6E80]'}`}>/mo</span>
      </div>
      <p className={`mt-4 min-h-10 text-sm leading-6 ${featured ? 'text-white/72' : 'text-[#6E6E80]'}`}>{plan.bestFor}</p>
    </div>

    <div className="space-y-3 text-sm">
      {[plan.clientSpaces, plan.staffSeats, plan.storage, plan.videoMinutes].map((item) => (
        <div key={item} className="flex items-start gap-3">
          <Check size={16} className={`mt-0.5 shrink-0 ${featured ? 'text-white' : 'text-[#0D0D0D]'}`} />
          <span>{item}</span>
        </div>
      ))}
    </div>

    <button
      type="button"
      className={`mt-8 min-h-11 w-full border px-4 text-sm font-semibold ${
        featured
          ? 'border-white bg-white text-[#0D0D0D] hover:bg-[#F7F7F8]'
          : 'border-[#0D0D0D] bg-white text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-white'
      }`}
    >
      Get Started
    </button>
  </article>
);

const AddonsSection = () => (
  <section className="border-t border-[#E5E5E5] bg-[#FAFAFA]">
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-[#0D0D0D]">Add what you need.</h2>
        <p className="mt-4 max-w-md text-base leading-7 text-[#6E6E80]">
          Plans stay simple. Usage can scale with client spaces, staff, storage, and video minutes as your operations grow.
        </p>
      </div>
      <div className="grid gap-px overflow-hidden border border-[#E5E5E5] bg-[#E5E5E5] sm:grid-cols-2">
        {addons.map(([name, price]) => (
          <div key={name} className="bg-white p-5">
            <div className="text-sm font-semibold text-[#0D0D0D]">{name}</div>
            <div className="mt-2 text-sm text-[#6E6E80]">{price}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-[#0D0D0D]">
      <PublicHeader />
      <main>
        <section className="border-b border-[#E5E5E5] pt-16">
          <div className="mx-auto grid min-h-[calc(100vh-64px)] max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div className="max-w-3xl">
              <h1 className="text-[44px] font-semibold leading-[0.96] tracking-tight text-[#0D0D0D] sm:text-[72px] lg:text-[86px]">
                One client workspace. Every moving part.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#52525B] sm:text-xl">
                Vero gives service businesses a focused place for client spaces, meetings, files, messages, and follow-through.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/pricing"
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#0D0D0D] px-6 text-sm font-semibold text-white hover:bg-black/82"
                >
                  View pricing
                  <ArrowRight size={17} />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#DADADA] bg-white px-6 text-sm font-semibold text-[#0D0D0D] hover:bg-[#F7F7F8]"
                >
                  Sign in
                </Link>
              </div>
            </div>
            <HeroPreview />
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
};

export const PricingPage = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-[#0D0D0D]">
      <PublicHeader />
      <main className="pt-16">
        <section className="border-b border-[#E5E5E5]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="max-w-3xl">
              <h1 className="text-[42px] font-semibold leading-[1] tracking-tight text-[#0D0D0D] sm:text-[64px]">
                Pricing that matches your client load.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#52525B]">
                Start with the workspace capacity you need today, then add spaces, seats, storage, or video minutes when the operation gets busier.
              </p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard key={plan.name} plan={plan} featured={plan.name === 'Studio (The Sweet Spot)'} />
              ))}
            </div>
          </div>
        </section>
        <AddonsSection />
      </main>
      <PublicFooter />
    </div>
  );
};

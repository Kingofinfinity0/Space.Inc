
import React from 'react';

// --- Glass Card ---
export const GlassCard: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`
      bg-white/60 backdrop-blur-xl 
      border border-white/40 
      shadow-[0_8px_30px_rgb(0,0,0,0.04)] 
      rounded-3xl 
      transition-all duration-300
      ${onClick ? 'cursor-pointer hover:bg-white/70 hover:scale-[1.01] hover:shadow-lg' : ''} 
      ${className}
    `}
  >
    {children}
  </div>
);

// --- Typography ---
export const Heading: React.FC<{ children: React.ReactNode; level?: 1 | 2 | 3; className?: string }> = ({ children, level = 1, className = '' }) => {
  const base = "text-zinc-900 tracking-tight";
  if (level === 1) return <h1 className={`text-4xl font-extralight ${base} ${className}`}>{children}</h1>;
  if (level === 2) return <h2 className={`text-2xl font-light ${base} ${className}`}>{children}</h2>;
  return <h3 className={`text-lg font-medium ${base} ${className}`}>{children}</h3>;
};

export const Text: React.FC<{ children: React.ReactNode; className?: string; variant?: 'primary' | 'secondary' }> = ({ children, className = '', variant = 'primary' }) => (
  <p className={`text-sm ${variant === 'secondary' ? 'text-zinc-500' : 'text-zinc-700'} font-light leading-relaxed ${className}`}>
    {children}
  </p>
);

// --- Buttons ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', isLoading, className = '', ...props }) => {
  const baseStyle = "rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const sizes = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base"
  };

  const variants = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg hover:shadow-xl border border-transparent",
    secondary: "bg-white/80 text-zinc-900 hover:bg-white border border-white/20 shadow-sm",
    ghost: "bg-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
  };

  return (
    <button className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {isLoading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      )}
      {children}
    </button>
  );
};

// --- Inputs ---
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input 
    {...props} 
    className={`
      w-full bg-white/40 border border-zinc-200 
      rounded-2xl px-5 py-3 text-zinc-800 placeholder-zinc-400
      focus:outline-none focus:ring-2 focus:ring-zinc-200/50 focus:bg-white/70 
      transition-all font-light text-sm
      ${props.className}
    `}
  />
);

export const Checkbox: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <div 
    onClick={() => onChange(!checked)}
    className={`
      flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200
      ${checked ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white/50 border-zinc-200 text-zinc-600 hover:bg-white'}
    `}
  >
    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${checked ? 'border-white bg-white/20' : 'border-zinc-300'}`}>
      {checked && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
    </div>
    <span className="text-sm font-medium">{label}</span>
  </div>
);

export const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-zinc-600 font-light text-sm">{label}</span>
    <button 
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 rounded-full transition-colors duration-300 relative ${checked ? 'bg-zinc-900' : 'bg-zinc-200'}`}
    >
      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-md ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  </div>
);

// --- Modal ---
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-200/30 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      {/* Content */}
      <div className="relative w-full max-w-lg animate-[fadeIn_0.3s_ease-out]">
        <GlassCard className="p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <Heading level={2}>{title}</Heading>
                <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-900 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            {children}
        </GlassCard>
      </div>
    </div>
  );
};

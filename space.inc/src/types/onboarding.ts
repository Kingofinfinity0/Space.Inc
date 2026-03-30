export type BusinessType = 'Agency' | 'Freelancer' | 'Startup' | 'Small Business' | 'Enterprise' | 'Other';

export type Goal = 
  | 'Client Communication' 
  | 'Project Management' 
  | 'Team Collaboration' 
  | 'File Sharing' 
  | 'Client Portal' 
  | 'Billing & Invoicing';

export interface OnboardingFormData {
  // Business Information
  businessName: string;
  businessType: BusinessType;
  businessWebsite?: string;
  
  // Contact Information
  fullName: string;
  email: string;
  phoneNumber: string;
  
  // Goals
  goals: Goal[];
  
  // Preferences
  teamSize: string;
  industry: string;
  
  // Payment
  paymentMethod: 'credit_card' | 'bank_transfer' | 'crypto';
  termsAccepted: boolean;
}

export interface PaymentVerificationData {
  sessionId: string;
  userId?: string;
  email: string;
  planId: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'checkbox' | 'checkbox-group' | 'radio';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  validation?: {
    required?: string;
    pattern?: {
      value: RegExp;
      message: string;
    };
    minLength?: {
      value: number;
      message: string;
    };
    maxLength?: {
      value: number;
      message: string;
    };
  };
}

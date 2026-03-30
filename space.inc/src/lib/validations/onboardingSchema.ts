import { z } from 'zod';
import { BusinessType, Goal } from '../../types/onboarding';

const businessTypeValues: [BusinessType, ...BusinessType[]] = [
  'Agency',
  'Freelancer',
  'Startup',
  'Small Business',
  'Enterprise',
  'Other',
];

const goalValues: Goal[] = [
  'Client Communication',
  'Project Management',
  'Team Collaboration',
  'File Sharing',
  'Client Portal',
  'Billing & Invoicing',
];

export const onboardingSchema = z.object({
  // Business Information
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  businessType: z.enum([businessTypeValues[0], ...businessTypeValues.slice(1)]),
  businessWebsite: z.string().url('Please enter a valid URL').or(z.literal('')).optional(),
  
  // Contact Information
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  phoneNumber: z.string().min(10, 'Please enter a valid phone number'),
  
  // Goals
  goals: z
    .array(z.enum([goalValues[0], ...goalValues.slice(1)]))
    .min(1, 'Select at least one goal'),
  
  // Preferences
  teamSize: z.string().min(1, 'Please select team size'),
  industry: z.string().min(2, 'Please enter your industry'),
  
  // Payment
  paymentMethod: z.enum(['credit_card', 'bank_transfer', 'crypto']),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions',
  }),
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;

export const paymentVerificationSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  userId: z.string().uuid('Invalid user ID').optional(),
  email: z.string().email('Invalid email'),
  planId: z.string().min(1, 'Plan ID is required'),
  status: z.enum(['pending', 'completed', 'failed']),
  timestamp: z.string().datetime(),
});

export type PaymentVerificationData = z.infer<typeof paymentVerificationSchema>;

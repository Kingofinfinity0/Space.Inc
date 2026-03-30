import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { onboardingService } from '../../lib/supabase/onboarding';
import { Loader2 } from 'lucide-react';
import { Button } from '../UI';

export const PaymentVerification: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const sessionId = searchParams.get('session_id');
        const planId = searchParams.get('plan_id');
        
        if (!sessionId || !planId) {
          throw new Error('Missing required parameters');
        }

        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          // If no user is logged in, redirect to signup with the email from the payment
          const email = searchParams.get('email');
          if (email) {
            navigate(`/signup?email=${encodeURIComponent(email)}&redirect=/onboarding?session_id=${sessionId}&plan_id=${planId}`);
          } else {
            navigate('/login?error=session_expired');
          }
          return;
        }

        // Verify the payment with our backend
        const paymentData = {
          sessionId,
          userId: user.id,
          email: user.email!,
          planId,
          status: 'completed' as const,
          timestamp: new Date().toISOString(),
        };

        await onboardingService.verifyPayment(paymentData);
        
        // Check if user has completed onboarding
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', user.id)
          .single();

        if (profile?.onboarding_complete) {
          navigate('/dashboard');
        } else {
          navigate('/onboarding');
        }
        
        setStatus('success');
      } catch (err) {
        console.error('Payment verification failed:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  if (status === 'verifying') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <h1 className="text-2xl font-bold text-gray-900">Verifying Your Payment</h1>
            <p className="text-gray-600 text-center">
              Please wait while we verify your payment details. This may take a moment...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-3 bg-red-100 rounded-full">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Verification Failed</h1>
            <p className="text-gray-600 text-center">
              {error || 'There was an issue verifying your payment. Please try again or contact support.'}
            </p>
            <div className="flex flex-col w-full space-y-2">
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Try Again
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/pricing')}
                className="w-full"
              >
                Back to Pricing
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PaymentVerification;

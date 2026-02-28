import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const LoadingVerification = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const verifySubscription = async () => {
      try {
        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        if (!session) {
          navigate('/login');
          return;
        }

        // Verify subscription status
        const response = await fetch('YOUR_SUBSCRIPTION_VERIFICATION_EDGE_FUNCTION_URL', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to verify subscription');
        }

        if (data.status === 'active') {
          // If subscription is active, navigate to dashboard
          navigate('/dashboard');
        } else {
          // If subscription is not active, show error
          throw new Error('Subscription not active');
        }
      } catch (error) {
        console.error('Verification error:', error);
        navigate('/onboarding/error', { 
          state: { 
            error: error.message || 'Failed to verify your subscription. Please contact support.' 
          } 
        });
      }
    };

    // Start verification
    verifySubscription();

    // Set up a timeout to handle cases where verification takes too long
    const timeout = setTimeout(() => {
      navigate('/onboarding/error', { 
        state: { 
          error: 'Verification is taking longer than expected. You will be redirected to the dashboard shortly.' 
        } 
      });
    }, 30000); // 30 seconds timeout

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Setting up your workspace</h2>
        <p className="text-gray-600">This may take a moment. Please don't close this page.</p>
        <div className="mt-6">
          <div className="h-1 w-64 bg-gray-200 rounded-full overflow-hidden mx-auto">
            <div 
              className="h-full bg-indigo-600 rounded-full animate-pulse"
              style={{
                width: '100%',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingVerification;

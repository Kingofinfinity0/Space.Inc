import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LoadingScreen, useLoadingScreenGate } from '../UI';

const LoadingVerification = () => {
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);
  const [nextRoute, setNextRoute] = useState<{ path: string; state?: unknown } | null>(null);
  const loadingGate = useLoadingScreenGate(isVerifying);

  useEffect(() => {
    const verifySubscription = async () => {
      try {
        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        if (!session) {
          setNextRoute({ path: '/login' });
          setIsVerifying(false);
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
          setNextRoute({ path: '/dashboard' });
          setIsVerifying(false);
        } else {
          // If subscription is not active, show error
          throw new Error('Subscription not active');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setNextRoute({
          path: '/onboarding/error',
          state: { 
            error: error.message || 'Failed to verify your subscription. Please contact support.' 
          } 
        });
        setIsVerifying(false);
      }
    };

    // Start verification
    verifySubscription();

    // Set up a timeout to handle cases where verification takes too long
    const timeout = setTimeout(() => {
      setNextRoute({
        path: '/onboarding/error',
        state: { 
          error: 'Verification is taking longer than expected. You will be redirected to the dashboard shortly.' 
        } 
      });
      setIsVerifying(false);
    }, 30000); // 30 seconds timeout

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <LoadingScreen
      key={loadingGate.cycleKey}
      message="Setting up your workspace..."
      isComplete={loadingGate.isComplete}
      onExitComplete={() => {
        loadingGate.handleExitComplete();
        if (nextRoute) navigate(nextRoute.path, { state: nextRoute.state });
      }}
    />
  );
};

export default LoadingVerification;

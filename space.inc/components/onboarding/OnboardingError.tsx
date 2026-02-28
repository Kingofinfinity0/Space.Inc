import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../UI';

const OnboardingError = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get error message from location state or use a default message
  const errorMessage = location.state?.error || 'An unexpected error occurred during the onboarding process.';

  const handleRetry = () => {
    // Navigate back to the onboarding start
    navigate('/onboarding');
  };

  const handleContactSupport = () => {
    // This would typically open a support form or email
    window.location.href = 'mailto:support@yourapp.com';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        
        <h2 className="mt-3 text-2xl font-bold text-gray-900">
          Something went wrong
        </h2>
        
        <p className="mt-2 text-gray-600">
          {errorMessage}
        </p>
        
        <div className="mt-6 space-y-4">
          <Button
            onClick={handleRetry}
            className="w-full flex justify-center"
          >
            Try Again
          </Button>
          
          <Button
            variant="secondary"
            onClick={handleContactSupport}
            className="w-full flex justify-center"
          >
            Contact Support
          </Button>
        </div>
        
        <p className="mt-6 text-sm text-gray-500">
          If the problem persists, please contact our support team for assistance.
        </p>
      </div>
    </div>
  );
};

export default OnboardingError;

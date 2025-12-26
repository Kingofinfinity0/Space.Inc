import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../UI';

const STEPS = [
  {
    id: 'business',
    title: 'Tell us about your business',
    fields: [
      {
        name: 'businessName',
        label: 'Business/Organization Name',
        type: 'text',
        required: true,
      },
      {
        name: 'businessType',
        label: 'Type of Business',
        type: 'select',
        options: [
          'Agency',
          'Freelancer',
          'Startup',
          'Small Business',
          'Enterprise',
          'Other',
        ],
        required: true,
      },
    ],
  },
  {
    id: 'goals',
    title: 'What are your main goals?',
    description: 'Select all that apply',
    fields: [
      {
        name: 'goals',
        type: 'checkbox-group',
        options: [
          'Client Communication',
          'Project Management',
          'Team Collaboration',
          'File Sharing',
          'Client Portal',
          'Billing & Invoicing',
        ],
        required: true,
      },
    ],
  },
  {
    id: 'team',
    title: 'Team Information',
    fields: [
      {
        name: 'teamSize',
        label: 'Team Size',
        type: 'select',
        options: ['1', '2-5', '6-10', '11-25', '26-50', '51+'],
        required: true,
      },
      {
        name: 'teamMembers',
        label: 'Team Member Emails (comma separated)',
        type: 'text',
        placeholder: 'team@example.com, member@example.com',
      },
    ],
  },
];

const OnboardingForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const currentStepData = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
          ? [...(prev[name] || []), value]
          : (prev[name] || []).filter((item: string) => item !== value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLastStep) {
      setIsSubmitting(true);
      setError('');
      
      try {
        // Here you'll call your edge function to save onboarding data
        const response = await fetch('YOUR_ONBOARDING_EDGE_FUNCTION_URL', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`
          },
          body: JSON.stringify({
            ...formData,
            onboardingComplete: true
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save onboarding data');
        }

        // Verify payment and subscription status
        const subscriptionCheck = await fetch('YOUR_SUBSCRIPTION_VERIFICATION_EDGE_FUNCTION_URL', {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          }
        });

        if (!subscriptionCheck.ok) {
          throw new Error('Subscription verification failed');
        }

        // Navigate to dashboard on success
        navigate('/dashboard');
      } catch (err) {
        setError(err.message || 'An error occurred during onboarding');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Helper function to get auth token
  const getAuthToken = async () => {
    const session = await supabase.auth.session();
    return session?.access_token;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {currentStepData.title}
        </h2>
        {currentStepData.description && (
          <p className="mt-2 text-center text-sm text-gray-600">
            {currentStepData.description}
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {currentStepData.fields.map((field) => (
                <div key={field.name}>
                  {field.type === 'select' ? (
                    <div>
                      <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
                        {field.label}
                      </label>
                      <select
                        id={field.name}
                        name={field.name}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        value={formData[field.name] || ''}
                        onChange={handleChange}
                        required={field.required}
                      >
                        <option value="">Select an option</option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : field.type === 'checkbox-group' ? (
                    <fieldset>
                      <legend className="block text-sm font-medium text-gray-700">
                        {field.label || currentStepData.title}
                      </legend>
                      <div className="mt-2 space-y-2">
                        {field.options.map((option) => (
                          <div key={option} className="flex items-center">
                            <input
                              id={`${field.name}-${option}`}
                              name={field.name}
                              type="checkbox"
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              value={option}
                              checked={formData[field.name]?.includes(option) || false}
                              onChange={handleChange}
                            />
                            <label
                              htmlFor={`${field.name}-${option}`}
                              className="ml-3 block text-sm font-medium text-gray-700"
                            >
                              {option}
                            </label>
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  ) : (
                    <div>
                      <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
                        {field.label}
                      </label>
                      <div className="mt-1">
                        <input
                          id={field.name}
                          name={field.name}
                          type={field.type || 'text'}
                          className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={formData[field.name] || ''}
                          onChange={handleChange}
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 0}
                variant="secondary"
                className={currentStep === 0 ? 'invisible' : ''}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="ml-3"
              >
                {isSubmitting
                  ? 'Processing...'
                  : isLastStep
                  ? 'Complete Setup'
                  : 'Next'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="mt-8">
        <div className="flex justify-center space-x-2">
          {STEPS.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full ${
                index <= currentStep ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-sm text-gray-500">
          Step {currentStep + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
};

export default OnboardingForm;

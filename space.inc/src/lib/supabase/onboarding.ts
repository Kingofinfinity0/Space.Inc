import { supabase } from '../supabase';
import { OnboardingFormData, PaymentVerificationData } from '../../types/onboarding';

export const onboardingService = {
  // Save onboarding progress
  async saveProgress(userId: string, data: Partial<OnboardingFormData>) {
    const { data: existing } = await supabase
      .from('onboarding_progress')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      return supabase
        .from('onboarding_progress')
        .update({ data, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    }

    return supabase
      .from('onboarding_progress')
      .insert([{ user_id: userId, data }]);
  },

  // Get saved progress
  async getProgress(userId: string) {
    const { data, error } = await supabase
      .from('onboarding_progress')
      .select('data')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data?.data || {};
  },

  // Complete onboarding
  async completeOnboarding(userId: string, formData: OnboardingFormData) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('User not authenticated');

    // Start a transaction to ensure data consistency
    const { data, error } = await supabase.rpc('complete_onboarding', {
      user_id: userId,
      business_name: formData.businessName,
      business_type: formData.businessType,
      business_website: formData.businessWebsite || null,
      full_name: formData.fullName,
      phone_number: formData.phoneNumber,
      goals: formData.goals,
      team_size: formData.teamSize,
      industry: formData.industry,
    });

    if (error) throw error;
    return data;
  },

  // Verify payment and create user
  async verifyPayment(paymentData: PaymentVerificationData) {
    const { getAuthHeader } = await import('../../services/apiService');
    const headers = await getAuthHeader();

    const { data, error } = await supabase.functions.invoke('verify-payment', {
      body: JSON.stringify(paymentData),
      headers: headers
    });

    if (error) throw error;
    return data;
  },

  // Get available plans
  async getPlans() {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('price_monthly');

    if (error) throw error;
    return data;
  },

  // Get current user's subscription
  async getSubscription(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore not found
    return data;
  },

  // Update user profile with onboarding data
  async updateProfile(userId: string, updates: Record<string, any>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;
    return data;
  },

  // Check if email exists
  async checkEmailExists(email: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    return { exists: !!data, error };
  },
};

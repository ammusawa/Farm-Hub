'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePaystackPayment } from 'react-paystack';
import { useLanguage } from '@/app/contexts/LanguageContext';

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();

  const plan = searchParams.get('plan') || 'premium'; // can extend later
  const period = searchParams.get('period') || 'monthly';

  // You can fetch these from your API later
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';
  const monthlyAmount = 250000; // ₦2,500 in kobo
  const yearlyAmount = 2400000; // ₦24,000 in kobo

  const amount = period === 'yearly' ? yearlyAmount : monthlyAmount;

  const [email, setEmail] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);

  // Fetch current user email (assume you have /api/auth/me)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (data.user?.email) {
          setEmail(data.user.email);
        } else {
          router.push('/login?redirect=/subscribe/checkout');
        }
      } catch (err) {
        router.push('/login?redirect=/subscribe/checkout');
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUser();
  }, [router]);

  const config = {
    reference: new Date().getTime().toString(),
    email,
    amount,
    publicKey,
    metadata: {
      plan_type: plan,
      billing_period: period,
      custom_fields: [
        { display_name: "User ID", variable_name: "user_id", value: "will_be_added_by_backend" },
      ],
    },
    // Very important for subscription!
    plan: 'PLN_xxxxxxxxxx', // ← REPLACE with your real monthly plan code from dashboard
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = (response: any) => {
    // Payment successful → redirect to success page
    // Backend webhook will handle subscription activation
    window.location.href = '/subscribe/success?reference=' + response.reference;
  };

  const onClose = () => {
    // User closed popup
    alert('Payment was cancelled. Try again?');
  };

  if (loadingUser) return <div className="text-center py-20">Loading...</div>;
  if (!email) return <div>Please log in first</div>;

  return (
    <div className="container mx-auto px-4 py-16 max-w-lg">
      <h1 className="text-3xl font-bold mb-6 text-center">Complete Your Premium Subscription</h1>

      <div className="bg-white p-8 rounded-xl shadow-lg border">
        <div className="text-center mb-8">
          <p className="text-4xl font-bold text-amber-600">
            ₦{(amount / 100).toLocaleString()}
          </p>
          <p className="text-gray-600">{period === 'yearly' ? 'per year' : 'per month'}</p>
        </div>

        <p className="text-center mb-8 text-gray-700">
          You're about to subscribe to Premium Farming Access
        </p>

        <button
          onClick={() => initializePayment({ onSuccess, onClose })}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-lg transition-colors"
          disabled={!publicKey}
        >
          Pay with Paystack
        </button>

        <p className="text-center text-sm text-gray-500 mt-6">
          Secured by Paystack • Cards, Bank Transfer, USSD & more
        </p>
      </div>
    </div>
  );
}
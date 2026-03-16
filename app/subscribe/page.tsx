'use client';

import { useState } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext'; // assuming you have this
import Link from 'next/link';

export default function SubscribePage() {
  const { t } = useLanguage();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // You can fetch real prices/user status from API later
  const monthlyPrice = 2500;    // ₦2,500 / month
  const yearlyPrice = 24000;    // ₦24,000 / year (~₦2,000/mo → 20% discount)
  const isYearly = billingPeriod === 'yearly';

  const currentPrice = isYearly ? yearlyPrice : monthlyPrice;
  const savings = isYearly ? Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100) : 0;

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-6xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Unlock Premium Farming Knowledge
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Get exclusive access to in-depth video guides, professional tips, downloadable resources 
          and direct expert support in your language.
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex rounded-full bg-gray-100 p-1">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
              billingPeriod === 'monthly'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
              billingPeriod === 'yearly'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly
            {savings > 0 && (
              <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                Save {savings}%
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Pricing Card - Most apps start with just one simple plan */}
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-10 text-white text-center">
            <h2 className="text-3xl font-bold mb-2">Premium Membership</h2>
            <div className="text-5xl font-bold mb-1">
              ₦{currentPrice.toLocaleString()}
              <span className="text-2xl font-normal opacity-90">
                {isYearly ? '/year' : '/month'}
              </span>
            </div>
            {isYearly && (
              <p className="text-sm opacity-90">
                Only ₦{Math.round(yearlyPrice / 12).toLocaleString()} per month
              </p>
            )}
          </div>

          {/* Features */}
          <div className="px-8 py-10">
            <ul className="space-y-4">
              {[
                "Unlimited access to all premium videos & guides",
                "Content in English, Hausa, Igbo & Yoruba",
                "Early access to new professional content",
                "Downloadable PDFs & checklists",
                "Priority support from verified agronomists",
                "Cancel anytime – no long-term lock-in",
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-green-500 text-xl mt-0.5">✓</span>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            <div className="mt-10">
              <Link
                href="/subscribe/checkout?plan=premium&period=${billingPeriod"
                className="block w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg py-4 rounded-xl text-center transition-colors shadow-lg"
              >
                Subscribe Now
              </Link>
            </div>

            <p className="text-center text-sm text-gray-500 mt-6">
              Secure payment • Cancel anytime
            </p>
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-8 text-center text-sm text-gray-500 space-y-2">
          <p>Trusted by hundreds of Nigerian farmers & agronomists</p>
          <p>Powered by Paystack • 100% secure payments</p>
        </div>
      </div>

      {/* FAQ section (optional but strongly recommended) */}
      <div className="mt-20">
        <h3 className="text-2xl font-bold text-center mb-10">Common Questions</h3>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div>
            <h4 className="font-semibold mb-2">Can I cancel anytime?</h4>
            <p className="text-gray-600">Yes — cancel through your account settings. No questions asked.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">What payment methods?</h4>
            <p className="text-gray-600">Cards, bank transfer, USSD, Apple Pay & more via Paystack.</p>
          </div>
          {/* Add 2–4 more common questions */}
        </div>
      </div>
    </div>
  );
}
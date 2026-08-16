import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Calculator, Sparkles, TrendingUp, DollarSign } from 'lucide-react';
import { NumberTicker } from './NumberTicker';

interface InteractiveCommissionCalculatorProps {
  initialValue?: number;
  currency?: string;
  className?: string;
}

const PRESETS = [500, 1500, 5000, 25000, 50000, 100000];

export function InteractiveCommissionCalculator({
  initialValue = 5000,
  currency = '$',
  className = '',
}: InteractiveCommissionCalculatorProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<number>(initialValue);

  const commission = Math.round(amount * 0.05 * 100) / 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(Number(e.target.value));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!isNaN(val) && val >= 0) {
      setAmount(val);
    }
  };

  return (
    <div className={`rounded-3xl border border-cream-dark bg-white p-5 sm:p-7 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-cream-dark">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-navy text-white shadow-xs">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-navy flex items-center gap-2">
              <span>{t('referrals.calc.interactiveTitle')}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700 border border-emerald-200">
                <Sparkles className="h-3 w-3" />
                5% Flat
              </span>
            </h3>
            <p className="text-xs text-navy/60 mt-0.5">{t('referrals.calc.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Main interactive area */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Left: Input & Slider */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <label className="text-xs font-bold text-navy/80 block mb-2">
              {t('referrals.calc.sliderLabel')}
            </label>
            <div className="relative">
              <span className="absolute start-3.5 top-1/2 -translate-y-1/2 text-navy/40 font-mono font-bold">
                {currency}
              </span>
              <input
                type="number"
                min="0"
                max="500000"
                step="100"
                value={amount || ''}
                onChange={handleInputChange}
                className="w-full h-12 rounded-2xl border border-cream-dark bg-cream/40 ps-8 pe-4 text-base font-extrabold font-mono text-navy focus:outline-hidden focus:border-navy focus:bg-white transition-all shadow-2xs"
                placeholder="5000"
              />
            </div>
          </div>

          {/* Slider */}
          <div className="space-y-1.5 pt-1">
            <input
              type="range"
              min="100"
              max="100000"
              step="250"
              value={amount}
              onChange={handleSliderChange}
              className="w-full h-2 bg-cream-dark rounded-lg appearance-none cursor-pointer accent-navy"
            />
            <div className="flex justify-between text-[10.5px] font-mono text-navy/50 font-medium">
              <span>{currency}100</span>
              <span>{currency}50,000</span>
              <span>{currency}100,000</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                  amount === preset
                    ? 'bg-navy text-white shadow-xs'
                    : 'bg-cream text-navy/70 hover:bg-cream-dark/60 hover:text-navy border border-cream-dark/60'
                }`}
              >
                {currency}{preset.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Profit Output Card */}
        <div className="lg:col-span-5">
          <motion.div
            layout
            className="rounded-2xl bg-gradient-to-br from-navy to-navy/90 p-5 text-white shadow-md relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                <span>{t('referrals.calc.yourEstimatedProfit')}</span>
                <span className="font-mono bg-white/10 px-2 py-0.5 rounded-full text-[10px] text-white/90">
                  5% Net
                </span>
              </div>

              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-400 my-2 flex items-baseline gap-1" dir="ltr">
                <span>+</span>
                <NumberTicker
                  value={commission}
                  prefix={currency}
                  decimalPlaces={commission % 1 !== 0 ? 2 : 0}
                  className="text-emerald-400 font-extrabold"
                />
              </div>

              <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/75 font-mono">
                <span>{t('referrals.calc.commissionFormula')}</span>
                <span className="text-emerald-300 font-bold" dir="ltr">
                  {currency}{amount.toLocaleString()} × 0.05
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

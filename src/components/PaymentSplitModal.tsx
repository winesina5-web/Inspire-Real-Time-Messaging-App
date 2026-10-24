import React, { useState } from 'react';
import { PaymentSplit } from '../types';

interface PaymentSplitModalProps {
  currentUserId: string;
  partnerName: string;
  partnerId: string;
  onConfirm: (split: PaymentSplit) => void;
  onClose: () => void;
}

export const PaymentSplitModal: React.FC<PaymentSplitModalProps> = ({
  currentUserId,
  partnerName,
  partnerId,
  onConfirm,
  onClose,
}) => {
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(40);
  const [currency, setCurrency] = useState('USD');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || totalAmount <= 0) return;

    const half = Math.round((totalAmount / 2) * 100) / 100;
    const split: PaymentSplit = {
      id: `split_${Date.now()}`,
      created_by: currentUserId,
      conversation_key: partnerId,
      title: title.trim(),
      total_amount: totalAmount,
      currency,
      created_at: new Date().toISOString(),
      items: [
        {
          id: `item_1_${Date.now()}`,
          user_id: currentUserId,
          amount: half,
          status: 'paid',
          paid_at: new Date().toISOString(),
        },
        {
          id: `item_2_${Date.now()}`,
          user_id: partnerId,
          amount: half,
          status: 'pending',
          paid_at: null,
        },
      ],
    };

    onConfirm(split);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-xl">💰</span>
          <h3 className="font-extrabold text-base text-black dark:text-white">
            Split Expense
          </h3>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Split a bill, dinner, or shared expense with {partnerName}.
        </p>

        <form onSubmit={handleCreate} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase text-black dark:text-white mb-1">
              Expense Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dinner & Coffee 🍕☕"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold text-black dark:text-white focus:outline-none"
            />
          </div>

          <div className="flex space-x-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase text-black dark:text-white mb-1">
                Total Amount
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold text-black dark:text-white focus:outline-none"
              />
            </div>

            <div className="w-24">
              <label className="block text-[11px] font-bold uppercase text-black dark:text-white mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-2 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-semibold text-black dark:text-white"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="PKR">PKR (₨)</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs flex justify-between items-center font-bold">
            <span className="text-gray-500">Each person owes:</span>
            <span className="text-black dark:text-white text-sm font-black">
              {currency} {(totalAmount / 2).toFixed(2)}
            </span>
          </div>

          <div className="flex space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
            >
              Send Split Card
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';

export const AdminAnalyticsPage: React.FC = () => {
  const mediaBreakdown = [
    { type: 'Text Messages', count: 620, percent: 68, color: '#0E2A6E' },
    { type: 'Photos & Images', count: 140, percent: 15, color: '#1A4FBA' },
    { type: 'Voice Notes', count: 95, percent: 10, color: '#FFD700' },
    { type: 'Videos', count: 42, percent: 5, color: '#3D6FE0' },
    { type: 'Audio Files', count: 18, percent: 2, color: '#6B7280' },
  ];

  const aiFeaturesUsage = [
    { feature: 'Smart Reply Suggestions', calls: 382, neurons: 286 },
    { feature: 'Voice Note Transcription', calls: 44, neurons: 1025 },
    { feature: 'Live Translation', calls: 120, neurons: 48 },
    { feature: 'Chat Summarization', calls: 32, neurons: 96 },
    { feature: 'Smart Search', calls: 58, neurons: 72 },
    { feature: 'Emoji Suggestion', calls: 410, neurons: 164 },
    { feature: 'Safety Content Moderation', calls: 18, neurons: 54 },
  ];

  return (
    <AdminSidebar>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">
            Platform Analytics
          </h1>
          <p className="text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
            Deep insights across user growth, message types, and AI neuron expenditure
          </p>
        </div>

        {/* Top Summary Stat Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#161B2B] p-5 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
            <span className="text-xs font-bold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider block mb-1">
              Active Weekly Reach
            </span>
            <div className="text-3xl font-black text-black dark:text-white">
              89.4%
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">
              High retention on real-time presence
            </p>
          </div>

          <div className="bg-white dark:bg-[#161B2B] p-5 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
            <span className="text-xs font-bold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider block mb-1">
              Total Stored Media (R2)
            </span>
            <div className="text-3xl font-black text-black dark:text-white">
              1.24 GB
            </div>
            <p className="text-[11px] text-[#0E2A6E] dark:text-[#3D6FE0] font-semibold mt-1">
              Free tier: 10 GB (Zero Egress)
            </p>
          </div>

          <div className="bg-white dark:bg-[#161B2B] p-5 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
            <span className="text-xs font-bold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider block mb-1">
              Total AI Neurons Today
            </span>
            <div className="text-3xl font-black text-[#0E2A6E] dark:text-[#FFD700]">
              1,745
            </div>
            <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] font-semibold mt-1">
              17.4% of 10,000 daily free allowance
            </p>
          </div>
        </div>

        {/* Breakdown by Message Type */}
        <div className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
          <h3 className="font-extrabold text-sm text-black dark:text-white mb-4">
            Messages Sent by Media Type
          </h3>
          <div className="space-y-3">
            {mediaBreakdown.map((item) => (
              <div key={item.type} className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-black dark:text-white">{item.type}</span>
                  <span className="text-[#4B5563] dark:text-[#9CA3AF]">
                    {item.count} msgs ({item.percent}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                    className="h-full rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature 131: Heatmap: Active Users by Hour & Day */}
        <div className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-black dark:text-white">
                Active Users Heatmap (7 Days × 24 Hours)
              </h3>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
                Evaluates message velocity by hour and day of week to optimize broadcast scheduling.
              </p>
            </div>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#FFD700] text-[#1A1A2E]">
              Peak: 2:00 PM – 5:00 PM
            </span>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[700px]">
              {/* Hour Labels */}
              <div className="grid grid-cols-[50px_repeat(24,1fr)] gap-1 text-[9px] font-bold text-gray-400 mb-1 text-center">
                <div />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h}>{h}h</div>
                ))}
              </div>

              {/* 7 Days Grid */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dIdx) => (
                <div key={day} className="grid grid-cols-[50px_repeat(24,1fr)] gap-1 items-center mb-1">
                  <span className="text-xs font-bold text-gray-500">{day}</span>
                  {Array.from({ length: 24 }).map((_, h) => {
                    // Seeded realistic traffic pattern
                    const isBusinessHours = h >= 9 && h <= 18;
                    const isWeekend = dIdx >= 5;
                    const intensity = isWeekend
                      ? Math.sin((h / 24) * Math.PI) * 0.7
                      : isBusinessHours
                      ? 0.5 + Math.sin(((h - 9) / 9) * Math.PI) * 0.5
                      : 0.15;
                    const count = Math.round(intensity * 140);

                    return (
                      <div
                        key={h}
                        title={`${day} at ${h}:00 — ${count} messages`}
                        style={{
                          backgroundColor: count === 0 ? 'transparent' : '#0E2A6E',
                          opacity: Math.max(0.08, intensity),
                        }}
                        className="h-6 rounded-md hover:ring-2 hover:ring-[#FFD700] transition-all cursor-pointer border border-gray-200/40 dark:border-gray-800"
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 text-[10px] font-bold text-gray-400 pt-1">
            <span>Less Active</span>
            <div className="flex space-x-1">
              <span className="w-3.5 h-3.5 rounded bg-[#0E2A6E] opacity-15" />
              <span className="w-3.5 h-3.5 rounded bg-[#0E2A6E] opacity-40" />
              <span className="w-3.5 h-3.5 rounded bg-[#0E2A6E] opacity-70" />
              <span className="w-3.5 h-3.5 rounded bg-[#0E2A6E] opacity-100" />
            </div>
            <span>Peak Activity</span>
          </div>
        </div>

        {/* AI Features Utilization & Neuron Burn Breakdown */}
        <div className="bg-white dark:bg-[#161B2B] p-6 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
          <h3 className="font-extrabold text-sm text-black dark:text-white mb-4">
            Cloudflare Workers AI Usage Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#2A3348] text-[#4B5563] dark:text-[#9CA3AF]">
                  <th className="py-2.5 font-bold uppercase">Feature</th>
                  <th className="py-2.5 font-bold uppercase">Invocations</th>
                  <th className="py-2.5 font-bold uppercase">Estimated Neurons</th>
                  <th className="py-2.5 font-bold uppercase text-right">Avg / Call</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348]">
                {aiFeaturesUsage.map((row) => (
                  <tr key={row.feature} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="py-3 font-bold text-black dark:text-white flex items-center space-x-2">
                      <span className="text-[#FFD700]">✨</span>
                      <span>{row.feature}</span>
                    </td>
                    <td className="py-3 font-medium">{row.calls}</td>
                    <td className="py-3 font-bold text-[#0E2A6E] dark:text-[#3D6FE0]">
                      {row.neurons}
                    </td>
                    <td className="py-3 text-right text-gray-500">
                      {(row.neurons / row.calls).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
};

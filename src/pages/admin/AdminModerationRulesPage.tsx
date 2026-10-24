import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { ModerationRule } from '../../types';

export const AdminModerationRulesPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rules, setRules] = useState<ModerationRule[]>(() => {
    const saved = localStorage.getItem('inspire_moderation_rules');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return [
      {
        id: 'rule_1',
        keyword_pattern: 'free crypto\\b|bonus deposit',
        action: 'auto_hide',
        created_by: user?.id || 'admin',
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'rule_2',
        keyword_pattern: 'telegram\\.me\\/|t\\.me\\/join',
        action: 'flag',
        created_by: user?.id || 'admin',
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
      {
        id: 'rule_3',
        keyword_pattern: 'password\\s*reset\\s*link',
        action: 'flag',
        created_by: user?.id || 'admin',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
  });

  const [patternInput, setPatternInput] = useState('');
  const [actionInput, setActionInput] = useState<'flag' | 'auto_hide'>('flag');
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<{ matched: boolean; rule?: string } | null>(null);

  useEffect(() => {
    localStorage.setItem('inspire_moderation_rules', JSON.stringify(rules));
  }, [rules]);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patternInput.trim()) return;

    try {
      new RegExp(patternInput.trim(), 'i');
    } catch {
      toast('Invalid Regular Expression pattern', 'error');
      return;
    }

    const newRule: ModerationRule = {
      id: `rule_${Date.now()}`,
      keyword_pattern: patternInput.trim(),
      action: actionInput,
      created_by: user?.id || 'admin',
      created_at: new Date().toISOString(),
    };

    setRules([newRule, ...rules]);
    setPatternInput('');
    toast('Keyword moderation rule added successfully', 'success');
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
    toast('Moderation rule deleted', 'info');
  };

  const handleTestRegex = () => {
    if (!testText.trim()) {
      setTestResult(null);
      return;
    }

    for (const rule of rules) {
      try {
        const rx = new RegExp(rule.keyword_pattern, 'i');
        if (rx.test(testText)) {
          setTestResult({ matched: true, rule: rule.keyword_pattern });
          return;
        }
      } catch {
        // ignore malformed rule
      }
    }

    setTestResult({ matched: false });
  };

  return (
    <AdminSidebar>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-black text-black dark:text-white">
            Automated Keyword Moderation Rules
          </h1>
          <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-1">
            Configure automated regex and keyword filters to automatically flag or hide malicious messages before they reach recipient screens.
          </p>
        </div>

        {/* Add Rule Card */}
        <div className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm">
          <h2 className="font-extrabold text-sm mb-4">Add Moderation Rule</h2>
          <form onSubmit={handleAddRule} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                Regex Keyword Pattern
              </label>
              <input
                type="text"
                value={patternInput}
                onChange={(e) => setPatternInput(e.target.value)}
                placeholder="e.g. bitcoin|t\\.me\\/join|phishing-link"
                required
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-mono focus:outline-none focus:border-[#0E2A6E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                Automated Action
              </label>
              <select
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value as 'flag' | 'auto_hide')}
                className="w-full px-3 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs font-bold focus:outline-none"
              >
                <option value="flag">Flag for Moderator Review</option>
                <option value="auto_hide">Auto-Hide & Block</option>
              </select>
            </div>

            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47] transition-all shadow-sm"
              >
                + Save Rule
              </button>
            </div>
          </form>
        </div>

        {/* Realtime Pattern Tester */}
        <div className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-3">
          <h2 className="font-extrabold text-sm">Live Regex Tester</h2>
          <div className="flex space-x-2">
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Type test message content to verify keyword matching..."
              className="flex-1 px-4 py-2 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-xs focus:outline-none"
            />
            <button
              type="button"
              onClick={handleTestRegex}
              className="px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 text-xs font-bold hover:bg-gray-200"
            >
              Test Rules
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold ${
                testResult.matched
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {testResult.matched
                ? `⚠️ MATCHED rule pattern: "${testResult.rule}". This message would be triggered.`
                : '✅ Clean: No active moderation rules matched this text.'}
            </div>
          )}
        </div>

        {/* Existing Rules Table */}
        <div className="bg-white dark:bg-[#161B2B] rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E5E7EB] dark:border-[#2A3348] flex justify-between items-center">
            <h2 className="font-extrabold text-sm">Active Rules ({rules.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/40 text-[#4B5563] dark:text-[#9CA3AF] uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Keyword Pattern</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#2A3348]">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20">
                    <td className="py-3 px-4 font-mono font-bold text-[#0E2A6E] dark:text-[#3D6FE0]">
                      {rule.keyword_pattern}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          rule.action === 'auto_hide'
                            ? 'bg-rose-500/10 text-rose-600'
                            : 'bg-amber-500/10 text-amber-600'
                        }`}
                      >
                        {rule.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      {new Date(rule.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-100"
                      >
                        Remove
                      </button>
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

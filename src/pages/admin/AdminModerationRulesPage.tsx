import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { ModerationRule } from '../../types';
import { supabase, isConfigured } from '../../lib/supabaseClient';

export const AdminModerationRulesPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rules, setRules] = useState<ModerationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [patternInput, setPatternInput] = useState('');
  const [actionInput, setActionInput] = useState<'flag' | 'auto_hide'>('flag');
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<{ matched: boolean; rule?: string } | null>(null);

  const loadRules = async () => {
    setLoading(true);
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('moderation_rules')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setRules(data as ModerationRule[]);
        }
      } catch (err) {
        console.warn('Failed to load moderation rules:', err);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patternInput.trim() || !user) return;

    try {
      new RegExp(patternInput.trim(), 'i');
    } catch {
      toast('Invalid Regular Expression pattern', 'error');
      return;
    }

    const payload = {
      keyword_pattern: patternInput.trim(),
      action: actionInput,
      created_by: user.id,
    };

    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('moderation_rules')
          .insert(payload)
          .select()
          .single();

        if (error) {
          toast(error.message, 'error');
          return;
        }

        if (data) {
          setRules((prev) => [data as ModerationRule, ...prev]);
        }
      } catch (err: any) {
        toast(err.message, 'error');
        return;
      }
    } else {
      const newRule: ModerationRule = {
        id: `rule_${Date.now()}`,
        keyword_pattern: patternInput.trim(),
        action: actionInput,
        created_by: user.id,
        created_at: new Date().toISOString(),
      };
      setRules([newRule, ...rules]);
    }

    setPatternInput('');
    toast('Keyword moderation rule added successfully', 'success');
  };

  const handleDeleteRule = async (id: string) => {
    if (isConfigured) {
      try {
        await supabase.from('moderation_rules').delete().eq('id', id);
      } catch (err) {
        console.warn('Delete rule error:', err);
      }
    }
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
            Automated Moderation Rules Engine
          </h1>
          <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-1">
            Define keyword patterns and regex filters that automatically flag or auto-hide abusive messages in real time without waiting for user reports (Feature 58).
          </p>
        </div>

        {/* Add Rule Form */}
        <div className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#4B5563] dark:text-[#9CA3AF]">
            Create Keyword Rule
          </h2>

          <form onSubmit={handleAddRule} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-gray-500 block mb-1">
                Keyword or Regex Pattern
              </label>
              <input
                type="text"
                required
                value={patternInput}
                onChange={(e) => setPatternInput(e.target.value)}
                placeholder="e.g. crypto.*airdrop|telegram\.me\/"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-mono focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-500 block mb-1">
                Automated Action
              </label>
              <select
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold"
              >
                <option value="flag">Flag for Moderator Review</option>
                <option value="auto_hide">Auto-Hide Message Instantly</option>
              </select>
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
              >
                + Add Moderation Rule
              </button>
            </div>
          </form>
        </div>

        {/* Live Rule Sandbox Tester */}
        <div className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#4B5563] dark:text-[#9CA3AF]">
            Rule Sandbox Tester
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={testText}
              onChange={(e) => {
                setTestText(e.target.value);
                setTestResult(null);
              }}
              placeholder="Type a sample message to check against active rules..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border text-xs"
            />
            <button
              type="button"
              onClick={handleTestRegex}
              className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-xs font-bold"
            >
              Test
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold ${
                testResult.matched
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
              }`}
            >
              {testResult.matched
                ? `⚠️ MATCHED rule: /${testResult.rule}/i — Message would trigger action`
                : '✓ PASSED: Message does not trigger any active moderation rule'}
            </div>
          )}
        </div>

        {/* Rules Table */}
        <div className="bg-white dark:bg-[#161B2B] rounded-3xl p-5 border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#4B5563] dark:text-[#9CA3AF]">
            Active Keyword Rules ({rules.length})
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-3 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : rules.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No moderation rules configured.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {rules.map((rule) => (
                <div key={rule.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="font-mono text-xs font-black text-[#0E2A6E] dark:text-[#3D6FE0]">
                      /{rule.keyword_pattern}/i
                    </span>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${
                          rule.action === 'auto_hide'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {rule.action.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Added: {new Date(rule.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 text-xs font-bold"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminSidebar>
  );
};

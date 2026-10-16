import { useState, useEffect } from 'react';
import { Settings, Mail, KeyRound, Percent, Loader2, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { api } from '../api';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState(null);

  const [smtpEmail, setSmtpEmail] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [lateFeeRate, setLateFeeRate] = useState('');
  const [multiplier, setMultiplier] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
      setSmtpEmail(data.smtp_email || '');
      setOrgName(data.org_name || '');
      setInterestRate(String(parseFloat(data.interest_rate) * 100));
      setLateFeeRate(String(parseFloat(data.late_fee_rate) * 100));
      setMultiplier(String(parseFloat(data.loan_savings_multiplier)));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    setError(null);

    const payload = {
      org_name: orgName,
      smtp_email: smtpEmail || null,
      interest_rate: (parseFloat(interestRate) || 0) / 100,
      late_fee_rate: (parseFloat(lateFeeRate) || 0) / 100,
      loan_savings_multiplier: parseFloat(multiplier) || 0,
    };
    if (smtpPassword.trim()) {
      payload.smtp_password = smtpPassword.trim();
    }

    try {
      const updated = await api.updateSettings(payload);
      setSettings(updated);
      setSmtpPassword('');
      setSaveMessage('Settings saved.');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setTestMessage(null);
    try {
      const result = await api.sendTestEmail();
      setTestMessage({ ok: true, text: result.message });
    } catch (err) {
      setTestMessage({ ok: false, text: err.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-48"></div>
        <div className="h-64 bg-slate-800 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Settings</h1>
        <p className="text-slate-400">Cooperative profile, email delivery, and financial rules</p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {saveMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {saveMessage}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Cooperative profile */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Cooperative Profile
          </h3>
          <label className="block text-sm font-medium text-slate-300 mb-2">Organisation Name</label>
          <input
            type="text"
            className="input"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
          />
        </div>

        {/* Email / SMTP */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-400" />
              Email Delivery (Gmail)
            </h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                settings?.has_smtp_config
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              {settings?.has_smtp_config ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Create a 16-character App Password at{' '}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              myaccount.google.com/app passwords
            </a>{' '}
            (2-Step Verification must be on). The password is stored encrypted and never displayed again.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Sender Gmail Address</label>
              <input
                type="email"
                className="input"
                value={smtpEmail}
                onChange={(e) => setSmtpEmail(e.target.value)}
                placeholder="cooperative@gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Gmail App Password
                {settings?.has_smtp_config && (
                  <span className="ml-2 text-xs text-slate-500">(saved: {settings.smtp_password_masked})</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-20"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="abcd abcd abcd abcd"
                  minLength={16}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-sm"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {settings?.has_smtp_config && (
              <div>
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testing}
                  className="btn btn-ghost gap-2"
                >
                  {testing ? <Loader2 size={16} className="animate-spin" /> : <Send className="w-4 h-4" />}
                  Send test email
                </button>
                {testMessage && (
                  <p className={`mt-2 text-sm ${testMessage.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testMessage.text}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Financial rules */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Percent className="w-5 h-5 text-amber-400" />
            Financial Rules
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            These rates drive loan interest, late penalties, and the maximum loan a member may receive.
            Changing them affects new calculations only — existing payment records are never rewritten.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Interest Rate (% per period)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="99"
                className="input"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Late Fee (% per month late)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="99"
                className="input"
                value={lateFeeRate}
                onChange={(e) => setLateFeeRate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Max Loan (× savings)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                className="input"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}

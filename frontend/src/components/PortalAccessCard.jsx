import { useState } from 'react';
import { MonitorSmartphone, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from './ui/ConfirmDialog';

export default function PortalAccessCard({ member, onChanged }) {
  const { showToast } = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);
  const [error, setError] = useState(null);

  const linked = !!member.user_id;

  const handleCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.createMemberAccount(member.id, email);
      setTempPassword({ password: result.temporary_password, email: result.email });
      setCreating(false);
      setEmail('');
      showToast(result.message);
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!(await confirm('Generate a new temporary password for this member? Their current password will stop working.', { confirmLabel: 'Generate password' }))) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.revokeMemberPassword(member.id);
      setTempPassword({ password: result.temporary_password, email: result.email });
      showToast(result.message);
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm('Remove this member\'s portal login? They will no longer be able to sign in.', { danger: true, confirmLabel: 'Remove access' }))) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.deleteMemberAccount(member.id);
      setTempPassword(null);
      showToast(result.message);
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      {confirmDialog}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-100 flex items-center gap-2">
          <MonitorSmartphone className="w-5 h-5 text-indigo-400" />
          Portal Access
        </h3>
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            linked ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
          }`}
        >
          {linked ? 'Linked' : 'No account'}
        </span>
      </div>

      {error && (
        <div className="p-2 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {tempPassword && (
        <div className="p-3 mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Temporary credentials
          </div>
          <p className="text-slate-300 text-xs">Email: {tempPassword.email}</p>
          <p className="text-slate-100 text-sm font-mono font-bold">{tempPassword.password}</p>
          <p className="text-slate-500 text-[11px] mt-1">Copy this now — it is shown only once.</p>
        </div>
      )}

      {creating ? (
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Login email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              required
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary btn-sm flex-1">
              {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Create & email login'}
            </button>
            <button type="button" onClick={() => setCreating(false)} disabled={busy} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <button onClick={() => setCreating(true)} disabled={busy} className="btn btn-primary btn-sm w-full">
            {linked ? 'Reset credentials' : 'Create portal login'}
          </button>
          {linked && (
            <>
              <button onClick={handleRevoke} disabled={busy} className="btn btn-ghost btn-sm w-full">
                New temporary password
              </button>
              <button onClick={handleDelete} disabled={busy} className="btn btn-ghost btn-sm w-full text-red-400">
                Remove portal access
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <Compass className="w-14 h-14 text-slate-600 mx-auto mb-4" />
        <h1 className="text-5xl font-bold text-slate-100 mb-3">404</h1>
        <p className="text-slate-400 mb-6">This page doesn't exist or has been moved.</p>
        <Link to="/" className="btn btn-primary inline-flex">Back to home</Link>
      </div>
    </div>
  );
}

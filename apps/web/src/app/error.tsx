'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorPage({ error, reset }: ErrorProps) {
  const [requestId, setRequestId] = useState<string>('');

  useEffect(() => {
    // Generate or extract request correlation reference ID
    const ref = error.digest || `REQ-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    setRequestId(ref);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-slate-600 mb-6">
          We encountered an unexpected issue while processing your request. Please try again or contact support if the problem persists.
        </p>

        {requestId && (
          <div className="bg-slate-100 rounded-lg p-3 text-xs text-slate-500 font-mono mb-6">
            Reference: <span className="font-semibold text-slate-700">{requestId}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Home className="w-4 h-4 mr-2" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

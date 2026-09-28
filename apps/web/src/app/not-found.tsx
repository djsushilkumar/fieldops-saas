import React from 'react';
import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Page Not Found</h1>
        <p className="text-sm text-slate-600 mb-6">
          The page or resource you are looking for does not exist or has been moved.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Home className="w-4 h-4 mr-2" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

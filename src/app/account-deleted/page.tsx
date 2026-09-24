import React from "react";
import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="p-8 sm:p-10 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-red-600 dark:text-red-500" />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
              Account Deleted
            </h1>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 leading-relaxed">
              Your account and all associated data have been permanently removed from our servers. We're sorry to see you go!
            </p>
          </div>

          <div className="pt-6">
            <Link 
              href="/login"
              className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-black font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 dark:focus:ring-white group"
            >
              Return to Login
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-900/50 px-8 py-4 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            If you deleted your account by mistake, you will need to register for a new one.
          </p>
        </div>
      </div>
    </div>
  );
}

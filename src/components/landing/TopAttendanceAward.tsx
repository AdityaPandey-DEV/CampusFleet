"use client";

import React, { useState } from "react";
import {
  Trophy,
  Medal,
  Award,
  Crown,
  Sparkles,
  Flame,
  CheckCircle2,
  Heart,
  TrendingUp,
  Clock,
  ShieldCheck,
  Star,
  BusFront,
  ThumbsUp,
  GraduationCap,
} from "lucide-react";

export function TopAttendanceAward() {
  const [claps, setClaps] = useState(142);
  const [hasClapped, setHasClapped] = useState(false);
  const [showCheerToast, setShowCheerToast] = useState(false);

  const handleClap = () => {
    setClaps(prev => prev + 1);
    setHasClapped(true);
    setShowCheerToast(true);
    setTimeout(() => setShowCheerToast(false), 3000);
  };

  const runnersUp = [
    {
      rank: 2,
      name: "Aditya Pandey",
      enrollment: "GEHU/2023/1108",
      branch: "B.Tech CSE (5th Sem)",
      route: "Route 1: Kathgodam",
      attendance: "98.8%",
      streak: "42 Days",
      badge: "Silver Commuter",
    },
    {
      rank: 3,
      name: "Ananya Pandey",
      enrollment: "GEHU/2024/0482",
      branch: "B.Tech CSE (3rd Sem)",
      route: "Route 2: Haldwani Tikonia",
      attendance: "97.5%",
      streak: "36 Days",
      badge: "Bronze Commuter",
    },
    {
      rank: 4,
      name: "Kartik Bisht",
      enrollment: "GEHU/2024/0940",
      branch: "B.Tech CSE (3rd Sem)",
      route: "Route 3: Ranibagh Express",
      attendance: "96.2%",
      streak: "29 Days",
      badge: "Punctuality Star",
    },
  ];

  return (
    <div className="w-full bg-gradient-to-br from-amber-500/10 via-slate-50 to-orange-500/10 dark:from-amber-950/30 dark:via-slate-900/90 dark:to-orange-950/30 rounded-3xl sm:rounded-[2.5rem] border border-amber-300/60 dark:border-amber-700/50 p-6 sm:p-10 shadow-2xl relative overflow-hidden space-y-8">
      {/* Background Decorative Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-400/10 dark:bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cheer Toast Feedback */}
      {showCheerToast && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-amber-400/40 flex items-center gap-3 animate-in slide-in-from-top-4">
          <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
          <div className="text-xs font-bold">
            🎉 Commuter Cheers Added! You celebrated Parth’s perfect attendance!
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 border-b border-amber-200/60 dark:border-amber-800/40 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-xs font-black tracking-wide uppercase mb-2 border border-amber-300/80 dark:border-amber-700/60 shadow-xs">
            <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Monthly Punctuality Honors • Hall of Fame</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Top Attendance Award Goes To...
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
            Recognizing university students who uphold 100% bus boarding discipline, punctuality, and safe commuting habits verified daily by conductor optical scans.
          </p>
        </div>

        {/* Month Badge */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-amber-300/80 dark:border-amber-700/60 text-xs font-black text-amber-700 dark:text-amber-300 shadow-sm self-stretch md:self-auto justify-center">
          <Crown className="w-4 h-4 text-amber-500 animate-bounce" />
          <span>AUTUMN 2026 HONORS</span>
        </div>
      </div>

      {/* Winner Spotlight Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Golden Winner Profile Showcase */}
        <div className="lg:col-span-7 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border-2 border-amber-400/80 dark:border-amber-500/60 shadow-xl relative overflow-hidden space-y-6">
          {/* Gold Laurel Ribbon */}
          <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-6 py-1.5 rounded-bl-2xl shadow-md flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-white" />
            <span>1st Rank • Gold Laureate</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pt-2">
            {/* Student Avatar with Crown */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-orange-500 p-1 shadow-lg shadow-amber-500/30 flex items-center justify-center">
                <div className="w-full h-full rounded-[22px] bg-slate-900 flex items-center justify-center text-white font-black text-2xl">
                  PD
                </div>
              </div>
              <div className="absolute -top-3 -right-2 bg-amber-400 text-slate-950 p-1.5 rounded-full shadow-md border-2 border-white dark:border-slate-900">
                <Crown className="w-4 h-4" />
              </div>
            </div>

            {/* Student Info & Branch */}
            <div className="space-y-1 text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  Parth Dalakoti
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  99.4% PERFECT TRANSIT
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Enrollment: <strong>PV-23620010</strong> • B.Tech Computer Science & Engineering (7th Sem)
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-600 dark:text-slate-300 pt-0.5">
                <BusFront className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Haldwani - Kathgodam - Bhimtal Express (Route 1) • Morning 07:20 AM Shift</span>
              </div>
            </div>
          </div>

          {/* Key Punctuality Metrics */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-center space-y-0.5">
              <div className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                99.4%
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Boarding Ratio</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-orange-50/80 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-800/60 text-center space-y-0.5">
              <div className="text-xl sm:text-2xl font-black font-mono text-orange-600 dark:text-orange-400 flex items-center justify-center gap-1">
                <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
                <span>48 Days</span>
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Active Streak</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-center space-y-0.5">
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                0
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Late Arrivals</div>
            </div>
          </div>

          {/* Parent Citation */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 font-bold text-[11px]">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Parent Commendation Verified</span>
              </span>
              <span className="font-mono text-slate-400">Manoj Kumar Dalakoti</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 italic leading-relaxed">
              "We receive automated SMS confirmations every morning at 07:20 AM when Parth boards at Haldwani Tikonia. Zero stress, 100% peace of mind knowing the bus is on schedule."
            </p>
          </div>

          {/* Perks Awarded + Interactive Clap Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                👑 VIP Window Seat Reserved
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                📜 DSW Punctuality Certificate
              </span>
            </div>

            <button
              onClick={handleClap}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap ${
                hasClapped
                  ? "bg-amber-500 text-white shadow-amber-500/25"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/70 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
              }`}
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${hasClapped ? "text-white" : "text-amber-500"}`} />
              <span>Celebrate Parth ({claps})</span>
            </button>
          </div>
        </div>

        {/* Right: Runners-Up Leaderboard & Why Attendance Matters */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Medal className="w-4 h-4 text-amber-500" />
                <span>Monthly Transit Leaderboard</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 font-bold">TOP COMMUTERS</span>
            </div>

            {/* Runners Up List */}
            <div className="space-y-2.5">
              {runnersUp.map(commuter => (
                <div
                  key={commuter.rank}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                        commuter.rank === 2
                          ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                          : commuter.rank === 3
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      #{commuter.rank}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">
                        {commuter.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {commuter.branch} • {commuter.streak} streak
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-black font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      {commuter.attendance}
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                      {commuter.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Gamified Why-It-Matters callout */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200/60 dark:border-blue-800/40 space-y-1 text-xs text-blue-900 dark:text-blue-200">
              <div className="font-black flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>How Commuters Earn Points:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
                Boarding before departure time (+50 pts), maintaining a 10-day streak (+100 pts), and zero missed shifts unlock priority seat reservations for next semester!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

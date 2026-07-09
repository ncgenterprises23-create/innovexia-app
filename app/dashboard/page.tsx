'use client';

import { useState, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { ensureSessionId } from '@/utils/session';
import { motion, AnimatePresence } from 'framer-motion';
import { parseDateString, parseSheetDate } from '@/lib/dateUtils';

interface DashboardStats {
  totalDelegations: number;
  pendingTasks: number;
  inProgress: number;
  completed: number;
}

interface UserScore {
  user: any;
  scorePercentage: number;
}

interface AttendanceStats {
  present: number;
  absent: number;
  leave: number;
  late: number;
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalDelegations: 0,
    pendingTasks: 0,
    inProgress: 0,
    completed: 0,
  });
  const [topScorers, setTopScorers] = useState<UserScore[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<AttendanceStats>({
    present: 0,
    absent: 0,
    leave: 0,
    late: 0,
  });
  const [birthdaysToday, setBirthdaysToday] = useState<any[]>([]);
  const [birthdaysTomorrow, setBirthdaysTomorrow] = useState<any[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<any[]>([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState<any[]>([]);
  const [companyStats, setCompanyStats] = useState({ score: 0, onTime: 0 });
  const [helpTickets, setHelpTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const sessionId = ensureSessionId();
        const headers = { 'x-session-id': sessionId };

        // 1. Auth & User Info
        const authRes = await fetch('/api/auth', { headers });
        const authData = await authRes.json();
        if (authData.authenticated) {
          setUser(authData.user);
        }

        // 2. Fetch Data
        const [usersRes, delRes, checkRes, o2dRes, configRes, attMasterRes, ticketsRes] = await Promise.all([
          fetch('/api/users', { headers }),
          fetch('/api/delegations', { headers }),
          fetch('/api/checklists', { headers }),
          fetch('/api/o2d', { headers }),
          fetch('/api/o2d-config', { headers }),
          fetch('/api/attendance/master', { headers }),
          fetch('/api/helpdesk', { headers })
        ]);

        const usersData = await usersRes.json();
        const delData = await delRes.json();
        const checkData = await checkRes.json();
        const o2dData = await o2dRes.json();
        const configData = await configRes.json();
        const attMasterData = await attMasterRes.json();
        const ticketsData = await ticketsRes.json();

        const allUsers = usersData.users || [];
        const allDelegations = delData.delegations || [];
        const allChecklists = checkData.checklists || [];
        const allO2DOrders = Array.isArray(o2dData) ? o2dData : [];
        const o2dConfig = configData.config || [];

        // Filter open tickets (exclude closed/resolved)
        const allTickets = Array.isArray(ticketsData) ? ticketsData : [];
        const openTickets = allTickets.filter((t: any) => {
          const s = (t.status || '').toLowerCase();
          return s !== 'closed' && s !== 'resolved';
        });
        setHelpTickets(openTickets);

        // 3. Scoring logic (Current Month)
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        const currentMonthEnd = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 0);
        currentMonthEnd.setHours(23, 59, 59, 999);

        const isTaskInRange = (due_date?: string, updated_at?: string) => {
          if (due_date) {
            const dDate = parseDateString(due_date);
            if (dDate && dDate >= currentMonthStart && dDate <= currentMonthEnd) return true;
          }
          if (updated_at) {
            const uDate = parseDateString(updated_at);
            if (uDate && uDate >= currentMonthStart && uDate <= currentMonthEnd) return true;
          }
          return false;
        };

        const scores: UserScore[] = allUsers.map((u: any) => {
          const userDels = allDelegations.filter((d: any) =>
            ((d.doer_name?.toLowerCase() === u.username.toLowerCase()) || (!d.doer_name && d.assigned_to?.toLowerCase() === u.username.toLowerCase()))
            && isTaskInRange(d.due_date, d.updated_at)
          );
          const userChecks = allChecklists.filter((c: any) =>
            (c.assignee?.toLowerCase() === u.username.toLowerCase() || c.doer_name?.toLowerCase() === u.username.toLowerCase())
            && isTaskInRange(c.due_date, c.updated_at)
          );

          let o2dCount = 0;
          let o2dCompleted = 0;
          let o2dOnTime = 0;

          allO2DOrders.forEach(order => {
            const items = Array.isArray(order.items) ? order.items : [];
            items.forEach((item: any) => {
              for (let i = 1; i <= 8; i++) {
                const stepCfg = o2dConfig.find((c: any) => c.step === i);
                if (stepCfg && stepCfg.doerName.trim().toLowerCase() === u.username.trim().toLowerCase()) {
                  const plannedRaw = item[`planned_${i}`];
                  const actualRaw = item[`actual_${i}`];
                  const plannedDate = parseSheetDate(plannedRaw);
                  const actualDate = parseSheetDate(actualRaw);

                  if ((plannedDate && new Date(plannedDate) >= currentMonthStart && new Date(plannedDate) <= currentMonthEnd) ||
                    (actualDate && new Date(actualDate) >= currentMonthStart && new Date(actualDate) <= currentMonthEnd)) {
                    o2dCount++;
                    if (actualDate) {
                      o2dCompleted++;
                      if (plannedDate && new Date(actualDate) <= new Date(plannedDate)) {
                        o2dOnTime++;
                      }
                    }
                  }
                }
              }
            });
          });

          const completedDels = userDels.filter((d: any) => d.status.toLowerCase() === 'completed');
          const completedChecks = userChecks.filter((c: any) => c.status.toLowerCase() === 'completed');

          const onTimeDels = completedDels.filter((d: any) => {
            const due = parseDateString(d.due_date);
            const upd = parseDateString(d.updated_at);
            return due && upd && upd <= due;
          }).length;

          const onTimeChecks = completedChecks.filter((c: any) => {
            const due = parseDateString(c.due_date);
            const upd = parseDateString(c.updated_at);
            return due && upd && upd <= due;
          }).length;

          const total = userDels.length + userChecks.length + o2dCount;
          const completed = completedDels.length + completedChecks.length + o2dCompleted;
          const onTime = onTimeDels + onTimeChecks + o2dOnTime;

          return {
            user: u,
            scorePercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            onTimePercentage: total > 0 ? Math.round((onTime / total) * 100) : 0
          };
        });

        // Calculate Company Averages
        if (scores.length > 0) {
          const avgScore = Math.round(scores.reduce((acc, curr) => acc + curr.scorePercentage, 0) / scores.length);
          const avgOnTime = Math.round(scores.reduce((acc, curr: any) => acc + (curr.onTimePercentage || 0), 0) / scores.length);
          setCompanyStats({ score: avgScore, onTime: avgOnTime });
        }

        scores.sort((a, b) => b.scorePercentage - a.scorePercentage);
        setTopScorers(scores.slice(0, 3));

        // 4. Attendance Stats Today
        if (attMasterData.users && attMasterData.attendance) {
          const todayStr = new Date().toISOString().split('T')[0];
          const SHIFT_START_TIME = "09:30";
          const [sh, sm] = SHIFT_START_TIME.split(':').map(Number);
          const shiftStartTotalMinutes = sh * 60 + sm;

          let presentToday = 0;
          let absentToday = 0;
          let leaveToday = 0;
          let lateToday = 0;

          const recentLogs: any[] = [];

          attMasterData.users.forEach((u: any) => {
            const att = attMasterData.attendance.find((a: any) => a.userId === u.id && a.date === todayStr);
            const isOnLeave = attMasterData.leaves.find((l: any) => l.userId === u.id && l.status === 'Approved' && todayStr >= l.startDate && todayStr <= l.endDate);

            if (isOnLeave) {
              leaveToday++;
            } else if (att) {
              presentToday++;
              if (att.inTime) {
                const inTime = new Date(att.inTime);
                const inMinutes = inTime.getHours() * 60 + inTime.getMinutes();
                if (inMinutes > shiftStartTotalMinutes + 10) { // 10 min grace
                  lateToday++;
                }
                recentLogs.push({
                  userName: u.full_name || u.username,
                  image_url: u.image_url,
                  inTime: att.inTime,
                  outTime: att.outTime,
                  id: u.id
                });
              }
            } else if (new Date().getDay() !== 0) { // Not Sunday
              absentToday++;
            }
          });

          setAttendanceToday({
            present: presentToday,
            absent: absentToday,
            leave: leaveToday,
            late: lateToday
          });

          recentLogs.sort((a, b) => new Date(b.inTime).getTime() - new Date(a.inTime).getTime());
          setRecentCheckIns(recentLogs.slice(0, 5));

          // 5. Leave Activity (Today & Upcoming)
          const leaves = attMasterData.leaves || [];
          const filteredLeaves = leaves.filter((l: any) => {
            return l.endDate >= todayStr;
          }).map((l: any) => {
            const user = allUsers.find((u: any) => u.id === l.userId);
            return {
              ...l,
              userName: user ? (user.full_name || user.username) : 'Unknown',
              image_url: user ? user.image_url : null
            };
          });
          filteredLeaves.sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
          setUpcomingLeaves(filteredLeaves.slice(0, 5));
        }

        // 6. Birthdays (Today & Tomorrow)
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);

        const todayDay = now.getDate();
        const todayMonth = now.getMonth() + 1;
        const tomorrowDay = tomorrow.getDate();
        const tomorrowMonth = tomorrow.getMonth() + 1;

        const bToday = allUsers.filter((u: any) => {
          if (!u.dob) return false;
          const dobDate = parseDateString(u.dob);
          return dobDate && dobDate.getDate() === todayDay && (dobDate.getMonth() + 1) === todayMonth;
        });

        const bTomorrow = allUsers.filter((u: any) => {
          if (!u.dob) return false;
          const dobDate = parseDateString(u.dob);
          return dobDate && dobDate.getDate() === tomorrowDay && (dobDate.getMonth() + 1) === tomorrowMonth;
        });

        setBirthdaysToday(bToday);
        setBirthdaysTomorrow(bTomorrow);

        // 7. User Stats
        if (authData.authenticated) {
          const myDels = allDelegations.filter((d: any) =>
            (d.doer_name?.toLowerCase() === authData.user.username.toLowerCase()) ||
            (!d.doer_name && d.assigned_to?.toLowerCase() === authData.user.username.toLowerCase())
          );
          setStats({
            totalDelegations: myDels.length,
            pendingTasks: myDels.filter((d: any) => d.status === 'pending').length,
            inProgress: myDels.filter((d: any) => d.status === 'in-progress').length,
            completed: myDels.filter((d: any) => d.status === 'completed').length,
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching stats:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <LayoutWrapper>
        <div className="p-4 space-y-4 animate-pulse">
          <div className="h-40 bg-gray-200 dark:bg-slate-700 rounded-2xl w-full"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-48 bg-gray-200 dark:bg-slate-700 rounded-2xl"></div>
            <div className="h-48 bg-gray-200 dark:bg-slate-700 rounded-2xl"></div>
            <div className="h-48 bg-gray-200 dark:bg-slate-700 rounded-2xl"></div>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
      <div className="p-3 sm:p-4 space-y-4 max-w-[1600px] mx-auto overflow-hidden">

        {/* Header Section: Welcome, Company Scoring, Hall of Fame */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

          {/* Welcome Tile (Matched to Row 3 Height) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="xl:col-span-4"
          >
            <div className="relative h-64 p-6 sm:p-7 rounded-[1.5rem] bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white shadow-xl shadow-indigo-200 dark:shadow-none overflow-hidden group flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -mr-40 -mt-40 blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full -ml-32 -mb-32 blur-3xl"></div>

              <div className="relative z-10">
                <div className="flex items-center gap-6 mb-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-4xl shadow-inner font-black overflow-hidden border border-white/30 transform group-hover:scale-105 group-hover:rotate-3 transition-all duration-500">
                    {user?.image_url ? (
                      <img src={user.image_url} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'
                    )}
                  </div>
                  <div>
                    <h1 className="text-3xl font-black tracking-tight leading-none mb-2">Welcome back,</h1>
                    <p className="text-xl font-bold text-indigo-100 italic tracking-tight">{user?.full_name || user?.username}! ✨</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm sm:text-base font-bold opacity-90 max-w-[380px]">
                    Your business intelligence suite is operational.
                  </p>
                  <p className="text-[11px] font-bold">
                    You have <span className="px-3 py-1 bg-pink-500 rounded-full text-white font-black shadow-lg shadow-pink-500/30 ml-1">{stats.pendingTasks} tasks</span> awaiting focus.
                  </p>
                </div>
              </div>

              <div className="relative z-10 flex gap-4 mt-4">
                <a href="/delegation" className="px-6 py-2.5 bg-white text-indigo-700 rounded-xl font-black text-sm hover:shadow-lg hover:scale-105 transition-all shadow-sm text-center flex-1">View Tasks</a>
                <button className="px-6 py-2.5 bg-white/10 backdrop-blur-xl rounded-xl font-black text-sm hover:bg-white/20 transition-all text-white border border-white/30 text-center flex-1">Support Chat</button>
              </div>
            </div>
          </motion.div>

          {/* Company Pulse (Standard Row Height) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="xl:col-span-3"
          >
            <div className="h-64 p-5 rounded-[1.5rem] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-48 h-48 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-2xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/20 transition-all duration-500"></div>

              <div className="flex justify-between items-start relative z-10">
                <div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
                    <span className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-sm text-white shadow-lg shadow-indigo-200 dark:shadow-none">📊</span>
                    Pulse
                  </h2>
                </div>
                <div className="text-5xl drop-shadow-2xl scale-125 group-hover:rotate-12 transition-all duration-500">
                  {companyStats.score >= 90 ? '🏆' : companyStats.score >= 75 ? '🥈' : '🥉'}
                </div>
              </div>

              <div className="flex flex-row justify-around relative z-10 items-center gap-4">
                <div className="flex flex-col items-center gap-4">
                  {/* Score Circle */}
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100 dark:text-slate-700" />
                      <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="263.8" strokeDashoffset={263.8 - (263.8 * companyStats.score) / 100} strokeLinecap="round" className="text-indigo-600" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-slate-800 dark:text-white">{companyStats.score}%</span>
                  </div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Score</p>
                </div>

                <div className="flex flex-col items-center gap-4">
                  {/* On-Time Circle */}
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100 dark:text-slate-700" />
                      <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="263.8" strokeDashoffset={263.8 - (263.8 * companyStats.onTime) / 100} strokeLinecap="round" className="text-emerald-500" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-slate-800 dark:text-white">{companyStats.onTime}%</span>
                  </div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">On-Time</p>
                </div>
              </div>

              <div className="relative z-10 bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-3 flex items-center justify-center">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Healthy Operations</span>
              </div>
            </div>
          </motion.div>

          {/* Hall of Fame (Standard Row Height) */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="xl:col-span-5"
          >
            <div className="h-64 p-5 rounded-[1.5rem] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500 rounded-xl text-white text-xl shadow-lg shadow-yellow-200 dark:shadow-none animate-bounce-slow">👑</div>
                  <div>
                    <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Performers</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">{new Date().toLocaleString('default', { month: 'short' }).toUpperCase()} RANKINGS</p>
                  </div>
                </div>
                <a href="/leaderboard" className="px-3 py-1.5 border border-slate-100 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">Board</a>
              </div>

              <div className="grid grid-cols-3 gap-3 pb-4 flex-grow">
                {topScorers.map((scorer, index) => {
                  const rankData = [
                    { color: 'border-yellow-400', bg: 'bg-yellow-50/50', text: 'text-yellow-700', icon: '🏆', rankName: 'Gold Champion' },
                    { color: 'border-slate-300', bg: 'bg-slate-50/50', text: 'text-slate-600', icon: '🥈', rankName: 'Silver Runner-up' },
                    { color: 'border-amber-600', bg: 'bg-amber-50/50', text: 'text-amber-800', icon: '🥉', rankName: 'Bronze Achiever' }
                  ];
                  const currentRank = rankData[index];

                  return (
                    <motion.div
                      key={scorer.user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`relative pt-7 pb-6 px-4 rounded-2xl border-2 ${currentRank.color} ${currentRank.bg} dark:bg-slate-700/20 dark:border-opacity-30 flex flex-col items-center group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-500 overflow-hidden h-full justify-start`}
                    >
                      <div className="absolute top-1.5 right-1.5 text-base drop-shadow-md z-10">{currentRank.icon}</div>

                      <div className="relative mb-3">
                        <div className={`w-20 h-20 rounded-full border-4 ${currentRank.color} p-0.5 bg-white overflow-hidden shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                          {scorer.user.image_url ? (
                            <img src={scorer.user.image_url} alt={scorer.user.full_name} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-black text-slate-400 text-base">{scorer.user.username.charAt(0)}</div>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full px-2 py-0.5 shadow-sm border border-slate-100 dark:border-slate-700 z-10">
                          <span className={`text-[10px] font-black ${currentRank.text}`}>{scorer.scorePercentage}%</span>
                        </div>
                      </div>

                      <div className="text-center group-hover:scale-105 transition-transform duration-500">
                        <p className="text-[12px] font-black text-slate-800 dark:text-white leading-tight truncate w-full max-w-[100px]">{scorer.user.full_name || scorer.user.username}</p>
                        <p className={`text-[8px] font-black uppercase tracking-[0.1em] leading-none mt-1.5 opacity-60`}>EXPERT</p>
                      </div>

                      <div className="absolute bottom-4 left-4 right-4 h-[4px] bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${index === 0 ? 'from-yellow-200 to-yellow-500' : index === 1 ? 'from-slate-200 to-slate-400' : 'from-amber-400 to-amber-700'}`} style={{ width: `${scorer.scorePercentage}%` }}></div>
                      </div>
                    </motion.div>
                  );
                })}
                {topScorers.length === 0 && <div className="col-span-3 text-center py-6 text-slate-400 font-medium italic text-[10px]">Loading performance...</div>}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Middle Section: Attendance Metrics & Birthdays */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          <div className="lg:col-span-3">
            <h2 className="text-sm font-black text-slate-800 dark:text-white mb-3 flex items-center gap-2">
              <span className="p-1 bg-indigo-600 rounded text-white text-[10px]">📊</span>
              Engagement Overview
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Clocked In', value: attendanceToday.present, icon: '📍', color: 'from-emerald-400 to-teal-600', shadow: 'shadow-emerald-200' },
                { label: 'Out of Office', value: attendanceToday.absent, icon: '🏠', color: 'from-rose-400 to-pink-600', shadow: 'shadow-rose-200' },
                { label: 'On Leave', value: attendanceToday.leave, icon: '🏝️', color: 'from-amber-400 to-orange-600', shadow: 'shadow-amber-200' },
                { label: 'Delayed', value: attendanceToday.late, icon: '⏳', color: 'from-violet-400 to-indigo-600', shadow: 'shadow-violet-200' }
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ y: -3 }}
                  className={`relative bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-[1.25rem] border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all group overflow-hidden`}
                >
                  <div className={`absolute -top-3 -right-3 w-16 h-16 bg-gradient-to-br ${item.color} opacity-10 rounded-full group-hover:scale-150 transition-transform duration-700`}></div>
                  <div className="flex flex-col gap-2">
                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-lg shadow-lg ${item.shadow} text-white transform group-hover:rotate-6 transition-transform`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{item.label}</p>
                      <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">{item.value}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            <h2 className="text-sm font-black text-slate-800 dark:text-white mb-3 flex items-center gap-2">
              <span className="p-1 bg-pink-500 rounded text-white text-[10px]">🎁</span>
              Birthdays
            </h2>
            <div className="bg-white dark:bg-slate-800 rounded-[1.25rem] p-4 border border-slate-100 dark:border-slate-700 shadow-sm h-[calc(100%-2.25rem)] min-h-[140px] flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-purple-600"></div>
              {birthdaysToday.length > 0 || birthdaysTomorrow.length > 0 ? (
                <div className="space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                  {/* Today's Section */}
                  {birthdaysToday.map((b: any, i) => (
                    <div key={`today-${i}`} className="flex items-center gap-3 animate-in zoom-in duration-500">
                      <div className="relative shrink-0">
                        <div className="absolute -inset-0.5 bg-pink-500 rounded-full opacity-20 animate-ping"></div>
                        {b.image_url ? (
                          <img src={b.image_url} className="w-10 h-10 rounded-full border border-pink-500 object-cover shadow-md relative z-10" alt={b.username} />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-black relative z-10 text-sm shadow-md">🎂</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[8px] font-black text-pink-500 uppercase tracking-widest leading-none mb-0.5 whitespace-nowrap">Today! 🎉</p>
                        <p className="text-sm font-black text-slate-900 dark:text-white leading-tight truncate">{b.full_name || b.username}</p>
                      </div>
                    </div>
                  ))}

                  {/* Tomorrow's Section */}
                  {birthdaysTomorrow.map((b: any, i) => (
                    <div key={`tomorrow-${i}`} className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
                      <div className="relative shrink-0">
                        {b.image_url ? (
                          <img src={b.image_url} className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-600 object-cover shadow-sm relative z-10" alt={b.username} />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center font-black relative z-10 text-xs shadow-sm">🎈</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5 whitespace-nowrap">Tomorrow</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-tight truncate">{b.full_name || b.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center group-hover:scale-110 transition-transform">
                  <div className="text-3xl mb-1 filter grayscale opacity-20">🎈</div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No ceremonies soon</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div>
          <h2 className="text-sm font-black text-slate-800 dark:text-white mb-3 flex items-center gap-2">
            <span className="p-1 bg-violet-600 rounded text-white text-[10px]">⚡</span>
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Delegation', icon: '📋', color: 'from-blue-500 to-blue-700', link: '/delegation', desc: 'Task Flow' },

              { label: 'NBD Ops', icon: '⚙️', color: 'from-emerald-500 to-teal-700', link: '/nbd', desc: 'Operations' },
              { label: 'Team', icon: '👥', color: 'from-rose-500 to-pink-700', link: '/users', desc: 'Users' },
              { label: 'Collection', icon: '💳', color: 'from-amber-500 to-orange-700', link: '/collection', desc: 'Ledger' },
              { label: 'Payable', icon: '🏦', color: 'from-red-500 to-rose-700', link: '/payable', desc: 'Payable' },
              { label: 'Orders', icon: '📦', color: 'from-purple-500 to-purple-700', link: '/o2d', desc: 'O2D Log' },
            ].map((action, i) => (
              <motion.a
                key={i}
                href={action.link}
                whileHover={{ y: -3, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group relative rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-[0.07] group-hover:opacity-[0.14] transition-opacity duration-300`}></div>
                <div className="relative bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 flex flex-col items-center gap-2 text-center h-full">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-xl shadow-md group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                    {action.icon}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 dark:text-white leading-tight">{action.label}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{action.desc}</p>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        </div>

        {/* Bottom Section: Activity Feeds & Help Tickets */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

          {/* Live Activity */}
          <div className="xl:col-span-4">
            <div className="bg-white dark:bg-slate-800 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden h-64 flex flex-col">
              <div className="p-3 border-b border-slate-50 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/50 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Live Activity</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Operation Feed</p>
                </div>
              </div>
              <div className="overflow-x-auto flex-grow custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400 sticky top-0 bg-white dark:bg-slate-800 z-10 p-2">
                    <tr>
                      <th className="px-3 py-2">Member</th>
                      <th className="px-3 py-2">In</th>
                      <th className="px-3 py-2">Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {recentCheckIns.map((log: any, idx: number) => (
                      <tr key={idx} className="hover:bg-indigo-50/30 dark:hover:bg-slate-700/30 transition-colors group">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden shadow-sm shrink-0">
                              {log.image_url ? <img src={log.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-slate-400 text-xs">{log.userName.charAt(0)}</div>}
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[80px]">{log.userName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                            {new Date(log.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {log.outTime ? (
                            <span className="text-xs font-black text-rose-500 dark:text-rose-400">
                              {new Date(log.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-slate-300 uppercase italic">Active</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {recentCheckIns.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-10 text-center">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No activity</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Leave Monitor */}
          <div className="xl:col-span-4">
            <div className="bg-white dark:bg-slate-800 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden h-64 flex flex-col">
              <div className="p-3 border-b border-slate-50 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/50 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Leave Monitor</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Today & Upcoming</p>
                </div>
              </div>
              <div className="overflow-x-auto flex-grow custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400 sticky top-0 bg-white dark:bg-slate-800 z-10 p-2">
                    <tr>
                      <th className="px-3 py-2">Member</th>
                      <th className="px-3 py-2">From</th>
                      <th className="px-3 py-2">To</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {upcomingLeaves.map((leave, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/30 dark:hover:bg-slate-700/30 transition-colors group">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden shadow-sm shrink-0">
                              {leave.image_url ? <img src={leave.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-slate-400 text-xs">{leave.userName.charAt(0)}</div>}
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[80px]">{leave.userName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-black text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {new Date(leave.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-black text-slate-500 dark:text-slate-500 whitespace-nowrap">
                            {new Date(leave.endDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate max-w-[100px]" title={leave.reason}>
                            {leave.reason || 'N/A'}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border ${leave.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                            leave.status === 'Rejected' ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800' :
                              'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                            }`}>
                            {leave.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {upcomingLeaves.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No upcoming leaves</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Help Tickets */}
          <div className="xl:col-span-4">
            <div className="bg-white dark:bg-slate-800 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden h-64 flex flex-col">
              <div className="p-3 border-b border-slate-50 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/50 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 bg-rose-500 rounded-md flex items-center justify-center text-[10px] text-white shadow-sm">🎫</span>
                    Help Tickets
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Open Requests</p>
                </div>
                <a href="/helpdesk" className="px-3 py-1 text-[10px] font-black text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                  View All
                </a>
              </div>
              <div className="overflow-x-auto flex-grow custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400 sticky top-0 bg-white dark:bg-slate-800 z-10">
                    <tr>
                      <th className="px-3 py-2">Ticket</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {helpTickets.slice(0, 8).map((ticket: any, idx: number) => (
                      <tr key={idx} className="hover:bg-rose-50/30 dark:hover:bg-slate-700/30 transition-colors group">
                        <td className="px-3 py-2">
                          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 whitespace-nowrap">{ticket.ticket_number || `#${idx + 1}`}</span>
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[130px]" title={ticket.subject}>{ticket.subject || 'N/A'}</p>
                          <p className="text-[9px] text-slate-400 truncate max-w-[130px]">{ticket.raised_by_name || ticket.raisedByName || ''}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border ${(ticket.priority || '').toLowerCase() === 'high' || (ticket.priority || '').toLowerCase() === 'critical'
                            ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
                            : (ticket.priority || '').toLowerCase() === 'medium'
                              ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'
                            }`}>
                            {ticket.priority || 'Low'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border ${(ticket.status || '').toLowerCase() === 'in-progress' || (ticket.status || '').toLowerCase() === 'in progress'
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800'
                            : (ticket.status || '').toLowerCase() === 'raised'
                              ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                              : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                            }`}>
                            {ticket.status || 'Raised'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {helpTickets.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-10 text-center">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No open tickets 🎉</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

      </div>

      <style jsx global>{`
        .animate-bounce-slow {
          animation: bounce-slow 3s infinite;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
          50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
        }
      `}</style>
    </LayoutWrapper>
  );
}

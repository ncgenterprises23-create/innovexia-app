'use client';

import React, { useState, useEffect } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { ensureSessionId } from '@/utils/session';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import CustomDateTimePicker from '@/components/CustomDateTimePicker';
import { getIstDateString } from '@/lib/dateUtils';
import { calculateDistance, calculateBearing, getCompassDirection, parseAllLatLongs } from '@/lib/locationUtils';


interface Leave {
    id: string;
    userId: string;
    userName: string;
    userImage?: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: string;
}

interface Remark {
    id: string;
    leaveId: string;
    userName: string;
    comment: string;
    createdAt: string;
}

// Icons
const CalendarIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
);
const UserIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
);
const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'Approved') return <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
    if (status === 'Rejected') return <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
    return <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
};
const CommentIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
);

export default function AttendancePage() {
    const { success, error } = useToast();
    const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'LEAVE' | 'ATTENDANCE_MASTER' | 'REPORT'>('ATTENDANCE');
    const [reportSearch, setReportSearch] = useState('');
    const [reportView, setReportView] = useState<'STATUS' | 'TIME'>('STATUS');
    const [user, setUser] = useState<any>(null);
    const SHIFT_START_TIME = "09:30";

    // Attendance State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [history, setHistory] = useState<any[]>([]);
    const [currentStatus, setCurrentStatus] = useState<'IDLE' | 'CHECKED_IN' | 'COMPLETED'>('IDLE');
    const [elapsedTime, setElapsedTime] = useState('00:00:00');
    const [checkInTime, setCheckInTime] = useState<Date | null>(null);

    // Leave State
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', reason: '' });

    // Admin State
    const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
    const [remarks, setRemarks] = useState<Remark[]>([]);
    const [newRemark, setNewRemark] = useState('');
    const [loadingRemarks, setLoadingRemarks] = useState(false);
    const [masterData, setMasterData] = useState<{ users: any[], attendance: any[], leaves: any[] } | null>(null);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const { showLoader, hideLoader } = useLoader();

    // Real-time Location State
    const [liveLocation, setLiveLocation] = useState<{ lat: number, lng: number, accuracy?: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isApple, setIsApple] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent;
        setIsApple(/iPad|iPhone|iPod|Macintosh/.test(ua));
        setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua));
    }, []);

    // Derived Location Metrics
    const registeredLocations = parseAllLatLongs(user?.late_long);
    
    let nearestRegistered: { lat: number; long: number } | null = null;
    let minDistance: number | null = null;
    let minBearing: number | null = null;

    if (liveLocation && registeredLocations.length > 0) {
        registeredLocations.forEach(reg => {
            const dist = calculateDistance(liveLocation.lat, liveLocation.lng, reg.lat, reg.long);
            if (minDistance === null || dist < minDistance) {
                minDistance = dist;
                nearestRegistered = reg;
                minBearing = calculateBearing(liveLocation.lat, liveLocation.lng, reg.lat, reg.long);
            }
        });
    }

    // Default to the first location if we don't have a live location yet (just for display)
    const registered = nearestRegistered || (registeredLocations.length > 0 ? registeredLocations[0] : null);
    const distance = minDistance;
    const bearing = minBearing;

    // Dynamic Range: 10m for mobile, 20m for desktop
    const rangeThreshold = isMobile ? 10 : 20;
    const isInRange = distance !== null && distance <= rangeThreshold;

    const refreshLocationManual = () => {
        showLoader();
        setLocationError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLiveLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                });
                hideLoader();
                success("Location updated successfully");
            },
            (err) => {
                hideLoader();
                const msg = err.code === 1 ? "Permission denied" : "Lookup failed";
                error(`Location refresh failed: ${msg}`);
                setLocationError(err.message);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    useEffect(() => {
        const init = async () => {
            // Initial load logic - maybe loader here too? User asked for "when taking action".
            // Let's keep initial load silent or use local loaders to avoid disruptive full screen on mount, unless requested.
            // But usually ensureSessionId etc is quick.
            // We'll leave init alone for now as focus is on "submit request" and "taking actions".
            try {
                const sessionId = ensureSessionId();
                const response = await fetch('/api/auth', { headers: { 'x-session-id': sessionId } });
                const data = await response.json();
                if (data.authenticated) {
                    setUser(data.user);
                    await Promise.all([
                        fetchAttendance(data.user.id),
                        fetchLeaves(data.user.id, data.user.role_name),
                        fetchMasterData()
                    ]);
                }
            } catch (e) {
                console.error(e);
            } finally {

            }
        };
        init();
    }, []);

    // Real-time location watcher
    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation not supported');
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setLiveLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                });
                setLocationError(null);
            },
            (err) => {
                console.warn('Location watch error:', err.message);
                let msg = err.message;
                if (err.code === 1) msg = "Location access denied. Please enable 'Location Services' in your iPhone Settings > Privacy.";
                if (err.code === 3) msg = "Location lookup timed out. Move to an area with better signal.";
                setLocationError(msg);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 10000
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Sync user data with master list to avoid stale sessions missing late_long
    useEffect(() => {
        if (masterData?.users && user?.id) {
            const freshUser = masterData.users.find(u => String(u.id) === String(user.id));
            if (freshUser && freshUser.late_long !== user.late_long) {
                console.log('[Location Debug] Syncing user coordinates from master data');
                setUser((prev: any) => prev ? ({ ...prev, late_long: freshUser.late_long }) : prev);
            }
        }
    }, [masterData, user?.id]);

    // Timer Logic 
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (currentStatus === 'CHECKED_IN' && checkInTime) {
            interval = setInterval(() => {
                const now = new Date();
                const diff = now.getTime() - checkInTime.getTime();
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setElapsedTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [currentStatus, checkInTime]);

    const fetchAttendance = async (userId: string) => {
        const res = await fetch(`/api/attendance?userId=${userId}`);
        const data = await res.json();
        if (data.history) setHistory(data.history);
        if (data.currentStatus) {
            setCurrentStatus(data.currentStatus);
            if (data.lastCheckIn) setCheckInTime(new Date(data.lastCheckIn));
        }
    };

    const fetchLeaves = async (userId: string, role: string) => {
        const res = await fetch(`/api/leave?userId=${userId}&role=${role}`);
        const data = await res.json();
        if (data.leaves) setLeaves(data.leaves);
    };

    const fetchRemarks = async (leaveId: string) => {
        setLoadingRemarks(true);
        const res = await fetch(`/api/leave?type=remarks&leaveId=${leaveId}`);
        const data = await res.json();
        if (data.remarks) setRemarks(data.remarks);
        setLoadingRemarks(false);
    };

    const fetchMasterData = async () => {
        try {
            const res = await fetch('/api/attendance/master');
            const data = await res.json();
            if (data.users) setMasterData(data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleAction = async (action: 'CHECK_IN' | 'CHECK_OUT') => {
        showLoader();
        try {
            // Get current location
            const getLocation = () => {
                return new Promise<GeolocationPosition>((resolve, reject) => {
                    if (!navigator.geolocation) {
                        reject(new Error('Geolocation is not supported by your browser'));
                    } else {
                        navigator.geolocation.getCurrentPosition(resolve, reject);
                    }
                });
            };

            let latitude: number | null = null;
            let longitude: number | null = null;

            try {
                const position = await getLocation();
                latitude = position.coords.latitude;
                longitude = position.coords.longitude;
            } catch (err: any) {
                console.warn('Geolocation failed:', err.message);
                // We'll let the API decide if location is required
            }

            // Optimistic update
            if (action === 'CHECK_IN') { setCurrentStatus('CHECKED_IN'); setCheckInTime(new Date()); }
            else { setCurrentStatus('COMPLETED'); }

            const res = await fetch('/api/attendance', {
                method: 'POST',
                body: JSON.stringify({
                    action,
                    userId: user.id,
                    userName: user.username,
                    latitude,
                    longitude,
                    accuracy: liveLocation?.accuracy,
                    isMobile // Send platform info to API for server-side validation
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Action failed');
            }

            await fetchAttendance(user.id);
            success(action === 'CHECK_IN' ? 'Checked in successfully!' : 'Checked out successfully!');
        } catch (e: any) {
            error(e.message || 'Failed to update attendance status');
            // Revert optimistic update if needed
            fetchAttendance(user.id);
        } finally {
            hideLoader();
        }
    };

    const handleLeaveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        showLoader();
        try {
            const res = await fetch('/api/leave', {
                method: 'POST',
                body: JSON.stringify({ userId: user.id, userName: user.username, ...leaveForm })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed');
            }

            setLeaveForm({ startDate: '', endDate: '', reason: '' });
            await fetchLeaves(user.id, user.role_name);
            success('Leave request submitted successfully!');
        } catch (e: any) {
            error(e.message || 'Failed to submit leave request');
        } finally {
            hideLoader();
        }
    };

    const handleStatusUpdate = async (status: 'Approved' | 'Rejected') => {
        if (!selectedLeave) return;
        showLoader();
        try {
            const res = await fetch('/api/leave', {
                method: 'POST',
                body: JSON.stringify({ action: 'UPDATE_STATUS', leaveId: selectedLeave.id, status })
            });
            if (!res.ok) throw new Error('Failed');

            setSelectedLeave(null); // Close modal
            await fetchLeaves(user.id, user.role_name);
            success(`Leave request ${status.toLowerCase()}!`);
        } catch (e) {
            error(`Failed to ${status.toLowerCase()} request`);
        } finally {
            hideLoader();
        }
    };

    const handleAddRemark = async () => {
        if (!newRemark.trim() || !selectedLeave) return;
        showLoader();
        try {
            const res = await fetch('/api/leave', {
                method: 'POST',
                body: JSON.stringify({ action: 'ADD_REMARK', leaveId: selectedLeave.id, userName: user.username, comment: newRemark })
            });
            if (!res.ok) throw new Error('Failed');

            setNewRemark('');
            await fetchRemarks(selectedLeave.id);
            success('Comment added!');
        } catch (e) {
            error('Failed to add comment');
        } finally {
            hideLoader();
        }
    };

    const formatToDDMMYYYY = (dateStr: string) => {
        if (!dateStr || !dateStr.includes('-')) return dateStr;
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];

        // Empty cells for previous month
        for (let i = 0; i < firstDay; i++) days.push(<div key={`e-${i}`} className="h-24 md:h-32 bg-gray-50/50 dark:bg-slate-900/20" />);

        const todayStr = getIstDateString();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const record = history.find(h => h.date === dateStr);
            const isToday = dateStr === todayStr;
            const leave = leaves.find(l => dateStr >= l.startDate && dateStr <= l.endDate && l.userId === user?.id);

            const dateObj = new Date(year, month, d);
            const isSunday = dateObj.getDay() === 0;

            let color = 'bg-white dark:bg-slate-700';
            let animation = '';

            // Status Logic
            if (isSunday) {
                color = 'bg-gray-200 text-gray-400 dark:bg-slate-800 dark:text-slate-600 shadow-none cursor-default';
            } else if (leave?.status === 'Approved') {
                color = 'bg-yellow-400 text-white shadow-md shadow-yellow-200';
            } else if (record?.inTime) {
                if (record.outTime) {
                    // Completed
                    color = 'bg-green-500 text-white shadow-md shadow-green-200';
                } else {
                    // Active Check-in (Yellow + Blinking)
                    color = 'bg-yellow-400 text-white shadow-md shadow-yellow-200 ring-2 ring-yellow-200';
                    animation = 'animate-pulse';
                }
            } else if (dateStr < todayStr) {
                // Missed (Past date, no record)
                color = 'bg-red-500 text-white shadow-md shadow-red-200';
            } else if (isToday) {
                // Today default
                color = 'border-2 border-[var(--theme-primary)] text-[var(--theme-primary)]';
            }

            days.push(
                <div key={d} className={`flex flex-col items-center pt-2 h-24 md:h-32 relative group transition-colors ${isSunday ? '' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}>
                    <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center font-bold text-lg transition-all transform ${!isSunday && 'group-hover:scale-110'} ${color} ${animation} mb-1`}>{d}</div>
                    {record?.inTime && record?.outTime && (
                        <div className="text-xs font-bold bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-full text-gray-600 shadow-sm border border-gray-200 dark:border-slate-600 mt-1 min-w-[60px] text-center">
                            {(() => {
                                const diff = new Date(record.outTime).getTime() - new Date(record.inTime).getTime();
                                const h = Math.floor(diff / 3600000);
                                const m = Math.floor((diff % 3600000) / 60000);
                                return `${h}h ${m}m`;
                            })()}
                        </div>
                    )}
                </div>
            )
        }

        // Fill remaining cells for next month to complete the grid
        const totalDisplayedParams = firstDay + daysInMonth;
        const remainingCells = (7 - (totalDisplayedParams % 7)) % 7;
        for (let i = 0; i < remainingCells; i++) {
            days.push(<div key={`end-${i}`} className="h-24 md:h-32 bg-gray-50/50 dark:bg-slate-900/20" />);
        }

        return days;
    };


    return (
        <LayoutWrapper>
            <div className="p-4 w-full mx-auto space-y-6">
                {/* Tabs */}
                <div className="flex p-1.5 gap-1 md:gap-2 bg-gray-100/50 dark:bg-slate-900/50 rounded-2xl w-fit border border-gray-200/50 dark:border-slate-800 backdrop-blur-md">
                    <button
                        onClick={() => setActiveTab('ATTENDANCE')}
                        className={`py-3 px-4 md:px-6 font-black text-xs md:text-sm rounded-xl transition-all flex items-center gap-2 shadow-sm ${activeTab === 'ATTENDANCE' ? 'bg-white dark:bg-slate-800 text-[var(--theme-primary)] shadow-md border border-gray-100 dark:border-slate-700' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        <CalendarIcon /> <span className="hidden md:block">Attendance</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('LEAVE')}
                        className={`py-3 px-4 md:px-6 font-black text-xs md:text-sm rounded-xl transition-all flex items-center gap-2 shadow-sm ${activeTab === 'LEAVE' ? 'bg-white dark:bg-slate-800 text-[var(--theme-primary)] shadow-md border border-gray-100 dark:border-slate-700' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        <StatusIcon status="Pending" /> <span className="hidden md:block">Leave Management</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('ATTENDANCE_MASTER')}
                        className={`py-3 px-4 md:px-6 font-black text-xs md:text-sm rounded-xl transition-all flex items-center gap-2 shadow-sm ${activeTab === 'ATTENDANCE_MASTER' ? 'bg-white dark:bg-slate-800 text-[var(--theme-primary)] shadow-md border border-gray-100 dark:border-slate-700' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        <UserIcon /> <span className="hidden md:block">Attendance Master</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('REPORT')}
                        className={`py-3 px-4 md:px-6 font-black text-xs md:text-sm rounded-xl transition-all flex items-center gap-2 shadow-sm ${activeTab === 'REPORT' ? 'bg-white dark:bg-slate-800 text-[var(--theme-primary)] shadow-md border border-gray-100 dark:border-slate-700' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a2 2 0 00-2-2H5a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v8m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        <span className="hidden md:block">Attendance Report</span>
                    </button>
                </div>

                {activeTab === 'ATTENDANCE' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-700 overflow-hidden">
                            {/* Calendar Header */}
                            <div className="p-4 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                                <button className="p-2 hover:bg-gray-200 rounded-full transition" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>←</button>
                                <h2 className="text-2xl font-black flex items-center gap-2 text-[var(--theme-primary)]">
                                    <CalendarIcon /> {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                                </h2>
                                <button className="p-2 hover:bg-gray-200 rounded-full transition" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>→</button>
                            </div>
                            <div className="grid grid-cols-7 bg-white dark:bg-slate-800 py-3 border-b">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-center font-bold text-gray-400 text-sm uppercase tracking-wider">{d}</div>)}</div>
                            <div className="grid grid-cols-7">{renderCalendar()}</div>
                        </div>
                        <div className="lg:col-span-1 flex flex-col gap-6">
                            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg p-6 border border-gray-100 dark:border-slate-700 text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-[var(--theme-primary)]"></div>
                                <h3 className="text-gray-600 dark:text-gray-400 uppercase text-xs font-black mb-3 tracking-widest">Global Work System</h3>
                                <div className="text-6xl font-mono font-black text-gray-900 dark:text-white mb-8 tabular-nums drop-shadow-sm tracking-tighter">{elapsedTime}</div>
                                {(() => {
                                    const todayStr = getIstDateString();
                                    const isSunday = new Date().getDay() === 0;
                                    const isOnLeave = leaves.some(l => l.status === 'Approved' && todayStr >= l.startDate && todayStr <= l.endDate);
                                    const isRestricted = isSunday || isOnLeave;
                                    const restrictionReason = isSunday ? "System Restricted on Sunday" : "System Restricted during Leave";

                                    const checkInDisabled = isRestricted || (currentStatus === 'IDLE' && !isInRange);

                                    return (
                                        <>
                                            {currentStatus === 'IDLE' && (
                                                <div className="space-y-2">
                                                    <button
                                                        onClick={() => handleAction('CHECK_IN')}
                                                        disabled={checkInDisabled}
                                                        className={`w-full py-5 rounded-2xl font-black text-lg transition-all transform ${checkInDisabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed scale-100' : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30 hover:scale-[1.02] active:scale-95'}`}
                                                    >
                                                        Check In System
                                                    </button>
                                                    {currentStatus === 'IDLE' && !isInRange && !isRestricted && (
                                                        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">
                                                            {isMobile ? 'Mobile: ' : 'Desktop: '} Reach {rangeThreshold}m zone to unlock
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            {currentStatus === 'CHECKED_IN' && <button onClick={() => handleAction('CHECK_OUT')} className="w-full py-5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-lg shadow-lg shadow-red-500/30 transition-all transform hover:scale-[1.02] active:scale-95 animate-pulse">Deactivate Link</button>}
                                            {currentStatus === 'COMPLETED' && <div className="mt-4 text-green-600 font-black text-lg bg-green-50 py-4 rounded-xl border border-green-100 dark:bg-green-900/20 dark:border-green-800">Mission Accomplished ✅</div>}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Location Intelligence Dashboard */}
                            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg p-6 flex-grow border border-gray-100 dark:border-slate-700 relative overflow-hidden flex flex-col">
                                <div className="absolute top-0 right-0 p-3 opacity-10">
                                    <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" /></svg>
                                </div>
                                <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-gray-800 dark:text-white uppercase tracking-tight italic">
                                    <span className="w-2 h-2 rounded-full bg-[var(--theme-primary)] animate-ping"></span>
                                    Location Intelligence
                                </h3>

                                {user?.late_long ? (() => {
                                    if (!registered) return <div className="text-red-500 text-xs font-bold">Invalid registered location format.</div>;

                                    return (
                                        <div className="space-y-6 flex-grow flex flex-col">
                                            {/* Coordinates Comparison */}
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-700">
                                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Registered Bases</div>
                                                    <div className="space-y-2">
                                                        {registeredLocations.map((loc, idx) => {
                                                            const isNearest = registered && loc.lat === registered.lat && loc.long === registered.long;
                                                            return (
                                                                <div key={idx} className={`flex flex-col md:flex-row md:items-center justify-between text-sm font-black font-mono transition-all ${isNearest ? 'text-[var(--theme-primary)] bg-[var(--theme-primary)]/10 p-2 rounded-lg border border-[var(--theme-primary)]/20' : 'text-gray-800 dark:text-gray-200 p-2 border border-transparent'}`}>
                                                                    <span>Loc {idx + 1}: {loc.lat.toFixed(6)}, {loc.long.toFixed(6)}</span>
                                                                    {isNearest && <span className="text-[10px] bg-[var(--theme-primary)] text-white px-2 py-0.5 rounded-full w-fit mt-1 md:mt-0">NEAREST TARGET</span>}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                                    <span>Current Actual</span>
                                                    {liveLocation && <span className="text-[8px] bg-green-500 text-white px-1 rounded animate-pulse">LIVE</span>}
                                                </div>
                                                {locationError ? (
                                                    <div className="text-xs text-red-500 font-bold p-2 bg-red-100/50 rounded-lg">{locationError}</div>
                                                ) : liveLocation ? (
                                                    <div className="space-y-1">
                                                        <div className="text-sm font-black text-[var(--theme-primary)] font-mono">
                                                            LAT: {liveLocation.lat.toFixed(6)}
                                                        </div>
                                                        <div className="text-sm font-black text-[var(--theme-primary)] font-mono">
                                                            LNG: {liveLocation.lng.toFixed(6)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce"></div>
                                                        <div className="text-xs text-gray-400 font-bold animate-pulse">Detecting Satellite...</div>
                                                    </div>
                                                )}
                                            </div>

                                            {distance !== null ? (
                                                <div className="text-center group cursor-pointer" onClick={refreshLocationManual}>
                                                    <div className={`text-5xl font-black mb-1 tabular-nums transition-all ${isInRange ? 'text-green-500' : 'text-red-500 text-6xl scale-110 group-hover:scale-125'}`}>
                                                        {Math.round(distance)}m
                                                    </div>
                                                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${isInRange ? 'text-green-600' : 'text-red-600'}`}>
                                                        {isInRange ? 'In Range' : 'Out of Bounds'}
                                                    </div>
                                                    {!isInRange && <div className="text-[8px] font-bold text-gray-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Tap to re-sync location</div>}
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <button
                                                        onClick={refreshLocationManual}
                                                        className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-[var(--theme-primary)] transition-all group"
                                                    >
                                                        <div className="text-gray-300 font-black animate-pulse uppercase text-xs tracking-widest mb-2">Calculating Gap...</div>
                                                        <div className="text-[10px] text-[var(--theme-primary)] font-bold opacity-0 group-hover:opacity-100 transition-all font-black">Tap to Start Tracker</div>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Guidance Directions */}
                                            {!isInRange && distance !== null && bearing !== null && (
                                                <div className="mt-auto space-y-3">
                                                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-dashed border-orange-200 dark:border-orange-800 rounded-2xl animate-in fade-in slide-in-from-bottom-2 flex items-center gap-4">
                                                        <div className="shrink-0 w-12 h-12 bg-white dark:bg-slate-800 rounded-full shadow-md flex items-center justify-center border border-orange-200 dark:border-orange-700">
                                                            <div
                                                                className="transition-transform duration-500 ease-out"
                                                                style={{ transform: `rotate(${bearing}deg)` }}
                                                            >
                                                                <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                                                                    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase mb-1 flex items-center justify-between">
                                                                <span>Navigation Guide</span>
                                                                <span className="bg-orange-600 text-white px-2 py-0.5 rounded text-[8px]">{getCompassDirection(bearing)}</span>
                                                            </div>
                                                            <p className="text-xs font-black text-orange-800 dark:text-orange-300 leading-tight">
                                                                Move {Math.round(distance)}m towards the arrow to reach your zone.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const url = isApple
                                                                ? `https://maps.apple.com/?daddr=${registered.lat},${registered.long}&dirflg=d`
                                                                : `https://www.google.com/maps/dir/?api=1&destination=${registered.lat},${registered.long}`;
                                                            window.open(url, '_blank');
                                                        }}
                                                        className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                                                        Show on {isApple ? 'Apple Maps' : 'Google Maps'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })() : (
                                    <div className="flex flex-col items-center justify-center p-8 text-center opacity-50 flex-grow">
                                        <div className="p-4 bg-gray-100 rounded-full mb-4">
                                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        </div>
                                        <p className="text-sm font-bold text-gray-500 italic">No Location registered. Please contact your manager to set your base coordinates.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'LEAVE' && (
                    // LEAVE MANAGEMENT TAB
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg p-6 border border-gray-100 dark:border-slate-700 sticky top-6">
                                <h3 className="text-2xl font-black mb-8 flex items-center gap-2 text-[var(--theme-primary)]"><CalendarIcon /> Apply for Leave</h3>
                                <form onSubmit={handleLeaveSubmit} className="space-y-4">
                                    <div>
                                        <CustomDateTimePicker
                                            label="From Date"
                                            dateOnly
                                            value={leaveForm.startDate}
                                            onChange={(val) => setLeaveForm({ ...leaveForm, startDate: val })}
                                        />
                                    </div>
                                    <div>
                                        <CustomDateTimePicker
                                            label="To Date"
                                            dateOnly
                                            value={leaveForm.endDate}
                                            onChange={(val) => setLeaveForm({ ...leaveForm, endDate: val })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">Reason</label>
                                        <textarea required value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Type your reason here..." className="w-full p-3 rounded-xl border-2 border-gray-100 focus:border-[var(--theme-primary)] outline-none transition-colors bg-gray-50 dark:bg-slate-900 dark:border-slate-700 h-32 resize-none" />
                                    </div>
                                    <button type="submit" className="w-full py-4 bg-[var(--theme-primary)] hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-[var(--theme-primary)]/30 transition-all transform hover:scale-[1.02]">Submit Request</button>
                                </form>
                            </div>
                        </div>

                        {/* List of Leaves */}
                        <div className="lg:col-span-2">
                            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-700 p-6 min-h-[600px]">
                                <h3 className="text-2xl font-black mb-8 flex justify-between items-center border-b border-gray-100 dark:border-slate-700 pb-6 text-gray-900 dark:text-white">
                                    <span className="flex items-center gap-3"><StatusIcon status="Pending" /> {user?.role_name === 'Admin' ? 'Management Console' : 'My Leave Lifecycle'}</span>
                                    <span className="text-[10px] font-black bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] px-4 py-1.5 rounded-full uppercase tracking-tighter">{leaves.length} records</span>
                                </h3>

                                <div className="space-y-4">
                                    {leaves.map((leave) => (
                                        <div key={leave.id} onClick={() => { setSelectedLeave(leave); fetchRemarks(leave.id); }} className="group relative p-5 rounded-2xl border border-gray-100 dark:border-slate-700 hover:shadow-lg hover:border-[var(--theme-primary)]/30 transition-all cursor-pointer bg-white dark:bg-slate-800">
                                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                                <div className="flex-grow">
                                                    {/* REQUESTER NAME - HIGHLIGHTED AS REQUESTED */}
                                                    {user?.role_name === 'Admin' && (
                                                        <div className="mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-[var(--theme-primary)]/20 text-[var(--theme-primary)] flex items-center justify-center font-bold overflow-hidden">
                                                                    {leave.userImage ? (
                                                                        <img src={leave.userImage} alt={leave.userName} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <UserIcon />
                                                                    )}
                                                                </div>
                                                                <span className="text-lg font-bold text-gray-900 dark:text-white">{leave.userName}</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                                                        <span className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-lg"><CalendarIcon /> {formatToDDMMYYYY(leave.startDate)}</span>
                                                        <span className="text-gray-400">to</span>
                                                        <span className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-lg"><CalendarIcon /> {formatToDDMMYYYY(leave.endDate)}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 italic pl-1 border-l-2 border-gray-200 dark:border-gray-700 line-clamp-1 group-hover:line-clamp-none transition-all">{leave.reason}</p>
                                                </div>

                                                <div className="flex items-center gap-4 min-w-[120px] justify-end">
                                                    <div className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${leave.status === 'Approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        leave.status === 'Rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                        }`}>
                                                        <StatusIcon status={leave.status} /> {leave.status}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-gray-50 dark:border-slate-800 flex justify-end">
                                                <div className="text-xs font-bold text-[var(--theme-primary)] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                                    Open Details <CommentIcon />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'ATTENDANCE_MASTER' && (
                    // ATTENDANCE MASTER TAB
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-700 p-8 overflow-hidden min-h-[600px]">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-[var(--theme-primary)] flex items-center gap-3 drop-shadow-sm mb-2">
                                    <UserIcon />
                                    {user?.role_name === 'Admin' ? 'Attendance Master Control' : 'My Attendance Stats'}
                                </h3>
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-1">System Intelligence & Performance Metrics</p>
                            </div>
                            <div className="flex items-center gap-4 bg-[var(--theme-primary)]/5 dark:bg-slate-900/80 p-3 rounded-2xl border border-[var(--theme-primary)]/10 shadow-sm backdrop-blur-sm group transition-all hover:border-[var(--theme-primary)]/30">
                                <button className="h-10 w-10 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition shadow-sm border border-gray-100 dark:border-slate-700 text-[var(--theme-primary)] active:scale-95" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <span className="font-extrabold px-4 text-gray-800 dark:text-white text-lg min-w-[180px] text-center">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                                <button className="h-10 w-10 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition shadow-sm border border-gray-100 dark:border-slate-700 text-[var(--theme-primary)] active:scale-95" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>

                        {!masterData ? (
                            <div className="flex flex-col items-center justify-center py-20 opacity-50">
                                <div className="w-16 h-16 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin mb-6"></div>
                                <div className="font-black uppercase tracking-widest text-xs text-[var(--theme-primary)]">Loading System Intelligence...</div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-separate border-spacing-y-4">
                                    <thead className="bg-gray-50/50 dark:bg-slate-900/50 rounded-2xl">
                                        <tr className="text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest">
                                            <th className="px-6 py-5 first:rounded-l-2xl">Employee Details</th>
                                            <th className="px-6 py-5 text-center">Presents</th>
                                            <th className="px-6 py-5 text-center">Absents</th>
                                            <th className="px-6 py-5 text-center">Leaves</th>
                                            <th className="px-6 py-5 text-center">Half Day</th>
                                            <th className="px-6 py-5 text-center">Total Hours</th>
                                            <th className="px-6 py-5 text-center">System Score</th>
                                            <th className="px-6 py-5 text-center last:rounded-r-2xl">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {masterData.users
                                            .filter(u => user?.role_name === 'Admin' ? true : String(u.id) === String(user?.id))
                                            .map(u => {
                                                const year = currentDate.getFullYear();
                                                const month = currentDate.getMonth();
                                                const daysInMonth = new Date(year, month + 1, 0).getDate();
                                                const monthAtt = masterData.attendance.filter(a => String(a.userId) === String(u.id) && a.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`));
                                                const monthLeaves = masterData.leaves.filter(lv => String(lv.userId) === String(u.id) && lv.status === 'Approved');

                                                let pCount = 0, aCount = 0, lCount = 0, hCount = 0, totalHours = 0, monthPoints = 0, cumulativePoints = 0, workingDaysInMonth = 0;
                                                const dailyStats: any[] = [];
                                                const todayStr = getIstDateString();
                                                const [sh, sm] = SHIFT_START_TIME.split(':').map(Number);
                                                const shiftStartTotalMinutes = sh * 60 + sm;

                                                const allUserAtt = masterData.attendance.filter(a => String(a.userId) === String(u.id));
                                                allUserAtt.forEach(att => {
                                                    if (att.status === 'COMPLETED' || att.status === 'IN') {
                                                        const duration = (att.inTime && att.outTime) ? (new Date(att.outTime).getTime() - new Date(att.inTime).getTime()) / 3600000 : 9; // Assume P if only IN
                                                        if (duration < 5) cumulativePoints += 0.5;
                                                        else cumulativePoints += 1;
                                                    }
                                                });
                                                // Note: Cumulative absents calculation would require full history traversal which might be heavy. 
                                                // For now, we align the existing record-based cumulative points with the new P/H weights.

                                                let workingDaysPassed = 0;
                                                for (let d = 1; d <= daysInMonth; d++) {
                                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                    const att = monthAtt.find(a => String(a.date) === String(dateStr));
                                                    const isOnLeave = monthLeaves.find(lv => dateStr >= lv.startDate && dateStr <= lv.endDate);
                                                    const dateObj = new Date(year, month, d);
                                                    const isSunday = dateObj.getDay() === 0;

                                                    if (!isSunday) {
                                                        workingDaysInMonth++;
                                                        if (dateStr <= todayStr) workingDaysPassed++;
                                                    }

                                                    let status = '-';
                                                    let color = 'text-gray-300';
                                                    let points = 0;

                                                    if (isSunday) {
                                                        status = 'SUN';
                                                        color = 'text-gray-400 opacity-30';
                                                    } else if (att) {
                                                        if (att.inTime && att.outTime) {
                                                            const duration = (new Date(att.outTime).getTime() - new Date(att.inTime).getTime()) / 3600000;
                                                            totalHours += duration;
                                                            if (duration < 5) {
                                                                status = 'H';
                                                                hCount++;
                                                                points = 0.5;
                                                                color = 'text-orange-500';
                                                            } else {
                                                                status = 'P';
                                                                pCount++;
                                                                points = 1;
                                                                color = 'text-green-500';
                                                            }
                                                        } else {
                                                            status = 'P';
                                                            pCount++;
                                                            points = 1;
                                                            color = 'text-green-500';
                                                        }
                                                        monthPoints += points;
                                                    } else if (isOnLeave) {
                                                        status = 'L';
                                                        lCount++;
                                                        color = 'text-yellow-500';
                                                    } else if (dateStr < todayStr) {
                                                        status = 'A';
                                                        aCount++;
                                                        points = -1;
                                                        color = 'text-red-500';
                                                        monthPoints += points;
                                                    }
                                                    dailyStats.push({ d, status, color, points });
                                                }

                                                const isExpanded = expandedUserId === u.id;

                                                return (
                                                    <React.Fragment key={u.id}>
                                                        <tr className={`group transition-all ${isExpanded ? 'bg-[var(--theme-primary)]/5' : 'bg-gray-50/50 dark:bg-slate-900/40'} border border-transparent hover:border-[var(--theme-primary)]/20 rounded-2xl overflow-hidden`}>
                                                            <td className="px-6 py-4 rounded-l-2xl">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-full bg-[var(--theme-primary)] text-white flex items-center justify-center font-black shadow-lg overflow-hidden shrink-0">
                                                                        {u.image_url ? <img src={u.image_url} alt={u.full_name} className="w-full h-full object-cover" /> : <UserIcon />}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-black text-gray-900 dark:text-white leading-tight text-lg">{u.full_name || u.username}</div>
                                                                        <div className="text-[11px] text-gray-500 font-black uppercase tracking-widest pl-0.5">ID: {u.id}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <div className="inline-block px-4 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-black shadow-sm">{pCount}</div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <div className="inline-block px-4 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-black shadow-sm">{aCount}</div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <div className="inline-block px-4 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-sm font-black shadow-sm">{lCount}</div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <div className="inline-block px-4 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-sm font-black shadow-sm">{hCount}</div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <div className="inline-block px-5 py-2 rounded-full bg-[var(--theme-primary)]/10 dark:bg-[var(--theme-primary)]/20 text-[var(--theme-primary)] text-base font-black shadow-sm">{totalHours.toFixed(1)}h</div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <div className={`inline-block px-5 py-2 rounded-full font-black text-base shadow-sm ${((pCount + hCount * 0.5) / (workingDaysPassed || 1) * 100) >= 60 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {((pCount + hCount * 0.5) / (workingDaysPassed || 1) * 100).toFixed(0)}%
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center rounded-r-2xl">
                                                                <div className="flex justify-center">
                                                                    <button onClick={() => setExpandedUserId(isExpanded ? null : u.id)} className={`h-11 w-11 flex items-center justify-center rounded-xl transition-all ${isExpanded ? 'bg-[var(--theme-primary)] text-white rotate-180 shadow-lg' : 'bg-white dark:bg-slate-700 text-gray-400 hover:text-[var(--theme-primary)] shadow-sm border border-gray-100 dark:border-slate-600 hover:border-[var(--theme-primary)]/30'}`}>
                                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v12m6-6H6" /></svg>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr>
                                                                <td colSpan={8} className="px-6 pb-6 pt-2">
                                                                    <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-6 border border-[var(--theme-primary)]/10 shadow-inner animate-in slide-in-from-top-4 duration-300">
                                                                        <div className="flex justify-between items-center mb-6 px-2">
                                                                            <h4 className="text-xl font-black text-[var(--theme-primary)] flex items-center gap-2">
                                                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                                                                Performance Analysis
                                                                            </h4>
                                                                            <div className="flex gap-4">
                                                                                <div className="text-right">
                                                                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Monthly Points</div>
                                                                                    <div className="text-xl font-black text-gray-900 dark:text-white">{monthPoints.toFixed(1)}</div>
                                                                                </div>
                                                                                <div className="text-right border-l border-gray-100 dark:border-slate-800 pl-4">
                                                                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cumulative Score</div>
                                                                                    <div className="text-xl font-black text-[var(--theme-primary)]">{((pCount + hCount * 0.5) / (workingDaysPassed || 1) * 100).toFixed(0)}%</div>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-7 md:grid-cols-10 lg:grid-cols-15 gap-2">
                                                                            {dailyStats.map(stat => (
                                                                                <div key={stat.d} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 min-w-[55px] transition-all hover:bg-[var(--theme-primary)]/5 hover:border-[var(--theme-primary)]/20 shadow-sm relative group/cell">
                                                                                    <div className="text-xs font-black text-gray-900 dark:text-white mb-1">{stat.d}</div>
                                                                                    <div className={`font-black text-sm ${stat.color}`}>{stat.status}</div>
                                                                                    {stat.status !== 'SUN' && stat.status !== '-' && (
                                                                                        <div className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-md text-[8px] font-black shadow-sm ${stat.points > 0 ? 'bg-green-500 text-white' : stat.points < 0 ? 'bg-red-500 text-white' : 'bg-gray-400 text-white'}`}>
                                                                                            {stat.points > 0 ? `+${stat.points}` : stat.points}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'REPORT' && masterData && (
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-700 p-8 overflow-hidden min-h-[600px] flex flex-col">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-[var(--theme-primary)] flex items-center gap-3 drop-shadow-sm mb-2">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 17v-2a2 2 0 00-2-2H5a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v8m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    Attendance Comprehensive Report
                                </h3>
                                <div className="flex items-center gap-3">
                                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-1">Matrix View • Performance Analytics</p>
                                    <div className="h-8 w-[1px] bg-gray-200 dark:bg-slate-700 mx-2 hidden md:block"></div>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[var(--theme-primary)] transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search by name..."
                                            value={reportSearch}
                                            onChange={(e) => setReportSearch(e.target.value)}
                                            className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 focus:border-[var(--theme-primary)] transition-all w-48 lg:w-64"
                                        />
                                    </div>
                                    <div className="flex bg-gray-100 dark:bg-slate-900/50 p-1 rounded-xl border border-gray-100 dark:border-slate-700 shadow-inner shrink-0">
                                        <button
                                            onClick={() => setReportView('STATUS')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${reportView === 'STATUS' ? 'bg-white dark:bg-slate-800 text-[var(--theme-primary)] shadow-sm border border-gray-100 dark:border-slate-700' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Status
                                        </button>
                                        <button
                                            onClick={() => setReportView('TIME')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${reportView === 'TIME' ? 'bg-white dark:bg-slate-800 text-[var(--theme-primary)] shadow-sm border border-gray-100 dark:border-slate-700' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Time
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-[var(--theme-primary)]/5 dark:bg-slate-900/80 p-3 rounded-2xl border border-[var(--theme-primary)]/10 shadow-sm backdrop-blur-sm group transition-all hover:border-[var(--theme-primary)]/30">
                                <button className="h-10 w-10 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition shadow-sm border border-gray-100 dark:border-slate-700 text-[var(--theme-primary)] active:scale-95" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <span className="font-extrabold px-4 text-gray-800 dark:text-white text-lg min-w-[180px] text-center">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                                <button className="h-10 w-10 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition shadow-sm border border-gray-100 dark:border-slate-700 text-[var(--theme-primary)] active:scale-95" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex-grow overflow-auto border border-gray-100 dark:border-slate-700 rounded-2xl custom-scrollbar shadow-inner max-h-[60vh]">
                            <table className="w-full border-separate border-spacing-0">
                                <thead className="sticky top-0 z-20 shadow-sm">
                                    <tr className="bg-gray-100 dark:bg-slate-900">
                                        <th className="sticky left-0 top-0 z-40 bg-gray-100 dark:bg-slate-800 p-4 border border-gray-200 dark:border-slate-700 text-center text-[10px] font-black uppercase tracking-widest min-w-[180px] text-gray-500">
                                            User Details / Days
                                        </th>
                                        {(() => {
                                            const year = currentDate.getFullYear();
                                            const month = currentDate.getMonth();
                                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                                            return Array.from({ length: daysInMonth }).map((_, i) => (
                                                <th key={i + 1} className="p-2 border border-gray-200 dark:border-slate-700 text-center min-w-[45px] bg-gray-50 dark:bg-slate-900 text-[10px] font-black">
                                                    {i + 1}
                                                </th>
                                            ));
                                        })()}
                                    </tr>
                                </thead>
                                <tbody>
                                    {masterData.users
                                        .filter(u => user?.role_name === 'Admin' ? true : String(u.id) === String(user?.id))
                                        .filter(u => (u.full_name || u.username || '').toLowerCase().includes(reportSearch.toLowerCase()))
                                        .map(u => {
                                            const year = currentDate.getFullYear();
                                            const month = currentDate.getMonth();
                                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                                            const todayStr = getIstDateString();

                                            // Calculate Cumulative Score & Averages
                                            const [sh, sm] = SHIFT_START_TIME.split(':').map(Number);
                                            const shiftStartTotalMinutes = sh * 60 + sm;
                                            let cumulativePoints = 0;
                                            const allUserAtt = masterData.attendance.filter(a => String(a.userId) === String(u.id));

                                            // Monthly average calculations
                                            const currentMonthAtt = allUserAtt.filter(a => {
                                                const aDate = new Date(a.date);
                                                return aDate.getMonth() === month && aDate.getFullYear() === year;
                                            });

                                            let totalInMinutes = 0, totalOutMinutes = 0;
                                            let inCount = 0, outCount = 0;

                                            let monthPositivePoints = 0;
                                            currentMonthAtt.forEach(att => {
                                                if (att.inTime) {
                                                    if (att.inTime && att.outTime) {
                                                        const duration = (new Date(att.outTime).getTime() - new Date(att.inTime).getTime()) / 3600000;
                                                        monthPositivePoints += (duration < 5) ? 0.5 : 1;
                                                    } else {
                                                        monthPositivePoints += 1;
                                                    }
                                                }
                                            });

                                            currentMonthAtt.forEach(att => {
                                                if (att.inTime) {
                                                    const inT = new Date(att.inTime);
                                                    totalInMinutes += inT.getHours() * 60 + inT.getMinutes();
                                                    inCount++;
                                                }
                                                if (att.outTime) {
                                                    const outT = new Date(att.outTime);
                                                    totalOutMinutes += outT.getHours() * 60 + outT.getMinutes();
                                                    outCount++;
                                                }
                                            });

                                            const avgInM = inCount > 0 ? Math.round(totalInMinutes / inCount) : null;
                                            const avgOutM = outCount > 0 ? Math.round(totalOutMinutes / outCount) : null;

                                            const formatAvg = (m: number | null) => {
                                                if (m === null) return '--:--';
                                                const hrs = Math.floor(m / 60);
                                                const mins = m % 60;
                                                return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                                            };

                                            // Calculate working days passed in the selected month
                                            let workingDaysPassedValue = 0;
                                            for (let d = 1; d <= daysInMonth; d++) {
                                                const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                const dObj = new Date(year, month, d);
                                                if (dObj.getDay() !== 0 && dStr <= todayStr) {
                                                    workingDaysPassedValue++;
                                                }
                                            }

                                            const cumScore = ((monthPositivePoints / (workingDaysPassedValue || 1)) * 100).toFixed(0);

                                            return (
                                                <tr key={u.id} className="group hover:bg-gray-50 dark:hover:bg-slate-700/20 transition-all border-b border-gray-50 dark:border-slate-800">
                                                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 p-4 border-r border-gray-200 dark:border-slate-700 font-black text-sm group-hover:bg-[var(--theme-primary)]/5 transition-colors shadow-sm min-w-[220px]">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-xl bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] flex items-center justify-center shrink-0 shadow-sm overflow-hidden border border-[var(--theme-primary)]/10">
                                                                {u.image_url ? (
                                                                    <img src={u.image_url} alt={u.username} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <UserIcon />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <div className="text-gray-900 dark:text-white truncate font-bold text-xs uppercase tracking-tight leading-tight mb-1">{u.full_name || u.username}</div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="text-xs font-black text-[var(--theme-primary)] bg-[var(--theme-primary)]/10 rounded-full px-2.5 py-1 inline-block border border-[var(--theme-primary)]/20 w-fit">
                                                                        {cumScore}%
                                                                    </div>
                                                                    {reportView === 'TIME' && (
                                                                        <div className="flex gap-2 ml-1 border-l border-gray-100 dark:border-slate-700 pl-2">
                                                                            <span className="text-xs text-green-600 font-black">{formatAvg(avgInM)}</span>
                                                                            <span className="text-xs text-orange-600 font-black">{formatAvg(avgOutM)}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {Array.from({ length: daysInMonth }).map((_, i) => {
                                                        const d = i + 1;
                                                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                        const dateObj = new Date(year, month, d);
                                                        const isSunday = dateObj.getDay() === 0;

                                                        const att = masterData.attendance.find(a => String(a.userId) === String(u.id) && a.date === dateStr);
                                                        const monthLeaves = masterData.leaves.filter(lv => String(lv.userId) === String(u.id) && lv.status === 'Approved');
                                                        const isOnLeave = monthLeaves.find(lv => dateStr >= lv.startDate && dateStr <= lv.endDate);

                                                        let status = '-';
                                                        let colorClass = 'text-gray-300 dark:text-slate-700';
                                                        let points: number | null = null;

                                                        if (isSunday) {
                                                            status = 'SUN';
                                                            colorClass = 'text-gray-900 dark:text-white font-black';
                                                        } else if (att) {
                                                            if (att.inTime && att.outTime) {
                                                                const duration = (new Date(att.outTime).getTime() - new Date(att.inTime).getTime()) / 3600000;
                                                                if (duration < 5) {
                                                                    status = 'H';
                                                                    points = 0.5;
                                                                    colorClass = 'text-orange-500 font-black';
                                                                } else {
                                                                    status = 'P';
                                                                    points = 1;
                                                                    colorClass = 'text-green-500 font-black';
                                                                }
                                                            } else if (att.inTime) { // Only inTime recorded, assume present
                                                                points = 1;
                                                                status = 'P';
                                                                colorClass = 'text-green-500 font-black';
                                                            } else { // No inTime or outTime, but att record exists
                                                                status = '-';
                                                                colorClass = 'text-gray-300 dark:text-slate-700';
                                                            }
                                                        } else if (isOnLeave) {
                                                            status = 'L';
                                                            colorClass = 'text-yellow-500 font-black';
                                                        } else if (dateStr < todayStr) {
                                                            status = 'A';
                                                            points = -1;
                                                            colorClass = 'text-red-500 font-black';
                                                        }

                                                        return (
                                                            <td key={d} className={`p-2 border border-gray-200 dark:border-slate-700 text-center text-[11px] ${reportView === 'TIME' ? 'min-w-[80px]' : 'min-w-[55px]'}`}>
                                                                <div className="flex flex-col items-center gap-0.5">
                                                                    {reportView === 'STATUS' ? (
                                                                        <>
                                                                            <div className={`${colorClass} transition-all group-hover:scale-110`}>{status}</div>
                                                                            {points !== null && (
                                                                                <div className={`text-[8px] font-black px-1 rounded-sm ${points > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                                    {points > 0 ? `+${points}` : points}
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            {isSunday ? (
                                                                                <div className={`${colorClass} opacity-50 text-[10px]`}>SUN</div>
                                                                            ) : att && att.inTime ? (
                                                                                <div className="flex flex-col text-[9px] font-black leading-tight">
                                                                                    <div className="text-green-600 border-b border-gray-100 dark:border-slate-700 pb-0.5 mb-0.5">
                                                                                        {new Date(att.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                                    </div>
                                                                                    {att.outTime ? (
                                                                                        <div className="text-orange-600">
                                                                                            {new Date(att.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="text-gray-300 italic">--:--</div>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-gray-300 dark:text-slate-700 text-[10px] font-bold">{status}</div>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Leave Detail Modal */}
                {selectedLeave && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedLeave(null); }}>
                        <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/80 dark:bg-slate-900/50">
                                <h3 className="font-bold text-xl flex items-center gap-2"><StatusIcon status={selectedLeave.status} /> Leave Details</h3>
                                <button onClick={() => setSelectedLeave(null)} className="h-8 w-8 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-300 transition">&times;</button>
                            </div>

                            <div className="flex-grow overflow-hidden">
                                <div className="grid grid-cols-1 lg:grid-cols-2 h-full divide-x divide-gray-100 dark:divide-slate-700">
                                    {/* Left Column: Details */}
                                    <div className="p-8 overflow-y-auto custom-scrollbar">
                                        <div className="space-y-8">
                                            <div className="flex items-center gap-4 mb-8 p-5 rounded-3xl bg-[var(--theme-primary)]/5 border border-[var(--theme-primary)]/10 shadow-sm">
                                                <div className="h-16 w-16 rounded-2xl bg-[var(--theme-primary)] text-white flex items-center justify-center shadow-lg overflow-hidden shrink-0">
                                                    {selectedLeave.userImage ? (
                                                        <img src={selectedLeave.userImage} alt={selectedLeave.userName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="scale-125"><UserIcon /></div>
                                                    )}
                                                </div>
                                                <div className="flex-grow">
                                                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Applicant</div>
                                                    <div className="text-2xl font-black text-gray-900 dark:text-white leading-none mb-2">{selectedLeave.userName}</div>
                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${selectedLeave.status === 'Approved' ? 'bg-green-100 text-green-700' : selectedLeave.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        <StatusIcon status={selectedLeave.status} /> {selectedLeave.status}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 shadow-sm">
                                                    <div className="text-xs text-gray-400 font-bold uppercase mb-2 flex items-center gap-2 opacity-70"><CalendarIcon /> Start Date</div>
                                                    <div className="font-bold text-lg text-gray-800 dark:text-gray-200">{formatToDDMMYYYY(selectedLeave.startDate)}</div>
                                                </div>
                                                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 shadow-sm">
                                                    <div className="text-xs text-gray-400 font-bold uppercase mb-2 flex items-center gap-2 opacity-70"><CalendarIcon /> End Date</div>
                                                    <div className="font-bold text-lg text-gray-800 dark:text-gray-200">{formatToDDMMYYYY(selectedLeave.endDate)}</div>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-xs text-gray-400 font-bold uppercase mb-3 flex items-center gap-2 opacity-70">Reason provided</div>
                                                <div className="p-6 bg-gray-50 dark:bg-slate-900/80 rounded-2xl text-sm italic border-2 border-dashed border-gray-200 dark:border-slate-700 leading-relaxed text-gray-600 dark:text-gray-400">
                                                    "{selectedLeave.reason}"
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Comments & Actions */}
                                    <div className="p-8 bg-gray-50/30 dark:bg-slate-900/10 flex flex-col max-h-full">
                                        <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                                            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/30">
                                                <h4 className="font-bold text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                                    <CommentIcon /> Comments Trail
                                                    <span className="bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] text-[10px] px-2 py-0.5 rounded-full">{remarks.length}</span>
                                                </h4>
                                            </div>

                                            <div className="flex-grow p-4 overflow-y-auto custom-scrollbar space-y-4">
                                                {loadingRemarks ? (
                                                    <div className="flex justify-center items-center h-40">
                                                        <div className="w-8 h-8 border-3 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin"></div>
                                                    </div>
                                                ) : remarks.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center h-40 text-center opacity-40">
                                                        <div className="mb-2 scale-150"><CommentIcon /></div>
                                                        <div className="text-xs font-bold uppercase tracking-widest">No conversation yet</div>
                                                    </div>
                                                ) : (
                                                    remarks.map(r => (
                                                        <div key={r.id} className={`flex flex-col ${r.userName === user?.username ? 'items-end' : 'items-start'}`}>
                                                            <div className={`max-w-[90%] p-4 rounded-2xl text-sm shadow-sm transition-all duration-200 ${r.userName === user?.username
                                                                ? 'bg-[var(--theme-primary)] text-white rounded-br-none'
                                                                : 'bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-bl-none text-gray-800 dark:text-gray-200'
                                                                }`}>
                                                                <div className={`font-bold text-[10px] uppercase tracking-wider mb-1 ${r.userName === user?.username ? 'opacity-70' : 'text-[var(--theme-primary)]'}`}>
                                                                    {r.userName}
                                                                </div>
                                                                <div className="font-medium whitespace-pre-wrap">{r.comment}</div>
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 mt-1.5 px-2 flex items-center gap-1.5 font-bold uppercase tracking-tighter">
                                                                {new Date(r.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })} • {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30">
                                                <div className="flex gap-2 items-center bg-white dark:bg-slate-900 p-2 rounded-2xl border-2 border-gray-100 dark:border-slate-700 focus-within:border-[var(--theme-primary)] transition-all shadow-sm">
                                                    <input
                                                        value={newRemark}
                                                        onChange={e => setNewRemark(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleAddRemark()}
                                                        placeholder="Type your message..."
                                                        className="flex-grow p-2.5 bg-transparent outline-none text-sm font-medium text-gray-800 dark:text-gray-200 placeholder:text-gray-400"
                                                    />
                                                    <button onClick={handleAddRemark} disabled={!newRemark.trim()} className="p-3 bg-[var(--theme-primary)] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-[var(--theme-primary)]/20 transition-all hover:scale-105 active:scale-95">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Admin Actions */}
                                        {user?.role_name === 'Admin' && selectedLeave.status === 'Pending' && (
                                            <div className="mt-6 grid grid-cols-2 gap-4">
                                                <button onClick={() => handleStatusUpdate('Approved')} className="group py-4 px-6 bg-green-500 hover:bg-green-600 text-white font-black rounded-2xl shadow-xl shadow-green-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                                    <StatusIcon status="Approved" /> Approve Request
                                                </button>
                                                <button onClick={() => handleStatusUpdate('Rejected')} className="group py-4 px-6 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                                    <StatusIcon status="Rejected" /> Reject Request
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </LayoutWrapper>
    );
}

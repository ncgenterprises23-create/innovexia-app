'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import LayoutWrapper from '@/components/LayoutWrapper';
import { ensureSessionId } from '@/utils/session';
import { useToast } from '@/components/ToastProvider';
import { useLoader } from '@/components/LoaderProvider';
import DateRangePicker from '@/components/DateRangePicker';
import { formatDateToLocalTimezone } from '@/utils/timezone';
import { parseDateString } from '@/lib/dateUtils';

interface Checklist {
  id: number;
  question: string;
  assignee: string;
  doer_name: string | null;
  priority: string;
  department: string | null;
  verification_required: boolean;
  verifier_name: string | null;
  attachment_required: boolean;
  attachment_url?: string;
  frequency: string;
  due_date: string;
  status: string;
  group_id: string;
  created_at: string;
  selected_days?: string;
  selected_dates?: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  image_url?: string;
}

const DEPARTMENTS = [
  'Sales', 'Marketing', 'Human Resources', 'Finance', 'IT',
  'Operations', 'Customer Service', 'Product Development', 'Legal'
];

const PRIORITIES = [
  { value: 'high', label: 'High', color: 'bg-red-500 text-white' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500 text-white' },
  { value: 'low', label: 'Low', color: 'bg-green-500 text-white' }
];

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' }
];

function ChecklistContent() {
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteMode, setDeleteMode] = useState<'single' | 'group' | null>(null);
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);

  // Sorting and pagination states
  const [sortColumn, setSortColumn] = useState<string>('due_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTimeFilter, setActiveTimeFilter] = useState<string | null>(null);
  const [itemsPerPage] = useState(10);

  // Dropdown search states
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [doerSearch, setDoerSearch] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [verifierSearch, setVerifierSearch] = useState('');
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showDoerDropdown, setShowDoerDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showVerifierDropdown, setShowVerifierDropdown] = useState(false);

  // Multiple doers selection
  const [selectedDoers, setSelectedDoers] = useState<string[]>([]);

  // Date Time Picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  // Weekly day selection (0=Monday, 1=Tuesday, ..., 5=Saturday)
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([]);

  // Multiple dates selection for monthly/quarterly/yearly
  const [selectedMultipleDates, setSelectedMultipleDates] = useState<string[]>([]);
  const [showMultipleDatePicker, setShowMultipleDatePicker] = useState(false);
  const [multipleDatePickerDate, setMultipleDatePickerDate] = useState(new Date());

  // Refs for click-outside handling
  const assigneeRef = useRef<HTMLDivElement>(null);
  const doerRef = useRef<HTMLDivElement>(null);
  const departmentRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<HTMLDivElement>(null);

  // Custom departments management
  const [customDepartments, setCustomDepartments] = useState<string[]>([]);
  const [showAddDepartmentModal, setShowAddDepartmentModal] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');

  // Filter state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const [filterPos, setFilterPos] = useState({ top: 0, right: 0 });
  const [isMobile, setIsMobile] = useState(false);

  // Track mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [filters, setFilters] = useState({
    questions: [] as string[],
    assignees: [] as string[],
    doers: [] as string[],
    departments: [] as string[],
    priorities: [] as string[],
    statuses: [] as string[],
    frequencies: [] as string[],
    verificationRequired: null as boolean | null,
    attachmentRequired: null as boolean | null,
    dueDateFrom: '',
    dueDateTo: '',
  });
  const [showOpenTasks, setShowOpenTasks] = useState(false);
  const [filterSearches, setFilterSearches] = useState({
    question: '',
    assignee: '',
    doer: '',
    department: '',
  });
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const targetId = searchParams.get('id');

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'tile' | 'group'>('list');
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Details sidebar state
  const [showDetailsSidebar, setShowDetailsSidebar] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [taskStatus, setTaskStatus] = useState('');
  const [remarkText, setRemarkText] = useState('');
  const [remarks, setRemarks] = useState<any[]>([]);
  const [loadingRemarks, setLoadingRemarks] = useState(false);
  const [revisionHistory, setRevisionHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    question: '',
    assignee: '',
    doerName: '', // Keep for backward compatibility, but will use selectedDoers array
    priority: 'medium',
    department: '',
    verificationRequired: false,
    verifierName: '',
    attachmentRequired: false,
    frequency: 'daily',
    dueDate: ''
  });

  const router = useRouter();

  // Calendar helper functions
  const getCalendarDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const getChecklistsForDate = (date: Date) => {
    return filteredChecklists.filter((checklist: Checklist) => {
      if (!checklist.due_date) return false;

      // Parse dd/mm/yyyy HH:mm:ss format correctly
      const dateStr = checklist.due_date.replace(/^'/, '');
      const ddmmyyyyMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);

      if (!ddmmyyyyMatch) return false;

      const [_, day, month, year] = ddmmyyyyMatch;
      const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

      return dueDate.getDate() === date.getDate() &&
        dueDate.getMonth() === date.getMonth() &&
        dueDate.getFullYear() === date.getFullYear();
    });
  };

  // Helper functions for calendar
  const handleDateTimeSet = () => {
    const hour24 = selectedPeriod === 'PM' && selectedHour !== 12
      ? selectedHour + 12
      : selectedPeriod === 'AM' && selectedHour === 12
        ? 0
        : selectedHour;

    const dateTime = new Date(selectedDate);
    dateTime.setHours(hour24, selectedMinute, 0, 0);

    setFormData({
      ...formData,
      dueDate: dateTime.toISOString()
    });
    setShowDatePicker(false);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };



  // Format date for form input display (uses local time as selected by user)
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';

    // Check if it's already in ISO format or datetime-local format
    if (dateString.includes('T')) {
      // Already in correct format, just ensure it's yyyy-MM-ddTHH:mm
      return dateString.slice(0, 16);
    }

    // Parse dd/mm/yyyy HH:mm:ss format
    const ddmmyyyyMatch = dateString.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
    if (ddmmyyyyMatch) {
      const [_, day, month, year, hours, minutes] = ddmmyyyyMatch;
      // Return in yyyy-MM-ddTHH:mm format (required by datetime-local input)
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // Try parsing as Date object
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }

    return '';
  };

  // Click outside handler to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
      if (doerRef.current && !doerRef.current.contains(event.target as Node)) {
        setShowDoerDropdown(false);
      }
      if (departmentRef.current && !departmentRef.current.contains(event.target as Node)) {
        setShowDepartmentDropdown(false);
      }
      if (verifierRef.current && !verifierRef.current.contains(event.target as Node)) {
        setShowVerifierDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-open target checklist if ID is in URL
  useEffect(() => {
    if (targetId && checklists.length > 0) {
      const target = checklists.find(c => c.id.toString() === targetId);
      if (target && !selectedChecklist) {
        handleViewDetails(target);
      }
    }
  }, [targetId, checklists, selectedChecklist]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const sessionId = ensureSessionId();
        const response = await fetch('/api/auth', { headers: { 'x-session-id': sessionId } });
        const data = await response.json();

        if (!data.authenticated) {
          router.push('/login');
          return;
        }

        setUser(data.user);
        fetchUsers();
        fetchChecklists();
        fetchDepartments();
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchChecklists = async (showLoadingScreen = true) => {
    if (showLoadingScreen) {
      setLoading(true);
    }
    try {
      const response = await fetch('/api/checklists');
      const data = await response.json();
      setChecklists(data.checklists || []);
    } catch (error) {
      console.error('Error fetching checklists:', error);
    } finally {
      if (showLoadingScreen) {
        setLoading(false);
      }
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      const data = await response.json();
      setCustomDepartments(data.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const toast = useToast();
  const loader = useLoader();

  // Helper function to create notification for a user
  const createNotificationForUser = async (username: string, type: string, title: string, message: string, checklistId?: number) => {
    try {
      const usersResponse = await fetch('/api/users');
      if (usersResponse.ok) {
        const data = await usersResponse.json();
        const users = data.users || [];
        const targetUser = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
        if (targetUser) {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: targetUser.id,
              user_role: targetUser.role_name || 'Doer',
              type,
              title,
              message,
              delegation_id: checklistId,
            }),
          });
        }
      }
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim()) {
      toast.error('Please enter a department name');
      return;
    }

    const trimmedName = newDepartmentName.trim();

    // Check if department already exists in custom list
    if (customDepartments.some(dept => dept.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error('Department already exists');
      return;
    }

    loader.showLoader();

    try {
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add department');
      }

      // Refresh departments list from backend
      await fetchDepartments();

      // Set the new department as selected
      setFormData({ ...formData, department: trimmedName });

      toast.success('Department added successfully!');
      setShowAddDepartmentModal(false);
      setNewDepartmentName('');
      setShowDepartmentDropdown(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add department');
    } finally {
      loader.hideLoader();
    }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      loader.showLoader();

      // If multiple doers are selected, send as array; otherwise send single doer
      const doersToSend = selectedDoers.length > 0 ? selectedDoers : (formData.doerName ? [formData.doerName] : []);

      const response = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          doers: doersToSend, // Send array of doers
          weeklyDays: formData.frequency === 'weekly' ? selectedWeekDays : undefined,
          selectedDates: (formData.frequency === 'monthly' || formData.frequency === 'quarterly' || formData.frequency === 'yearly') ? selectedMultipleDates : undefined,
          createdBy: user?.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        loader.hideLoader();
        toast.success(`${data.count || 1} checklist task(s) created successfully!`);

        // Send notifications to assignee
        if (formData.assignee && formData.assignee !== user?.username) {
          const richInfo = `Task: ${formData.question} | Priority: ${formData.priority.toUpperCase()} | Dept: ${formData.department || 'N/A'}`;
          await createNotificationForUser(
            formData.assignee,
            'checklist_created',
            'New Checklist Assigned',
            `${user?.username || 'Someone'} assigned you a new checklist - ${richInfo}`,
            data.id
          );
        }

        // Send notifications to all doers
        for (const doer of doersToSend) {
          if (doer && doer !== user?.username && doer !== formData.assignee) {
            const richInfo = `Task: ${formData.question} | Priority: ${formData.priority.toUpperCase()} | Dept: ${formData.department || 'N/A'}`;
            await createNotificationForUser(
              doer,
              'checklist_created',
              'New Checklist Task',
              `${user?.username || 'Someone'} created a checklist task for you - ${richInfo}`,
              data.id
            );
          }
        }

        fetchChecklists(false);
        setShowAddModal(false);
        resetForm();
      } else {
        loader.hideLoader();
        toast.error('Failed to create checklist');
      }
    } catch (error) {
      console.error('Error adding checklist:', error);
      loader.hideLoader();
      toast.error('Error creating checklist');
    }
  };

  const handleEditChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChecklist) return;

    try {
      loader.showLoader();

      // Update all checklists with the same group_id
      const response = await fetch('/api/checklists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: editingChecklist.group_id,
          question: formData.question,
          assignee: formData.assignee,
          doerName: formData.doerName,
          priority: formData.priority,
          department: formData.department,
          verificationRequired: formData.verificationRequired,
          verifierName: formData.verifierName,
          attachmentRequired: formData.attachmentRequired
        })
      });

      if (response.ok) {
        const result = await response.json();
        loader.hideLoader();
        toast.success(`${result.updated || 1} checklist(s) updated successfully!`);

        // Send notifications to assignee and doer
        if (formData.assignee && formData.assignee !== user?.username) {
          await createNotificationForUser(
            formData.assignee,
            'checklist_updated',
            'Checklist Updated',
            `${user?.username || 'Someone'} updated checklist: "${formData.question}"`,
            editingChecklist.id
          );
        }
        if (formData.doerName && formData.doerName !== user?.username && formData.doerName !== formData.assignee) {
          await createNotificationForUser(
            formData.doerName,
            'checklist_updated',
            'Checklist Updated',
            `${user?.username || 'Someone'} updated checklist: "${formData.question}"`,
            editingChecklist.id
          );
        }

        fetchChecklists(false);
        setShowEditModal(false);
        setEditingChecklist(null);
        resetForm();
      } else {
        loader.hideLoader();
        toast.error('Failed to update checklist');
      }
    } catch (error) {
      console.error('Error updating checklist:', error);
      loader.hideLoader();
      toast.error('Error updating checklist');
    }
  };

  const handleDeleteChecklist = async () => {
    if (!deleteId || !deleteMode) return;

    try {
      loader.showLoader();
      const checklist = checklists.find(c => c.id === deleteId);

      if (deleteMode === 'single') {
        // Delete only the specific task
        const response = await fetch(`/api/checklists?id=${deleteId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          loader.hideLoader();
          toast.success('Checklist task deleted successfully!');

          // Send notifications to assignee and doer
          if (checklist) {
            if (checklist.assignee && checklist.assignee !== user?.username) {
              await createNotificationForUser(
                checklist.assignee,
                'checklist_deleted',
                'Checklist Deleted',
                `${user?.username || 'Someone'} deleted checklist: "${checklist.question}"`,
                checklist.id
              );
            }
            if (checklist.doer_name && checklist.doer_name !== user?.username && checklist.doer_name !== checklist.assignee) {
              await createNotificationForUser(
                checklist.doer_name,
                'checklist_deleted',
                'Checklist Deleted',
                `${user?.username || 'Someone'} deleted checklist: "${checklist.question}"`,
                checklist.id
              );
            }
          }

          fetchChecklists(false);
          setShowDeleteModal(false);
          setDeleteId(null);
          setDeleteMode(null);
        } else {
          loader.hideLoader();
          toast.error('Failed to delete checklist task');
        }
      } else if (deleteMode === 'group' && checklist) {
        // Delete all tasks with the same group_id
        const groupId = checklist.group_id;
        const tasksToDelete = checklists.filter(c => c.group_id === groupId);

        // Delete all tasks in the group
        const deletePromises = tasksToDelete.map(task =>
          fetch(`/api/checklists?id=${task.id}`, {
            method: 'DELETE'
          })
        );

        await Promise.all(deletePromises);

        loader.hideLoader();
        toast.success(`${tasksToDelete.length} checklist task(s) deleted successfully!`);

        // Send notification
        if (checklist.assignee && checklist.assignee !== user?.username) {
          await createNotificationForUser(
            checklist.assignee,
            'checklist_deleted',
            'Group Checklist Deleted',
            `${user?.username || 'Someone'} deleted ${tasksToDelete.length} tasks from group: "${checklist.question}"`,
            checklist.id
          );
        }

        fetchChecklists(false);
        setShowDeleteModal(false);
        setDeleteId(null);
        setDeleteMode(null);
      }
    } catch (error) {
      console.error('Error deleting checklist:', error);
      loader.hideLoader();
      toast.error('Error deleting checklist');
    }
  };

  const handleViewDetails = async (checklist: Checklist) => {
    setSelectedChecklist(checklist);
    setTaskStatus(checklist.status || '');
    setRemarkText('');
    setRemarks([]);
    setRevisionHistory([]);
    setAttachmentFile(null);

    // Open sidebar immediately
    setShowDetailsSidebar(true);

    // Fetch remarks and revision history in parallel
    setLoadingRemarks(true);
    setLoadingHistory(true);

    try {
      const [remarksRes, historyRes] = await Promise.all([
        fetch(`/api/checklists/remarks?checklistId=${checklist.id}`),
        fetch(`/api/checklists/history?checklistId=${checklist.id}`)
      ]);

      if (remarksRes.ok) {
        const remarksData = await remarksRes.json();
        setRemarks(remarksData.remarks || []);
      }
      setLoadingRemarks(false);

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setRevisionHistory(historyData.history || []);
      }
      setLoadingHistory(false);
    } catch (error) {
      console.error('Error fetching details:', error);
      setLoadingRemarks(false);
      setLoadingHistory(false);
      toast.error('Failed to load some data. Please try again.');
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedChecklist || !taskStatus) {
      toast.error('Please select a status');
      return;
    }

    // Check if attachment is required but not provided (for approval_waiting OR completed)
    if (selectedChecklist.attachment_required && (taskStatus === 'approval_waiting' || taskStatus === 'completed') && !attachmentFile) {
      toast.error(`Please attach the required file for ${taskStatus === 'approval_waiting' ? 'Approval Waiting' : 'Completed'} status`);
      return;
    }

    try {
      loader.showLoader();

      // Upload attachment if file is selected (for ANY status update where file is provided)
      let attachmentUrl = null;
      if (attachmentFile) {
        setUploadingAttachment(true);
        const formData = new FormData();
        formData.append('file', attachmentFile);
        formData.append('type', 'checklist');

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!uploadResponse.ok) {
          setUploadingAttachment(false);
          loader.hideLoader();
          toast.error('Failed to upload attachment');
          return;
        }

        const uploadData = await uploadResponse.json();
        attachmentUrl = uploadData.url;
        setUploadingAttachment(false);
      }

      // Update status
      const response = await fetch('/api/checklists/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklistId: selectedChecklist.id,
          status: taskStatus,
          remark: remarkText,
          userId: user?.id,
          username: user?.username,
          attachmentUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        loader.hideLoader();
        toast.error(errorData.error || 'Failed to update status');
        return;
      }

      // Update checklist in the list
      const updatedChecklists = checklists.map(c =>
        c.id === selectedChecklist.id
          ? { ...c, status: taskStatus }
          : c
      );
      setChecklists(updatedChecklists);

      // Update selected checklist for sidebar
      const updatedChecklist = {
        ...selectedChecklist,
        status: taskStatus
      };
      setSelectedChecklist(updatedChecklist);

      // Refresh remarks and history
      const [remarksRes, historyRes] = await Promise.all([
        fetch(`/api/checklists/remarks?checklistId=${selectedChecklist.id}`),
        fetch(`/api/checklists/history?checklistId=${selectedChecklist.id}`)
      ]);

      if (remarksRes.ok) {
        const remarksData = await remarksRes.json();
        setRemarks(remarksData.remarks || []);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setRevisionHistory(historyData.history || []);
      }

      // Clear form
      setRemarkText('');
      setTaskStatus('');
      setAttachmentFile(null);

      // Send notification to assignee
      if (selectedChecklist.assignee && selectedChecklist.assignee !== user?.username) {
        const richInfo = `Status: ${taskStatus.toUpperCase()} | Task: ${selectedChecklist.question} | Priority: ${selectedChecklist.priority.toUpperCase()}`;
        await createNotificationForUser(
          selectedChecklist.assignee,
          'checklist_updated',
          'Checklist Status Updated',
          `${user?.username || 'Someone'} updated checklist status - ${richInfo}`,
          selectedChecklist.id
        );
      }

      loader.hideLoader();
      toast.success('Status updated successfully!');
    } catch (error) {
      console.error('Error updating status:', error);
      loader.hideLoader();
      toast.error('Error updating status');
    }
  };

  const handleAddRemark = async () => {
    if (!selectedChecklist || !remarkText.trim()) {
      toast.error('Please enter a remark');
      return;
    }

    try {
      loader.showLoader();

      const response = await fetch('/api/checklists/remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklistId: selectedChecklist.id,
          userId: user?.id,
          remark: remarkText,
          username: user?.username
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        loader.hideLoader();
        toast.error(errorData.error || 'Failed to add remark');
        return;
      }

      // Clear remark text immediately
      setRemarkText('');

      // Refresh remarks
      const remarksResponse = await fetch(`/api/checklists/remarks?checklistId=${selectedChecklist.id}`);
      if (remarksResponse.ok) {
        const remarksData = await remarksResponse.json();
        setRemarks(remarksData.remarks || []);
      }

      // Send notification
      if (selectedChecklist.assignee && selectedChecklist.assignee.toLowerCase() !== user?.username?.toLowerCase()) {
        await createNotificationForUser(
          selectedChecklist.assignee,
          'checklist_remark',
          'New Checklist Remark',
          `${user?.username || 'Someone'} added a remark to: ${selectedChecklist.question}`,
          selectedChecklist.id
        );
      }

      loader.hideLoader();
      toast.success('Remark added successfully!');
    } catch (error) {
      console.error('Error adding remark:', error);
      loader.hideLoader();
      toast.error('Error adding remark');
    }
  };

  const openEditModal = (checklist: Checklist) => {
    setEditingChecklist(checklist);
    setFormData({
      question: checklist.question,
      assignee: checklist.assignee,
      doerName: checklist.doer_name || '',
      priority: checklist.priority,
      department: checklist.department || '',
      verificationRequired: checklist.verification_required,
      verifierName: checklist.verifier_name || '',
      attachmentRequired: checklist.attachment_required,
      frequency: checklist.frequency,
      dueDate: checklist.due_date
    });

    // Parse and populate selected days/dates based on frequency
    if (checklist.frequency === 'weekly' && checklist.selected_days) {
      // Parse selected days for weekly tasks
      try {
        const days = JSON.parse(checklist.selected_days);
        setSelectedWeekDays(Array.isArray(days) ? days : []);
      } catch (e) {
        setSelectedWeekDays([]);
      }
    } else {
      setSelectedWeekDays([]);
    }

    if ((checklist.frequency === 'monthly' || checklist.frequency === 'quarterly' || checklist.frequency === 'yearly') && checklist.selected_dates) {
      // Parse selected dates for monthly/quarterly/yearly tasks
      try {
        const dates = JSON.parse(checklist.selected_dates);
        setSelectedMultipleDates(Array.isArray(dates) ? dates : []);
      } catch (e) {
        setSelectedMultipleDates([]);
      }
    } else if (checklist.frequency !== 'weekly') {
      setSelectedMultipleDates([]);
    }

    setShowEditModal(true);
  };

  const openDeleteModal = (id: number) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setFormData({
      question: '',
      assignee: '',
      doerName: '',
      priority: 'medium',
      department: '',
      verificationRequired: false,
      verifierName: '',
      attachmentRequired: false,
      frequency: 'daily',
      dueDate: ''
    });
    setSelectedWeekDays([]);
    setSelectedMultipleDates([]);
    setShowMultipleDatePicker(false);
    setSelectedDoers([]);
  };

  const getUserImage = (username: string) => {
    const user = users.find(u => u.username === username);
    return user?.image_url || null;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'overdue': return 'bg-red-500 text-white';
      case 'pending': return 'bg-yellow-500 text-white';
      case 'planned': return 'bg-blue-500 text-white';
      case 'completed': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Filter helper functions
  const handleFilterClick = () => {
    if (filterBtnRef.current) {
      const rect = filterBtnRef.current.getBoundingClientRect();
      setFilterPos({ top: rect.bottom + 12, right: window.innerWidth - rect.right });
    }
    setShowFilterModal(true);
  };

  const clearAllFilters = () => {
    setFilters({
      questions: [],
      assignees: [],
      doers: [],
      departments: [],
      priorities: [],
      statuses: [],
      frequencies: [],
      verificationRequired: null,
      attachmentRequired: null,
      dueDateFrom: '',
      dueDateTo: '',
    });
    setCurrentPage(1);
  };

  const toggleFilterValue = (type: keyof typeof filters, value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      const arrayKey = type as 'questions' | 'assignees' | 'doers' | 'departments' | 'priorities' | 'statuses' | 'frequencies';
      const currentArray = newFilters[arrayKey] as string[];

      if (currentArray.includes(value)) {
        newFilters[arrayKey] = currentArray.filter(v => v !== value) as any;
      } else {
        newFilters[arrayKey] = [...currentArray, value] as any;
      }
      return newFilters;
    });
  };

  const removeFilter = (type: string, value?: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      switch (type) {
        case 'question':
          newFilters.questions = prev.questions.filter(v => v !== value);
          break;
        case 'assignee':
          newFilters.assignees = prev.assignees.filter(v => v !== value);
          break;
        case 'doer':
          newFilters.doers = prev.doers.filter(v => v !== value);
          break;
        case 'department':
          newFilters.departments = prev.departments.filter(v => v !== value);
          break;
        case 'priority':
          newFilters.priorities = prev.priorities.filter(v => v !== value);
          break;
        case 'status':
          newFilters.statuses = prev.statuses.filter(v => v !== value);
          break;
        case 'frequency':
          newFilters.frequencies = prev.frequencies.filter(v => v !== value);
          break;
        case 'verification':
          newFilters.verificationRequired = null;
          break;
        case 'attachment':
          newFilters.attachmentRequired = null;
          break;
        case 'dateRange':
          newFilters.dueDateFrom = '';
          newFilters.dueDateTo = '';
          break;
      }
      return newFilters;
    });
    setCurrentPage(1);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking inside filter modal content
      if (!target.closest('.filter-dropdown-container')) {
        setActiveDropdown(null);
      }
    };

    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeDropdown]);

  const handleExportCSV = () => {
    try {
      // Define CSV headers
      const headers = [
        'ID',
        'Question/Task',
        'Assignee',
        'Doer',
        'Priority',
        'Department',
        'Frequency',
        'Due Date',
        'Status',
        'Verification Required',
        'Verifier',
        'Attachment Required',
        'Created Date'
      ];

      // Convert data to CSV rows
      const rows = filteredChecklists.map((checklist: Checklist) => {
        return [
          checklist.id || '',
          checklist.question || '',
          checklist.assignee || '',
          checklist.doer_name || '',
          checklist.priority || '',
          checklist.department || '',
          checklist.frequency || '',
          checklist.due_date ? formatDateToLocalTimezone(checklist.due_date) : '',
          checklist.status || '',
          checklist.verification_required ? 'Yes' : 'No',
          checklist.verifier_name || '',
          checklist.attachment_required ? 'Yes' : 'No',
          checklist.created_at ? formatDateToLocalTimezone(checklist.created_at) : ''
        ].map(field => {
          // Escape double quotes and wrap in quotes if contains comma, newline, or quote
          const escaped = String(field).replace(/"/g, '""');
          return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
        }).join(',');
      });

      // Combine headers and rows
      const csv = [headers.join(','), ...rows].join('\n');

      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `checklists_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${filteredChecklists.length} checklists to CSV`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV. Please try again.');
    }
  };

  // Merge static and custom departments
  const allDepartments = useMemo(() => {
    return [...DEPARTMENTS, ...customDepartments].sort();
  }, [customDepartments]);

  // Get unique values for filters
  const uniqueQuestions = useMemo(() => Array.from(new Set(checklists.map(c => c.question).filter(Boolean))).sort(), [checklists]);
  const uniqueAssignees = useMemo(() => Array.from(new Set(checklists.map(c => c.assignee).filter(Boolean))).sort(), [checklists]);
  const uniqueDoers = useMemo(() => Array.from(new Set(checklists.map(c => c.doer_name).filter(Boolean))).sort(), [checklists]);
  const uniqueDepartments = useMemo(() => Array.from(new Set(checklists.map(c => c.department).filter(Boolean))).sort(), [checklists]);
  const uniqueStatuses = useMemo(() => Array.from(new Set(checklists.map(c => c.status).filter(Boolean))).sort(), [checklists]);
  const uniqueFrequencies = useMemo(() => Array.from(new Set(checklists.map(c => c.frequency).filter(Boolean))).sort(), [checklists]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.questions.length > 0) count++;
    if (filters.assignees.length > 0) count++;
    if (filters.doers.length > 0) count++;
    if (filters.departments.length > 0) count++;
    if (filters.priorities.length > 0) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.frequencies.length > 0) count++;
    if (filters.verificationRequired !== null) count++;
    if (filters.attachmentRequired !== null) count++;
    if (filters.dueDateFrom || filters.dueDateTo) count++;
    return count;
  }, [filters]);

  // Calculate open tasks count
  const openTasksCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return checklists.filter(checklist => {
      // Parse the date from dd/mm/yyyy HH:mm:ss format
      let dueDate = null;
      if (checklist.due_date) {
        const dateStr = checklist.due_date.replace(/^'/, '');
        const ddmmyyyyMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (ddmmyyyyMatch) {
          const [_, day, month, year] = ddmmyyyyMatch;
          dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          dueDate.setHours(0, 0, 0, 0);
        }
      }

      const status = checklist.status?.toLowerCase() || '';

      // Must have a due date that is today or in the past
      if (!dueDate || dueDate > today) {
        return false;
      }

      // Must not be completed
      if (status === 'completed') {
        return false;
      }

      return true;
    }).length;
  }, [checklists]);

  // Calculate status counts for status tiles
  const statusCounts = useMemo(() => {
    const counts = {
      overdue: 0,
      pending: 0,
      planned: 0,
      completed: 0,
      approval_waiting: 0,
      total: checklists.length
    };

    checklists.forEach(checklist => {
      const status = checklist.status?.toLowerCase() || '';
      switch (status) {
        case 'overdue':
          counts.overdue++;
          break;
        case 'pending':
          counts.pending++;
          break;
        case 'planned':
          counts.planned++;
          break;
        case 'completed':
          counts.completed++;
          break;
        case 'approval_waiting':
          counts.approval_waiting++;
      }
    });

    return counts;
  }, [checklists]);

  const timeStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const stats = { 'Delayed': 0, 'Today': 0, 'Tomorrow': 0, 'Next 3': 0, 'Next 7': 0, 'Next 15': 0 };

    checklists.forEach(c => {
      if (c.status?.toLowerCase() === 'completed') return;
      if (!c.due_date) return;

      const pDate = parseDateString(c.due_date);
      if (!pDate) return;
      const pTime = pDate.getTime();
      const pDayStart = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();
      const diffDays = Math.round((pDayStart - todayStart) / oneDayMs);

      if (pTime < now.getTime()) stats['Delayed']++;
      if (diffDays === 0) stats['Today']++;
      if (diffDays === 1) stats['Tomorrow']++;
      if (diffDays >= 0 && diffDays <= 3) stats['Next 3']++;
      if (diffDays >= 0 && diffDays <= 7) stats['Next 7']++;
      if (diffDays >= 0 && diffDays <= 15) stats['Next 15']++;
    });

    return stats;
  }, [checklists]);

  const filteredChecklists = useMemo(() => {
    // Priority 1: Deep Link Filter
    // If targetId is present, only show the checklist matching that ID
    if (targetId) {
      return checklists.filter(checklist => checklist.id.toString() === targetId);
    }

    let filtered = checklists.filter(checklist => {
      // Open Tasks filter: due today or overdue, and status NOT completed
      if (showOpenTasks) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Parse the date from dd/mm/yyyy HH:mm:ss format
        let dueDate = null;
        if (checklist.due_date) {
          const dateStr = checklist.due_date.replace(/^'/, ''); // Remove leading quote if present
          const ddmmyyyyMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (ddmmyyyyMatch) {
            const [_, day, month, year] = ddmmyyyyMatch;
            dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            dueDate.setHours(0, 0, 0, 0);
          }
        }

        const status = checklist.status?.toLowerCase() || '';

        // Must have a due date that is today or in the past
        if (!dueDate || dueDate > today) {
          return false;
        }

        // Must not be completed
        if (status === 'completed') {
          return false;
        }
      }

      // Search term filter
      const matchesSearch = searchTerm === '' ||
        checklist.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checklist.assignee.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (checklist.doer_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (checklist.department?.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Question filter
      if (filters.questions.length > 0 && !filters.questions.includes(checklist.question)) {
        return false;
      }

      // Assignee filter
      if (filters.assignees.length > 0 && !filters.assignees.includes(checklist.assignee)) {
        return false;
      }

      // Doer filter
      if (filters.doers.length > 0 && !filters.doers.includes(checklist.doer_name || '')) {
        return false;
      }

      // Department filter
      if (filters.departments.length > 0 && !filters.departments.includes(checklist.department || '')) {
        return false;
      }

      // Priority filter
      if (filters.priorities.length > 0 && !filters.priorities.includes(checklist.priority)) {
        return false;
      }

      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(checklist.status || '')) {
        return false;
      }

      // Frequency filter
      if (filters.frequencies.length > 0 && !filters.frequencies.includes(checklist.frequency)) {
        return false;
      }

      // Verification required filter
      if (filters.verificationRequired !== null) {
        if (checklist.verification_required !== filters.verificationRequired) {
          return false;
        }
      }

      // Attachment required filter
      if (filters.attachmentRequired !== null) {
        if (checklist.attachment_required !== filters.attachmentRequired) {
          return false;
        }
      }

      // Due date range filter
      if (filters.dueDateFrom || filters.dueDateTo) {
        if (!checklist.due_date) {
          // If date range filter is active but checklist has no due date, exclude it
          return false;
        }

        // Parse dd/mm/yyyy format correctly
        const dateStr = checklist.due_date.replace(/^'/, '');
        const ddmmyyyyMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);

        if (!ddmmyyyyMatch) {
          // If due date doesn't match expected format, exclude it
          return false;
        }

        const [_, day, month, year] = ddmmyyyyMatch;
        const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        dueDate.setHours(0, 0, 0, 0);

        if (filters.dueDateFrom) {
          const fromDate = new Date(filters.dueDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (dueDate < fromDate) return false;
        }

        if (filters.dueDateTo) {
          const toDate = new Date(filters.dueDateTo);
          toDate.setHours(23, 59, 59, 999); // End of day
          if (dueDate > toDate) return false;
        }
      }

      // Time-Based Filter (Quick Filters)
      if (activeTimeFilter) {
        if (!checklist.due_date || checklist.status?.toLowerCase() === 'completed') return false;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        const pDate = parseDateString(checklist.due_date);
        if (!pDate) return false;
        const pTime = pDate.getTime();
        const pDayStart = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();
        const diffDays = Math.round((pDayStart - todayStart) / oneDayMs);

        switch (activeTimeFilter) {
          case 'Delayed': if (pTime >= now.getTime()) return false; break;
          case 'Today': if (diffDays !== 0) return false; break;
          case 'Tomorrow': if (diffDays !== 1) return false; break;
          case 'Next 3': if (!(diffDays >= 0 && diffDays <= 3)) return false; break;
          case 'Next 7': if (!(diffDays >= 0 && diffDays <= 7)) return false; break;
          case 'Next 15': if (!(diffDays >= 0 && diffDays <= 15)) return false; break;
        }
      }

      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any = a[sortColumn as keyof Checklist];
      let bVal: any = b[sortColumn as keyof Checklist];

      // Handle null/undefined values
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      // Convert to comparable values
      if (sortColumn === 'id') {
        // Convert IDs to numbers for proper numeric sorting
        aVal = Number(aVal);
        bVal = Number(bVal);
      } else if (sortColumn === 'due_date' || sortColumn === 'created_at') {
        // Parse dd/mm/yyyy HH:mm:ss format to Date
        const parseDate = (dateStr: string) => {
          if (!dateStr) return 0;
          const [datePart, timePart] = dateStr.split(', ');
          if (!datePart) return 0;
          const [day, month, year] = datePart.split('/');
          const [hours = '0', minutes = '0', seconds = '0'] = (timePart || '00:00:00').split(':');
          return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds)).getTime();
        };
        aVal = parseDate(aVal);
        bVal = parseDate(bVal);
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [checklists, searchTerm, sortColumn, sortDirection, showOpenTasks, filters, targetId, activeTimeFilter]);

  // Group view - show only first checklist per group_id
  const groupedChecklists = useMemo(() => {
    const groups = new Map<string, Checklist>();

    filteredChecklists.forEach(checklist => {
      const groupId = checklist.group_id || 'no-group';
      if (!groups.has(groupId)) {
        groups.set(groupId, checklist);
      }
    });

    return Array.from(groups.values());
  }, [filteredChecklists]);

  // Pagination logic
  const totalPages = Math.ceil((viewMode === 'group' ? groupedChecklists.length : filteredChecklists.length) / itemsPerPage);
  const paginatedChecklists = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const sourceList = viewMode === 'group' ? groupedChecklists : filteredChecklists;
    return sourceList.slice(startIndex, endIndex);
  }, [filteredChecklists, groupedChecklists, currentPage, itemsPerPage, viewMode]);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  if (loading) {
    return (
      <LayoutWrapper>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading checklists...</p>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
      <div className="p-4 space-y-4">
        {/* Header */}
        <motion.div
          className="flex flex-col md:flex-row md:justify-between md:items-center gap-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Checklists</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage recurring tasks with automated scheduling</p>
          </div>

          {targetId && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/30 px-4 py-2 rounded-xl"
            >
              <span className="text-sm font-bold text-gray-900 dark:text-white">Viewing Single Task</span>
              <button
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('id');
                  router.push(url.pathname);
                }}
                className="text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 rounded-lg font-bold hover:scale-105 transition active:scale-95 shadow-sm"
              >
                Show All Tasks
              </button>
            </motion.div>
          )}

          <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 md:overflow-x-visible" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
            {/* Filters Button with Count Badge - Moved to front on mobile */}
            <div className="relative flex-shrink-0 md:order-2">
              <button
                ref={filterBtnRef}
                onClick={handleFilterClick}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span className="hidden sm:inline">Filters</span>
              </button>
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[var(--theme-primary)] text-gray-900 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </div>

            {/* Add Button - Moved to front on mobile */}
            <motion.button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] text-gray-900 font-semibold py-2 px-4 rounded-lg shadow-sm transition flex-shrink-0 md:order-last"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Add New Checklist</span>
            </motion.button>

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-1 flex-shrink-0 md:order-1">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition ${viewMode === 'list'
                  ? 'bg-[var(--theme-primary)] text-gray-900 font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode('tile')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition ${viewMode === 'tile'
                  ? 'bg-[var(--theme-primary)] text-gray-900 font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                <span className="hidden sm:inline">Tiles</span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition ${viewMode === 'calendar'
                  ? 'bg-[var(--theme-primary)] text-gray-900 font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Calendar</span>
              </button>
              <button
                onClick={() => setViewMode('group')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition ${viewMode === 'group'
                  ? 'bg-[var(--theme-primary)] text-gray-900 font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="hidden sm:inline">Groups</span>
              </button>
            </div>


            {/* Export CSV Button */}
            <motion.button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm flex-shrink-0 md:order-3"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Export CSV</span>
            </motion.button>

            {/* Open Tasks Button */}
            <div className="relative flex-shrink-0 md:order-4">
              <motion.button
                onClick={() => setShowOpenTasks(!showOpenTasks)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition shadow-sm ${showOpenTasks
                  ? 'bg-[var(--theme-primary)] border-[var(--theme-secondary)] text-gray-900 font-semibold'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="hidden sm:inline">Open Tasks</span>
              </motion.button>
              {openTasksCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {openTasksCount}
                </span>
              )}
            </div>

          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-300 dark:border-gray-700 overflow-hidden"
        >
          {/* List View */}
          {viewMode === 'list' && (
            <>
              {/* Pagination Row Above Table */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap">
                    Showing <span className="text-gray-900 dark:text-white">{((currentPage - 1) * itemsPerPage) + 1}</span>-<span className="text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredChecklists.length)}</span> of <span className="text-gray-900 dark:text-white">{filteredChecklists.length}</span>
                  </p>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {(['Delayed', 'Today', 'Tomorrow', 'Next 3', 'Next 7', 'Next 15'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => { setActiveTimeFilter(activeTimeFilter === filter ? null : filter); setCurrentPage(1); }}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap relative border ${activeTimeFilter === filter
                          ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)] shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]'
                          }`}
                      >
                        {filter}
                        {timeStats[filter] > 0 && (
                          <sup className={`ml-1 text-[8px] ${activeTimeFilter === filter ? 'text-white/80' : (filter === 'Delayed' ? 'text-red-500' : 'text-[var(--theme-primary)]')}`}>
                            {timeStats[filter]}
                          </sup>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    PREV
                  </button>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                    PAGE {currentPage} / {totalPages}
                  </span>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    NEXT
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="whitespace-nowrap">
                    <tr className="bg-[var(--theme-primary)] border-b border-gray-200 dark:border-gray-600">
                      <th onClick={() => handleSort('id')} className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-[var(--theme-secondary)] transition-colors">
                        <div className="flex items-center gap-2">
                          ID
                          {sortColumn === 'id' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th onClick={() => handleSort('question')} className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-[var(--theme-secondary)] transition-colors w-full min-w-[400px]">
                        <div className="flex items-center gap-2">
                          Question/Task
                          {sortColumn === 'question' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th onClick={() => handleSort('assignee')} className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-[var(--theme-secondary)] transition-colors">
                        <div className="flex items-center gap-2">
                          Assignee
                          {sortColumn === 'assignee' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th onClick={() => handleSort('doer_name')} className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-[var(--theme-secondary)] transition-colors">
                        <div className="flex items-center gap-2">
                          Doer
                          {sortColumn === 'doer_name' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th onClick={() => handleSort('priority')} className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-[var(--theme-secondary)] transition-colors">
                        <div className="flex items-center gap-2">
                          Priority
                          {sortColumn === 'priority' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th onClick={() => handleSort('department')} className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-[var(--theme-secondary)] transition-colors">
                        <div className="flex items-center gap-2">
                          Department
                          {sortColumn === 'department' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th onClick={() => handleSort('frequency')} className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-[var(--theme-secondary)] transition-colors">
                        <div className="flex items-center gap-2">
                          Frequency
                          {sortColumn === 'frequency' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th onClick={() => handleSort('due_date')} className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-[var(--theme-secondary)] transition-colors">
                        <div className="flex items-center gap-2">
                          Due Date
                          {sortColumn === 'due_date' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th onClick={() => handleSort('status')} className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-[var(--theme-secondary)] transition-colors">
                        <div className="flex items-center gap-2">
                          Status
                          {sortColumn === 'status' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Verification</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 whitespace-nowrap">
                    {paginatedChecklists.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-secondary)] rounded-full flex items-center justify-center mb-4 text-3xl">
                              📋
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">No checklists found</p>
                            <p className="text-gray-400 dark:text-gray-500 text-sm">Create your first checklist to get started</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedChecklists.map((checklist) => (
                        <motion.tr
                          key={checklist.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          whileHover={{ backgroundColor: 'rgba(244, 210, 74, 0.05)' }}
                          className="transition-colors"
                        >
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                              #{checklist.id}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900 dark:text-white whitespace-normal break-words">
                              {checklist.question}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {getUserImage(checklist.assignee) ? (
                                <img src={`/api/image-proxy?url=${encodeURIComponent(getUserImage(checklist.assignee)!)}`} alt={checklist.assignee} className="w-8 h-8 rounded-full object-cover border-2 border-[var(--theme-primary)]" />
                              ) : (
                                <div className="w-8 h-8 bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-secondary)] rounded-full flex items-center justify-center text-sm font-bold text-gray-900 shadow-md">
                                  {checklist.assignee[0]?.toUpperCase() || '?'}
                                </div>
                              )}
                              <span className="text-gray-900 dark:text-white">{checklist.assignee}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {checklist.doer_name ? (
                              <div className="flex items-center gap-2">
                                {getUserImage(checklist.doer_name) ? (
                                  <img src={`/api/image-proxy?url=${encodeURIComponent(getUserImage(checklist.doer_name)!)}`} alt={checklist.doer_name} className="w-8 h-8 rounded-full object-cover border-2 border-[var(--theme-primary)]" />
                                ) : (
                                  <div className="w-8 h-8 bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-secondary)] rounded-full flex items-center justify-center text-sm font-bold text-gray-900 shadow-md">
                                    {checklist.doer_name[0]?.toUpperCase() || '?'}
                                  </div>
                                )}
                                <span className="text-gray-900 dark:text-white">{checklist.doer_name}</span>
                              </div>
                            ) : (
                              <span className="text-gray-500 dark:text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(checklist.priority)}`}>
                              {checklist.priority?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-900 dark:text-white">
                            {checklist.department || 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                              {checklist.frequency}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <p className="text-gray-900 dark:text-white font-medium">
                                {formatDateToLocalTimezone(checklist.due_date)}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(checklist.status)}`}>
                              {checklist.status?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {checklist.verification_required ? (
                              <div className="text-sm">
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium mb-1">
                                  ✓ Required
                                </span>
                                {checklist.verifier_name && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    By: {checklist.verifier_name}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">Not Required</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleViewDetails(checklist)}
                                className="p-2 text-[var(--theme-primary)] hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 rounded-lg transition"
                                title="View Details"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => openDeleteModal(checklist.id)}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                title="Delete"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls Removed from bottom */}
            </>
          )}

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <div className="p-6">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newDate = new Date(calendarDate);
                      newDate.setMonth(newDate.getMonth() - 1);
                      setCalendarDate(newDate);
                    }}
                    className="p-2 hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCalendarDate(new Date())}
                    className="px-4 py-2 bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] text-gray-900 font-semibold rounded-lg transition text-sm"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      const newDate = new Date(calendarDate);
                      newDate.setMonth(newDate.getMonth() + 1);
                      setCalendarDate(newDate);
                    }}
                    className="p-2 hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Day Headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-semibold text-gray-600 dark:text-gray-400 py-2 text-sm">
                    {day}
                  </div>
                ))}

                {/* Calendar Days */}
                {(() => {
                  const { daysInMonth, startingDayOfWeek } = getCalendarDays(
                    calendarDate.getFullYear(),
                    calendarDate.getMonth()
                  );
                  const days = [];

                  // Empty cells before first day
                  for (let i = 0; i < startingDayOfWeek; i++) {
                    days.push(<div key={`empty-${i}`} className="h-44 bg-gray-50 dark:bg-gray-900 rounded-lg" />);
                  }

                  // Days of the month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                    const checklistsForDay = getChecklistsForDate(date);
                    const isToday =
                      date.getDate() === new Date().getDate() &&
                      date.getMonth() === new Date().getMonth() &&
                      date.getFullYear() === new Date().getFullYear();

                    days.push(
                      <div
                        key={day}
                        className={`h-44 rounded-lg border-2 p-2 overflow-hidden ${isToday
                          ? 'border-[var(--theme-primary)] bg-[var(--theme-light)] dark:bg-gray-800'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-semibold ${isToday
                            ? 'text-[var(--theme-primary)]'
                            : 'text-gray-900 dark:text-white'
                            }`}>
                            {day}
                          </span>
                          {checklistsForDay.length > 0 && (
                            <span className="text-xs bg-[var(--theme-primary)] text-gray-900 px-1.5 py-0.5 rounded-full font-bold">
                              {checklistsForDay.length}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 overflow-y-auto max-h-36">
                          {checklistsForDay.map((checklist: Checklist) => (
                            <motion.div
                              key={checklist.id}
                              whileHover={{ scale: 1.02 }}
                              className="group relative"
                            >
                              <div
                                className={`text-xs p-1.5 rounded cursor-pointer ${getStatusColor(checklist.status)} hover:shadow-md transition`}
                                onClick={() => handleViewDetails(checklist)}
                              >
                                <div className="font-semibold truncate text-white">
                                  {checklist.question}
                                </div>
                                <div className="text-[10px] opacity-90 truncate text-white">
                                  {checklist.assignee}
                                </div>
                              </div>

                              {/* Action buttons on hover */}
                              <div className="absolute top-0 right-0 hidden group-hover:flex gap-1 bg-white dark:bg-gray-700 rounded shadow-lg p-1 z-10">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetails(checklist);
                                  }}
                                  className="p-1 text-[var(--theme-primary)] hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-600 rounded"
                                  title="View Details"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteModal(checklist.id);
                                  }}
                                  className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return days;
                })()}
              </div>
            </div>
          )}

          {/* Tile View */}
          {viewMode === 'tile' && (
            <div className="p-4">
              {/* Pagination Row Above Tiles */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar mb-4">
                <div className="flex items-center gap-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap">
                    Showing <span className="text-gray-900 dark:text-white">{((currentPage - 1) * itemsPerPage) + 1}</span>-<span className="text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredChecklists.length)}</span> of <span className="text-gray-900 dark:text-white">{filteredChecklists.length}</span>
                  </p>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {(['Delayed', 'Today', 'Tomorrow', 'Next 3', 'Next 7', 'Next 15'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => { setActiveTimeFilter(activeTimeFilter === filter ? null : filter); setCurrentPage(1); }}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap relative border ${activeTimeFilter === filter
                          ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)] shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]'
                          }`}
                      >
                        {filter}
                        {timeStats[filter] > 0 && (
                          <sup className={`ml-1 text-[8px] ${activeTimeFilter === filter ? 'text-white/80' : (filter === 'Delayed' ? 'text-red-500' : 'text-[var(--theme-primary)]')}`}>
                            {timeStats[filter]}
                          </sup>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    PREV
                  </button>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                    PAGE {currentPage} / {totalPages}
                  </span>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    NEXT
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedChecklists.map((checklist, index) => (
                  <motion.div
                    key={checklist.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-gradient-to-br from-white to-[var(--theme-light)] dark:from-gray-800 dark:to-gray-850 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 hover:border-[var(--theme-primary)] overflow-hidden"
                  >
                    <div className="p-4">
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-2 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-[var(--theme-primary)] flex items-center justify-center flex-shrink-0 shadow-sm">
                            <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                #{checklist.id}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(checklist.status)}`}>
                                {checklist.status.toUpperCase()}
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white break-words leading-tight">
                              {checklist.question}
                            </h3>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-1 ml-3">
                          <button
                            onClick={() => handleViewDetails(checklist)}
                            className="p-2 text-[var(--theme-primary)] hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 rounded-lg transition"
                            title="View Details"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteModal(checklist.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                            title="Delete"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {/* Assignee */}
                        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Assignee</p>
                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{checklist.assignee}</p>
                          </div>
                        </div>

                        {/* Doer */}
                        <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg">
                          <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Doer</p>
                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{checklist.doer_name || 'N/A'}</p>
                          </div>
                        </div>

                        {/* Department */}
                        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                          <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Department</p>
                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{checklist.department || 'N/A'}</p>
                          </div>
                        </div>

                        {/* Priority */}
                        <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${checklist.priority === 'high' ? 'bg-red-500' :
                            checklist.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                            }`}>
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Priority</p>
                            <p className="text-xs font-bold text-gray-900 dark:text-white capitalize">{checklist.priority}</p>
                          </div>
                        </div>
                      </div>

                      {/* Footer Row */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        {/* Due Date */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                            <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">Due Date</p>
                            {checklist.due_date ? (
                              <p className="text-xs font-bold text-gray-900 dark:text-white">
                                {formatDateToLocalTimezone(checklist.due_date)}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500">No date</p>
                            )}
                          </div>
                        </div>

                        {/* Frequency */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                            <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">Frequency</p>
                            <p className="text-xs font-bold text-gray-900 dark:text-white capitalize">
                              {checklist.frequency}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status Indicator Bar */}
                    <div className={`h-1.5 w-full ${getStatusColor(checklist.status)}`} />
                  </motion.div>
                ))}
              </div>

              {/* Pagination Controls Removed from bottom */}
            </div>
          )}

          {/* Group View */}
          {viewMode === 'group' && (
            <>
              {/* Pagination Row Above Table (Group View) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap">
                    Showing <span className="text-gray-900 dark:text-white">{((currentPage - 1) * itemsPerPage) + 1}</span>-<span className="text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, groupedChecklists.length)}</span> of <span className="text-gray-900 dark:text-white">{groupedChecklists.length}</span>
                  </p>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {(['Delayed', 'Today', 'Tomorrow', 'Next 3', 'Next 7', 'Next 15'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => { setActiveTimeFilter(activeTimeFilter === filter ? null : filter); setCurrentPage(1); }}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap relative border ${activeTimeFilter === filter
                          ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)] shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]'
                          }`}
                      >
                        {filter}
                        {timeStats[filter] > 0 && (
                          <sup className={`ml-1 text-[8px] ${activeTimeFilter === filter ? 'text-white/80' : (filter === 'Delayed' ? 'text-red-500' : 'text-[var(--theme-primary)]')}`}>
                            {timeStats[filter]}
                          </sup>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    PREV
                  </button>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                    PAGE {currentPage} / {totalPages}
                  </span>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    NEXT
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="whitespace-nowrap">
                    <tr className="bg-[var(--theme-primary)] border-b border-gray-200 dark:border-gray-600">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Group ID
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 w-full min-w-[400px]">
                        Question/Task
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Assignee
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Doer
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Priority
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Department
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Frequency
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Due Date
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Verification</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 whitespace-nowrap">
                    {paginatedChecklists.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-secondary)] rounded-full flex items-center justify-center mb-4 text-3xl">
                              📋
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">No groups found</p>
                            <p className="text-gray-400 dark:text-gray-500 text-sm">Create your first checklist to get started</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedChecklists.map((checklist) => (
                        <motion.tr
                          key={checklist.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          whileHover={{ backgroundColor: 'rgba(244, 210, 74, 0.05)' }}
                          className="transition-colors"
                        >
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                              {checklist.group_id || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900 dark:text-white whitespace-normal break-words">
                              {checklist.question}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {getUserImage(checklist.assignee) ? (
                                <img src={`/api/image-proxy?url=${encodeURIComponent(getUserImage(checklist.assignee)!)}`} alt={checklist.assignee} className="w-8 h-8 rounded-full object-cover border-2 border-[var(--theme-primary)]" />
                              ) : (
                                <div className="w-8 h-8 bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-secondary)] rounded-full flex items-center justify-center text-sm font-bold text-gray-900 shadow-md">
                                  {checklist.assignee[0]?.toUpperCase() || '?'}
                                </div>
                              )}
                              <span className="text-gray-900 dark:text-white">{checklist.assignee}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {checklist.doer_name ? (
                              <div className="flex items-center gap-2">
                                {getUserImage(checklist.doer_name) ? (
                                  <img src={`/api/image-proxy?url=${encodeURIComponent(getUserImage(checklist.doer_name)!)}`} alt={checklist.doer_name} className="w-8 h-8 rounded-full object-cover border-2 border-[var(--theme-primary)]" />
                                ) : (
                                  <div className="w-8 h-8 bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-secondary)] rounded-full flex items-center justify-center text-sm font-bold text-gray-900 shadow-md">
                                    {checklist.doer_name[0]?.toUpperCase() || '?'}
                                  </div>
                                )}
                                <span className="text-gray-900 dark:text-white">{checklist.doer_name}</span>
                              </div>
                            ) : (
                              <span className="text-gray-500 dark:text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(checklist.priority)}`}>
                              {checklist.priority?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-900 dark:text-white">
                            {checklist.department || 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                              {checklist.frequency}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <p className="text-gray-900 dark:text-white font-medium">
                                {formatDateToLocalTimezone(checklist.due_date)}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(checklist.status)}`}>
                              {checklist.status?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {checklist.verification_required ? (
                              <div className="text-sm">
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium mb-1">
                                  ✓ Required
                                </span>
                                {checklist.verifier_name && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    By: {checklist.verifier_name}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">Not Required</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleViewDetails(checklist)}
                                className="p-2 text-[var(--theme-primary)] hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 rounded-lg transition"
                                title="View Details"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => openEditModal(checklist)}
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                title="Edit"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => openDeleteModal(checklist.id)}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                title="Delete"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls Removed from bottom */}
            </>
          )}
        </motion.div>

        {/* Add Modal */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowAddModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="sticky top-0 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] px-6 py-4 rounded-t-2xl">
                  <h2 className="text-2xl font-bold text-gray-900">✅ Add New Checklist</h2>
                  <p className="text-gray-700 text-sm mt-1">Tasks will be automatically generated based on frequency</p>
                </div>

                <form onSubmit={handleAddChecklist} className="p-4 md:p-6">
                  {/* Two Column Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {/* Left Column */}
                    <div className="space-y-4 md:col-span-2">
                      {/* Question */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Question/Task *
                        </label>
                        <textarea
                          required
                          value={formData.question}
                          onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-gray-900 dark:text-white resize-none"
                          rows={4}
                          placeholder="Enter the task or question..."
                        />
                      </div>
                    </div>

                    {/* Left Column - Other fields */}
                    <div className="space-y-4">

                      {/* Assignee */}
                      <div className="relative" ref={assigneeRef}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Assignee *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={formData.assignee || assigneeSearch}
                            onChange={(e) => {
                              setAssigneeSearch(e.target.value);
                              setFormData({ ...formData, assignee: '' });
                              setShowAssigneeDropdown(true);
                            }}
                            onFocus={() => setShowAssigneeDropdown(true)}
                            placeholder="Search assignee..."
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-gray-900 dark:text-white"
                          />
                          {showAssigneeDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                              {users.filter(u => u.username.toLowerCase().includes(assigneeSearch.toLowerCase())).map(u => (
                                <div
                                  key={u.id}
                                  onClick={() => {
                                    setFormData({ ...formData, assignee: u.username });
                                    setAssigneeSearch('');
                                    setShowAssigneeDropdown(false);
                                  }}
                                  className="px-4 py-2 hover:bg-[var(--theme-primary)]/20 cursor-pointer text-gray-900 dark:text-white"
                                >
                                  {u.username}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Doer - Multiple Selection */}
                      <div className="relative" ref={doerRef}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Doer (Multiple Selection)
                        </label>

                        {/* Selected Doers Display */}
                        {selectedDoers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {selectedDoers.map(doer => (
                              <div
                                key={doer}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--theme-primary)] text-gray-900 text-xs rounded-full"
                              >
                                <span>{doer}</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDoers(selectedDoers.filter(d => d !== doer))}
                                  className="hover:bg-[var(--theme-secondary)] rounded-full p-0.5"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="relative">
                          <input
                            type="text"
                            value={doerSearch}
                            onChange={(e) => {
                              setDoerSearch(e.target.value);
                              setShowDoerDropdown(true);
                            }}
                            onFocus={() => setShowDoerDropdown(true)}
                            placeholder="Search and select doers..."
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-gray-900 dark:text-white"
                          />
                          {showDoerDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                              {users.filter(u =>
                                u.username.toLowerCase().includes(doerSearch.toLowerCase()) &&
                                !selectedDoers.includes(u.username)
                              ).map(u => (
                                <div
                                  key={u.id}
                                  onClick={() => {
                                    setSelectedDoers([...selectedDoers, u.username]);
                                    setDoerSearch('');
                                  }}
                                  className="px-4 py-2 hover:bg-[var(--theme-primary)]/20 cursor-pointer text-gray-900 dark:text-white"
                                >
                                  {u.username}
                                </div>
                              ))}
                              {users.filter(u =>
                                u.username.toLowerCase().includes(doerSearch.toLowerCase()) &&
                                !selectedDoers.includes(u.username)
                              ).length === 0 && (
                                  <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">
                                    No users found
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Department */}
                      <div className="relative" ref={departmentRef}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Department
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={formData.department || departmentSearch}
                              onChange={(e) => {
                                setDepartmentSearch(e.target.value);
                                setFormData({ ...formData, department: '' });
                                setShowDepartmentDropdown(true);
                              }}
                              onFocus={() => setShowDepartmentDropdown(true)}
                              placeholder="Search department..."
                              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-gray-900 dark:text-white"
                            />
                            {showDepartmentDropdown && (
                              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {allDepartments.filter(d => d.toLowerCase().includes(departmentSearch.toLowerCase())).map(d => (
                                  <div
                                    key={d}
                                    onClick={() => {
                                      setFormData({ ...formData, department: d });
                                      setDepartmentSearch('');
                                      setShowDepartmentDropdown(false);
                                    }}
                                    className="px-4 py-2 hover:bg-[var(--theme-primary)]/20 cursor-pointer text-gray-900 dark:text-white"
                                  >
                                    {d}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Add Department Button */}
                          <button
                            type="button"
                            onClick={() => setShowAddDepartmentModal(true)}
                            className="px-3 py-2.5 bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] text-gray-900 rounded-xl font-semibold transition text-sm flex items-center gap-1"
                            title="Add new department"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Priority */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Priority *
                        </label>
                        <div className="flex gap-2">
                          {PRIORITIES.map(p => {
                            let selectedColor = '';
                            let unselectedColor = '';

                            if (p.value === 'high') {
                              selectedColor = 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md';
                              unselectedColor = 'hover:border-red-500';
                            } else if (p.value === 'medium') {
                              selectedColor = 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-md';
                              unselectedColor = 'hover:border-yellow-500';
                            } else {
                              selectedColor = 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md';
                              unselectedColor = 'hover:border-green-500';
                            }

                            return (
                              <motion.button
                                key={p.value}
                                type="button"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setFormData({ ...formData, priority: p.value })}
                                className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition ${formData.priority === p.value
                                  ? selectedColor
                                  : `bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 ${unselectedColor}`
                                  }`}
                              >
                                {p.label}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      {/* Frequency */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Frequency *
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {FREQUENCIES.map(f => (
                            <motion.button
                              key={f.value}
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setFormData({ ...formData, frequency: f.value })}
                              className={`px-3 py-2.5 rounded-xl font-medium text-sm transition ${formData.frequency === f.value
                                ? 'bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 shadow-md'
                                : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 hover:border-[var(--theme-primary)]'
                                }`}
                            >
                              {f.label}
                            </motion.button>
                          ))}
                        </div>

                        {/* Weekly Day Selector */}
                        {formData.frequency === 'weekly' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700"
                          >
                            <div className="flex items-center gap-2 text-sm mb-2">
                              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-blue-700 dark:text-blue-300 font-medium">
                                Click days to select when tasks repeat weekly
                                {selectedWeekDays.length > 0 && ` (${selectedWeekDays.length} selected)`}
                              </span>
                            </div>
                            <div className="flex gap-1 mt-2">
                              {['M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                                // Monday=1, Tuesday=2, ..., Saturday=6 (matching Date.getDay() but excluding Sunday=0)
                                const dayValue = index + 1;
                                const isSelected = selectedWeekDays.includes(dayValue);
                                return (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedWeekDays(selectedWeekDays.filter(d => d !== dayValue));
                                      } else {
                                        setSelectedWeekDays([...selectedWeekDays, dayValue].sort());
                                      }
                                    }}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer hover:scale-110 ${isSelected
                                      ? 'bg-blue-600 text-white shadow-md'
                                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
                                      }`}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}

                        {/* Monthly/Quarterly/Yearly Selected Dates Display */}
                        {(formData.frequency === 'monthly' || formData.frequency === 'quarterly' || formData.frequency === 'yearly') && selectedMultipleDates.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-700"
                          >
                            <div className="flex items-center gap-2 text-sm mb-2">
                              <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-purple-700 dark:text-purple-300 font-medium">
                                Selected Dates ({selectedMultipleDates.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedMultipleDates([])}
                                className="ml-auto text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 underline"
                              >
                                Clear All
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {selectedMultipleDates.map(dateStr => {
                                const [year, month, day] = dateStr.split('-');
                                return (
                                  <div
                                    key={dateStr}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs rounded-full"
                                  >
                                    <span>{`${day}/${month}`}</span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedMultipleDates(selectedMultipleDates.filter(d => d !== dateStr))}
                                      className="hover:bg-purple-700 rounded-full p-0.5"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* Select Due Date */}
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Start Date & Time *
                          {formData.frequency === 'weekly' && (
                            <span className="block text-xs text-gray-500 mt-1">When to start the weekly tasks</span>
                          )}
                          {formData.frequency === 'daily' && (
                            <span className="block text-xs text-gray-500 mt-1">Tasks will be created daily (excluding Sundays) until Dec 31</span>
                          )}
                          {formData.frequency === 'monthly' && (
                            <span className="block text-xs text-gray-500 mt-1">Tasks will repeat on this day each month until Dec 31</span>
                          )}
                          {formData.frequency === 'quarterly' && (
                            <span className="block text-xs text-gray-500 mt-1">Tasks will repeat every 3 months until Dec 31</span>
                          )}
                          {formData.frequency === 'yearly' && (
                            <span className="block text-xs text-gray-500 mt-1">Single task on this date</span>
                          )}
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowDatePicker(!showDatePicker)}
                          className="w-full px-4 py-2.5 bg-gradient-to-r from-[var(--theme-light)] to-[var(--theme-lighter)] dark:bg-slate-700 border-2 border-[var(--theme-primary)]/50 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-gray-900 dark:text-white font-medium shadow-sm text-left flex items-center justify-between"
                        >
                          <span>
                            {formData.dueDate ? formatDateForInput(formData.dueDate) : 'Select date & time'}
                          </span>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>

                      {/* Verification Required */}
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[var(--theme-light)] to-[var(--theme-lighter)] dark:bg-slate-700/50 rounded-xl border border-[var(--theme-primary)]/30">
                        <label htmlFor="verificationRequired" className="text-sm font-medium text-gray-900 dark:text-gray-300">
                          ✓ Verification Required
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, verificationRequired: !formData.verificationRequired })}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${formData.verificationRequired ? 'bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)]' : 'bg-gray-300 dark:bg-slate-600'
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${formData.verificationRequired ? 'translate-x-8' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>

                      {/* Verifier Name - Shows when Verification is Required */}
                      {formData.verificationRequired && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="relative" ref={verifierRef}
                        >
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Verifier Name
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={formData.verifierName || verifierSearch}
                              onChange={(e) => {
                                setVerifierSearch(e.target.value);
                                setFormData({ ...formData, verifierName: '' });
                                setShowVerifierDropdown(true);
                              }}
                              onFocus={() => setShowVerifierDropdown(true)}
                              placeholder="Search verifier..."
                              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-gray-900 dark:text-white"
                            />
                            {showVerifierDropdown && (
                              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {users.filter(u => u.username.toLowerCase().includes(verifierSearch.toLowerCase())).map(u => (
                                  <div
                                    key={u.id}
                                    onClick={() => {
                                      setFormData({ ...formData, verifierName: u.username });
                                      setVerifierSearch('');
                                      setShowVerifierDropdown(false);
                                    }}
                                    className="px-4 py-2 hover:bg-[var(--theme-primary)]/20 cursor-pointer text-gray-900 dark:text-white"
                                  >
                                    {u.username}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* Attachment Required */}
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[var(--theme-light)] to-[var(--theme-lighter)] dark:bg-slate-700/50 rounded-xl border border-[var(--theme-primary)]/30">
                        <label htmlFor="attachmentRequired" className="text-sm font-medium text-gray-900 dark:text-gray-300">
                          📎 Task Attachment Required
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, attachmentRequired: !formData.attachmentRequired })}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${formData.attachmentRequired ? 'bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)]' : 'bg-gray-300 dark:bg-slate-600'
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${formData.attachmentRequired ? 'translate-x-8' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Custom Date Time Picker */}
                  <AnimatePresence>
                    {showDatePicker && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
                        onClick={() => setShowDatePicker(false)}
                      >
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.95, opacity: 0 }}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto"
                        >
                          {/* Calendar */}
                          <div className="w-full sm:w-80 flex-shrink-0">
                            {/* Info banner for multi-select */}
                            {(formData.frequency === 'monthly' || formData.frequency === 'quarterly' || formData.frequency === 'yearly') && (
                              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                                <p className="text-xs text-blue-700 dark:text-blue-300 text-center font-medium">
                                  ℹ️ Click multiple dates to select
                                  {selectedMultipleDates.length > 0 && ` (${selectedMultipleDates.length} selected)`}
                                </p>
                              </div>
                            )}

                            <div className="flex items-center justify-between mb-3">
                              <button
                                type="button"
                                onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
                                className="p-1 hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 rounded"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
                                className="p-1 hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 rounded"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                <div key={day} className="font-semibold text-gray-600 dark:text-gray-400">{day}</div>
                              ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1">
                              {Array.from({ length: getFirstDayOfMonth(selectedDate) }).map((_, i) => (
                                <div key={`empty-${i}`} />
                              ))}
                              {Array.from({ length: getDaysInMonth(selectedDate) }).map((_, i) => {
                                const day = i + 1;
                                const isMultiSelect = formData.frequency === 'monthly' || formData.frequency === 'quarterly' || formData.frequency === 'yearly';
                                const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const isSelected = isMultiSelect
                                  ? selectedMultipleDates.includes(dateStr)
                                  : selectedDate.getDate() === day;

                                // Check if date is in the past
                                const currentDate = new Date(selectedDate);
                                currentDate.setDate(day);
                                currentDate.setHours(0, 0, 0, 0);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const isPastDate = currentDate < today;
                                const isSunday = currentDate.getDay() === 0;

                                return (
                                  <button
                                    key={day}
                                    type="button"
                                    disabled={isPastDate || isSunday}
                                    onClick={() => {
                                      if (isPastDate || isSunday) return;

                                      if (isMultiSelect) {
                                        // Multi-date selection for monthly/quarterly/yearly
                                        if (selectedMultipleDates.includes(dateStr)) {
                                          // Remove date if already selected
                                          setSelectedMultipleDates(selectedMultipleDates.filter(d => d !== dateStr));
                                        } else {
                                          // Add date to selection
                                          setSelectedMultipleDates([...selectedMultipleDates, dateStr]);
                                        }
                                      } else {
                                        // Single date selection for daily/weekly
                                        const newDate = new Date(selectedDate);
                                        newDate.setDate(day);
                                        setSelectedDate(newDate);
                                      }
                                    }}
                                    className={`p-2 text-sm rounded-lg transition ${isPastDate || isSunday
                                      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-40'
                                      : isSelected
                                        ? 'bg-[var(--theme-primary)] text-gray-900 font-bold'
                                        : 'hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                                      }`}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Clock Time Picker - For all frequencies */}
                          <div className="w-full sm:w-80 flex-shrink-0 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700 pt-4 sm:pt-0 sm:pl-6">
                            <div className="text-center mb-3">
                              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                {selectedHour.toString().padStart(2, '0')}:{selectedMinute.toString().padStart(2, '0')} {selectedPeriod}
                              </span>
                            </div>

                            <div className="flex gap-3 justify-center mb-3">
                              {/* Hour Selector */}
                              <div className="flex flex-col items-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedHour(selectedHour === 12 ? 1 : selectedHour + 1)}
                                  className="p-1 hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 rounded"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <div className="w-16 h-16 flex items-center justify-center bg-[var(--theme-lighter)] dark:bg-gray-700 rounded-lg my-2">
                                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{selectedHour.toString().padStart(2, '0')}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedHour(selectedHour === 1 ? 12 : selectedHour - 1)}
                                  className="p-1 hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 rounded"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>

                              <span className="text-3xl font-bold text-gray-900 dark:text-white self-center">:</span>

                              {/* Minute Selector */}
                              <div className="flex flex-col items-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedMinute((selectedMinute + 15) % 60)}
                                  className="p-1 hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 rounded"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <div className="w-16 h-16 flex items-center justify-center bg-[var(--theme-lighter)] dark:bg-gray-700 rounded-lg my-2">
                                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{selectedMinute.toString().padStart(2, '0')}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedMinute(selectedMinute === 0 ? 45 : selectedMinute - 15)}
                                  className="p-1 hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 rounded"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>

                              {/* AM/PM Selector */}
                              <div className="flex flex-col items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPeriod('AM')}
                                  className={`px-3 py-2 rounded-lg font-semibold text-sm mb-1 ${selectedPeriod === 'AM' ? 'bg-[var(--theme-primary)] text-gray-900' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                  AM
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedPeriod('PM')}
                                  className={`px-3 py-2 rounded-lg font-semibold text-sm ${selectedPeriod === 'PM' ? 'bg-[var(--theme-primary)] text-gray-900' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                  PM
                                </button>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <button
                              type="button"
                              onClick={handleDateTimeSet}
                              className="w-full py-2 bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] text-gray-900 font-semibold rounded-lg transition mt-4"
                            >
                              Set Date & Time
                            </button>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition"
                    >
                      Create Checklist
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        resetForm();
                      }}
                      className="px-6 py-3 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Modal - Similar structure to Add Modal */}
        <AnimatePresence>
          {showEditModal && editingChecklist && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => {
                setShowEditModal(false);
                setEditingChecklist(null);
                resetForm();
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="sticky top-0 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] px-6 py-4 rounded-t-2xl">
                  <h2 className="text-2xl font-bold text-gray-900">✏️ Edit Checklist</h2>
                  <p className="text-gray-700 text-sm mt-1">Update checklist details</p>
                </div>

                <form onSubmit={handleEditChecklist} className="p-4 md:p-6">
                  {/* Two Column Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {/* Question - Full width on mobile */}
                    <div className="space-y-4 md:col-span-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Question/Task *
                        </label>
                        <textarea
                          required
                          value={formData.question}
                          onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-gray-900 dark:text-white resize-none"
                          rows={4}
                          placeholder="Enter the task or question..."
                        />
                      </div>
                    </div>

                    {/* Left Column - Other fields */}
                    <div className="space-y-4">

                      {/* Assignee */}
                      <div className="relative" ref={assigneeRef}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Assignee *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={formData.assignee || assigneeSearch}
                            onChange={(e) => {
                              setAssigneeSearch(e.target.value);
                              setFormData({ ...formData, assignee: '' });
                              setShowAssigneeDropdown(true);
                            }}
                            onFocus={() => setShowAssigneeDropdown(true)}
                            placeholder="Search assignee..."
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-gray-900 dark:text-white"
                          />
                          {showAssigneeDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                              {users.filter(u => u.username.toLowerCase().includes(assigneeSearch.toLowerCase())).map(u => (
                                <div
                                  key={u.id}
                                  onClick={() => {
                                    setFormData({ ...formData, assignee: u.username });
                                    setAssigneeSearch('');
                                    setShowAssigneeDropdown(false);
                                  }}
                                  className="px-4 py-2 hover:bg-[var(--theme-primary)]/20 cursor-pointer text-gray-900 dark:text-white"
                                >
                                  {u.username}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Doer */}
                      <div className="relative" ref={doerRef}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Doer
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.doerName || doerSearch}
                            onChange={(e) => {
                              setDoerSearch(e.target.value);
                              setFormData({ ...formData, doerName: '' });
                              setShowDoerDropdown(true);
                            }}
                            onFocus={() => setShowDoerDropdown(true)}
                            placeholder="Search doer..."
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-gray-900 dark:text-white"
                          />
                          {showDoerDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                              {users.filter(u => u.username.toLowerCase().includes(doerSearch.toLowerCase())).map(u => (
                                <div
                                  key={u.id}
                                  onClick={() => {
                                    setFormData({ ...formData, doerName: u.username });
                                    setDoerSearch('');
                                    setShowDoerDropdown(false);
                                  }}
                                  className="px-4 py-2 hover:bg-[var(--theme-primary)]/20 cursor-pointer text-gray-900 dark:text-white"
                                >
                                  {u.username}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Department */}
                      <div className="relative" ref={departmentRef}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Department
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={formData.department || departmentSearch}
                              onChange={(e) => {
                                setDepartmentSearch(e.target.value);
                                setFormData({ ...formData, department: '' });
                                setShowDepartmentDropdown(true);
                              }}
                              onFocus={() => setShowDepartmentDropdown(true)}
                              placeholder="Search department..."
                              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-gray-900 dark:text-white"
                            />
                            {showDepartmentDropdown && (
                              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {allDepartments.filter(d => d.toLowerCase().includes(departmentSearch.toLowerCase())).map(d => (
                                  <div
                                    key={d}
                                    onClick={() => {
                                      setFormData({ ...formData, department: d });
                                      setDepartmentSearch('');
                                      setShowDepartmentDropdown(false);
                                    }}
                                    className="px-4 py-2 hover:bg-[var(--theme-primary)]/20 cursor-pointer text-gray-900 dark:text-white"
                                  >
                                    {d}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Add Department Button */}
                          <button
                            type="button"
                            onClick={() => setShowAddDepartmentModal(true)}
                            className="px-3 py-2.5 bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] text-gray-900 rounded-xl font-semibold transition text-sm flex items-center gap-1"
                            title="Add new department"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Priority */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Priority *
                        </label>
                        <div className="flex gap-2">
                          {PRIORITIES.map(p => {
                            let selectedColor = '';
                            let unselectedColor = '';

                            if (p.value === 'high') {
                              selectedColor = 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md';
                              unselectedColor = 'hover:border-red-500';
                            } else if (p.value === 'medium') {
                              selectedColor = 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-md';
                              unselectedColor = 'hover:border-yellow-500';
                            } else {
                              selectedColor = 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md';
                              unselectedColor = 'hover:border-green-500';
                            }

                            return (
                              <motion.button
                                key={p.value}
                                type="button"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setFormData({ ...formData, priority: p.value })}
                                className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition ${formData.priority === p.value
                                  ? selectedColor
                                  : `bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 ${unselectedColor}`
                                  }`}
                              >
                                {p.label}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      {/* Verification Required */}
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[var(--theme-light)] to-[var(--theme-lighter)] dark:bg-slate-700/50 rounded-xl border border-[var(--theme-primary)]/30">
                        <label htmlFor="editVerificationRequired" className="text-sm font-medium text-gray-900 dark:text-gray-300">
                          ✓ Verification Required
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, verificationRequired: !formData.verificationRequired })}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${formData.verificationRequired ? 'bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)]' : 'bg-gray-300 dark:bg-slate-600'
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${formData.verificationRequired ? 'translate-x-8' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>

                      {/* Verifier Name - Shows when Verification is Required */}
                      {formData.verificationRequired && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="relative" ref={verifierRef}
                        >
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Verifier Name
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={formData.verifierName || verifierSearch}
                              onChange={(e) => {
                                setVerifierSearch(e.target.value);
                                setFormData({ ...formData, verifierName: '' });
                                setShowVerifierDropdown(true);
                              }}
                              onFocus={() => setShowVerifierDropdown(true)}
                              placeholder="Search verifier..."
                              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] outline-none text-gray-900 dark:text-white"
                            />
                            {showVerifierDropdown && (
                              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-[var(--theme-primary)]/30 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {users.filter(u => u.username.toLowerCase().includes(verifierSearch.toLowerCase())).map(u => (
                                  <div
                                    key={u.id}
                                    onClick={() => {
                                      setFormData({ ...formData, verifierName: u.username });
                                      setVerifierSearch('');
                                      setShowVerifierDropdown(false);
                                    }}
                                    className="px-4 py-2 hover:bg-[var(--theme-primary)]/20 cursor-pointer text-gray-900 dark:text-white"
                                  >
                                    {u.username}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* Attachment Required */}
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[var(--theme-light)] to-[var(--theme-lighter)] dark:bg-slate-700/50 rounded-xl border border-[var(--theme-primary)]/30">
                        <label htmlFor="editAttachmentRequired" className="text-sm font-medium text-gray-900 dark:text-gray-300">
                          📎 Task Attachment Required
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, attachmentRequired: !formData.attachmentRequired })}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${formData.attachmentRequired ? 'bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)]' : 'bg-gray-300 dark:bg-slate-600'
                            }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${formData.attachmentRequired ? 'translate-x-8' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingChecklist(null);
                        resetForm();
                      }}
                      className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition"
                    >
                      Update Checklist
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteModal && deleteId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteId(null);
                setDeleteMode(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
              >
                <div className="flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
                  Delete Checklist
                </h3>

                {!deleteMode ? (
                  <>
                    <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
                      Would you like to delete only this task or all tasks in this group?
                    </p>
                    <div className="space-y-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setDeleteMode('single')}
                        className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Delete This Task Only
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setDeleteMode('group')}
                        className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Delete All Group Tasks ({checklists.filter(c => c.group_id === checklists.find(ch => ch.id === deleteId)?.group_id).length})
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setShowDeleteModal(false);
                          setDeleteId(null);
                          setDeleteMode(null);
                        }}
                        className="w-full px-6 py-3 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition"
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
                      {deleteMode === 'single'
                        ? 'Are you sure you want to delete this checklist? This action cannot be undone.'
                        : `Are you sure you want to delete all ${checklists.filter(c => c.group_id === checklists.find(ch => ch.id === deleteId)?.group_id).length} tasks in this group? This action cannot be undone.`
                      }
                    </p>
                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleDeleteChecklist}
                        className="flex-1 bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition"
                      >
                        {deleteMode === 'single' ? 'Delete Task' : 'Delete Group'}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setDeleteMode(null)}
                        className="flex-1 px-6 py-3 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition"
                      >
                        Back
                      </motion.button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Department Modal */}
        <AnimatePresence>
          {showAddDepartmentModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => {
                setShowAddDepartmentModal(false);
                setNewDepartmentName('');
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Add New Department
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddDepartmentModal(false);
                      setNewDepartmentName('');
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Department Name
                    </label>
                    <input
                      type="text"
                      value={newDepartmentName}
                      onChange={(e) => setNewDepartmentName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddDepartment();
                        }
                      }}
                      placeholder="Enter department name..."
                      className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] transition text-sm"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowAddDepartmentModal(false);
                        setNewDepartmentName('');
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddDepartment}
                      className="flex-1 px-4 py-2.5 bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] text-gray-900 font-bold rounded-xl transition shadow-md"
                    >
                      Add Department
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter Modal */}
        <AnimatePresence>
          {showFilterModal && (
            <>
              <motion.div
                className="fixed inset-0 bg-transparent z-[60]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowFilterModal(false)}
              />

              <motion.div
                className="fixed z-[70] w-[calc(100%-2rem)] max-w-[600px] md:w-[600px]"
                style={{
                  ...(isMobile ? {
                    top: '50%',
                    left: '50%',
                    right: 'auto',
                    bottom: 'auto',
                    transform: 'translate(-50%, -50%)'
                  } : {
                    top: `${filterPos.top}px`,
                    right: `${filterPos.right}px`,
                    left: 'auto',
                    transform: 'none'
                  })
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[calc(100vh-100px)] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Arrow pointing to filter button - hidden on mobile */}
                  <div className="hidden md:block absolute -top-2 right-8 w-4 h-4 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-700 transform rotate-45"></div>

                  {/* Filter Content */}
                  <div className="p-5 space-y-4">
                    {/* Due Date Range - Single unified picker */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Date Range</label>
                      <DateRangePicker
                        fromDate={filters.dueDateFrom}
                        toDate={filters.dueDateTo}
                        onRangeChange={(from, to) => setFilters(prev => ({ ...prev, dueDateFrom: from, dueDateTo: to }))}
                      />
                    </div>

                    {/* Question & Department - 2 columns */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative filter-dropdown-container">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Question/Task</label>
                        <input
                          type="text"
                          placeholder="Search questions..."
                          value={filterSearches.question}
                          onChange={(e) => setFilterSearches(prev => ({ ...prev, question: e.target.value }))}
                          onFocus={() => setActiveDropdown('question')}
                          className="w-full px-3 py-2 bg-[var(--theme-lighter)] dark:bg-gray-700 border-0 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] transition"
                        />
                        {activeDropdown === 'question' && (
                          <div
                            className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto space-y-1 bg-white dark:bg-gray-800 rounded-lg p-2 shadow-xl border border-gray-200 dark:border-gray-700 z-50"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {uniqueQuestions
                              .filter(q => !filterSearches.question || q.toLowerCase().includes(filterSearches.question.toLowerCase()))
                              .map(question => (
                                <label key={question} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 p-1.5 rounded transition">
                                  <input
                                    type="checkbox"
                                    checked={filters.questions.includes(question)}
                                    onChange={() => toggleFilterValue('questions', question)}
                                    className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] rounded"
                                  />
                                  <span className="text-xs text-gray-900 dark:text-white">{question}</span>
                                </label>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Department */}
                      <div className="relative filter-dropdown-container">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Department</label>
                        <input
                          type="text"
                          placeholder="Search departments..."
                          value={filterSearches.department}
                          onChange={(e) => setFilterSearches(prev => ({ ...prev, department: e.target.value }))}
                          onFocus={() => setActiveDropdown('department')}
                          className="w-full px-3 py-2 bg-[var(--theme-lighter)] dark:bg-gray-700 border-0 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] transition"
                        />
                        {activeDropdown === 'department' && (
                          <div
                            className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto space-y-1 bg-white dark:bg-gray-800 rounded-lg p-2 shadow-xl border border-gray-200 dark:border-gray-700 z-50"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {uniqueDepartments
                              .filter(d => d && (!filterSearches.department || d.toLowerCase().includes(filterSearches.department.toLowerCase())))
                              .map(department => department && (
                                <label key={department} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 p-1.5 rounded transition">
                                  <input
                                    type="checkbox"
                                    checked={filters.departments.includes(department)}
                                    onChange={() => toggleFilterValue('departments', department)}
                                    className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] rounded"
                                  />
                                  <span className="text-xs text-gray-900 dark:text-white">{department}</span>
                                </label>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Assignee & Doer - 2 columns */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Assignee */}
                      <div className="relative filter-dropdown-container">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Assignee</label>
                        <input
                          type="text"
                          placeholder="Search assignees..."
                          value={filterSearches.assignee}
                          onChange={(e) => setFilterSearches(prev => ({ ...prev, assignee: e.target.value }))}
                          onFocus={() => setActiveDropdown('assignee')}
                          className="w-full px-3 py-2 bg-[var(--theme-lighter)] dark:bg-gray-700 border-0 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] transition"
                        />
                        {activeDropdown === 'assignee' && (
                          <div
                            className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto space-y-1 bg-white dark:bg-gray-800 rounded-lg p-2 shadow-xl border border-gray-200 dark:border-gray-700 z-50"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {uniqueAssignees
                              .filter(a => !filterSearches.assignee || a.toLowerCase().includes(filterSearches.assignee.toLowerCase()))
                              .map(assignee => (
                                <label key={assignee} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 p-1.5 rounded transition">
                                  <input
                                    type="checkbox"
                                    checked={filters.assignees.includes(assignee)}
                                    onChange={() => toggleFilterValue('assignees', assignee)}
                                    className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] rounded"
                                  />
                                  <span className="text-xs text-gray-900 dark:text-white">{assignee}</span>
                                </label>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Doer */}
                      <div className="relative filter-dropdown-container">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Doer</label>
                        <input
                          type="text"
                          placeholder="Search doers..."
                          value={filterSearches.doer}
                          onChange={(e) => setFilterSearches(prev => ({ ...prev, doer: e.target.value }))}
                          onFocus={() => setActiveDropdown('doer')}
                          className="w-full px-3 py-2 bg-[var(--theme-lighter)] dark:bg-gray-700 border-0 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] transition"
                        />
                        {activeDropdown === 'doer' && (
                          <div
                            className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto space-y-1 bg-white dark:bg-gray-800 rounded-lg p-2 shadow-xl border border-gray-200 dark:border-gray-700 z-50"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {uniqueDoers
                              .filter(d => d && (!filterSearches.doer || d.toLowerCase().includes(filterSearches.doer.toLowerCase())))
                              .map(doer => doer && (
                                <label key={doer} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 p-1.5 rounded transition">
                                  <input
                                    type="checkbox"
                                    checked={filters.doers.includes(doer)}
                                    onChange={() => toggleFilterValue('doers', doer)}
                                    className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] rounded"
                                  />
                                  <span className="text-xs text-gray-900 dark:text-white">{doer}</span>
                                </label>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Priority & Status - 2 columns */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Priority */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Priority</label>
                        <div className="space-y-1.5">
                          {['low', 'medium', 'high'].map(priority => (
                            <label key={priority} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 p-2 rounded-lg transition">
                              <input
                                type="checkbox"
                                checked={filters.priorities.includes(priority)}
                                onChange={() => toggleFilterValue('priorities', priority)}
                                className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] rounded"
                              />
                              <span className="text-xs font-medium text-gray-900 dark:text-white capitalize">{priority}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                        <div className="max-h-32 overflow-y-auto space-y-1 bg-[var(--theme-lighter)] dark:bg-gray-700 rounded-lg p-2">
                          {uniqueStatuses.map(status => (
                            <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-gray-600 p-1.5 rounded transition">
                              <input
                                type="checkbox"
                                checked={filters.statuses.includes(status)}
                                onChange={() => toggleFilterValue('statuses', status)}
                                className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] rounded"
                              />
                              <span className="text-xs text-gray-900 dark:text-white capitalize">{status}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Frequency - Full width */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Frequency</label>
                      <div className="grid grid-cols-3 gap-2">
                        {uniqueFrequencies.map(frequency => (
                          <label key={frequency} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 p-2 rounded-lg transition">
                            <input
                              type="checkbox"
                              checked={filters.frequencies.includes(frequency)}
                              onChange={() => toggleFilterValue('frequencies', frequency)}
                              className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] rounded"
                            />
                            <span className="text-xs font-medium text-gray-900 dark:text-white capitalize">{frequency}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Verification & Attachment - 2 columns */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Verification Required */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Verification</label>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 p-2 rounded-lg transition">
                            <input
                              type="radio"
                              checked={filters.verificationRequired === null}
                              onChange={() => setFilters(prev => ({ ...prev, verificationRequired: null }))}
                              className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                            />
                            <span className="text-xs font-medium text-gray-900 dark:text-white">All</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 p-2 rounded-lg transition">
                            <input
                              type="radio"
                              checked={filters.verificationRequired === true}
                              onChange={() => setFilters(prev => ({ ...prev, verificationRequired: true }))}
                              className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                            />
                            <span className="text-xs font-medium text-gray-900 dark:text-white">Required</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 p-2 rounded-lg transition">
                            <input
                              type="radio"
                              checked={filters.verificationRequired === false}
                              onChange={() => setFilters(prev => ({ ...prev, verificationRequired: false }))}
                              className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                            />
                            <span className="text-xs font-medium text-gray-900 dark:text-white">Not Required</span>
                          </label>
                        </div>
                      </div>

                      {/* Attachment Required */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Attachment</label>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 p-2 rounded-lg transition">
                            <input
                              type="radio"
                              checked={filters.attachmentRequired === null}
                              onChange={() => setFilters(prev => ({ ...prev, attachmentRequired: null }))}
                              className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                            />
                            <span className="text-xs font-medium text-gray-900 dark:text-white">All</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 p-2 rounded-lg transition">
                            <input
                              type="radio"
                              checked={filters.attachmentRequired === true}
                              onChange={() => setFilters(prev => ({ ...prev, attachmentRequired: true }))}
                              className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                            />
                            <span className="text-xs font-medium text-gray-900 dark:text-white">Required</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer hover:bg-[var(--theme-lighter)] dark:hover:bg-gray-700 p-2 rounded-lg transition">
                            <input
                              type="radio"
                              checked={filters.attachmentRequired === false}
                              onChange={() => setFilters(prev => ({ ...prev, attachmentRequired: false }))}
                              className="w-3.5 h-3.5 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                            />
                            <span className="text-xs font-medium text-gray-900 dark:text-white">Not Required</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={clearAllFilters}
                        className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm font-semibold rounded-lg transition"
                      >
                        Clear All
                      </button>
                      <button
                        onClick={() => {
                          setShowFilterModal(false);
                          setCurrentPage(1);
                        }}
                        className="flex-1 px-4 py-2 bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] text-gray-900 text-sm font-bold rounded-lg transition shadow-md"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Details Sidebar - Slides from right */}
        <AnimatePresence>
          {showDetailsSidebar && selectedChecklist && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 bg-black/50 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDetailsSidebar(false)}
              />

              {/* Sidebar */}
              <motion.div
                className="fixed right-0 top-0 h-full w-full md:w-[600px] bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-y-auto"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              >
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-[var(--theme-primary)] to-[#f5c842] p-6 z-10">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900">Task Details</h2>
                    <button
                      onClick={() => setShowDetailsSidebar(false)}
                      className="p-2 hover:bg-white/20 rounded-lg transition"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">#{selectedChecklist.id} - {selectedChecklist.question}</p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Task Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Task Information
                    </h3>
                    <div className="bg-[var(--theme-lighter)] dark:bg-gray-700 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)] flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Assignee</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{selectedChecklist.assignee}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)] flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Doer</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{selectedChecklist.doer_name || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)] flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Department</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{selectedChecklist.department || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedChecklist.priority === 'high' ? 'bg-red-500' :
                            selectedChecklist.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                            }`}>
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Priority</p>
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(selectedChecklist.priority)}`}>
                              {selectedChecklist.priority?.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)] flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Frequency</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{selectedChecklist.frequency}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)] flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Due Date</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDateToLocalTimezone(selectedChecklist.due_date)}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedChecklist.verification_required ? 'bg-blue-500' : 'bg-gray-400'
                            }`}>
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Verification</p>
                            <span className={`text-sm font-semibold ${selectedChecklist.verification_required ? 'text-blue-600' : 'text-gray-400'}`}>
                              {selectedChecklist.verification_required ? `Yes (${selectedChecklist.verifier_name})` : 'No'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedChecklist.attachment_required ? 'bg-green-500' : 'bg-gray-400'
                            }`}>
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Attachment</p>
                            <span className={`text-sm font-semibold ${selectedChecklist.attachment_required ? 'text-green-600' : 'text-gray-400'}`}>
                              {selectedChecklist.attachment_required ? 'Required' : 'Not Required'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Evidence Documents - Combined from current and history */}
                  {(() => {
                    const currentAttachment = (selectedChecklist as any).attachment_url;
                    const historyAttachments = revisionHistory
                      .map(h => h.attachment_url)
                      .filter(Boolean);

                    const allEvidence = Array.from(new Set([currentAttachment, ...historyAttachments])).filter(Boolean);

                    if (allEvidence.length === 0) return null;

                    return (
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Evidence Documents
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                          {allEvidence.map((doc, index) => (
                            <a
                              key={index}
                              href={doc}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-green-50 dark:bg-green-900/10 p-3 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/20 transition border border-green-100 dark:border-green-800"
                            >
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">EvidenceDoc_{index + 1}</span>
                                <span className="text-[10px] text-gray-500 truncate">{doc}</span>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Status Update */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Update Status</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Select Status
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {selectedChecklist.verification_required && (
                            <button
                              onClick={() => setTaskStatus('approval_waiting')}
                              className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${taskStatus === 'approval_waiting'
                                ? 'bg-yellow-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                            >
                              <span>⏳</span>
                              Approval Waiting
                            </button>
                          )}
                          <button
                            onClick={() => setTaskStatus('completed')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${taskStatus === 'completed'
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                              }`}
                          >
                            <span>✓</span>
                            Completed
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Add Remark
                        </label>
                        <textarea
                          value={remarkText}
                          onChange={(e) => setRemarkText(e.target.value)}
                          placeholder="Enter your remark..."
                          rows={3}
                          className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] transition text-sm resize-none"
                        />
                      </div>

                      {/* Existing Attachments */}
                      {/* Existing Attachments - REMOVED as we now only track in history */}


                      {selectedChecklist.attachment_required && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Attach File <span className="text-red-500">*</span>
                          </label>
                          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center hover:border-[var(--theme-primary)] transition cursor-pointer"
                            onClick={() => document.getElementById('attachmentFileInput')?.click()}
                          >
                            <input
                              id="attachmentFileInput"
                              type="file"
                              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                              className="hidden"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp3,.wav,.mp4"
                            />
                            <svg className="w-8 h-8 mx-auto mb-2 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              Click to select file or drag and drop
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Accepted: PDF, DOC, DOCX, JPG, PNG, MP3, WAV, MP4
                            </p>
                          </div>

                          {/* Selected file display */}
                          {attachmentFile && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between bg-[var(--theme-lighter)] dark:bg-gray-700 p-3 rounded-lg">
                                <div className="flex items-center gap-2 flex-1">
                                  <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{attachmentFile.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{(attachmentFile.size / 1024).toFixed(2)} KB</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setAttachmentFile(null)}
                                  className="ml-2 text-red-500 hover:text-red-600"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={handleStatusUpdate}
                          className="flex-1 px-4 py-2.5 bg-[var(--theme-primary)] hover:bg-[var(--theme-secondary)] text-gray-900 font-bold rounded-xl transition"
                        >
                          Update Status
                        </button>
                        <button
                          onClick={handleAddRemark}
                          className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition"
                        >
                          Add Remark Only
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Remark History */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Remark History</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {loadingRemarks ? (
                        <div className="flex justify-center items-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[var(--theme-primary)] border-t-transparent"></div>
                        </div>
                      ) : remarks.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No remarks yet</p>
                      ) : (
                        remarks.map((remark, index) => (
                          <div key={index} className="bg-[var(--theme-lighter)] dark:bg-gray-700 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <p className="font-semibold text-sm text-gray-900 dark:text-white">{remark.username}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateToLocalTimezone(remark.created_at)}</p>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{remark.remark}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Revision History */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Status History</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {loadingHistory ? (
                        <div className="flex justify-center items-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[var(--theme-primary)] border-t-transparent"></div>
                        </div>
                      ) : revisionHistory.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No status history yet</p>
                      ) : (
                        revisionHistory.map((history, index) => (
                          <div key={index} className="bg-[var(--theme-light)] dark:bg-gray-700 rounded-lg p-4 border-l-4 border-[var(--theme-primary)]">
                            <div className="flex justify-between items-start mb-2">
                              <p className="font-semibold text-sm text-gray-900 dark:text-white">Status Changed by {history.username}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateToLocalTimezone(history.timestamp)}</p>
                            </div>
                            <div className="text-xs space-y-1">
                              <p className="text-gray-700 dark:text-gray-300">
                                <span className="font-semibold">Status:</span> {history.old_status} → {history.new_status}
                              </p>
                              {history.remark && (
                                <p className="text-gray-700 dark:text-gray-300">
                                  <span className="font-semibold">Remark:</span> {history.remark}
                                </p>
                              )}
                              {history.attachment_url && (
                                <p className="text-gray-700 dark:text-gray-300">
                                  <span className="font-semibold">Attachment:</span>{' '}
                                  <a
                                    href={history.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    View Document
                                  </a>
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </LayoutWrapper>
  );
}

export default function ChecklistPage() {
  return (
    <Suspense fallback={
      <LayoutWrapper>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--theme-primary)]"></div>
        </div>
      </LayoutWrapper>
    }>
      <ChecklistContent />
    </Suspense>
  );
}


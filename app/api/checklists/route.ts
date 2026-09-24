import { NextRequest, NextResponse } from 'next/server';
import { getChecklists, createChecklist, createChecklistsBatch, updateChecklist, deleteChecklist, deleteChecklistsByGroupId, updateChecklistsByGroupId, getChecklistIdsWithHistory } from '@/lib/sheets';
import { expandMasterChecklist } from '@/lib/checklistOccurrences';

// Helper function to get day of week in IST (0=Sunday, 1=Monday, etc.)
function getISTDayOfWeek(date: Date): number {
  const istDateStr = date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istDateStr);
  return istDate.getDay();
}


import { parseSheetDate } from '@/lib/dateUtils';

// Helper function to calculate status based on due date
function calculateStatus(dueDate: string): string {
  if (!dueDate) return 'pending';

  try {
    const parsedStr = parseSheetDate(dueDate);
    if (!parsedStr) return 'pending';

    const due = new Date(parsedStr);
    const now = new Date();

    if (!isNaN(due.getTime())) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

      if (dueDay < today) {
        return 'overdue';
      } else if (dueDay.getTime() === today.getTime()) {
        return 'pending';
      } else {
        return 'planned';
      }
    }
  } catch (e) {
    console.error('Error parsing due date for status:', e);
  }

  return 'pending';
}

// Helper function to generate dates based on frequency
function generateDatesFromFrequency(
  fromDate: Date,
  frequency: string,
  weeklyDays?: number[], // Array of day numbers: 1=Monday, 2=Tuesday, ..., 6=Saturday
  selectedDates?: string[] // Array of date strings in YYYY-MM-DD format for monthly/quarterly/yearly
): Date[] {
  const dates: Date[] = [];

  // Create a working date in local time
  let currentDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());

  console.log(`Generating first ${frequency} date from ${currentDate.toDateString()}`);

  switch (frequency.toLowerCase()) {
    case 'daily':
      // Generate only one daily task
      // Skip if it's a Sunday, move to Monday
      let dayOfWeek = currentDate.getDay();
      if (dayOfWeek === 0) { // 0 = Sunday
        currentDate.setDate(currentDate.getDate() + 1); // Move to Monday
      }

      const taskDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
        fromDate.getHours(),
        fromDate.getMinutes(),
        fromDate.getSeconds()
      );
      dates.push(taskDate);

      console.log(`Generated 1 daily date (skipping Sunday if needed)`);
      break;

    case 'weekly':
      // Generate one row for each selected day
      // If weeklyDays provided, use all of them; otherwise use the day from fromDate
      const daysToGenerate = weeklyDays && weeklyDays.length > 0
        ? weeklyDays
        : [fromDate.getDay()];

      console.log(`Weekly frequency - generating tasks for ${daysToGenerate.length} days: ${daysToGenerate.join(', ')}`);

      // Generate a task for each selected day
      daysToGenerate.forEach(targetDay => {
        // Create a fresh date for each day calculation
        const dateForDay = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        const currentDay = dateForDay.getDay();

        // Calculate days until next occurrence of target day
        let daysUntilTarget = targetDay - currentDay;
        if (daysUntilTarget < 0) {
          daysUntilTarget += 7; // Move to next week
        }

        dateForDay.setDate(dateForDay.getDate() + daysUntilTarget);

        const weeklyTaskDate = new Date(
          dateForDay.getFullYear(),
          dateForDay.getMonth(),
          dateForDay.getDate(),
          fromDate.getHours(),
          fromDate.getMinutes(),
          fromDate.getSeconds()
        );

        dates.push(weeklyTaskDate);
        console.log(`Added weekly task for day ${targetDay}: ${weeklyTaskDate.toDateString()}`);
      });

      console.log(`Generated ${dates.length} weekly dates`);
      break;

    case 'monthly':
      // Generate tasks for each selected date of the month
      // If selectedDates provided, use those; otherwise use the day from fromDate
      const monthlyDates = selectedDates && selectedDates.length > 0
        ? selectedDates.map(dateStr => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return day;
        })
        : [fromDate.getDate()];

      console.log(`Monthly frequency - generating tasks for ${monthlyDates.length} dates: ${monthlyDates.join(', ')}`);

      monthlyDates.forEach(dayOfMonth => {
        // Create date for this day of the current month
        const monthlyTaskDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          dayOfMonth,
          fromDate.getHours(),
          fromDate.getMinutes(),
          fromDate.getSeconds()
        );

        // If date falls on Sunday, shift to Saturday
        const monthlyDayOfWeek = monthlyTaskDate.getDay();
        if (monthlyDayOfWeek === 0) { // 0 = Sunday
          monthlyTaskDate.setDate(monthlyTaskDate.getDate() - 1);
        }

        dates.push(monthlyTaskDate);
        console.log(`Added monthly task for day ${dayOfMonth}: ${monthlyTaskDate.toDateString()}`);
      });

      console.log(`Generated ${dates.length} monthly dates`);
      break;

    case 'quarterly':
      // Generate tasks for each selected date
      // If selectedDates provided, use those; otherwise use the day from fromDate
      const quarterlyDates = selectedDates && selectedDates.length > 0
        ? selectedDates.map(dateStr => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return { month: month - 1, day }; // month is 0-indexed
        })
        : [{ month: fromDate.getMonth(), day: fromDate.getDate() }];

      console.log(`Quarterly frequency - generating tasks for ${quarterlyDates.length} dates`);

      quarterlyDates.forEach(dateInfo => {
        // Create date for this specific date
        const quarterlyTaskDate = new Date(
          currentDate.getFullYear(),
          dateInfo.month,
          dateInfo.day,
          fromDate.getHours(),
          fromDate.getMinutes(),
          fromDate.getSeconds()
        );

        // If date falls on Sunday, shift to Saturday
        const quarterlyDayOfWeek = quarterlyTaskDate.getDay();
        if (quarterlyDayOfWeek === 0) { // 0 = Sunday
          quarterlyTaskDate.setDate(quarterlyTaskDate.getDate() - 1);
        }

        dates.push(quarterlyTaskDate);
        console.log(`Added quarterly task for ${dateInfo.month + 1}/${dateInfo.day}: ${quarterlyTaskDate.toDateString()}`);
      });

      console.log(`Generated ${dates.length} quarterly dates`);
      break;

    case 'yearly':
      // Generate tasks for each selected date
      // If selectedDates provided, use those; otherwise use the date from fromDate
      const yearlyDates = selectedDates && selectedDates.length > 0
        ? selectedDates.map(dateStr => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return { month: month - 1, day }; // month is 0-indexed
        })
        : [{ month: fromDate.getMonth(), day: fromDate.getDate() }];

      console.log(`Yearly frequency - generating tasks for ${yearlyDates.length} dates`);

      yearlyDates.forEach(dateInfo => {
        // Create date for this specific date in the current year
        const yearlyTaskDate = new Date(
          currentDate.getFullYear(),
          dateInfo.month,
          dateInfo.day,
          fromDate.getHours(),
          fromDate.getMinutes(),
          fromDate.getSeconds()
        );

        // If date falls on Sunday, shift to Saturday
        const yearlyDayOfWeek = yearlyTaskDate.getDay();
        if (yearlyDayOfWeek === 0) { // 0 = Sunday
          yearlyTaskDate.setDate(yearlyTaskDate.getDate() - 1);
        }

        dates.push(yearlyTaskDate);
        console.log(`Added yearly task for ${dateInfo.month + 1}/${dateInfo.day}: ${yearlyTaskDate.toDateString()}`);
      });

      console.log(`Generated ${dates.length} yearly dates`);
      break;

    default:
      break;
  }

  // Sort dates chronologically
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

// GET - Fetch all checklists
export async function GET(request: NextRequest) {
  try {
    const [checklists, historyLookup] = await Promise.all([
      getChecklists(),
      getChecklistIdsWithHistory()
    ]);

    const updatedChecklists = checklists.flatMap((checklist: any) => (
      expandMasterChecklist(checklist, historyLookup.latestStatus)
    ));

    return NextResponse.json({ checklists: updatedChecklists, masters: checklists });
  } catch (error: any) {
    console.error('Error fetching checklists (FULL):', error);
    console.error('Stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch checklists', details: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

// POST - Create new checklist(s) based on frequency
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      question,
      assignee,
      doerName,
      priority,
      department,
      frequency,
      dueDate,
      weeklyDays, // Array of selected day numbers for weekly
      selectedDates, // Array of selected dates for monthly/quarterly/yearly
      doers, // Array of doers
      createdBy
    } = body;

    let effectiveDueDate = dueDate;
    if (!effectiveDueDate && Array.isArray(selectedDates) && selectedDates.length > 0) {
      const first = [...selectedDates].sort()[0];
      effectiveDueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(first))
        ? `${first}T09:00:00+05:30`
        : first;
    }

    // Validate required fields
    if (!question || !assignee || !frequency || !effectiveDueDate) {
      return NextResponse.json(
        { error: !effectiveDueDate ? 'Please select a start date' : 'Missing required fields' },
        { status: 400 }
      );
    }

    // Parse and validate dueDate
    const parsedDueDate = new Date(effectiveDueDate);
    if (isNaN(parsedDueDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid due date format' },
        { status: 400 }
      );
    }

    console.log('Creating checklist with:', {
      question,
      assignee,
      doers,
      frequency,
      dueDate: parsedDueDate.toISOString(),
      year: parsedDueDate.getFullYear()
    });

    // Store one master row per doer. Occurrences are generated on read from frequency + due_date.
    const doersArray = doers && doers.length > 0 ? doers : [doerName || null];
    const allChecklistsData: any[] = [];

    const masterDates: Date[] = [];
    if (String(frequency).toLowerCase() === 'weekly' && Array.isArray(weeklyDays) && weeklyDays.length > 0) {
      weeklyDays.forEach((targetDay: number) => {
        const dateForDay = new Date(parsedDueDate.getFullYear(), parsedDueDate.getMonth(), parsedDueDate.getDate());
        const currentDay = dateForDay.getDay();
        let daysUntilTarget = targetDay - currentDay;
        if (daysUntilTarget < 0) daysUntilTarget += 7;
        dateForDay.setDate(dateForDay.getDate() + daysUntilTarget);
        masterDates.push(new Date(
          dateForDay.getFullYear(),
          dateForDay.getMonth(),
          dateForDay.getDate(),
          parsedDueDate.getHours(),
          parsedDueDate.getMinutes(),
          parsedDueDate.getSeconds()
        ));
      });
    } else if (Array.isArray(selectedDates) && selectedDates.length > 0) {
      selectedDates.forEach((dateStr: string) => {
        const [year, month, day] = String(dateStr).split('-').map(Number);
        if (year && month && day) {
          masterDates.push(new Date(year, month - 1, day, parsedDueDate.getHours(), parsedDueDate.getMinutes(), parsedDueDate.getSeconds()));
        }
      });
    }
    if (masterDates.length === 0) masterDates.push(parsedDueDate);

    for (const doer of doersArray) {
      for (const masterDue of masterDates) {
        allChecklistsData.push({
          question,
          assignee,
          doer_name: doer,
          priority: priority || 'medium',
          department: department || null,
          frequency,
          due_date: masterDue.toISOString(),
        });
      }
    }

    // Use batch insert for better performance and proper ID sequencing
    const result = await createChecklistsBatch(allChecklistsData);

    return NextResponse.json({
      message: 'Checklists created successfully',
      count: result.count,
      id: result.firstId
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating checklists:', error);
    return NextResponse.json({ error: 'Failed to create checklists' }, { status: 500 });
  }
}

// PUT - Update checklist
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      group_id,
      question,
      assignee,
      doerName,
      priority,
      department,
    } = body;

    const updates: Record<string, any> = {
      question,
      assignee,
      doer_name: doerName || null,
      priority,
      department: department || null,
    };
    if (body.frequency) updates.frequency = body.frequency;
    if (body.dueDate) updates.due_date = body.dueDate;

    // Prefer id now that group_id is no longer on the sheet
    if (id) {
      const updatedChecklist = await updateChecklist(id, updates);
      return NextResponse.json({ checklist: updatedChecklist, updated: 1 });
    }

    if (group_id) {
      const result = await updateChecklistsByGroupId(group_id, updates);
      return NextResponse.json({
        message: 'Checklists updated successfully',
        updated: result.updated
      });
    }

    return NextResponse.json({ error: 'Checklist ID or group_id is required' }, { status: 400 });
  } catch (error) {
    console.error('Error updating checklist:', error);
    return NextResponse.json({ error: 'Failed to update checklist' }, { status: 500 });
  }
}

// DELETE - Delete checklist
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const groupId = searchParams.get('group_id');

    if (!id && !groupId) {
      return NextResponse.json({ error: 'Checklist ID or group_id is required' }, { status: 400 });
    }

    if (groupId) {
      // Delete all checklists with this group_id
      const result = await deleteChecklistsByGroupId(groupId);
      return NextResponse.json({ message: `${result.deleted} checklists deleted successfully`, deleted: result.deleted });
    } else if (id) {
      // Delete single checklist by id
      await deleteChecklist(parseInt(id));
      return NextResponse.json({ message: 'Checklist deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting checklist:', error);
    return NextResponse.json({ error: 'Failed to delete checklist' }, { status: 500 });
  }
}
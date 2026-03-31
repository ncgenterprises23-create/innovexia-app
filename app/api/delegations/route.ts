import { NextRequest, NextResponse } from 'next/server';
import { getDelegations, createDelegation, updateDelegation, deleteDelegation, createMultipleDelegations } from '@/lib/sheets';
import { formatToSheetDate, parseDateString } from '@/lib/dateUtils';


export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const role = request.nextUrl.searchParams.get('role');
    const username = request.nextUrl.searchParams.get('username');

    // If no userId provided (like in Score page), fetch all as admin
    if (!userId) {
      const delegations = await getDelegations(0, 'admin');
      return NextResponse.json({ delegations });
    }

    const delegations = await getDelegations(parseInt(userId), role || undefined, username || undefined);

    return NextResponse.json({ delegations });
  } catch (error) {
    console.error('Error fetching delegations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delegations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      delegationName,
      description,
      assignedTo,
      doers, // Array of doers
      department,
      priority,
      dueDate,
      voiceNoteUrl,
      referenceDocs,
      evidenceRequired
    } = await request.json();

    if (!userId || !delegationName || !assignedTo) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use raw dueDate as fallback, but try to format it
    let adjustedDueDate = dueDate;

    // Calculate dynamic status based on due date
    let status = 'pending';
    if (dueDate) {
      const now = new Date();
      const due = parseDateString(dueDate);

      if (due && !isNaN(due.getTime())) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

        if (due < now) {
          status = 'overdue';
        } else if (dueDay.getTime() === today.getTime()) {
          status = 'pending';
        } else {
          status = 'planned';
        }

        // Use normalized format for sheet
        adjustedDueDate = formatToSheetDate(due);
      }
    }

    // Handle multiple doers - create separate delegation for each doer
    const doersArray = doers && doers.length > 0 ? doers : [null];

    const delegationsData = doersArray.map((doer: string | null) => ({
      user_id: userId,
      delegation_name: delegationName,
      description: description || null,
      assigned_to: assignedTo,
      doer_name: doer,
      department: department || null,
      priority: priority || 'medium',
      due_date: adjustedDueDate,
      status: status,
      voice_note_url: voiceNoteUrl || null,
      reference_docs: referenceDocs || null,
      evidence_required: evidenceRequired || false,
    }));

    const createdDelegations = await createMultipleDelegations(delegationsData);

    return NextResponse.json({
      delegation: createdDelegations[0], // Return first one for backward compatibility
      count: createdDelegations.length
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating delegation:', error);
    console.error('Error details:', error.message);
    return NextResponse.json(
      { error: `Failed to create delegation: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const {
      id,
      delegationName,
      description,
      assignedTo,
      doerName,
      doers, // Add doers array
      department,
      priority,
      dueDate,
      voiceNoteUrl,
      referenceDocs,
      evidenceRequired
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Delegation ID is required' },
        { status: 400 }
      );
    }

    // Use raw dueDate as fallback, but try to format it
    let adjustedDueDate = dueDate;

    // Calculate dynamic status based on due date
    let status = 'pending';
    if (dueDate) {
      try {
        const now = new Date();
        const due = parseDateString(dueDate);

        if (due && !isNaN(due.getTime())) {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

          if (due < now) {
            status = 'overdue';
          } else if (dueDay.getTime() === today.getTime()) {
            status = 'pending';
          } else {
            status = 'planned';
          }

          adjustedDueDate = formatToSheetDate(due);
        }
      } catch (e) {
        console.error('Error parsing due date for status:', e);
      }
    }

    // Determine doer name: prioritize doerName, then first element of doers array
    const resolvedDoerName = doerName || (doers && doers.length > 0 ? doers[0] : null);

    const delegationData = {
      delegation_name: delegationName,
      description: description || null,
      assigned_to: assignedTo,
      doer_name: resolvedDoerName, // Updated logic
      department: department || null,
      priority: priority || 'medium',
      status: status,
      due_date: adjustedDueDate,
      voice_note_url: voiceNoteUrl || null,
      reference_docs: referenceDocs || null,
      evidence_required: evidenceRequired || false,
    };

    const result = await updateDelegation(id, delegationData);

    if (!result) {
      return NextResponse.json(
        { error: 'Delegation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ delegation: result });
  } catch (error) {
    console.error('Error updating delegation:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Failed to update delegation', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Delegation ID is required' },
        { status: 400 }
      );
    }

    const result = await deleteDelegation(parseInt(id));

    if (!result) {
      return NextResponse.json(
        { error: 'Delegation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Delegation deleted successfully' });
  } catch (error) {
    console.error('Error deleting delegation:', error);
    return NextResponse.json(
      { error: 'Failed to delete delegation' },
      { status: 500 }
    );
  }
}

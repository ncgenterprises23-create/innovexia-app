import { NextRequest, NextResponse } from 'next/server';
import { updateChecklist, createChecklistHistoryBatch } from '@/lib/sheets';
import { resolveOccurrenceDue } from '@/lib/checklistOccurrences';

type BulkItem = {
  checklistId: number;
  occurrenceDate?: string;
  dueDate?: string;
  occurrenceId?: string;
  groupId?: string;
  previousStatus?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, status, userId, username } = body as {
      items: BulkItem[];
      status: string;
      userId: number;
      username?: string;
    };

    if (!userId || !status || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items, status, and userId are required' }, { status: 400 });
    }

    const batchId = `bulk_${Date.now()}`;
    const now = new Date().toISOString();
    const historyEntries: any[] = [];
    const failed: { checklistId: number; occurrenceDate?: string; reason: string }[] = [];
    const seen = new Set<string>();

    for (const raw of items) {
      const parsedChecklistId = parseInt(String(raw.checklistId), 10);
      const occurrenceDue = resolveOccurrenceDue(raw.occurrenceDate, raw.dueDate);

      if (!parsedChecklistId || !occurrenceDue) {
        failed.push({
          checklistId: raw.checklistId,
          occurrenceDate: String(raw.occurrenceDate ?? raw.dueDate ?? ''),
          reason: 'Missing or invalid occurrence date (each row needs its own date)',
        });
        continue;
      }

      const dedupeKey = `${parsedChecklistId}|${occurrenceDue}`;
      if (seen.has(dedupeKey)) {
        failed.push({
          checklistId: parsedChecklistId,
          occurrenceDate: occurrenceDue,
          reason: 'Duplicate checklist + date in the same batch',
        });
        continue;
      }
      seen.add(dedupeKey);

      const groupId = String(raw.groupId || '').trim() || `chk_${parsedChecklistId}`;
      const oldStatus = String(raw.previousStatus || 'pending').trim() || 'pending';

      historyEntries.push({
        checklist_id: parsedChecklistId,
        group_id: groupId,
        user_id: userId,
        username: username || 'Unknown User',
        action: 'status_change',
        old_status: oldStatus,
        new_status: status,
        due_date: occurrenceDue,
        timestamp: now,
      });
    }

    if (historyEntries.length === 0) {
      return NextResponse.json(
        { error: 'No valid items to complete', requested: items.length, failed, failures: failed },
        { status: 400 }
      );
    }

    const uniqueMasterIds = [...new Set(historyEntries.map((e) => e.checklist_id))];
    await Promise.all(
      uniqueMasterIds.map((id) => updateChecklist(id, { updated_at: now }))
    );

    const writeResult = await createChecklistHistoryBatch(historyEntries);

    console.log(
      `[checklist bulk] batch=${batchId} requested=${items.length} saved=${historyEntries.length} failed=${failed.length} sheetStartRow=${writeResult.startRow}`
    );

    return NextResponse.json({
      batchId,
      requested: items.length,
      completed: historyEntries.length,
      failed: failed.length,
      failures: failed,
      sheetStartRow: writeResult.startRow,
      saved: historyEntries.map((e) => ({
        checklistId: e.checklist_id,
        occurrenceDate: e.due_date,
      })),
    });
  } catch (error) {
    console.error('Bulk checklist status error:', error);
    return NextResponse.json({ error: 'Failed to bulk update checklist status' }, { status: 500 });
  }
}

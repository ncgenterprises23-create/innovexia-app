import { NextRequest, NextResponse } from 'next/server';
import { updateDelegation, createDelegationHistoryBatch } from '@/lib/sheets';

type BulkItem = {
  delegationId: number;
  previousStatus?: string;
  oldDueDate?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, status, userId } = body as {
      items: BulkItem[];
      status: string;
      userId: number;
    };

    if (!userId || !status || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items, status, and userId are required' }, { status: 400 });
    }

    const batchId = `delegation_bulk_${Date.now()}`;
    const historyEntries: any[] = [];
    const failed: { delegationId: number; reason: string }[] = [];
    const seen = new Set<number>();
    const updateIds: number[] = [];

    for (const raw of items) {
      const delegationId = parseInt(String(raw.delegationId), 10);
      if (!delegationId) {
        failed.push({ delegationId: raw.delegationId, reason: 'Invalid delegation id' });
        continue;
      }
      if (seen.has(delegationId)) {
        failed.push({ delegationId, reason: 'Duplicate delegation in the same batch' });
        continue;
      }
      seen.add(delegationId);

      const oldStatus = String(raw.previousStatus || 'pending').trim() || 'pending';
      const oldDueDate = raw.oldDueDate ?? '';
      const newDueDate = oldDueDate;

      historyEntries.push({
        delegation_id: delegationId,
        old_status: oldStatus,
        new_status: status,
        old_due_date: oldDueDate,
        new_due_date: newDueDate,
        reason: null,
        evidence_urls: null,
      });
      updateIds.push(delegationId);
    }

    if (historyEntries.length === 0) {
      return NextResponse.json(
        { error: 'No valid items to update', requested: items.length, failures: failed },
        { status: 400 }
      );
    }

    await Promise.all(
      updateIds.map((id) =>
        updateDelegation(id, {
          status,
          due_date: historyEntries.find((e) => e.delegation_id === id)?.new_due_date,
        })
      )
    );

    const writeResult = await createDelegationHistoryBatch(historyEntries);

    console.log(
      `[delegation bulk] batch=${batchId} requested=${items.length} saved=${historyEntries.length} failed=${failed.length} sheetStartRow=${writeResult.startRow}`
    );

    return NextResponse.json({
      batchId,
      requested: items.length,
      completed: historyEntries.length,
      failed: failed.length,
      failures: failed,
      sheetStartRow: writeResult.startRow,
      saved: updateIds,
    });
  } catch (error: any) {
    console.error('Bulk delegation status error:', error);
    return NextResponse.json(
      { error: `Failed to bulk update delegations: ${error.message || 'unknown error'}` },
      { status: 500 }
    );
  }
}

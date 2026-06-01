import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createO2DOrder, getO2DOrders, updateO2DOrder, deleteO2DOrder, updateO2DItem, deleteO2DItem, updateO2DFollowUp } from '@/lib/sheets';

export async function GET() {
    try {
        const orders = await getO2DOrders();
        return NextResponse.json(orders);
    } catch (error) {
        console.error('Error fetching O2D orders:', error);
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();

        // Validate required fields
        if (!data.party_name || !data.items || !Array.isArray(data.items) || data.items.length === 0) {
            return NextResponse.json(
                { error: 'Party name and items are required' },
                { status: 400 }
            );
        }

        // Validate items
        for (const item of data.items) {
            if (!item.item || !item.qty) {
                return NextResponse.json(
                    { error: 'Each item must have a name and quantity' },
                    { status: 400 }
                );
            }
        }

        const newOrder = await createO2DOrder(data);
        return NextResponse.json(newOrder);
    } catch (error) {
        console.error('Error creating O2D order:', error);
        return NextResponse.json(
            { error: 'Failed to create order' },
            { status: 500 }
        );
    }
}

export async function PUT(request: Request) {
    try {
        const data = await request.json();
        const { party_id, item_id, id, operation_type, ...orderData } = data;

        // Check if this is a single-item update (Details view)
        if (operation_type === 'item' && item_id) {
            const updatedItem = await updateO2DItem(parseInt(item_id), orderData);
            return NextResponse.json(updatedItem);
        }

        // Handle follow-up updates (can be for single item or party)
        if (operation_type === 'followup') {
            // Details view: use id for single row update
            if (id) {
                const updatedItem = await updateO2DItem(parseInt(id), orderData);
                return NextResponse.json(updatedItem);
            }
            // Group view: use party_id for all rows with same party
            if (party_id) {
                const updatedOrder = await updateO2DFollowUp(parseInt(party_id), orderData);
                return NextResponse.json(updatedOrder);
            }
            return NextResponse.json({ error: 'ID or Party ID is required for follow-up' }, { status: 400 });
        }

        // Otherwise, update entire party (Group view)
        if (!party_id) {
            return NextResponse.json({ error: 'Party ID is required' }, { status: 400 });
        }

        const updatedOrder = await updateO2DOrder(parseInt(party_id), orderData);
        return NextResponse.json(updatedOrder);
    } catch (error) {
        console.error('Error updating O2D order:', error);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const type = searchParams.get('type'); // 'party' or 'item'

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        // Check if this is a single-item delete (Details view)
        if (type === 'item') {
            await deleteO2DItem(parseInt(id));
            return NextResponse.json({ success: true, item_id: id });
        }

        // Otherwise, delete entire party (Group view)
        await deleteO2DOrder(parseInt(id));
        return NextResponse.json({ success: true, party_id: id });
    } catch (error) {
        console.error('Error deleting O2D order:', error);
        return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
    }
}

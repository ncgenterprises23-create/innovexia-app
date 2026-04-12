import { NextResponse } from 'next/server';
import {
    getFMSProductSearchData,
    createFMSProductSearchData,
    updateFMSProductSearchData,
    deleteFMSProductSearchData,
    getFMSProductSearchConfig,
    updateFMSProductSearchConfig
} from '@/lib/sheets';

export async function GET() {
    try {
        const data = await getFMSProductSearchData();
        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('Error fetching FMS Product Search data:', error);
        return NextResponse.json({ error: 'Failed to fetch data', details: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const products = Array.isArray(body) ? body : [body];

        if (products.length === 0) {
            return NextResponse.json({ error: 'At least one record is required' }, { status: 400 });
        }

        const validProducts = products.filter(p => p.Product?.trim());
        if (validProducts.length === 0) {
            return NextResponse.json({ error: 'Product is required for all records' }, { status: 400 });
        }

        const result = await createFMSProductSearchData(validProducts);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error adding FMS Product Search records:', error);
        return NextResponse.json({ error: 'Failed to add records', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const result = await updateFMSProductSearchData(id, body);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating FMS Product Search record:', error);
        return NextResponse.json({ error: 'Failed to update record', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await deleteFMSProductSearchData(id);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error deleting FMS Product Search record:', error);
        return NextResponse.json({ error: 'Failed to delete record', details: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { id, cancelled } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await updateFMSProductSearchData(id, { Cancelled: cancelled ? 'Yes' : '' });
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating FMS Product Search record:', error);
        return NextResponse.json({ error: 'Failed to update record', details: error.message }, { status: 500 });
    }
}

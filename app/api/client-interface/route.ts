import { NextResponse } from 'next/server';
import { 
    getClientInterfaceData, 
    createClientInterfaceData, 
    updateClientInterfaceData, 
    deleteClientInterfaceData 
} from '@/lib/sheets';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const tab = searchParams.get('tab');

        if (!tab) {
            return NextResponse.json({ error: 'Tab name is required' }, { status: 400 });
        }

        const data = await getClientInterfaceData(tab);
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in Client Interface GET API:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tab, data } = body;

        if (!tab || !data) {
            return NextResponse.json({ error: 'Tab name and data are required' }, { status: 400 });
        }

        const result = await createClientInterfaceData(tab, data);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in Client Interface POST API:', error);
        return NextResponse.json({ error: 'Failed to create data' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { tab, identifierKey, identifierValue, updates } = body;

        if (!tab || !identifierKey || identifierValue === undefined || !updates) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const result = await updateClientInterfaceData(tab, identifierKey, identifierValue, updates);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in Client Interface PUT API:', error);
        return NextResponse.json({ error: 'Failed to update data' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const tab = searchParams.get('tab');
        const identifierKey = searchParams.get('identifierKey');
        const identifierValue = searchParams.get('identifierValue');

        if (!tab || !identifierKey || !identifierValue) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const result = await deleteClientInterfaceData(tab, identifierKey, identifierValue);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in Client Interface DELETE API:', error);
        return NextResponse.json({ error: 'Failed to delete data' }, { status: 500 });
    }
}

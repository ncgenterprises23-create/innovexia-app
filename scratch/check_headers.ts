import { getClientInterfaceData } from './lib/sheets';

async function test() {
    try {
        const data = await getClientInterfaceData('PreOrder');
        console.log('Headers:', Object.keys(data[0]));
        console.log('Sample Row:', data[0]);
    } catch (e) {
        console.error(e);
    }
}

test();

import { NextResponse } from 'next/server';
import {
    getGoogleSheetsClient,
    getPurchaseFMSConfig,
    getFactoryRequirementConfig,
    getDiyRequirementConfig,
    getFMSProductSearchConfig,
    getJobWorkConfig,
    getRMDefectsConfig,
    getExportFMSConfig,
    getImportFMSConfig,
    getProductFMSConfig,
    getIgstRefundConfig,
    getO2DStepConfig,
    getCRMStepConfig,
    getClientComplainConfig,
} from '@/lib/sheets';

const COLLECTION_SPREADSHEET_ID = '1aouY4Y9J8haBehMHvmwRFNDhx4ugR2X0Ohrhnre7MXI';
const PAYABLE_SPREADSHEET_ID = '1z8d3C9GbwcXV4k4VCjLOUojHpLNjquUa8Fis0Wo7zro';

type RawStep = {
    step?: number | string;
    stepName?: string;
    doerName?: string;
    tatValue?: number | string;
    tatUnit?: string;
};

function normalizeSteps(config: RawStep[] | null | undefined) {
    if (!Array.isArray(config)) return [];
    return config.map((c) => ({
        step: Number(c.step) || 0,
        stepName: String(c.stepName || '').trim(),
        doerName: String(c.doerName || '').trim(),
        tatValue: c.tatValue != null && c.tatValue !== '' ? Number(c.tatValue) : undefined,
        tatUnit: c.tatUnit ? String(c.tatUnit) : undefined,
    }));
}

async function safeConfig(label: string, fn: () => Promise<RawStep[]>) {
    try {
        return normalizeSteps(await fn());
    } catch (error) {
        console.error(`Error fetching ${label} config:`, error);
        return [];
    }
}

async function getSingleDoer(spreadsheetId: string, label: string) {
    try {
        const sheets = await getGoogleSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Doer!A1',
        });
        return String(response.data.values?.[0]?.[0] || '').trim();
    } catch (error) {
        console.error(`Error fetching ${label} doer:`, error);
        return '';
    }
}

export async function GET() {
    try {
        const [
            purchase,
            factory,
            diy,
            productSearch,
            jobWork,
            rmDefects,
            exportFms,
            importFms,
            productFms,
            igst,
            o2d,
            crm,
            clientComplain,
            collectionDoer,
            payableDoer,
        ] = await Promise.all([
            safeConfig('Purchase FMS', getPurchaseFMSConfig),
            safeConfig('Factory Requirement', getFactoryRequirementConfig),
            safeConfig('DIY Requirement', getDiyRequirementConfig),
            safeConfig('New Product Search FMS', getFMSProductSearchConfig),
            safeConfig('Job Work', getJobWorkConfig),
            safeConfig('RM Defects', getRMDefectsConfig),
            safeConfig('Export FMS', getExportFMSConfig),
            safeConfig('Import FMS', getImportFMSConfig),
            safeConfig('New Product Requirement FMS', getProductFMSConfig),
            safeConfig('IGST Refund', getIgstRefundConfig),
            safeConfig('O2D', getO2DStepConfig),
            safeConfig('CRM', getCRMStepConfig),
            safeConfig('Client Complain', getClientComplainConfig),
            getSingleDoer(COLLECTION_SPREADSHEET_ID, 'Collection'),
            getSingleDoer(PAYABLE_SPREADSHEET_ID, 'Payable'),
        ]);

        const modules = [
            { id: 'purchase-fms', name: 'Purchase FMS', href: '/purchase-fms', hasSetup: true, steps: purchase },
            { id: 'factory-requirements', name: 'Factory Requirement', href: '/factory-requirements', hasSetup: true, steps: factory },
            { id: 'diy-requirement-fms', name: 'DIY Requirement FMS', href: '/diy-requirement-fms', hasSetup: true, steps: diy },
            { id: 'fms-product-search', name: 'New Product Search FMS', href: '/fms-product-search', hasSetup: true, steps: productSearch },
            { id: 'job-work', name: 'Job Work', href: '/job-work', hasSetup: true, steps: jobWork },
            { id: 'rm-defects', name: 'RM Defects', href: '/rm-defects', hasSetup: true, steps: rmDefects },
            { id: 'export-fms', name: 'Export FMS', href: '/export-fms', hasSetup: true, steps: exportFms },
            { id: 'import-fms', name: 'Import FMS', href: '/import-fms', hasSetup: true, steps: importFms },
            { id: 'product-fms', name: 'New Product Requirement FMS', href: '/product-fms', hasSetup: true, steps: productFms },
            { id: 'igst-refund', name: 'IGST Refund', href: '/igst-refund', hasSetup: true, steps: igst },
            { id: 'o2d', name: 'O2D', href: '/o2d', hasSetup: true, steps: o2d },
            { id: 'crm', name: 'CRM', href: '/crm', hasSetup: true, steps: crm },
            { id: 'client-complain', name: 'Client Complain', href: '/client-complain', hasSetup: true, steps: clientComplain },
            {
                id: 'collection',
                name: 'Collection',
                href: '/collection',
                hasSetup: false,
                steps: [{ step: 0, stepName: 'Responsible', doerName: collectionDoer }],
            },
            {
                id: 'payable',
                name: 'Payable',
                href: '/payable',
                hasSetup: false,
                steps: [{ step: 0, stepName: 'Responsible', doerName: payableDoer }],
            },
        ];

        return NextResponse.json({ modules });
    } catch (error) {
        console.error('Error fetching FMS doer alignment:', error);
        return NextResponse.json({ error: 'Failed to fetch FMS doer alignment' }, { status: 500 });
    }
}

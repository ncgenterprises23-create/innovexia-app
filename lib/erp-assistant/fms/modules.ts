import {
  getExportFMSData,
  getExportFMSConfig,
  getJobWorkData,
  getJobWorkConfig,
  getCRMData,
  getCRMStepConfig,
  getProductFMSData,
  getProductFMSConfig,
  getPurchaseFMSOrders,
  getPurchaseFMSConfig,
  getFactoryRequirements,
  getFactoryRequirementConfig,
  getExportEnquiryData,
  getExportEnquiryConfig,
  getImportFMSData,
  getImportFMSConfig,
  getFMSProductSearchData,
  getFMSProductSearchConfig,
} from '@/lib/sheets';
import type { StepStrategy } from './steps';

export type FmsModuleId =
  | 'export_fms'
  | 'job_work'
  | 'crm'
  | 'product_fms'
  | 'purchase_fms'
  | 'factory_requirements'
  | 'export_enquiry'
  | 'import_fms'
  | 'fms_product_search';

export interface FmsModuleDefinition {
  id: FmsModuleId;
  label: string;
  route: string;
  allowedRoles: string[];
  maxStep: number;
  stepStrategy: StepStrategy;
  getData: () => Promise<Record<string, unknown>[]>;
  getStepConfig: () => Promise<{ step: number; stepName?: string }[]>;
  summarizeItem: (item: Record<string, unknown>) => Record<string, unknown>;
}

const ADMIN_MANAGER = ['Admin', 'Manager'];

async function normalizeSheetRows(
  loader: () => Promise<unknown>
): Promise<Record<string, unknown>[]> {
  const result = await loader();
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === 'object' && 'data' in result) {
    const data = (result as { data?: unknown }).data;
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  }
  return [];
}

function makeSequentialModule(
  id: FmsModuleId,
  label: string,
  route: string,
  maxStep: number,
  getData: () => Promise<Record<string, unknown>[]>,
  getStepConfig: () => Promise<{ step: number; stepName?: string }[]>,
  summarizeItem: (item: Record<string, unknown>) => Record<string, unknown>
): FmsModuleDefinition {
  return {
    id,
    label,
    route,
    allowedRoles: ADMIN_MANAGER,
    maxStep,
    stepStrategy: 'sequential',
    getData,
    getStepConfig,
    summarizeItem,
  };
}

export const FMS_MODULES: Record<FmsModuleId, FmsModuleDefinition> = {
  export_fms: makeSequentialModule(
    'export_fms',
    'Export FMS',
    '/export-fms',
    17,
    async () => normalizeSheetRows(() => getExportFMSData()),
    async () => (await getExportFMSConfig()) as { step: number; stepName?: string }[],
    (item) => ({
      id: item.id,
      piNumber: item['PI Number'],
      partyName: item['Party Name'],
    })
  ),
  job_work: makeSequentialModule(
    'job_work',
    'Job Work',
    '/job-work',
    11,
    async () => normalizeSheetRows(() => getJobWorkData()),
    async () => (await getJobWorkConfig()) as { step: number; stepName?: string }[],
    (item) => ({
      id: item.id,
      partyName: item['Party Name'] ?? item.partyName,
    })
  ),
  crm: {
    id: 'crm',
    label: 'CRM',
    route: '/crm',
    allowedRoles: ADMIN_MANAGER,
    maxStep: 7,
    stepStrategy: 'firstGap',
    getData: async () => normalizeSheetRows(() => getCRMData()),
    getStepConfig: async () => (await getCRMStepConfig()) as { step: number; stepName?: string }[],
    summarizeItem: (item) => ({
      id: item.id,
      clientName: item['Client Name'] ?? item.client_name,
    }),
  },
  product_fms: {
    id: 'product_fms',
    label: 'Product FMS',
    route: '/product-fms',
    allowedRoles: ADMIN_MANAGER,
    maxStep: 15,
    stepStrategy: 'sequentialWithSkip',
    getData: async () => normalizeSheetRows(() => getProductFMSData()),
    getStepConfig: async () => {
      const cfg = await getProductFMSConfig();
      const steps = Array.isArray(cfg) ? cfg : [];
      return steps.map((c: { step?: number; stepName?: string }) => ({
        step: Number(c.step),
        stepName: c.stepName,
      }));
    },
    summarizeItem: (item) => ({
      id: item.id,
      productName: item['Product Name'] ?? item.product_name,
    }),
  },
  purchase_fms: makeSequentialModule(
    'purchase_fms',
    'Purchase FMS',
    '/purchase-fms',
    12,
    async () => normalizeSheetRows(() => getPurchaseFMSOrders()),
    async () => (await getPurchaseFMSConfig()) as { step: number; stepName?: string }[],
    (item) => ({ id: item.id, poNumber: item['PO Number'] ?? item.po_number })
  ),
  factory_requirements: makeSequentialModule(
    'factory_requirements',
    'Factory Requirements',
    '/factory-requirements',
    10,
    async () => normalizeSheetRows(() => getFactoryRequirements()),
    async () => (await getFactoryRequirementConfig()) as { step: number; stepName?: string }[],
    (item) => ({ id: item.id, requirement: item['Requirement'] ?? item.requirement })
  ),
  export_enquiry: makeSequentialModule(
    'export_enquiry',
    'Export Enquiry',
    '/export-enquiry',
    12,
    async () => normalizeSheetRows(() => getExportEnquiryData()),
    async () => (await getExportEnquiryConfig()) as { step: number; stepName?: string }[],
    (item) => ({ id: item.id, enquiryNo: item['Enquiry No'] ?? item.enquiry_no })
  ),
  import_fms: makeSequentialModule(
    'import_fms',
    'Import FMS',
    '/import-fms',
    12,
    async () => normalizeSheetRows(() => getImportFMSData()),
    async () => (await getImportFMSConfig()) as { step: number; stepName?: string }[],
    (item) => ({ id: item.id, piNumber: item['PI Number'] })
  ),
  fms_product_search: makeSequentialModule(
    'fms_product_search',
    'FMS Product Search',
    '/fms-product-search',
    10,
    async () => normalizeSheetRows(() => getFMSProductSearchData()),
    async () => (await getFMSProductSearchConfig()) as { step: number; stepName?: string }[],
    (item) => ({ id: item.id, product: item.Product ?? item.product })
  ),
};

export function listFmsModuleIds(): FmsModuleId[] {
  return Object.keys(FMS_MODULES) as FmsModuleId[];
}

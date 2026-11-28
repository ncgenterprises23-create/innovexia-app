/** Client-safe constants for Costing (no Google Sheets imports). */

export const COSTING_SHEET = 'Costing';

export const COSTING_HEADERS = [
  'id',
  'item_name',
  'item_code',
  'ims_type',
  'cost_price',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
] as const;
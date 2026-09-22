export interface NavMenuItem {
  label: string;
  icon: string;
  href?: string;
  roles: string[];
  children?: NavMenuItem[];
}

export const NAV_MENU_ITEMS: NavMenuItem[] = [
  { label: 'Dashboard', icon: 'chart', href: '/dashboard', roles: ['Admin', 'Manager', 'Employee'] },
  { label: 'PC Dashboard', icon: 'chart', href: '/pc-dashboard', roles: ['Admin', 'Manager', 'Employee'] },
  { label: 'Score', icon: 'trophy', href: '/score', roles: ['Admin', 'Manager'] },
  { label: 'FMS Doer Alignment', icon: 'users', href: '/fms-doer-alignment', roles: ['Admin', 'Manager'] },
  { label: 'Attendance', icon: 'clock', href: '/attendance', roles: ['Admin', 'Manager', 'Employee'] },
  {
    label: 'Tasks', icon: 'clipboard', roles: ['Admin', 'Manager', 'Employee'], children: [
      { label: 'Delegations', icon: 'clipboard', href: '/delegation', roles: ['Admin', 'Manager'] },
      { label: 'Checklist', icon: 'checklist', href: '/checklist', roles: ['Admin', 'Manager'] },
      { label: 'Todo', icon: 'check', href: '/todo', roles: ['Admin', 'Manager', 'Employee'] },
    ]
  },
  {
    label: 'CRM', icon: 'clipboard', roles: ['Admin', 'Manager'], children: [
      { label: 'CRM', icon: 'users', href: '/crm', roles: ['Admin', 'Manager'] },
      { label: 'O2D', icon: 'trending', href: '/o2d', roles: ['Admin', 'Manager'] },
      { label: 'Collection', icon: 'currency-dollar', href: '/collection', roles: ['Admin', 'Manager'] },
      { label: 'Payable', icon: 'currency-dollar', href: '/payable', roles: ['Admin', 'Manager'] },
      { label: 'Client Complain', icon: 'alert', href: '/client-complain', roles: ['Admin', 'Manager'] },
      { label: 'Dealer_Kit', icon: 'calendar', href: '/Dealer_Kit', roles: ['Admin', 'Manager'] },
    ]
  },
  {
    label: 'Sales', icon: 'currency-dollar', roles: ['Admin', 'Manager'], children: [
      { label: 'NBD', icon: 'document', href: '/nbd', roles: ['Admin', 'Manager'] },
      { label: 'NBD Incoming', icon: 'trending', href: '/nbd-incoming', roles: ['Admin', 'Manager'] },
      { label: 'CRR', icon: 'clipboard', href: '/crr', roles: ['Admin', 'Manager'] },
    ]
  },
  {
    label: 'Factory', icon: 'clipboard', roles: ['Admin', 'Manager'], children: [
      { label: 'Production', icon: 'factory', href: '/production', roles: ['Admin', 'Manager'] },
      { label: 'Scrap Sales', icon: 'clipboard', href: '/scrap-sales', roles: ['Admin', 'Manager'] },
      { label: 'Purchase FMS', icon: 'clock', href: '/purchase-fms', roles: ['Admin', 'Manager'] },
      { label: 'Factory Requirement', icon: 'document', href: '/factory-requirements', roles: ['Admin', 'Manager'] },
      { label: 'Diy Requirement FMS', icon: 'document', href: '/diy-requirement-fms', roles: ['Admin', 'Manager'] },
      { label: 'New Product Search FMS', icon: 'package', href: '/fms-product-search', roles: ['Admin', 'Manager'] },
      { label: 'New Product Requirement FMS', icon: 'package', href: '/product-fms', roles: ['Admin', 'Manager'] },
      { label: 'Job Work', icon: 'clipboard-check', href: '/job-work', roles: ['Admin', 'Manager'] },
      { label: 'RM Defects', icon: 'alert', href: '/rm-defects', roles: ['Admin', 'Manager'] },
      { label: 'RM Audit Stock', icon: 'clipboard-check', href: '/rm-audit-stock', roles: ['Admin', 'Manager'] },
    ],
  },
  {
    label: 'Export',
    icon: 'clipboard',
    roles: ['Admin', 'Manager'],
    children: [
      { label: 'Export FMS', icon: 'clipboard', href: '/export-fms', roles: ['Admin', 'Manager'] },
      { label: 'IGST Refund', icon: 'currency-dollar', href: '/igst-refund', roles: ['Admin', 'Manager'] },
    ]
  },
  {
    label: 'Import',
    icon: 'package',
    roles: ['Admin', 'Manager'],
    children: [
      { label: 'Import FMS', icon: 'clipboard', href: '/import-fms', roles: ['Admin', 'Manager'] },
    ]
  },
  {
    label: 'IMS', icon: 'clipboard', roles: ['Admin', 'Manager'], children: [
      { label: 'IMS RM', icon: 'package', href: '/ims-rm', roles: ['Admin', 'Manager'] },
      { label: 'IMS FG', icon: 'package', href: '/ims-fg', roles: ['Admin', 'Manager'] },
    ]
  },
  { label: 'Client Interface', icon: 'users', href: '/client-interface', roles: ['Admin', 'Manager', 'Employee'] },
  { label: 'HelpDesk', icon: 'headset', href: '/helpdesk', roles: ['Admin', 'Manager', 'Employee'] },
  { label: 'Users', icon: 'users', href: '/users', roles: ['Admin'] },
  { label: 'Chat', icon: 'message', href: '/chat', roles: ['Admin', 'Manager', 'Employee'] },
];

export function flattenNavPages(items: NavMenuItem[] = NAV_MENU_ITEMS) {
  const pages: { name: string; path: string; icon: string }[] = [];

  const walk = (nodes: NavMenuItem[]) => {
    for (const node of nodes) {
      if (node.href) {
        pages.push({ name: node.label, path: node.href, icon: node.icon });
      }
      if (node.children?.length) walk(node.children);
    }
  };

  walk(items);
  return pages;
}

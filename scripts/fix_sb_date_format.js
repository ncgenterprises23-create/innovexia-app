const fs = require('fs');
const path = 'app/igst-refund/page.tsx';
let c = fs.readFileSync(path, 'utf8');
c = c.replace(/\r\n/g, '\n');

// 1. Add formatDisplayDate utility
const newUtils = `const formatDisplayDate = (val: any) => {
    if (!val) return '-';
    // Handle Excel/Google Sheets serial numbers
    const num = Number(val);
    if (!isNaN(num) && num > 30000 && num < 60000) {
        const date = new Date((num - 25569) * 86400 * 1000);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    // Handle standard date strings
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return String(val);
};

const formatDateTime = (dateStr?: string) => {`;

c = c.replace('const formatDateTime = (dateStr?: string) => {', newUtils);

// 2. Use formatDisplayDate for Shipping_Bill_Date in the table
c = c.replace(
    '<span className="text-[11px] text-slate-500 dark:text-slate-400">{item.Shipping_Bill_Date || \'-\'}</span>',
    '<span className="text-[11px] text-slate-500 dark:text-slate-400">{formatDisplayDate(item.Shipping_Bill_Date)}</span>'
);

fs.writeFileSync(path, c, 'utf8');
console.log('Fixed SB Date display for Excel serial numbers');

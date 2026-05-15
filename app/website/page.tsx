'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLoader } from '@/components/LoaderProvider';
import { useToast } from '@/components/ToastProvider';
import { useRouter } from 'next/navigation';
import { ensureSessionId } from '@/utils/session';

const tabs = [
  { id: 'PreOrder', label: 'PRE-ORDER', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
  { id: 'Orders', label: 'ORDERS', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg> },
  { id: 'Inventory', label: 'INVENTORY', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
  { id: 'Freshness Report', label: 'FRESHNESS', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
  { id: 'Tracker', label: 'TRACKER', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { id: 'Documents', label: 'DOCUMENTS', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
];

const BRANDS = [
    'HERSHEYS', 'FERRERO', 'MARS INDIA', 'CADBURY', 'NESTLE', 'WRIGLEY', 'P&G', 
    'COLGATE', 'BROOKE BOND', 'HUL', 'PERFETTI', 'LOTUS BISCOFF', 'RED BULL', 
    'MARICO', 'COCA COLA', 'PEPSI CO', 'RECKITT BENCKISER', 'JOHNSON & JOHNSON'
];

const PRODUCT_TYPES = ['FOOD', 'NON FOOD'];

const getVal = (row: any, ...keys: string[]) => {
    for (const key of keys) {
        if (row[key] !== undefined) return row[key];
        if (row[key.toUpperCase()] !== undefined) return row[key.toUpperCase()];
        const foundKey = Object.keys(row).find(k => k.toUpperCase().includes(key.toUpperCase()));
        if (foundKey) return row[foundKey];
    }
    return '';
};

const formatImageUrl = (url: string) => {
    if (!url || typeof url !== 'string') return '';
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([^\/]+)/);
        if (match && match[1]) {
            return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
        }
        const idMatch = url.match(/id=([^\&]+)/);
        if (idMatch && idMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`;
        }
    }
    return url;
};

const ITEMS_PER_PAGE = 24;

export default function WebsitePage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [sortBy, setSortBy] = useState('Newest First');
  
  const [selectedProductType, setSelectedProductType] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [rateType, setRateType] = useState<'FOB 20FT' | 'FOB 40FT'>('FOB 20FT');
  const [expandedProduct, setExpandedProduct] = useState<any | null>(null);

  const { showLoader, hideLoader } = useLoader();
  const { addToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
        try {
          const sessionId = ensureSessionId();
          const response = await fetch('/api/auth', { headers: { 'x-session-id': sessionId } });
          const authData = await response.json();
          if (authData.authenticated) {
            setUser(authData.user);
          } else {
            router.push('/login');
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          router.push('/login');
        }
      };
      checkAuth();
  }, []);

  const fetchData = async (tabName: string) => {
    setLoading(true);
    showLoader();
    try {
      const response = await fetch(`/api/client-interface?tab=${encodeURIComponent(tabName)}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(Array.isArray(result) ? result : []);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error fetching data:', error);
      addToast(`Error loading ${tabName} data`, 'error');
      setData([]);
    } finally {
      setLoading(false);
      hideLoader();
    }
  };

  useEffect(() => {
    if (user) {
        fetchData(activeTab);
    }
  }, [activeTab, user]);

  const counts = useMemo(() => {
    const brandCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    data.forEach(row => {
        const brand = String(getVal(row, 'Brand') || '').toUpperCase();
        const type = String(getVal(row, 'Product Type') || '').toUpperCase();
        if (brand) brandCounts[brand] = (brandCounts[brand] || 0) + 1;
        if (type) typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    return { brandCounts, typeCounts };
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(q)));
    }
    if (selectedProductType) result = result.filter(row => String(getVal(row, 'Product Type') || '').toUpperCase() === selectedProductType.toUpperCase());
    if (selectedBrand) result = result.filter(row => String(getVal(row, 'Brand') || '').toUpperCase() === selectedBrand.toUpperCase());

    if (sortBy === 'Price: Low to High') {
        result.sort((a, b) => (parseFloat(String(getVal(a, rateType)).replace(/[^0-9.]/g, '')) || 0) - (parseFloat(String(getVal(b, rateType)).replace(/[^0-9.]/g, '')) || 0));
    } else if (sortBy === 'Price: High to Low') {
        result.sort((a, b) => (parseFloat(String(getVal(b, rateType)).replace(/[^0-9.]/g, '')) || 0) - (parseFloat(String(getVal(a, rateType)).replace(/[^0-9.]/g, '')) || 0));
    }
    return result;
  }, [data, searchQuery, selectedProductType, selectedBrand, sortBy, rateType]);

  const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedData, currentPage]);

  const updateCart = (product: any, qty: number) => {
    const productId = getVal(product, 'Ean Code', 'Product', 'id');
    setCart(prev => {
        const existing = prev.find(item => getVal(item, 'Ean Code', 'Product') === productId);
        if (existing) {
            const newQty = (existing.quantity || 0) + qty;
            if (newQty <= 0) return prev.filter(item => getVal(item, 'Ean Code', 'Product') !== productId);
            return prev.map(item => getVal(item, 'Ean Code', 'Product') === productId ? { ...item, quantity: newQty } : item);
        }
        if (qty > 0) return [...prev, { ...product, quantity: qty, selectedRateType: rateType }];
        return prev;
    });
  };

  const getCartQty = (product: any) => {
    const productId = getVal(product, 'Ean Code', 'Product', 'id');
    return cart.find(item => getVal(item, 'Ean Code', 'Product') === productId)?.quantity || 0;
  };

  const setCartQty = (product: any, newQty: number) => {
    const productId = getVal(product, 'Ean Code', 'Product', 'id');
    if (newQty <= 0) {
      setCart(prev => prev.filter(item => getVal(item, 'Ean Code', 'Product') !== productId));
    } else {
      setCart(prev => {
        const existing = prev.find(item => getVal(item, 'Ean Code', 'Product') === productId);
        if (existing) {
          return prev.map(item => getVal(item, 'Ean Code', 'Product') === productId ? { ...item, quantity: newQty } : item);
        }
        return [...prev, { ...product, quantity: newQty, selectedRateType: rateType }];
      });
    }
  };

  const setCartItemQty = (eanOrProduct: string, newQty: number) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(item => getVal(item, 'Ean Code', 'Product') !== eanOrProduct));
    } else {
      setCart(prev => prev.map(item => getVal(item, 'Ean Code', 'Product') === eanOrProduct ? { ...item, quantity: newQty } : item));
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const cartTotalPrice = cart.reduce((sum, item) => sum + ((parseFloat(String(getVal(item, item.selectedRateType)).replace(/[^0-9.]/g, '')) || 0) * (item.quantity || 0)), 0);
  const cartTotalCbm = cart.reduce((sum, item) => sum + ((parseFloat(String(getVal(item, 'Cbm')).replace(/[^0-9.]/g, '')) || 0) * (item.quantity || 0)), 0);
  const cartTotalGrm = cart.reduce((sum, item) => sum + ((parseFloat(String(getVal(item, 'Grm')).replace(/[^0-9.]/g, '')) || 0) * (item.quantity || 0)), 0);

  const containerCapacity = rateType === 'FOB 20FT' ? 28 : 67;
  const containerFillPercentage = Math.min(100, (cartTotalCbm / containerCapacity) * 100);

  const handleLogout = () => router.push('/login');
  const isUrl = (str: string) => typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'));

  const generateOrderPdf = () => {
    const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const rows = cart.map(item => {
      const name = getVal(item, 'Product');
      const brand = getVal(item, 'Brand');
      const ean = getVal(item, 'Ean Code');
      const grm = getVal(item, 'Grm');
      const cbm = parseFloat(String(getVal(item, 'Cbm')).replace(/[^0-9.]/g, '')) || 0;
      const rate = parseFloat(String(getVal(item, item.selectedRateType)).replace(/[^0-9.]/g, '')) || 0;
      const qty = item.quantity || 0;
      const totalCbm = (cbm * qty).toFixed(4);
      const totalPrice = (rate * qty).toFixed(2);
      return `<tr>
        <td>${brand}</td>
        <td>${name}</td>
        <td>${ean || '—'}</td>
        <td>${grm || '—'}</td>
        <td>${cbm.toFixed(4)}</td>
        <td>${item.selectedRateType}</td>
        <td>$${rate.toFixed(2)}</td>
        <td>${qty}</td>
        <td>${totalCbm}</td>
        <td><strong>$${totalPrice}</strong></td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><title>Innovexia Order Request</title><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; color: #1e293b; background: #fff; padding: 40px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #2874f0; }
      .brand { font-size: 32px; font-weight: 900; color: #2874f0; letter-spacing: -1px; }
      .brand span { color: #ff9f00; }
      .meta { text-align: right; font-size: 13px; color: #64748b; }
      .meta strong { display: block; color: #1e293b; font-size: 15px; font-weight: 700; }
      h2 { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; color: #94a3b8; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 32px; }
      thead tr { background: #2874f0; color: white; }
      thead th { padding: 10px 12px; text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
      tbody tr { border-bottom: 1px solid #f1f5f9; }
      tbody tr:hover { background: #f8fafc; }
      tbody td { padding: 10px 12px; vertical-align: middle; }
      tbody tr:nth-child(even) { background: #f8fafc; }
      .totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 24px; }
      .total-card { background: #f1f5f9; border-radius: 8px; padding: 20px; }
      .total-card .label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; margin-bottom: 6px; }
      .total-card .value { font-size: 28px; font-weight: 900; color: #2874f0; }
      .total-card.highlight { background: #2874f0; }
      .total-card.highlight .label { color: rgba(255,255,255,0.7); }
      .total-card.highlight .value { color: #fff; }
      .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
      @media print { body { padding: 20px; } }
    </style></head><body>
      <div class="header">
        <div>
          <div class="brand">Innov<span>exia</span></div>
          <div style="font-size:12px;color:#64748b;margin-top:4px">Enterprise Portal — Order Request</div>
        </div>
        <div class="meta">
          <strong>Date: ${date}</strong>
          Mode: ${rateType}<br/>
          Prepared by: ${user?.full_name || 'User'}<br/>
          Total Items: ${cartTotal} units
        </div>
      </div>

      <h2>Order Line Items</h2>
      <table>
        <thead><tr>
          <th>Brand</th><th>Product</th><th>EAN Code</th><th>Grm</th><th>CBM/Unit</th><th>Rate Mode</th><th>Unit Price</th><th>Qty</th><th>Total CBM</th><th>Total Price</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div class="total-card">
          <div class="label">Total Volume</div>
          <div class="value" style="font-size:22px;color:#10b981">${cartTotalCbm.toFixed(3)} m³</div>
        </div>
        <div class="total-card">
          <div class="label">Container Fill (${rateType === 'FOB 20FT' ? '20FT / 28 CBM' : '40FT / 67 CBM'})</div>
          <div class="value" style="font-size:22px;color:#f59e0b">${containerFillPercentage.toFixed(1)}%</div>
        </div>
        <div class="total-card highlight">
          <div class="label">Total Estimated Value</div>
          <div class="value">$${cartTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div class="footer">
        <span>Generated by Innovexia Enterprise Portal</span>
        <span>This is a pre-order request and not a confirmed order.</span>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 800);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#f1f3f6] dark:bg-gray-950 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Slim Header */}
      <header className="fixed top-0 left-0 right-0 z-[100] h-12 bg-[#2874f0] text-white flex items-center px-4 md:px-12 shadow-md">
        <div className="flex items-center gap-8 w-full max-w-[1600px] mx-auto">
            <div className="flex flex-col cursor-pointer shrink-0" onClick={() => router.push('/website')}>
              <span className="text-xl font-black italic leading-none">Innovexia</span>
              <span className="text-[10px] font-bold italic text-yellow-300 leading-none tracking-tight">Enterprise Portal</span>
            </div>

            <div className="flex-grow max-w-2xl relative">
                <input
                  type="text"
                  placeholder="Search globally across brands, EANs, and products..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-4 pr-12 py-1.5 text-slate-800 rounded-sm text-[13px] outline-none shadow-inner font-medium"
                />
                <button className="absolute right-0 top-0 h-full px-3 text-[#2874f0] hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
            </div>

            <div className="flex items-center gap-6 text-[14px] font-bold shrink-0">
                <button onClick={() => setShowCart(true)} className="flex items-center gap-2 hover:text-yellow-300 transition-colors">
                    <div className="relative">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
                        {cartTotal > 0 && <span className="absolute -top-2 -right-2 bg-yellow-400 text-[#2874f0] text-[10px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full border border-[#2874f0]">{cartTotal}</span>}
                    </div>
                    <span>Cart</span>
                </button>
                <button onClick={() => router.push('/dashboard')} className="px-3 py-1 bg-white text-[#2874f0] rounded-sm hover:bg-slate-100 transition-colors">ERP Dashboard</button>
                <div className="flex items-center gap-3 border-l border-white/20 pl-4">
                    <span className="text-[12px] opacity-80 truncate max-w-[100px]">{user.full_name}</span>
                    <button onClick={handleLogout} className="hover:text-red-300"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
                </div>
            </div>
        </div>
      </header>

      {/* Slim Tabs Subheader */}
      <div className="fixed top-12 left-0 right-0 z-50 bg-white shadow-sm h-10 flex items-center px-4 md:px-12 border-b">
        <div className="flex items-center justify-center gap-8 w-full overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`text-[12px] font-black whitespace-nowrap pb-2 transition-all border-b-2 flex items-center gap-2 ${activeTab === tab.id ? 'border-[#2874f0] text-[#2874f0]' : 'border-transparent text-slate-500 hover:text-[#2874f0]'}`}
                >
                    <span className="opacity-70">{tab.icon}</span>
                    {tab.label}
                </button>
            ))}
        </div>
      </div>

      <div className="flex pt-24 pb-10">
        {/* Compact & Fixed Sidebar */}
        <aside className="hidden lg:block w-[200px] shrink-0 h-[calc(100vh-6rem)] sticky top-24 bg-white shadow-sm overflow-y-auto no-scrollbar p-4 ml-2 rounded-sm border-r">
            <h3 className="text-[13px] font-black text-slate-800 mb-4 border-b pb-2 uppercase tracking-tighter">Filters</h3>
            
            <div className="mb-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Category</p>
                <div className="space-y-0.5">
                    <button onClick={() => setSelectedProductType(null)} className={`w-full flex justify-between items-center px-2 py-1.5 rounded-sm text-[13px] font-bold transition-colors ${!selectedProductType ? 'bg-blue-50 text-[#2874f0]' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <span>All</span>
                        <span className="text-[10px] opacity-40">{data.length}</span>
                    </button>
                    {PRODUCT_TYPES.map(type => (
                        <button key={type} onClick={() => setSelectedProductType(type)} className={`w-full flex justify-between items-center px-2 py-1.5 rounded-sm text-[13px] font-bold transition-colors ${selectedProductType === type ? 'bg-blue-50 text-[#2874f0]' : 'text-slate-600 hover:bg-slate-50'}`}>
                            <span className="truncate">{type}</span>
                            <span className="text-[10px] opacity-40">{counts.typeCounts[type] || 0}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Brands</p>
                <div className="space-y-0.5 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                    <button onClick={() => setSelectedBrand(null)} className={`w-full flex justify-between items-center px-2 py-1.5 rounded-sm text-[13px] font-bold transition-colors ${!selectedBrand ? 'bg-blue-50 text-[#2874f0]' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <span>All</span>
                        <span className="text-[10px] opacity-40">{data.length}</span>
                    </button>
                    {BRANDS.map(brand => (
                        <button key={brand} onClick={() => setSelectedBrand(brand)} className={`w-full flex justify-between items-center px-2 py-1.5 rounded-sm text-[13px] font-bold transition-colors ${selectedBrand === brand ? 'bg-blue-50 text-[#2874f0]' : 'text-slate-600 hover:bg-slate-50'}`}>
                            <span className="truncate mr-1">{brand}</span>
                            <span className="text-[10px] opacity-40 shrink-0">{counts.brandCounts[brand] || 0}</span>
                        </button>
                    ))}
                </div>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-grow px-2 md:px-4">
            
            <div className="bg-white p-3 mb-2 shadow-sm rounded-sm flex justify-between items-center flex-wrap gap-2 border border-slate-100">
                <div className="flex items-center gap-4">
                    <p className="text-[12px] font-bold text-slate-500">
                        Items: <span className="text-slate-900">{filteredAndSortedData.length}</span>
                        {selectedBrand && <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-[#2874f0] rounded-sm uppercase text-[9px] font-black border border-blue-100">{selectedBrand}</span>}
                    </p>

                    {activeTab === 'PreOrder' && (
                        <div className="flex items-center bg-[#f1f3f6] p-0.5 rounded-sm border">
                            <button onClick={() => setRateType('FOB 20FT')} className={`px-6 py-1.5 text-[10px] font-black rounded-sm transition-all ${rateType === 'FOB 20FT' ? 'bg-[#2874f0] text-white shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}>FOB 20FT</button>
                            <button onClick={() => setRateType('FOB 40FT')} className={`px-6 py-1.5 text-[10px] font-black rounded-sm transition-all ${rateType === 'FOB 40FT' ? 'bg-[#2874f0] text-white shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}>FOB 40FT</button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort By</span>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-[12px] font-black border-none outline-none cursor-pointer bg-[#f1f3f6] px-4 py-1.5 rounded-sm border">
                        <option>Newest First</option>
                        <option>Price: Low to High</option>
                        <option>Price: High to Low</option>
                    </select>
                </div>
            </div>

            <div className={`grid gap-2 ${activeTab === 'PreOrder' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6' : 'grid-cols-1'}`}>
                {loading ? Array(12).fill(0).map((_, i) => (
                    <div key={i} className="bg-white h-72 animate-pulse rounded-sm"></div>
                )) : activeTab === 'PreOrder' ? paginatedData.map((product, i) => {
                    const price = getVal(product, rateType);
                    const brand = getVal(product, 'Brand');
                    const name = getVal(product, 'Product');
                    const img = formatImageUrl(getVal(product, 'Image'));
                    const ean = getVal(product, 'Ean Code');
                    const qty = getCartQty(product);
                    
                    return (
                        <div key={i} className="bg-white p-4 flex flex-col group relative hover:shadow-xl transition-all cursor-pointer rounded-sm border border-transparent hover:border-blue-100" onClick={() => setExpandedProduct(product)}>
                            <div className="absolute top-1 right-1 z-10">
                                <a href={`https://www.google.com/search?q=${ean}`} target="_blank" onClick={(e) => e.stopPropagation()} className="px-2 py-1 bg-white/90 border border-slate-100 rounded text-[9px] font-black text-[#2874f0] hover:bg-blue-600 hover:text-white transition-colors">EAN: {ean || 'N/A'}</a>
                            </div>

                            <div className="h-44 mb-3 flex items-center justify-center overflow-hidden bg-slate-50 rounded-sm p-4">
                                {img ? <img src={img} referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain duration-300" alt={name} /> : <div className="text-4xl opacity-10">📦</div>}
                            </div>

                            <div className="flex-grow">
                                <p className="text-[10px] text-[#2874f0] font-black uppercase mb-0.5 tracking-tight">{brand}</p>
                                <h3 className="text-[13px] font-bold text-slate-800 line-clamp-2 leading-tight mb-2 group-hover:text-[#2874f0] transition-colors">{name}</h3>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-lg font-black text-slate-900">{price ? `$${price}` : 'Quote'}</span>
                                    {price && <span className="text-[10px] text-slate-400 font-black uppercase">{rateType.split(' ')[1]}</span>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <div className="text-[11px] bg-slate-50 p-2 rounded-sm font-black text-slate-500 flex flex-col items-center">
                                    <span className="text-[8px] opacity-40 uppercase">Grm</span>
                                    <span className="text-slate-800">{getVal(product, 'Grm') || '—'}</span>
                                </div>
                                <div className="text-[11px] bg-slate-50 p-2 rounded-sm font-black text-slate-500 flex flex-col items-center">
                                    <span className="text-[8px] opacity-40 uppercase">Cbm</span>
                                    <span className="text-slate-900">{getVal(product, 'Cbm') || '—'}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center bg-[#f1f3f6] rounded-sm p-1 border">
                                    <button onClick={() => updateCart(product, -1)} className="w-8 h-8 flex items-center justify-center text-[#2874f0] font-black hover:bg-white rounded-sm transition-colors text-sm">–</button>
                                    <input
                                      type="number"
                                      min="0"
                                      value={qty === 0 ? '' : qty}
                                      placeholder="0"
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        setCartQty(product, isNaN(val) ? 0 : val);
                                      }}
                                      className="w-10 text-center bg-transparent text-[12px] font-black text-slate-800 outline-none cursor-text"
                                    />
                                    <button onClick={() => updateCart(product, 1)} className="w-8 h-8 flex items-center justify-center text-[#2874f0] font-black hover:bg-white rounded-sm transition-colors text-sm">+</button>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); updateCart(product, 1); addToast('Added to cart', 'success'); }} className="flex-grow py-2.5 bg-[#ff9f00] text-white text-[10px] font-black rounded-sm hover:bg-[#fb641b] transition-all uppercase shadow-sm active:scale-95 tracking-widest">
                                    ADD
                                </button>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="bg-white overflow-hidden shadow-sm rounded-sm">
                        <div className="overflow-x-auto overflow-y-auto max-h-[700px] no-scrollbar">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-[#f1f3f6] text-slate-700 sticky top-0 z-10 border-b">
                                    <tr>
                                        {Object.keys(data[0] || {}).map(h => <th key={h} className="px-6 py-4 font-black text-[11px] uppercase tracking-tighter">{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50 border-b last:border-0 transition-colors text-[12px]">
                                            {Object.keys(data[0] || {}).map(h => (
                                                <td key={h} className="px-6 py-4 truncate max-w-[250px] text-slate-600 font-bold">
                                                    {isUrl(row[h]) ? <a href={row[h]} target="_blank" className="text-[#2874f0] font-black underline underline-offset-4">Open Link</a> : row[h] || '—'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {!loading && filteredAndSortedData.length > 0 && (
                <div className="mt-10 flex justify-center items-center gap-6 pb-12">
                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="px-6 py-2 bg-white shadow-sm rounded-sm text-[11px] font-black text-[#2874f0] border hover:bg-[#f1f3f6] disabled:opacity-30 uppercase tracking-widest transition-all">Previous</button>
                    <div className="flex gap-2">
                        {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                            const p = idx + 1;
                            return (
                                <button key={p} onClick={() => setCurrentPage(p)} className={`w-10 h-10 flex items-center justify-center rounded-full text-[11px] font-black transition-all ${currentPage === p ? 'bg-[#2874f0] text-white shadow-lg scale-110' : 'bg-white hover:bg-[#f1f3f6]'}`}>{p}</button>
                            );
                        })}
                    </div>
                    <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="px-6 py-2 bg-white shadow-sm rounded-sm text-[11px] font-black text-[#2874f0] border hover:bg-[#f1f3f6] disabled:opacity-30 uppercase tracking-widest transition-all">Next</button>
                </div>
            )}
        </main>
      </div>

      {/* Cart Drawer with Thick Progress Bar */}
      <AnimatePresence>
        {showCart && (
            <div className="fixed inset-0 z-[300] flex justify-end">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCart(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween' }} className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                        <div>
                            <h2 className="text-[13px] font-black text-slate-800 uppercase tracking-widest">My Selection ({cartTotal})</h2>
                            <p className="text-[10px] font-bold text-[#2874f0] mt-0.5 uppercase tracking-wider">{rateType} MODE</p>
                        </div>
                        <button onClick={() => setShowCart(false)} className="p-2 hover:bg-slate-200 rounded-sm transition-all"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>

                    <div className="p-6 bg-blue-50 border-b">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Container Volume</p>
                                <p className="text-xl font-black text-slate-900 leading-none">{cartTotalCbm.toFixed(3)} <span className="text-xs text-slate-400 font-bold tracking-tighter">/ {containerCapacity} m³</span></p>
                            </div>
                            <span className="text-[11px] font-black text-[#2874f0] uppercase">{containerFillPercentage.toFixed(1)}% Full</span>
                        </div>
                        <div className="w-full h-6 bg-white rounded-full overflow-hidden border border-blue-100 shadow-inner p-1">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${containerFillPercentage}%` }}
                                className={`h-full rounded-full transition-all duration-500 shadow-sm ${containerFillPercentage > 95 ? 'bg-red-500' : containerFillPercentage > 80 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                            />
                        </div>
                        <p className="text-[9px] text-slate-400 mt-2 font-bold italic tracking-tight">
                            * {rateType === 'FOB 20FT' ? '28' : '67'} CBM standard capacity used for optimization.
                        </p>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale">
                                <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                                <h3 className="text-sm font-black uppercase tracking-widest">Selection is empty</h3>
                            </div>
                        ) : cart.map((item, idx) => (
                            <div key={idx} className="flex gap-4 p-4 bg-slate-50 rounded-sm border border-slate-100 relative group transition-all hover:bg-white hover:shadow-md">
                                <div className="w-16 h-16 bg-white rounded-sm flex items-center justify-center p-1 border shrink-0 shadow-sm">
                                    {formatImageUrl(getVal(item, 'Image')) ? <img src={formatImageUrl(getVal(item, 'Image'))} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain" /> : <div className="text-2xl opacity-10">📦</div>}
                                </div>
                                <div className="flex-grow min-w-0">
                                    <h4 className="text-[12px] font-bold text-slate-800 truncate">{getVal(item, 'Product')}</h4>
                                    <div className="flex gap-4 mt-1">
                                        <p className="text-[9px] font-black text-[#2874f0] uppercase">{item.selectedRateType.split(' ')[1]}</p>
                                        <p className="text-[9px] font-black text-emerald-600 uppercase">CBM: {(parseFloat(String(getVal(item, 'Cbm')).replace(/[^0-9.]/g, '')) || 0).toFixed(3)}</p>
                                    </div>
                                    <div className="flex justify-between items-center mt-3">
                                        <div className="flex items-center bg-white rounded-sm border px-1 shadow-sm">
                                            <button onClick={() => updateCart(item, -1)} className="w-7 h-7 text-[#2874f0] font-black hover:bg-slate-50 rounded-sm transition-colors text-xs">–</button>
                                            <input
                                              type="number"
                                              min="0"
                                              value={item.quantity}
                                              onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                const id = getVal(item, 'Ean Code', 'Product');
                                                setCartItemQty(id, isNaN(val) ? 0 : val);
                                              }}
                                              className="w-10 text-center bg-transparent text-[12px] font-black text-slate-800 outline-none cursor-text"
                                            />
                                            <button onClick={() => updateCart(item, 1)} className="w-7 h-7 text-[#2874f0] font-black hover:bg-slate-50 rounded-sm transition-colors text-xs">+</button>
                                        </div>
                                        <span className="text-[13px] font-black text-slate-900">${((parseFloat(String(getVal(item, item.selectedRateType)).replace(/[^0-9.]/g, '')) || 0) * item.quantity).toFixed(2)}</span>
                                    </div>
                                </div>
                                <button onClick={() => updateCart(item, -item.quantity)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-slate-50 border-t shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Estimated</span>
                                <span className="text-3xl font-black text-[#2874f0] tracking-tighter">${cartTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Volume</span>
                                <span className="text-xl font-black text-emerald-600 tracking-tighter">{cartTotalCbm.toFixed(3)} m³</span>
                                <span className="text-[10px] font-black text-slate-400 block mt-0.5">{cartTotalGrm.toFixed(0)} g total</span>
                            </div>
                        </div>
                        <button disabled={cart.length === 0} onClick={generateOrderPdf} className="w-full py-4 bg-[#ff9f00] text-white font-black rounded-sm shadow-xl hover:bg-[#fb641b] transition-all uppercase tracking-[0.2em] text-[12px] disabled:opacity-30 active:scale-95 flex items-center justify-center gap-3">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            PROCEED TO ORDER REQUEST
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Logistics & Technical Specs Modal - Optimized for Single View */}
      <AnimatePresence>
        {expandedProduct && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setExpandedProduct(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-5xl max-h-[95vh] overflow-hidden rounded-sm shadow-2xl relative z-10 flex flex-col">
                    <div className="p-3 border-b flex justify-between items-center bg-slate-50">
                        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em]">Logistics & Technical Specs</h2>
                        <button onClick={() => setExpandedProduct(null)} className="p-1 hover:bg-slate-200 rounded-sm transition-all text-slate-400 hover:text-slate-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    
                    <div className="flex-grow overflow-hidden p-6 flex flex-col lg:flex-row gap-8">
                        <div className="lg:w-1/4 flex flex-col shrink-0">
                            <div className="aspect-square bg-slate-50 rounded-sm p-6 flex items-center justify-center border border-slate-100 mb-4 shadow-inner">
                                {formatImageUrl(getVal(expandedProduct, 'Image')) ? <img src={formatImageUrl(getVal(expandedProduct, 'Image'))} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain" /> : <div className="text-9xl opacity-10">📦</div>}
                            </div>
                            <p className="text-[10px] font-black text-[#2874f0] uppercase tracking-widest mb-1">{getVal(expandedProduct, 'Brand')}</p>
                            <h3 className="text-xl font-black text-slate-900 leading-[1.2] mb-4">{getVal(expandedProduct, 'Product')}</h3>
                            <div className="bg-blue-50 p-4 rounded-sm border-l-4 border-[#2874f0]">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] text-slate-500 font-black uppercase">Rate (20FT)</span>
                                    <span className="text-xl font-black text-[#2874f0]">${getVal(expandedProduct, 'Fob 20Ft')}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-500 font-black uppercase">Rate (40FT)</span>
                                    <span className="text-xl font-black text-[#2874f0]">${getVal(expandedProduct, 'Fob 40Ft')}</span>
                                </div>
                            </div>
                            <button onClick={() => { updateCart(expandedProduct, 1); addToast('Added', 'success'); }} className="mt-4 w-full py-3 bg-[#ff9f00] text-white font-black rounded-sm shadow-md hover:bg-[#fb641b] transition-all uppercase tracking-widest text-[11px] active:scale-95">ADD TO SELECTION</button>
                        </div>

                        <div className="lg:w-3/4 overflow-y-auto no-scrollbar">
                            <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.6em] mb-6 border-b pb-2">Operational Breakdown</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-6">
                                {[
                                    { label: 'EAN Code', val: getVal(expandedProduct, 'Ean Code') },
                                    { label: 'Category', val: getVal(expandedProduct, 'Product Type') },
                                    { label: 'Shelf Life', val: getVal(expandedProduct, 'Shelf Life') },
                                    { label: 'Grammage', val: getVal(expandedProduct, 'Grm') },
                                    { label: 'Volume (CBM)', val: getVal(expandedProduct, 'Cbm') },
                                    { label: 'Pcs/Carton', val: getVal(expandedProduct, 'Pcs/Carton') },
                                    { label: 'Inner Pack', val: getVal(expandedProduct, 'Inner Pack/Carton') },
                                    { label: 'Pcs/Inner', val: getVal(expandedProduct, 'Pcs /Inner Pack') },
                                    { label: 'Cases/Pallet', val: getVal(expandedProduct, 'Cases Per Pallet') },
                                    { label: 'Length (L)', val: getVal(expandedProduct, 'L') },
                                    { label: 'Width (B)', val: getVal(expandedProduct, 'B') },
                                    { label: 'Height (H)', val: getVal(expandedProduct, 'H') },
                                    { label: "20Ft Capacity", val: getVal(expandedProduct, "Case In 20Ft") },
                                    { label: "40Ft Capacity", val: getVal(expandedProduct, "Case In 40Ft") },
                                    { label: "Pallet 20'", val: getVal(expandedProduct, "Palletized Cases In 20'") },
                                    { label: "Pallet 40'", val: getVal(expandedProduct, "Palletized Cases In 40'") }
                                ].map((spec, sidx) => (
                                    <div key={sidx} className="border-b border-slate-50 pb-2 hover:border-blue-100 transition-colors">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{spec.label}</p>
                                        <p className="text-[15px] font-bold text-slate-800 truncate">{spec.val || '—'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

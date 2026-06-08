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
  { id: 'Freshness', label: 'FRESHNESS', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg> },
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
  const [viewLineItems, setViewLineItems] = useState<any[] | null>(null);
  const [ordersData, setOrdersData] = useState<any[]>([]);
  const [filterParty, setFilterParty] = useState('');
  const [filterPiNumber, setFilterPiNumber] = useState('');
  const [editingOrderPi, setEditingOrderPi] = useState<string | null>(null);

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
      const apiTabName = tabName === 'Freshness' ? 'Inventory' : tabName;
      const response = await fetch(`/api/client-interface?tab=${encodeURIComponent(apiTabName)}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(Array.isArray(result) ? result : []);
      setCurrentPage(1);
      // For Inventory or Freshness tab, also fetch Orders to cross-reference
      if (tabName === 'Inventory' || tabName === 'Freshness') {
        const ordRes = await fetch('/api/client-interface?tab=Orders');
        if (ordRes.ok) {
          const ordData = await ordRes.json();
          setOrdersData(Array.isArray(ordData) ? ordData : []);
        }
      }
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

  useEffect(() => {
    setFilterParty('');
    setFilterPiNumber('');
  }, [activeTab]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
        if (e.data === 'order_saved') {
            setCart([]);
            setEditingOrderPi(null);
            fetchData('Orders');
            setActiveTab('Orders');
            addToast('Order saved successfully', 'success');
        }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const getRowPartyAndPi = (row: any) => {
    const party = row['Party Name'] || row.Party_Name || row['PARTY NAME'] || row.Prepared_By || row['Prepared By'] || '';
    const pi = row['PI Number'] || row.PI_Number || row['PI NUMBER'] || '';
    return {
      party: String(party).trim(),
      pi: String(pi).trim()
    };
  };

  const dropdownOptions = useMemo(() => {
    const parties = new Set<string>();
    const piNumbers = new Set<string>();

    data.forEach(row => {
      const { party, pi } = getRowPartyAndPi(row);
      if (party) parties.add(party);
      
      if (filterParty) {
        if (party.toLowerCase() === filterParty.toLowerCase() && pi) {
          piNumbers.add(pi);
        }
      } else {
        if (pi) piNumbers.add(pi);
      }
    });

    return {
      parties: Array.from(parties).sort(),
      piNumbers: Array.from(piNumbers).sort()
    };
  }, [data, filterParty]);

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

    // Apply role-based filters first:
    const isClientUser = user?.role_name === 'Client';
    
    // Bypass party/user filtering for the PreOrder catalog
    if (activeTab !== 'PreOrder') {
        if (isClientUser && user) {
          const matchFullName = (user.full_name || '').toLowerCase();
          const matchUsername = (user.username || '').toLowerCase();
          
          result = result.filter(row => {
            const party = String(row['Party Name'] || row.Party_Name || row['PARTY NAME'] || '').toLowerCase();
            const pb = String(row.Prepared_By || row['Prepared By'] || '').toLowerCase();
            const username = String(row.Username || '').toLowerCase();
            
            return party.includes(matchFullName) || party.includes(matchUsername) ||
                   pb.includes(matchFullName) || pb.includes(matchUsername) ||
                   username.includes(matchFullName) || username.includes(matchUsername) ||
                   party === 'client user' || pb === 'client user';
          });
        }

        // Apply Party dropdown filter (for ERP User only)
        if (!isClientUser && filterParty) {
          result = result.filter(row => {
            const { party } = getRowPartyAndPi(row);
            return party.toLowerCase() === filterParty.toLowerCase();
          });
        }

        // Apply PI Number dropdown filter
        if (filterPiNumber) {
          result = result.filter(row => {
            const { pi } = getRowPartyAndPi(row);
            return pi.toLowerCase() === filterPiNumber.toLowerCase();
          });
        }
    }

    // Note: Tracker and Orders strict ERP filters were removed so ERP users can view all data through dropdowns.

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
  }, [data, searchQuery, selectedProductType, selectedBrand, sortBy, rateType, activeTab, user, filterParty, filterPiNumber]);

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

  const formatDateValue = (val: string, header?: string) => {
      if (!val) return val;
      const num = Number(val);
      const headerLower = header ? header.toLowerCase() : '';
      const dateHeaders = [
        'date', 'mfg', 'expiry', 
        'production', 'loading', 'on road to port', 'custom', 
        'waiting for vercel', 'sailed', 'about to arrive', 'arrived', 'created_at'
      ];
      const isDateHeader = header && dateHeaders.some(dh => headerLower.includes(dh));

      if (!isNaN(num) && num > 40000 && num < 60000 && isDateHeader) {
          const excelEpoch = new Date(1900, 0, 1);
          const msPerDay = 86400000;
          const d = new Date(excelEpoch.getTime() + (num - 2) * msPerDay);
          const isDateOnly = headerLower === 'date' || headerLower.includes('mfg') || headerLower.includes('expiry');
          return d.toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
              ...(isDateOnly ? {} : { hour: '2-digit', minute: '2-digit', hour12: true })
          });
      }
      
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
      if (isoRegex.test(val)) {
          const d = new Date(val);
          const isDateOnly = headerLower === 'date' || headerLower.includes('mfg') || headerLower.includes('expiry');
          return d.toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
              ...(isDateOnly ? {} : { hour: '2-digit', minute: '2-digit', hour12: true })
          });
      }

      const localIsoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
      if (localIsoRegex.test(val)) {
          const d = new Date(val);
          return d.toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit', hour12: true
          });
      }

      const plainDateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (plainDateRegex.test(val)) {
          const d = new Date(val + 'T00:00:00');
          return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      return val;
  };

  const handleUpdateStage = async (piNum: string, stageField: string, dateTimeVal: string, extraField?: string, extraVal?: string) => {
    if (!dateTimeVal) {
      addToast('Please select a date and time', 'error');
      return;
    }
    showLoader();
    try {
      const updates = {
        [stageField]: dateTimeVal,
        ...(extraField && extraVal ? { [extraField]: extraVal } : {})
      };
      const response = await fetch('/api/client-interface', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: 'Tracker',
          identifierKey: 'PI Number',
          identifierValue: piNum,
          updates: updates
        })
      });
      if (!response.ok) throw new Error('Failed to update stage');
      addToast('Stage scheduled successfully!', 'success');
      fetchData('Tracker');
    } catch (err: any) {
      addToast(err.message || 'Failed to update stage', 'error');
    } finally {
      hideLoader();
    }
  };

  const handleEditOrder = (order: any) => {
    let items: any[] = [];
    try {
        const raw = order.Line_Items || order['Line Items'] || '';
        items = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
    } catch {}

    setCart(items);
    setRateType(order.Mode === 'FOB 40FT' ? 'FOB 40FT' : 'FOB 20FT');
    setEditingOrderPi(order.PI_Number || order['PI Number'] || order.PI_NUMBER || null);
    setActiveTab('PreOrder');
    addToast('Order loaded into cart for editing', 'success');
  };

  const generateOrderPdf = async () => {
    showLoader();
    try {
      const response = await fetch('/api/client-interface?tab=Orders');
      const ordersData = await response.json();
      const existingOrdersCount = Array.isArray(ordersData) ? ordersData.length : 0;
      
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      let finYear = '';
      if (currentMonth >= 3) {
          finYear = `${String(currentYear).slice(2)}${String(currentYear + 1).slice(2)}`;
      } else {
          finYear = `${String(currentYear - 1).slice(2)}${String(currentYear).slice(2)}`;
      }
      const seq = existingOrdersCount + 1;
      const piNumber = editingOrderPi || `INN/${finYear}/INNE/${seq}`;

      const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
      const rows = cart.map(item => {
        const name = getVal(item, 'Product');
        const brand = getVal(item, 'Brand');
        const ean = getVal(item, 'Ean Code');
        const grmStr = String(getVal(item, 'Grm')).replace(/[^0-9.]/g, '');
        const grm = parseFloat(grmStr) || 0;
        const cbm = parseFloat(String(getVal(item, 'Cbm')).replace(/[^0-9.]/g, '')) || 0;
        const rate = parseFloat(String(getVal(item, item.selectedRateType)).replace(/[^0-9.]/g, '')) || 0;
        const qty = item.quantity || 0;
        
        const totalWeightKg = ((grm * qty) / 1000).toFixed(2);
        const totalCbm = (cbm * qty).toFixed(4);
        const totalPrice = (rate * qty).toFixed(2);

        return `<tr>
        <td>${brand}</td>
        <td>${name}</td>
        <td>${ean || '—'}</td>
        <td class="td-number">${grm ? grm + 'g' : '—'}</td>
        <td class="td-number">${cbm.toFixed(4)}</td>
        <td>${item.selectedRateType}</td>
        <td class="td-number">$${rate.toFixed(2)}</td>
        <td class="td-number" style="color:var(--primary)"><strong>${qty}</strong></td>
        <td class="td-number">${totalWeightKg}</td>
        <td class="td-number">${totalCbm}</td>
        <td class="td-number"><strong>$${totalPrice}</strong></td>
      </tr>`;
    }).join('');
      const orderPayload = {
        PI_Number: piNumber,
        Date: date,
        Mode: rateType,
        Prepared_By: user?.full_name || user?.username || 'Client User',
        Total_Qty: cartTotal,
        Total_Weight: (cartTotalGrm / 1000).toFixed(2) + ' kg',
        Total_Volume: cartTotalCbm.toFixed(3) + ' m³',
        Cont_Fill: containerFillPercentage.toFixed(1) + '%',
        Est_Value: '$' + cartTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        PDF_Link: '',
        Line_Items: JSON.stringify(cart),
        created_at: new Date().toISOString()
      };

      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><title>Innovexia Order Request</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        <script type="application/json" id="order-payload">${JSON.stringify(orderPayload).replace(/</g, '\\u003c')}</script>
        <script type="application/json" id="editing-pi">${editingOrderPi ? JSON.stringify(editingOrderPi) : 'null'}</script>
        <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
      :root {
        --primary: #2874f0;
        --primary-dark: #1d4ed8;
        --accent: #ff9f00;
        --text-main: #0f172a;
        --text-muted: #64748b;
        --bg-main: #ffffff;
        --bg-alt: #f8fafc;
        --border-color: #e2e8f0;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; color: var(--text-main); background: #f1f5f9; padding: 20px; display: flex; justify-content: center; }
      
      .document-container {
        background: var(--bg-main);
        width: 100%;
        max-width: 1200px;
        padding: 50px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        border-radius: 12px;
      }

      .no-print {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-bottom: 24px;
      }
      
      button {
        padding: 10px 20px;
        font-size: 13px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
        font-family: 'Inter', sans-serif;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .btn-primary {
        background: var(--primary);
        color: white;
        box-shadow: 0 4px 6px -1px rgba(40, 116, 240, 0.2);
      }
      .btn-primary:hover { background: var(--primary-dark); }
      .btn-secondary {
        background: white;
        color: var(--text-main);
        border: 1px solid var(--border-color);
      }
      .btn-secondary:hover { background: var(--bg-alt); }

      .header { 
        display: flex; justify-content: space-between; align-items: flex-start; 
        margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid var(--border-color); 
      }
      .brand-container { display: flex; flex-direction: column; }
      .brand { font-size: 36px; font-weight: 900; color: var(--primary); letter-spacing: -1.5px; line-height: 1; }
      .brand span { color: var(--accent); }
      .subtitle { font-size: 13px; color: var(--text-muted); margin-top: 6px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; }
      
      .meta-box {
        background: var(--bg-alt);
        padding: 16px 24px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        text-align: right;
      }
      .meta { font-size: 13px; color: var(--text-muted); line-height: 1.6; }
      .meta strong { color: var(--text-main); font-weight: 700; }
      
      h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: var(--text-muted); margin-bottom: 16px; }
      
      table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11px; margin-bottom: 40px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); }
      thead tr { background: var(--bg-alt); }
      thead th { 
        padding: 12px 14px; text-align: left; font-size: 10px; font-weight: 700; 
        text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted);
        border-bottom: 1px solid var(--border-color);
      }
      tbody tr { transition: background 0.2s; }
      tbody td { padding: 12px 14px; vertical-align: middle; border-bottom: 1px solid var(--border-color); font-weight: 500; }
      tbody tr:last-child td { border-bottom: none; }
      tbody tr:hover { background: #f8fafc; }
      .td-number { text-align: right; font-variant-numeric: tabular-nums; }
      .th-number { text-align: right; }
      
      .totals { 
        display: grid; 
        grid-template-columns: repeat(5, 1fr); 
        gap: 16px; 
        margin-top: 24px; 
      }
      .total-card { 
        background: var(--bg-main); 
        border-radius: 10px; 
        padding: 18px;
        border: 1px solid var(--border-color);
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .total-card .label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 6px; }
      .total-card .value { font-size: 18px; font-weight: 800; color: var(--text-main); }
      
      .total-card.highlight { 
        background: var(--primary); 
        border-color: var(--primary);
        box-shadow: 0 10px 15px -3px rgba(40, 116, 240, 0.2);
      }
      .total-card.highlight .label { color: rgba(255,255,255,0.8); }
      .total-card.highlight .value { color: #fff; font-size: 22px; }
      
      .footer { 
        margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border-color); 
        display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); font-weight: 500;
      }

      @media print { 
        body { background: #fff; padding: 0; }
        .document-container { box-shadow: none; border: none; padding: 0; max-width: none; }
        .no-print { display: none !important; }
      }
    </style></head><body>
      <div class="document-container" id="pdf-content">
        <div class="no-print">
          <button onclick="window.print()" class="btn-secondary">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            Print
          </button>
          <button onclick="downloadPdf()" class="btn-primary" id="download-btn">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Download PDF
          </button>
          <button onclick="placeOrder()" class="btn-primary" id="place-order-btn" style="background: var(--accent); color: #000;">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Place Order
          </button>
        </div>
        
        <div class="header">
          <div class="brand-container">
            <div class="brand">Innov<span>exia</span></div>
            <div class="subtitle">Enterprise Portal — Order Request</div>
          </div>
          <div class="meta-box">
            <div class="meta">
              <strong>Date: ${date}</strong>
              Mode: ${rateType}<br/>
              Prepared by: ${user?.full_name || 'User'}<br/>
            </div>
          </div>
        </div>

        <h2>Order Line Items</h2>
        <table>
          <thead>
            <tr>
              <th>Brand</th>
              <th>Product</th>
              <th>EAN Code</th>
              <th class="th-number">Grammage</th>
              <th class="th-number">CBM/Unit</th>
              <th>Mode</th>
              <th class="th-number">Unit Price</th>
              <th class="th-number">Qty</th>
              <th class="th-number">Total Wt(kg)</th>
              <th class="th-number">Total CBM</th>
              <th class="th-number">Total Price</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-card">
            <div class="label">Total Qty</div>
            <div class="value">${cartTotal} units</div>
          </div>
          <div class="total-card">
            <div class="label">Total Weight</div>
            <div class="value">${(cartTotalGrm / 1000).toFixed(2)} kg</div>
          </div>
          <div class="total-card">
            <div class="label">Total Volume</div>
            <div class="value" style="color:#10b981">${cartTotalCbm.toFixed(3)} m³</div>
          </div>
          <div class="total-card">
            <div class="label">Cont. Fill (${rateType === 'FOB 20FT' ? '20FT/28CBM' : '40FT/67CBM'})</div>
            <div class="value" style="color:#f59e0b">${containerFillPercentage.toFixed(1)}%</div>
          </div>
          <div class="total-card highlight">
            <div class="label">Est. Value</div>
            <div class="value">$${cartTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div class="footer">
          <span>Generated by Innovexia Enterprise Portal</span>
          <span>This is a pre-order request and not a confirmed order.</span>
        </div>
      </div>

      <script>
        function downloadPdf() {
          const btn = document.getElementById('download-btn');
          const poBtn = document.getElementById('place-order-btn');
          const btnGroup = document.querySelector('.no-print');
          
          btn.innerHTML = 'Generating...';
          btn.style.opacity = '0.7';
          btn.style.pointerEvents = 'none';
          if (poBtn) poBtn.style.display = 'none';

          // Hide buttons temporarily so they don't show up in PDF
          btnGroup.style.display = 'none';
          
          const element = document.getElementById('pdf-content');
          const opt = {
            margin:       10,
            filename:     'Innovexia_Order_Request.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
          };

          html2pdf().set(opt).from(element).save().then(() => {
            // Restore buttons
            btnGroup.style.display = 'flex';
            btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Download PDF';
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            if (poBtn) poBtn.style.display = 'flex';
          });
        }

        async function placeOrder() {
          const btn = document.getElementById('place-order-btn');
          const dlBtn = document.getElementById('download-btn');
          const btnGroup = document.querySelector('.no-print');
          
          btn.innerHTML = 'Placing Order...';
          btn.style.opacity = '0.7';
          btn.style.pointerEvents = 'none';
          if (dlBtn) dlBtn.style.display = 'none';

          btnGroup.style.display = 'none';
          
          const element = document.getElementById('pdf-content');
          const opt = {
            margin:       10,
            filename:     'Innovexia_Order_Request.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
          };

          try {
              const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
              
              btnGroup.style.display = 'flex';
              btn.innerHTML = 'Uploading PDF...';

              const formData = new FormData();
              formData.append('file', pdfBlob, opt.filename);
              formData.append('type', 'order');

              const uploadRes = await fetch('/api/upload', {
                  method: 'POST',
                  body: formData
              });
              const uploadData = await uploadRes.json();
              
              if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload PDF');

              const pdfLink = uploadData.url;

              btn.innerHTML = 'Saving Order...';

              const payloadRaw = document.getElementById('order-payload').textContent;
              const orderPayload = JSON.parse(payloadRaw);
              orderPayload.PDF_Link = pdfLink;

              const editingPiRaw = document.getElementById('editing-pi').textContent;
              const editingPi = JSON.parse(editingPiRaw);

              let saveRes;
              if (editingPi) {
                  saveRes = await fetch('/api/client-interface', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tab: 'Orders', identifierKey: 'PI_Number', identifierValue: editingPi, updates: orderPayload })
                  });
              } else {
                  saveRes = await fetch('/api/client-interface', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tab: 'Orders', data: orderPayload })
                  });
              }

              if (!saveRes.ok) throw new Error('Failed to save order');

              btn.innerHTML = editingPi ? 'Order Updated Successfully!' : 'Order Placed Successfully!';
              btn.style.background = '#10b981';
              if (window.opener) { window.opener.postMessage('order_saved', '*'); }
          } catch (error) {
              console.error(error);
              alert('Error placing order: ' + error.message);
              btn.innerHTML = 'Place Order';
              btn.style.opacity = '1';
              btn.style.pointerEvents = 'auto';
              btnGroup.style.display = 'flex';
          } finally {
              if (dlBtn) dlBtn.style.display = 'flex';
          }
        }
      </script>
    </body></html>`;

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    } catch (error) {
      console.error(error);
      addToast('Failed to prepare order request', 'error');
    } finally {
      hideLoader();
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
                {user && user.role_name !== 'Client' && (
                    <button onClick={() => router.push('/dashboard')} className="px-3 py-1 bg-white text-[#2874f0] rounded-sm hover:bg-slate-100 transition-colors">ERP Dashboard</button>
                )}
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
                <div className="flex items-center gap-4 flex-wrap">
                    <p className="text-[12px] font-bold text-slate-500 whitespace-nowrap">
                        Items: <span className="text-slate-900">{filteredAndSortedData.length}</span>
                    </p>

                    {activeTab === 'PreOrder' && (
                        <div className="flex items-center bg-[#f1f3f6] p-0.5 rounded-sm border">
                            <button onClick={() => setRateType('FOB 20FT')} className={`px-6 py-1.5 text-[10px] font-black rounded-sm transition-all ${rateType === 'FOB 20FT' ? 'bg-[#2874f0] text-white shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}>FOB 20FT</button>
                            <button onClick={() => setRateType('FOB 40FT')} className={`px-6 py-1.5 text-[10px] font-black rounded-sm transition-all ${rateType === 'FOB 40FT' ? 'bg-[#2874f0] text-white shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}>FOB 40FT</button>
                        </div>
                    )}

                    {activeTab !== 'PreOrder' && user && (
                        <div className="flex items-center gap-4 flex-wrap">
                            {/* Party Filter Dropdown (Only for ERP users) */}
                            {user.role_name !== 'Client' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Party</span>
                                    <select
                                        value={filterParty}
                                        onChange={(e) => { setFilterParty(e.target.value); setFilterPiNumber(''); }}
                                        className="text-[12px] font-black border bg-[#f1f3f6] px-3 py-1.5 rounded-sm outline-none cursor-pointer"
                                    >
                                        <option value="">All Parties</option>
                                        {dropdownOptions.parties.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* PI Number Filter Dropdown (For all users) */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PI Number</span>
                                <select
                                    value={filterPiNumber}
                                    onChange={(e) => setFilterPiNumber(e.target.value)}
                                    className="text-[12px] font-black border bg-[#f1f3f6] px-3 py-1.5 rounded-sm outline-none cursor-pointer"
                                >
                                    <option value="">All PIs</option>
                                    {dropdownOptions.piNumbers.map(pi => (
                                        <option key={pi} value={pi}>{pi}</option>
                                    ))}
                                </select>
                            </div>
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
                                <button onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (qty === 0) {
                                        updateCart(product, 1); 
                                    }
                                    addToast('Added to cart', 'success'); 
                                }} className="flex-grow py-2.5 bg-[#ff9f00] text-white text-[10px] font-black rounded-sm hover:bg-[#fb641b] transition-all uppercase shadow-sm active:scale-95 tracking-widest">
                                    ADD
                                </button>
                            </div>
                        </div>
                    );
                }                ) : activeTab === 'Orders' ? (
                    <div className="space-y-5 py-2">
                      {paginatedData.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 font-bold">No orders found.</div>
                      ) : paginatedData.map((order, i) => {
                        const piNum = order.PI_Number || order['PI Number'] || order.PI_NUMBER || '—';
                        const rawDate = order.Date || order.DATE || '';
                        const date = rawDate ? (() => {
                          const isoTest = /^\d{4}-\d{2}-\d{2}T/.test(rawDate);
                          if (isoTest) return new Date(rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                          return rawDate;
                        })() : '—';
                        const mode = order.Mode || order.MODE || '—';
                        const preparedBy = order.Prepared_By || order['Prepared By'] || '—';
                        const totalQty = order.Total_Qty || order['Total Qty'] || '—';
                        const totalWeight = order.Total_Weight || order['Total Weight'] || '—';
                        const totalVolume = order.Total_Volume || order['Total Volume'] || '—';
                        const contFill = order.Cont_Fill || order['Cont Fill'] || order.CONT_FILL || null;
                        const estValue = order.Est_Value || order['Est Value'] || '—';
                        const pdfLink = order.PDF_Link || order['PDF Link'] || '';
                        const fillNum = contFill ? parseFloat(String(contFill).replace(/[^0-9.]/g, '')) : 0;
                        const fillPct = fillNum > 1 ? fillNum : fillNum * 100;
                        let lineItems: any[] = [];
                        try {
                          const raw = order.Line_Items || order['Line Items'] || '';
                          lineItems = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
                        } catch {}

                        const fillColor = fillPct > 95 ? '#ef4444' : fillPct > 80 ? '#f59e0b' : '#10b981';

                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300"
                          >
                            {/* Card Header */}
                            <div className="bg-gradient-to-r from-[#2874f0] to-[#1d4ed8] px-6 py-3 flex flex-wrap justify-between items-center gap-3">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">PI Number</p>
                                  <h3 className="text-[15px] font-black text-white tracking-tight">{piNum}</h3>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="px-3 py-1 bg-white/20 text-white text-[10px] font-black rounded-full uppercase tracking-widest">{mode}</span>
                                <span className="px-3 py-1 bg-yellow-400/90 text-[#1d4ed8] text-[10px] font-black rounded-full">{date}</span>
                                <button onClick={() => handleEditOrder(order)} className="px-3 py-1 bg-white text-[#2874f0] text-[10px] font-black rounded-full hover:bg-blue-50 transition-colors flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  EDIT
                                </button>
                                {pdfLink && (
                                  <a href={pdfLink} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-white text-[#2874f0] text-[10px] font-black rounded-full hover:bg-blue-50 transition-colors flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    PDF
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100">
                              {[
                                { label: 'Total Qty', value: totalQty, icon: <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>, color: 'text-blue-600' },
                                { label: 'Total Weight', value: totalWeight, icon: <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>, color: 'text-slate-700' },
                                { label: 'Total Volume', value: totalVolume, icon: <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>, color: 'text-emerald-600' },
                                { label: 'Est. Value', value: estValue, icon: <svg className="w-4 h-4 text-[#2874f0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, color: 'text-[#2874f0]' },
                              ].map((stat, si) => (
                                <div key={si} className="bg-white px-5 py-2.5 flex flex-col justify-center">
                                  <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                    {stat.icon}
                                    <span>{stat.label}</span>
                                  </div>
                                  <span className={`text-lg font-black tracking-tight ${stat.color}`}>{stat.value}</span>
                                </div>
                              ))}
                            </div>

                            {/* Container Fill Bar */}
                            <div className="px-6 py-2 bg-slate-50 border-b flex items-center gap-4">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Container Fill</span>
                              <div className="flex-grow h-3 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${Math.min(100, fillPct)}%`, background: fillColor }}
                                />
                              </div>
                              <span className="text-[11px] font-black whitespace-nowrap" style={{ color: fillColor }}>{fillPct.toFixed(1)}%</span>
                            </div>

                            {/* Line Items */}
                            {lineItems.length > 0 && (
                              <div className="px-6 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">📋 Line Items ({lineItems.length} products)</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                  {lineItems.slice(0, 8).map((item: any, li: number) => {
                                    const prodName = item.PRODUCT || item.Product || item.product || item.name || '—';
                                    const qty = item.QTY || item.Qty || item.quantity || item.QUANTITY || '—';
                                    const img = formatImageUrl(item.Image || item.image || item.IMAGE || '');
                                    return (
                                      <div key={li} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 hover:bg-blue-50 hover:border-blue-100 transition-colors">
                                        <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center border border-slate-100 shrink-0 overflow-hidden">
                                          {img ? <img src={img} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain" alt={prodName} /> : <span className="text-base">📦</span>}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-[11px] font-bold text-slate-700 truncate" title={prodName}>{prodName}</p>
                                          <p className="text-[9px] font-black text-blue-500">Qty: {qty}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {lineItems.length > 8 && (
                                    <button
                                      onClick={() => setViewLineItems(lineItems)}
                                      className="flex items-center justify-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100 text-[11px] font-black text-[#2874f0] hover:bg-blue-100 transition-colors"
                                    >
                                      +{lineItems.length - 8} more
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Footer */}
                            <div className="px-6 py-2.5 bg-slate-50 border-t flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-400">Prepared by: <span className="text-slate-600">{preparedBy}</span></span>
                              {lineItems.length > 0 && (
                                <button onClick={() => setViewLineItems(lineItems)} className="text-[10px] font-black text-[#2874f0] hover:underline flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                  View All Items
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                                ) : (activeTab === 'Inventory' || activeTab === 'Freshness') ? (
                    // ─── Inventory/Freshness Dashboard ───────────────────────────
                    (() => {
                      // Filter orders based on role and dropdowns
                      let myOrders = ordersData;
                      const isClientUser = user?.role_name === 'Client';
                      
                      if (isClientUser && user) {
                          const matchFullName = (user.full_name || '').toLowerCase();
                          const matchUsername = (user.username || '').toLowerCase();
                          myOrders = myOrders.filter(ord => {
                              const pb = String(ord.Prepared_By || ord['Prepared By'] || '').toLowerCase();
                              return pb === matchFullName || pb === matchUsername || pb === 'client user';
                          });
                      }

                      if (!isClientUser && filterParty) {
                          myOrders = myOrders.filter(ord => {
                              const party = String(ord['Party Name'] || ord.Party_Name || ord['PARTY NAME'] || ord.Prepared_By || ord['Prepared By'] || '').trim().toLowerCase();
                              return party === filterParty.toLowerCase();
                          });
                      }

                      if (filterPiNumber) {
                          myOrders = myOrders.filter(ord => {
                              const pi = String(ord.PI_Number || ord['PI Number'] || '').trim().toLowerCase();
                              return pi === filterPiNumber.toLowerCase();
                          });
                      }

                      // All line items across all orders
                      const allOrderedItems: any[] = [];
                      myOrders.forEach(ord => {
                        const piNum = ord.PI_Number || ord['PI Number'] || '';
                        let items: any[] = [];
                        try { const r = ord.Line_Items || ord['Line Items'] || ''; items = typeof r === 'string' ? JSON.parse(r) : (Array.isArray(r) ? r : []); } catch {}
                        items.forEach(item => allOrderedItems.push({ ...item, _piNum: piNum }));
                      });

                      // Inventory submitted records
                      const invData = data;

                      // Helpers to parse numeric values
                      const n = (v: any) => parseFloat(String(v || '0').replace(/[^0-9.]/g, '')) || 0;

                      // Totals tracking
                      let ordQty = 0, ordCbm = 0, ordWt = 0, ordFob = 0;
                      let recQty = 0, recCbm = 0, recWt = 0, recFob = 0;

                      // Item completion tracking
                      const completedItems: any[] = [];
                      const pendingItems: any[] = [];
                      
                      allOrderedItems.forEach(it => {
                          // Ordered properties
                          const prodName = String(it.PRODUCT || it.Product || it.product || '').toLowerCase().trim();
                          const orderedQty = n(it.quantity || it.Qty || it.QTY || it.QUANTITY);
                          const itemCbm = n(it.Cbm || it.CBM || it.cbm);
                          const itemGrm = n(it.Grm || it.GRM || it.grm);
                          const itemPrice = n(it['FOB 20FT'] || it.FOB_20FT || it['FOB 40FT'] || it.FOB_40FT || it.Price || it.price);
                          
                          // Add to Ordered totals
                          ordQty += orderedQty;
                          ordCbm += itemCbm * orderedQty;
                          ordWt += (itemGrm * orderedQty) / 1000;
                          ordFob += itemPrice * orderedQty;
                          
                          // Find matching inventory entries for this PI and Product
                          const exactMatches = invData.filter((inv: any) =>
                            String(inv['Product Name'] || inv.Product_Name || '').toLowerCase().trim() === prodName &&
                            String(inv['PI Number'] || inv.PI_Number || '').toLowerCase() === String(it._piNum).toLowerCase()
                          );
                          const fallbackMatches = exactMatches.length === 0 ? invData.filter((inv: any) =>
                            String(inv['Product Name'] || inv.Product_Name || '').toLowerCase().trim() === prodName && !(inv['PI Number'])
                          ) : [];
                          const invMatches = exactMatches.length > 0 ? exactMatches : fallbackMatches;

                          const totalReceived = invMatches.reduce((sum: number, inv: any) => sum + n(inv['Received Qty'] || inv.Received_Qty), 0);
                          
                          // Add to Received totals proportionally using the ordered properties
                          recQty += totalReceived;
                          recCbm += itemCbm * totalReceived;
                          recWt += (itemGrm * totalReceived) / 1000;
                          recFob += itemPrice * totalReceived;

                          if (totalReceived >= orderedQty && orderedQty > 0) {
                              completedItems.push(it);
                          } else {
                              pendingItems.push(it);
                          }
                      });

                      const tiles = [
                        { label: 'Total Qty', rawOrd: ordQty, rawRec: recQty, ordered: ordQty.toFixed(0), received: recQty.toFixed(0), unit: 'units', color: '#2874f0', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
                        { label: 'Total Weight', rawOrd: ordWt, rawRec: recWt, ordered: ordWt.toFixed(2), received: recWt.toFixed(2), unit: 'kg', color: '#7c3aed', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg> },
                        { label: 'Total CBM', rawOrd: ordCbm, rawRec: recCbm, ordered: ordCbm.toFixed(3), received: recCbm.toFixed(3), unit: 'm³', color: '#0891b2', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
                        { label: 'Total FOB', rawOrd: ordFob, rawRec: recFob, ordered: `$${ordFob.toFixed(2)}`, received: `$${recFob.toFixed(2)}`, unit: '', color: '#059669', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                        { label: 'Items Status', rawOrd: completedItems.length + pendingItems.length, rawRec: completedItems.length, ordered: `${completedItems.length} Done`, received: `${pendingItems.length} Pending`, unit: '', color: pendingItems.length > 0 ? '#f59e0b' : '#10b981', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                      ];

                      return (
                        <div className="space-y-6">
                          {/* Summary Tiles */}
                          {activeTab !== 'Freshness' && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {tiles.map((tile, ti) => {
                              const pct = tile.rawOrd > 0 ? (tile.rawRec / tile.rawOrd) * 100 : 0;
                              return (
                              <div key={ti} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3 hover:shadow-md hover:border-slate-300 transition-all">
                                <div className="flex items-center justify-between">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-600 shadow-inner border border-slate-100" style={{ color: tile.color, backgroundColor: `${tile.color}15` }}>
                                    {tile.icon}
                                  </div>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tile.label}</span>
                                </div>
                                <div className="space-y-1.5 mt-1">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Ordered</span>
                                    <span className="text-[14px] font-black" style={{ color: tile.color }}>{tile.ordered} <span className="text-[10px] font-bold text-slate-400">{tile.unit}</span></span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Received</span>
                                    <span className="text-[14px] font-black text-slate-700">{tile.received} <span className="text-[10px] font-bold text-slate-400">{tile.unit}</span></span>
                                  </div>
                                </div>
                                {/* Mini progress bar */}
                                {tile.label !== 'Items Status' && (
                                  <div className="mt-2 space-y-1.5">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Progress</span>
                                      <span className="text-[10px] font-black" style={{ color: tile.color }}>{pct.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: tile.color }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )})}
                          </div>
                          )}

                          {/* PI-wise Order Table with Completion Status */}
                          {myOrders.length === 0 ? (
                            <div className="text-center py-16 text-slate-400 font-bold bg-white rounded-xl shadow-sm">No orders found for your account.</div>
                          ) : myOrders.map((ord, oi) => {
                            const piNum = ord.PI_Number || ord['PI Number'] || '—';
                            const ordDate = (() => { const d = ord.Date || ''; return /^\d{4}-\d{2}-\d{2}T/.test(d) ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : d || '—'; })();
                            let items: any[] = [];
                            try { const r = ord.Line_Items || ord['Line Items'] || ''; items = typeof r === 'string' ? JSON.parse(r) : (Array.isArray(r) ? r : []); } catch {}

                            return (
                              <motion.div key={oi} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: oi * 0.05 }} className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
                                {/* PI Header */}
                                <div className="bg-gradient-to-r from-[#1e3a8a] to-[#2874f0] px-5 py-3 flex flex-wrap justify-between items-center gap-2">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white text-sm">📋</div>
                                    <div>
                                      <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest">PI Number</p>
                                      <h3 className="text-[14px] font-black text-white">{piNum}</h3>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 bg-white/20 text-white text-[11px] font-black rounded-full shadow-sm">{ord.Mode || '—'}</span>
                                    <span className="px-3 py-1 bg-yellow-400/90 text-[#1d4ed8] text-[11px] font-black rounded-full shadow-sm">{ordDate}</span>
                                    <span className="px-3 py-1 bg-emerald-400/90 text-white text-[11px] font-black rounded-full shadow-sm">{ord.Est_Value || ord['Est Value'] || '—'}</span>
                                  </div>
                                </div>

                                {/* Line Items Table */}
                                {items.length > 0 && (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[13px] border-collapse min-w-[900px]">
                                      <thead className="bg-slate-50 border-b border-slate-100 text-[11px]">
                                        <tr>
                                          {activeTab === 'Freshness' && <th className="px-4 py-2.5 font-black text-slate-500 uppercase tracking-wider w-[80px]">Image</th>}
                                          <th className="px-4 py-2.5 font-black text-slate-500 uppercase tracking-wider w-[240px]">Product Name</th>
                                          {activeTab !== 'Freshness' && (
                                            <>
                                              <th className="px-4 py-2.5 font-black text-slate-500 uppercase tracking-wider text-center w-[110px]">Weight/Size</th>
                                              <th className="px-4 py-2.5 font-black text-slate-500 uppercase tracking-wider text-right w-[110px]">Price/FOB</th>
                                              <th className="px-4 py-2.5 font-black text-slate-500 uppercase tracking-wider text-right w-[110px]">Ordered Qty</th>
                                              <th className="px-4 py-2.5 font-black text-slate-500 uppercase tracking-wider text-right w-[110px]">Received Qty</th>
                                              <th className="px-4 py-2.5 font-black text-slate-500 uppercase tracking-wider text-right w-[110px]">Pending Qty</th>
                                            </>
                                          )}
                                          {activeTab === 'Freshness' && (
                                            <>
                                              <th className="px-4 py-2.5 font-black text-slate-500 uppercase tracking-wider text-center w-[130px]">Mfg Date</th>
                                              <th className="px-4 py-2.5 font-black text-slate-500 uppercase tracking-wider text-center w-[130px]">Expiry Date</th>
                                            </>
                                          )}
                                          <th className="px-4 py-2.5 font-black text-slate-500 uppercase tracking-wider text-center w-[100px]">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                         {items.flatMap((item: any, ii: number) => {
                                           const prodName = item.PRODUCT || item.Product || item.product || item.name || '—';
                                           const orderedQty = item.quantity || item.Qty || item.QTY || item.QUANTITY || item.Quantity || 0;
                                           const itemGrm = n(item.Grm || item.GRM || item.grm);
                                           const itemPrice = n(item['FOB 20FT'] || item.FOB_20FT || item['FOB 40FT'] || item.FOB_40FT || item.Price || item.price);

                                           // Find all matching inventory entries
                                           const exactMatches = invData.filter((inv: any) =>
                                             String(inv['Product Name'] || inv.Product_Name || '').toLowerCase().trim() === String(prodName).toLowerCase().trim() &&
                                             (String(inv['PI Number'] || inv.PI_Number || '').toLowerCase() === String(piNum).toLowerCase())
                                           );
                                           const fallbackMatches = exactMatches.length === 0 ? invData.filter((inv: any) =>
                                             String(inv['Product Name'] || inv.Product_Name || '').toLowerCase().trim() === String(prodName).toLowerCase().trim() && !(inv['PI Number'])
                                           ) : [];
                                           const invMatches = exactMatches.length > 0 ? exactMatches : fallbackMatches;

                                           if (invMatches.length === 0) {
                                               return [{
                                                   key: `${ii}-pending`,
                                                   prodName, 
                                                   weightSize: itemGrm > 0 ? `${((itemGrm * orderedQty) / 1000).toFixed(2)} kg` : '—', 
                                                   priceVal: itemPrice > 0 ? `$${(itemPrice * orderedQty).toFixed(2)}` : '—', 
                                                   orderedQty,
                                                   receivedQty: 0,
                                                   pendingQty: n(orderedQty),
                                                   mfgDate: '', expiryDate: '', img: '',
                                                   isComplete: false
                                               }];
                                           }

                                           const rows: any[] = [];
                                           let totalReceived = 0;

                                           invMatches.forEach((invMatch: any) => {
                                               totalReceived += n(invMatch['Received Qty'] || invMatch.Received_Qty);
                                           });
                                           const pendingQty = Math.max(0, n(orderedQty) - totalReceived);
                                           const isComplete = pendingQty <= 0;

                                           invMatches.forEach((invMatch: any, mi: number) => {
                                               const recQty = n(invMatch['Received Qty'] || invMatch.Received_Qty);
                                               rows.push({
                                                   key: `${ii}-inv-${mi}`,
                                                   prodName,
                                                   weightSize: itemGrm > 0 ? `${((itemGrm * recQty) / 1000).toFixed(2)} kg` : '—',
                                                   priceVal: itemPrice > 0 ? `$${(itemPrice * recQty).toFixed(2)}` : '—',
                                                   orderedQty: invMatch['Order Qty'] || invMatch.Order_Qty || orderedQty,
                                                   receivedQty: recQty,
                                                   pendingQty: pendingQty,
                                                   mfgDate: invMatch['Mfg Date'] || invMatch.Mfg_Date || '',
                                                   expiryDate: invMatch['Expiry Date'] || invMatch.Expiry_Date || '',
                                                   img: formatImageUrl(invMatch.Image || invMatch.image || invMatch.IMAGE || invMatch['Product Image'] || ''),
                                                   isComplete: isComplete
                                               });
                                           });

                                           return rows;
                                         }).map((rowObj: any) => {
                                           return (
                                             <tr key={rowObj.key} className={`hover:bg-slate-50 transition-colors border-b border-slate-100 ${rowObj.isComplete ? '' : 'bg-orange-50/30'}`}>
                                               {/* Image Preview Column */}
                                               {activeTab === 'Freshness' && (
                                               <td className="px-4 py-2.5">
                                                 <div className="w-12 h-12 bg-white rounded-lg border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm animate-fade-in">
                                                   {rowObj.img ? (
                                                     <img src={rowObj.img} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain hover:scale-110 transition-transform cursor-pointer" alt={rowObj.prodName} />
                                                   ) : (
                                                     <span className="text-lg">📦</span>
                                                   )}
                                                 </div>
                                               </td>
                                               )}

                                               {/* Product Name Column */}
                                               <td className="px-4 py-2.5">
                                                 <span className="font-bold text-slate-700 block" title={rowObj.prodName}>
                                                   {rowObj.prodName}
                                                 </span>
                                               </td>

                                               {activeTab !== 'Freshness' && (
                                                 <>
                                                   {/* Weight/Size Column */}
                                                   <td className="px-4 py-2.5 text-center font-bold text-slate-600">
                                                     {rowObj.weightSize}
                                                   </td>

                                                   {/* Price/FOB Column */}
                                                   <td className="px-4 py-2.5 text-right font-black text-slate-700">
                                                     {rowObj.priceVal}
                                                   </td>

                                                   {/* Ordered Qty Column */}
                                                   <td className="px-4 py-2.5 text-right font-black text-[#2874f0]">
                                                     {rowObj.orderedQty}
                                                   </td>

                                                   {/* Received Qty Column */}
                                                   <td className="px-4 py-2.5 text-right font-black text-emerald-600">
                                                     {rowObj.receivedQty === 0 && !rowObj.isComplete ? '—' : rowObj.receivedQty}
                                                   </td>

                                                   {/* Pending Qty Column */}
                                                   <td className="px-4 py-2.5 text-right font-black text-orange-500">
                                                     {rowObj.pendingQty > 0 ? rowObj.pendingQty : '—'}
                                                   </td>
                                                 </>
                                               )}

                                               {activeTab === 'Freshness' && (
                                                 <>
                                                   {/* Mfg Date Column */}
                                                   <td className="px-4 py-2.5 text-center font-semibold text-slate-500">
                                                     {rowObj.mfgDate ? formatDateValue(String(rowObj.mfgDate), 'Mfg Date') : '—'}
                                                   </td>

                                                   {/* Expiry Date Column */}
                                                   <td className="px-4 py-2.5 text-center font-semibold text-slate-500">
                                                     {rowObj.expiryDate ? formatDateValue(String(rowObj.expiryDate), 'Expiry Date') : '—'}
                                                   </td>
                                                 </>
                                               )}

                                               {/* Status Column */}
                                               <td className="px-4 py-2.5 text-center">
                                                 {rowObj.isComplete ? (
                                                   <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full shadow-sm">
                                                     <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                     Completed
                                                   </span>
                                                 ) : (
                                                   <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 text-[10px] font-black rounded-full shadow-sm animate-pulse">
                                                     <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                     Pending
                                                   </span>
                                                 )}
                                               </td>
                                             </tr>
                                           );
                                         })}
                                       </tbody>
                                    </table>
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      );
                    })()
                ) : activeTab === 'Tracker' ? (
                    <div className="space-y-6">
                      {paginatedData.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 font-bold bg-white rounded-xl shadow-sm border">No tracker data found for your account.</div>
                      ) : (
                        paginatedData.map((row, idx) => {
                          const piNum = row['PI Number'] || row.PI_Number || '—';
                          const partyName = row['Party Name'] || row.Party_Name || '—';
                          
                          const stages = [
                            { name: 'Production', field: 'Production', icon: '🏭', desc: 'Manufacturing completed', direction: 'up', rx: 60, ry: 220, px: 60, py: 130, tx: -10, ty: 15 },
                            { name: 'Loading', field: 'Loading', icon: '🏗️', desc: 'Cargo loaded', direction: 'down', rx: 205, ry: 110, px: 205, py: 200, tx: 135, ty: 230 },
                            { name: 'On Road to Port', field: 'On Road to Port', icon: '🚛', desc: 'Transit to port', direction: 'up', rx: 350, ry: 330, px: 350, py: 240, tx: 280, ty: 125 },
                            { name: 'Custom', field: 'Custom', icon: '🛃', desc: 'Customs clearance', direction: 'down', rx: 495, ry: 110, px: 495, py: 200, tx: 425, ty: 230 },
                            { name: 'Waiting for Vercel', field: 'Waiting for Vercel', icon: '🌐', desc: 'Vercel setup', direction: 'up', rx: 640, ry: 330, px: 640, py: 240, tx: 570, ty: 125, extraField: 'Waiting for Vercel Link' },
                            { name: 'Sailed', field: 'Sailed', icon: '🚢', desc: 'Vessel sailed', direction: 'down', rx: 785, ry: 110, px: 785, py: 200, tx: 715, ty: 230, extraField: 'Put container no on the link' },
                            { name: 'About to Arrive', field: 'About to Arrive', icon: '⚓', desc: 'Vessel approaching', direction: 'up', rx: 930, ry: 330, px: 930, py: 240, tx: 860, ty: 125 },
                            { name: 'Arrived', field: 'Arrived', icon: '🏁', desc: 'Cargo arrived', direction: 'down', rx: 1075, ry: 220, px: 1075, py: 290, tx: 1005, ty: 320 }
                          ];

                          const completedCount = stages.filter(st => row[st.field] || row[st.name]).length;
                          const progressPct = (completedCount / stages.length) * 100;

                          return (
                            <motion.div key={idx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden hover:shadow-2xl transition-all duration-300">
                              {/* Card Header */}
                              <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] px-6 py-5 flex flex-wrap justify-between items-center gap-4 border-b border-slate-800">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-lg shadow-inner">📍</div>
                                  <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Shipment Route & Milestone Roadmap</p>
                                    <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                                      {piNum}
                                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">{partyName}</span>
                                    </h3>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Logistics Progress</p>
                                    <p className="text-xs font-black text-emerald-400">{completedCount} / {stages.length} Stages Completed</p>
                                  </div>
                                  <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/50">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                                  </div>
                                </div>
                              </div>

                              {/* Winding road visual infographic timeline */}
                              <div className="p-6 bg-[#f8fafc] overflow-hidden">
                                <div className="w-full overflow-x-auto no-scrollbar py-6">
                                  <div className="min-w-[1150px] mx-auto relative select-none" style={{ height: '420px' }}>
                                    <svg width="1150" height="420" viewBox="0 0 1150 420" className="w-full h-full overflow-visible">
                                      {/* Asphalt Road Shadow Base */}
                                      <path
                                        d="M -50 220 C 80 220, 130 110, 205 110 C 280 110, 275 330, 350 330 C 425 330, 420 110, 495 110 C 570 110, 565 330, 640 330 C 715 330, 710 110, 785 110 C 860 110, 855 330, 930 330 C 1005 330, 1000 220, 1200 220"
                                        fill="none"
                                        stroke="#1e293b"
                                        strokeWidth="38"
                                        strokeLinecap="round"
                                        opacity="0.9"
                                      />
                                      {/* Inner Pavement Surface */}
                                      <path
                                        d="M -50 220 C 80 220, 130 110, 205 110 C 280 110, 275 330, 350 330 C 425 330, 420 110, 495 110 C 570 110, 565 330, 640 330 C 715 330, 710 110, 785 110 C 860 110, 855 330, 930 330 C 1005 330, 1000 220, 1200 220"
                                        fill="none"
                                        stroke="#334155"
                                        strokeWidth="32"
                                        strokeLinecap="round"
                                      />
                                      {/* Yellow Double Dashed Divider Lines */}
                                      <path
                                        d="M -50 220 C 80 220, 130 110, 205 110 C 280 110, 275 330, 350 330 C 425 330, 420 110, 495 110 C 570 110, 565 330, 640 330 C 715 330, 710 110, 785 110 C 860 110, 855 330, 930 330 C 1005 330, 1000 220, 1200 220"
                                        fill="none"
                                        stroke="#f59e0b"
                                        strokeWidth="2"
                                        strokeDasharray="8,8"
                                        strokeLinecap="round"
                                        opacity="0.85"
                                      />

                                      {/* Pins, Stems, and text boxes */}
                                      {stages.map((st, si) => {
                                        const rawVal = row[st.field] || row[st.name] || '';
                                        const isDone = !!rawVal;
                                        const formattedTime = isDone ? formatDateValue(String(rawVal), st.field) : '';
                                        const extraVal = st.extraField ? row[st.extraField] || '' : '';

                                        return (
                                          <g key={si} className="group cursor-default">
                                            {/* Stem pointing to the road */}
                                            <line
                                              x1={st.rx}
                                              y1={st.ry}
                                              x2={st.px}
                                              y2={st.py}
                                              stroke={isDone ? "#10b981" : "#94a3b8"}
                                              strokeWidth="3"
                                              strokeDasharray={isDone ? "none" : "3,3"}
                                              className="transition-all duration-300"
                                            />
                                            {/* Landing point node on the center road yellow divider */}
                                            <circle
                                              cx={st.rx}
                                              cy={st.ry}
                                              r="5"
                                              fill={isDone ? "#10b981" : "#64748b"}
                                              stroke="#ffffff"
                                              strokeWidth="2"
                                              className="transition-all duration-300"
                                            />
                                            {/* Circular Badge Ring (Outer Ring) */}
                                            <circle
                                              cx={st.px}
                                              cy={st.py}
                                              r="21"
                                              fill="#ffffff"
                                              stroke={isDone ? "#10b981" : "#94a3b8"}
                                              strokeWidth="5"
                                              className="transition-all duration-300 hover:scale-110 shadow-sm"
                                            />
                                            {/* Stage Icon */}
                                            <text
                                              x={st.px}
                                              y={st.py + 5}
                                              textAnchor="middle"
                                              fontSize="13"
                                              fill="#1e293b"
                                              className="pointer-events-none select-none font-bold"
                                            >
                                              {isDone ? "✓" : st.icon}
                                            </text>

                                            {/* Custom HTML Card details in standard responsive foreignObject */}
                                            <foreignObject
                                              x={st.tx}
                                              y={st.ty}
                                              width="140"
                                              height="95"
                                              className="overflow-visible"
                                            >
                                              <div className="flex flex-col items-center justify-center text-center font-sans">
                                                <p className="text-[12px] font-black text-slate-900 uppercase tracking-tight leading-tight mb-1" style={{ textShadow: '0 1px 0px #fff' }}>
                                                  {st.name}
                                                </p>
                                                {isDone ? (
                                                  <div className="flex flex-col items-center">
                                                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded uppercase tracking-widest leading-none mb-1">
                                                      Completed
                                                    </span>
                                                    <p className="text-[9.5px] text-slate-500 font-bold leading-normal max-w-[130px]">
                                                      {formattedTime}
                                                    </p>
                                                    {st.extraField && extraVal && (
                                                      <div className="mt-1 flex justify-center">
                                                        {st.name === 'Waiting for Vercel' ? (
                                                          <a
                                                            href={extraVal}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black rounded text-[8.5px] uppercase tracking-wider border border-indigo-100 transition-colors"
                                                          >
                                                            Link 🔗
                                                          </a>
                                                        ) : (
                                                          <span
                                                            className="text-[8.5px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded leading-tight max-w-[120px] truncate block"
                                                            title={extraVal}
                                                          >
                                                            {extraVal}
                                                          </span>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <div className="flex flex-col items-center">
                                                    <span className="text-[9px] font-black text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded uppercase tracking-widest leading-none">
                                                      Pending
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                            </foreignObject>
                                          </g>
                                        );
                                      })}
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  ) : (
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
                                                    {h.toLowerCase() === 'line_items' || h.toLowerCase() === 'line items' ? (
                                                        <button onClick={() => { try { const items = typeof row[h] === 'string' ? JSON.parse(row[h]) : row[h]; setViewLineItems(Array.isArray(items) ? items : []); } catch { setViewLineItems([]); } }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-[#2874f0] font-bold rounded-sm text-[10px] hover:bg-blue-100 transition-colors uppercase tracking-widest">View Items</button>
                                                    ) : isUrl(row[h]) ? (
                                                        <a href={row[h]} target="_blank" className="text-[#2874f0] font-black underline underline-offset-4">Open Link</a>
                                                    ) : (
                                                        formatDateValue(String(row[h] || ''), h) || '—'
                                                    )}
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
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Estimated</span>
                                <span className="text-3xl font-black text-[#2874f0] tracking-tighter">${cartTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="text-right flex gap-6">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Grand Total Weight</span>
                                    <span className="text-xl font-black text-slate-700 tracking-tighter">{(cartTotalGrm / 1000).toFixed(2)} kg</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Volume</span>
                                    <span className="text-xl font-black text-emerald-600 tracking-tighter">{cartTotalCbm.toFixed(3)} m³</span>
                                </div>
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

      {/* View Line Items Modal */}
      <AnimatePresence>
        {viewLineItems && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-4xl max-h-[85vh] rounded-sm shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <h2 className="text-[13px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  Line Items
                  <span className="bg-[#2874f0]/10 text-[#2874f0] px-2 py-0.5 rounded text-[10px] ml-2">{viewLineItems.length}</span>
                </h2>
                <button
                  onClick={() => setViewLineItems(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-sm transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-grow overflow-auto p-4 custom-scrollbar bg-slate-50/50">
                {viewLineItems.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No line items found.</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#f1f3f6] text-slate-600 text-[10px] uppercase tracking-wider sticky top-0 shadow-sm z-10">
                                <th className="px-4 py-3 font-black">Product</th>
                                <th className="px-4 py-3 font-black">Brand</th>
                                <th className="px-4 py-3 font-black">EAN</th>
                                <th className="px-4 py-3 font-black text-right">Grammage</th>
                                <th className="px-4 py-3 font-black text-right">CBM</th>
                                <th className="px-4 py-3 font-black text-center">Rate Type</th>
                                <th className="px-4 py-3 font-black text-right">Price</th>
                                <th className="px-4 py-3 font-black text-right">Qty</th>
                                <th className="px-4 py-3 font-black text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {viewLineItems.map((item, idx) => {
                                const getValItem = (key: string) => {
                                    const found = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase());
                                    return found ? item[found] : undefined;
                                };
                                const product = getValItem('Product');
                                const brand = getValItem('Brand');
                                const ean = getValItem('Ean Code');
                                const grm = getValItem('Grm');
                                const cbm = getValItem('Cbm');
                                const rateTypeVal = item.selectedRateType || getValItem('selectedRateType');
                                const rate = parseFloat(String(getValItem(rateTypeVal) || '0').replace(/[^0-9.]/g, '')) || 0;
                                const qty = item.quantity || getValItem('quantity') || 0;
                                const total = rate * qty;
                                return (
                                    <tr key={idx} className="hover:bg-white transition-colors bg-white/50 border-b last:border-0 border-slate-100">
                                        <td className="px-4 py-3 text-[12px] font-bold text-slate-800 whitespace-normal break-words max-w-[250px]" title={product}>{product || '—'}</td>
                                        <td className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase">{brand || '—'}</td>
                                        <td className="px-4 py-3 text-[11px] text-[#2874f0] font-mono font-bold">{ean || '—'}</td>
                                        <td className="px-4 py-3 text-[11px] text-right font-bold text-slate-600">{grm ? grm + 'g' : '—'}</td>
                                        <td className="px-4 py-3 text-[11px] text-right font-bold text-slate-600">{cbm ? parseFloat(String(cbm)).toFixed(4) : '—'}</td>
                                        <td className="px-4 py-3 text-[10px] text-center font-black text-[#2874f0] bg-[#2874f0]/5 uppercase">{rateTypeVal || '—'}</td>
                                        <td className="px-4 py-3 text-[12px] text-right font-bold text-slate-900">${rate.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-[12px] text-right font-black text-slate-900 bg-slate-50">{qty}</td>
                                        <td className="px-4 py-3 text-[12px] text-right font-black text-emerald-600">${total.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
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

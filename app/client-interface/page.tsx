'use client';

import { useState, useEffect, useMemo } from 'react';
import LayoutWrapper from '@/components/LayoutWrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { TableToolbar } from '@/components/TableToolbar';
import { useLoader } from '@/components/LoaderProvider';
import { useToast } from '@/components/ToastProvider';

const tabs = [
  { id: 'Client User', label: 'Client User', icon: '👤' },
  { id: 'PreOrder', label: 'PreOrder', icon: '📝' },
  { id: 'Orders', label: 'Orders', icon: '🛒' },
  { id: 'Inventory', label: 'Inventory', icon: '📦' },
  { id: 'Tracker', label: 'Tracker', icon: '⏱️' },
  { id: 'Documents', label: 'Documents', icon: '📄' },
];

const ITEMS_PER_PAGE = 10;

export default function ClientInterfacePage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({ Username: '', Password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [viewLineItems, setViewLineItems] = useState<any[] | null>(null);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderEditItem, setOrderEditItem] = useState<any | null>(null);
  const [orderForm, setOrderForm] = useState({ 'CI Number': '' });
  
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryEditItem, setInventoryEditItem] = useState<any | null>(null);
  const [ordersData, setOrdersData] = useState<any[]>([]);
  const [inventoryGlobal, setInventoryGlobal] = useState({ 'Party Name': '', 'PI Number': '' });
  const defaultInventoryItem = {
    'Product Name': '',
    'Weight/Size': '',
    'Order Qty': '',
    'Price': '',
    'Received Qty': '',
    'Mfg Date': '',
    'Expiry Date': '',
    'Product Image': null as File | null,
  };
  const [inventoryItems, setInventoryItems] = useState([{...defaultInventoryItem}]);
  const [isUploading, setIsUploading] = useState(false);
  const [invFilterParty, setInvFilterParty] = useState('');
  const [invFilterPI, setInvFilterPI] = useState('');
  
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [trackerEditItem, setTrackerEditItem] = useState<any | null>(null);
  const defaultTrackerForm = {
    'Party Name': '',
    'PI Number': '',
    'Production': '',
    'Loading': '',
    'On Road to Port': '',
    'Custom': '',
    'Waiting for Vercel': '',
    'Waiting for Vercel Link': '',
    'Sailed': '',
    'Put container no on the link': '',
    'About to Arrive': '',
    'Arrived': '',
  };
  const [trackerForm, setTrackerForm] = useState({...defaultTrackerForm});

  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentEditItem, setDocumentEditItem] = useState<any | null>(null);
  const defaultDocumentForm = {
    'Party Name': '',
    'PI Number': '',
    'Performa Invoice': '',
    'Commerical Invoice': '',
    'Tax Invoice': '',
    'Packing List': '',
    'Date Sheet': '',
    'Container Booking': '',
    'Loading Photo And Video': '',
    'Bl': '',
    'Coc': '',
    'Health': '',
    'Phyto': '',
    'Advance Remitance': '',
    'Balance Remitance': '',
    'Other': ''
  };
  const [documentForm, setDocumentForm] = useState({...defaultDocumentForm});

  const { showLoader, hideLoader } = useLoader();
  const { addToast } = useToast();

  const fetchData = async (tabName: string) => {
    setLoading(true);
    showLoader();
    try {
      const response = await fetch(`/api/client-interface?tab=${encodeURIComponent(tabName)}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      
      // Reverse to show latest on top
      setData(Array.isArray(result) ? [...result].reverse() : []);
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

  const fetchOrdersData = async () => {
    try {
      const response = await fetch(`/api/client-interface?tab=Orders`);
      if (response.ok) {
        const result = await response.json();
        setOrdersData(Array.isArray(result) ? result : []);
      }
    } catch (error) {
      console.error('Failed to fetch orders data', error);
    }
  };

  useEffect(() => {
    fetchData(activeTab);
    if (activeTab === 'Inventory' || activeTab === 'Tracker' || activeTab === 'Documents') {
      fetchOrdersData();
    }
  }, [activeTab]);

  const filteredData = useMemo(() => {
    let result = data;
    if (activeTab === 'Inventory') {
      if (invFilterParty) result = result.filter((row: any) => row['Party Name'] === invFilterParty);
      if (invFilterPI) result = result.filter((row: any) => row['PI Number'] === invFilterPI);
    }
    if (!searchQuery) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(row =>
      Object.values(row).some(val =>
        String(val).toLowerCase().includes(q)
      )
    );
  }, [data, searchQuery, activeTab, invFilterParty, invFilterPI]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const headers = useMemo(() => {
    if (activeTab === 'Client User') return ['Username', 'Password'];
    if (data.length === 0) return [];
    let keys = Object.keys(data[0]);
    if (activeTab === 'Orders') {
        keys = keys.filter(k => k !== 'CI Number' && k !== 'CI_Number');
        const piIndex = keys.findIndex(k => k === 'PI Number' || k === 'PI_Number');
        if (piIndex !== -1) {
            keys.splice(piIndex + 1, 0, 'CI Number');
        } else {
            keys.push('CI Number');
        }
    }
    return keys;
  }, [data, activeTab]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    showLoader();
    try {
      const method = editingItem ? 'PUT' : 'POST';
      const body = editingItem 
        ? { 
            tab: activeTab, 
            identifierKey: 'Username', 
            identifierValue: editingItem.Username, 
            updates: formData 
          }
        : { tab: activeTab, data: formData };

      const response = await fetch('/api/client-interface', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to save');
      }
      
      addToast(editingItem ? 'User updated' : 'User created', 'success');
      setShowModal(false);
      fetchData(activeTab);
    } catch (error: any) {
      addToast(error.message || 'Failed to save user', 'error');
    } finally {
      hideLoader();
    }
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    showLoader();
    try {
      const response = await fetch('/api/client-interface', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: 'Orders',
          identifierKey: 'PI_Number',
          identifierValue: orderEditItem?.PI_Number || orderEditItem?.['PI Number'],
          updates: { 'CI Number': orderForm['CI Number'] }
        }),
      });
      if (!response.ok) throw new Error('Failed to update CI Number');
      addToast('CI Number updated successfully', 'success');
      setShowOrderModal(false);
      setOrderEditItem(null);
      fetchData(activeTab);
    } catch (error: any) {
      addToast(error.message || 'Failed to save CI Number', 'error');
    } finally {
      hideLoader();
    }
  };

  const handleOrderEdit = (row: any) => {
    setOrderEditItem(row);
    setOrderForm({
      'CI Number': row['CI Number'] || '',
    });
    setShowOrderModal(true);
  };

  const handleInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventoryGlobal['Party Name'] || !inventoryGlobal['PI Number']) {
      addToast('Party Name and PI Number are required', 'error');
      return;
    }
    // For new records, require images. For edits, image is optional (keeps existing)
    if (!inventoryEditItem) {
      const hasMissingImage = inventoryItems.some(item => !item['Product Image']);
      if (hasMissingImage) {
        addToast('Product image is required for all rows', 'error');
        return;
      }
    }
    showLoader();
    setIsUploading(true);
    try {
      const submitDataArray = await Promise.all(inventoryItems.map(async (item) => {
        let imageUrl = inventoryEditItem?.['Product Image'] || '';
        if (item['Product Image']) {
          const fd = new FormData();
          fd.append('file', item['Product Image'] as File);
          fd.append('type', 'inventory');
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
          if (!uploadRes.ok) throw new Error('Image upload failed');
          const uploadData = await uploadRes.json();
          imageUrl = uploadData.url;
        }
        return {
          'Party Name': inventoryGlobal['Party Name'],
          'PI Number': inventoryGlobal['PI Number'],
          'Product Name': item['Product Name'],
          'Weight/Size': item['Weight/Size'],
          'Order Qty': item['Order Qty'],
          'Price': item['Price'],
          'Received Qty': item['Received Qty'],
          'Mfg Date': item['Mfg Date'],
          'Expiry Date': item['Expiry Date'],
          'Product Image': imageUrl,
          'created_at': inventoryEditItem?.['created_at'] || new Date().toISOString(),
        };
      }));

      if (inventoryEditItem) {
        // Edit mode — update the matching record
        const response = await fetch('/api/client-interface', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tab: 'Inventory',
            identifierKey: 'compound',
            identifierValue: JSON.stringify({
              'Party Name': inventoryEditItem['Party Name'] || '',
              'PI Number': inventoryEditItem['PI Number'] || '',
              'Product Name': inventoryEditItem['Product Name'] || '',
              'created_at': inventoryEditItem['created_at'] || ''
            }),
            updates: submitDataArray[0],
          }),
        });
        if (!response.ok) throw new Error('Failed to update inventory');
        addToast('Inventory updated successfully', 'success');
      } else {
        // Add mode — append new rows
        const response = await fetch('/api/client-interface', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tab: 'Inventory', data: submitDataArray }),
        });
        if (!response.ok) throw new Error('Failed to save inventory');
        addToast('Inventory added successfully', 'success');
      }

      setShowInventoryModal(false);
      setInventoryEditItem(null);
      fetchData(activeTab);
    } catch (error: any) {
      addToast(error.message || 'Failed to save inventory', 'error');
    } finally {
      hideLoader();
      setIsUploading(false);
    }
  };

  const handleDelete = async (username: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    showLoader();
    try {
      const response = await fetch(`/api/client-interface?tab=${encodeURIComponent(activeTab)}&identifierKey=Username&identifierValue=${encodeURIComponent(username)}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      
      addToast('User deleted', 'success');
      fetchData(activeTab);
    } catch (error) {
      addToast('Failed to delete user', 'error');
    } finally {
      hideLoader();
    }
  };

  const handleInventoryDelete = async (row: any) => {
    if (!confirm('Delete this inventory record?')) return;
    showLoader();
    try {
      const identifierKey = 'compound';
      const identifierValue = JSON.stringify({
        'Party Name': row['Party Name'] || '',
        'PI Number': row['PI Number'] || '',
        'Product Name': row['Product Name'] || '',
        'created_at': row['created_at'] || ''
      });
      const response = await fetch(
        `/api/client-interface?tab=Inventory&identifierKey=${encodeURIComponent(identifierKey)}&identifierValue=${encodeURIComponent(identifierValue)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to delete');
      addToast('Inventory record deleted', 'success');
      fetchData(activeTab);
    } catch (error) {
      addToast('Failed to delete record', 'error');
    } finally {
      hideLoader();
    }
  };

  const handleInventoryEdit = (row: any) => {
    setInventoryEditItem(row);
    setInventoryGlobal({
      'Party Name': row['Party Name'] || '',
      'PI Number': row['PI Number'] || '',
    });
    setInventoryItems([{
      'Product Name': row['Product Name'] || '',
      'Weight/Size': row['Weight/Size'] || '',
      'Order Qty': row['Order Qty'] || '',
      'Price': row['Price'] || '',
      'Received Qty': row['Received Qty'] || '',
      'Mfg Date': formatDateForLocalInput(row['Mfg Date']).split('T')[0] || '',
      'Expiry Date': formatDateForLocalInput(row['Expiry Date']).split('T')[0] || '',
      'Product Image': null,
    }]);
    setShowInventoryModal(true);
  };

  const handleTrackerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackerForm['Party Name'] || !trackerForm['PI Number']) {
      addToast('Party Name and PI Number are required', 'error');
      return;
    }
    showLoader();
    try {
      const submitData = {
        ...trackerForm,
        'created_at': trackerEditItem?.['created_at'] || new Date().toISOString(),
      };

      if (trackerEditItem) {
        const response = await fetch('/api/client-interface', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tab: 'Tracker',
            identifierKey: 'PI Number',
            identifierValue: trackerEditItem['PI Number'],
            updates: submitData,
          }),
        });
        if (!response.ok) throw new Error('Failed to update tracker');
        addToast('Tracker updated successfully', 'success');
      } else {
        const response = await fetch('/api/client-interface', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tab: 'Tracker', data: submitData }),
        });
        if (!response.ok) throw new Error('Failed to save tracker');
        addToast('Tracker added successfully', 'success');
      }

      setShowTrackerModal(false);
      setTrackerEditItem(null);
      fetchData(activeTab);
    } catch (error: any) {
      addToast(error.message || 'Failed to save tracker', 'error');
    } finally {
      hideLoader();
    }
  };

  const handleTrackerEdit = (row: any) => {
    setTrackerEditItem(row);
    setTrackerForm({
      'Party Name': row['Party Name'] || '',
      'PI Number': row['PI Number'] || '',
      'Production': row['Production'] || '',
      'Loading': row['Loading'] || '',
      'On Road to Port': row['On Road to Port'] || '',
      'Custom': row['Custom'] || '',
      'Waiting for Vercel': row['Waiting for Vercel'] || '',
      'Waiting for Vercel Link': row['Waiting for Vercel Link'] || '',
      'Sailed': row['Sailed'] || '',
      'Put container no on the link': row['Put container no on the link'] || '',
      'About to Arrive': row['About to Arrive'] || '',
      'Arrived': row['Arrived'] || '',
    });
    setShowTrackerModal(true);
  };

  const handleTrackerDelete = async (row: any) => {
    if (!confirm('Delete this tracker record?')) return;
    showLoader();
    try {
      const identifierKey = 'PI Number';
      const identifierValue = row['PI Number'];
      const response = await fetch(
        `/api/client-interface?tab=Tracker&identifierKey=${encodeURIComponent(identifierKey)}&identifierValue=${encodeURIComponent(identifierValue)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to delete');
      addToast('Tracker record deleted', 'success');
      fetchData(activeTab);
    } catch (error) {
      addToast('Failed to delete record', 'error');
    } finally {
      hideLoader();
    }
  };

  const handleDocumentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showLoader();
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folderId', '1SQjykvSQbG_xYYOoAxNn1NLFnv8yNQhi'); // Custom folder ID

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      
      const data = await res.json();
      setDocumentForm(prev => ({ ...prev, [fieldName]: data.url }));
      addToast(`${fieldName} uploaded successfully`, 'success');
    } catch (err) {
      addToast(`Failed to upload ${fieldName}`, 'error');
    } finally {
      hideLoader();
      // Reset input value to allow uploading same file again if needed
      e.target.value = '';
    }
  };

  const handleDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentForm['Party Name'] || !documentForm['PI Number']) {
      addToast('Party Name and PI Number are required', 'error');
      return;
    }
    showLoader();
    try {
      const submitData = {
        ...documentForm,
        'created_at': documentEditItem?.['created_at'] || new Date().toISOString(),
      };

      if (documentEditItem) {
        const idKey = Object.keys(documentEditItem).find(k => k.toLowerCase() === 'pi number' || k.toLowerCase() === 'pi_number') || 'PI_Number';
        const response = await fetch('/api/client-interface', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tab: 'Documents',
            identifierKey: idKey,
            identifierValue: documentEditItem[idKey],
            updates: submitData,
          }),
        });
        if (!response.ok) throw new Error('Failed to update document record');
        addToast('Document record updated successfully', 'success');
      } else {
        const response = await fetch('/api/client-interface', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tab: 'Documents', data: submitData }),
        });
        if (!response.ok) throw new Error('Failed to save document record');
        addToast('Document record added successfully', 'success');
      }

      setShowDocumentModal(false);
      setDocumentEditItem(null);
      fetchData(activeTab);
    } catch (error: any) {
      addToast(error.message || 'Failed to save document record', 'error');
    } finally {
      hideLoader();
    }
  };

  const handleDocumentEdit = (row: any) => {
    setDocumentEditItem(row);
    setDocumentForm({
      'Party Name': row['Party Name'] || row.Party_Name || row['PARTY NAME'] || '',
      'PI Number': row['PI Number'] || row.PI_Number || row['PI NUMBER'] || '',
      'Performa Invoice': row['Performa Invoice'] || row.Performa_Invoice || row['PERFORMA INVOICE'] || '',
      'Commerical Invoice': row['Commerical Invoice'] || row.Commerical_Invoice || row['Commercial Invoice'] || row.Commercial_Invoice || '',
      'Tax Invoice': row['Tax Invoice'] || row.Tax_Invoice || row['TAX INVOICE'] || '',
      'Packing List': row['Packing List'] || row.Packing_List || row['PACKING LIST'] || '',
      'Date Sheet': row['Date Sheet'] || row.Date_Sheet || row['DATE SHEET'] || '',
      'Container Booking': row['Container Booking'] || row.Container_Booking || row['CONTAINER BOOKING'] || '',
      'Loading Photo And Video': row['Loading Photo And Video'] || row.Loading_Photo_And_Video || row['LOADING PHOTO AND VIDEO'] || '',
      'Bl': row['Bl'] || row.BL || row.bl || '',
      'Coc': row['Coc'] || row.COC || row.coc || '',
      'Health': row['Health'] || row.HEALTH || row.health || '',
      'Phyto': row['Phyto'] || row.PHYTO || row.phyto || '',
      'Advance Remitance': row['Advance Remitance'] || row.Advance_Remitance || row['Advance Remittance'] || row.Advance_Remittance || '',
      'Balance Remitance': row['Balance Remitance'] || row.Balance_Remitance || row['Balance Remittance'] || row.Balance_Remittance || '',
      'Other': row['Other'] || row.OTHER || row.other || '',
    });
    setShowDocumentModal(true);
  };

  const handleDocumentDelete = async (row: any) => {
    if (!confirm('Delete this document record?')) return;
    showLoader();
    try {
      const idKey = Object.keys(row).find(k => k.toLowerCase() === 'pi number' || k.toLowerCase() === 'pi_number') || 'PI_Number';
      const idVal = row[idKey];
      const response = await fetch(
        `/api/client-interface?tab=Documents&identifierKey=${encodeURIComponent(idKey)}&identifierValue=${encodeURIComponent(idVal)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to delete');
      addToast('Document record deleted', 'success');
      fetchData(activeTab);
    } catch (error) {
      addToast('Failed to delete record', 'error');
    } finally {
      hideLoader();
    }
  };

  const isUrl = (str: string) => {
      if (typeof str !== 'string') return false;
      return str.startsWith('http://') || str.startsWith('https://');
  };

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

  const formatDateForLocalInput = (val: any) => {
      if (!val) return '';
      const num = Number(val);
      let dateObj;

      if (!isNaN(num) && num > 40000 && num < 60000) {
          const excelEpoch = new Date(1900, 0, 1);
          const msPerDay = 86400000;
          dateObj = new Date(excelEpoch.getTime() + (num - 2) * msPerDay);
      } else {
          dateObj = new Date(val);
      }

      if (isNaN(dateObj.getTime())) return '';
      
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const hh = String(dateObj.getHours()).padStart(2, '0');
      const min = String(dateObj.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  return (
    <LayoutWrapper>
      <div className="min-h-screen bg-[var(--theme-light)] dark:bg-gray-900 transition-colors duration-300">
        <div className="p-4 max-w-[1600px] mx-auto space-y-4">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/40 dark:bg-gray-800/40 backdrop-blur-md p-4 rounded-2xl border border-white/20 dark:border-gray-700/30">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-none">Client Interface</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage all client operations</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-grow md:flex-grow-0">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full md:w-64 pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-[var(--theme-primary)] outline-none transition-all shadow-sm"
                />
                <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {(activeTab === 'Client User' || activeTab === 'Inventory' || activeTab === 'Tracker' || activeTab === 'Documents') && (
                  <button 
                    onClick={() => {
                        if (activeTab === 'Client User') {
                            setEditingItem(null);
                            setFormData({ Username: '', Password: '' });
                            setShowPassword(false);
                            setShowModal(true);
                        } else if (activeTab === 'Inventory') {
                            setInventoryEditItem(null);
                            setInventoryGlobal({ 'Party Name': '', 'PI Number': '' });
                            setInventoryItems([{...defaultInventoryItem}]);
                            setShowInventoryModal(true);
                        } else if (activeTab === 'Tracker') {
                            setTrackerEditItem(null);
                            setTrackerForm({...defaultTrackerForm});
                            setShowTrackerModal(true);
                        } else if (activeTab === 'Documents') {
                            setDocumentEditItem(null);
                            setDocumentForm({...defaultDocumentForm});
                            setShowDocumentModal(true);
                        }
                    }}
                    className="px-4 py-2 bg-[var(--theme-primary)] text-gray-900 font-bold rounded-xl text-sm shadow-sm hover:scale-105 transition-transform"
                  >
                      + Add {activeTab === 'Client User' ? 'User' : activeTab === 'Inventory' ? 'Inventory' : activeTab === 'Tracker' ? 'Tracker' : 'Document'}
                  </button>
              )}

              {/* Inventory Filters */}
              {activeTab === 'Inventory' && data.length > 0 && (
                <>
                  <select
                    value={invFilterParty}
                    onChange={(e) => { setInvFilterParty(e.target.value); setInvFilterPI(''); setCurrentPage(1); }}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-[var(--theme-primary)] outline-none shadow-sm"
                  >
                    <option value="">All Parties</option>
                    {Array.from(new Set(data.map((r: any) => r['Party Name']).filter(Boolean))).map((p: any) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <select
                    value={invFilterPI}
                    onChange={(e) => { setInvFilterPI(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-[var(--theme-primary)] outline-none shadow-sm"
                  >
                    <option value="">All PI Numbers</option>
                    {Array.from(new Set(
                      data
                        .filter((r: any) => !invFilterParty || r['Party Name'] === invFilterParty)
                        .map((r: any) => r['PI Number'])
                        .filter(Boolean)
                    )).map((pi: any) => (
                      <option key={pi} value={pi}>{pi}</option>
                    ))}
                  </select>
                  {(invFilterParty || invFilterPI) && (
                    <button
                      onClick={() => { setInvFilterParty(''); setInvFilterPI(''); setCurrentPage(1); }}
                      className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs hover:scale-105 transition-transform"
                      title="Clear Filters"
                    >
                      ✕ Clear
                    </button>
                  )}
                </>
              )}

              {data.length > 0 && (
                <div className="flex items-center">
                  <TableToolbar 
                    data={filteredData} 
                    fileName={`Client_Interface_${activeTab}`} 
                    columns={headers.map(h => ({ key: h, label: h }))} 
                  />
                </div>
              )}
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex flex-wrap gap-1 bg-white/60 dark:bg-gray-800/60 backdrop-blur-md p-1 rounded-xl border border-white/20 dark:border-gray-700/30 shadow-sm overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[var(--theme-primary)] text-gray-900 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Pagination Row - Before Table */}
          {!loading && filteredData.length > 0 && (
            <div className="flex items-center justify-between px-6 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl border border-white/20 dark:border-gray-700/30 shadow-sm">
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                Showing <span className="text-[var(--theme-primary)] dark:text-[var(--theme-primary)]">{(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}</span> of {filteredData.length} entries
              </div>
              
              <div className="flex items-center gap-2">
                {/* Jump to First */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="First Page"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-[var(--theme-primary)] dark:hover:bg-[var(--theme-primary)] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm group"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-[var(--theme-primary)] dark:hover:bg-[var(--theme-primary)] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                
                <div className="flex items-center px-4 py-1.5 text-xs font-black text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-lg border-2 border-[var(--theme-primary)] shadow-sm">
                  PAGE {currentPage} / {totalPages}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-[var(--theme-primary)] dark:hover:bg-[var(--theme-primary)] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>

                {/* Jump to Last */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Last Page"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-[var(--theme-primary)] dark:hover:bg-[var(--theme-primary)] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Table Area */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] no-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-10 h-10 border-3 border-[var(--theme-primary)]/20 border-t-[var(--theme-primary)] rounded-full animate-spin mb-3" />
                  <p className="text-xs text-gray-500 font-medium">Loading...</p>
                </div>
              ) : data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="text-4xl mb-4">🏜️</div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Data Available</h3>
                  <p className="text-xs text-gray-500 max-w-xs mt-1">
                    No records found in the {activeTab} sheet.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse table-auto">
                  <thead className="sticky top-0 z-10 bg-[var(--theme-primary)] shadow-sm">
                    <tr>
                      {(activeTab === 'Client User' || activeTab === 'Orders' || activeTab === 'Inventory' || activeTab === 'Tracker' || activeTab === 'Documents') && (
                          <th className="px-4 py-3 text-[10px] font-black text-gray-900 uppercase tracking-widest border-b border-gray-100/20 dark:border-gray-700/30">
                              Actions
                          </th>
                      )}
                      {headers.map((header) => (
                        <th key={header} className="px-4 py-3 text-[10px] font-black text-gray-900 uppercase tracking-widest border-b border-gray-100/20 dark:border-gray-700/30">
                          {header.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {paginatedData.map((row, i) => (
                      <tr
                        key={i}
                        className="group hover:bg-[var(--theme-primary)]/5 dark:hover:bg-[var(--theme-primary)]/10 transition-colors"
                      >
                        {/* Actions first */}
                        {activeTab === 'Client User' && (
                            <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            setEditingItem(row);
                                            setFormData({ Username: row.Username || '', Password: row.Password || '' });
                                            setShowPassword(false);
                                            setShowModal(true);
                                        }}
                                        className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:scale-110 transition-transform"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(row.Username)}
                                        className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:scale-110 transition-transform"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </td>
                        )}
                        {activeTab === 'Orders' && (
                            <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                                <button 
                                    onClick={() => handleOrderEdit(row)}
                                    title="Add CI Number"
                                    className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:scale-110 transition-transform"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                            </td>
                        )}
                        {activeTab === 'Inventory' && (
                            <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleInventoryEdit(row)}
                                        title="Edit"
                                        className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:scale-110 transition-transform"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button 
                                        onClick={() => handleInventoryDelete(row)}
                                        title="Delete"
                                        className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:scale-110 transition-transform"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </td>
                        )}
                        {activeTab === 'Tracker' && (
                            <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleTrackerEdit(row)}
                                        title="Edit"
                                        className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:scale-110 transition-transform"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button 
                                        onClick={() => handleTrackerDelete(row)}
                                        title="Delete"
                                        className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:scale-110 transition-transform"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </td>
                        )}
                        {activeTab === 'Documents' && (
                            <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleDocumentEdit(row)}
                                        title="Edit"
                                        className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:scale-110 transition-transform"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button 
                                        onClick={() => handleDocumentDelete(row)}
                                        title="Delete"
                                        className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:scale-110 transition-transform"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </td>
                        )}
                        {headers.map((header) => (
                          <td key={header} className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {row[header] === null || row[header] === undefined ? (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            ) : header === 'Line_Items' ? (
                                <button 
                                    onClick={() => {
                                        try {
                                            const items = typeof row[header] === 'string' ? JSON.parse(row[header]) : row[header];
                                            setViewLineItems(Array.isArray(items) ? items : []);
                                        } catch (e) {
                                            console.error('Failed to parse line items', e);
                                            setViewLineItems([]);
                                        }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--theme-primary)]/20 text-gray-900 dark:text-white font-bold rounded-lg text-xs hover:bg-[var(--theme-primary)]/40 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                    View Items
                                </button>
                            ) : isUrl(String(row[header])) ? (
                                <a 
                                    href={String(row[header])} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg hover:scale-105 transition-transform border border-indigo-100 dark:border-indigo-800"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    View Image
                                </a>
                            ) : header.toLowerCase() === 'cont_fill' || header.toLowerCase() === 'cont fill' ? (
                                <span className="text-[var(--theme-primary)] font-black">{(parseFloat(String(row[header] || '0')) * 100).toFixed(2)}%</span>
                            ) : (
                              formatDateValue(String(row[header]), header)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CRUD Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-[var(--theme-primary)]">
                <h2 className="text-xl font-black text-gray-900">
                  {editingItem ? 'Edit Client User' : 'Add Client User'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-900 hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={formData.Username}
                    onChange={(e) => setFormData({ ...formData, Username: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Password</label>
                  <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.Password}
                        onChange={(e) => setFormData({ ...formData, Password: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white pr-12"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      >
                          {showPassword ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                          )}
                      </button>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[var(--theme-primary)] text-gray-900 font-bold rounded-xl shadow-sm hover:scale-105 transition-transform"
                  >
                    {editingItem ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Line Items Modal */}
      <AnimatePresence>
        {viewLineItems && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  Line Items
                  <span className="bg-[var(--theme-primary)]/20 text-[var(--theme-primary)] px-2 py-0.5 rounded text-xs ml-2">{viewLineItems.length}</span>
                </h2>
                <button
                  onClick={() => setViewLineItems(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-grow overflow-auto p-4 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/20">
                {viewLineItems.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-gray-400">No line items found.</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider sticky top-0 shadow-sm z-10">
                                <th className="px-4 py-3 font-bold rounded-tl-lg">Product</th>
                                <th className="px-4 py-3 font-bold">Brand</th>
                                <th className="px-4 py-3 font-bold">EAN</th>
                                <th className="px-4 py-3 font-bold text-right">Grammage</th>
                                <th className="px-4 py-3 font-bold text-right">CBM</th>
                                <th className="px-4 py-3 font-bold text-center">Rate Type</th>
                                <th className="px-4 py-3 font-bold text-right">Price</th>
                                <th className="px-4 py-3 font-bold text-right">Qty</th>
                                <th className="px-4 py-3 font-bold text-right rounded-tr-lg">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {viewLineItems.map((item, idx) => {
                                const getVal = (key: string) => {
                                    const found = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase());
                                    return found ? item[found] : undefined;
                                };
                                const product = getVal('Product');
                                const brand = getVal('Brand');
                                const ean = getVal('Ean Code');
                                const grm = getVal('Grm');
                                const cbm = getVal('Cbm');
                                const rateType = item.selectedRateType || getVal('selectedRateType');
                                const rate = parseFloat(String(getVal(rateType) || '0').replace(/[^0-9.]/g, '')) || 0;
                                const qty = item.quantity || getVal('quantity') || 0;
                                const total = rate * qty;
                                return (
                                    <tr key={idx} className="hover:bg-white dark:hover:bg-gray-800/50 transition-colors bg-white/50 dark:bg-gray-800/20">
                                        <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white whitespace-normal break-words max-w-[300px]" title={product}>{product || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{brand || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">{ean || '—'}</td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-700 dark:text-gray-300">{grm ? grm + 'g' : '—'}</td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-700 dark:text-gray-300">{cbm ? parseFloat(String(cbm)).toFixed(4) : '—'}</td>
                                        <td className="px-4 py-3 text-xs text-center font-bold text-[var(--theme-primary)] bg-[var(--theme-primary)]/5">{rateType || '—'}</td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">${rate.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-sm text-right font-black text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/80">{qty}</td>
                                        <td className="px-4 py-3 text-sm text-right font-bold text-emerald-600 dark:text-emerald-400">${total.toFixed(2)}</td>
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

      {/* Inventory Modal */}
      <AnimatePresence>
        {showInventoryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 w-full max-w-[95vw] max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-[var(--theme-primary)]">
                <h2 className="text-xl font-black text-gray-900">{inventoryEditItem ? 'Edit Inventory Record' : 'Add Inventory Details'}</h2>
                <button onClick={() => { setShowInventoryModal(false); setInventoryEditItem(null); }} className="text-gray-900 hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleInventorySubmit} className="p-6 flex-grow overflow-y-auto space-y-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Party Name</label>
                    <select
                      required
                      value={inventoryGlobal['Party Name']}
                      onChange={(e) => setInventoryGlobal({ ...inventoryGlobal, 'Party Name': e.target.value, 'PI Number': '' })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                    >
                      <option value="">Select Party</option>
                      {Array.from(new Set(ordersData.map(o => o.Prepared_By).filter(Boolean))).map((party: any) => (
                        <option key={party} value={party}>{party}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">PI Number</label>
                    <select
                      required
                      value={inventoryGlobal['PI Number']}
                      onChange={(e) => setInventoryGlobal({ ...inventoryGlobal, 'PI Number': e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                      disabled={!inventoryGlobal['Party Name']}
                    >
                      <option value="">Select PI Number</option>
                      {ordersData.filter(o => o.Prepared_By === inventoryGlobal['Party Name']).map(o => o.PI_Number).filter(Boolean).map((pi: any) => (
                        <option key={pi} value={pi}>{pi}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2 overflow-x-auto custom-scrollbar pb-2">
                  <div className="min-w-[1200px]">
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1.5fr_auto] gap-3 px-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Product Name</div>
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Weight/Size</div>
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Order Qty</div>
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Price</div>
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Received Qty</div>
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Mfg Date</div>
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Expiry Date</div>
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Image *</div>
                      <div className="w-8"></div>
                    </div>
                    
                    <div className="space-y-2 mt-2">
                      {inventoryItems.map((item, index) => {
                        const selectedOrder = ordersData.find(o => o.Prepared_By === inventoryGlobal['Party Name'] && o.PI_Number === inventoryGlobal['PI Number']);
                        let productOptions: any[] = [];
                        if (selectedOrder?.Line_Items) {
                          try {
                            const itemsArr = typeof selectedOrder.Line_Items === 'string' ? JSON.parse(selectedOrder.Line_Items) : selectedOrder.Line_Items;
                            if (Array.isArray(itemsArr)) {
                              productOptions = itemsArr.filter((i: any) => i.PRODUCT);
                            }
                          } catch (e) {}
                        }

                        return (
                          <div key={index} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1.5fr_auto] gap-3 items-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                            <select
                              required
                              value={item['Product Name']}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                const selectedProduct = e.target.value;
                                newItems[index]['Product Name'] = selectedProduct;
                                
                                const prodObj = productOptions.find((p: any) => p.PRODUCT === selectedProduct);
                                if (prodObj) {
                                  newItems[index]['Order Qty'] = prodObj.QTY || prodObj.Qty || prodObj.Quantity || prodObj.quantity || prodObj.Order_Qty || '';
                                  newItems[index]['Weight/Size'] = prodObj.WEIGHT_SIZE || prodObj.Weight_Size || prodObj.Weight || prodObj.Size || prodObj['Weight/Size'] || '';
                                  newItems[index]['Price'] = prodObj.PRICE || prodObj.Price || prodObj.price || '';
                                }

                                setInventoryItems(newItems);
                              }}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                            >
                              <option value="">Select</option>
                              {productOptions.map((prodObj: any, i: number) => (
                                  <option key={i} value={prodObj.PRODUCT}>{prodObj.PRODUCT}</option>
                              ))}
                            </select>
                            
                            <input
                              type="text"
                              required
                              value={item['Weight/Size']}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index]['Weight/Size'] = e.target.value;
                                setInventoryItems(newItems);
                              }}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                              placeholder="Weight/Size"
                            />
                            
                            <input
                              type="number"
                              required
                              value={item['Order Qty']}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index]['Order Qty'] = e.target.value;
                                setInventoryItems(newItems);
                              }}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                              placeholder="Qty"
                            />
                            
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={item['Price']}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index]['Price'] = e.target.value;
                                setInventoryItems(newItems);
                              }}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                              placeholder="Price"
                            />
                            
                            <input
                              type="number"
                              required
                              value={item['Received Qty']}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index]['Received Qty'] = e.target.value;
                                setInventoryItems(newItems);
                              }}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                              placeholder="Rcvd"
                            />
                            
                            <input
                              type="date"
                              required
                              value={item['Mfg Date']}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index]['Mfg Date'] = e.target.value;
                                setInventoryItems(newItems);
                              }}
                              className="w-full px-2 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                            />
                            
                            <input
                              type="date"
                              required
                              value={item['Expiry Date']}
                              onChange={(e) => {
                                const newItems = [...inventoryItems];
                                newItems[index]['Expiry Date'] = e.target.value;
                                setInventoryItems(newItems);
                              }}
                              className="w-full px-2 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                            />
                            
                            <div className="flex flex-col">
                              <input
                                type="file"
                                required={!inventoryEditItem}
                                accept="image/*"
                                onChange={(e) => {
                                  const newItems = [...inventoryItems];
                                  newItems[index]['Product Image'] = e.target.files?.[0] || null;
                                  setInventoryItems(newItems);
                                }}
                                className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[var(--theme-primary)]/10 file:text-[var(--theme-primary)] hover:file:bg-[var(--theme-primary)]/20"
                              />
                              {inventoryEditItem && inventoryEditItem['Product Image'] && !item['Product Image'] && (
                                <a href={inventoryEditItem['Product Image']} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 hover:underline">View existing image</a>
                              )}
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = [...inventoryItems];
                                newItems.splice(index, 1);
                                setInventoryItems(newItems);
                              }}
                              disabled={inventoryItems.length === 1}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-30 transition-colors flex-shrink-0"
                              title="Remove Row"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button type="button" onClick={() => setInventoryItems([...inventoryItems, {...defaultInventoryItem}])} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-bold rounded-xl shadow-sm hover:scale-105 transition-transform">+ Add Another Row</button>
                  </div>
                </div>

                <div className="pt-4 flex gap-3 sticky bottom-0 bg-white dark:bg-gray-800 pb-2 mt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowInventoryModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="flex-1 px-4 py-2 bg-[var(--theme-primary)] text-gray-900 font-bold rounded-xl shadow-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? 'Uploading & Saving...' : 'Save Inventory'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Modal */}
      <AnimatePresence>
        {showOrderModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 w-full max-w-md flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-[var(--theme-primary)]">
                <h2 className="text-xl font-black text-gray-900">Add CI Number</h2>
                <button onClick={() => { setShowOrderModal(false); setOrderEditItem(null); }} className="text-gray-900 hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleOrderSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">PI Number</label>
                  <input
                    type="text"
                    disabled
                    value={orderEditItem?.PI_Number || orderEditItem?.['PI Number'] || ''}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">CI Number</label>
                  <input
                    type="text"
                    required
                    value={orderForm['CI Number']}
                    onChange={(e) => setOrderForm({ ...orderForm, 'CI Number': e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                    placeholder="Enter CI Number..."
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowOrderModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[var(--theme-primary)] text-gray-900 font-bold rounded-xl shadow-sm hover:scale-105 transition-transform"
                  >
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tracker Modal */}
      <AnimatePresence>
        {showTrackerModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-[var(--theme-primary)]">
                <h2 className="text-xl font-black text-gray-900">{trackerEditItem ? 'Edit Tracker Details' : 'Add Tracker Stage Details'}</h2>
                <button onClick={() => { setShowTrackerModal(false); setTrackerEditItem(null); }} className="text-gray-900 hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleTrackerSubmit} className="p-6 flex-grow overflow-y-auto space-y-4 custom-scrollbar">
                {/* Party & PI Dropdowns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Party Name</label>
                    <select
                      required
                      value={trackerForm['Party Name']}
                      onChange={(e) => setTrackerForm({ ...trackerForm, 'Party Name': e.target.value, 'PI Number': '' })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                      disabled={!!trackerEditItem}
                    >
                      <option value="">Select Party</option>
                      {Array.from(new Set(ordersData.map(o => o.Prepared_By).filter(Boolean))).map((party: any) => (
                        <option key={party} value={party}>{party}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">PI Number</label>
                    <select
                      required
                      value={trackerForm['PI Number']}
                      onChange={(e) => setTrackerForm({ ...trackerForm, 'PI Number': e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                      disabled={!trackerForm['Party Name'] || !!trackerEditItem}
                    >
                      <option value="">Select PI Number</option>
                      {ordersData.filter(o => o.Prepared_By === trackerForm['Party Name']).map(o => o.PI_Number).filter(Boolean).map((pi: any) => (
                        <option key={pi} value={pi}>{pi}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 my-4 pt-4">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase mb-3 tracking-wide">Tracking Stages</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Production */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Production Date/Time</label>
                      <input
                        type="datetime-local"
                        value={formatDateForLocalInput(trackerForm['Production'])}
                        onChange={(e) => setTrackerForm({ ...trackerForm, 'Production': e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                      />
                    </div>
                    {/* Loading */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Loading Date/Time</label>
                      <input
                        type="datetime-local"
                        value={formatDateForLocalInput(trackerForm['Loading'])}
                        onChange={(e) => setTrackerForm({ ...trackerForm, 'Loading': e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                      />
                    </div>
                    {/* On Road to Port */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">On Road to Port Date/Time</label>
                      <input
                        type="datetime-local"
                        value={formatDateForLocalInput(trackerForm['On Road to Port'])}
                        onChange={(e) => setTrackerForm({ ...trackerForm, 'On Road to Port': e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                      />
                    </div>
                    {/* Custom */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Custom Date/Time</label>
                      <input
                        type="datetime-local"
                        value={formatDateForLocalInput(trackerForm['Custom'])}
                        onChange={(e) => setTrackerForm({ ...trackerForm, 'Custom': e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                      />
                    </div>
                    {/* Waiting for Vercel */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Waiting for Vercel Date/Time</label>
                      <input
                        type="datetime-local"
                        value={formatDateForLocalInput(trackerForm['Waiting for Vercel'])}
                        onChange={(e) => setTrackerForm({ ...trackerForm, 'Waiting for Vercel': e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                      />
                    </div>
                    {/* Waiting for Vercel Link */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Waiting for Vercel Link</label>
                      <input
                        type="url"
                        placeholder="https://example.vercel.app"
                        value={trackerForm['Waiting for Vercel Link'] || ''}
                        onChange={(e) => setTrackerForm({ ...trackerForm, 'Waiting for Vercel Link': e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                      />
                    </div>
                    {/* Sailed */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Sailed Date/Time</label>
                      <input
                        type="datetime-local"
                        value={formatDateForLocalInput(trackerForm['Sailed'])}
                        onChange={(e) => setTrackerForm({ ...trackerForm, 'Sailed': e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                      />
                    </div>
                    {/* Put container no on the link */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Put container no on the link</label>
                      <input
                        type="text"
                        placeholder="Container no., link, etc."
                        value={trackerForm['Put container no on the link'] || ''}
                        onChange={(e) => setTrackerForm({ ...trackerForm, 'Put container no on the link': e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                      />
                    </div>
                    {/* About to Arrive */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">About to Arrive Date/Time</label>
                      <input
                        type="datetime-local"
                        value={formatDateForLocalInput(trackerForm['About to Arrive'])}
                        onChange={(e) => setTrackerForm({ ...trackerForm, 'About to Arrive': e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                      />
                    </div>
                    {/* Arrived */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Arrived Date/Time</label>
                      <input
                        type="datetime-local"
                        value={formatDateForLocalInput(trackerForm['Arrived'])}
                        onChange={(e) => setTrackerForm({ ...trackerForm, 'Arrived': e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3 sticky bottom-0 bg-white dark:bg-gray-800 pb-2 mt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowTrackerModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[var(--theme-primary)] text-gray-900 font-bold rounded-xl shadow-sm hover:scale-105 transition-transform"
                  >
                    Save Tracker Details
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Document Modal */}
      <AnimatePresence>
        {showDocumentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-[var(--theme-primary)]">
                <h2 className="text-xl font-black text-gray-900">{documentEditItem ? 'Edit Document Details' : 'Add Document Details'}</h2>
                <button onClick={() => { setShowDocumentModal(false); setDocumentEditItem(null); }} className="text-gray-900 hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleDocumentSubmit} className="p-6 flex-grow overflow-y-auto space-y-4 custom-scrollbar">
                {/* Party & PI Dropdowns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Party Name</label>
                    <select
                      required
                      value={documentForm['Party Name']}
                      onChange={(e) => setDocumentForm({ ...documentForm, 'Party Name': e.target.value, 'PI Number': '' })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                      disabled={!!documentEditItem}
                    >
                      <option value="">Select Party</option>
                      {Array.from(new Set(ordersData.map(o => o.Prepared_By).filter(Boolean))).map((party: any) => (
                        <option key={party} value={party}>{party}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">PI Number</label>
                    <select
                      required
                      value={documentForm['PI Number']}
                      onChange={(e) => setDocumentForm({ ...documentForm, 'PI Number': e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white"
                      disabled={!documentForm['Party Name'] || !!documentEditItem}
                    >
                      <option value="">Select PI Number</option>
                      {ordersData.filter(o => o.Prepared_By === documentForm['Party Name']).map(o => o.PI_Number).filter(Boolean).map((pi: any) => (
                        <option key={pi} value={pi}>{pi}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 my-4 pt-4">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase mb-3 tracking-wide">Document Links / Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Performa Invoice</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Performa Invoice'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Performa Invoice': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Performa Invoice')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Commerical Invoice</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Commerical Invoice'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Commerical Invoice': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Commerical Invoice')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Tax Invoice</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Tax Invoice'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Tax Invoice': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Tax Invoice')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Packing List</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Packing List'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Packing List': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Packing List')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Date Sheet</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Date Sheet'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Date Sheet': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Date Sheet')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Container Booking</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Container Booking'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Container Booking': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Container Booking')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Loading Photo And Video</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Loading Photo And Video'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Loading Photo And Video': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Loading Photo And Video')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Bl</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Bl'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Bl': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Bl')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Coc</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Coc'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Coc': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Coc')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Health</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Health'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Health': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Health')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Phyto</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Phyto'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Phyto': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Phyto')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Advance Remitance</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Advance Remitance'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Advance Remitance': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Advance Remitance')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Balance Remitance</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Balance Remitance'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Balance Remitance': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Balance Remitance')} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Other</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link or value"
                          value={documentForm['Other'] || ''}
                          onChange={(e) => setDocumentForm({ ...documentForm, 'Other': e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-[var(--theme-primary)] dark:text-white text-xs"
                        />
                        <label title="Upload Document" className="cursor-pointer flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" onChange={(e) => handleDocumentFileUpload(e, 'Other')} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3 sticky bottom-0 bg-white dark:bg-gray-800 pb-2 mt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowDocumentModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[var(--theme-primary)] text-gray-900 font-bold rounded-xl shadow-sm hover:scale-105 transition-transform"
                  >
                    Save Documents
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </LayoutWrapper>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
    id: string | number;
    name: string;
}

interface SearchableDropdownProps {
    options: Option[];
    value: string | number | null;
    onChange: (value: string | number) => void;
    placeholder?: string;
    label?: string;
    allowCustomValue?: boolean;
}

export default function SearchableDropdown({
    options,
    value,
    onChange,
    placeholder = 'Search...',
    label,
    allowCustomValue = false
}: SearchableDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.id?.toString() === value?.toString());

    const filteredOptions = options.filter(opt =>
        (opt.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            {label && <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1 mb-1.5">{label}</label>}
            <div className="relative">
                <input
                    type="text"
                    value={isOpen ? searchTerm : (selectedOption?.name || (allowCustomValue ? value : '') || '')}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => {
                        setIsOpen(true);
                        setSearchTerm(isOpen ? searchTerm : (selectedOption?.name || (allowCustomValue ? value?.toString() : '') || ''));
                    }}
                    placeholder={placeholder}
                    className="w-full px-4 py-2.5 bg-[var(--theme-lighter)] dark:bg-gray-700/50 rounded-xl font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[var(--theme-primary)] transition-all text-sm border-0"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto"
                    >
                        {filteredOptions.length > 0 ? (
                            <>
                                {filteredOptions.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => {
                                            onChange(opt.id);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className={`w-full px-4 py-3 text-left hover:bg-[var(--theme-primary)]/10 dark:hover:bg-gray-700 transition text-sm ${value?.toString() === opt.id.toString() ? 'bg-[var(--theme-primary)]/20 font-semibold' : ''
                                            }`}
                                    >
                                        {opt.name}
                                    </button>
                                ))}
                                {allowCustomValue && searchTerm && !options.some(opt => opt.name.toLowerCase() === searchTerm.toLowerCase()) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange(searchTerm);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className="w-full px-4 py-3 text-left hover:bg-[var(--theme-primary)]/10 dark:hover:bg-gray-700 transition text-sm border-t border-gray-100 dark:border-gray-700 italic text-indigo-600 dark:text-indigo-400 font-medium"
                                    >
                                        Keep "{searchTerm}"
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col">
                                {allowCustomValue && searchTerm ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange(searchTerm);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className="w-full px-4 py-3 text-left hover:bg-[var(--theme-primary)]/10 dark:hover:bg-gray-700 transition text-sm italic text-indigo-600 dark:text-indigo-400 font-medium"
                                    >
                                        Keep "{searchTerm}"
                                    </button>
                                ) : (
                                    <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 italic">
                                        No results found
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}


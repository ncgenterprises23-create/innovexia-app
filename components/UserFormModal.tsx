'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserFormModalProps {
  showModal: boolean;
  editingUserId: number | null;
  formData: any;
  setFormData: (data: any) => void;
  onClose: () => void;
  onSave: (e: React.FormEvent) => Promise<void>;
  roles: any[];
  imagePreview: string;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  offerLetterFile: File | null;
  setOfferLetterFile: (file: File | null) => void;
  educationList: any[];
  setEducationList: (list: any[]) => void;
  experienceList: any[];
  setExperienceList: (list: any[]) => void;
  uploading: boolean;
}

const STEPS = [
  { id: 1, title: 'Basic Info', icon: '👤' },
  { id: 2, title: 'Personal Details', icon: '📝' },
  { id: 3, title: 'Address', icon: '📍' },
  { id: 4, title: 'Professional', icon: '💼' },
  { id: 5, title: 'Education & Experience', icon: '🎓' },
];

const COUNTRIES = ['India', 'USA', 'UK', 'Canada', 'Australia'];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

export default function UserFormModal({
  showModal,
  editingUserId,
  formData,
  setFormData,
  onClose,
  onSave,
  roles,
  imagePreview,
  onImageChange,
  offerLetterFile,
  setOfferLetterFile,
  educationList,
  setEducationList,
  experienceList,
  setExperienceList,
  uploading
}: UserFormModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep === STEPS.length) {
      await onSave(e);
    } else {
      handleNext();
    }
  };

  const addEducation = () => {
    setEducationList([...educationList, { school_name: '', degree: '', field_of_study: '', completion_date: '', notes: '' }]);
  };

  const removeEducation = (index: number) => {
    setEducationList(educationList.filter((_, i) => i !== index));
  };

  const updateEducation = (index: number, field: string, value: string) => {
    const updated = [...educationList];
    updated[index][field] = value;
    setEducationList(updated);
  };

  const addExperience = () => {
    setExperienceList([...experienceList, { occupation: '', company: '', summary: '', duration: '', currently_working: false }]);
  };

  const removeExperience = (index: number) => {
    setExperienceList(experienceList.filter((_, i) => i !== index));
  };

  const updateExperience = (index: number, field: string, value: string | boolean) => {
    const updated = [...experienceList];
    updated[index][field] = value;
    setExperienceList(updated);
  };

  const handleOfferLetterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOfferLetterFile(file);
    }
  };

  const parseLatLong = (val: any) => {
    if (!val) return { location1: '', location2: '' };

    if (typeof val === 'object') {
      return {
        location1: val.location1 || '',
        location2: val.location2 || ''
      };
    }

    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          location1: parsed.location1 || '',
          location2: parsed.location2 || ''
        };
      }
    } catch(e) {}
    // fallback for legacy strings
    return { location1: typeof val === 'string' ? val : String(val), location2: '' };
  };

  const currentLatLong = parseLatLong(formData.late_long);

  const handleLatLongChange = (field: 'location1' | 'location2', val: string) => {
    const newVal = { ...currentLatLong, [field]: val };
    setFormData({ ...formData, late_long: JSON.stringify(newVal) });
  };

  return (
    <AnimatePresence>
      {showModal && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl my-8"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] p-6 rounded-t-2xl">
              <h3 className="text-2xl font-bold text-gray-900">
                {editingUserId ? 'Edit Employee' : 'Add New Employee'}
              </h3>
              <p className="text-sm text-gray-700 mt-1">Complete all steps to add employee details</p>
            </div>

            {/* Progress Steps */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <motion.div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-all ${currentStep >= step.id
                            ? 'bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                          }`}
                        whileHover={{ scale: 1.05 }}
                      >
                        {step.icon}
                      </motion.div>
                      <span className={`text-xs mt-2 font-semibold ${currentStep >= step.id ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                        {step.title}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={`h-1 flex-1 mx-2 rounded-full ${currentStep > step.id ? 'bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)]' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="px-6 pb-6">
              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* Step 1: Basic Info */}
                {currentStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Username *
                        </label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          required
                          disabled={editingUserId ? true : false}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Password {editingUserId ? '(leave blank to keep current)' : '*'}
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-4 py-2.5 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                            required={!editingUserId}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                          >
                            {showPassword ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Phone
                        </label>
                        <div className="flex gap-2">
                          <span className="px-3 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm">+91</span>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                            placeholder="10-digit number"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Role *
                        </label>
                        <select
                          value={formData.roleName}
                          onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          required
                        >
                          <option value="Admin">Admin</option>
                          <option value="TL">TL</option>
                          <option value="User">User</option>
                        </select>
                      </div>

                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Late/Long (Locations)
                        </label>
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={currentLatLong.location1}
                            onChange={(e) => handleLatLongChange('location1', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                            placeholder="Location 1 (e.g., 28.6139, 77.2090)"
                          />
                          <input
                            type="text"
                            value={currentLatLong.location2}
                            onChange={(e) => handleLatLongChange('location2', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                            placeholder="Location 2 (e.g., 28.6139, 77.2090)"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Photo
                      </label>
                      <div className="flex items-center gap-4">
                        {imagePreview && (
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-20 h-20 rounded-full object-cover border-4 border-[var(--theme-primary)] shadow-lg"
                          />
                        )}
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/jpg,image/jpeg,image/png,image/gif"
                            onChange={onImageChange}
                            className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-[var(--theme-primary)]/20 file:to-[var(--theme-secondary)]/20 file:text-gray-900 hover:file:from-[var(--theme-primary)]/30 hover:file:to-[var(--theme-secondary)]/30 file:cursor-pointer cursor-pointer"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">JPG, PNG, GIF, JPEG (Max 5MB)</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Personal Details */}
                {currentStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={formData.dob}
                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          UAN Number
                        </label>
                        <input
                          type="text"
                          value={formData.uan_number}
                          onChange={(e) => setFormData({ ...formData, uan_number: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          placeholder="12-digit UAN"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Aadhaar Card Number
                        </label>
                        <input
                          type="text"
                          value={formData.aadhaar_number}
                          onChange={(e) => setFormData({ ...formData, aadhaar_number: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          placeholder="12-digit Aadhaar"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          PAN Card Number
                        </label>
                        <input
                          type="text"
                          value={formData.pan_number}
                          onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          placeholder="ABCDE1234F"
                          maxLength={10}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Address Details */}
                {currentStep === 3 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                        Present Address
                      </h4>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Address Line 1
                          </label>
                          <input
                            type="text"
                            value={formData.present_address_line1}
                            onChange={(e) => setFormData({ ...formData, present_address_line1: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Address Line 2
                          </label>
                          <input
                            type="text"
                            value={formData.present_address_line2}
                            onChange={(e) => setFormData({ ...formData, present_address_line2: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              City
                            </label>
                            <input
                              type="text"
                              value={formData.present_city}
                              onChange={(e) => setFormData({ ...formData, present_city: e.target.value })}
                              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              State
                            </label>
                            <select
                              value={formData.present_state}
                              onChange={(e) => setFormData({ ...formData, present_state: e.target.value })}
                              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                            >
                              <option value="">Select State</option>
                              {INDIAN_STATES.map(state => (
                                <option key={state} value={state}>{state}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Postal Code
                            </label>
                            <input
                              type="text"
                              value={formData.present_postal_code}
                              onChange={(e) => setFormData({ ...formData, present_postal_code: e.target.value })}
                              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                              placeholder="6-digit PIN"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-3 p-4 bg-gradient-to-r from-[var(--theme-primary)]/10 to-[var(--theme-secondary)]/10 rounded-xl border-2 border-dashed border-[var(--theme-primary)]/30 cursor-pointer hover:from-[var(--theme-primary)]/20 hover:to-[var(--theme-secondary)]/20 transition-all">
                        <input
                          type="checkbox"
                          checked={formData.permanent_same_as_present === true || formData.permanent_same_as_present === 'true'}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormData({
                              ...formData,
                              permanent_same_as_present: checked,
                              ...(checked && {
                                permanent_address_line1: formData.present_address_line1,
                                permanent_address_line2: formData.present_address_line2,
                                permanent_city: formData.present_city,
                                permanent_country: formData.present_country,
                                permanent_state: formData.present_state,
                                permanent_postal_code: formData.present_postal_code,
                              })
                            });
                          }}
                          className="w-5 h-5 text-[var(--theme-primary)] border-2 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-[var(--theme-primary)]"
                        />
                        <span className="font-semibold text-gray-900 dark:text-white">
                          Permanent address same as present address
                        </span>
                      </label>
                    </div>

                    {!formData.permanent_same_as_present && (
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <span className="bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                          Permanent Address
                        </h4>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Address Line 1
                            </label>
                            <input
                              type="text"
                              value={formData.permanent_address_line1}
                              onChange={(e) => setFormData({ ...formData, permanent_address_line1: e.target.value })}
                              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Address Line 2
                            </label>
                            <input
                              type="text"
                              value={formData.permanent_address_line2}
                              onChange={(e) => setFormData({ ...formData, permanent_address_line2: e.target.value })}
                              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                City
                              </label>
                              <input
                                type="text"
                                value={formData.permanent_city}
                                onChange={(e) => setFormData({ ...formData, permanent_city: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                State
                              </label>
                              <select
                                value={formData.permanent_state}
                                onChange={(e) => setFormData({ ...formData, permanent_state: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                              >
                                <option value="">Select State</option>
                                {INDIAN_STATES.map(state => (
                                  <option key={state} value={state}>{state}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Postal Code
                              </label>
                              <input
                                type="text"
                                value={formData.permanent_postal_code}
                                onChange={(e) => setFormData({ ...formData, permanent_postal_code: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                                placeholder="6-digit PIN"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 4: Professional Details */}
                {currentStep === 4 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Experience
                        </label>
                        <input
                          type="text"
                          value={formData.experience}
                          onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          placeholder="e.g., 3 years"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Source of Hire
                        </label>
                        <select
                          value={formData.source_of_hire}
                          onChange={(e) => setFormData({ ...formData, source_of_hire: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                        >
                          <option value="">Select</option>
                          <option value="Job Portal">Job Portal</option>
                          <option value="Referral">Referral</option>
                          <option value="Walk-in">Walk-in</option>
                          <option value="Consultancy">Consultancy</option>
                          <option value="Campus">Campus</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Skill Set
                      </label>
                      <textarea
                        value={formData.skill_set}
                        onChange={(e) => setFormData({ ...formData, skill_set: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent resize-none"
                        rows={2}
                        placeholder="e.g., JavaScript, React, Node.js"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Highest Qualification
                        </label>
                        <input
                          type="text"
                          value={formData.highest_qualification}
                          onChange={(e) => setFormData({ ...formData, highest_qualification: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          placeholder="e.g., B.Tech, MBA"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Location
                        </label>
                        <input
                          type="text"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          placeholder="Work location"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Title
                        </label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          placeholder="Job title"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Current Salary
                        </label>
                        <input
                          type="text"
                          value={formData.current_salary}
                          onChange={(e) => setFormData({ ...formData, current_salary: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                          placeholder="e.g., ₹50,000"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Department
                        </label>
                        <select
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                        >
                          <option value="">Select</option>
                          <option value="IT">IT</option>
                          <option value="HR">HR</option>
                          <option value="Finance">Finance</option>
                          <option value="Sales">Sales</option>
                          <option value="Marketing">Marketing</option>
                          <option value="Operations">Operations</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Additional Information
                      </label>
                      <textarea
                        value={formData.additional_information}
                        onChange={(e) => setFormData({ ...formData, additional_information: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent resize-none"
                        rows={3}
                        placeholder="Any additional notes"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Offer Letter
                        </label>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleOfferLetterChange}
                          className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-[var(--theme-primary)]/20 file:to-[var(--theme-secondary)]/20 file:text-gray-900 hover:file:from-[var(--theme-primary)]/30 hover:file:to-[var(--theme-secondary)]/30 file:cursor-pointer cursor-pointer"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PDF, DOC, DOCX (Max 5MB)</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Tentative Joining Date
                        </label>
                        <input
                          type="date"
                          value={formData.tentative_joining_date}
                          onChange={(e) => setFormData({ ...formData, tentative_joining_date: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 5: Education & Experience */}
                {currentStep === 5 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    {/* Education Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          🎓 Education
                        </h4>
                        <motion.button
                          type="button"
                          onClick={addEducation}
                          className="px-4 py-2 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 rounded-xl font-semibold hover:shadow-lg transition-all text-sm"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          + Add Row
                        </motion.button>
                      </div>

                      <div className="space-y-4">
                        {educationList.map((edu, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 relative"
                          >
                            {educationList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeEducation(index)}
                                className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all flex items-center justify-center font-bold"
                              >
                                ×
                              </button>
                            )}

                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <input
                                type="text"
                                value={edu.school_name}
                                onChange={(e) => updateEducation(index, 'school_name', e.target.value)}
                                placeholder="School/College Name"
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent text-sm"
                              />
                              <input
                                type="text"
                                value={edu.degree}
                                onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                                placeholder="Degree/Diploma"
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent text-sm"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <input
                                type="text"
                                value={edu.field_of_study}
                                onChange={(e) => updateEducation(index, 'field_of_study', e.target.value)}
                                placeholder="Field(s) of Study"
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent text-sm"
                              />
                              <input
                                type="date"
                                value={edu.completion_date}
                                onChange={(e) => updateEducation(index, 'completion_date', e.target.value)}
                                placeholder="Date of Completion"
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent text-sm"
                              />
                              <input
                                type="text"
                                value={edu.notes}
                                onChange={(e) => updateEducation(index, 'notes', e.target.value)}
                                placeholder="Additional Notes"
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent text-sm"
                              />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Experience Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          💼 Work Experience
                        </h4>
                        <motion.button
                          type="button"
                          onClick={addExperience}
                          className="px-4 py-2 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 rounded-xl font-semibold hover:shadow-lg transition-all text-sm"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          + Add Row
                        </motion.button>
                      </div>

                      <div className="space-y-4">
                        {experienceList.map((exp, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 relative"
                          >
                            {experienceList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeExperience(index)}
                                className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all flex items-center justify-center font-bold"
                              >
                                ×
                              </button>
                            )}

                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <input
                                type="text"
                                value={exp.occupation}
                                onChange={(e) => updateExperience(index, 'occupation', e.target.value)}
                                placeholder="Occupation/Designation"
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent text-sm"
                              />
                              <input
                                type="text"
                                value={exp.company}
                                onChange={(e) => updateExperience(index, 'company', e.target.value)}
                                placeholder="Company"
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent text-sm"
                              />
                            </div>

                            <textarea
                              value={exp.summary}
                              onChange={(e) => updateExperience(index, 'summary', e.target.value)}
                              placeholder="Summary of responsibilities and achievements"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent text-sm resize-none mb-3"
                              rows={2}
                            />

                            <div className="flex items-center gap-4">
                              <input
                                type="text"
                                value={exp.duration}
                                onChange={(e) => updateExperience(index, 'duration', e.target.value)}
                                placeholder="Duration (e.g., 2 years)"
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent text-sm"
                              />
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={exp.currently_working === true || exp.currently_working === 'true'}
                                  onChange={(e) => updateExperience(index, 'currently_working', e.target.checked)}
                                  className="w-4 h-4 text-[var(--theme-primary)] border-2 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-[var(--theme-primary)]"
                                />
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Currently Working Here</span>
                              </label>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                {currentStep > 1 && (
                  <motion.button
                    type="button"
                    onClick={handlePrevious}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    ← Previous
                  </motion.button>
                )}

                <motion.button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>

                <motion.button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-gray-900 rounded-xl font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  whileHover={{ scale: uploading ? 1 : 1.02 }}
                  whileTap={{ scale: uploading ? 1 : 0.98 }}
                >
                  {uploading ? 'Uploading...' : currentStep === STEPS.length ? '✓ Save Employee' : 'Next →'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


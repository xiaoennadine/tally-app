/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Calendar, User, DollarSign, Wallet, Camera, Sparkles } from 'lucide-react';
import { useApp, KNOWN_CURRENCIES, TravelCurrency } from '../context/AppContext';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultGroupId?: string | null;
  onSwitchToSmartScan?: () => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ isOpen, onClose, defaultGroupId, onSwitchToSmartScan }) => {
  const { members, groups, selectedGroupId, addExpense, addMember, homeCurrencyCode, convertHomeToUSD } = useApp();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('maya');
  const [groupId, setGroupId] = useState('none');
  const [category, setCategory] = useState<'Rent' | 'Food' | 'Utilities' | 'Home goods' | 'Subscriptions' | 'Travel' | 'Other'>('Food');
  const [splitWith, setSplitWith] = useState<string[]>(['maya']);
  const [newFriendName, setNewFriendName] = useState('');

  // Keep form fields synchronized when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const activeGroup = defaultGroupId || selectedGroupId || (groups.length > 0 ? groups[0].id : 'none');
      setGroupId(activeGroup);
      
      const foundGroup = groups.find(g => g.id === activeGroup);
      if (foundGroup) {
        setSplitWith(foundGroup.members);
      } else {
        setSplitWith(['maya']);
      }
    }
  }, [isOpen, defaultGroupId, selectedGroupId, groups]);

  // Travel currency states
  const [isForeignMode, setIsForeignMode] = useState(false);
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState('JPY');
  const [foreignAmount, setForeignAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('155.20');

  // Dynamically sync exchangeRate relative to homeCurrencyCode whenever the modal opens or chosen currencies change
  React.useEffect(() => {
    if (isOpen) {
      const homeCurr = KNOWN_CURRENCIES.find(c => c.code === homeCurrencyCode) || KNOWN_CURRENCIES[0];
      const foreignCurr = KNOWN_CURRENCIES.find(c => c.code === selectedCurrencyCode);
      if (homeCurr && foreignCurr) {
        const rate = (foreignCurr.rateToUSD / homeCurr.rateToUSD).toFixed(4);
        setExchangeRate(rate);

        if (foreignAmount) {
          const foreignVal = parseFloat(foreignAmount);
          const rateVal = parseFloat(rate);
          if (foreignVal && rateVal > 0) {
            setAmount((foreignVal / rateVal).toFixed(2));
          }
        }
      }
    }
  }, [isOpen, homeCurrencyCode, selectedCurrencyCode]);

  const handleToggleSplitMember = (memberId: string) => {
    setSplitWith(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId) 
        : [...prev, memberId]
    );
  };

  const handleAddFriend = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (newFriendName.trim()) {
        const newMember = addMember(newFriendName.trim());
        if (!splitWith.includes(newMember.id)) {
          setSplitWith(prev => [...prev, newMember.id]);
        }
        setNewFriendName('');
      }
    }
  };

  const handleCurrencyChange = (code: string) => {
    setSelectedCurrencyCode(code);
    const homeCurr = KNOWN_CURRENCIES.find(c => c.code === homeCurrencyCode) || KNOWN_CURRENCIES[0];
    const curr = KNOWN_CURRENCIES.find(c => c.code === code);
    if (homeCurr && curr) {
      const rateStr = (curr.rateToUSD / homeCurr.rateToUSD).toFixed(4);
      setExchangeRate(rateStr);
      if (foreignAmount) {
        const foreignVal = parseFloat(foreignAmount);
        const rateVal = parseFloat(rateStr);
        if (foreignVal && rateVal > 0) {
          const calculatedHome = (foreignVal / rateVal).toFixed(2);
          setAmount(calculatedHome);
        }
      }
    }
  };

  const handleForeignAmountChange = (val: string) => {
    setForeignAmount(val);
    const foreignVal = parseFloat(val);
    const rateVal = parseFloat(exchangeRate);
    if (foreignVal && rateVal > 0) {
      const calculatedHome = (foreignVal / rateVal).toFixed(2);
      setAmount(calculatedHome);
    } else {
      setAmount('');
    }
  };

  const handleExchangeRateChange = (val: string) => {
    setExchangeRate(val);
    const foreignVal = parseFloat(foreignAmount);
    const rateVal = parseFloat(val);
    if (foreignVal && rateVal > 0) {
      const calculatedHome = (foreignVal / rateVal).toFixed(2);
      setAmount(calculatedHome);
    } else {
      setAmount('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || parseFloat(amount) <= 0 || splitWith.length === 0) return;

    const selectedSymbol = KNOWN_CURRENCIES.find(c => c.code === selectedCurrencyCode)?.symbol || selectedCurrencyCode;
    const nativeValStr = isForeignMode && foreignAmount
      ? `${selectedSymbol}${parseFloat(foreignAmount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` 
      : undefined;

    // Auto-switch default "Food" to "Travel" if foreign mode is chosen to save time
    const finalCategory = (isForeignMode && category === 'Food') ? 'Travel' : category;

    // amount is ALWAYS in home currency units (whether added in home currency directly or converted from foreign)
    const amountInUSD = convertHomeToUSD(parseFloat(amount));

    addExpense({
      title: title.trim(),
      amount: amountInUSD,
      currency: '$',
      paidById: paidBy,
      groupId: groupId === 'none' ? undefined : groupId,
      category: finalCategory,
      date: 'Just now',
      splits: splitWith,
      nativeCurrencyAmount: nativeValStr
    });

    // Reset Form
    setTitle('');
    setAmount('');
    setForeignAmount('');
    setIsForeignMode(false);
    onClose();
  };

  const activeGroupObj = groups.find(g => g.id === groupId);
  const eligibleMembers = activeGroupObj 
    ? members.filter(m => activeGroupObj.members.includes(m.id))
    : members;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-900 z-50 transition-opacity"
            id="modal-backdrop"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl z-50 overflow-y-auto max-h-[88vh] sm:max-h-[85vh] text-neutral-800"
            id="add-expense-modal"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900">Add an expense</h3>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition"
                id="close-modal-button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Too Lazy? Take Photo/Scan CTA */}
              {onSwitchToSmartScan && (
                <div 
                  onClick={onSwitchToSmartScan}
                  className="bg-indigo-50/75 hover:bg-indigo-100/60 border border-indigo-100 p-3 rounded-2xl flex items-center justify-between cursor-pointer transition active:scale-[0.98] select-none"
                  id="lazy-camera-scan-cta"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-xs">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-[11.5px] font-extrabold text-slate-800 leading-tight">Too lazy to type list? 📷</h4>
                      <p className="text-[10px] text-indigo-500 font-bold">Tap to snap a photo of the receipt</p>
                    </div>
                  </div>
                  <span className="flex items-center space-x-1 text-[9.5px] font-extrabold uppercase bg-amber-550 text-white px-2 py-1 rounded-lg">
                    <Sparkles className="w-3 h-3 text-white animate-pulse" />
                    <span>AI SPLIT</span>
                  </span>
                </div>
              )}

              {/* Amount input in premium large font */}
              <div className="text-center py-2">
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  {isForeignMode ? `Foreign Amount (${selectedCurrencyCode})` : `Amount (${homeCurrencyCode})`}
                </label>
                
                {!isForeignMode ? (
                  <div className="inline-flex items-center relative">
                    <span className="text-3xl font-extrabold text-neutral-400 mr-1">{KNOWN_CURRENCIES.find(c => c.code === homeCurrencyCode)?.symbol || '$'}</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="text-4xl font-extrabold text-neutral-800 focus:outline-none w-44 border-b border-transparent focus:border-indigo-500 text-center transition py-1"
                      autoFocus
                      id="expense-amount-input"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <div className="inline-flex items-center relative">
                      <span className="text-3xl font-extrabold text-neutral-400 mr-2">
                        {KNOWN_CURRENCIES.find(c => c.code === selectedCurrencyCode)?.symbol || ''}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={foreignAmount}
                        onChange={(e) => handleForeignAmountChange(e.target.value)}
                        placeholder="0.00"
                        className="text-4xl font-extrabold text-neutral-800 focus:outline-none w-44 border-b border-transparent focus:border-indigo-500 text-center transition py-1"
                        autoFocus
                        id="expense-amount-foreign-input"
                      />
                    </div>
                    {amount && (
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full animate-fade-in mt-1 border border-indigo-100 font-sans">
                        ≈ {KNOWN_CURRENCIES.find(c => c.code === homeCurrencyCode)?.symbol || '$'}{parseFloat(amount).toFixed(2)} {homeCurrencyCode}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Currency Selector Options */}
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Currency Mode</span>
                  <div className="flex p-0.5 bg-neutral-200/60 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForeignMode(false);
                      }}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        !isForeignMode 
                          ? 'bg-white text-neutral-800 shadow-sm font-extrabold' 
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      {homeCurrencyCode} ({KNOWN_CURRENCIES.find(c => c.code === homeCurrencyCode)?.symbol || '$'})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForeignMode(true);
                        handleCurrencyChange(selectedCurrencyCode);
                      }}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        isForeignMode 
                          ? 'bg-white text-neutral-800 shadow-sm font-extrabold' 
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      Foreign (🌍)
                    </button>
                  </div>
                </div>

                {isForeignMode && (
                  <div className="space-y-3 pt-2 border-t border-neutral-200/40">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-400/90 uppercase tracking-wider mb-1">Select Currency</label>
                        <select
                          value={selectedCurrencyCode}
                          onChange={(e) => handleCurrencyChange(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-xl focus:outline-none text-[11px] font-semibold cursor-pointer"
                        >
                          {KNOWN_CURRENCIES.map(curr => (
                            <option key={curr.code} value={curr.code}>
                              {curr.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-400/90 uppercase tracking-wider mb-1 font-sans">Exchange Rate</label>
                        <div className="relative flex items-center">
                          <span className="absolute left-2 text-[9px] font-bold text-neutral-450 leading-none">1 {homeCurrencyCode} =</span>
                          <input
                            type="number"
                            step="0.0001"
                            value={exchangeRate}
                            onChange={(e) => handleExchangeRateChange(e.target.value)}
                            className="w-full pl-15 pr-7 py-1.5 bg-white border border-neutral-200 rounded-xl focus:outline-none text-[11px] font-mono font-bold text-center"
                          />
                          <span className="absolute right-2 text-[9px] font-extrabold text-neutral-455">
                            {selectedCurrencyCode}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-2 bg-indigo-50/50 border border-indigo-100/60 rounded-xl flex items-start space-x-1.5 text-[10.5px] text-indigo-700 font-medium">
                      <span className="mt-0.5">💡</span>
                      <p className="leading-normal font-sans">
                        Converting: 1 {selectedCurrencyCode} = 
                        <span className="font-bold">
                          {' '}{(1 / (parseFloat(exchangeRate) || 1)).toFixed(5)}{' '}
                        </span>
                        {homeCurrencyCode}. Perfect for matching precise vacation transaction records!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">What is it for?</label>
                <input
                  type="text"
                  required
                  placeholder="Costco run, Coffee shop, Sushiro..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white text-sm font-medium transition"
                  id="expense-title-input"
                />
              </div>

              {/* Split Category & Group */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Group</label>
                  <select
                    value={groupId}
                    onChange={(e) => {
                      setGroupId(e.target.value);
                      // Auto-update splitting scope
                      const selectedGrp = groups.find(g => g.id === e.target.value);
                      if (selectedGrp) {
                        setSplitWith(selectedGrp.members);
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200/80 rounded-xl focus:outline-none text-xs font-medium cursor-pointer"
                    id="expense-group-select"
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                    <option value="none">No Group (Standalone)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200/80 rounded-xl focus:outline-none text-xs font-medium cursor-pointer"
                    id="expense-category-select"
                  >
                    <option value="Food">Food</option>
                    <option value="Rent">Rent</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Home goods">Home goods</option>
                    <option value="Subscriptions">Subscriptions</option>
                    <option value="Travel">Travel</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Paid By Selection */}
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Who paid?</label>
                <div className="flex flex-wrap gap-2">
                  {eligibleMembers.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaidBy(m.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center space-x-1.5 border transition cursor-pointer ${
                        paidBy === m.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                      id={`pay-member-${m.id}`}
                    >
                      <span className={`w-4 h-4 rounded-full text-[9px] font-bold ${m.colorClass?.includes('text-') ? '' : 'text-white'} flex items-center justify-center overflow-hidden ${m.colorClass}`}>
                        {m.avatar ? <span className="text-[10px] leading-none">{m.avatar}</span> : m.initials}
                      </span>
                      <span>{m.id === 'maya' ? `${m.name} (You)` : m.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Split With Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Split with whom?</label>
                <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100 space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200/50">
                    <span className="text-[11px] text-neutral-400 font-medium font-sans uppercase tracking-wider">Select Splitters:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = eligibleMembers.map(m => m.id);
                        setSplitWith(splitWith.length === allIds.length ? [] : allIds);
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 self-end transition-colors"
                      id="select-all-splitters-button"
                    >
                      {splitWith.length === eligibleMembers.length ? 'Clear All' : 'Select All'}
                    </button>
                  </div>
                  
                  {groupId === 'none' && (
                    <div className="pb-2 relative">
                      <input 
                        type="text" 
                        placeholder="Type friend's name & press Enter..." 
                        value={newFriendName}
                        onChange={e => setNewFriendName(e.target.value)}
                        onKeyDown={handleAddFriend}
                        className="w-full text-xs px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1 max-h-48 overflow-y-auto">
                    {eligibleMembers.map(m => {
                      const isChecked = splitWith.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center space-x-2.5 p-2 rounded-xl border transition-colors cursor-pointer select-none ${
                            isChecked 
                              ? 'border-indigo-100 bg-indigo-50/40 text-neutral-800' 
                              : 'border-transparent text-neutral-500 hover:bg-neutral-100/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSplitMember(m.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-neutral-300"
                          />
                          <span className={`w-5 h-5 rounded-full text-[10px] font-bold ${m.colorClass?.includes('text-') ? '' : 'text-white'} flex items-center justify-center overflow-hidden ${m.colorClass}`}>
                            {m.avatar ? <span className="text-[11px] leading-none">{m.avatar}</span> : m.initials}
                          </span>
                          <span className="text-xs font-medium">{m.id === 'maya' ? `${m.name} (You)` : m.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={!title || !amount || splitWith.length === 0}
                className="w-full mt-2 py-3 bg-indigo-600 text-white rounded-2xl font-semibold text-sm hover:bg-indigo-700 transition shadow-indigo-200 shadow-lg disabled:opacity-50 disabled:shadow-none hover:translate-y-[-1px] active:translate-y-[1px] duration-150 cursor-pointer"
                id="submit-expense-button"
              >
                Add expense
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

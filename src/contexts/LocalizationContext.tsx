import React, { createContext, useContext, useState } from 'react';
import { storage } from '../services/storage';
import type { AppSettings } from '../types';

interface LocalizationContextType {
  currency: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: string;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string | number | Date) => string;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(storage.getSettings());

  const currencySymbols: Record<string, string> = {
    'GBP': '£',
    'USD': '$',
    'EUR': '€'
  };

  const currencySymbol = currencySymbols[settings.currency] || '£';

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const formatDate = (date: string | number | Date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    switch (settings.dateFormat) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'YYYY/MM/DD':
        return `${year}/${month}/${day}`;
      default:
        return `${day}/${month}/${year}`;
    }
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    storage.saveSettings(updated);
  };

  return (
    <LocalizationContext.Provider value={{
      currency: settings.currency,
      currencySymbol,
      timezone: settings.timezone,
      dateFormat: settings.dateFormat,
      formatCurrency,
      formatDate,
      updateSettings
    }}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = () => {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};

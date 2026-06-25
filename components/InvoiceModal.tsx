
import React, { useState } from 'react';
import { Invoice, InvoiceItem, Currency, InvoiceTemplate, Customer } from '../types';
import { IconPrinter, IconPlus, IconTrash, IconCheck } from './Icons';

interface Props {
  customer: Customer;
  template: InvoiceTemplate;
  onSave: (invoice: Invoice) => void;
  onClose: () => void;
  initialData?: Invoice;
}

export const InvoiceModal: React.FC<Props> = ({ customer, template, onSave, onClose, initialData }) => {
  const [items, setItems] = useState<InvoiceItem[]>(initialData?.items || [{ description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const [taxRate, setTaxRate] = useState(initialData?.taxRate || template.defaultTaxRate);
  const [invoiceDate, setInvoiceDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.number || `INV-${Date.now()}`);
  const [currency, setCurrency] = useState<Currency>(initialData?.currency || 'IRR');
  
  // Calculations
  const subTotal = items.reduce((acc, item) => acc + item.total, 0);
  const taxAmount = (subTotal * taxRate) / 100;
  const total = subTotal + taxAmount;

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    // Recalculate total for row
    if (field === 'quantity' || field === 'unitPrice') {
        item.total = item.quantity * item.unitPrice;
    }
    newItems[index] = item;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    const invoice: Invoice = {
        id: initialData?.id || `inv-${Date.now()}`,
        number: invoiceNumber,
        date: invoiceDate,
        customerName: customer.fullName,
        companyName: customer.companyName,
        items,
        currency,
        subTotal,
        taxRate,
        taxAmount,
        discount: 0,
        total,
        issuedBy: 'System' // Or current user
    };
    onSave(invoice);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden">
        <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col relative overflow-hidden">
            {/* Toolbar (Hidden when printing) - Sticky Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/90 backdrop-blur rounded-t-2xl print:hidden sticky top-0 z-10 shrink-0">
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <h3 className="font-bold text-lg text-gray-800">صدور فاکتور فروش</h3>
                </div>
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-indigo-700 text-sm">
                        <IconPrinter className="w-4 h-4" /> چاپ
                    </button>
                    <button onClick={handleSave} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-green-700 text-sm">
                        <IconCheck className="w-4 h-4" /> ذخیره
                    </button>
                </div>
            </div>

            {/* Invoice Layout (A4 Style) - Scrollable Content */}
            <div className="flex-grow bg-white p-8 md:p-12 overflow-y-auto print:overflow-visible invoice-content">
                
                {/* Header */}
                <div className="flex justify-between items-start mb-12 border-b-2 pb-6" style={{ borderColor: template.colorTheme }}>
                    <div className="flex items-center gap-4">
                        {template.logoUrl && (
                            <img src={template.logoUrl} alt="Logo" className="w-24 h-24 object-contain" />
                        )}
                        <div>
                            <h1 className="text-2xl font-black mb-1" style={{ color: template.colorTheme }}>{template.companyName}</h1>
                            <p className="text-gray-500 text-sm">{template.address}</p>
                            <p className="text-gray-500 text-sm dir-ltr text-right">{template.phone}</p>
                        </div>
                    </div>
                    <div className="text-left">
                        <h2 className="text-3xl font-black text-gray-200 mb-4">INVOICE</h2>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <span className="text-gray-500">شماره فاکتور:</span>
                            <input className="font-mono font-bold text-right outline-none bg-transparent" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                            
                            <span className="text-gray-500">تاریخ صدور:</span>
                            <input type="date" className="font-mono text-right outline-none bg-transparent" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                            
                            <span className="text-gray-500">ارز:</span>
                            <select className="font-bold text-right outline-none bg-transparent print:appearance-none" value={currency} onChange={e => setCurrency(e.target.value as Currency)}>
                                <option value="IRR">ریال</option>
                                <option value="USD">دلار</option>
                                <option value="OMR">عمان</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Bill To */}
                <div className="mb-12">
                    <h3 className="text-gray-500 font-bold mb-2 text-sm uppercase">صورتحساب برای:</h3>
                    <div className="text-xl font-bold text-gray-800">{customer.fullName}</div>
                    <div className="text-gray-600">{customer.companyName}</div>
                    <div className="text-gray-500 text-sm">{customer.location} - {customer.phoneNumber}</div>
                </div>

                {/* Items Table */}
                <div className="mb-8">
                    <table className="w-full text-right">
                        <thead>
                            <tr style={{ backgroundColor: template.colorTheme }} className="text-white">
                                <th className="px-4 py-3 rounded-r-lg w-1/2">شرح کالا / خدمات</th>
                                <th className="px-4 py-3 text-center w-24">تعداد</th>
                                <th className="px-4 py-3 text-center w-32">قیمت واحد</th>
                                <th className="px-4 py-3 text-center w-32 rounded-l-lg">قیمت کل</th>
                                <th className="print:hidden w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((item, index) => (
                                <tr key={index}>
                                    <td className="px-2 py-2">
                                        <input 
                                            className="w-full outline-none bg-transparent" 
                                            placeholder="شرح خدمات..." 
                                            value={item.description} 
                                            onChange={e => handleItemChange(index, 'description', e.target.value)}
                                        />
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                        <input 
                                            type="number" min="1"
                                            className="w-full outline-none bg-transparent text-center" 
                                            value={item.quantity} 
                                            onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                        <input 
                                            className="w-full outline-none bg-transparent text-center" 
                                            value={item.unitPrice.toLocaleString()} 
                                            onChange={e => handleItemChange(index, 'unitPrice', parseInt(e.target.value.replace(/,/g, '')) || 0)}
                                        />
                                    </td>
                                    <td className="px-2 py-2 text-center font-bold">
                                        {item.total.toLocaleString()}
                                    </td>
                                    <td className="print:hidden text-center">
                                        {items.length > 1 && (
                                            <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600"><IconTrash className="w-4 h-4" /></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={addItem} className="mt-2 text-indigo-600 font-bold text-sm flex items-center gap-1 hover:underline print:hidden">
                        <IconPlus className="w-4 h-4" /> افزودن ردیف
                    </button>
                </div>

                {/* Totals */}
                <div className="flex justify-end mb-12">
                    <div className="w-64 space-y-2">
                        <div className="flex justify-between text-gray-600">
                            <span>جمع کل:</span>
                            <span>{subTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-600 items-center">
                            <span className="text-sm">مالیات ({taxRate}%):</span>
                            <span className="print:hidden">
                                <input 
                                    type="number" className="w-12 border rounded text-center text-xs" 
                                    value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} 
                                /> %
                            </span>
                            <span className="hidden print:inline">{taxAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-black text-xl pt-2 border-t border-gray-200" style={{ color: template.colorTheme }}>
                            <span>مبلغ قابل پرداخت:</span>
                            <span>{total.toLocaleString()} {currency}</span>
                        </div>
                    </div>
                </div>

                {/* Footer Notes */}
                <div className="grid grid-cols-2 gap-8 border-t border-gray-200 pt-8">
                    <div>
                        <h4 className="font-bold text-gray-800 mb-2 text-sm">شرایط و قوانین</h4>
                        <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{template.termsConditions}</p>
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold text-gray-800 mb-2 text-sm">{template.footerText}</h4>
                        <div className="h-20 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-300 text-sm">
                            مهر و امضا
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Print Styles Injection */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .invoice-content, .invoice-content * { visibility: visible; }
                    .invoice-content { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; overflow: visible !important; height: auto !important; }
                    .print\\:hidden { display: none !important; }
                    .print\\:appearance-none { appearance: none; border: none; }
                }
            `}</style>
        </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { formatInvoiceAmount, formatInvoiceAmountTyping, parseInvoiceAmount } from '../utils/invoiceMoney';

type Props = {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
  allowNegative?: boolean;
};

/** Text input that shows thousand separators while typing and on blur. */
export const InvoiceAmountInput: React.FC<Props> = ({
  value,
  onChange,
  className = '',
  placeholder = '0',
  readOnly = false,
  allowNegative = false,
}) => {
  const focused = useRef(false);
  const [text, setText] = useState(() => (value ? formatInvoiceAmount(value) : ''));

  useEffect(() => {
    if (!focused.current) {
      setText(value ? formatInvoiceAmount(value) : '');
    }
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      readOnly={readOnly}
      value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        const n = parseInvoiceAmount(text);
        setText(n ? formatInvoiceAmount(n) : '');
        onChange(n);
      }}
      onChange={(e) => {
        const formatted = formatInvoiceAmountTyping(e.target.value, allowNegative);
        setText(formatted);
        onChange(parseInvoiceAmount(formatted));
      }}
    />
  );
};

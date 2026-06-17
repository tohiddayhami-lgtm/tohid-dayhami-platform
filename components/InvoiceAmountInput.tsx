import React, { useEffect, useRef, useState } from 'react';
import { formatInvoiceAmount, formatInvoiceAmountTyping, parseInvoiceAmount } from '../utils/invoiceMoney';

type Props = {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
  allowNegative?: boolean;
  maxDecimals?: number;
};

/** Text input that shows thousand separators while typing and on blur. */
export const InvoiceAmountInput: React.FC<Props> = ({
  value,
  onChange,
  className = '',
  placeholder = '0',
  readOnly = false,
  allowNegative = false,
  maxDecimals,
}) => {
  const focused = useRef(false);
  const [text, setText] = useState(() => (value ? formatInvoiceAmount(value, maxDecimals) : ''));

  useEffect(() => {
    if (!focused.current) {
      setText(value ? formatInvoiceAmount(value, maxDecimals) : '');
    }
  }, [value, maxDecimals]);

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
        const n = parseInvoiceAmount(text, maxDecimals);
        setText(n ? formatInvoiceAmount(n, maxDecimals) : '');
        onChange(n);
      }}
      onChange={(e) => {
        const formatted = formatInvoiceAmountTyping(e.target.value, allowNegative, maxDecimals);
        setText(formatted);
        onChange(parseInvoiceAmount(formatted, maxDecimals));
      }}
    />
  );
};

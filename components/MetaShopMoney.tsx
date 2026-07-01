import React from 'react';
import type { MetaShop } from '../types';
import { formatShopAmountParts } from '../utils/metaShopCurrency';

interface Props {
  amount: number;
  shop: MetaShop;
  viewCurrency: string;
  sourceCurrency?: string;
  uiLang?: string;
  className?: string;
}

/** Currency label always visually left of the amount (all languages / RTL). */
export const MetaShopMoney: React.FC<Props> = ({
  amount,
  shop,
  viewCurrency,
  sourceCurrency,
  uiLang = 'fa',
  className = '',
}) => {
  const { label, amount: num } = formatShopAmountParts(
    amount,
    sourceCurrency || shop.currency,
    viewCurrency,
    shop,
    uiLang,
  );
  return (
    <span className={`ms-money${className ? ` ${className}` : ''}`} dir="ltr">
      <span className="ms-money-cur">{label}</span>
      <span className="ms-money-num">{num}</span>
    </span>
  );
};

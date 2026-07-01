/** Limit concurrent product image downloads so mobile doesn't stall on 500+ URLs. */
const MAX = 8;
let active = 0;
const waiters: Array<() => void> = [];

export const acquireMetaShopImageSlot = (priority?: boolean): Promise<void> => {
  if (priority || active < MAX) {
    active++;
    return Promise.resolve();
  }
  return new Promise(resolve => {
    waiters.push(() => {
      active++;
      resolve();
    });
  });
};

export const releaseMetaShopImageSlot = () => {
  active = Math.max(0, active - 1);
  const next = waiters.shift();
  if (next) next();
};

import type { MetaExpoBoothReservation } from '../types';

export const MAX_BOOTH_PENDING_RESERVATIONS = 100;

export type BoothReservationDisplayStatus = 'available' | 'pending' | 'confirmed';

export interface BoothReservationSummary {
  boothId: string;
  status: BoothReservationDisplayStatus;
  confirmed: MetaExpoBoothReservation | null;
  pendingCount: number;
}

/** Aggregate raw reservation rows into per-booth display state. */
export function summarizeBoothReservations(
  list: MetaExpoBoothReservation[],
): Record<string, BoothReservationSummary> {
  const groups: Record<string, { confirmed: MetaExpoBoothReservation | null; pending: number }> = {};

  for (const r of list) {
    if (r.status === 'cancelled') continue;
    if (!groups[r.boothId]) groups[r.boothId] = { confirmed: null, pending: 0 };
    if (r.status === 'confirmed') groups[r.boothId].confirmed = r;
    else if (r.status === 'pending') groups[r.boothId].pending += 1;
  }

  const out: Record<string, BoothReservationSummary> = {};
  for (const [boothId, g] of Object.entries(groups)) {
    const status: BoothReservationDisplayStatus = g.confirmed
      ? 'confirmed'
      : g.pending > 0
        ? 'pending'
        : 'available';
    if (status === 'available') continue;
    out[boothId] = { boothId, status, confirmed: g.confirmed, pendingCount: g.pending };
  }
  return out;
}

/** Booth accepts new temporary reservations until master confirms one. */
export function boothIsReservable(summary: BoothReservationSummary | undefined | null): boolean {
  return !summary || summary.status !== 'confirmed';
}

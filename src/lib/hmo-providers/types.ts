/**
 * An accredited HMO (PAY-001). HMOs are payers, not discounts: when the HMO
 * approves a Letter of Authorization the patient pays only the co-pay.
 */
export type HmoProvider = {
  id: string;
  name: string;
  /** Integer centavos the patient still pays after HMO approval; 0 is none. */
  copayCentavos: number;
  notes: string | null;
  isActive: boolean;
};

export type Role = 'owner' | 'admin' | 'staff';
export type CouponDbStatus = 'issued' | 'redeemed' | 'expired' | 'cancelled';
export type CouponSafeStatus = 'valid' | 'redeemed' | 'expired' | 'cancelled' | 'invalid';

export type Profile = {
  id: string;
  display_name: string | null;
  role: Role;
  active: boolean;
  created_at: string;
};

export type RewardType = {
  id: string;
  name: string;
  description: string | null;
  default_expiry_days: number;
  active: boolean;
  created_at: string;
};

export type Coupon = {
  id: string;
  short_code: string;
  reward_type_id: string;
  status: CouponDbStatus;
  issued_reason: string | null;
  customer_label: string | null;
  customer_contact: string | null;
  notes: string | null;
  expires_at: string;
  created_by: string | null;
  created_at: string;
  redeemed_by: string | null;
  redeemed_at: string | null;
  redeemed_event: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  reward_types?: { name: string } | null;
};

export type ValidatedCoupon = {
  status: CouponSafeStatus;
  rewardName: string | null;
  expiresAt: string | null;
  redeemedAt: string | null;
  cancelledAt: string | null;
  shortCode: string | null;
  customerLabel?: string | null;
  issuedReason?: string | null;
  instructions: string;
  message: string;
};

export type CreatedCoupon = {
  token: string;
  publicUrl: string;
  qrData: string;
  shortCode: string;
  rewardName: string;
  expiresAt: string;
};

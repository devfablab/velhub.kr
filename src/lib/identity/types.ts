export const IDENTITY_PROVIDER = {
  PORTONE: 'portone',
} as const;

export const IDENTITY_VERIFICATION_STATUS = {
  READY: 'ready',
  VERIFIED: 'verified',
  FAILED: 'failed',
} as const;

export const IDENTITY_GENDER = {
  MALE: 'male',
  FEMALE: 'female',
} as const;

export type IdentityProvider = (typeof IDENTITY_PROVIDER)[keyof typeof IDENTITY_PROVIDER];

export type IdentityVerificationStatus =
  (typeof IDENTITY_VERIFICATION_STATUS)[keyof typeof IDENTITY_VERIFICATION_STATUS];

export type IdentityGender = (typeof IDENTITY_GENDER)[keyof typeof IDENTITY_GENDER];

export type PortOneIdentityVerificationStartResponse = {
  storeId: string;
  channelKey: string;
  identityVerificationId: string;
};

export type PortOneVerifiedCustomer = {
  name?: string;
  birthDate?: string;
  gender?: string;
  phoneNumber?: string;
  [key: string]: unknown;
};

export type PortOneIdentityVerification = {
  id?: string;
  identityVerificationId?: string;
  status?: string;
  verifiedCustomer?: PortOneVerifiedCustomer;
  [key: string]: unknown;
};

export type PortOneIdentityVerificationResponse = {
  identityVerification?: PortOneIdentityVerification;
  [key: string]: unknown;
};

export type VerifiedIdentity = {
  identityVerificationId: string;
  name: string;
  birthDate: string;
  gender: string;
};

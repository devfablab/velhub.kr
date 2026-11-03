type BlogMembership = {
  is_approval: boolean | null;
  role: string | null;
};

export function canManageBlogContents(membership: BlogMembership | null | undefined) {
  if (!membership?.is_approval) {
    return false;
  }

  return membership.role === 'owner' || membership.role === 'manager';
}

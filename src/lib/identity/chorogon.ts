import { decrypt } from '@/lib/encryption/decrypt';

type ChorogonBirthDate = {
  birth_date?: string | number | null;
  birth_date_dummy?: string | number | null;
};

export function getChorogonBirthDate(chorogon: ChorogonBirthDate | null | undefined) {
  const birthDateDummy = String(chorogon?.birth_date_dummy ?? '').trim();

  if (birthDateDummy) {
    return birthDateDummy;
  }

  if (chorogon?.birth_date === null || chorogon?.birth_date === undefined) {
    return null;
  }

  return decrypt(String(chorogon.birth_date));
}

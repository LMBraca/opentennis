export type EntryField = 'eventId' | 'fullName' | 'partnerName' | 'email' | 'phone';

export type EntryFieldErrors = Partial<
  Record<EntryField, 'needDraw' | 'needName' | 'needPartner' | 'needEmail' | 'needPhone'>
>;

export interface EntryFieldValues {
  readonly eventId: string;
  readonly fullName: string;
  readonly partnerName: string;
  readonly email: string;
  readonly phone: string;
}

export function validateEntryFields(
  values: EntryFieldValues,
  doubles: boolean,
): EntryFieldErrors {
  const errors: EntryFieldErrors = {};
  if (values.eventId.trim() === '') errors.eventId = 'needDraw';
  if (values.fullName.trim() === '') errors.fullName = 'needName';
  if (doubles && values.partnerName.trim() === '') errors.partnerName = 'needPartner';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())) errors.email = 'needEmail';
  if (values.phone.trim() === '') errors.phone = 'needPhone';
  return errors;
}

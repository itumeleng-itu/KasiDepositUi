import { useEffect, useState } from 'react';

import { applyGroupedEdit, type DigitGrouping } from '../domain/groupedDigits';
import { TextField, type TextFieldProps } from './TextField';

interface DigitsFieldProps extends Omit<TextFieldProps, 'value' | 'onChangeText' | 'keyboardType'> {
  /** The digits only. The field shows them grouped. */
  digits: string;
  grouping: DigitGrouping;
  onChangeDigits: (digits: string) => void;
  /** A paste that would exceed `grouping.maxDigits` was refused; the field is unchanged. */
  onPasteRejected?: () => void;
}

/** How long we hold the caret we computed before handing control back to the native input. */
const CARET_HOLD_MS = 60;

/**
 * A numeric field that shows its digits in groups ("1234 5678") but only ever holds digits.
 * Any paste format works, backspace removes one digit even across a separator, and a digit fixed
 * in the middle keeps the caret where the user was. Used for account numbers and the voucher PIN.
 */
export function DigitsField({
  digits,
  grouping,
  onChangeDigits,
  onPasteRejected,
  ...fieldProps
}: DigitsFieldProps) {
  const [caret, setCaret] = useState<number | null>(null);

  // Re-formatting moves the native caret to the end. We set the right one for a moment, then let
  // go, so the user can still move it freely afterwards.
  useEffect(() => {
    if (caret === null) return;
    const timer = setTimeout(() => setCaret(null), CARET_HOLD_MS);
    return () => clearTimeout(timer);
  }, [caret]);

  return (
    <TextField
      {...fieldProps}
      value={grouping.format(digits)}
      selection={caret === null ? undefined : { start: caret, end: caret }}
      keyboardType="number-pad"
      inputMode="numeric"
      autoCorrect={false}
      autoComplete="off"
      importantForAutofill="no"
      onChangeText={(text) => {
        const edit = applyGroupedEdit(digits, text, grouping);
        if (edit.pasteRejected) onPasteRejected?.();
        onChangeDigits(edit.digits);
        setCaret(edit.caret);
      }}
    />
  );
}

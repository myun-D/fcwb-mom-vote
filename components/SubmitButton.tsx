'use client';

import { useFormStatus } from 'react-dom';

type Props = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  name?: string;
  value?: string;
  confirmMessage?: string;
  disabled?: boolean;
};

export function SubmitButton({
  children,
  pendingText = '처리 중…',
  className = 'btn btn-primary',
  name,
  value,
  confirmMessage,
  disabled,
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      name={name}
      value={value}
      disabled={pending || disabled}
      onClick={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}

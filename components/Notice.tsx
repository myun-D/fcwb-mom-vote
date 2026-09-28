export function Notice({ message, tone = 'info' }: { message?: string; tone?: 'info' | 'error' | 'success' }) {
  if (!message) return null;
  return (
    <p className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {message}
    </p>
  );
}

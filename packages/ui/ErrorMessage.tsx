import { Text } from './Text';

export interface ErrorMessageProps {
  message?: string;
  className?: string;
}

export function ErrorMessage({ message, className }: ErrorMessageProps) {
  if (!message) return null;
  return (
    <Text role="alert" tone="danger" variant="caption" className={className}>
      {message}
    </Text>
  );
}

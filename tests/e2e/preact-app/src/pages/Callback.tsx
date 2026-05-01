interface CallbackPageProps {
  path?: string;
}

export function CallbackPage(_props: CallbackPageProps) {
  return <div data-testid="auth-loading">Processing login...</div>;
}

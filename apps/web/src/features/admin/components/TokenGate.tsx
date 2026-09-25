import { AlertCircle, KeyRound, LogIn } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useAdminSession } from '../hooks/useAdminSession';

export function TokenGate() {
  const id = useId();
  const { signIn, notice } = useAdminSession();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = value.trim();
    if (!token) {
      setError('Enter the admin token to continue.');
      return;
    }
    setError(null);
    signIn(token);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <Card>
        <CardHeader className="gap-2 p-6 pb-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary dark:text-foreground">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold leading-tight">Admin sign in</h1>
          <CardDescription>
            The dashboard needs the admin token configured on the backend (sent as the{' '}
            <code className="font-mono text-xs">X-Admin-Token</code> header). It is kept only for
            this browser tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <form noValidate onSubmit={handleSubmit} className="grid gap-4">
            {notice && (
              <Alert tone="danger">
                <AlertCircle aria-hidden="true" />
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor={`${id}-token`}>Admin token</Label>
              <Input
                id={`${id}-token`}
                type="password"
                autoComplete="off"
                placeholder="demo-admin"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : `${id}-hint`}
              />
              {error ? (
                <p id={`${id}-error`} className="text-sm text-danger-strong">
                  {error}
                </p>
              ) : (
                <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                  The local demo uses <span className="font-mono">demo-admin</span> unless
                  ADMIN_TOKEN is set.
                </p>
              )}
            </div>
            <Button type="submit" className="w-full">
              <LogIn aria-hidden="true" />
              Open dashboard
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import type { VerifyResponse } from '@worknoon/contracts';
import { AlertCircle, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '@/shared/api/ApiError';
import { getErrorMessage } from '@/shared/lib/errorMessages';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useVerifyCustomer } from '../api';

export const verifyFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter the email you used for the order.')
    .max(254, 'That email is too long.')
    .pipe(z.email('Enter a valid email address.')),
  orderNumber: z
    .string()
    .trim()
    .min(1, 'Enter your order number.')
    .regex(
      /^[A-Za-z0-9-]{3,32}$/,
      'Order numbers look like WN-1001 (letters, numbers and dashes).',
    ),
});

type FieldErrors = Partial<Record<'email' | 'orderNumber', string>>;

export interface VerifyFormProps {
  defaultValues?: { email: string; orderNumber: string };
  onVerified: (response: VerifyResponse) => void;
}

export function VerifyForm({ defaultValues, onVerified }: VerifyFormProps) {
  const id = useId();
  const [email, setEmail] = useState(defaultValues?.email ?? '');
  const [orderNumber, setOrderNumber] = useState(defaultValues?.orderNumber ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const verify = useVerifyCustomer();

  const serverError = verify.error instanceof ApiError ? verify.error : null;
  const formError =
    verify.error && serverError?.code !== 'VALIDATION_FAILED'
      ? getErrorMessage(verify.error)
      : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = verifyFormSchema.safeParse({ email, orderNumber });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === 'email' || field === 'orderNumber') && !errors[field])
          errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    verify.mutate(parsed.data, {
      onSuccess: (response) => {
        toast.success(`Welcome, ${response.customer.firstName}`, {
          description: `Order ${response.order.orderNumber} verified.`,
        });
        onVerified(response);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
          setFieldErrors({
            email: error.fieldError('email'),
            orderNumber: error.fieldError('orderNumber'),
          });
        } else if (!(error instanceof ApiError && error.code === 'VERIFICATION_FAILED')) {
          toast.error(getErrorMessage(error));
        }
      },
    });
  }

  const emailError = fieldErrors.email;
  const orderError = fieldErrors.orderNumber;

  return (
    <Card>
      <CardHeader className="gap-2 p-6 pb-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary dark:text-foreground">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </div>
        <CardTitle className="text-lg">Request a refund</CardTitle>
        <CardDescription>
          First, let&apos;s find your order. Enter the email address and order number from your
          confirmation email.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <form
          noValidate
          onSubmit={handleSubmit}
          className="grid gap-4"
          aria-label="Verify your order"
        >
          {formError && (
            <Alert tone={serverError?.code === 'RATE_LIMITED' ? 'warning' : 'danger'}>
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor={`${id}-email`}>Email address</Label>
            <Input
              id={`${id}-email`}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? `${id}-email-error` : undefined}
            />
            {emailError && (
              <p id={`${id}-email-error`} className="text-sm text-danger-strong">
                {emailError}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-order`}>Order number</Label>
            <Input
              id={`${id}-order`}
              name="orderNumber"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="WN-1001"
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              aria-invalid={orderError ? true : undefined}
              aria-describedby={orderError ? `${id}-order-error` : `${id}-order-hint`}
            />
            {orderError ? (
              <p id={`${id}-order-error`} className="text-sm text-danger-strong">
                {orderError}
              </p>
            ) : (
              <p id={`${id}-order-hint`} className="text-xs text-muted-foreground">
                You can find it at the top of your order confirmation.
              </p>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={verify.isPending}
            className="mt-1 w-full sm:w-auto sm:justify-self-start"
          >
            {verify.isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Verifying
              </>
            ) : (
              <>
                Find my order
                <ArrowRight aria-hidden="true" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

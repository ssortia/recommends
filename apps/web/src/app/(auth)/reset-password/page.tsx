import type { Metadata } from 'next';
import Link from 'next/link';

import { ResetPasswordForm } from '../../../components/auth/reset-password-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';

export const metadata: Metadata = { title: 'Новый пароль | NexST' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Ссылка недействительна</CardTitle>
            <CardDescription>В ссылке отсутствует токен сброса пароля</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              <Link href="/forgot-password" className="hover:text-foreground underline">
                Запросить новую ссылку
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

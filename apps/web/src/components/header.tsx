import Link from 'next/link';

import type { Role } from '@repo/types';

import { signOut } from '@/auth';
import { MainNav } from '@/components/main-nav';
import { ThemeToggle } from '@/components/theme-toggle';

interface HeaderProps {
  role: Role;
  email?: string | null;
}

/**
 * Общий хедер приложения: используется и в дашборд-, и в admin-layout, чтобы не дублировать
 * разметку и не расходиться в поведении (например, кликабельность заголовка).
 */
export function Header({ role, email }: HeaderProps) {
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* items-baseline, а не items-center: разные размеры шрифта (text-xl у заголовка,
            text-sm у навигации) при items-center центрируются по высоте строки, а не по
            текстовой базовой линии — из-за разной высоты line-height это визуально смещает
            текст навигации выше заголовка. */}
        <div className="flex items-baseline gap-6">
          <Link href="/" className="text-xl font-semibold">
            Curio
          </Link>
          <MainNav role={role} />
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <span className="text-muted-foreground text-sm">{email}</span>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground cursor-pointer text-sm transition-colors"
            >
              Выйти
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

import Link from 'next/link';

import type { Role } from '@repo/types';

interface NavLink {
  label: string;
  href: string;
  /** Роли, которым видна ссылка (членство, как в <Access>). */
  roles: Role[];
}

// Единый источник пунктов навигации. Новый раздел — одна строка здесь.
const NAV_LINKS: NavLink[] = [
  { label: 'Пользователи', href: '/admin/users', roles: ['ADMIN'] },
  { label: 'Аудит', href: '/admin/audit', roles: ['ADMIN'] },
  { label: 'Документация', href: '/admin/docs', roles: ['ADMIN'] },
];

/** Навигация приложения: показывает только пункты, доступные текущей роли. */
export function MainNav({ role }: { role: Role }) {
  const links = NAV_LINKS.filter((link) => link.roles.includes(role));

  return (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}

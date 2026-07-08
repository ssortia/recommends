import {
  Activity,
  ArrowRight,
  BookOpen,
  CircleCheck,
  Database,
  GitBranch,
  Package,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { env } from '@/lib/env';

import { auth } from '../../auth';

const stats = [
  {
    label: 'Пользователи',
    value: '—',
    description: 'Зарегистрировано в системе',
    icon: Users,
  },
  {
    label: 'API-запросы',
    value: '—',
    description: 'За последние 24 часа',
    icon: Activity,
  },
  {
    label: 'Аптайм',
    value: '—',
    description: 'За последние 30 дней',
    icon: CircleCheck,
  },
  {
    label: 'Время ответа',
    value: '—',
    description: 'Средняя задержка API',
    icon: Zap,
  },
];

const quickStart = [
  {
    icon: Package,
    title: 'Добавить модуль',
    description: 'Создай новую бизнес-сущность по готовому гайду: контроллер, сервис, DTO.',
    href: 'https://github.com',
    label: 'Читать гайд',
  },
  {
    icon: Database,
    title: 'База данных',
    description: 'Prisma 6 + PostgreSQL. Запусти миграции и seed для начала работы.',
    href: 'https://github.com',
    label: 'Документация Prisma',
  },
  {
    icon: ShieldCheck,
    title: 'Роли и доступ',
    description: 'RBAC на основе enum. Используй useRole() или <Access> для защиты UI.',
    href: 'https://github.com',
    label: 'Посмотреть RBAC',
  },
  {
    icon: GitBranch,
    title: 'CI / CD',
    description: 'GitHub Actions: lint → typecheck → test → build на каждый PR.',
    href: 'https://github.com',
    label: 'Смотреть workflow',
  },
];

const stack = [
  { label: 'NestJS 11', sub: 'Fastify + SWC' },
  { label: 'Next.js 15', sub: 'App Router' },
  { label: 'Prisma 6', sub: 'PostgreSQL 16' },
  { label: 'next-auth v5', sub: 'JWT + Credentials' },
  { label: 'Tailwind v4', sub: 'shadcn/ui' },
  { label: 'TypeScript 5.7', sub: 'strict mode' },
];

export default async function DashboardPage() {
  const session = await auth();
  const email = session?.user?.email ?? '';
  const name = email.split('@')[0];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Добро пожаловать, {name} 👋</h2>
          <p className="text-muted-foreground">
            Это стартовый шаблон NexST. Подключи данные и начни строить продукт.
          </p>
        </div>
        <a
          href={`${env.NEXT_PUBLIC_API_URL}/api/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline' })}
        >
          <BookOpen className="h-4 w-4" />
          Swagger API
        </a>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, description, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-muted-foreground mt-1 text-xs">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick start */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Быстрый старт</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {quickStart.map(({ icon: Icon, title, description, label }) => (
            <Card key={title} className="group transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="bg-primary/10 text-primary mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" className="gap-1 px-0 hover:bg-transparent">
                  {label}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Stack */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Технологический стек</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stack.map(({ label, sub }) => (
            <Card key={label} className="text-center">
              <CardContent className="pb-4 pt-4">
                <div className="text-sm font-semibold">{label}</div>
                <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

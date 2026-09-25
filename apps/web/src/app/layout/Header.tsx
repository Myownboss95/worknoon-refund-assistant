import { ReceiptText } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { cn } from '@/shared/lib/cn';
import { BackendSwitcher } from './BackendSwitcher';
import { HealthBadge } from './HealthBadge';

const NAV_ITEMS = [
  { to: '/', label: 'Customer', end: true },
  { to: '/admin', label: 'Admin', end: false },
  { to: '/policy', label: 'Policy', end: false },
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ReceiptText className="size-4.5" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Worknoon</span>
            <span className="text-xs text-muted-foreground">Refund Assistant</span>
          </span>
        </Link>

        <nav
          aria-label="Main"
          className="order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto md:order-none md:w-auto"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                  isActive
                    ? 'bg-primary-soft text-primary dark:text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <HealthBadge />
          <BackendSwitcher />
        </div>
      </div>
    </header>
  );
}

import type { ReactNode } from 'react';

export function Card({
  title, action, children, className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl2 border border-line bg-panel p-4 shadow-card ${className}`}
    >
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between">
          {title && (
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

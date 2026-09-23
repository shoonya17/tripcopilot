import { Loader2, AlertCircle, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground',
        className,
      )}
    >
      <Loader2 className="size-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-full bg-muted p-3">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertCircle className="size-6 text-destructive" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          Try again
        </Button>
      )}
    </div>
  );
}
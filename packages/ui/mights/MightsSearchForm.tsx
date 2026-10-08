import { MightsButton } from './MightsButton';
import { routes } from './routes';

// A plain GET form: works before hydration, and the query lands in the URL.
export function MightsSearchForm({ defaultValue = '', className = '' }: { defaultValue?: string; className?: string }) {
  return (
    <form action={routes.explore()} method="get" role="search" className={`flex w-full max-w-xl gap-2 ${className}`}>
      <label htmlFor="mights-search" className="sr-only">
        Search places
      </label>
      <input
        id="mights-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search places, like Apollo"
        className="h-13 min-w-0 outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary flex-1 border border-border-strong bg-surface-raised px-4 text-base text-text placeholder:text-text-muted"
      />
      <MightsButton type="submit">Search</MightsButton>
    </form>
  );
}

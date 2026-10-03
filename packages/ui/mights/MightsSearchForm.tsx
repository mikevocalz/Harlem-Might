import { routes } from './routes';
import { cornerCut } from './geometry';

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
        className="mights-input h-12 min-w-0 flex-1 border border-border-strong bg-surface-raised px-4 text-base text-text placeholder:text-text-muted"
      />
      <button
        type="submit"
        className={`h-12 shrink-0 bg-primary px-6 text-base font-semibold text-on-primary hover:bg-primary-pressed ${cornerCut}`}
      >
        Search
      </button>
    </form>
  );
}

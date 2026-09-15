import { NavLink } from 'react-router-dom';
import { LayoutGrid, Layers, FileText, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { WordMark } from '../shared/WordMark';

const navItems = [
  { to: '/dashboard', label: 'Library',         icon: LayoutGrid },
  { to: '/queue',     label: 'Flashcard queue', icon: Layers },
  { to: '/billing',   label: 'Billing',         icon: FileText },
];

export function SideNav() {
  return (
    <nav className="w-[216px] flex-shrink-0 border-r border-ink-100 px-3.5 py-5 flex flex-col">
      <div className="px-2 mb-7">
        <WordMark />
      </div>

      <div className="flex flex-col gap-0.5 flex-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-meta transition-colors',
                isActive
                  ? 'bg-accent-dim text-accent-ink font-semibold'
                  : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent rounded-pill" />}
                <Icon
                  size={16}
                  strokeWidth={1.7}
                  className={isActive ? 'text-accent-ink' : 'text-ink-400'}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}

        <div className="h-px bg-ink-100 my-3.5" />

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-meta transition-colors',
              isActive ? 'bg-accent-dim text-accent-ink font-semibold' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900'
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent rounded-pill" />}
              <Settings size={16} strokeWidth={1.7} className={isActive ? 'text-accent-ink' : 'text-ink-400'} />
              Settings
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}

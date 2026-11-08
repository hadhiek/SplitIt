import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/groups', label: 'Groups', icon: '◫' },
  { to: '/add-expense', label: 'Add', icon: '+' , primary: true },
  { to: '/expenses', label: 'Expenses', icon: '↔' },
  { to: '/settlements', label: 'Settle', icon: '✓' },
];

export default function MobileNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          aria-label={item.label}
          className={({ isActive }) => [
            'mobile-bottom-nav__item',
            item.primary ? 'mobile-bottom-nav__item--primary' : '',
            isActive ? 'is-active' : '',
          ].filter(Boolean).join(' ')}
        >
          <span className="mobile-bottom-nav__icon" aria-hidden="true">{item.icon}</span>
          <span className="mobile-bottom-nav__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

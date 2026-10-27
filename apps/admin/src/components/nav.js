// Console navigation: one source for the sidebar, phone nav and command palette.
export const NAV = [
  { group: 'group.overview', items: [{ to: '/', key: 'nav.dashboard', icon: 'grid' }] },
  {
    group: 'group.ops',
    items: [
      { to: '/live', key: 'nav.live', icon: 'board', badge: 'active' },
      { to: '/kitchen', key: 'nav.kitchen', icon: 'chefHat' },
      { to: '/pos', key: 'nav.pos', icon: 'plus' },
      { to: '/map', key: 'nav.map', icon: 'navigation' },
      { to: '/orders', key: 'nav.orders', icon: 'receipt' },
    ],
  },
  {
    group: 'group.business',
    items: [
      { to: '/menu', key: 'nav.menu', icon: 'utensils', badge: 'lowStock' },
      { to: '/riders', key: 'nav.riders', icon: 'scooter' },
      { to: '/customers', key: 'nav.customers', icon: 'users' },
      { to: '/offers', key: 'nav.offers', icon: 'ticket' },
      { to: '/reviews', key: 'nav.reviews', icon: 'message' },
      { to: '/reports', key: 'nav.reports', icon: 'chart' },
    ],
  },
  { group: null, items: [{ to: '/settings', key: 'nav.settings', icon: 'sliders' }] },
];

export const ALL_PAGES = NAV.flatMap((g) => g.items);

export function pageFor(pathname) {
  return ALL_PAGES.find((p) => (p.to === '/' ? pathname === '/' : pathname.startsWith(p.to))) || ALL_PAGES[0];
}

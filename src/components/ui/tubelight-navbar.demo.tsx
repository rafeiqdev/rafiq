import { Home, Building2, HeartPulse, Map } from 'lucide-react';
import { NavBar } from './tubelight-navbar';

/*
 * Reference usage for <NavBar>. Not mounted anywhere in the app — the real
 * integration is the signed-in home's quick-nav (see src/pages/UserHome.tsx).
 * `url` values are react-router paths (the original demo used Next `#` anchors).
 */
export function NavBarDemo() {
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Real Estate', url: '/real-estate', icon: Building2 },
    { name: 'Health', url: '/health-tourism', icon: HeartPulse },
    { name: 'Map', url: '/map', icon: Map },
  ];

  return <NavBar items={navItems} />;
}

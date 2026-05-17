import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, QrCode, ScanLine, BarChart3, Wand2 } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut, hasRole } = useAuth();
  const navigate = useNavigate();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-2xl px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-navy text-white' : 'text-navy hover:bg-white/80'}`;

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen cloud-bg">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-cloudCream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/scan" className="flex items-center gap-2 font-black tracking-tight text-navy">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-navy text-white shadow-soft">
              <Wand2 size={22} />
            </span>
            <span>
              <span className="block text-lg leading-5">Võluvatt</span>
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-navy/60">Cloud Coupons</span>
            </span>
          </Link>

          {profile && (
            <nav className="hidden items-center gap-2 md:flex">
              <NavLink to="/scan" className={navClass}><span className="inline-flex items-center gap-1"><ScanLine size={16}/> Scan</span></NavLink>
              {hasRole(['owner', 'admin']) && <NavLink to="/admin" className={navClass}><span className="inline-flex items-center gap-1"><QrCode size={16}/> Admin</span></NavLink>}
              {hasRole(['owner', 'admin']) && <NavLink to="/reports" className={navClass}><span className="inline-flex items-center gap-1"><BarChart3 size={16}/> Reports</span></NavLink>}
            </nav>
          )}

          {profile && (
            <button onClick={handleSignOut} className="focus-ring rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-navy shadow-sm hover:bg-cloudYellow/40">
              <LogOut className="inline" size={16} /> <span className="hidden sm:inline">Sign out</span>
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 pb-24 md:py-8">{children}</main>

      {profile && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/80 bg-cloudCream/95 px-3 py-2 shadow-[0_-8px_30px_rgba(21,30,80,0.08)] backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
            <NavLink to="/scan" className={navClass}><span className="grid place-items-center"><ScanLine size={20}/>Scan</span></NavLink>
            <NavLink to="/admin" className={({ isActive }) => `${navClass({ isActive })} ${!hasRole(['owner','admin']) ? 'pointer-events-none opacity-40' : ''}`}><span className="grid place-items-center"><QrCode size={20}/>Admin</span></NavLink>
            <NavLink to="/reports" className={({ isActive }) => `${navClass({ isActive })} ${!hasRole(['owner','admin']) ? 'pointer-events-none opacity-40' : ''}`}><span className="grid place-items-center"><BarChart3 size={20}/>Reports</span></NavLink>
          </div>
        </nav>
      )}
    </div>
  );
}

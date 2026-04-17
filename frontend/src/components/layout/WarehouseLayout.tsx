import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout } from '@/store/slices/authSlice';
import { Warehouse, ScanLine, LogOut, Package } from 'lucide-react';

const warehouseNav = [
  { label: 'Scan Parcel', to: '/warehouse/scan', icon: ScanLine },
];

const WarehouseLayout = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((s) => s.auth);

  const handleLogout = () => { dispatch(logout()); navigate('/'); };

  return (
    <div className="min-h-screen flex bg-surface-low">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 editorial-gradient">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-sm flex items-center justify-center">
              <Warehouse size={16} className="text-white" />
            </div>
            <div>
              <p className="font-headline font-black text-white text-sm uppercase tracking-wider">Warehouse</p>
              <p className="text-white/50 text-xs">CartLy</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {warehouseNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon size={16} className="flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-white/50 text-xs truncate">Warehouse Staff</p>
            </div>
            <button onClick={handleLogout} className="text-white/50 hover:text-white transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-outline-variant/20 px-6 h-14 flex items-center gap-4">
          <Package size={18} className="text-on-surface-variant" />
          <span className="text-sm font-semibold text-on-surface">Parcel Management</span>
          <div className="flex-1" />
          <div className="w-8 h-8 rounded-full editorial-gradient flex items-center justify-center text-white font-bold text-xs">
            {user?.name?.[0]?.toUpperCase()}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default WarehouseLayout;

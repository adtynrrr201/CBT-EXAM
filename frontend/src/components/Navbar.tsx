import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  IconDashboard, IconUsers, IconBookOpen, IconPlus,
  IconMonitor, IconAward, IconLogOut
} from './Icons'
import { useAuth } from '../auth/AuthContext'
import React from 'react'

interface SidebarProps {
  items?: Array<{ path: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
  brand?: string;
  sections?: Array<{
    title: string;
    items: Array<{ path: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
  }>;
}

export function Sidebar({ items, brand = 'CBT-BINAZ', sections }: SidebarProps) {
  const loc = useLocation()
  const { user } = useAuth()
  const role = user?.role || 'admin'

  const defaultSections = [
    {
      title: 'MENU UTAMA',
      items: role === 'siswa' ? [
        { path: '/siswa-beranda', label: 'Beranda', icon: IconDashboard },
      ] : role === 'proktor' ? [
        { path: '/proktor', label: 'Live Proktor', icon: IconMonitor },
      ] : [
        { path: role === 'guru' ? '/guru' : '/', label: 'Dashboard', icon: IconDashboard },
        ...(role === 'admin'
          ? [{ path: '/pengguna', label: 'Pengguna', icon: IconUsers }]
          : []),
        { path: '/siswa', label: 'Siswa', icon: IconUsers },
        { path: '/soal', label: 'Bank Soal', icon: IconBookOpen },
      ]
    },
    ...(role === 'admin' || role === 'guru' ? [
      {
        title: 'UJIAN',
        items: [
          { path: '/ujian-baru', label: 'Buat Ujian', icon: IconPlus },
          { path: '/hasil', label: 'Hasil Ujian', icon: IconAward },
        ]
      },
      {
        title: 'PENGAWASAN',
        items: [
          { path: '/proktor', label: 'Live Proktor', icon: IconMonitor },
        ]
      }
    ] : [])
  ]

  const activeSections = sections || (items ? [{ title: 'MENU UTAMA', items }] : defaultSections)

  return (
    <aside className="hidden lg:flex flex-col w-[232px] shrink-0 bg-white border-r border-slate-200 min-h-screen sticky top-0">
      <div className="h-14 flex items-center px-4 border-b border-slate-200">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-700 flex items-center justify-center text-white text-xs font-bold tracking-wide">
            CB
          </div>
          <span className="font-semibold text-sm text-slate-900 tracking-tight">
            {brand}
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {activeSections.map((sec, i) => (
          <div key={i}>
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {sec.title}
            </p>
            <nav className="space-y-0.5">
              {sec.items.map(item => {
                const Icon = item.icon
                const active = loc.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-slate-200">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-semibold text-slate-800">UAS IPA</span>
            </div>
            <span className="text-[11px] font-medium text-blue-700 tnum">62%</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-700 h-full rounded-full" style={{ width: '62%' }}></div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">Siswa aktif: 24/38</p>
        </div>
      </div>
    </aside>
  )
}

interface NavbarProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  items?: Array<{ path: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
  brand?: string;
}

export default function Navbar({ title, subtitle, children, items, brand }: NavbarProps) {
  const loc = useLocation()
  const nav = useNavigate()
  const { user, signOut } = useAuth()

  const role = user?.role || 'admin'
  const roleNavs: Record<string, Array<{ path: string; label: string; icon: React.ComponentType<{ className?: string }> }>> = {
    admin: [
      { path: '/', label: 'Dashboard', icon: IconDashboard },
      { path: '/pengguna', label: 'Pengguna', icon: IconUsers },
      { path: '/siswa', label: 'Siswa', icon: IconUsers },
      { path: '/soal', label: 'Bank Soal', icon: IconBookOpen },
      { path: '/ujian-baru', label: 'Buat Ujian', icon: IconPlus },
      { path: '/proktor', label: 'Live Proktor', icon: IconMonitor },
      { path: '/hasil', label: 'Hasil Ujian', icon: IconAward },
    ],
    guru: [
      { path: '/guru', label: 'Dashboard', icon: IconDashboard },
      { path: '/siswa', label: 'Siswa', icon: IconUsers },
      { path: '/soal', label: 'Bank Soal', icon: IconBookOpen },
      { path: '/ujian-baru', label: 'Buat Ujian', icon: IconPlus },
      { path: '/hasil', label: 'Hasil Ujian', icon: IconAward },
    ],
    proktor: [
      { path: '/proktor', label: 'Live Proktor', icon: IconMonitor },
    ],
    siswa: [
      { path: '/siswa-beranda', label: 'Beranda', icon: IconDashboard },
    ],
  }

  const navItems = items || roleNavs[role] || roleNavs.admin

  function handleLogout() {
    signOut()
    nav('/login')
  }

  const initials = user?.nama
    ? user.nama.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'US'

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar brand={brand} items={items} />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                <div className="lg:hidden flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-blue-700 flex items-center justify-center text-white text-xs font-bold tracking-wide">
                    CB
                  </div>
                  <span className="font-semibold text-sm text-slate-900 tracking-tight">
                    {brand || 'CBT-BINAZ'}
                  </span>
                </div>
                {title && (
                  <div className="hidden sm:block">
                    <h1 className="text-sm font-semibold text-slate-900 leading-tight">{title}</h1>
                    {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {user ? (
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-semibold text-slate-700">
                        {initials}
                      </div>
                      <div className="hidden sm:block text-left leading-tight">
                        <p className="text-xs font-semibold text-slate-900">{user.nama}</p>
                        <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded uppercase font-medium">
                          {user.role}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-slate-100 rounded-md transition-colors"
                      title="Keluar Sesi"
                    >
                      <IconLogOut className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Keluar</span>
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="text-xs font-medium bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-md"
                  >
                    Masuk
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="lg:hidden flex items-center overflow-x-auto px-4 py-1.5 border-t border-slate-100 text-xs gap-1 bg-white">
            {navItems.map(item => {
              const active = loc.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-md font-medium transition-colors ${
                    active ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </header>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}

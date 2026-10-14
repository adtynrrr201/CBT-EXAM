---
name: CBT-BINAZ Canon
description: Sistem ujian sekolah resmi — shell institusi sidebar + tabel formal berbingkai.
colors:
  primary: "#1D4ED8"
  primary-soft: "#EFF6FF"
  ink: "#0F172A"
  body-text: "#334155"
  muted-text: "#64748B"
  faint-text: "#94A3B8"
  page-bg: "#F8FAFC"
  card-bg: "#FFFFFF"
  border: "#E2E8F0"
  header-row: "#F8FAFC"
  live-dot: "#10B981"
  warn-fill: "#FEF3C2"
  warn-ink: "#92400E"
  danger-fill: "#FFE4E6"
  danger-ink: "#9F1239"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  data:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  full: "9999px"
spacing:
  page-x: "16px"
  section: "16px"
  card-pad: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  button-ghost:
    backgroundColor: "{colors.card-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  sidebar-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "#1E40AF"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

## Overview

Dunia visual canon: admin sekolah resmi ala Classroom + Siakad. Shell kiri 232px berkelompok (Menu Utama, Data, Ujian, Pengawasan) + topbar judul + chip user; konten kertas putih berbingkai; satu primer institusi blue-700; status jujur dari server (dot + angka tabular).

## Colors

Primer blue-700 (#1D4ED8) hanya untuk aksi, tautan, dan nav aktif; latar primer blue-50. Tinta slate-900, teks slate-600/500, latar halaman slate-50, kartu putih, bingkai slate-200, baris header tabel slate-50. State: live emerald-500 (dot), warn amber (fill-100/ink-800), danger rose (fill-100/ink-800). Teks di atas permukaan berwarna selalu turunan hue yang sama, bukan abu.

## Typography

Inter untuk semua (display + body); data memakai tabular-nums (.tnum), bukan face mono. Judul halaman 14–20px semibold tracking-tight; label seksi 10–11px semibold uppercase; isi 13–14px; meta 11–12px slate-500.

## Layout

Sidebar 232px (lg ke atas) + topbar h-14 sticky; di bawah lg: topbar + nav horizontal scroll. Konten max-w-7xl, gutter 16–32px responsif, jeda seksi 16px. Tabel formal: bingkai luar rounded-lg, header uppercase 11px, kolom NIS/waktu tabular, aksi di kanan. Kepadatan: strip metrik berdivider, bukan kartu ikon.

## Elevation & Depth

Hampir tanpa bayangan: permukaan dibedakan oleh bingkai 1px. Shadow-sm hanya untuk topbar lengket dan tombol primer. Tanpa glow, blur dekoratif, atau halo berwarna.

## Shapes

Radius 8px kartu dan wadah, 6px tombol/input/chip, penuh untuk dot dan lencana kecil. Tabel: bingkai luar membulat, sel siku. Ikon 14–16px satu keluarga garis.

## Components

Tombol primer (blue-700, hover blue-800), ghost (putih berbingkai), tautan (blue-700 underline offset 3px), input (border-slate-200, fokus border-blue-700), badge status (dot + teks, fill-50/border-200), strip metrik (grid berdivider), kartu status ujian (dot + judul + meta tnum + progress blue-700), sidebar (grup berlabel, item aktif blue-50/blue-800, kartu mini status ujian).

## Do's and Don'ts

Lakukan: satu primer per kartu; angka live tabular; empty state eksplisit; fokus keyboard terlihat (ring blue-700); hormati reduced-motion. Jangan: gradient, glass/blur hiasan, rounded-2xl, pulse/ping, scale-aktif, border-l warna tebal, kicker di atas heading, ikon emoji, mono sebagai kostum, klaim data live untuk angka contoh guru.

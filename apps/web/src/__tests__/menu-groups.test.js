import { describe, expect, it } from 'vitest';
import { filterMenuGroups, MENU_GROUPS } from '../data/menu-groups';
import { ROLES, TIERS } from '../context/PermissionContext';

const ALL_TIERS = [TIERS.LITE, TIERS.STARTER, TIERS.ADVANCE, TIERS.PRIME, TIERS.PRIME_PLUS];

const tierRank = Object.fromEntries(ALL_TIERS.map((t, i) => [t, i]));

function canAccessFor(role, tier) {
  return ({ roles, minTier } = {}) => {
    if (
      role !== ROLES.OWNER &&
      role !== ROLES.ADMIN &&
      roles &&
      roles.length &&
      !roles.includes(role)
    ) {
      return false;
    }
    if (minTier && tierRank[tier] < tierRank[minTier]) return false;
    return true;
  };
}

describe('MENU_GROUPS', () => {
  it('punya 14 menu group sesuai spec P1-01 + P1-08 + P1-10', () => {
    // Penjualan, Promosi (P1-08), Invoice B2B (P1-10), Order Online,
    // Appointment, Karyawan, Keuangan, Pengaturan, Lainnya, Bantuan,
    // LAYANAN, INSPIRASI, Capital, SUPPLIES.
    expect(MENU_GROUPS).toHaveLength(14);
  });

  it('group "penjualan" terlihat untuk semua role + tier', () => {
    const visible = filterMenuGroups(MENU_GROUPS, canAccessFor(ROLES.STAFF, TIERS.LITE));
    const ids = visible.map((g) => g.id);
    expect(ids).toContain('penjualan');
  });
});

describe('filterMenuGroups by role', () => {
  it('OWNER lihat semua group', () => {
    const visible = filterMenuGroups(MENU_GROUPS, canAccessFor(ROLES.OWNER, TIERS.PRIME_PLUS));
    expect(visible.map((g) => g.id)).toEqual(MENU_GROUPS.map((g) => g.id));
  });

  it('KASIR tidak lihat group keuangan (semua item butuh manager)', () => {
    const visible = filterMenuGroups(MENU_GROUPS, canAccessFor(ROLES.KASIR, TIERS.PRIME));
    expect(visible.map((g) => g.id)).not.toContain('keuangan');
  });

  it('WAREHOUSE lihat inventori tapi tidak kasir', () => {
    const visible = filterMenuGroups(MENU_GROUPS, canAccessFor(ROLES.WAREHOUSE, TIERS.PRIME));
    const penjualan = visible.find((g) => g.id === 'penjualan');
    expect(penjualan).toBeDefined();
    const labels = penjualan.items.map((i) => i.label);
    expect(labels).toContain('Inventori');
    expect(labels).not.toContain('Kasir');
  });
});

describe('filterMenuGroups by tier', () => {
  it('LITE tier sembunyikan group capital + appointment (advance-only)', () => {
    const visible = filterMenuGroups(MENU_GROUPS, canAccessFor(ROLES.OWNER, TIERS.LITE));
    const ids = visible.map((g) => g.id);
    expect(ids).not.toContain('capital');
    expect(ids).not.toContain('appointment');
  });

  it('ADVANCE tier expose appointment + capital tapi sembunyikan KDS bila ada (Prime-only)', () => {
    const visible = filterMenuGroups(MENU_GROUPS, canAccessFor(ROLES.OWNER, TIERS.ADVANCE));
    const ids = visible.map((g) => g.id);
    expect(ids).toContain('appointment');
    expect(ids).toContain('capital');
  });

  it('PRIME tier expose semua item order_online termasuk marketplace', () => {
    const visible = filterMenuGroups(MENU_GROUPS, canAccessFor(ROLES.OWNER, TIERS.PRIME));
    const oo = visible.find((g) => g.id === 'order_online');
    expect(oo).toBeDefined();
    expect(oo.items.find((i) => i.label === 'Marketplace')).toBeTruthy();
  });
});

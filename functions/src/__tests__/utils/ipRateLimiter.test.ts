import { describe, it, expect } from 'vitest';
import { isIpv6, bucketIpv6, hashIp } from '../../utils/ipRateLimiter';

describe('isIpv6', () => {
  it('returns false for IPv4', () => {
    expect(isIpv6('192.0.2.1')).toBe(false);
    expect(isIpv6('10.0.0.1')).toBe(false);
  });

  it('returns true for IPv6 full form', () => {
    expect(isIpv6('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe(true);
  });

  it('returns true for IPv6 with :: shorthand', () => {
    expect(isIpv6('2001:db8::1')).toBe(true);
  });

  it('returns FALSE for IPv4-mapped IPv6 (::ffff:a.b.c.d)', () => {
    expect(isIpv6('::ffff:192.0.2.1')).toBe(false);
    expect(isIpv6('::FFFF:10.0.0.1')).toBe(false);
  });

  it('returns false for unknown or empty', () => {
    expect(isIpv6('')).toBe(false);
    expect(isIpv6('unknown')).toBe(false);
  });

  it('returns false when input is not a string', () => {
    // @ts-expect-error testing runtime safety
    expect(isIpv6(undefined)).toBe(false);
    // @ts-expect-error testing runtime safety
    expect(isIpv6(null)).toBe(false);
  });
});

describe('bucketIpv6', () => {
  it('extracts first 4 hextets from full form', () => {
    expect(bucketIpv6('2001:db8:85a3:8d3:1319:8a2e:370:7348'))
      .toBe('2001:db8:85a3:8d3');
  });

  it('normalizes to lowercase', () => {
    expect(bucketIpv6('2001:DB8:85A3:8D3:1319:8A2E:370:7348'))
      .toBe('2001:db8:85a3:8d3');
  });

  it('strips zone id', () => {
    expect(bucketIpv6('fe80::1%eth0')).toBe('fe80:0:0:0');
  });

  it('expands :: shorthand correctly', () => {
    expect(bucketIpv6('2001:db8::1')).toBe('2001:db8:0:0');
    expect(bucketIpv6('::1')).toBe('0:0:0:0');
  });

  it('handles :: at the beginning with tail', () => {
    // `::ffff:1:2:3:4` → head=[], tail=[ffff,1,2,3,4] → zeros=3 → [0,0,0,ffff,1,2,3,4]
    expect(bucketIpv6('::ffff:1:2:3:4')).toBe('0:0:0:ffff');
  });

  it('handles :: at the end', () => {
    expect(bucketIpv6('2001:db8:85a3::')).toBe('2001:db8:85a3:0');
  });

  it('groups different /128 addresses in the same /64 to the same bucket', () => {
    // Addresses differ only in interface identifier (last 4 hextets)
    const a = bucketIpv6('2001:db8:85a3:8d3:aaaa:bbbb:cccc:0001');
    const b = bucketIpv6('2001:db8:85a3:8d3:1111:2222:3333:4444');
    expect(a).toBe(b);
  });

  it('separates different /64 prefixes', () => {
    expect(bucketIpv6('2001:db8:85a3:8d3::1'))
      .not.toBe(bucketIpv6('2001:db8:85a3:8d4::1'));
  });
});

describe('hashIp', () => {
  it('hashes IPv4 unchanged (no bucketing)', () => {
    const a = hashIp('192.0.2.1');
    const b = hashIp('192.0.2.2');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it('hashes IPv6 to /64 bucket: 100 /128 sub-IPs map to 1 hash', () => {
    // All same /64, different /128
    const hashes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      hashes.add(hashIp(`2001:db8:85a3:8d3:${i.toString(16)}:0:0:0`));
    }
    expect(hashes.size).toBe(1);
  });

  it('distinguishes different IPv6 /64 prefixes', () => {
    expect(hashIp('2001:db8:85a3:8d3::1'))
      .not.toBe(hashIp('2001:db8:85a3:8d4::1'));
  });

  it('treats IPv4-mapped IPv6 as IPv4 (no bucketing)', () => {
    // Because ::ffff:a.b.c.d should not be collapsed
    const mappedA = hashIp('::ffff:1.2.3.4');
    const mappedB = hashIp('::ffff:1.2.3.5');
    expect(mappedA).not.toBe(mappedB);
  });

  it('produces 16-char hex output', () => {
    expect(hashIp('2001:db8::1')).toMatch(/^[0-9a-f]{16}$/);
    expect(hashIp('10.0.0.1')).toMatch(/^[0-9a-f]{16}$/);
  });
});

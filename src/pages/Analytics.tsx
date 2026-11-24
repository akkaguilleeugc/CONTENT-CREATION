import { endOfMonth, format, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';
import { ArrowDown, ArrowUp, BarChart3, GitCompare, Info, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatedNumber, BarChart, LineChart, RankBars } from '@/components/charts';
import { EmptyState } from '@/components/overlay';
import { Button, PageHeader, PlatformBadges, Segmented, Select } from '@/components/ui';
import { BRAND, FORMATS } from '@/lib/constants';
import { usePlatforms } from '@/lib/hooks';
import { engagementRate, sumRecords } from '@/lib/metrics';
import { useStore } from '@/lib/store';
import type { AnalyticsRecord } from '@/lib/types';
import { openModal } from '@/lib/ui';
import { cn, compact, fmtDate, fmtNumber, toDateStr } from '@/lib/utils';

import { $t } from '@/lib/i18n';
type Range = '7' | '30' | '90' | '365' | 'all';
type Metric = 'views' | 'engagement' | 'followersGained' | 'saves' | 'shares';
type SortKey = 'publishedDate' | 'views' | 'engagement' | 'likes' | 'followersGained';

const METRIC_LABEL: Record<Metric, string> = { views: 'Views', engagement: 'Engagement', followersGained: 'Followers', saves: 'Saves', shares: 'Shares' };
const val = (r: AnalyticsRecord, m: Metric) => (m === 'engagement' ? engagementRate(r) : r[m]);
const fmtMetric = (m: Metric, n: number) => (m === 'engagement' ? `${n.toFixed(1)}%` : compact(n));

export default function Analytics() {
  const records = useStore((s) => s.analytics);
  const categories = useStore((s) => s.settings.ideaCategories);
  const platforms = usePlatforms();
  const [range, setRange] = useState<Range>('90');
  const [platform, setPlatform] = useState('');
  const [category, setCategory] = useState('');
  const [fmt, setFmt] = useState('');
  const [topMetric, setTopMetric] = useState<Metric>('views');
  const [compare, setCompare] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'publishedDate', dir: -1 });

  const since = range === 'all' ? null : toDateStr(subDays(new Date(), Number(range) - 1));
  const prevSince = range === 'all' ? null : toDateStr(subDays(new Date(), Number(range) * 2 - 1));
  const matchesFilters = (r: AnalyticsRecord) => (!platform || r.platformId === platform) && (!category || r.category === category) && (!fmt || r.format === fmt);
  const filtered = useMemo(() => records.filter((r) => matchesFilters(r) && (!since || r.publishedDate >= since)), [records, platform, category, fmt, since]); // eslint-disable-line react-hooks/exhaustive-deps
  const previous = useMemo(() => (since && prevSince ? records.filter((r) => matchesFilters(r) && r.publishedDate >= prevSince && r.publishedDate < since) : []), [records, platform, category, fmt, since, prevSince]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = sumRecords(filtered);
  const p = sumRecords(previous);
  const delta = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);

  /* Views over time — weekly buckets for short ranges, monthly otherwise. */
  const timeline = useMemo(() => {
    if (!filtered.length) return { labels: [] as string[], views: [] as number[], reach: [] as number[] };
    const monthly = range === '365' || range === 'all';
    const key = (d: string) => (monthly ? d.slice(0, 7) : toDateStr(startOfWeek(new Date(`${d}T12:00`), { weekStartsOn: 1 })));
    const first = since ?? [...filtered].sort((a, b) => a.publishedDate.localeCompare(b.publishedDate))[0]!.publishedDate;
    const buckets: string[] = [];
    let cur = monthly ? startOfMonth(new Date(`${first}T12:00`)) : startOfWeek(new Date(`${first}T12:00`), { weekStartsOn: 1 });
    const end = new Date();
    while (cur <= end && buckets.length < 60) {
      buckets.push(monthly ? format(cur, 'yyyy-MM') : toDateStr(cur));
      cur = monthly ? startOfMonth(new Date(cur.getFullYear(), cur.getMonth() + 1, 1)) : new Date(cur.getTime() + 7 * 864e5);
    }
    const views = buckets.map((b) => filtered.filter((r) => key(r.publishedDate) === b).reduce((a, r) => a + r.views, 0));
    const reach = buckets.map((b) => filtered.filter((r) => key(r.publishedDate) === b).reduce((a, r) => a + r.reach, 0));
    return { labels: buckets.map((b) => (monthly ? format(new Date(`${b}-01T12:00`), 'MMM yy') : format(new Date(`${b}T12:00`), 'd MMM'))), views, reach };
  }, [filtered, range, since]);

  const monthlyBars = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
    return months.map((m) => {
      const a = toDateStr(startOfMonth(m));
      const b = toDateStr(endOfMonth(m));
      const rs = records.filter((r) => matchesFilters(r) && r.publishedDate >= a && r.publishedDate <= b);
      return { label: format(m, 'MMM'), value: rs.reduce((s, r) => s + r.views, 0) };
    });
  }, [records, platform, category, fmt]); // eslint-disable-line react-hooks/exhaustive-deps

  const byPlatform = useMemo(
    () =>
      platforms.list
        .map((pl) => {
          const rs = filtered.filter((r) => r.platformId === pl.id);
          const s = sumRecords(rs);
          return { key: pl.id, label: <><span className="dot" style={{ background: pl.color }} />{pl.name}</>, value: s.views, sub: `${rs.length} posts · ${s.engagement.toFixed(1)}% engagement · +${compact(s.followersGained)} followers`, color: pl.color };
        })
        .filter((x) => x.value > 0)
        .sort((a, b) => b.value - a.value),
    [filtered, platforms],
  );
  const byFormat = useMemo(
    () =>
      FORMATS.map((f) => {
        const rs = filtered.filter((r) => r.format === f.id);
        const s = sumRecords(rs);
        return { key: f.id, label: f.label, value: rs.length ? s.engagement : 0, sub: $t('{n} posts · {v} avg views', { n: rs.length, v: compact(rs.length ? s.views / rs.length : 0) }), n: rs.length };
      })
        .filter((x) => x.n > 0)
        .sort((a, b) => b.value - a.value),
    [filtered],
  );
  const top = useMemo(() => [...filtered].sort((a, b) => val(b, topMetric) - val(a, topMetric)).slice(0, 5), [filtered, topMetric]);
  const table = useMemo(() => {
    const v = (r: AnalyticsRecord): number | string => (sort.key === 'engagement' ? engagementRate(r) : r[sort.key]);
    return [...filtered].sort((a, b) => {
      const x = v(a);
      const y = v(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [filtered, sort]);
  const compared = compare.map((id) => records.find((r) => r.id === id)).filter(Boolean) as AnalyticsRecord[];

  const kpis = [
    { label: $t("Views"), value: t.views, d: delta(t.views, p.views) },
    { label: $t("Reach"), value: t.reach, d: delta(t.reach, p.reach) },
    { label: $t("Engagement rate"), value: t.engagement, d: p.posts ? t.engagement - p.engagement : null, pct: true },
    { label: $t("Followers gained"), value: t.followersGained, d: delta(t.followersGained, p.followersGained) },
    { label: $t("Interactions"), value: t.likes + t.comments + t.shares + t.saves, d: delta(t.likes + t.comments + t.shares + t.saves, p.likes + p.comments + p.shares + p.saves) },
    { label: $t("Posts"), value: t.posts, d: null },
  ];

  const th = (key: SortKey, label: string, cls = '') => (
    <th className={cls}>
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );

  return (
    <div className="page">
      <PageHeader
        title={$t("Analytics")}
        sub={records.length ? $t('{n} post records · understand what works and do more of it.', { n: records.length }) : $t("Record the numbers behind every post and learn what really works.")}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'stats' })}>
            {$t("Log statistics")}
          </Button>
        }
      />
      <div className="notice-bar">
        <Info size={15} />
        <span>
          {$t("No platform API is connected, so statistics are entered manually from each app’s insights. The data layer is ready for official integrations — see")} <Link to="/settings#integrations">{$t("Settings → Integrations")}</Link>.
        </span>
      </div>

      {records.length === 0 ? (
        <div className="panel">
          <EmptyState icon={<BarChart3 />} title={$t("No statistics yet")} text={$t("After a post has been live for a few days, log its views, likes, comments, shares, saves, reach and followers gained.")} actions={<Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'stats' })}>{$t("Log first post")}</Button>} />
        </div>
      ) : (
        <>
          <div className="toolbar">
            <Segmented
              label={$t("Date range")}
              value={range}
              onChange={setRange}
              options={[
                { value: '7', label: '7d' },
                { value: '30', label: '30d' },
                { value: '90', label: '90d' },
                { value: '365', label: '1y' },
                { value: 'all', label: $t("All") },
              ]}
            />
            <Select sm value={platform} onChange={(e) => setPlatform(e.target.value)} options={platforms.list.map((x) => ({ value: x.id, label: x.name }))} placeholder={$t("All platforms")} aria-label={$t("Platform")} style={{ width: 'auto' }} />
            <Select sm value={category} onChange={(e) => setCategory(e.target.value)} options={categories.map((c) => ({ value: c, label: c }))} placeholder={$t("All categories")} aria-label={$t("Category")} style={{ width: 'auto' }} />
            <Select sm value={fmt} onChange={(e) => setFmt(e.target.value)} options={FORMATS.map((f) => ({ value: f.id, label: f.label }))} placeholder={$t("All formats")} aria-label={$t("Format")} style={{ width: 'auto' }} />
          </div>

          <section className="kpis panel" style={{ gridTemplateColumns: undefined }}>
            {kpis.map((k) => (
              <div key={k.label} className="kpi">
                <span className="kpi__value display">
                  <AnimatedNumber value={k.value} format={(n) => (k.pct ? `${n.toFixed(1)}%` : compact(n))} />
                </span>
                <span className="kpi__label">{k.label}</span>
                <span className="kpi__sub">
                  {k.d === null ? (range === 'all' ? $t("all time") : $t("no previous data")) : (
                    <span className={cn('delta', k.d >= 0 ? 'delta--up' : 'delta--down')}>
                      {k.d >= 0 ? '▲' : '▼'} {Math.abs(k.d).toFixed(1)}{k.pct ? $t(" pts") : '%'} <span className="subtle">{$t("vs prev.")}</span>
                    </span>
                  )}
                </span>
              </div>
            ))}
          </section>

          {filtered.length === 0 ? (
            <div className="panel">
              <EmptyState compact icon={<BarChart3 />} title={$t("No posts in this range")} text={$t("Try a longer date range or different filters.")} />
            </div>
          ) : (
            <>
              <section className="panel" style={{ marginBottom: 16 }}>
                <div className="panel__head">
                  <h3 className="panel__title">{$t("Views over time")}</h3>
                  <span className="row" style={{ gap: 12, fontSize: 12 }}>
                    <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: BRAND.lime }} />{$t("Views")}</span>
                    <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: BRAND.royal }} />{$t("Reach")}</span>
                  </span>
                </div>
                <div className="panel__body">
                  <LineChart labels={timeline.labels} series={[{ label: $t("Reach"), values: timeline.reach, color: BRAND.royal }, { label: $t("Views"), values: timeline.views, color: BRAND.lime }]} height={240} />
                </div>
              </section>
              <div className="ov-grid">
                <section className="panel">
                  <div className="panel__head">
                    <h3 className="panel__title">{$t("By platform")}</h3>
                    <span className="eyebrow">views</span>
                  </div>
                  <div className="panel__body">
                    <RankBars data={byPlatform} />
                  </div>
                </section>
                <section className="panel">
                  <div className="panel__head">
                    <h3 className="panel__title">{$t("Best formats")}</h3>
                    <span className="eyebrow">{$t("engagement rate")}</span>
                  </div>
                  <div className="panel__body">
                    <RankBars data={byFormat} format={(n) => `${n.toFixed(1)}%`} />
                  </div>
                </section>
              </div>
              <div className="ov-grid">
                <section className="panel">
                  <div className="panel__head">
                    <h3 className="panel__title">{$t("Top posts")}</h3>
                    <Select sm value={topMetric} onChange={(e) => setTopMetric(e.target.value as Metric)} options={(Object.keys(METRIC_LABEL) as Metric[]).map((m) => ({ value: m, label: METRIC_LABEL[m] }))} aria-label={$t("Rank by")} style={{ width: 'auto' }} />
                  </div>
                  <div className="panel__body">
                    <ol className="top-posts">
                      {top.map((r, i) => (
                        <li key={r.id}>
                          <span className="top-posts__rank display">{i + 1}</span>
                          <button className="grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => openModal({ kind: 'stats', id: r.id })}>
                            <div className="truncate" style={{ fontWeight: 600 }}>{r.title}</div>
                            <div className="row subtle" style={{ fontSize: 12, gap: 8 }}>
                              <PlatformBadges ids={[r.platformId]} compact />
                              {fmtDate(r.publishedDate, 'd MMM')}
                            </div>
                          </button>
                          <span className="top-posts__val tnum">{fmtMetric(topMetric, val(r, topMetric))}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={<GitCompare />}
                            tip={compare.includes(r.id) ? $t("Remove from comparison") : $t("Compare")}
                            onClick={() => setCompare((c) => (c.includes(r.id) ? c.filter((x) => x !== r.id) : [...c.slice(-2), r.id]))}
                            aria-pressed={compare.includes(r.id)}
                          />
                        </li>
                      ))}
                    </ol>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel__head">
                    <h3 className="panel__title">{$t("Monthly performance")}</h3>
                    <span className="eyebrow">{$t("views · 6 months")}</span>
                  </div>
                  <div className="panel__body">
                    <BarChart data={monthlyBars} height={200} highlight={5} />
                  </div>
                </section>
              </div>

              <section className="panel" style={{ marginBottom: 16 }}>
                <div className="panel__head">
                  <h3 className="panel__title">{$t("Compare posts")}</h3>
                  <span className="subtle" style={{ fontSize: 12 }}>{$t("Pick up to 3 with the compare button or from the table")}</span>
                </div>
                <div className="panel__body">
                  {compared.length < 2 ? (
                    <p className="subtle" style={{ fontSize: 13 }}>{compared.length === 1 ? `“${compared[0]!.title}” selected — add one more to compare.` : $t("Select two or three posts to compare them side by side.")}</p>
                  ) : (
                    <div className="table-wrap" style={{ border: 0 }}>
                      <table className="table compare">
                        <thead>
                          <tr>
                            <th>{$t("Metric")}</th>
                            {compared.map((r) => (
                              <th key={r.id}>
                                <span className="row" style={{ gap: 6, textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--text)' }}>
                                  <span className="truncate" style={{ maxWidth: 180 }}>{r.title}</span>
                                  <button onClick={() => setCompare((c) => c.filter((x) => x !== r.id))} aria-label={$t("Remove")}><X size={12} /></button>
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(['views', 'reach', 'likes', 'comments', 'shares', 'saves', 'followersGained', 'engagement'] as const).map((m) => {
                            const vals = compared.map((r) => (m === 'engagement' ? engagementRate(r) : r[m]));
                            const best = Math.max(...vals);
                            return (
                              <tr key={m}>
                                <td style={{ textTransform: 'capitalize' }}>{m === 'followersGained' ? $t("Followers gained") : m}</td>
                                {vals.map((v, i) => (
                                  <td key={i} className={cn('num', v === best && best > 0 && 'best')}>{m === 'engagement' ? `${v.toFixed(2)}%` : fmtNumber(v)}</td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }} />
                      <th>{$t("Post")}</th>
                      {th('publishedDate', 'Date', 'hide-mobile')}
                      {th('views', 'Views', 'num')}
                      {th('likes', 'Likes', 'num hide-mobile')}
                      {th('engagement', 'Eng.', 'num')}
                      {th('followersGained', 'Followers', 'num hide-mobile')}
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((r) => (
                      <tr key={r.id} className="clickable" onClick={() => openModal({ kind: 'stats', id: r.id })}>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="cmp-check"
                            checked={compare.includes(r.id)}
                            onChange={() => setCompare((c) => (c.includes(r.id) ? c.filter((x) => x !== r.id) : [...c.slice(-2), r.id]))}
                            aria-label={$t('Compare {title}', { title: r.title })}
                          />
                        </td>
                        <td style={{ maxWidth: 340 }}>
                          <div className="truncate" style={{ fontWeight: 600 }}>{r.title}</div>
                          <div className="row subtle" style={{ fontSize: 12, gap: 8 }}>
                            <PlatformBadges ids={[r.platformId]} compact />
                            {r.category} · {FORMATS.find((f) => f.id === r.format)?.label}
                          </div>
                        </td>
                        <td className="hide-mobile tnum subtle">{fmtDate(r.publishedDate, 'd MMM yy')}</td>
                        <td className="num">{compact(r.views)}</td>
                        <td className="num hide-mobile">{compact(r.likes)}</td>
                        <td className="num">{engagementRate(r).toFixed(1)}%</td>
                        <td className="num hide-mobile">+{compact(r.followersGained)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

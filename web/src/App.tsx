import { useState } from 'react';
import { useMarkets, type Market } from './lib/markets';
import { Feed } from './screens/Feed';
import { ProofDrop } from './screens/ProofDrop';
import { Certificate } from './components/Certificate';
import { Guilloche } from './components/Engraving';

type Tab = 'feed' | 'markets' | 'portfolio' | 'issue' | 'profile';

export default function App() {
  const { markets, loading, error } = useMarkets();
  const [tab, setTab] = useState<Tab>('feed');
  const [open, setOpen] = useState<Market | null>(null);

  if (open) {
    return (
      <div className="phone">
        <ProofDrop market={open} onBack={() => setOpen(null)} />
      </div>
    );
  }

  return (
    <div className="phone">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ font: '600 17px/1 var(--serif)', letterSpacing: 3.4, color: 'var(--vellum)' }}>CRUX</div>
          <div style={{ font: '400 8px/1 var(--mono)', color: 'var(--indigo-mute)' }}>SERIES 2026</div>
        </div>
        <div style={{ font: '400 9px/1.3 var(--mono)', color: 'var(--indigo-soft)', textAlign: 'right' }}>
          CREDITCOIN CC3<br />
          <span style={{ color: 'var(--indigo-mute)' }}>{markets.length} INSTRUMENTS</span>
        </div>
      </header>

      {loading && (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <Guilloche seed="loading" size={220} opacity={0.14} stroke="var(--indigo-soft)"
              style={{ position: 'relative', left: 0, top: 0 }} />
            <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 3, marginTop: 12 }}>
              READING THE LEDGER
            </div>
          </div>
        </div>
      )}

      {error && !loading && (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="legend" style={{ color: 'var(--crit)' }}>CHAIN UNREACHABLE</div>
            <div style={{ font: '400 10px/1.6 var(--mono)', color: 'var(--indigo-soft)', marginTop: 10 }}>{error}</div>
          </div>
        </div>
      )}

      {!loading && !error && tab === 'feed' && <Feed markets={markets} onOpen={setOpen} />}

      {!loading && !error && tab !== 'feed' && (
        <div className="scroll" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 2.8 }}>
            ALL INSTRUMENTS · SERIES 2026
          </div>
          {markets.map((m) => (
            <div key={m.id} style={{ minHeight: 190 }}>
              <Certificate market={m} compact onOpen={() => setOpen(m)} />
            </div>
          ))}
        </div>
      )}

      <nav style={{ display: 'flex', borderTop: '1px solid var(--indigo-rule)', height: 56, alignItems: 'stretch' }}>
        {(['feed', 'markets', 'portfolio', 'issue', 'profile'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, font: `${tab === t ? 600 : 400} 8px/1 var(--sans)`, letterSpacing: 1.8,
            color: tab === t ? 'var(--vellum)' : 'var(--indigo-mute)',
            borderBottom: tab === t ? '2px solid var(--vellum)' : '2px solid transparent',
          }}>{t.toUpperCase()}</button>
        ))}
      </nav>
    </div>
  );
}

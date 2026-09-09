import { useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './lib/wagmi';
import { useMarkets, type Market } from './lib/markets';
import { Feed } from './screens/Feed';
import { ProofDrop } from './screens/ProofDrop';
import { Portfolio } from './screens/Portfolio';
import { Profile } from './screens/Profile';
import { Issue } from './screens/Issue';
import { Certificate } from './components/Certificate';
import { Guilloche, Microtext } from './components/Engraving';
import { VerifyPanel } from './components/VerifyPanel';
import { ConnectButton } from './components/Connect';
import { ADDRESSES } from './lib/chain';
import { useIsDesktop } from './lib/useIsDesktop';

const queryClient = new QueryClient();

export type Tab = 'feed' | 'markets' | 'portfolio' | 'issue' | 'profile';
const TABS: Tab[] = ['feed', 'markets', 'portfolio', 'issue', 'profile'];

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Shell />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function Shell() {
  const { markets, loading, error } = useMarkets();
  const [tab, setTab] = useState<Tab>('feed');
  const [open, setOpen] = useState<Market | null>(null);
  const desktop = useIsDesktop();

  const screen = (t: Tab) => {
    switch (t) {
      case 'feed': return <Feed markets={markets} onOpen={setOpen} />;
      case 'markets': return <MarketList markets={markets} onOpen={setOpen} desktop={desktop} />;
      case 'portfolio': return <Portfolio markets={markets} onOpen={setOpen} />;
      case 'issue': return <Issue onIssued={() => setTab('feed')} />;
      case 'profile': return <Profile markets={markets} />;
    }
  };

  const state = loading ? <Loading /> : error ? <Unreachable error={error} /> : null;

  // ---------------------------------------------------------------- desktop
  if (desktop) {
    return (
      <div className="app">
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid var(--indigo-rule)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <div style={{ font: '600 22px/1 var(--serif)', letterSpacing: 4.4, color: 'var(--vellum)' }}>CRUX</div>
            <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 3 }}>
              SETTLEMENT BY PROOF · SERIES 2026
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ font: '400 9px/1.5 var(--mono)', color: 'var(--indigo-mute)', textAlign: 'right' }}>
              CREDITCOIN CC3 · {markets.length} INSTRUMENTS<br />
              CruxMarket {ADDRESSES.market.slice(0, 10)}…
            </div>
            <ConnectButton />
          </div>
        </header>

        <nav className="rail">
          {TABS.map((t) => (
            <button key={t} data-on={tab === t} onClick={() => { setTab(t); setOpen(null); }}>
              {t.toUpperCase()}
            </button>
          ))}
        </nav>

        <div className="desk">
          <div className="desk-main">
            {state ?? (open ? <ProofDrop market={open} onBack={() => setOpen(null)} /> : screen(tab))}
          </div>
          <aside className="desk-side">
            <div style={{ padding: 20 }}>
              <VerifyPanel
                chainKey={open?.spec?.chainKey}
                compact
              />
              <div style={{ marginTop: 18, border: '1px solid var(--indigo-rule)', padding: 16 }}>
                <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 2.6 }}>WHAT THIS IS</div>
                <div style={{ font: '400 11.5px/1.6 var(--sans)', color: 'var(--indigo-soft)', marginTop: 9 }}>
                  A contract states its resolution rule as <em>data</em> — which chain, which contract,
                  which event, which field, which comparison, which window — and CRUX settles it against
                  a cryptographic proof that the event occurred on Ethereum, verified by a native
                  precompile inside one block.
                </div>
                <div style={{ font: '400 11.5px/1.6 var(--sans)', color: 'var(--indigo-soft)', marginTop: 10 }}>
                  No oracle, no committee, no admin key, no dispute window. Prediction markets are the
                  first thing built on it.
                </div>
                <div style={{ font: '400 9px/1.8 var(--mono)', color: 'var(--indigo-mute)', marginTop: 12, borderTop: '1px solid var(--indigo-rule)', paddingTop: 10 }}>
                  MARKET&nbsp;&nbsp;&nbsp;{ADDRESSES.market}<br />
                  RESOLVER&nbsp;{ADDRESSES.resolver}<br />
                  SCORE&nbsp;&nbsp;&nbsp;&nbsp;{ADDRESSES.score}<br />
                  PRECOMPILE 0x…0FD2
                </div>
              </div>
              <Microtext style={{ marginTop: 16 }} parts={['CRUXMARKET', ADDRESSES.market, 'RESOLVER', ADDRESSES.resolver]} />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ phone
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
        <ConnectButton compact />
      </header>

      {state ?? screen(tab)}

      <nav style={{ display: 'flex', borderTop: '1px solid var(--indigo-rule)', height: 56, alignItems: 'stretch' }}>
        {TABS.map((t) => (
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

function MarketList({ markets, onOpen, desktop }: { markets: Market[]; onOpen: (m: Market) => void; desktop: boolean }) {
  if (!markets.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 3 }}>NO INSTRUMENTS ISSUED</div>
        <div className="proposition" style={{ fontSize: 24, color: 'var(--vellum)', marginTop: 12 }}>
          The plate is blank.
        </div>
      </div>
    );
  }
  return (
    <div className={desktop ? 'grid-markets' : undefined}
      style={desktop ? undefined : { padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {markets.map((m) => (
        <div key={m.id} style={{ minHeight: 200 }}>
          <Certificate market={m} compact onOpen={() => onOpen(m)} />
        </div>
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 60 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <Guilloche seed="reading-the-ledger" size={220} opacity={0.16} stroke="var(--indigo-soft)"
            style={{ position: 'relative', left: 0, top: 0 }} />
        </div>
        <div className="legend" style={{ color: 'var(--indigo-mute)', letterSpacing: 3, marginTop: 14 }}>
          READING THE LEDGER
        </div>
      </div>
    </div>
  );
}

function Unreachable({ error }: { error: string }) {
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 30 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div className="legend" style={{ color: 'var(--crit)', letterSpacing: 3 }}>CHAIN UNREACHABLE</div>
        <div style={{ font: '400 10px/1.7 var(--mono)', color: 'var(--indigo-soft)', marginTop: 12 }}>{error}</div>
      </div>
    </div>
  );
}

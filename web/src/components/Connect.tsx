import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { walletReady } from '../lib/wagmi';
import { tctc } from '../lib/format';
import { VerificationMark } from './Engraving';

/** AppKit registers <appkit-button>; typed loosely so TS does not fight the web component. */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'appkit-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { balance?: string; size?: string };
    }
  }
}

export function ConnectButton({ compact = false }: { compact?: boolean }) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: bal } = useBalance({ address });

  if (!walletReady) {
    return (
      <div style={{ font: '400 8px/1.4 var(--mono)', color: 'var(--indigo-mute)', textAlign: 'right' }}>
        WALLET DISABLED<br />NO PROJECT ID
      </div>
    );
  }

  if (!address) return <appkit-button size={compact ? 'sm' : 'md'} balance="hide" />;

  return (
    <button
      onClick={() => disconnect()}
      title="Disconnect"
      style={{ display: 'flex', alignItems: 'center', gap: 9, border: '1px solid var(--indigo-rule)', padding: '6px 9px' }}
    >
      <div style={{ textAlign: 'right' }}>
        <div style={{ font: '400 9.5px/1.3 var(--mono)', color: 'var(--vellum)' }}>
          {bal ? tctc(bal.value) : '—'} tCTC
        </div>
        <div style={{ font: '400 8px/1.3 var(--mono)', color: 'var(--indigo-mute)' }}>
          {address.slice(0, 6)}…{address.slice(-4)}
        </div>
      </div>
    </button>
  );
}

/** Shown where a screen genuinely needs an address, never as a wall on arrival. */
export function ConnectPrompt({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <VerificationMark progress={0} size={96} rings />
        </div>
        <div className="proposition" style={{ fontSize: 24, color: 'var(--vellum)', marginTop: 18 }}>{title}</div>
        <div style={{ font: '400 12px/1.6 var(--sans)', color: 'var(--indigo-soft)', marginTop: 12 }}>{body}</div>
        <div style={{ marginTop: 20, display: 'grid', placeItems: 'center' }}><ConnectButton /></div>
      </div>
    </div>
  );
}

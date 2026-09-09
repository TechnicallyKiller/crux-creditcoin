/**
 * Wallet layer — Reown AppKit over wagmi.
 *
 * AppKit rather than a hand-rolled injected picker: this is an online hackathon,
 * a judge may open the hosted app on a phone with no extension installed, and
 * the QR path to a mobile wallet is the difference between "works" and "dead
 * end". AppKit also brings the wallet list, chain switching and the recent-
 * wallet memory that would otherwise be a day of fiddly UI.
 *
 * Set VITE_REOWN_PROJECT_ID from cloud.reown.com. Without one the app still
 * runs and stays fully readable — every market, spec and proof is public — and
 * only the connect button is disabled, because reads never needed a wallet.
 */
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { defineChain } from '@reown/appkit/networks';
import { http } from 'wagmi';

export const PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID as string | undefined;
export const walletReady = Boolean(PROJECT_ID);

export const cc3Network = defineChain({
  id: 102031,
  caipNetworkId: 'eip155:102031',
  chainNamespace: 'eip155',
  name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Test Creditcoin', symbol: 'tCTC', decimals: 18 },
  rpcUrls: {
    default: {
      // Blockscout's proxy first: the official endpoint has been running at
      // ~15.7s per call, and a wallet flow that stalls that long reads as broken.
      http: [
        'https://creditcoin-testnet.blockscout.com/api/eth-rpc',
        'https://rpc.cc3-testnet.creditcoin.network',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://creditcoin-testnet.blockscout.com' },
  },
  testnet: true,
});

export const wagmiAdapter = new WagmiAdapter({
  networks: [cc3Network],
  projectId: PROJECT_ID ?? 'crux-local-development',
  ssr: false,
  transports: {
    [cc3Network.id]: http('https://creditcoin-testnet.blockscout.com/api/eth-rpc', { timeout: 20_000 }),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

/**
 * AppKit initialises at module scope, which means anything it throws happens
 * before React mounts — and a throw there is a blank page, not a broken button.
 * Wrapped so a bad project id, a blocked origin or a CDN failure costs the
 * connect button and nothing else. Reads never needed a wallet.
 */
export let walletError: string | null = null;

if (walletReady) {
  try {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [cc3Network],
    defaultNetwork: cc3Network,
    projectId: PROJECT_ID!,
    metadata: {
      name: 'CRUX',
      description: 'Prediction markets that settle themselves, by cryptographic proof.',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://crux.markets',
      icons: [],
    },
    features: { analytics: false, email: false, socials: false },
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#C8FF3D',
      '--w3m-color-mix': '#0B0F26',
      '--w3m-color-mix-strength': 24,
      '--w3m-font-family': 'Archivo, system-ui, sans-serif',
      '--w3m-border-radius-master': '0px',
    },
  });
  } catch (e) {
    walletError = (e as Error)?.message ?? String(e);
    console.error('[crux] AppKit failed to initialise; reads still work:', e);
  }
}

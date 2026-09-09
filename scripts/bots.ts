/**
 * Test bearers — wallets that actually trade, so the markets are not a wall of
 * 50/50 with zero open interest.
 *
 * These are throwaway keys held in plaintext in a gitignored file. That is
 * fine, and deliberate: they hold testnet tCTC only, they exist so the app has
 * real trading history to render, and nothing about them is worth protecting.
 * The deployer key stays in the encrypted keystore and is never read here.
 *
 *   node --experimental-strip-types scripts/bots.ts new      # generate wallets
 *   node --experimental-strip-types scripts/bots.ts fund     # print funding cmd
 *   node --experimental-strip-types scripts/bots.ts trade    # place the bets
 *   node --experimental-strip-types scripts/bots.ts status   # balances/positions
 */
import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  createPublicClient, createWalletClient, http, fallback, defineChain,
  parseAbi, formatEther, parseEther, type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const BOTS_FILE = '.bots.json';
const cc3Json = JSON.parse(readFileSync('deployments/cc3-testnet.json', 'utf8'));
const MARKET = cc3Json.CruxMarket as Hex;

const cc3 = defineChain({
  id: 102031, name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Test Creditcoin', symbol: 'tCTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://creditcoin-testnet.blockscout.com/api/eth-rpc'] } },
});

const transport = fallback([
  http('https://creditcoin-testnet.blockscout.com/api/eth-rpc', { timeout: 25_000 }),
  http('https://rpc.cc3-testnet.creditcoin.network', { timeout: 40_000 }),
]);
const pub = createPublicClient({ chain: cc3, transport });

const marketAbi = parseAbi([
  'function nextMarketId() view returns (uint256)',
  'function priceYes(uint256) view returns (uint256)',
  'function quoteBuy(uint256 marketId, bool yes, uint256 shares) view returns (uint256)',
  'function buy(uint256 marketId, bool yes, uint256 shares, uint256 maxCost) payable',
  'function yesShares(uint256, address) view returns (uint256)',
  'function noShares(uint256, address) view returns (uint256)',
  'function markets(uint256) view returns (address,uint8,bool,bool,uint64,uint64,uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
]);

interface Bot { name: string; key: Hex; address: Hex }

/**
 * Personalities, so the order flow does not look synthetic. A market where
 * every bet is the same size on the same side produces a straight line, which
 * is worse than no trades at all.
 */
const CAST: { name: string; yesBias: number; sizes: number[] }[] = [
  { name: 'calder',    yesBias: 0.75, sizes: [40, 25] },
  { name: 'plate.eth', yesBias: 0.30, sizes: [30, 55] },
  { name: 'intaglio',  yesBias: 0.62, sizes: [18] },
  { name: 'nonzero',   yesBias: 0.20, sizes: [45] },
  { name: 'sibling7',  yesBias: 0.85, sizes: [22, 12] },
  { name: 'rosette',   yesBias: 0.45, sizes: [35] },
];

const load = (): Bot[] =>
  existsSync(BOTS_FILE) ? JSON.parse(readFileSync(BOTS_FILE, 'utf8')) : [];

function make(): Bot[] {
  const bots = CAST.map(({ name }) => {
    const key = generatePrivateKey();
    return { name, key, address: privateKeyToAccount(key).address };
  });
  writeFileSync(BOTS_FILE, JSON.stringify(bots, null, 2));
  console.log(`wrote ${bots.length} bearers to ${BOTS_FILE} (gitignored)\n`);
  bots.forEach((b) => console.log(`  ${b.name.padEnd(11)} ${b.address}`));
  return bots;
}

function fundCommand(bots: Bot[], each = '60') {
  console.log(`Fund all ${bots.length} bearers with ${each} tCTC each.`);
  console.log('Run from contracts/. Asks for the keystore password ONCE:\n');
  console.log('  read -rs -p "keystore password: " PW; echo');
  for (const b of bots) {
    console.log(`  cast send ${b.address} --value ${each}ether --account crux-deployer --password "$PW" --rpc-url cc3_testnet >/dev/null && echo "funded ${b.name}"`);
  }
  console.log('  unset PW');
}

async function tradableMarkets() {
  const next = Number(await pub.readContract({ address: MARKET, abi: marketAbi, functionName: 'nextMarketId' }));
  const attested = await pub.readContract({
    address: '0x0000000000000000000000000000000000000fD3',
    abi: parseAbi(['function get_latest_attestation_height_and_hash(uint64) view returns ((uint64 height,bytes32 hash,bool isAttestation,bool exists))']),
    functionName: 'get_latest_attestation_height_and_hash', args: [3n],
  });
  const open: number[] = [];
  for (let id = 1; id < next; id++) {
    const m = await pub.readContract({ address: MARKET, abi: marketAbi, functionName: 'markets', args: [BigInt(id)] });
    const settled = m[2] as boolean;
    const close = Number(m[4]);
    if (!settled && Number(attested.height) < close) open.push(id);
  }
  return { open, attested: Number(attested.height) };
}

async function trade() {
  const bots = load();
  if (!bots.length) return console.error('no bearers — run `bots.ts new` first');

  const { open, attested } = await tradableMarkets();
  console.log(`attested ${attested} · tradable markets: ${open.length ? open.join(', ') : 'none'}\n`);
  if (!open.length) return console.error('no market is open for trading — create one with a longer close block');

  for (const bot of bots) {
    const cfg = CAST.find((c) => c.name === bot.name)!;
    const account = privateKeyToAccount(bot.key);
    const wallet = createWalletClient({ account, chain: cc3, transport });

    const bal = await pub.getBalance({ address: bot.address });
    if (bal < parseEther('5')) {
      console.log(`${bot.name.padEnd(11)} skipped — ${formatEther(bal)} tCTC, needs funding`);
      continue;
    }

    for (const size of cfg.sizes) {
      const marketId = BigInt(open[Math.floor(Math.random() * open.length)]);
      const yes = Math.random() < cfg.yesBias;
      const shares = parseEther(String(size));

      try {
        const cost = await pub.readContract({
          address: MARKET, abi: marketAbi, functionName: 'quoteBuy', args: [marketId, yes, shares],
        });
        // Slippage guard with headroom: other bearers move the price between
        // the quote and the block that includes us, which is the whole point of
        // an LMSR and not an error.
        const maxCost = (cost * 112n) / 100n;

        const hash = await wallet.writeContract({
          address: MARKET, abi: marketAbi, functionName: 'buy',
          args: [marketId, yes, shares, maxCost], value: maxCost,
        });
        await pub.waitForTransactionReceipt({ hash, timeout: 90_000 });
        const after = await pub.readContract({ address: MARKET, abi: marketAbi, functionName: 'priceYes', args: [marketId] });
        console.log(`${bot.name.padEnd(11)} #${marketId} ${yes ? 'YES' : 'NO '} ${String(size).padStart(3)} sh · ${Number(formatEther(cost)).toFixed(2)} tCTC → yes ${(Number(after) / 1e18).toFixed(3)}`);
      } catch (e) {
        console.log(`${bot.name.padEnd(11)} #${marketId} failed — ${String((e as Error).message).slice(0, 90)}`);
      }
    }
  }
}

async function status() {
  const bots = load();
  const { open, attested } = await tradableMarkets();
  console.log(`attested ${attested} · open ${open.join(', ') || 'none'}\n`);
  for (const b of bots) {
    const bal = await pub.getBalance({ address: b.address });
    const next = Number(await pub.readContract({ address: MARKET, abi: marketAbi, functionName: 'nextMarketId' }));
    const held: string[] = [];
    for (let id = 1; id < next; id++) {
      const [y, n] = await Promise.all([
        pub.readContract({ address: MARKET, abi: marketAbi, functionName: 'yesShares', args: [BigInt(id), b.address] }),
        pub.readContract({ address: MARKET, abi: marketAbi, functionName: 'noShares', args: [BigInt(id), b.address] }),
      ]);
      if (y > 0n) held.push(`#${id} YES ${Number(formatEther(y)).toFixed(0)}`);
      if (n > 0n) held.push(`#${id} NO ${Number(formatEther(n)).toFixed(0)}`);
    }
    console.log(`${b.name.padEnd(11)} ${Number(formatEther(bal)).toFixed(2).padStart(8)} tCTC  ${held.join(' · ') || '—'}`);
  }
}

const cmd = process.argv[2];
if (cmd === 'new') make();
else if (cmd === 'fund') fundCommand(load().length ? load() : make());
else if (cmd === 'trade') await trade();
else if (cmd === 'status') await status();
else console.log('usage: bots.ts new | fund | trade | status');

/**
 * crux-indexer — event indexer and read API.
 *
 * Creditcoin has no subgraph (C7), so the frontend cannot query history
 * directly: an RPC gives you current state and a log range, not "every trade on
 * market 3" or a leaderboard. This fills that gap and nothing more.
 *
 * It is a READ CACHE, never an authority. Every number it serves is derived
 * from on-chain events and can be recomputed by anyone from the chain alone; if
 * it disagrees with the chain, the chain is right. Deleting the database and
 * resyncing is always safe, which is the property that matters — a testnet
 * reset (R5) should cost nothing but a resync.
 *
 *   node --experimental-strip-types indexer/src/index.ts
 *   node --experimental-strip-types indexer/src/index.ts --once   # sync, no serve
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { Contract, JsonRpcProvider, id as keccakId } from 'ethers';

const CC3 = process.env.CC3_RPC_URL ?? 'https://rpc.cc3-testnet.creditcoin.network';
const PORT = Number(process.env.INDEXER_PORT ?? 8787);
const POLL_MS = Number(process.env.INDEXER_POLL_MS ?? 15_000); // one CC3 block

const cc3 = JSON.parse(readFileSync('deployments/cc3-testnet.json', 'utf8'));
const provider = new JsonRpcProvider(CC3);

const MARKET_EVENTS = [
  'event MarketCreated(uint256 indexed marketId, address indexed creator, uint64 chainKey, uint256 b, string question)',
  'event Traded(uint256 indexed marketId, address indexed trader, bool indexed yes, bool isBuy, uint256 shares, uint256 amount, uint256 priceYesAfter)',
  'event Settled(uint256 indexed marketId, bool outcome, address indexed resolverCaller, uint256 bounty)',
  'event Claimed(uint256 indexed marketId, address indexed user, uint256 payout)',
];
const RESOLVER_EVENTS = [
  'event SpecRegistered(uint256 indexed marketId, uint64 chainKey, address emitter, bytes32 topic0)',
  'event MarketResolved(uint256 indexed marketId, bool indexed outcome, address indexed resolver, uint64 sourceBlock, int256 operand)',
  'event SettledNoByTimeout(uint256 indexed marketId, uint64 attestedHeight)',
];

const marketC = new Contract(cc3.CruxMarket, MARKET_EVENTS, provider);
const resolverC = new Contract(cc3.CruxAttestedResolver, RESOLVER_EVENTS, provider);

const db = new DatabaseSync(process.env.INDEXER_DB ?? 'indexer/crux.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
  CREATE TABLE IF NOT EXISTS markets (
    marketId INTEGER PRIMARY KEY, creator TEXT, chainKey INTEGER, b TEXT,
    question TEXT, createdBlock INTEGER,
    emitter TEXT, topic0 TEXT,
    settled INTEGER DEFAULT 0, outcome INTEGER, resolvedBy TEXT,
    sourceBlock INTEGER, operand TEXT, settledVia TEXT
  );
  CREATE TABLE IF NOT EXISTS trades (
    txHash TEXT, logIndex INTEGER, marketId INTEGER, trader TEXT,
    yes INTEGER, isBuy INTEGER, shares TEXT, amount TEXT, priceYesAfter TEXT,
    block INTEGER, PRIMARY KEY (txHash, logIndex)
  );
  CREATE INDEX IF NOT EXISTS trades_market ON trades(marketId);
`);

const getMeta = (k: string): string | null =>
  (db.prepare('SELECT v FROM meta WHERE k=?').get(k) as any)?.v ?? null;
const setMeta = (k: string, v: string) =>
  db.prepare('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, v);

const S = (x: unknown) => (typeof x === 'bigint' ? x.toString() : String(x));

/**
 * One `getLogs` per page covering BOTH contracts, decoded locally.
 *
 * The obvious version calls queryFilter once per event type, which is seven
 * RPC round-trips per page — over a 50k-block backfill that is hundreds of
 * calls and minutes of wall time. Fetching the address range once and
 * dispatching on topic0 makes it one.
 */
const IFACES = [marketC.interface, resolverC.interface];

function decode(log: { topics: readonly string[]; data: string }) {
  for (const iface of IFACES) {
    const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    if (parsed) return parsed;
  }
  return null;
}

async function sync(): Promise<void> {
  const head = await provider.getBlockNumber();
  let from = Number(getMeta('syncedTo') ?? cc3.deployedAtBlock);
  const PAGE = 10_000;

  while (from <= head) {
    const to = Math.min(from + PAGE, head);
    const logs = await provider.getLogs({
      address: [cc3.CruxMarket, cc3.CruxAttestedResolver],
      fromBlock: from,
      toBlock: to,
    });

    for (const log of logs) {
      const ev = decode(log);
      if (!ev) continue;
      const a = ev.args as any;

      switch (ev.name) {
        case 'MarketCreated':
          db.prepare(
            `INSERT INTO markets(marketId,creator,chainKey,b,question,createdBlock)
             VALUES(?,?,?,?,?,?)
             ON CONFLICT(marketId) DO UPDATE SET creator=excluded.creator,
               chainKey=excluded.chainKey, b=excluded.b, question=excluded.question,
               createdBlock=excluded.createdBlock`,
          ).run(Number(a.marketId), a.creator, Number(a.chainKey), S(a.b), a.question, log.blockNumber);
          break;
        // Upsert, not update. SpecRegistered is emitted by the resolver in the
        // SAME transaction as MarketCreated, and carries a LOWER log index, so
        // it is processed first — an UPDATE here finds no row and silently does
        // nothing, leaving emitter and topic0 null forever. Every writer below
        // upserts for the same reason: log order within a transaction is an
        // implementation detail of the contracts, not a contract with us.
        case 'SpecRegistered':
          db.prepare(
            `INSERT INTO markets(marketId,emitter,topic0) VALUES(?,?,?)
             ON CONFLICT(marketId) DO UPDATE SET emitter=excluded.emitter, topic0=excluded.topic0`,
          ).run(Number(a.marketId), a.emitter, a.topic0);
          break;
        case 'Traded':
          db.prepare(
            `INSERT INTO trades(txHash,logIndex,marketId,trader,yes,isBuy,shares,amount,priceYesAfter,block)
             VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(txHash,logIndex) DO NOTHING`,
          ).run(log.transactionHash, log.index, Number(a.marketId), a.trader, a.yes ? 1 : 0,
                a.isBuy ? 1 : 0, S(a.shares), S(a.amount), S(a.priceYesAfter), log.blockNumber);
          break;
        case 'MarketResolved':
          db.prepare(
            `INSERT INTO markets(marketId,settled,outcome,resolvedBy,sourceBlock,operand,settledVia)
             VALUES(?,1,?,?,?,?,'proof')
             ON CONFLICT(marketId) DO UPDATE SET settled=1, outcome=excluded.outcome,
               resolvedBy=excluded.resolvedBy, sourceBlock=excluded.sourceBlock,
               operand=excluded.operand, settledVia='proof'`,
          ).run(Number(a.marketId), a.outcome ? 1 : 0, a.resolver, Number(a.sourceBlock), S(a.operand));
          break;
        case 'SettledNoByTimeout':
          db.prepare(
            `INSERT INTO markets(marketId,settled,outcome,sourceBlock,settledVia)
             VALUES(?,1,0,?,'timeout')
             ON CONFLICT(marketId) DO UPDATE SET settled=1, outcome=0,
               sourceBlock=excluded.sourceBlock, settledVia='timeout'`,
          ).run(Number(a.marketId), Number(a.attestedHeight));
          break;
      }
    }

    setMeta('syncedTo', String(to + 1));
    from = to + 1;
  }
}

const routes: Record<string, () => unknown> = {
  '/markets': () => db.prepare('SELECT * FROM markets ORDER BY marketId DESC').all(),
  '/activity': () => db.prepare('SELECT * FROM trades ORDER BY block DESC LIMIT 100').all(),
  '/stats': () => ({
    markets: (db.prepare('SELECT COUNT(*) c FROM markets').get() as any).c,
    settled: (db.prepare('SELECT COUNT(*) c FROM markets WHERE settled=1').get() as any).c,
    byProof: (db.prepare("SELECT COUNT(*) c FROM markets WHERE settledVia='proof'").get() as any).c,
    byTimeout: (db.prepare("SELECT COUNT(*) c FROM markets WHERE settledVia='timeout'").get() as any).c,
    trades: (db.prepare('SELECT COUNT(*) c FROM trades').get() as any).c,
    syncedTo: Number(getMeta('syncedTo') ?? 0),
    contracts: { market: cc3.CruxMarket, resolver: cc3.CruxAttestedResolver },
  }),
};

await sync();
console.log('indexer synced to block', getMeta('syncedTo'));

if (process.argv.includes('--once')) {
  console.log(JSON.stringify(routes['/stats'](), null, 2));
  process.exit(0);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('content-type', 'application/json');

  const m = url.pathname.match(/^\/markets\/(\d+)$/);
  if (m) {
    const row = db.prepare('SELECT * FROM markets WHERE marketId=?').get(Number(m[1]));
    if (!row) { res.statusCode = 404; return res.end('{"error":"no such market"}'); }
    const trades = db.prepare('SELECT * FROM trades WHERE marketId=? ORDER BY block').all(Number(m[1]));
    return res.end(JSON.stringify({ ...row, trades }, null, 2));
  }

  const handler = routes[url.pathname];
  if (!handler) { res.statusCode = 404; return res.end('{"error":"not found"}'); }
  res.end(JSON.stringify(handler(), null, 2));
}).listen(PORT, () => console.log(`indexer API on http://localhost:${PORT}`));

setInterval(() => sync().catch((e) => console.error('sync failed:', e.message)), POLL_MS);

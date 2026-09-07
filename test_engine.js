const {parseFen,legalMoves,applyMove,fen,positionKey,gameStatus,START_FEN}=require('./server');
function assert(x,m){if(!x)throw new Error(m)}
let s=parseFen(START_FEN);assert(legalMoves(s).length===20,'start must have 20 moves');
const afterE4=parseFen('rnbqkbnr/pppppppp/8/8/P7/8/1PPPPPPP/RNBQKBNR b KQkq - 0 1');assert(legalMoves(afterE4).length>0,'legal moves after pawn move');
let k=parseFen('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1');assert(gameStatus(k)==='1-0','mate test');
let p=parseFen('7k/5Q2/7K/8/8/8/8/8 b - - 0 1');assert(gameStatus(p)==='1/2-1/2','stalemate test');
let r=parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');assert(legalMoves(r).some(m=>m.castle==='K')&&legalMoves(r).some(m=>m.castle==='Q'),'castling test');
let ep=parseFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');assert(legalMoves(ep).some(m=>m.ep),'en passant test');
let promo=parseFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');assert(legalMoves(promo).filter(m=>m.promotion).length===4,'promotion test');
function perft(st,d){if(d===0)return 1;let n=0;for(const m of legalMoves(st))n+=perft(applyMove(st,m),d-1);return n}
for(const [d,expected] of [[1,20],[2,400],[3,8902]])assert(perft(parseFen(START_FEN),d)===expected,`perft ${d}`);
console.log('SANI CHESS ENGINE TESTS: PASS');

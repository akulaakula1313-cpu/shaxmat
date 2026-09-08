const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const src=path.join(__dirname,'server.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sani-chess-'));
let code=fs.readFileSync(src,'utf8');
code=code.replace("const PLAYER_TIMEOUT=15000,DISCONNECT_GRACE=60*1000,ROOM_TTL=60*60*1000,SESSION_TTL=30*24*60*60*1000,ADMIN_SESSION_TTL=8*60*60*1000;", "const PLAYER_TIMEOUT=50,DISCONNECT_GRACE=200,ROOM_TTL=1000,SESSION_TTL=600000,ADMIN_SESSION_TTL=600000;");
fs.writeFileSync(path.join(tmp,'server.js'),code);
for(const f of ['index.html','client.js','style.css','bg-music.mp3']) fs.copyFileSync(path.join(__dirname,f),path.join(tmp,f));
let port=39000+Math.floor(Math.random()*1000),child,logs='';
function start(){logs='';child=cp.spawn(process.execPath,[path.join(tmp,'server.js')],{env:{...process.env,PORT:String(port),ADMIN_PASSWORD:'TEST_ADMIN_PASS'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d)}
function stop(){return new Promise(r=>{if(!child)return r();const c=child;child=null;c.once('exit',()=>r());c.kill('SIGTERM');setTimeout(()=>r(),500)})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(pathname,method='GET',body,jar=''){const r=await fetch(`http://127.0.0.1:${port}${pathname}`,{method,headers:{'Content-Type':'application/json',...(jar?{Cookie:jar}:{} )},body:body===undefined?undefined:JSON.stringify(body)});let j={};try{j=await r.json()}catch{};const sc=r.headers.get('set-cookie');return {status:r.status,j,cookie:sc?sc.split(';')[0]:jar,headers:r.headers};}
function assert(x,m){if(!x)throw new Error(m)}
(async()=>{
 try{
  start();
  for(let i=0;i<80;i++){try{if((await req('/api/health')).j.ok)break}catch{} await sleep(15)}
  const h=await req('/api/health'); assert(h.status===200&&h.j.ok,'health'); assert(h.headers.get('x-content-type-options')==='nosniff','security headers');
  const home=await req('/'); assert(home.status===200,'home'); const css=await req('/style.css'); assert(css.status===200,'css'); const music=await req('/bg-music.mp3'); assert(music.status===200,'music');
  let a=await req('/api/auth','POST',{name:'Alpha'}); assert(a.j.ok,'auth Alpha'); const c1=a.cookie;
  let b=await req('/api/auth','POST',{name:'Beta'}); assert(b.j.ok,'auth Beta'); const c2=b.cookie;
  let s=await req('/api/state','GET',undefined,c1); assert(s.j.user.name==='Alpha','state'); const id1=s.j.user.id;
  let rn=await req('/api/profile/name','POST',{name:'AlphaNew'},c1); assert(rn.j.user.name==='AlphaNew'&&rn.j.user.chips===100000,'rename');
  let buy=await req('/api/shop/buy','POST',{type:'board',itemId:'emerald'},c1); assert(buy.j.user.chips===70000,'shop debit');
  let sel=await req('/api/shop/select','POST',{type:'board',itemId:'emerald'},c1); assert(sel.j.user.inventory.selectedBoard==='emerald','shop select');
  let bot=await req('/api/bot/start','POST',{stake:1000,level:2},c1); assert(bot.j.ok,'bot start');
  let bm=await req('/api/bot/move','POST',{gameId:bot.j.gameId,from:12,to:28},c1); assert(bm.j.ok&&bm.j.moves.length>=1,'bot move');
  let al=await req('/api/room/create','POST',{stake:1000},c1); assert(al.j.ok,'room create'); const room=al.j.room.id,uid1=al.j.uid;
  let bj=await req('/api/room/join','POST',{roomId:room},c2); assert(bj.j.ok,'room join'); const uid2=bj.j.uid;
  let sy=await req(`/api/room/sync?roomId=${room}&uid=${uid2}`,'GET',undefined,c2); assert(sy.j.room.status==='playing','online playing');
  let off=await req('/api/room/draw','POST',{roomId:room,uid:uid1},c1); assert(off.j.ok&&off.j.room.drawOffer,'draw offer');
  let dec=await req('/api/room/draw-response','POST',{roomId:room,uid:uid2,answer:'decline'},c2); assert(dec.j.ok&&!dec.j.room.drawOffer,'draw decline');
  let chat=await req('/api/room/chat','POST',{roomId:room,uid:uid1,text:'Привет <x>'},c1); assert(chat.j.ok,'chat');
  sy=await req(`/api/room/sync?roomId=${room}&uid=${uid2}`,'GET',undefined,c2); assert(sy.j.room.chat[0].name==='AlphaNew'&&sy.j.room.chat[0].text==='Привет x','chat sanitize/name');
  // Persist active room + sessions across a server restart.
  await stop(); start(); for(let i=0;i<80;i++){try{if((await req('/api/health')).j.ok)break}catch{} await sleep(15)}
  let restored=await req(`/api/room/sync?roomId=${room}&uid=${uid2}`,'GET',undefined,c2); assert(restored.j.room.status==='playing'&&restored.j.room.selfSide==='b','room persisted');
  let stateAfterRestart=await req('/api/state','GET',undefined,c1); assert(stateAfterRestart.j.user.name==='AlphaNew','session persisted');
  // Manual leave = immediate loss + full bank to opponent + loss stat.
  let beforeLeave=stateAfterRestart.j.user.chips;
  let lv=await req('/api/room/leave','POST',{roomId:room,uid:uid1},c1); assert(lv.j.room.status==='finished'&&lv.j.room.winner==='b','manual leave');
  let s2=await req('/api/state','GET',undefined,c2); assert(s2.j.user.chips===101000,'manual leave payout');
  let s1=await req('/api/state','GET',undefined,c1); assert(s1.j.user.losses===1,'manual leave loss stat'); assert(s1.j.user.chips===beforeLeave,'manual leave stake already deducted');
  let again=await req('/api/room/leave','POST',{roomId:room,uid:uid1},c1); assert(again.status===400,'finished leave rejected safely');
  // Draw refunds both sides.
  let alDraw=await req('/api/room/create','POST',{stake:250},c1); const rd=alDraw.j.room.id,ud1=alDraw.j.uid; let bd=await req('/api/room/join','POST',{roomId:rd},c2); const ud2=bd.j.uid; let beforeDraw1=(await req('/api/state','GET',undefined,c1)).j.user.chips; let beforeDraw2=(await req('/api/state','GET',undefined,c2)).j.user.chips;
  await req('/api/room/draw','POST',{roomId:rd,uid:ud1},c1); let adraw=await req('/api/room/draw-response','POST',{roomId:rd,uid:ud2,answer:'accept'},c2); assert(adraw.j.room.result==='1/2-1/2','draw accept'); let afterDraw1=(await req('/api/state','GET',undefined,c1)).j.user.chips,afterDraw2=(await req('/api/state','GET',undefined,c2)).j.user.chips; assert(afterDraw1===beforeDraw1+250&&afterDraw2===beforeDraw2+250,'draw refund both');
  // Disconnect grace: after timeout the player gets a deadline; after expiry opponent wins and receives the full bank.
  let al2=await req('/api/room/create','POST',{stake:500},c1); const r2=al2.j.room.id,u12=al2.j.uid; let bj2=await req('/api/room/join','POST',{roomId:r2},c2); const u22=bj2.j.uid; let before=(await req('/api/state','GET',undefined,c2)).j.user.chips; await sleep(90); let grace=await req(`/api/room/sync?roomId=${r2}&uid=${u22}`,'GET',undefined,c2); assert(grace.j.room.status==='playing'&&grace.j.room.players.some(p=>p.uid===u12&&p.disconnectDeadline),'disconnect grace started'); await sleep(180); let afterSync=await req(`/api/room/sync?roomId=${r2}&uid=${u22}`,'GET',undefined,c2); assert(afterSync.j.room.status==='finished'&&afterSync.j.room.winner==='b','disconnect forfeit'); let after=(await req('/api/state','GET',undefined,c2)).j.user.chips; assert(after===before+1000,'disconnect payout'); let afterAgain=(await req('/api/state','GET',undefined,c2)).j.user.chips; assert(afterAgain===after,'no duplicate disconnect payout');
  // Admin login/rate limit + controls.
  let ad=await req('/api/admin/login','POST',{password:'TEST_ADMIN_PASS'}); assert(ad.j.ok,'admin login'); const ac=ad.cookie;
  let players=await req('/api/admin/players','GET',undefined,ac); assert(players.j.ok&&players.j.players.length===2,'admin list');
  for(let i=0;i<4;i++) await req('/api/admin/login','POST',{password:'bad'}); let limited=await req('/api/admin/login','POST',{password:'bad'}); assert(limited.status===429,'admin rate limit');
  let alphaBeforeAdmin=(await req('/api/state','GET',undefined,c1)).j.user.chips; let adminRename=await req('/api/admin/action','POST',{action:'rename',userId:id1,name:'AlphaAdmin'},ac); assert(adminRename.j.user.name==='AlphaAdmin'&&adminRename.j.user.chips===alphaBeforeAdmin,'admin rename preserve');
  let set=await req('/api/admin/action','POST',{action:'set_chips',userId:id1,amount:123456},ac); assert(set.j.user.chips===123456,'admin set chips');
  let vip=await req('/api/admin/action','POST',{action:'vip',userId:id1,value:true},ac); assert(vip.j.user.vip,'admin vip');
  let hintStart=Date.now(); let hint=await req('/api/hint','POST',{fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'},c1); assert(hint.j.ok&&hint.j.available,'vip hint'); assert(Date.now()-hintStart<2000,'hint speed');
  let ban=await req('/api/admin/action','POST',{action:'ban',userId:id1,value:true},ac); assert(ban.j.user.banned,'admin ban'); let blocked=await req('/api/state','GET',undefined,c1); assert(blocked.status===403,'ban blocks session');
  let unban=await req('/api/admin/action','POST',{action:'ban',userId:id1,value:false},ac); assert(!unban.j.user.banned,'admin unban');
  // Leaderboard must not expose internal account IDs.
  let lb=await req('/api/leaderboard'); assert(lb.j.ok&&lb.j.players.length>=2&&lb.j.players[0].id===undefined,'leaderboard privacy');
  // Admin deletion of an active player cancels the room and refunds the bank exactly once.
  let freshA=await req('/api/auth','POST',{name:'Gamma'}); const c3=freshA.cookie; let freshB=await req('/api/auth','POST',{name:'Delta'}); const c4=freshB.cookie;
  let rr=await req('/api/room/create','POST',{stake:300},c3),r3=rr.j.room.id,u3=rr.j.uid; let jj=await req('/api/room/join','POST',{roomId:r3},c4),u4=jj.j.uid; let beforeD=(await req('/api/state','GET',undefined,c4)).j.user.chips; let del=await req('/api/admin/action','POST',{action:'delete',userId:freshA.j.user.id},ac); assert(del.j.ok,'admin delete'); let afterD=await req('/api/state','GET',undefined,c4); assert(afterD.j.user.chips===beforeD+300,'admin delete refund');
  let botCancel=await req('/api/bot/start','POST',{stake:600,level:1},c2); assert(botCancel.j.ok,'bot cancel start'); let botBeforeCancel=(await req('/api/state','GET',undefined,c2)).j.user.chips; await sleep(2500); let botAfterCancel=(await req('/api/state','GET',undefined,c2)).j.user.chips; assert(botAfterCancel===botBeforeCancel+600,'expired bot refund');
  console.log('SANI CHESS FULL INTEGRATION TESTS: PASS');
 }catch(e){console.error('SANI CHESS FULL INTEGRATION TESTS: FAIL',e.message);console.error(logs);process.exitCode=1}
 finally{await stop();fs.rmSync(tmp,{recursive:true,force:true})}
})();

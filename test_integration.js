const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const src=path.join(__dirname,'server.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sani-chess-'));
let code=fs.readFileSync(src,'utf8');
code=code.replace("const PORT=Number(process.env.PORT||3000),ROOT=__dirname,PUBLIC=path.join(ROOT,'public'),DB_FILE=path.join(ROOT,'db.json');", "const PORT=Number(process.env.PORT||3000),ROOT=__dirname,PUBLIC=path.join(ROOT,'public'),DB_FILE=path.join(ROOT,'db.json');");
code=code.replace("const PLAYER_TIMEOUT=15000,DISCONNECT_GRACE=60*1000,ROOM_TTL=60*60*1000,SESSION_TTL=30*24*60*60*1000,ADMIN_SESSION_TTL=8*60*60*1000;", "const PLAYER_TIMEOUT=50,DISCONNECT_GRACE=200,ROOM_TTL=5000,SESSION_TTL=60000,ADMIN_SESSION_TTL=60000;");
fs.writeFileSync(path.join(tmp,'server.js'),code);fs.copyFileSync(path.join(__dirname,'index.html'),path.join(tmp,'index.html'));fs.copyFileSync(path.join(__dirname,'client.js'),path.join(tmp,'client.js'));fs.copyFileSync(path.join(__dirname,'style.css'),path.join(tmp,'style.css'));
const port=39000+Math.floor(Math.random()*1000);
const child=cp.spawn(process.execPath,[path.join(tmp,'server.js')],{env:{...process.env,PORT:String(port),ADMIN_PASSWORD:'TEST_ADMIN_PASS'},stdio:['ignore','pipe','pipe']});
let logs=''; child.stdout.on('data',d=>logs+=d); child.stderr.on('data',d=>logs+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(path,method='GET',body,jar=''){const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{'Content-Type':'application/json',...(jar?{Cookie:jar}:{} )},body:body===undefined?undefined:JSON.stringify(body)});let j={};try{j=await r.json()}catch{};const sc=r.headers.get('set-cookie');return {status:r.status,j,cookie:sc?sc.split(';')[0]:jar};}
function assert(x,m){if(!x)throw new Error(m)}
(async()=>{
 try{
  for(let i=0;i<50;i++){try{if((await req('/api/health')).j.ok)break}catch{} await sleep(20)}
  let a=await req('/api/auth','POST',{name:'Alpha'}); assert(a.j.ok,'auth Alpha'); const c1=a.cookie;
  let b=await req('/api/auth','POST',{name:'Beta'}); assert(b.j.ok,'auth Beta'); const c2=b.cookie;
  let s=await req('/api/state','GET',undefined,c1); assert(s.j.user.name==='Alpha','state'); const id1=s.j.user.id;
  let rn=await req('/api/profile/name','POST',{name:'AlphaNew'},c1); assert(rn.j.user.name==='AlphaNew','rename'); assert(rn.j.user.chips===100000,'rename preserved chips');
  let buy=await req('/api/shop/buy','POST',{type:'board',itemId:'emerald'},c1); assert(buy.j.user.chips===70000,'shop debit');
  let sel=await req('/api/shop/select','POST',{type:'board',itemId:'emerald'},c1); assert(sel.j.user.inventory.selectedBoard==='emerald','shop select');
  let bot=await req('/api/bot/start','POST',{stake:1000,level:2},c1); assert(bot.j.ok,'bot start');
  let bm=await req('/api/bot/move','POST',{gameId:bot.j.gameId,from:12,to:28},c1); assert(bm.j.ok && bm.j.moves.length>=1,'bot move');
  let al=await req('/api/room/create','POST',{stake:1000},c1); assert(al.j.ok,'room create'); const room=al.j.room.id, uid1=al.j.uid;
  let bj=await req('/api/room/join','POST',{roomId:room},c2); assert(bj.j.ok,'room join'); const uid2=bj.j.uid;
  let off=await req('/api/room/draw','POST',{roomId:room,uid:uid1},c1); assert(off.j.ok && off.j.room.drawOffer,'draw offer');
  let dec=await req('/api/room/draw-response','POST',{roomId:room,uid:uid2,answer:'decline'},c2); assert(dec.j.ok && !dec.j.room.drawOffer,'draw decline');
  let chat=await req('/api/room/chat','POST',{roomId:room,uid:uid1,text:'Привет <x>'},c1); assert(chat.j.ok,'chat');
  let sy=await req(`/api/room/sync?roomId=${room}&uid=${uid2}`,'GET',undefined,c2); assert(sy.j.room.chat[0].name==='AlphaNew' && sy.j.room.chat[0].text==='Привет x','chat sanitize/name');
  let alDraw=await req('/api/room/create','POST',{stake:250},c1); const rd=alDraw.j.room.id, ud1=alDraw.j.uid; let bd=await req('/api/room/join','POST',{roomId:rd},c2); const ud2=bd.j.uid; let beforeDraw=(await req('/api/state','GET',undefined,c1)).j.user.chips; let od=await req('/api/room/draw','POST',{roomId:rd,uid:ud1},c1); assert(od.j.room.drawOffer,'draw offer 2'); let adraw=await req('/api/room/draw-response','POST',{roomId:rd,uid:ud2,answer:'accept'},c2); assert(adraw.j.room.result==='1/2-1/2','draw accept'); let afterDraw=(await req('/api/state','GET',undefined,c1)).j.user.chips; assert(afterDraw===beforeDraw+250,'draw refund p1'); let res=await req('/api/room/resign','POST',{roomId:room,uid:uid1},c1); assert(res.j.ok && res.j.room.winner==='b' && res.j.room.status==='finished','resign');
  let s2=await req('/api/state','GET',undefined,c2); assert(s2.j.user.chips===101000,'resign payout');
  let alLeave=await req('/api/room/create','POST',{stake:400},c1); const rl=alLeave.j.room.id, ul1=alLeave.j.uid; let bl=await req('/api/room/join','POST',{roomId:rl},c2); const ul2=bl.j.uid; let leaveBefore=(await req('/api/state','GET',undefined,c2)).j.user.chips; let lv=await req('/api/room/leave','POST',{roomId:rl,uid:ul1},c1); assert(lv.j.room.status==='finished' && lv.j.room.winner==='b','manual leave'); let leaveAfter=(await req('/api/state','GET',undefined,c2)).j.user.chips; assert(leaveAfter===leaveBefore+800,'manual leave payout'); let al2=await req('/api/room/create','POST',{stake:500},c1); const r2=al2.j.room.id, u12=al2.j.uid;
  let bj2=await req('/api/room/join','POST',{roomId:r2},c2); const u22=bj2.j.uid; let before=(await req('/api/state','GET',undefined,c2)).j.user.chips;
  await sleep(350); let afterSync=await req(`/api/room/sync?roomId=${r2}&uid=${u22}`,'GET',undefined,c2); assert(afterSync.j.room.status==='finished' && afterSync.j.room.winner==='b','disconnect forfeit');
  let after=(await req('/api/state','GET',undefined,c2)).j.user.chips; assert(after===before+1000,'disconnect payout');
  let ad=await req('/api/admin/login','POST',{password:'TEST_ADMIN_PASS'}); assert(ad.j.ok,'admin login'); const ac=ad.cookie;
  let players=await req('/api/admin/players','GET',undefined,ac); assert(players.j.ok && players.j.players.length===2,'admin list');
  let adminRename=await req('/api/admin/action','POST',{action:'rename',userId:id1,name:'AlphaAdmin'},ac); assert(adminRename.j.user.name==='AlphaAdmin' && adminRename.j.user.chips===67100,'admin rename preserve');
  let set=await req('/api/admin/action','POST',{action:'set_chips',userId:id1,amount:123456},ac); assert(set.j.user.chips===123456,'admin set chips');
  let vip=await req('/api/admin/action','POST',{action:'vip',userId:id1,value:true},ac); assert(vip.j.user.vip,'admin vip');
  let ban=await req('/api/admin/action','POST',{action:'ban',userId:id1,value:true},ac); assert(ban.j.user.banned,'admin ban');
  let unban=await req('/api/admin/action','POST',{action:'ban',userId:id1,value:false},ac); assert(!unban.j.user.banned,'admin unban');
  console.log('SANI CHESS FULL INTEGRATION TESTS: PASS');
 }catch(e){console.error('SANI CHESS FULL INTEGRATION TESTS: FAIL',e.message);console.error(logs);process.exitCode=1}
 finally{child.kill('SIGTERM');setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),50)}
})();

  // ...продолжение main() (то, что могло обрезаться)
  console.log(`MongoDB: users=${Object.keys(db.users).length}, sessions=${Object.keys(db.sessions).length}, rooms=${Object.keys(db.rooms).length}, botGames=${Object.keys(db.botGames).length}`);
}

// === Таймеры ===
function startTimers(){
  setInterval(()=>{
    for(const room of rooms.values()){
      tickClock(room);
      checkRoomDisconnects(room);
      if(room.status==='waiting'){
        const owner=Object.values(room.players)[0];
        if(owner&&now()-owner.lastSeen>PLAYER_TIMEOUT&&!owner.disconnectDeadline){owner.disconnectDeadline=owner.lastSeen+DISCONNECT_GRACE;saveDB()}
        if(owner&&owner.disconnectDeadline&&now()>=owner.disconnectDeadline){room.status='finished';room.result='cancelled';room.leavePlayer=owner.name;settleDraw(room)}
      }
      if(now()-room.lastActivity>ROOM_TTL){
        if(!room.paid){room.status='finished';room.result='cancelled';settleDraw(room)}
        rooms.delete(room.id);saveDB()
      }
    }
    for(const [id,g] of botGames){if(now()-Number(g.lastActivity||g.createdAt)>ROOM_TTL){settleBot(g,'cancelled');botGames.delete(id);saveDB()}}
    for(const [t,s] of sessions){if(now()-s.lastSeen>SESSION_TTL)sessions.delete(t)}
    for(const [t,s] of adminSessions){if(now()-s.lastSeen>ADMIN_SESSION_TTL)adminSessions.delete(t)}
  },1000);
}

// === Запуск ===
async function main(){
  try{await initMongo();}catch(e){console.error('Ошибка подключения к MongoDB:',e.message);console.warn('Падаю на db.json (fallback).');useMongo=false;}
  db=await loadDB();
  db.sessions=db.sessions&&typeof db.sessions==='object'?db.sessions:{};
  db.rooms=db.rooms&&typeof db.rooms==='object'?db.rooms:{};
  db.botGames=db.botGames&&typeof db.botGames==='object'?db.botGames:{};
  for(const u of Object.values(db.users)){u.wins=Number(u.wins||0);u.losses=Number(u.losses||0);u.draws=Number(u.draws||0);u.rating=Number(u.rating||1000)}

  // восстанавливаем сессии/комнаты/ботов
  for(const [key,s] of Object.entries(db.sessions)){if(s&&s.userId&&s.createdAt)sessions.set(key,{userId:s.userId,createdAt:Number(s.createdAt),lastSeen:Number(s.lastSeen||s.createdAt)})}
  for(const [id,r] of Object.entries(db.rooms)){if(r&&r.id&&r.players&&r.fen){r.id=String(r.id);r.players=r.players||{};r.chat=Array.isArray(r.chat)?r.chat.slice(-30):[];r.history=Array.isArray(r.history)&&r.history.length?r.history:[positionKey(parseFen(r.fen))];r.revision=Number(r.revision||0);r.moves=Array.isArray(r.moves)?r.moves.slice(-500):[];r.lastTick=Number(r.lastTick||now());r.lastActivity=Number(r.lastActivity||now());r.paid=!!r.paid;rooms.set(id,r)}}
  for(const [id,g] of Object.entries(db.botGames)){if(g&&g.id&&g.userId&&g.fen){g.id=String(g.id);g.history=Array.isArray(g.history)&&g.history.length?g.history:[positionKey(parseFen(g.fen))];botGames.set(id,g)}}

  // чистим пустых игроков
  try{await cleanupEmptyUsers();}catch(e){console.error('cleanup error:',e.message);}

  startTimers();
  http.createServer(route).listen(PORT,'0.0.0.0',()=>console.log(`SANI CHESS server: http://0.0.0.0:${PORT}${useMongo?' (MongoDB)':' (file)'}`));
}

if(require.main===module){main().catch(e=>{console.error(e);process.exit(1)});}

async function shutdown(sig){
  console.log(`\n${sig}: сохраняю в Mongo...`);
  try{await flushToMongo();}catch(e){console.error(e.message);}
  try{await mongoClient?.close();}catch{}
  process.exit(0);
}
process.on('SIGINT',()=>shutdown('SIGINT'));
process.on('SIGTERM',()=>shutdown('SIGTERM'));

module.exports={parseFen,fen,legalMoves,applyMove,positionKey,gameStatus,START_FEN,checkRoomDisconnects};
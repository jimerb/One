import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import jsQR from 'jsqr';

async function unusedPort() {
  const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));return port;
}
function decodeInvitation(svg) {
  // Rasterize the actual served horizontal SVG runs, then use an independent QR decoder.
  const size=Number(svg.match(/viewBox="0 0 (\d+) \d+"/u)[1]),scale=8,padding=16,width=size*scale+padding*2;
  const rgba=new Uint8ClampedArray(width*width*4);rgba.fill(255);
  const path=svg.match(/<path stroke="[^"]+" d="([^"]+)"/u)[1],tokens=path.match(/[Mmh]|-?\d+(?:\.\d+)?/gu);
  let x=0,y=0;
  for(let i=0;i<tokens.length;) {
    const command=tokens[i++];
    if(command==='M'){x=Number(tokens[i++]);y=Number(tokens[i++]);}
    else if(command==='m'){x+=Number(tokens[i++]);y+=Number(tokens[i++]);}
    else if(command==='h') {
      const length=Number(tokens[i++]);
      for(let row=0;row<scale;row++)for(let column=0;column<length*scale;column++) {
        const at=((Math.floor(y)*scale+row+padding)*width+x*scale+column+padding)*4;
        rgba[at]=27;rgba[at+1]=41;rgba[at+2]=37;
      }
      x+=length;
    }else throw new Error(`Unexpected SVG command ${command}`);
  }
  return jsQR(rgba,width,width)?.data;
}
function peer(base,key) {
  const socket=new WebSocket(`${base.replace(/^http/u,'ws')}/ws?token=${key}`,{origin:base});const inbox=[];
  socket.on('message',raw=>inbox.push(JSON.parse(raw.toString())));socket.on('error',()=>{});
  return {socket,send:value=>socket.send(JSON.stringify(value)),async wait(predicate) {
    const end=Date.now()+3000;
    while(Date.now()<end) {const index=inbox.findIndex(predicate);if(index!==-1)return inbox.splice(index,1)[0];await delay(10);}
    throw new Error('Expected live table update was not received.');
  }};
}

test('local HTTP, QR invitations, private WebSocket hands and host controls work together', async t => {
  const port=await unusedPort(),base=`http://127.0.0.1:${port}`;
  const server=spawn(process.execPath,['app/server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),ONE_PUBLIC_URL:base},stdio:['ignore','pipe','pipe']});
  let errors='';server.stderr.on('data',chunk=>{errors+=chunk;});
  t.after(async()=>{server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));assert.equal(errors,'');});
  const ready=new Promise((resolve,reject)=>{server.stdout.on('data',chunk=>{if(chunk.toString().includes('One is ready'))resolve();});server.once('error',reject);server.once('exit',code=>reject(new Error(`Server exited ${code}: ${errors}`)));});
  await ready;
  const request=async(path,data,key)=> {
    const response=await fetch(`${base}${path}`,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(key?{Authorization:`Bearer ${key}`}:{})},...(data?{body:JSON.stringify(data)}:{})});
    return {status:response.status,body:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text()};
  };
  await t.test('port and static files are correct; research and raw assets stay private',async()=>{
    assert.deepEqual((await request('/api/health')).body,{ok:true,game:'One',port});assert.equal((await request('/api/config')).body.inviteBase,base);
    assert.match((await request('/')).body,/One — Pull up a chair/u);assert.match((await request('/styles.css')).body,/color-scheme:dark/u);
    for(const path of ['/app/engine.js','/README.md','/source/backend-classes.jar','/evidence/disc/manifest.json'])assert.equal((await request(path)).status,404);
    assert.equal((await request('/api/session')).status,400);
  });
  const created=await request('/api/rooms',{name:'Casey',humanCount:2,delay:4,lobbySeconds:120,roundLimit:1,scoreLimit:0});assert.equal(created.status,201);const host=created.body;
  const guest=(await request(`/api/rooms/${host.code}/join`,{name:'Robin'})).body;
  await t.test('the displayed QR decodes to the actual named-join route without a seat token',async()=>{
    const qr=await request(`/api/rooms/${host.code}/qr.svg`);assert.equal(qr.status,200);assert.equal(decodeInvitation(qr.body),`${base}/r/${host.code}`);
    const info=(await request(`/api/rooms/${host.code}`)).body;assert.equal(info.joined,2);assert.ok(!('token'in info));assert.ok(!('game'in info));
  });
  const a=peer(base,host.token),b=peer(base,guest.token);t.after(()=>{a.socket.terminate();b.socket.terminate();});
  let hostView=(await a.wait(message=>message.type==='state')).state;await b.wait(message=>message.type==='state');
  await t.test('host starts, guest cannot stop, and each player receives a different private hand',async()=>{
    b.send({type:'host',action:{type:'start'}});assert.match((await b.wait(message=>message.type==='error')).message,/Only the host/u);
    a.send({type:'host',action:{type:'start'}});hostView=(await a.wait(message=>message.type==='state'&&message.state.game)).state;const guestView=(await b.wait(message=>message.type==='state'&&message.state.game)).state;
    assert.equal(hostView.game.hand.length,7);assert.equal(guestView.game.hand.length,7);assert.equal(hostView.game.players.length,4);
    assert.ok(hostView.game.hand.every(card=>!guestView.game.hand.some(other=>other.id===card.id)));
    for(const view of [hostView,guestView]) {assert.ok(!('seed'in view.game));assert.ok(!('observerHands'in view.game));assert.ok(view.game.players.every(player=>!('hand'in player)));assert.ok(view.seats.every(seat=>!('token'in seat)));}
    b.send({type:'host',action:{type:'stop'}});assert.match((await b.wait(message=>message.type==='error')).message,/Only the host/u);
  });
  await t.test('pause and resume synchronize; reload fetches the same seat; stop cancels play',async()=>{
    a.send({type:'host',action:{type:'pause'}});const frozen=(await a.wait(message=>message.type==='state'&&message.state.paused)).state;await b.wait(message=>message.type==='state'&&message.state.paused);
    assert.equal((await request('/api/session',null,host.token)).body.game.viewer,0);assert.deepEqual((await request('/api/session',null,guest.token)).body.game.hand,(await request('/api/session',null,guest.token)).body.game.hand);
    b.send({type:'action',action:{type:'draw'},requestId:'frozen',revision:frozen.game.revision});assert.match((await b.wait(message=>message.type==='error')).message,/paused/u);
    a.send({type:'host',action:{type:'pause'}});await a.wait(message=>message.type==='state'&&!message.state.paused);
    a.send({type:'host',action:{type:'stop'}});const stopped=(await a.wait(message=>message.type==='state'&&message.state.status==='stopped')).state;await delay(100);
    assert.equal((await request('/api/session',null,host.token)).body.game.revision,stopped.game.revision);
  });
  await t.test('invalid tokens and unrelated browser origins cannot open a live connection',async()=>{
    for(const [key,origin] of [['invalid',base],[host.token,'http://unrelated.example']]) {
      const socket=new WebSocket(`${base.replace(/^http/u,'ws')}/ws?token=${key}`,{origin});socket.on('error',()=>{});
      const status=await new Promise(resolve=>{socket.on('unexpected-response',(_request,response)=>{response.resume();resolve(response.statusCode);socket.terminate();});});assert.equal(status,401);
    }
  });
  await t.test('human-room seeds cannot be selected by an external client',async()=>{
    const zero=(await request('/api/rooms',{humanCount:0,delay:4,seed:123})).body;const snapshot=(await request('/api/session',null,zero.token)).body;
    assert.notEqual(snapshot.game.seed,123);const observer=peer(base,zero.token);await observer.wait(message=>message.type==='state');observer.send({type:'host',action:{type:'stop'}});await observer.wait(message=>message.type==='state'&&message.state.status==='stopped');observer.socket.terminate();
  });
});

import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const root = dirname(fileURLToPath(import.meta.url));
const now = () => Math.floor(Date.now()/1000);
const demo = [['laugh',2],['know',2],['laugh',3],['know',1],['inside',0],['inside',1]];
const cards = JSON.parse(readFileSync(resolve(root,'private/cards.json'),'utf8'));
const publicFiles = new Map([['/','index.html'],['/game.js','game.js'],['/miniapp.js','miniapp.js']]);

function hmac(key,value) { return createHmac('sha256',key).update(value).digest(); }
function equal(a,b) {
  if (typeof a!=='string'||typeof b!=='string') return false;
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
export function telegramUser(raw, token) {
  if (typeof raw!=='string' || raw.length>16384) return null;
  const params=new URLSearchParams(raw), hash=params.get('hash');
  if (!hash || new Set(params.keys()).size!==params.size) return null;
  params.delete('hash');params.sort();
  const data=Array.from(params,([key,value])=>key+'='+value).join('\n');
  if (!equal(hmac(hmac('WebAppData',token),data).toString('hex'),hash)) return null;
  const time=Number(params.get('auth_date'));
  if (!Number.isSafeInteger(time)||time<now()-600||time>now()+30) return null;
  try {
    const user=JSON.parse(params.get('user'));
    return Number.isSafeInteger(user?.id)&&user.id>0 ? String(user.id) : null;
  } catch { return null; }
}
function fail(code, message) { throw Object.assign(new Error(message),{status:code}); }
export function openStore(file) {
  if(file!==':memory:') mkdirSync(dirname(file),{recursive:true});
  const db=new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS orders(
      id TEXT PRIMARY KEY, buyer TEXT NOT NULL, price INTEGER NOT NULL, terms TEXT NOT NULL,
      created INTEGER NOT NULL, link TEXT, checkout TEXT, locked_until INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS by_buyer ON orders(buyer,created);
    CREATE TABLE IF NOT EXISTS receipts(
      charge TEXT PRIMARY KEY, buyer TEXT NOT NULL, order_id TEXT NOT NULL, refunded INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS entitlement ON receipts(buyer,refunded);
    CREATE TABLE IF NOT EXISTS read_limits(buyer TEXT PRIMARY KEY, since INTEGER NOT NULL, reads INTEGER NOT NULL);`);
  return db;
}
export function config(env) {
  const url=new URL(env.APP_URL);
  if (url.protocol!=='https:' || url.pathname!=='/' || url.search || url.hash || url.username || url.password)
    throw Error('APP_URL must be a public HTTPS origin');
  if(!/^\d+:[\w-]{24,}$/.test(env.BOT_TOKEN||'')) throw Error('Set BOT_TOKEN in the hosting secret settings');
  if(!/^[a-zA-Z0-9_-]{32,128}$/.test(env.WEBHOOK_SECRET||'')) throw Error('Set WEBHOOK_SECRET to a random secret of 32 or more characters');
  const username=env.BOT_USERNAME||'VdvoemNaLegkeBOT';
  if(!/^[A-Za-z0-9_]{5,32}$/.test(username)) throw Error('Set BOT_USERNAME without @');
  const defaultPrice=env.SUPPORT_CONTACT && env.TERMS_URL ? 236 : 0;
  const price=Number(env.PRICE_STARS ?? defaultPrice);
  if(!Number.isSafeInteger(price)||price<0||price>10000) throw Error('PRICE_STARS must be an integer from 0 to 10000');
  if(price && (!/^@[\w]{5,32}$/.test(env.SUPPORT_CONTACT||'') || !/^https:\/\//.test(env.TERMS_URL||'')))
    throw Error('Sales need SUPPORT_CONTACT and HTTPS TERMS_URL');
  return {origin:url.origin,token:env.BOT_TOKEN,webhook:env.WEBHOOK_SECRET,username,
    price,support:env.SUPPORT_CONTACT||'',terms:env.TERMS_URL||'',test:env.TELEGRAM_TEST==='1'};
}
export function telegramClient(cfg) {
  const base='https://api.telegram.org/bot'+cfg.token+(cfg.test?'/test/':'/');
  return async (method,data) => {
    const response=await fetch(base+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(7500)});
    const reply=await response.json();
    if(!reply.ok) throw Error('Telegram '+method+' failed ('+reply.error_code+')');
    return reply.result;
  };
}
export function application(cfg,db,tg) {
  const key=hmac('vdvoem session v1',cfg.token);
  const owns=buyer=>!!db.prepare('SELECT 1 FROM receipts WHERE buyer=? AND refunded=0 LIMIT 1').get(buyer);
  const getOrder=id=>typeof id==='string'?db.prepare('SELECT * FROM orders WHERE id=?').get(id):null;
  function session(id) {
    const payload=id+'.'+(now()+21600)+'.'+randomBytes(12).toString('hex');
    return payload+'.'+hmac(key,payload).toString('base64url');
  }
  function identity(req) {
    const token=(req.headers.authorization||'').replace(/^Bearer /,'');
    const [id,expiry,nonce,sig,...extra]=token.split('.');
    if(extra.length||!/^\d+$/.test(id)||!/^\d+$/.test(expiry)||Number(expiry)<now()||!nonce) return null;
    return equal(hmac(key,[id,expiry,nonce].join('.')).toString('base64url'),sig)?id:null;
  }
  const requireUser=req=>identity(req)||fail(401,'Открой игру заново через свой Telegram.');
  function allowRead(buyer) {
    const t=now();
    const row=db.prepare(`INSERT INTO read_limits VALUES(?,?,1) ON CONFLICT(buyer) DO UPDATE SET
      reads=CASE WHEN excluded.since-since>=60 THEN 1 ELSE reads+1 END,
      since=CASE WHEN excluded.since-since>=60 THEN excluded.since ELSE since END RETURNING reads`).get(buyer,t);
    if(row.reads>36) fail(429,'Карточки открывались слишком быстро. Попробуй через минуту.');
  }
  async function invoice(buyer, agreed) {
    if(!cfg.price) fail(503,'Продажи пока закрыты.');
    if(agreed!==true) fail(400,'Подтверди условия покупки.');
    if(owns(buyer)) return {paid:true};
    const t=now();
    let order=db.prepare('SELECT * FROM orders WHERE buyer=? AND price=? AND terms=? AND created>? AND id NOT IN (SELECT order_id FROM receipts WHERE buyer=?) ORDER BY created DESC LIMIT 1').get(buyer,cfg.price,cfg.terms,t-1800,buyer);
    if(!order) {
      const id=randomBytes(20).toString('hex');
      db.prepare('INSERT INTO orders(id,buyer,price,terms,created) VALUES(?,?,?,?,?)').run(id,buyer,cfg.price,cfg.terms,t);
      order=getOrder(id);
    }
    if(order.link) return {url:order.link};
    const link=await tg('createInvoiceLink',{title:'VDVOЁМ НАЛЕГКЕ',description:'Разовый доступ ко всем 10 колодам для игры вдвоём с одного Telegram-аккаунта.',
      payload:order.id,provider_token:'',currency:'XTR',prices:[{label:'Полная игра',amount:order.price}]});
    db.prepare('UPDATE orders SET link=? WHERE id=?').run(link,order.id);
    return {url:link};
  }
  function matches(order, buyer, payment) {
    return order && order.buyer===buyer && payment.currency==='XTR' && payment.total_amount===order.price;
  }
  function approve(q) {
    const buyer=String(q.from.id), order=getOrder(q.invoice_payload), t=now();
    if(!matches(order,buyer,q)||owns(buyer)||!cfg.price||order.price!==cfg.price||order.terms!==cfg.terms||
        order.created<t-1800||db.prepare('SELECT 1 FROM receipts WHERE order_id=?').get(order.id)) return false;
    // A second invoice opened for this account must not create another simultaneous charge.
    if(db.prepare('SELECT 1 FROM orders WHERE buyer=? AND locked_until>? AND id<>?').get(buyer,t,order.id)) return false;
    return db.prepare('UPDATE orders SET checkout=?,locked_until=? WHERE id=? AND (locked_until<=? OR checkout=?)')
      .run(q.id,t+600,order.id,t,q.id).changes===1;
  }
  async function update(event) {
    if(event.pre_checkout_query) {
      const q=event.pre_checkout_query, ok=approve(q);
      await tg('answerPreCheckoutQuery',{pre_checkout_query_id:q.id,ok,...(ok?{}:{error_message:'Счёт устарел, уже оплачен или открыт другим аккаунтом. Открой игру через бота.'})}); return;
    }
    const m=event.message;
    if(!m || m.chat?.type!=='private') return;
    const refund=m.refunded_payment, payment=m.successful_payment||refund;
    if(payment) {
      const order=getOrder(payment.invoice_payload),buyer=String(m.chat.id);
      if(!matches(order,buyer,payment) || typeof payment.telegram_payment_charge_id!=='string') {
        console.warn('Payment event requires reconciliation; update_id:',event.update_id); return;
      }
      // A refund received before a retried success must remain effective.
      db.prepare(`INSERT INTO receipts(charge,buyer,order_id,refunded) VALUES(?,?,?,?)
        ON CONFLICT(charge) DO UPDATE SET refunded=MAX(refunded,excluded.refunded)
        WHERE receipts.order_id=excluded.order_id AND receipts.buyer=excluded.buyer`).run(payment.telegram_payment_charge_id,buyer,order.id,refund?1:0);
      db.prepare('UPDATE orders SET locked_until=0 WHERE id=?').run(order.id);
      return;
    }
    const cmd=(m.text||'').split(/[ @]/)[0];
    if(!['/start','/buy','/play','/support','/paysupport','/terms'].includes(cmd))return;
    let text='Игра для двоих, 18+. Попробуйте шесть карт бесплатно или откройте все десять колод.';
    if(cmd==='/support'||cmd==='/paysupport') text=cfg.support?'Поддержка покупок: '+cfg.support+'. Приложи дату и квитанцию из Telegram. Вопросы по покупке решает продавец игры.':'Продажи пока закрыты.';
    if(cmd==='/terms') text=cfg.terms?'Условия покупки: '+cfg.terms:'Продажи пока закрыты.';
    const isGame=['/start','/play','/buy'].includes(cmd);
    await tg('sendMessage',{chat_id:m.chat.id,text,...(isGame?{reply_markup:{inline_keyboard:[[{text:'Открыть игру',web_app:{url:cfg.origin}}]]}}:{})});
  }
  async function body(req, limit) {
    if(!(req.headers['content-type']||'').toLowerCase().startsWith('application/json')) fail(415,'Нужен JSON.');
    const parts=[];let size=0;
    for await(const part of req){size+=part.length;if(size>limit)fail(413,'Слишком большой запрос.');parts.push(part);}
    try {const value=JSON.parse(Buffer.concat(parts).toString());if(!value||typeof value!=='object'||Array.isArray(value)) throw Error();return value;}
    catch { fail(400,'Некорректные данные.'); }
  }
  const publicConfig={demo,price:cfg.price,bot:cfg.username,terms:cfg.terms,support:cfg.support};
  return async function handle(req,res) {
    res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    const json=(code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));};
    try {
      const url=new URL(req.url,'http://localhost'),path=url.pathname;
      if(req.method==='GET'&&publicFiles.has(path)) {
        res.setHeader('Content-Type',path==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8');
        res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'");
        res.end(readFileSync(resolve(root,'public',publicFiles.get(path))));return;
      }
      if(req.method==='POST'&&path==='/telegram/update') {
        if(!equal(req.headers['x-telegram-bot-api-secret-token'],cfg.webhook)) fail(403,'Доступ закрыт.');
        await update(await body(req,256000));return json(200,{ok:true});
      }
      if(req.method==='GET'&&path==='/api/config')return json(200,publicConfig);
      if(req.method==='POST'&&path==='/api/session') {
        const id=telegramUser((await body(req,20000)).initData,cfg.token);
        if(!id)fail(401,'Открой игру заново через Telegram.');
        return json(200,{token:session(id),scope:createHash('sha256').update(hmac(key,'save:'+id)).digest('hex').slice(0,20),paid:owns(id)});
      }
      if(req.method==='GET'&&path==='/api/access')return json(200,{paid:owns(requireUser(req))});
      if(req.method==='POST'&&path==='/api/invoice') {
        const buyer=requireUser(req);
        return json(200,await invoice(buyer,(await body(req,1024)).agree));
      }
      if(req.method==='GET'&&path==='/api/card') {
        const deck=url.searchParams.get('deck'), n=url.searchParams.get('n');
        if(!Object.hasOwn(cards,deck)||!/^\d{1,2}$/.test(n??'')||!cards[deck][Number(n)]) fail(404,'Карта не найдена.');
        if(!demo.some(([id,index])=>id===deck&&index===Number(n))) {
          const buyer=requireUser(req);
          if(!owns(buyer))fail(403,'Полная игра доступна после покупки.');
          allowRead(buyer);
        }
        return json(200,cards[deck][Number(n)]);
      }
      fail(404,'Страница не найдена.');
    } catch(error) {
      if(!error.status) console.error('Request failed:',error.name);
      if(!res.headersSent) json(error.status||503,{error:error.status?error.message:'Сервис временно недоступен. Попробуй ещё раз.'});
    }
  };
}

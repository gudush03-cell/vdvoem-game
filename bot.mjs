import {config,telegramClient,openStore,root} from './app.mjs';
import {resolve} from 'node:path';
const cfg=config(process.env),call=telegramClient(cfg);
if(process.argv[2]==='setup') {
  const me=await call('getMe',{});
  if(me.username.toLowerCase()!==cfg.username.toLowerCase())throw Error('BOT_USERNAME does not match BOT_TOKEN');
  await call('setWebhook',{url:cfg.origin+'/telegram/update',secret_token:cfg.webhook,allowed_updates:['message','pre_checkout_query']});
  await call('setChatMenuButton',{menu_button:{type:'web_app',text:'Играть',web_app:{url:cfg.origin}}});
  await call('setMyCommands',{commands:[{command:'start',description:'Открыть игру'},{command:'terms',description:'Условия покупки'},{command:'paysupport',description:'Помощь с покупкой'}]});
  console.log('Бот подключён: @'+me.username);
} else if(process.argv[2]==='refund' && process.argv[3]) {
  const db=openStore(process.env.DATABASE_PATH||resolve(root,'data/game.sqlite'));
  const charge=process.argv[3];
  const r=db.prepare('SELECT buyer,refunded FROM receipts WHERE charge=?').get(charge);
  if(!r)throw Error('Квитанция не найдена');
  if(!r.refunded){
    await call('refundStarPayment',{user_id:Number(r.buyer),telegram_payment_charge_id:charge});
    db.prepare('UPDATE receipts SET refunded=1 WHERE charge=?').run(charge);
  }
  db.close();console.log('Возврат подтверждён.');
} else { console.error('node bot.mjs setup | refund CHARGE_ID');process.exitCode=1; }

'use strict';
const access={token:null,paid:false,config:null};
let screenVersion=0;
async function api(path,data) {
  const headers={};
  if(access.token)headers.Authorization='Bearer '+access.token;
  if(data!==undefined) headers['Content-Type']='application/json';
  const res=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',headers,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store',referrerPolicy:'no-referrer'});
  const value=await res.json();
  if(!res.ok){if(res.status===403||res.status===401)access.paid=false;throw Error(value.error||'Не удалось связаться с игрой.');}
  return value;
}
const fetchCard=([id,n])=>api('card?deck='+encodeURIComponent(id)+'&n='+n);
function readIssue(error,retry) {
  const area=by('surface');
  area.replaceChildren();
  panel('Игра', 'Карту пока не удалось открыть',error.message);
  by('actions').replaceChildren(button('Повторить',retry,'btn main'),button('На главную',()=>home()));
  by('extras').replaceChildren();
}
async function boot() {
  const tg=window.Telegram?.WebApp;
  tg?.ready();
  try {
    access.config=await api('config');
    if(tg?.initData){
      const info=await api('session',{initData:tg.initData});
      access.token=info.token;access.paid=info.paid;storageKey='vdvoem-tg-'+info.scope;
    }
    game=loadGame();home();
  } catch(e) {
    home();dialog('Вход в игру',b=>{paragraph(b,e.message);actions(b,button('Повторить',()=>{dismiss();boot();},'btn main'),button('Закрыть',dismiss));});
  }
}
function paintAccess() {
  const test=by('try-demo'), shop=by('shop');
  test.hidden=access.paid;shop.hidden=access.paid;
  by('start').hidden=!access.paid;by('quick').hidden=!access.paid;
  shop.textContent=access.config?.price?'Полная игра · '+access.config.price+' ⭐':'Полная игра';
  by('choose').hidden=!access.paid;test.disabled=!access.config;
}
function demoStart() { if(access.config)requestGame('demo'); }
async function refreshPurchase(poll=false) {
  try {
    for(let i=0;i<(poll?6:1);i++) {
      access.paid=(await api('access')).paid;
      if(access.paid){home();return;}
      if(poll&&i<5)await new Promise(resolve=>setTimeout(resolve,850));
    }
    offer('Подтверждение оплаты ещё не поступило. Проверь доступ через несколько секунд.');
  } catch(e){offer(e.message);}
}
function offer(note='') {
  const cfg=access.config;
  dialog('Полная игра',b=>{
    paragraph(b,'168 карточек в 10 колодах. Одна покупка открывает игру для двоих на телефоне покупателя.');
    if(note)paragraph(b,note);
    if(!cfg){actions(b,button('Подключиться',()=>{dismiss();boot();}));return;}
    if(!access.token) {
      paragraph(b,'Открой игру в личном чате с ботом. Telegram узнает твой аккаунт.');
      const link=el('a','Открыть @'+cfg.bot,'btn main');link.href='https://t.me/'+cfg.bot;link.target='_blank';link.rel='noopener';b.append(link);
    } else if(!cfg.price)paragraph(b,'Продажи пока закрыты. Бесплатные карты уже доступны.');
    else {
      const terms=el('a','Условия покупки');terms.href=cfg.terms;terms.target='_blank';terms.rel='noopener noreferrer';
      const label=el('label'),check=el('input');check.type='checkbox';
      label.append(check,document.createTextNode(' Я принимаю условия покупки.'));
      b.append(terms,el('p'),label);
      const buy=button('Купить за '+cfg.price+' ⭐',async()=>{
        buy.disabled=true;
        try{
          const invoice=await api('invoice',{agree:check.checked});
          if(invoice.paid){await refreshPurchase();return;}
          const tg=window.Telegram?.WebApp;
          if(!tg?.isVersionAtLeast?.('6.1'))throw Error('Обнови Telegram для оплаты звёздами.');
          tg.openInvoice(invoice.url,result=>{
            if(result==='paid'||result==='pending')refreshPurchase(true);
            else offer(result==='failed'?'Платёж не прошёл. Можно попробовать ещё раз.':'');
          });
        }catch(e){offer(e.message);}
      },'btn main');
      buy.disabled=true;check.onchange=()=>{buy.disabled=!check.checked;};
      actions(b,buy,button('Проверить покупку',()=>refreshPurchase()));
    }
    if(cfg.support)paragraph(b,'Помощь с оплатой: '+cfg.support);
    actions(b,button('К бесплатным картам',()=>{dismiss();demoStart();}));
  });
}

'use strict';
const decks = JSON.parse(document.getElementById('collection').textContent);
const mainDecks = ['laugh', 'know', 'unsaid', 'inside', 'mend', 'choose'];
const displayOrder = [...mainDecks.slice(0, 5), 'scene', 'choose', 'midnight', 'silent', 'exhale'];
let storageKey = 'vdvoem-tg-demo';
const by = id => document.getElementById(id);
const modal = by('modal');
let game = null;
let visibleSecret = false;
let secretOwner = null;

function el(tag, value, css) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (css) node.className = css;
  return node;
}
function button(label, handler, css = 'btn') {
  const b = el('button', label, css);
  b.type = 'button';
  b.onclick = handler;
  return b;
}
function artwork(src, className) {
  const img = el('img', undefined, className);
  img.src = src;
  img.alt = '';
  return img;
}
function shuffled(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function references(ids) {
  return ids.flatMap(id => Array.from({length:decks[id].count}, (_,index) => [id,index]));
}
function validRef(ref) {
  return Array.isArray(ref) && ref.length === 2 && Object.hasOwn(decks, ref[0]) &&
    Number.isInteger(ref[1]) && ref[1] >= 0 && ref[1] < decks[ref[0]].count;
}
function loadGame() {
  try {
    const g = JSON.parse(localStorage.getItem(storageKey));
    if (!g || !['full','quick','deck','silent','demo'].includes(g.mode) ||
        !['setup','cards','gate','final','done'].includes(g.phase) ||
        !Number.isInteger(g.at) || g.at < 0 || !Array.isArray(g.order) || !g.order.every(validRef) ||
        g.at > g.order.length || (g.phase === 'cards' && !g.order[g.at]) ||
        ![0,1].includes(g.turn) || !Array.isArray(g.veto) || g.veto.length !== 2 ||
        !g.veto.every(x => typeof x === 'boolean') || !Array.isArray(g.secrets) ||
        g.secrets.length !== 12 || !g.secrets.every(r => validRef(r) && r[0] === 'silent') ||
        !Array.isArray(g.scenePool) || !g.scenePool.every(r => validRef(r) && r[0] === 'scene') ||
        (g.scene && (!validRef(g.scene) || g.scene[0] !== 'scene')) ||
        !validRef(g.lastCard) || g.lastCard[0] !== 'exhale' ||
        (g.mode === 'deck' && !Object.hasOwn(decks,g.deck))) return null;
    return g;
  } catch { return null; }
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(game)); } catch {}
}
function countLabel(n) {
  const last = n % 10, pair = n % 100;
  return n + ' ' + (pair >= 11 && pair <= 14 ? 'карт' : last === 1 ? 'карта' : last >= 2 && last <= 4 ? 'карты' : 'карт');
}
function moveFocus(node) {
  if (!node) return;
  node.tabIndex = -1;
  node.focus({preventScroll:true});
}
function dialog(title, fill) {
  visibleSecret = false;
  secretOwner = null;
  const body = by('dialog-body');
  const heading = el('h2', title);
  heading.id = 'dialog-title';
  body.replaceChildren(heading);
  fill(body);
  if (!modal.open) modal.showModal();
  modal.scrollTop = 0;
  moveFocus(heading);
}
function dismiss() { if (modal.open) modal.close(); }
modal.addEventListener('close', () => {
  if (modal.open) return;
  visibleSecret = false;
  secretOwner = null;
  by('dialog-body').replaceChildren();
});
by('dismiss').onclick = dismiss;
function paragraph(parent, text) { parent.append(el('p', text)); }
function actions(parent, ...buttons) {
  const row = el('div', undefined, 'actions');
  row.append(...buttons); parent.append(row);
}
function rules() {
  dialog('Как играть', body => {
    body.append(el('h3', 'Основная партия'));
    paragraph(body, 'Один телефон на двоих. Первой ходит девушка — в игре это Игрок 1. Читайте верхнюю карту, отвечайте или выполняйте задание и передавайте ход. Основные колоды идут по порядку от «Орём» до «Выбирай».');
    body.append(el('h3', 'Особые колоды'));
    paragraph(body, '«Без слов» — в начале партии каждый получает по 6 тайных заданий. Смотрите свои карты по очереди и выполняйте их незаметно.');
    paragraph(body, '«Ситуация» — возьмите карту в любой момент, если хочется сменить настроение. После неё вы вернётесь к основной колоде.');
    paragraph(body, '«После полуночи» — по желанию обоих. «Выдох» — одна случайная карта в конце партии. На неё отвечают оба.');
    body.append(artwork('data:image/webp;base64,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', 'veto-art'), el('h3', 'Карта «Не сегодня»'));
    paragraph(body, 'По одной на игрока за партию. Можно пропустить карту без объяснений и передать ход партнёру.');
    body.append(el('h3', 'Свободная игра'));
    paragraph(body, 'Откройте любую колоду отдельно или нажмите «Быстрый старт», чтобы перемешать карты шести основных колод.');
    actions(body,button('Понятно', dismiss, 'btn main'));
  });
}
function home(scroll = false) {
  screenVersion++;
  dismiss(); by('play').hidden = true; by('landing').hidden = false;
  by('resume').hidden = !game || game.phase === 'done' || (!access.paid && game.mode !== 'demo');
  paintAccess();
  by('start').classList.toggle('main',by('resume').hidden);
  by('resume').classList.toggle('main',!by('resume').hidden);
  if (scroll) { by('deck-title').focus({preventScroll:true}); by('deck-title').scrollIntoView({block:'start'}); }
  else window.scrollTo(0,0);
}
function requestGame(mode, deck = null) {
  if (mode !== 'demo' && !access.paid) return offer();
  const create = () => {
    if (deck === 'midnight') {
      dialog('После полуночи', body => {
        paragraph(body,'Эта колода о флирте, притяжении и желаниях. Открывайте её, только если хочется обоим.');
        actions(body, button('Хотим оба', () => begin(mode,deck),'btn main'), button('Назад',dismiss));
      });
    } else if (deck === 'exhale') {
      dialog('Выдох', body => {
        paragraph(body,'В финале игры вытяните одну случайную карту. Ответьте оба и выполните практику вместе.');
        actions(body,button('Вытянуть карту',()=>begin(mode,deck),'btn main'),button('Назад',dismiss));
      });
    } else begin(mode,deck);
  };
  if (!game || game.phase === 'done') return create();
  dialog('Начать новую игру?', body => {
    paragraph(body,'Сохранённая партия будет заменена. Можно вернуться к ней с той же карты.');
    actions(body,button('Продолжить партию',()=>{dismiss();render();},'btn main'),button('Начать новую',create));
  });
}
function begin(mode, deck) {
  dismiss();
  const full = mode === 'full';
  const order = mode==='demo' ? access.config.demo.slice() : full ? references(mainDecks) : shuffled(references(mode === 'quick' ? mainDecks : [deck]));
  const secretMode = deck === 'silent';
  game = {
    mode:secretMode ? 'silent' : mode, deck, order, at:0, turn:0,
    phase:full || secretMode ? 'setup' : deck === 'exhale' ? 'final' : 'cards',
    veto:[false,false], secrets:shuffled(references(['silent'])), scenePool:shuffled(references(['scene'])),
    scene:null, lastCard:shuffled(references(['exhale']))[0], night:false
  };
  save(); render();
}
function panel(label,title,text) {
  const section = el('article',undefined,'result');
  section.append(el('div',label,'overline'),el('h2',title),el('p',text));
  by('surface').append(section);
}
function phaseSetup() {
  panel('Без слов','Тайная раздача','У каждого по шесть карт. Передавайте телефон по очереди, чтобы посмотреть свои задания втайне от партнёра.');
  by('actions').append(button('Карты игрока 1',()=>privateHand(0),'btn main'),button('Карты игрока 2',()=>privateHand(1)));
  if (game.mode === 'full') by('extras').append(button('К первой колоде →',()=>setPhase('cards'),'linkbtn'));
  else by('extras').append(button('Завершить раздачу',()=>setPhase('done'),'linkbtn'));
}
function privateHand(player) {
  dialog('Телефон у игрока '+(player+1)+'?', body=>{
    paragraph(body,'Убедись, что партнёр не видит экран. Внутри — только твои шесть заданий.');
    actions(body,button('Показать мои карты',()=>revealHand(player),'btn main'),button('Назад',dismiss));
  });
}
async function revealHand(player) {
  const version=screenVersion;
  dialog('Твои тайные карты',b=>paragraph(b,'Открываем шесть заданий…'));
  const marker=by('dialog-title');
  const hand=game.secrets.slice(player*6,player*6+6);
  visibleSecret=true;secretOwner=player;
  let cards;
  try {cards=await Promise.all(hand.map(fetchCard));}
  catch(e){if(marker.isConnected && modal.open)dialog('Тайные карты',b=>{paragraph(b,e.message);actions(b,button('Повторить',()=>privateHand(player)));});return;}
  if(version!==screenVersion||!marker.isConnected||!modal.open||document.hidden)return;
  dialog('Твои тайные карты', body=>{
    const list=el('ol',undefined,'secret-list');
    cards.forEach(c=>{
      const li=el('li');
      li.append(el('strong',c.title));
      c.body.forEach(p=>paragraph(li,p));
      list.append(li);
    });
    actions(body,button('Скрыть карты',dismiss,'btn main'));
    body.append(list);
    actions(body,button('Скрыть карты',dismiss));
  });
  visibleSecret = true; secretOwner = player;
}
document.addEventListener('visibilitychange',()=>{
  if (document.hidden && modal.open && visibleSecret) privateHand(secretOwner);
});
function selectHand() {
  dialog('Чьи тайные карты?',body=>{
    paragraph(body,'Передайте телефон тому, кто хочет посмотреть свои задания.');
    actions(body,button('Игрок 1',()=>privateHand(0)),button('Игрок 2',()=>privateHand(1)));
  });
}
function gate() {
  panel('Финал партии','После полуночи?','Если вам обоим хочется продолжить, откройте эту колоду. Можно сразу перейти к одной финальной карте «Выдох».');
  by('actions').append(button('Хотим оба',()=>{
    game.order=references(['midnight']);game.at=0;game.night=true;setPhase('cards');
  },'btn main'),button('Сразу к «Выдоху»',()=>setPhase('final')));
}
function setPhase(phase) {
  game.phase=phase; game.scene=null; save(); dismiss(); render();
}
function finishSoon() {
  dialog('Перейти к финалу?',body=>{
    paragraph(body,game.night ? 'Вы оба откроете одну финальную карту «Выдох».' : 'Дальше можно открыть «После полуночи» или сразу вытянуть одну карту «Выдох».');
    actions(body,button('К финалу',()=>setPhase(game.night?'final':'gate'),'btn main'),button('Продолжить игру',dismiss));
  });
}
function drawScene() {
  if (!game.scenePool.length) game.scenePool=shuffled(references(['scene']));
  game.scene=game.scenePool.pop();
  save();render();
}
function showCard(ref,c) {
  const [id,index]=ref, deck=decks[id];
  const card=el('article',undefined,'playing-card');
  card.dataset.deck=id;
  card.style.setProperty('--tone',deck.color);
  const meta=el('div',undefined,'cardmeta');
  meta.append(el('span',deck.name),artwork(deck.icon));
  const body=el('div',undefined,'bodycopy');
  c.body.forEach(t=>paragraph(body,t));
  const foot=el('div',undefined,'cardfoot');
  foot.append(el('span','VDVOЁМ НАЛЕГКЕ'),el('span','№ '+String(index+1).padStart(2,'0')));
  card.append(meta,el('h2',c.title),body,foot);
  by('surface').append(card);
}
function advance() {
  if (game.phase === 'final') return setPhase('done');
  if (game.scene) {
    game.scene=null;save();render();return;
  }
  game.turn=1-game.turn;game.at++;
  if (game.at===game.order.length) {
    return setPhase(game.mode === 'full' ? (game.night ? 'final':'gate') : 'done');
  }
  save();render();
}
function useVeto() {
  const player=game.turn;
  if (game.veto[player]) return;
  dialog('Сказать «Не сегодня»?',body=>{
    body.append(artwork('data:image/webp;base64,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','veto-art'));
    paragraph(body,'Игрок '+(player+1)+' использует свою карту. Объяснять причину не нужно. Ход перейдёт к партнёру.');
    actions(body,button('Не сегодня',()=>{
      game.veto[player]=true;
      if (game.scene) game.turn=1-player;
      dismiss();advance();
    },'btn main'),button('Оставить карту',dismiss));
  });
}
async function cardPhase(version) {
  const final=game.phase==='final';
  const ref=final?game.lastCard:game.scene||game.order[game.at];
  let card;
  by('position').textContent='Открываем карту…';
  try {card=await fetchCard(ref);}
  catch(e){if(version===screenVersion)readIssue(e,render);return;}
  if(version!==screenVersion)return;
  showCard(ref,card);
  moveFocus(by('surface').querySelector('h2'));
  by('position').textContent=final?'Финал · отвечают оба':game.scene?'Ситуация · вне очереди':
    'Игрок '+(game.turn+1)+' · '+(game.at+1)+' из '+game.order.length;
  const nextText=final?'Завершить игру':game.scene?'Вернуться к партии':'Следующая карта';
  by('actions').append(button(nextText,advance,'btn main'));
  if (game.mode==='full' && !final) {
    const veto=button(game.veto[game.turn]?'«Не сегодня» использована':'Не сегодня',useVeto);
    veto.disabled=game.veto[game.turn];
    by('actions').append(veto);
    const extra=by('extras');
    if (!game.scene) extra.append(button('Взять «Ситуацию»',drawScene,'linkbtn'));
    extra.append(button('Тайные карты',selectHand,'linkbtn'),button('К финалу',finishSoon,'linkbtn'));
  } else if (!final) by('actions').append(button('Пропустить',advance));
}
function render() {
  const version=++screenVersion;
  by('landing').hidden=true;by('play').hidden=false;
  by('surface').replaceChildren();by('actions').replaceChildren();by('extras').replaceChildren();
  by('position').textContent='';
  switch(game.phase) {
    case 'setup':phaseSetup();break;
    case 'gate':gate();break;
    case 'cards':case 'final':cardPhase(version);break;
    case 'done':
      if(game.mode==='demo' && !access.paid){
        panel('6 карт из 168','Продолжим вдвоём?','В полной игре — десять колод, тайные задания и финальная карта для двоих.');
        by('actions').append(button('Открыть полную игру',()=>offer(),'btn main'),button('На главную',()=>home()));
        break;
      }
      panel('VDVOЁМ НАЛЕГКЕ','До следующей игры','Какая карта запомнилась вам больше всего?');
      by('actions').append(button('Сыграть ещё',()=>requestGame(game.mode==='silent'?'deck':game.mode,game.deck),'btn main'),button('Все колоды',()=>home(true)));
      break;
  }
  window.scrollTo(0,0);moveFocus(by('surface').querySelector('h2'));
}
displayOrder.forEach(id=>{
  const deck=decks[id], b=button('',()=>requestGame('deck',id),'deck');
  b.dataset.deck=id;
  b.style.setProperty('--tone',deck.color);
  b.append(artwork(deck.icon),el('strong',deck.name),el('small',countLabel(deck.count)));
  by('decks').append(b);
});
by('inventory').textContent='10 колод · '+countLabel(Object.values(decks).reduce((n,d)=>n+d.count,0))+' · «Не сегодня» у каждого';
by('back-left').src=decks.inside.back;by('back-right').src=decks.exhale.back;
by('help').onclick=rules;by('home').onclick=()=>home();by('all').onclick=()=>home(true);
by('resume').onclick=()=>render();by('start').onclick=()=>requestGame('full');
by('quick').onclick=()=>requestGame('quick');by('choose').onclick=()=>home(true);
by('try-demo').onclick=demoStart;by('shop').onclick=()=>offer();
boot();

// ===== 유틸 =====
const $ = (q, r=document) => r.querySelector(q);
const $$ = (q, r=document) => Array.from(r.querySelectorAll(q));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// ===== 상수(룰) =====
const RULES = {
  e: Math.E,
  statMul: {1:1.00,2:1.05,3:1.10,4:1.15,5:1.20,6:1.25},
  // 특별방송/정규 프로그램 보너스(일반 가중치 d에 합연산)
  specials: {
    // 조건 필요
    asmr:            { label:'ASMR',          stat:'talk',  d:+0.00, a:+1, b:+0, requires:'mic' },   // A +1
    costume_reveal:  { label:'신의상 공개',    stat:'auto',  d:+0.50, requires:'outfit' },
    debut_3d:        { label:'3D 오히로메',    stat:'auto',  d:+1.33, requires:'3d' },
    birthday:        { label:'생탄제',         stat:'auto',  d:+0.77, fixDice:'birthday', requires:'cake' },

    // 기타(휴방)
    hiatus:          { label:'휴방',           stat:'none',  d:0,     noGain:true }, // 뷰어십/슈챗 0 처리

    // 이벤트
    umigame_quizshow:     { label:'바다거북 퀴즈쇼',      stat:'talk',  d:+0.50, extra:'collab_count_x20' }, // + (지금까지 콜라보 인원*20%) — UI 미구현
    live_fan_meeting:    { label:'라이브 팬미팅',        stat:'talk',  d:+0.50, requires:'3d' }, // 다음 잡담 +30% — UI 미구현
    karitora_wild_hunt:  { label:'카리토라 백물어',      stat:'talk',  d:+0.50 },
    minecraft_collab:    { label:'마이쿠라 합방',        stat:'game',  d:+0.50, bonusFrom:'talk',  bonusRate:0.05 }, // + (토크레벨*5%)
    valorant_tournament: { label:'발로란트 대회',        stat:'game',  d:+0.50, bonusFrom:'game',  bonusRate:0.07 }, // + (게이밍레벨*7%)
    pukkun_flower_cup:   { label:'뻐끔플라워컵',         stat:'game',  d:+0.50 },
    group_song_release:  { label:'단체곡 공개',          stat:'vocal', d:+0.50, extra:'give_song_1' },      // 오리지널 곡 +1 — UI 미구현
    offline_concert:     { label:'오프라인 콘서트',      stat:'vocal', d:+0.50, a:+3, b:+3, requires:'3d' }, // 슈챗 A/B +3
    tuna_songfest:       { label:'다랑어가합전',         stat:'vocal', d:+0.50 },
    vtuna_fes:           { label:'VTUNA페스',            stat:'auto',  d:+2.00, fixDice:'vtuna' },          // [dice s+5 s+5]

    // 정규 프로그램
    pequodradio:     { label:'피쿼라지!',       stat:'talk',  d:+0.30, regular:true },
    pressstart:      { label:'PRESS START',     stat:'game',  d:+0.30, regular:true },
    sublive:         { label:'서브스크/라이브', stat:'vocal', d:+0.30, regular:true }
  }
};

// ===== 최종 보고서 헬퍼 =====
const STAT_KO  = { talk:'토크', game:'게이밍', vocal:'보컬', talent:'탤런트', none:'-' };
const TYPE_KO  = { mc:'MC 타입', comedian:'게닌 타입', esports:'e스포츠 타입', jong:'종겜스 타입', utaite:'우타이테 타입', idol:'아이돌 타입', specialist:'스페셜리스트' };
const TRAIT_KO = { none:'해당 없음', loner:'개인세', moe_voice:'모에고에나마누시', hypetrain:'수금왕', karakara:'알중 카라카라', reincarnated:'전생자' };
const BASIC_LABEL = { chatting:'잡담', gaming:'게임', karaoke:'우타와꾸', plan:'기획' };

const fmtNum = (n)=> Number(n||0).toLocaleString('ko-KR');
const getTypeLabel  = ()=> state.type ? (TYPE_KO[state.type] || state.type) : '미선택';
const getTraitLabel = ()=> TRAIT_KO[state.trait] || state.trait || '해당 없음';
const statLabel     = (k)=> STAT_KO[k] || '-';

function broadcastLabel(sel){
  if (sel.kind === 'basic') return BASIC_LABEL[sel.id] || sel.id;
  const sp = RULES.specials[sel.id]; return sp?.label || sel.id;
}

function listOwnedItems(){
  const it = state.items, arr = [];
  if (it.song>0)    arr.push(`오리지널 곡(${it.song})`);
  if (it.fan>0)     arr.push(`팬게임(${it.fan})`);
  if (it.goods>0)   arr.push(`굿즈 출시(${it.goods})`);
  if (it.item3d)    arr.push('3D');
  if (it.itemMic)   arr.push('바이노럴 마이크');
  if (it.itemEnergy)arr.push('에나도리');
  if (it.itemOsake) arr.push('오사께');
  if (it.itemCake)  arr.push('생일 케이크');
  return arr.length ? arr.join(', ') : '없음';
}

function buildViewBonusList(slotIdx, sel){
  const L = [];
  // calcViewers의 d 합연산 구성요소를 '설명'으로만 다시 쌓는다
  if (sel.kiri){
    L.push('키리누키(+20%)');
    if (state.trait==='loner') L.push('개인세 보정(+20%)');
  }
  if (sel.collab){
    L.push('콜라보(+60%)');
    if (state.trait==='loner') L.push('개인세 페널티(−30%)');
  }
  if (sel.afterhiatus) L.push('휴방 보너스(+30%)');
  if (sel.six){
    L.push('게임 6회(+150%)');
    if (state.type==='esports') L.push('e스포츠 타입 추가(+50%)');
  }
  if (sel.statKey==='game'  && state.items.fan>0)          L.push(`팬게임×${state.items.fan}(+${state.items.fan*5}%)`);
  if (sel.statKey==='talk'  && state.items.itemOsake)      L.push('오사께(+10%)');
  if (state.items.item3d && slotIdx===2)                   L.push('3D(3번째)(+10%)');
  if (state.type==='utaite' && sel.statKey==='vocal')      L.push('우타이테 보정(+20%)');
  if (state.type==='idol' && state.items.item3d && sel.statKey==='vocal') L.push('아이돌×3D(+30%)');

  if (sel.kind==='special'){
    const sp = RULES.specials[sel.id];
    if (sp && sp.d) L.push(`${sp.label}(+${Math.round(sp.d*100)}%)`);
    if (sp?.bonusFrom && sp?.bonusRate){
      const lv = effectiveStatLevel(sp.bonusFrom);
      L.push(`${STAT_KO[sp.bonusFrom]} Lv.${lv}×${Math.round(sp.bonusRate*100)}%(+${Math.round(lv*sp.bonusRate*100)}%)`);
    }
    if (sp?.regular && state.type==='mc') L.push('MC×정규 프로그램(+250%)');
  }
  if (sel.penalty) L.push('연속 4회 패널티(−90%)');
  if (sel.manual && sel.manual!==0) L.push(`수동 보너스(${sel.manual>0?'+':''}${sel.manual}%)`);
  return L;
}

function buildSuperBonusList(sel){
  const L = [];
  if (state.trait==='hypetrain') L.push('수금왕(A+1/B+1)');
  if (state.items.itemEnergy)    L.push('에나도리(A+1)');
  if (state.items.goods>0)       L.push(`굿즈 출시×${state.items.goods}(A+${state.items.goods}/B+${state.items.goods})`);
  if (sel.kind==='basic' && sel.id==='karaoke') L.push('우타와꾸(A+1)');
  if (sel.kind==='special' && sel.id==='asmr')  L.push('ASMR(A+1)');
  if (sel.kind==='special' && sel.id==='offline_concert') L.push('오프라인 콘서트(A+3/B+3)');
  if (sel.kind==='special' && sel.id==='vtuna_fes')       L.push('VTUNA페스(A+10/B+5)');
  if (sel.kind==='special' && sel.id==='birthday')        L.push('생탄제(고정 다이스)');
  return L;
}

// ===== 전역 상태 =====
const state = {
  name: '', accView: 1000,
  trait: 'none',
  type: null, // 'mc'|'comedian'|'esports'|'jong'|'utaite'|'idol'|'specialist'
  stats: { talk:1, game:1, vocal:1, talent:1 },
  items: { item3d:false, itemMic:false, itemEnergy:false, itemOsake:false, itemCake:false,
           song:0, fan:0, goods:0 }
};

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', () => {
  // 다크 토글
  const sw = $('#themeSwitch');
  if (sw) sw.addEventListener('change', ()=> {
    document.documentElement.setAttribute('data-theme', sw.checked?'dark':'light');
  });

  // 공통 입력
  $('#charName')?.addEventListener('input', e=>{ state.name = e.target.value; recalcAll(); });
  $('#accView')?.addEventListener('input', e=>{
    state.accView = clamp(parseInt(e.target.value||'0',10)||0, 0, 10**12);
    recalcAll();
  });
  $('#trait')?.addEventListener('change', e=>{
    state.trait = e.target.value;
    // 특성에 따른 아이템 활성
    const mic = $('#itemMic'), osake = $('#itemOsake');
    if (mic){ mic.disabled = (state.trait!=='moe_voice'); if (mic.disabled) mic.checked=false; state.items.itemMic = !!mic.checked; }
    if (osake){ osake.disabled = (state.trait!=='karakara'); if (osake.disabled) osake.checked=false; state.items.itemOsake = !!osake.checked; }
    recalcAll();
  });

  // 스탯 레벨 토글 생성
  $$('.lvl-toggle').forEach(g=>{
    if (!g.children.length){
      for (let i=1;i<=5;i++){
        const b=document.createElement('button');
        b.type='button'; b.className='seg'+(i===1?' active':''); b.textContent=String(i);
        b.addEventListener('click', ()=>{
          $$('.seg', g).forEach(x=>x.classList.remove('active'));
          b.classList.add('active');
          state.stats[g.dataset.stat] = i;
          recalcAll();
        });
        g.appendChild(b);
      }
    }
  });

  // 타입(전역 1개)
  $$('.type-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.type-btn').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      state.type = btn.dataset.type; // 전역 하나
      recalcAll();
    });
  });

  // 아이템/스테퍼
  const syncStep = (key, delta)=>{
    const id = {song:'#songCount',fan:'#fanCount',goods:'#goodsCount'}[key];
    const inp = $(id); if(!inp) return;
    const next = Math.max(0, (parseInt(inp.value||'0',10)||0) + delta);
    inp.value = String(next);
    state.items[key] = next; recalcAll();
  };
  $$('.minus').forEach(b=> b.addEventListener('click', ()=> syncStep(b.dataset.step, -1)));
  $$('.plus').forEach(b=> b.addEventListener('click', ()=> syncStep(b.dataset.step, +1)));
  $('#songCount')?.addEventListener('input', e=>{ state.items.song = Math.max(0, parseInt(e.target.value||'0',10)||0); recalcAll(); });
  $('#fanCount')?.addEventListener('input', e=>{ state.items.fan = Math.max(0, parseInt(e.target.value||'0',10)||0); recalcAll(); });
  $('#goodsCount')?.addEventListener('input', e=>{ state.items.goods = Math.max(0, parseInt(e.target.value||'0',10)||0); recalcAll(); });

  // 토글류
  $('#item3d')?.addEventListener('change', e=>{ state.items.item3d = e.target.checked; recalcAll(); });
  $('#itemEnergy')?.addEventListener('change', e=>{ state.items.itemEnergy = e.target.checked; recalcAll(); });
  $('#itemMic')?.addEventListener('change', e=>{ state.items.itemMic = e.target.checked; recalcAll(); });
  $('#itemOsake')?.addEventListener('change', e=>{ state.items.itemOsake = e.target.checked; recalcAll(); });
  $('#itemCake')?.addEventListener('change', e=>{ state.items.itemCake = e.target.checked; recalcAll(); });

  // 계산 카드 3개 생성
  const container = $('#calcContainer');
  const tpl = $('#calc-card');
  for (let i=0;i<3;i++){
    const node = tpl.content.cloneNode(true);
    container.appendChild(node);
  }
  // 플로팅 메뉴 채우기
  $$('.calc-card').forEach(card => mountFloatMenu(card));

// (A) 카드의 수동 보너스 값 읽기 (정수, -999~999, 없으면 0)
function getManualBonus(card){
  const inp = card.querySelector('.bonus-pill .in-bonus');
  if (!inp) return 0;
  let v = parseInt((inp.value ?? '').trim(), 10);
  if (Number.isNaN(v)) v = 0;
  const min = Number(inp.min ?? -999), max = Number(inp.max ?? 999);
  return clamp(v, min, max);
}

// (B) 값이 0이 아니면 강조(.selected), 0이면 해제
function syncBonusPill(card){
  const pill = card.querySelector('.bonus-pill');
  if (!pill) return;
  const v = getManualBonus(card);
  pill.classList.toggle('selected', v !== 0);
}

// [PATCH] 카드별로 라디오 그룹명 분리 (pair-0, pair-1, pair-2)
document.querySelectorAll('#calcContainer .calc-card').forEach((card, idx)=>{
  card.querySelectorAll('.ck-kiri, .ck-collab').forEach(radio=>{
    radio.name = `pair-${idx}`;
  });
});

  // 카드 이벤트 위임(하이라이트/토글/계산)
  bindCardInteractions();

  // [PATCH] 라디오(키리누키/콜라보)를 '다시 클릭하면 해제'되는 토글로
(function makePairRadiosToggleable(){
  const root = document.getElementById('calcContainer');
  if (!root) return;
  let pressedOnChecked = null;

  // 모바일/데스크톱 겸용: pointerdown으로 '이미 선택돼 있던가'만 기록
  root.addEventListener('pointerdown', (e)=>{
    const label = e.target.closest('label.chip'); if (!label) return;
    const input = label.querySelector('input[type="radio"]'); if (!input) return;
    pressedOnChecked = input.checked ? input : null;
  });

  // 클릭 시, 방금 누른 게 '이미 선택돼 있던 라디오'면 → 해제 처리
  root.addEventListener('click', (e)=>{
    const label = e.target.closest('label.chip'); if (!label) return;
    const input = label.querySelector('input[type="radio"]'); if (!input) return;

    if (pressedOnChecked === input) {
      e.preventDefault();            // 기본 라디오 동작(다시 선택) 취소
      input.checked = false;         // 해제
      input.dispatchEvent(new Event('change', { bubbles:true })); // 기존 계산 로직 트리거
    }
    pressedOnChecked = null;
  });
})();

  // 합치기/복사
  $('#btnCombine')?.addEventListener('click', combineOutputs);
  $('#btnCopyAll')?.addEventListener('click', ()=>{
    const ta = $('#allText'); ta.select(); document.execCommand('copy');
  });

  recalcAll();
});

// ===== 특별방송 메뉴 구성 =====
function mountFloatMenu(card){
  const menu = $('.float-menu', card);
  if (!menu) return;

  // 메뉴 표시 순서
  const order = [
    'asmr','costume_reveal','debut_3d','birthday',
    'umigame_quizshow','live_fan_meeting','karitora_wild_hunt',
    'minecraft_collab','valorant_tournament','pukkun_flower_cup',
    'group_song_release','offline_concert','tuna_songfest','vtuna_fes',
    'pequodradio','pressstart','sublive','hiatus'
  ];

  const html = order.map(id=>{
    const sp = RULES.specials[id]; if (!sp) return '';
    const disByTrait = (sp.regular && state.trait==='kko'); // 개인세: 정규 프로그램 불가
    const disabled = disByTrait ? ' disabled aria-disabled="true"' : '';
    return `<button class="sp-btn" data-id="${id}" data-stat="${sp.stat}"${disabled}>${sp.label}</button>`;
  }).join('');

  menu.innerHTML = html;
}

function getManualBonus(card){
  const v = Number(card.querySelector('.in-bonus')?.value || 0);
  return v / 100; // 15 → 0.15
}

// 게임 6회 칩 체크 해제 + 숨김
function resetGameSix(card){
  const chip = card.querySelector('[data-gaming]');
  if (!chip) return;
  const cb = chip.querySelector('input[type="checkbox"]');
  if (cb && cb.checked) {
    cb.checked = false;
    cb.dispatchEvent(new Event('change', { bubbles: true })); // 계산 트리거
  }
  chip.style.display = 'none';
}

function syncOtherButton(card){
  const btn  = card && card.querySelector('.open-other');
  if (!btn) return;

  const isOpen     = !!card.querySelector('.float-menu.show');
  const hasSpecial = !!card.querySelector('.sp-btn.selected');

  // 메뉴가 열려 있거나, 특별 방송이 선택되어 있으면 하이라이트 ON
  btn.classList.toggle('selected', isOpen || hasSpecial);

  // aria-expanded는 "메뉴 열림 여부"만 반영 (특별 선택과는 별개)
  btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

// ===== 카드 인터랙션 =====
function bindCardInteractions(){
  const root = $('#calcContainer');
  if (!root) return;

  // ── 공통: 기본방송 전용 칩 표시 동기화
  const updateBasicChip = (card)=>{
    const isBasic = !!card.querySelector('.bc.selected,[aria-pressed="true"]');
    const chip = card.querySelector('[data-basic]');
    if (chip) chip.style.display = isBasic ? '' : 'none';
  };

  // ── (추가) 휴방/패널티/게임6/키리누키/콜라보 즉시 반영
  const needsRecalcSel = '.ck-kiri,.ck-collab,.ck-six,.ck-penalty,.ck-afterhiatus,.ck-restbonus';
  const onToggle = (e)=>{
    const t = e.target;
    if (t && t.matches(needsRecalcSel)) {
      // 값(.checked)이 반영된 다음 프레임에 계산
      setTimeout(recalcAll, 0);
    }
  };
  // capture 유지해도 setTimeout으로 안전
  root.addEventListener('input',  onToggle, true);
  root.addEventListener('change', onToggle, true);

  // ── 수동 보너스 입력: 즉시 강조 갱신 + 재계산
  root.addEventListener('input', (e)=>{
    const inp = e.target.closest('.in-bonus'); if(!inp) return;
    const card = inp.closest('.calc-card'); if(!card) return;
    // 값 정리(정수/클램프)까지는 blur 때 확정, input에선 즉시 반영
    syncBonusPill(card);
    setTimeout(recalcAll, 0);
  }, true);
 
  // 포커스 아웃 시 숫자 정리(빈칸/NaN→0, -999~999 클램프)
  root.addEventListener('blur', (e)=>{
    const inp = e.target.closest('.in-bonus'); if(!inp) return;
    const card = inp.closest('.calc-card'); if(!card) return;
    // 최종 정수화
    let v = parseInt((inp.value ?? '').trim(), 10);
    if (Number.isNaN(v)) v = 0;
    const min = Number(inp.min ?? -999), max = Number(inp.max ?? 999);
    v = Math.min(max, Math.max(min, v));
    inp.value = String(v);
    syncBonusPill(card);
    setTimeout(recalcAll, 0);
  }, true);

  // 라벨을 클릭해서 토글하는 경우도 100% 커버
  root.addEventListener('click', (e)=>{
    const lab = e.target.closest('label.chip'); if (!lab) return;
    if (lab.querySelector('.ck-six,.ck-penalty,.ck-afterhiatus,.ck-restbonus')) {
      setTimeout(recalcAll, 0);
    }
  }, true);

  // ── 기타 버튼 → 메뉴 토글 + 위치
  root.addEventListener('click', (e)=>{
    const btn = e.target.closest('.open-other'); if(!btn) return;
    const card = btn.closest('.calc-card'); const menu = $('.float-menu', card);
    const willOpen = !menu.classList.contains('show');
    closeAllFloatMenus();
    if (willOpen) {
      const b = btn.getBoundingClientRect(), c = card.getBoundingClientRect();
      let left = b.left - c.left, top = b.bottom - c.top + 8;
      const menuW = menu.offsetWidth || 260, cardW = card.clientWidth;
      if (left + menuW > cardW - 8) left = Math.max(8, cardW - menuW - 8);
      menu.style.setProperty('--fm-left', `${left}px`);
      menu.style.setProperty('--fm-top',  `${top}px`);
    }
    menu.classList.toggle('show', willOpen);
    syncOtherButton(card);
  }, {capture:true});

  // ── 기본 방송 버튼(.bc)
  root.addEventListener('click', (e)=>{
    const b = e.target.closest('.bc'); if(!b) return;
    const card = b.closest('.calc-card'); const menu = $('.float-menu', card);
    $$('.bc', card).forEach(x=>{ x.classList.remove('selected'); x.setAttribute('aria-pressed','false'); });
    b.classList.add('selected'); b.setAttribute('aria-pressed','true');
    // 특별방송 해제
    $$('.sp-btn', menu).forEach(x=>{ x.classList.remove('selected'); x.setAttribute('aria-pressed','false'); });
    $('.open-other', card)?.classList.remove('selected');
    $('.open-other', card)?.setAttribute('aria-expanded','false');
    menu.classList.remove('show');
    // 칩 표시 동기화
    if (b.dataset.id === 'gaming') {
      const chip6 = card.querySelector('[data-gaming]');
      if (chip6) chip6.style.display = '';
    } else {
    resetGameSix(card); // ← 게임이 아니면 체크 해제 + 숨김
    }
    updateBasicChip(card); // ← 기본 방송이므로 '연속 4회 패널티' 보이게
    recalcAll();
  }, {capture:true});

  // ── 특별 방송(.sp-btn)
  root.addEventListener('click', (e)=>{
    const sp = e.target.closest('.sp-btn'); if(!sp) return;
    if (sp.hasAttribute('disabled')) return;
    e.preventDefault();
    e.stopPropagation();
    const menu = sp.closest('.float-menu');
    const card = sp.closest('.calc-card');
    if (menu.classList.contains('show') && sp.classList.contains('selected')) {
    menu.classList.remove('show');
    syncOtherButton(card);  // 특별방송 선택 유지일 때 버튼 불 유지 규칙 적용
    return;
  }
    $$('.sp-btn', menu).forEach(x=>{ x.classList.remove('selected'); x.setAttribute('aria-pressed','false'); });
    sp.classList.add('selected'); sp.setAttribute('aria-pressed','true');
    // 기본 방송 표시 해제 + 기타 버튼 하이라이트
    $$('.bc', card).forEach(x=>{ x.classList.remove('selected'); x.setAttribute('aria-pressed','false'); });
    const openBtn = $('.open-other', card); if (openBtn){ openBtn.classList.add('selected'); openBtn.setAttribute('aria-expanded','true'); }
    // 칩 표시 동기화
    $('[data-gaming]', card).style.display = 'none';
    resetGameSix(card);
    updateBasicChip(card); // ← 특별 방송이므로 '연속 4회 패널티' 숨김
    recalcAll();
  }, {capture:true});
}

// 모든 카드의 메뉴 닫기 헬퍼
function closeAllFloatMenus(){
  $$('.float-menu.show').forEach(m=>{
    m.classList.remove('show');
    const card = m.closest('.calc-card');
    syncOtherButton(card); 
  });
}

// 바깥 클릭 시 닫기
document.addEventListener('click', (e)=>{
  const t = e.target; 
  const el = (t instanceof Element) ? t : t && t.parentElement; 
  if (!el) return;
  if (el.closest('.float-menu')) return;   // 메뉴 안쪽 클릭은 통과
  if (el.closest('.open-other')) return;   // '기타' 버튼 자체 클릭도 통과
  closeAllFloatMenus();
}, true);

// ESC로 닫기
document.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') closeAllFloatMenus();
});

// (A) 카드의 수동 보너스 값 읽기 (정수, -999~999, 없으면 0)
function getManualBonus(card){
  const inp = card.querySelector('.bonus-pill .in-bonus');
  if (!inp) return 0;
  let v = parseInt((inp.value ?? '').trim(), 10);
  if (Number.isNaN(v)) v = 0;
  const min = Number(inp.min ?? -999), max = Number(inp.max ?? 999);
  return clamp(v, min, max);
}

// (B) 값이 0이 아니면 강조(.selected), 0이면 해제
function syncBonusPill(card){
  const pill = card.querySelector('.bonus-pill');
  if (!pill) return;
  const v = getManualBonus(card);
  pill.classList.toggle('selected', v !== 0);
}

// ===== 계산 =====
function recalcAll(){
  // 특성에 따른 아이템 UX 반영(비활성)
  const trait = state.trait;
  const mic = $('#itemMic'), osake = $('#itemOsake');
  if (mic){ mic.disabled = (trait!=='moe_voice'); state.items.itemMic = !mic.disabled && mic.checked; }
  if (osake){ osake.disabled = (trait!=='karakara'); state.items.itemOsake = !osake.disabled && osake.checked; }

  // 카드 순회
  $$('.calc-card').forEach((card, idx)=>{
    const sel = getSelection(card);
    const viewers = calcViewers(idx, sel);
    const dice = calcSuperchat(viewers, sel);
    $('.out-viewers', card).textContent = viewers.toLocaleString('ko-KR');
    $('.out-super', card).textContent = dice;
  });
  combineOutputs();
}

function getSelection(card){
  // 기본/특별
  const basic = $('.bc.selected', card);
  const sp    = $('.sp-btn.selected', card);
  const kind = sp ? 'special' : 'basic';
  const id = sp ? sp.dataset.id : (basic?.dataset.id || 'chatting');

  // 칩
  const kiri = $('.ck-kiri', card)?.checked || false;
  const collab = $('.ck-collab', card)?.checked || false;
  const afterhiatus = $('.ck-afterhiatus', card)?.checked || false;
  const six     = !!card.querySelector('[data-gaming] input[type="checkbox"]:checked');
  const penalty = $('.ck-penalty', card)?.checked || false;

  return {
    kind, id, kiri, collab, afterhiatus, six, penalty,
    statKey: resolveStatKey(card, kind, id),
    manual: getManualBonus(card)   // ← 추가: 카드별 수동 보너스(정수)
  };}

// 방송에 사용할 스탯 키를 결정 (talk | game | vocal | talent | 'none')
function resolveStatKey(card, kind, id){
  const ALLOWED = ['talk','game','vocal','talent'];
  const bestStat = ()=>{
    const order = ['talk','game','vocal','talent'];
    let best = order[0], max = -Infinity;
    for (const k of order){
      const v = Number(state?.stats?.[k] ?? 1);
      if (v > max){ max = v; best = k; }
    }
    return best;
  };

  if (kind === 'basic') {
    return ({ chatting:'talk', gaming:'game', karaoke:'vocal', plan:'talent' }[id]) || 'talk';
  }

  // 1) 카드의 버튼 data-stat 우선
  const btn = card?.querySelector(`.sp-btn[data-id="${id}"]`);
  const ds  = btn?.dataset?.stat;
  if (ds === 'auto') return bestStat();
  if (ds === 'none') return 'none';
  if (ALLOWED.includes(ds)) return ds;

  // 2) RULES.specials 사용
  const sp = RULES?.specials?.[id];
  if (sp){
    if (sp.stat === 'auto') return bestStat();
    if (sp.stat === 'none') return 'none';
    if (ALLOWED.includes(sp.stat)) return sp.stat;
  }

  // 3) id 직접 매핑
  const byId = {
    asmr:'talk', costume_reveal:'auto', debut_3d:'auto', birthday:'auto', hiatus:'none',
    umigame_quizshow:'talk', live_fan_meeting:'talk', karitora_wild_hunt:'talk',
    minecraft_collab:'game', valorant_tournament:'game', pukkun_flower_cup:'game',
    group_song_release:'vocal', offline_concert:'vocal', tuna_songfest:'vocal',
    vtuna_fes:'auto', pequodradio:'talk', pressstart:'game', sublive:'vocal',
  };
  const mapped = byId[id];
  if (mapped === 'auto') return bestStat();
  if (mapped === 'none') return 'none';
  if (ALLOWED.includes(mapped)) return mapped;

  // 4) 키워드 예비
  const key = String(id || '').toLowerCase().replace(/[\s\-]+/g, '_');
  if (/asmr|talk|chat|umigame|turtle|talkshow|quiz|pequod|fan_?meeting|karitora/.test(key)) return 'talk';
  if (/game|minecraft|valorant|tournament|pressstart|pukkun|flower/.test(key)) return 'game';
  if (/song|karaoke|vocal|concert|live|sub_?live|vtuna|tuna/.test(key)) return 'vocal';
  if (/plan|variety|talent/.test(key)) return 'talent';

  return bestStat();
}

function effectiveStatLevel(key){
  let lv = clamp(state.stats[key]||1, 1, 6);
  // MC 타입은 토크 +1
  if (state.type==='mc' && key==='talk') lv = clamp(lv+1, 1, 6);
  return lv;
}

function calcViewers(slotIdx, sel){
  const v = state.accView;
  const s = RULES.statMul[ effectiveStatLevel(sel.statKey) ] || 1.0;

  // 일반 가중치 d(합연산)
  let d = 1.0;

  // 기본 보너스
  if (sel.kiri)   d += 0.20;
  if (sel.collab) d += 0.60;
  if (sel.afterhiatus) d += 0.30;
  if (sel.six){
    d += 1.00; // 150%
    if (state.type==='esports') d += 0.50; // e스포츠 타입 추가 100%
  }

  // 특성: 개인세(콜라보 -30, 키리누키 +20), 수금왕(슈퍼챗에서 처리), 전생자(+300)
  if (state.trait==='loner'){
    if (sel.collab) d -= 0.30;
    if (sel.kiri)   d += 0.20;
  }
  if (state.trait==='reincarnated') d += 3.00; // 300%

  // 아이템: 팬게임 → 게임 뷰어십 +5%/개, 오사께 → 잡담 +10%, 3D → 3번째 카드 +10%
  if (sel.statKey==='game' && state.items.fan>0) d += 0.05 * state.items.fan;
  if (sel.statKey==='talk' && state.items.itemOsake) d += 0.10;
  if (state.items.item3d && slotIdx===2) d += 0.10;

  // 타입 특화
  if (state.type==='utaite' && sel.statKey==='vocal') d += 0.20;
  if (state.type==='idol' && state.items.item3d && sel.statKey==='vocal') d += 0.30;

  // 특별 방송
  if (sel.kind==='special'){
    const sp = RULES.specials[sel.id] || null;
    if (sp){ d += sp.d || 0; 
      // ★ 여기부터 추가: 스탯 연동 보너스 (마이쿠라/발로란트 등)
      if (sp.bonusFrom && sp.bonusRate) {
        // bonusFrom: 'talk' | 'game' | 'vocal' | 'talent'
        const key = sp.bonusFrom;
        // effectiveStatLevel은 MC 토크 +1 등 이미 반영하는 기존 함수 그대로 사용
        const lv = Math.max(1, Math.min(6, effectiveStatLevel(key)));
        d += lv * sp.bonusRate;  // 예) talk 3레벨, rate 0.05 → +0.15(=+15%p)
      }
      // 휴방, VTUNA 등 다른 특수 처리 있으면 여기에…
      if (sp.noGain) return 0;
    }
    // 정규 프로그램 + MC 타입 250%
    if (sp?.regular && state.type==='mc') d += 2.50;
  }

  // 정규 프로그램 제한: 개인세는 불가(버튼 비활성로 처리, 여기서는 별도 패널티 없음)

  // 콜라보 타입 보너스: 게닌 타입은 콜라보 +40%
  if (state.type==='comedian' && sel.collab) d += 0.40;

  // 4연속 패널티
  if (sel.penalty) d -= 0.90;

  // ★ 수동 보너스(정수 %): d += manual/100
  if (sel.manual && sel.manual !== 0) d += (sel.manual / 100);

  // 누적 뷰어십 기반 기본식
  const base = (65 * Math.pow(v, 0.2)) / (1 + Math.pow(RULES.e, (-0.0001*(v - 10000)))) + 77;
  const result = Math.floor(base * d * s);
  return Math.max(0, result);
}

function calcSuperchat(c, sel){
  // s' = floor(c^(1/3))
  const sCube = Math.floor(Math.cbrt(c));

  // 강화 a/b
  let a = 0, b = 0;

  // 공통: 수금왕
  if (state.trait==='hypetrain'){ a+=1; b+=1; }
  // 에나도리: 모든 방송 a+1
  if (state.items.itemEnergy) a+=1;
  // 굿즈: 모든 방송 a += goods, b += goods
  if (state.items.goods>0){ a += state.items.goods; b += state.items.goods; }

  // 우타와꾸/ASMR: A +1
  if (sel.kind==='basic' && sel.id==='karaoke') a += 1;
  if (sel.kind==='special' && sel.id==='asmr')  a += 1;

  // 오리지널 곡: 우타와꾸일 때 a,b += 곡 수
  if ((sel.kind==='basic' && sel.id==='karaoke') && state.items.song>0){
    a += state.items.song;
    b += state.items.song;
  }

  // 특별 방송 다이스
  if (sel.kind==='special' && sel.id==='birthday'){
    const x = sCube*20;
    return `[dice ${x} ${x}]`;
  }
  if (sel.kind==='special' && sel.id==='offline_concert'){ a += 3; b += 3; }
  if (sel.kind==='special' && sel.id==='vtuna_fes'){ a += 10; b += 5; }
  if (sel.kind==='special' && sel.id==='hiatus'){
    return "-";
  }

  const low = Math.max(0, sCube + a - 2);
  const high = Math.max(low, sCube + b + 2);
  return `[dice ${low} ${high}]`;
}

// ===== 합치기(최종 보고서) =====
function combineOutputs(){
  const lines = [];

  // 헤더
  const name = state.name || '이름 미지정';
  lines.push(`【${name}】 누적 뷰어십 : ${fmtNum(state.accView)}`);
  lines.push(`${getTypeLabel()} / ${getTraitLabel()}`);
  lines.push(`토크 : Lv. ${state.stats.talk} / 게이밍 : Lv. ${state.stats.game} / 보컬 : Lv. ${state.stats.vocal} / 탤런트 : Lv. ${state.stats.talent}`);
  lines.push(`보유 아이템 : ${listOwnedItems()}`);
  lines.push('');

  // 카드 3개
  let sum = 0;
  $$('.calc-card').forEach((card, i)=>{
    const sel = getSelection(card);
    const viewers = Number($('.out-viewers', card).textContent.replace(/[^0-9]/g, '') || 0);
    const dice = $('.out-super', card).textContent.trim();

    const bLabel = broadcastLabel(sel);
    const sKey   = sel.statKey || 'none';
    const sLabel = statLabel(sKey);
    const sLv    = (sKey!=='none') ? effectiveStatLevel(sKey) : '-';
    const isHiatus = (sel.kind==='special' && sel.id==='hiatus');

    lines.push(`#${i+1} ${bLabel} / ${sLabel} : Lv. ${sLv}`);

    if (sel.kiri)   lines.push(`키리누키 : >>000`);
    if (sel.collab) lines.push(`콜라보 : >>000-000`);

    if (!isHiatus){
      const vList = buildViewBonusList(i, sel);
      lines.push(`뷰어십 보너스 : ${vList.length ? vList.join(', ') : '없음'}`);
    }

    lines.push(`획득 뷰어십 : ${fmtNum(viewers)}`);

    if (!isHiatus){
      const sList = buildSuperBonusList(sel);
      lines.push(`슈퍼챗 보너스 : ${sList.length ? sList.join(', ') : '없음'}`);
    }

    lines.push(`슈퍼챗 : ${dice}`);
    lines.push('');

    sum += viewers;
  });

  // 결산
  lines.push(`【결산】`);
  lines.push(`획득 뷰어십 총합 : ${fmtNum(sum)}`);
  lines.push(`누적 뷰어십 : ${fmtNum(state.accView + sum)}`);

  $('#allText').value = lines.join('\n');
}

// 스무스 스크롤(대부분 브라우저 지원), CSS 쪽에 html{scroll-behavior:smooth;} 넣어도 됨.
document.addEventListener('click', (e)=>{
  const t = e.target; 
  const el = (t instanceof Element) ? t : t && t.parentElement; 
  if (!el) return;
  const btn = el.closest('.fab'); 
  if(!btn) return;

  if (btn.classList.contains('fab-top')){
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (btn.classList.contains('fab-bottom')){
    // 문서 맨 아래로
    const maxY = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    window.scrollTo({ top: maxY, behavior: 'smooth' });
    return;
  }

  if (btn.classList.contains('fab-link')){
    const href = btn.dataset.href || 'https://example.com';
    window.open(href, '_blank', 'noopener');
  }
});

function syncBonusChip(card){
  const lab = card.querySelector('.chip-bonus');
  const inp = lab?.querySelector('.in-bonus');
  if (!lab || !inp) return;
  const v = Number(inp.value || 0);
  lab.classList.toggle('selected', v !== 0);
}

document.addEventListener('input', (e)=>{
  const t = e.target; 
  const el = (t instanceof Element) ? t : t && t.parentElement; 
  if (!el) return;
  if (!el.closest('#calcContainer')) return; // 컨테이너 밖이면 무시  // 기존 root 위임 로직 그대로
}, true);

document.addEventListener('click', (e)=>{
  const t = e.target; 
  const el = (t instanceof Element) ? t : t && t.parentElement; 
  if (!el) return;
  if (!el.closest('#calcContainer')) return;  // 기존 root 위임 로직 그대로
}, {capture:true});

// 초기 한 번(또는 카드 생성 시마다)
document.querySelectorAll('.calc-card').forEach(syncBonusChip);

// 값에 따라 불(하이라이트) 토글
function syncBonusPill(card){
  const pill = card.querySelector('.bonus-pill');
  const inp  = pill?.querySelector('.in-bonus');
  if(!pill || !inp) return;
  const v = Number(inp.value || 0);
  pill.classList.toggle('selected', v !== 0);
}

// 입력 변화 즉시 반영 + 계산 다시
document.addEventListener('input', (e)=>{
  const t = e.target; 
  const el = (t instanceof Element) ? t : t && t.parentElement; 
  if (!el) return;
  const inp = el.closest('.in-bonus'); if(!inp) return;  const card = inp.closest('.calc-card');
  syncBonusPill(card);
  if (typeof recalcAll === 'function') recalcAll();
});

// 포커스 아웃 시 숫자 정리(빈값 0, 범위 클램프, 정수화)
document.addEventListener('blur', (e)=>{
  const t = e.target; 
  const el = (t instanceof Element) ? t : t && t.parentElement; 
  if (!el) return;
  const inp = el.closest('.in-bonus'); if(!inp) return;
  let v = parseInt((inp.value ?? '').trim(), 10);
  if (isNaN(v)) v = 0;
  const min = Number(inp.min ?? -999), max = Number(inp.max ?? 999);
  v = Math.min(max, Math.max(min, v));
  inp.value = String(v);
  const card = inp.closest('.calc-card');
  syncBonusPill(card);
  if (typeof recalcAll === 'function') recalcAll();
}, true);

// 초기 동기화(페이지 로드/카드 생성 후 한 번)
document.querySelectorAll('.calc-card').forEach(syncBonusPill);

function getManualBonus(card){
  const inp = card.querySelector('.bonus-pill .in-bonus');
  if (!inp) return 0;
  let v = parseInt((inp.value ?? '').trim(), 10);
  if (Number.isNaN(v)) v = 0;
  v = Math.max(-999, Math.min(999, v));   // 클램프
  return v; // ← 정수 '퍼센트포인트' 그대로 반환 (예: 100)
}

// 어딘가의 가산 보너스 합산 지점:
// bonusAdd += getManualBonus(card);

function syncBonusPill(card){
  const pill = card.querySelector('.bonus-pill');
  const inp  = pill?.querySelector('.in-bonus');
  if(!pill || !inp) return;

  // 값 파싱(빈칸/NaN → 0 취급)
  let v = Number((inp.value ?? '').trim());
  if (Number.isNaN(v)) v = 0;

  // 상태 클래스 토글
  pill.classList.toggle('pos', v > 0);
  pill.classList.toggle('neg', v < 0);

  // (선택) 0이 아닐 때만 공통 selected도 쓰고 싶다면:
  // pill.classList.toggle('selected', v !== 0);

  // 동적 부호 갱신(HTML에 .sign가 있는 경우)
  const sign = pill.querySelector('.sign');
  if (sign){
    sign.textContent = v > 0 ? '+' : (v < 0 ? '−' : '');
  }
}

// 초기 동기화
document.querySelectorAll('.calc-card').forEach(syncBonusPill);

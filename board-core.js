/* Shared board reading & strict single-ply difference inference. Local-only. */
(() => {
  'use strict';
  if (globalThis.LichessFenCore) return;
  const letters = 'abcdefgh';
  const types = {king:'k',queen:'q',rook:'r',bishop:'b',knight:'n',pawn:'p'};
  const fail = error => ({ok:false,error});
  const side = piece => piece === piece?.toUpperCase() ? 'w' : 'b';
  const coords = sq => [letters.indexOf(sq[0]), Number(sq[1]) - 1];
  const at = (f,r) => f>=0&&f<8&&r>=0&&r<8 ? letters[f]+(r+1) : null;
  const same = (a,b) => {
    const ak=Object.keys(a), bk=Object.keys(b);
    return ak.length===bk.length && ak.every(k=>a[k]===b[k]);
  };
  function placement(pieces) {
    let result='';
    for(let r=8;r>=1;r--) {
      let empty=0;
      for(const file of letters) {
        const piece=pieces[file+r];
        if(!piece) empty++;
        else {if(empty){result+=empty;empty=0;} result+=piece;}
      }
      if(empty)result+=empty;
      if(r>1)result+='/';
    }
    return result;
  }
  function readBoard() {
    if(location.hostname!=='lichess.org') return fail('目前仅支持 lichess.org 网页。');
    const candidates=[...document.querySelectorAll('cg-board')].map(el=>{
      const r=el.getBoundingClientRect(), css=getComputedStyle(el);
      const visible=r.width>=120&&r.height>=120&&css.visibility!=='hidden'&&css.display!=='none';
      return {el,r,visible,pieceCount:el.querySelectorAll(':scope > piece:not(.ghost):not(.fading)').length};
    }).filter(x=>x.visible&&x.pieceCount>0);
    if(!candidates.length) return fail('当前没有加载完成的 8×8 棋盘。');
    candidates.sort((a,b)=>{
      const score=x=>{
        const primary=x.el.closest('.puzzle__board, .analyse__board, .round__board, .study__board')?1e8:0;
        const onscreen=x.r.bottom>0&&x.r.top<innerHeight&&x.r.right>0&&x.r.left<innerWidth?1e7:0;
        return primary+onscreen+x.r.width*x.r.height;
      };
      return score(b)-score(a);
    });
    const {el:board,r:rect}=candidates[0];
    const wrap=board.closest('.cg-wrap');
    const orientation=wrap?.classList.contains('orientation-black')?'black':wrap?.classList.contains('orientation-white')?'white':null;
    if(!orientation)return fail('找不到棋盘方向，避免输出错误坐标。');
    if(Math.abs(rect.width-rect.height)>Math.max(rect.width,rect.height)*.08)return fail('棋盘比例异常，拒绝猜测坐标。');
    function square(elem) {
      const r=elem.getBoundingClientRect();
      const x=r.left+r.width/2,y=r.top+r.height/2;
      // Small CSS subpixel rounding error is OK; do not extrapolate outside.
      const col=Math.floor((x-rect.left)/(rect.width/8));
      const row=Math.floor((y-rect.top)/(rect.height/8));
      if(col<0||col>7||row<0||row>7)return null;
      return letters[orientation==='white'?col:7-col]+(orientation==='white'?8-row:row+1);
    }
    const pieces={};
    for(const p of board.querySelectorAll(':scope > piece:not(.ghost):not(.fading)')) {
      if(p.classList.contains('dragging')||p.classList.contains('anim'))return fail('棋子正在拖动或动画中，请稍后重试。');
      const color=p.classList.contains('white')?'w':p.classList.contains('black')?'b':null;
      const name=Object.keys(types).find(t=>p.classList.contains(t));
      const sq=square(p);
      if(!color||!name||!sq)return fail('有棋子无法解析类型或坐标。');
      if(pieces[sq])return fail('多个棋子映射到同一格；可能处于动画中。');
      const symbol=types[name];
      pieces[sq]=color==='w'?symbol.toUpperCase():symbol;
    }
    if(Object.values(pieces).filter(p=>p==='K').length!==1||Object.values(pieces).filter(p=>p==='k').length!==1)
      return fail('未检测到双方各一枚王。');
    const currentPlacement=placement(pieces);
    const validFen=/^([pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+\s+[wb]\s+(?:-|K?Q?k?q?)\s+(?:-|[a-h][36])\s+\d+\s+[1-9]\d*$/;
    const tryFen=value=>{
      if(typeof value!=='string'||value.length>200||!validFen.test(value.trim()))return null;
      const fields=value.trim().split(/\s+/);
      return fields[0]===currentPlacement?fields:null;
    };
    let exact=null,fenSource=null;
    for(const el of [...document.querySelectorAll('[data-fen], input[name*="fen" i], input[id*="fen" i], textarea[name*="fen" i], textarea[id*="fen" i]')].slice(0,50)) {
      for(const val of [el.getAttribute('data-fen'),el.value]){
        const found=tryFen(val);if(found){exact=found;fenSource='网页 FEN 字段';break;}
      }
      if(exact)break;
    }
    if(!exact&&location.pathname.startsWith('/analysis/')){
      try {
        const found=tryFen(decodeURIComponent(location.pathname.slice('/analysis/'.length)).replace(/_/g,' '));
        if(found){exact=found;fenSource='分析 URL';}
      }catch(_) { /* malformed URL fragment */ }
    }
    let inferredTurn=exact?.[1]||null;
    let turnSource=exact?fenSource:'无法确认';
    if(!inferredTurn) {
      const checks=[...new Set([...board.querySelectorAll(':scope > square.check')].map(square).filter(Boolean))];
      if(checks.length===1&&['K','k'].includes(pieces[checks[0]])) {
        inferredTurn=side(pieces[checks[0]]);turnSource='将军高亮';
      }
    }
    if(!inferredTurn){
      const last=[...new Set([...board.querySelectorAll(':scope > square.last-move')].map(square).filter(Boolean))];
      if(last.length===2){
        const occupied=last.filter(s=>pieces[s]), empty=last.filter(s=>!pieces[s]);
        if(occupied.length===1&&empty.length===1){
          inferredTurn=side(pieces[occupied[0]])==='w'?'b':'w';
          turnSource='上一步高亮推测（不保证）';
        }
      }
    }
    return {
      ok:true, pieces, placement:currentPlacement, orientation, pieceCount:Object.keys(pieces).length,
      inferredTurn, turnSource, exactFen:exact?.join(' ')||null,fenSource,
      pageUrl:location.href.split('#')[0]
    };
  }
  // Ensure that a candidate is a geometrically legal move, without assuming unknown castling rights.
  // This validates a *single* ply from two complete board placements; not a substitute for a chess engine.
  function moveMatches(before,after,src,dst) {
    const piece=before[src], taken=before[dst];
    if(!piece||!after[dst]||side(piece)!==side(after[dst])||taken&&side(taken)===side(piece))return null;
    if(taken==='K'||taken==='k')return null;
    const [f,r]=coords(src),[tf,tr]=coords(dst),dx=tf-f,dy=tr-r;
    const type=piece.toLowerCase();
    const promotion=piece.toLowerCase()==='p'&&[0,7].includes(tr)?after[dst].toLowerCase():null;
    if(promotion&&!['q','r','b','n'].includes(promotion))return null;
    if(!promotion&&after[dst]!==piece)return null;
    const white=side(piece)==='w',dir=white?1:-1;
    const next={...before};delete next[src];
    let ep=false,castle=false;
    function pathClear(){
      const steps=Math.max(Math.abs(dx),Math.abs(dy));
      const df=Math.sign(dx),dr=Math.sign(dy);
      for(let t=1;t<steps;t++)if(before[at(f+df*t,r+dr*t)])return false;
      return true;
    }
    if(type==='p'){
      if(dx===0){
        if(taken)return null;
        if(dy!==dir&&(dy!==2*dir||r!==(white?1:6)||before[at(f,r+dir)]))return null;
      }else if(Math.abs(dx)===1&&dy===dir){
        if(!taken){
          if(r!==(white?4:3))return null;
          const epSq=at(tf,r),epPiece=before[epSq];
          if(epPiece!==(white?'p':'P'))return null;
          delete next[epSq];ep=true;
        }
      }else return null;
    }else if(type==='n'){
      if(!((Math.abs(dx)===1&&Math.abs(dy)===2)||(Math.abs(dx)===2&&Math.abs(dy)===1)))return null;
    }else if(type==='b'){
      if(Math.abs(dx)!==Math.abs(dy)||!pathClear())return null;
    }else if(type==='r'){
      if(!(dx===0||dy===0)||!pathClear())return null;
    }else if(type==='q'){
      if(!(dx===0||dy===0||Math.abs(dx)===Math.abs(dy))||!pathClear())return null;
    }else if(type==='k'){
      if(Math.max(Math.abs(dx),Math.abs(dy))===1){/* normal king move */}
      else if(dy===0&&Math.abs(dx)===2&&f===4&&r===(white?0:7)) {
        const rf=dx>0?7:0,rt=dx>0?5:3,rfSq=at(rf,r),rtSq=at(rt,r);
        if(before[rfSq]!== (white?'R':'r')||before[rtSq])return null;
        const dir=Math.sign(dx);
        for(let ff=f+dir;ff!==rf;ff+=dir)if(before[at(ff,r)])return null;
        delete next[rfSq];next[rtSq]=white?'R':'r';castle=true;
      }else return null;
    }else return null;
    next[dst]=after[dst];
    if(!same(next,after))return null;
    return {uci:src+dst+(promotion||''),side:side(piece),from:src,to:dst,
      piece:piece.toUpperCase(),capture:!!taken||ep,promotion,castle,ep};
  }
  function inferMove(before,after) {
    if(!before?.pieces||!after?.pieces)return null;
    const b=before.pieces,a=after.pieces;
    if(same(b,a))return null;
    const origins=Object.keys(b).filter(sq=>b[sq]!==a[sq]);
    const destinations=Object.keys(a).filter(sq=>a[sq]!==b[sq]);
    const possibilities=[];
    for(const src of origins)for(const dst of destinations){
      if(src===dst)continue;
      const m=moveMatches(b,a,src,dst);
      if(m)possibilities.push(m);
    }
    return possibilities.length===1?possibilities[0]:null;
  }
  globalThis.LichessFenCore={readBoard,placement,inferMove,same};
})();
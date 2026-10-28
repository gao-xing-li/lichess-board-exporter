/* Local-only Lichess puzzle recorder: native SAN first, board snapshots as fallback. */
(() => {
  'use strict';
  if(globalThis.__lichessFenMonitor)return;
  const core=globalThis.LichessFenCore, reader=globalThis.LichessTreeReader;
  if(!core||!reader)return;
  const MAX_SNAPSHOTS=160;
  const state={snapshots:[],transitions:[],cursor:-1,confirmedStart:false,
    firstSeenAt:null,lastError:'',discontinuities:0,pageKey:'',
    treeAnchorPath:null,startTurnOverride:null,treeLine:{ok:false,moves:[],reason:'尚未读取到原生棋谱'},treeUpdatedAt:null};
  let timer=null,raf=0;
  function pageKey(){
    const link=document.querySelector('.puzzle__side__metas .infos.puzzle a[href*="/training/"]');
    const match=link?.getAttribute('href')?.match(/\/training\/([A-Za-z0-9]{5,})(?:[/?#]|$)/);
    return location.pathname+location.search+(match?'#puzzle:'+match[1]:'');
  }
  const snapshot=board=>({...board,observedAt:new Date().toISOString()});
  function syncTree(){
    const tree=reader.readTree();
    if(!tree.ok){state.treeLine={ok:false,moves:[],reason:tree.reason};return;}
    if(!state.treeAnchorPath && state.cursor===0 && tree.initialPath)
      state.treeAnchorPath=tree.initialPath;
    if(!state.treeAnchorPath){
      state.treeLine={ok:false,moves:[],reason:'尚未在棋谱中定位起点'};return;
    }
    state.treeLine=reader.since(tree,state.treeAnchorPath);
    state.treeUpdatedAt=new Date().toISOString();
  }
  function newSession(board,confirmed=false){
    state.snapshots=[snapshot(board)];state.transitions=[];state.cursor=0;
    state.confirmedStart=confirmed;state.firstSeenAt=new Date().toISOString();
    state.discontinuities=0;state.lastError='';state.startTurnOverride=board.inferredTurn||null;
    const tree=reader.readTree();
    state.treeAnchorPath=tree.ok?(tree.activePath||tree.initialPath):null;
    syncTree();
  }
  function observe(){
    const key=pageKey();
    if(state.pageKey!==key){
      state.pageKey=key;
      state.snapshots=[];state.transitions=[];state.cursor=-1;
      state.confirmedStart=false;state.discontinuities=0;state.firstSeenAt=null;
      state.treeAnchorPath=null;
    }
    const board=core.readBoard();
    if(!board.ok){
      state.lastError=board.error;
      if(/动画|拖动/.test(board.error))schedule(75);
      syncTree();return;
    }
    state.lastError='';
    if(state.cursor<0){newSession(board);return;}
    if(board.placement===state.snapshots[state.cursor].placement){syncTree();return;}
    const seen=state.snapshots.findIndex(x=>x.placement===board.placement);
    if(seen>=0){state.cursor=seen;syncTree();return;}
    if(state.cursor<state.snapshots.length-1){
      state.snapshots.splice(state.cursor+1);
      state.transitions.splice(state.cursor);
    }
    const prev=state.snapshots[state.cursor];
    let move=core.inferMove(prev,board);
    const last=state.transitions[state.cursor-1];
    const expected=last?.type==='move'?(last.side==='w'?'b':'w'):
      (prev.exactFen?.split(' ')[1]||prev.inferredTurn||null);
    if(move&&expected&&move.side!==expected)move=null;
    const transition=move?{type:'move',...move}:
      {type:'gap',reason:'棋盘变化跨过了多个步骤；无法从两帧可靠还原'};
    if(!move)state.discontinuities++;
    state.transitions.push(transition);state.snapshots.push(snapshot(board));state.cursor++;
    if(state.snapshots.length>MAX_SNAPSHOTS){
      state.snapshots.shift();state.transitions.shift();state.cursor--;
      state.confirmedStart=false;state.treeAnchorPath=null;
    }
    syncTree();
  }
  function schedule(ms=32){
    clearTimeout(timer);timer=setTimeout(()=>{timer=null;observe();},ms);
  }
  function relevantMutation(m){
    const target=m.target?.nodeType===1?m.target:m.target?.parentElement;
    if(!target)return false;
    if(target.closest?.('cg-board, .cg-wrap, .puzzle__moves, .puzzle__side__metas'))return true;
    return !!target.querySelector?.('cg-board, .puzzle__moves');
  }
  const observer=new MutationObserver(list=>{
    if(list.some(relevantMutation)){
      // Puzzle move-list updates may contain many SAN moves in a *single* DOM commit.
      // Read these immediately; board inference can wait until pieces settle.
      syncTree();
      if(!raf)raf=requestAnimationFrame(()=>{raf=0;observe();});
      schedule(90);
    }else if(state.cursor<0)schedule(200);
  });
  if(document.body)observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,
    attributeFilter:['class','style','data-fen','value','href']});
  const interval=setInterval(observe,1600);
  window.addEventListener('popstate',()=>schedule(100));
  window.addEventListener('pageshow',()=>schedule(100));
  observe();
  function view(){
    syncTree();
    return {ok:true,snapshots:state.snapshots,transitions:state.transitions,cursor:state.cursor,
      confirmedStart:state.confirmedStart,firstSeenAt:state.firstSeenAt,
      discontinuities:state.discontinuities,lastError:state.lastError,
      current:state.snapshots[state.cursor]||null,treeLine:state.treeLine,
      treeAnchorPath:state.treeAnchorPath,startTurnOverride:state.startTurnOverride};
  }
  function receive(message,_sender,respond){
    if(!message||!String(message.type||'').startsWith('LFE_'))return false;
    if(message.type==='LFE_SET_START_TURN'){
      if(state.cursor===0&&['w','b'].includes(message.turn))state.startTurnOverride=message.turn;
      respond(view());
    }else if(message.type==='LFE_STATE'){
      observe();respond(view());
    }else if(['LFE_MARK_START','LFE_RESET'].includes(message.type)){
      const result=core.readBoard();
      if(!result.ok)respond(result);
      else{state.pageKey=pageKey();newSession(result,message.type==='LFE_MARK_START');
        if(['w','b'].includes(message.turn))state.startTurnOverride=message.turn;
        respond(view());}
    }
    return false;
  }
  chrome.runtime.onMessage.addListener(receive);
  globalThis.__lichessFenMonitor={view,observe,receive,
    stop:()=>{observer.disconnect();clearInterval(interval);clearTimeout(timer);cancelAnimationFrame(raf);}};
})();
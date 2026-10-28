'use strict';
const $=id=>document.getElementById(id);
const pieceNames={K:'王',Q:'后',R:'车',B:'象',N:'马',P:'兵'};
let session=null,tabId=null,turnEdited=false;
function boardNow(){return session?.snapshots?.[session.cursor]||null;}
function listPieces(board,color){
  return Object.entries(pieceNames).map(([code,name])=>{
    const squares=Object.entries(board.pieces).filter(([,p])=>p.toUpperCase()===code&&
      (color==='white'?p===p.toUpperCase():p===p.toLowerCase())).map(([sq])=>sq).sort();
    return squares.length?`${name} ${squares.join('、')}`:null;
  }).filter(Boolean).join('；');
}
function formatFen(board,turn){
  const exact=board.exactFen?.split(' '),t=turn||board.inferredTurn||null;
  return [board.placement,t||'?',exact?.[2]||'-',exact?.[3]||'-',exact?.[4]||'0',exact?.[5]||'1'].join(' ');
}
function positionText(board,turn,start=false){
  const value=formatFen(board,turn);
  const known=!!board.exactFen;
  return [
    `请将下列信息视为【${start?'保存的谜题起始局面':'网页当前局面'}】，不要依据网页“已完成”推测起点或终点。`,
    `请先用 Check → Take → Threat (CTT) 引导我寻找候选着法，不要提前揭晓答案。`,
    '',`FEN：${value}`,
    `白方：${listPieces(board,'white')}`,
    `黑方：${listPieces(board,'black')}`,
    `棋盘方向：${board.orientation==='white'?'白方在下':'黑方在下'}`,
    !start?'注意：这是当前显示位置，不一定是谜题原始起点。':null,
    start&&!session.confirmedStart?'注意：起点仅为插件首次观测的快照，尚未手动确认。':null,
    !turn?'注意：行棋方未知，请先核实；FEN 中的 ? 是占位符，不是合法的 FEN 行棋方。':null,
    !known?'注意：王车易位、吃过路兵和回合计数是默认值，未能由网页核实。':null
  ].filter(Boolean).join('\n');
}
function fallbackLines(){
  const lines=[];
  for(let i=0;i<session.cursor;i++){
    const t=session.transitions[i];
    if(!t)continue;
    if(t.type==='gap')lines.push(`[断点 ${i+1}] 中间可能有多步，不能当成连续棋谱`);
    else lines.push(`${i+1}. ${t.uci}（${t.side==='w'?'白方':'黑方'}）`);
  }
  return lines;
}
function formatSanLine(moves,initialTurn){
  // SAN is supplied by the Lichess DOM; do not invent a starting move number.
  // FEN fullmove can be a placeholder, so numbering starts at 1 by convention.
  const turn=['w','b'].includes(initialTurn)?initialTurn:null;
  if(!turn)return moves.map((m,i)=>`${i+1}. ${m.san}`);
  const out=[];
  for(let i=0;i<moves.length;i++){
    const whiteToMove=(i+(turn==='b'?1:0))%2===0;
    const number=Math.floor((i+(turn==='b'?1:0))/2)+1;
    if(whiteToMove){
      out.push(`${number}. ${moves[i].san}`);
    }else if(i===0){
      out.push(`${number}... ${moves[i].san}`);
    }else{
      out[out.length-1]+=` ${moves[i].san}`;
    }
  }
  return out;
}
function history(){
  const t=session.treeLine;
  if(t?.ok){
    const start=session.snapshots[0];
    const turn=session.startTurnOverride||start.inferredTurn;
    return {lines:formatSanLine(t.moves,turn),plyCount:t.moves.length,
      source:'Lichess 页面原生棋谱（SAN）',trusted:true};
  }
  const lines=fallbackLines();
  return {lines,plyCount:lines.length,source:'棋盘画面变化推断（UCI，可能缺步）',
    trusted:session.discontinuities===0};
}
function reviewText(){
  const start=session.snapshots[0];
  const h=history(),turn=session.startTurnOverride||start.inferredTurn||'';
  const startFen=formatFen(start,turn);
  return [
    '请按 Check → Take → Threat（CTT）引导我分析这道 Lichess 战术谜题，先让我找候选着法，暂不揭晓答案。',
    `起始 FEN：${startFen}`,
    `起点：${session.confirmedStart?'手动保存':'首次观测（未确认）'}`,
    `棋谱来源：${h.source}`,
    `记录走法：${h.lines.length?h.lines.join(' '):'暂无'}`,
    !h.trusted?'警告：棋盘记录存在断点，不能视为连续棋谱。':null,
    !turn?'警告：行棋方未知，FEN 中的 ? 只是占位符。':null,
    !start.exactFen?'说明：王车易位、吃过路兵和回合计数可能为默认值。':null
  ].filter(Boolean).join('\n');
}
function render(){
  const board=boardNow();if(!board)return;
  $('status').hidden=true;$('panel').hidden=false;
  const turn=turnEdited?$('turn').value:board.inferredTurn||'';
  if(!turnEdited)$('turn').value=turn;
  $('boardInfo').textContent=`${board.pieceCount} 枚棋子 · ${board.orientation==='white'?'白方在下':'黑方在下'}`;
  $('startFlag').className='badge'+(session.confirmedStart?' confirmed':'');
  $('startFlag').textContent=session.confirmedStart?'✓ 已保存起点':'起点未确认';
  const h=history();
  $('moveInfo').textContent=session.treeLine?.ok?`原生棋谱 ${h.plyCount} 步`:
    `画面记录 ${h.lines.length} 项${session.discontinuities?' · 有断点':''}`;
  $('fen').value=formatFen(board,turn);
  $('treeMoves').value=h.lines.length?h.lines.join('\n'):'暂无走棋记录';
  $('diagnostic').textContent=session.treeLine?.ok?'棋谱来自 Lichess 主线；如果手动回到旧局面，此处仍保留已生成的主线。':
    `未使用原生棋谱：${session.treeLine?.reason||'原因未知'}。${session.discontinuities?'画面监听有 '+session.discontinuities+' 个断点。':''}`;
  $('turnNote').textContent=turnEdited?'已手动选择；当前 FEN 会使用此设置。':
    (board.inferredTurn?`自动识别方式：${board.turnSource}`:'无法确认，请根据题目选择；不选时会用 ? 标记。');
  $('copyReview').disabled=!session.snapshots.length;
  $('copyPosition').disabled=!board;
}
async function copy(text){
  if(!text)return;
  try{await navigator.clipboard.writeText(text);$('feedback').textContent='✓ 已复制，直接粘贴到 ChatGPT 即可';}
  catch(_){
    const el=document.createElement('textarea');el.value=text;document.body.append(el);el.select();
    const ok=document.execCommand('copy');el.remove();
    $('feedback').textContent=ok?'✓ 已复制':'复制失败，请在更多选项中手动复制 FEN';
  }
}
async function send(type,more={}){
  try{return await chrome.tabs.sendMessage(tabId,{type,...more});}
  catch(_){
    await chrome.scripting.executeScript({target:{tabId},files:['board-core.js','tree-reader.js','monitor.js']});
    return await chrome.tabs.sendMessage(tabId,{type,...more});
  }
}
async function load(type='LFE_STATE'){
  $('status').hidden=false;$('status').className='';$('status').textContent='正在读取棋盘…';
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id||!/^https:\/\/lichess\.org\//.test(tab.url||''))
      throw Error('请先打开 Lichess 网页');
    tabId=tab.id;
    const result=await send(type,type==='LFE_MARK_START'?{turn:$('turn').value}:{});
    if(!result?.ok)throw Error(result?.error||'无法读取棋盘');
    if(!result.snapshots?.length)throw Error(result.lastError||'网页棋盘尚未加载完成');
    session=result;
    turnEdited=false;render();
    if(type==='LFE_MARK_START')$('feedback').textContent='✓ 已将当前盘面设为起点';
    if(type==='LFE_RESET')$('feedback').textContent='✓ 已清空原有记录';
  }catch(e){$('status').hidden=false;$('status').className='error';$('status').textContent=e?.message||String(e);}
}
$('copyPosition').addEventListener('click',()=>copy(positionText(boardNow(),$('turn').value)));
$('copyReview').addEventListener('click',()=>copy(reviewText()));
$('markStart').addEventListener('click',()=>load('LFE_MARK_START'));
$('copyStart').addEventListener('click',()=>copy(positionText(session.snapshots[0],session.startTurnOverride||session.snapshots[0].inferredTurn,true)));
$('copyFen').addEventListener('click',()=>copy($('fen').value));
$('reset').addEventListener('click',()=>load('LFE_RESET'));
$('refresh').addEventListener('click',()=>load());
$('turn').addEventListener('change',async()=>{
  turnEdited=true;
  if(session?.cursor===0&&$('turn').value){
    try{const r=await send('LFE_SET_START_TURN',{turn:$('turn').value});if(r?.ok)session=r;}catch(_){}
  }
  render();
});
load();
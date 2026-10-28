/* Read visible, native Lichess puzzle move tree, without touching page internals. */
(() => {
  'use strict';
  if (globalThis.LichessTreeReader) return;
  function readTree() {
    const root=document.querySelector('.puzzle__moves .tview2');
    if(!root) return {ok:false,reason:'页面没有提供 Lichess 谜题棋谱'};
    // The puzzle view renders the principal line as direct <move p="..."> children;
    // <lines> and <line> contain variations, which must never enter the mainline.
    const els=[...root.children].filter(el=>el.tagName.toLowerCase()==='move'&&el.hasAttribute('p'));
    const moves=els.map(el=>{
      // Evaluation badges, glyphs, and inline comments are not SAN.
      const san=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE)
        .map(n=>n.textContent.trim()).filter(Boolean).join('').trim();
      return {path:el.getAttribute('p'),san,
        active:el.classList.contains('active'),initial:el.classList.contains('current'),
        isHistory:el.classList.contains('hist')};
    }).filter(x=>x.path&&x.san&&x.san!=='...');
    if(!moves.length)return {ok:true,moves:[],activePath:null,initialPath:null};
    return {ok:true,moves,activePath:moves.find(m=>m.active)?.path||null,
      initialPath:moves.find(m=>m.initial)?.path||null};
  }
  function since(tree,anchorPath) {
    if(!tree?.ok||!anchorPath) return {ok:false,reason:'未能将网页棋谱对应到已保存的起点'};
    const i=tree.moves.findIndex(m=>m.path===anchorPath);
    if(i<0) return {ok:false,reason:'起点不在当前主线中（可能切换了变化分支）'};
    const moves=tree.moves.slice(i+1);
    let prev=anchorPath;
    for(const move of moves) {
      if(!move.path.startsWith(prev)||move.path.length!==prev.length+2)
        return {ok:false,reason:'棋谱路径不连续，不能保证是同一条主线'};
      prev=move.path;
    }
    return {ok:true,moves:moves.map(m=>({san:m.san,path:m.path})),source:'Lichess 网页原生主线'};
  }
  globalThis.LichessTreeReader={readTree,since};
})();

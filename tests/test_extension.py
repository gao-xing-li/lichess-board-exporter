"""Integration tests with a simulated Lichess DOM. Run: python tests/test_extension.py."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
CORE=(ROOT/'board-core.js').read_text(encoding='utf-8').replace("if(location.hostname!=='lichess.org')","if(false)")
TREE=(ROOT/'tree-reader.js').read_text(encoding='utf-8')
MONITOR=(ROOT/'monitor.js').read_text(encoding='utf-8')
SYMBOL={'k':'king','q':'queen','r':'rook','b':'bishop','n':'knight','p':'pawn'}
SAMPLE='6k1/6pp/8/2BN4/7r/2P2n1P/Pr4P1/R5RK'
FINAL='6k1/6pp/8/2BN4/8/2P2n1P/P6r/R5RK'

def pieces_from_fen(fen):
    out={}
    for y,line in enumerate(fen.split('/')):
        file=0
        for x in line:
            if x.isdigit(): file+=int(x)
            else: out['abcdefgh'[file]+str(8-y)]=x;file+=1
        assert file==8
    return out

def board_html(pieces,orientation='black'):
    tags=[]
    for square,p in pieces.items():
        x='abcdefgh'.index(square[0]);r=int(square[1])-1
        col=x if orientation=='white' else 7-x
        row=7-r if orientation=='white' else r
        tags.append(f'<piece class="{"white" if p.isupper() else "black"} {SYMBOL[p.lower()]}" style="transform:translate({col*70}px,{row*70}px)"></piece>')
    return f'<div class="puzzle__board"><div class="cg-wrap orientation-{orientation}"><cg-board>{"".join(tags)}</cg-board></div></div>'

CSS='''<style>
.cg-wrap{position:relative;width:560px;height:560px}
cg-board{display:block;position:relative;width:560px;height:560px}
piece,square{display:block;position:absolute;top:0;left:0;width:70px;height:70px}
</style>'''

def tree_html(moves,active=None):
    # Lichess renders principal line as DIRECT <move p="..."> children.
    parts=[]
    for i,(path,san) in enumerate(moves):
        css=['current'] if i==0 else []
        if path==active:css.append('active')
        parts.append(f'<move p="{path}" class="{" ".join(css)}">{san}<glyph title="best">✓</glyph></move>')
    parts.append('<lines><line><move p="abxx">Qh4+</move></line></lines>')
    return '<div class="puzzle__moves"><div class="tview2">'+''.join(parts)+'</div></div>'

async def main():
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium')
    page=await browser.new_page(viewport={'width':900,'height':800})
    start=pieces_from_fen(SAMPLE)
    markup=CSS+'<div class="puzzle__side__metas"><div class="infos puzzle"><a href="/training/Abc123">#Abc123</a></div></div>'+board_html(start)+tree_html([('ab','Bd4')],active='ab')
    await page.set_content('<html><body>'+markup+'</body></html>')
    await page.add_script_tag(content=CORE)
    await page.add_script_tag(content=TREE)
    board=await page.evaluate('LichessFenCore.readBoard()')
    assert board['placement']==SAMPLE and board['orientation']=='black' and board['pieceCount']==15,board
    assert board['inferredTurn'] is None
    print('PASS provided FEN and orientation')
    direct=await page.evaluate('LichessTreeReader.readTree()')
    assert direct['initialPath']=='ab' and len(direct['moves'])==1,direct
    assert (await page.evaluate('LichessTreeReader.since(LichessTreeReader.readTree(),"ab")'))['ok']
    print('PASS mainline SAN parser ignores variations, badges')
    await page.evaluate('''()=>{window.chrome={runtime:{onMessage:{addListener(fn){window.monitorRequest=fn}}}};}''')
    await page.add_script_tag(content=MONITOR)
    state=await page.evaluate('__lichessFenMonitor.view()')
    assert state['cursor']==0 and state['treeLine']['ok'],state
    await page.evaluate('''()=>monitorRequest({type:'LFE_MARK_START',turn:'b'},null,()=>{})''')
    state=await page.evaluate('__lichessFenMonitor.view()')
    assert state['confirmedStart'] and state['startTurnOverride']=='b',state
    # Mimic DOM updates rendering 3 moves in one frame, and board jumps to final position.
    steps=[('ab','Bd4'),('abcd','Rxh3+'),('abcdef','gxh3'),('abcdefgh','Rh2#')]
    await page.evaluate('''([a,b])=>{
      document.querySelector('.puzzle__board').outerHTML=a;
      document.querySelector('.puzzle__moves').outerHTML=b;
    }''',[board_html(pieces_from_fen(FINAL)),tree_html(steps,'abcdefgh')])
    await page.wait_for_timeout(280)
    state=await page.evaluate('__lichessFenMonitor.view()')
    assert state['treeLine']['ok'],state
    assert [m['san'] for m in state['treeLine']['moves']]==['Rxh3+','gxh3','Rh2#'],state
    assert state['discontinuities']>=1,state
    print('PASS native SAN recovers all moves despite board-jump discontinuity')
    # Reset without URL change when a new puzzle is shown (Lichess SPA).
    await page.evaluate('''()=>document.querySelector('.infos.puzzle a').href='/training/New456' ''')
    await page.wait_for_timeout(250)
    state=await page.evaluate('__lichessFenMonitor.view()')
    assert state['cursor']==0 and not state['confirmedStart'],state
    print('PASS puzzle ID detects new puzzle without URL change')
    await page.evaluate('__lichessFenMonitor.stop()')
    await page.close()

    # Test UI: minimal first screen + backup advanced controls.
    popup=await browser.new_page(viewport={'width':550,'height':800})
    snap={'pieces':start,'placement':SAMPLE,'orientation':'black','pieceCount':15,'inferredTurn':'b',
          'turnSource':'上一步高亮','exactFen':None}
    completed={'pieces':pieces_from_fen(FINAL),'placement':FINAL,'orientation':'black',
               'pieceCount':13,'inferredTurn':'w','turnSource':'上一步高亮','exactFen':None}
    payload={'ok':True,'snapshots':[snap,completed],'transitions':[{'type':'gap'}],
             'cursor':1,'confirmedStart':True,'firstSeenAt':'2026-10-28','discontinuities':1,
             'lastError':'','current':completed,'startTurnOverride':'b',
             'treeLine':{'ok':True,'source':'Lichess 网页原生主线','moves':[{'san':'Rxh3+'},{'san':'gxh3'},{'san':'Rh2#'}]}}
    await popup.evaluate('''payload=>{
      window.mockCopies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{mockCopies.push(t)}}});
      window.chrome={tabs:{query:async()=>[{id:1,url:'https://lichess.org/training/Abc123'}],
      sendMessage:async()=>payload},scripting:{executeScript:async()=>[]}};
    }''',payload)
    html=(ROOT/'popup.html').read_text(encoding='utf-8')
    html=html.replace('<link rel="stylesheet" href="popup.css">','<style>'+(ROOT/'popup.css').read_text(encoding='utf-8')+'</style>')
    html=html.replace('<script src="popup.js"></script>','<script>'+(ROOT/'popup.js').read_text(encoding='utf-8')+'</script>')
    await popup.set_content(html)
    await popup.wait_for_function("document.querySelector('#boardInfo').textContent.includes('枚棋子')")
    assert await popup.locator('#advanced').get_attribute('open') is None
    assert '起点' in await popup.locator('#startFlag').text_content()
    await popup.locator('#copyReview').click()
    review=(await popup.evaluate('mockCopies.at(-1)'))
    assert '1... Rxh3+ 2. gxh3 Rh2#' in review,review
    assert '原生棋谱' in review and SAMPLE in review and '存在断点' not in review,review
    await popup.locator('#copyPosition').click()
    position=await popup.evaluate('mockCopies.at(-1)')
    assert FINAL in position and '原始起点' in position,position
    await popup.locator('#advanced summary').click()
    fen=await popup.locator('#fen').input_value()
    assert fen.startswith(FINAL+' w '),fen
    size=await popup.locator('body').bounding_box()
    assert size['width']<=350,size
    await popup.locator('#advanced summary').click()
    await popup.screenshot(path=str(ROOT/'tests'/'popup-preview.png'))
    print('PASS slim popup, copy current vs saved start, SAN replay source')
    await browser.close()

if __name__=='__main__':asyncio.run(main())
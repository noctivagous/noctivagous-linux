/* NCT Desktop — environment behaviour
   Login flow, window manager, taskbar/launcher, terminal, settings,
   monitor, notes. Client-side only; state resets on reload. */

(function(){
"use strict";
var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var state={user:'noctivagous',session:'Flat Space',lockMode:false,wall:0,volume:62,brightness:78,z:10,winSeq:0,termHist:[],termHi:0,notesSaved:false};
var ICONS={
home:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 11 12 4l8 7M6 9.5V20h12V9.5"/></svg>',
folder:'<svg class="ic" viewBox="0 0 24 24"><path d="M3 6h7l2 2h9v11H3zM3 6v13"/></svg>',
term:'<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16"/><path d="M7 9l3 3-3 3M12 16h5"/></svg>',
gear:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
mon:'<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12"/><path d="M6 12l3-4 3 5 2.5-3H18M9 20h6M12 16v4"/></svg>',
note:'<svg class="ic" viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/></svg>',
trash:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>',
info:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/></svg>',
file:'<svg class="ic" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v4h4"/></svg>'};
var APPS=[
 {id:'home',name:'Home',icon:'home',hint:'WIN · H'},
 {id:'files',name:'Files',icon:'folder',hint:'WIN · F'},
 {id:'terminal',name:'Terminal',icon:'term',hint:'CTRL+ALT+T'},
 {id:'settings',name:'Settings',icon:'gear',hint:'CTRL+,'},
 {id:'monitor',name:'Monitor',icon:'mon',hint:'WIN · M'},
 {id:'notes',name:'Notes',icon:'note',hint:'WIN · N'},
 {id:'about',name:'About',icon:'info',hint:'SYS'},
 {id:'trash',name:'Trash',icon:'trash',hint:'0 ITEMS'}];
function appById(id){for(var i=0;i<APPS.length;i++)if(APPS[i].id===id)return APPS[i];return APPS[0]}
/* ---------- clock ---------- */
function pad(n){return (n<10?'0':'')+n}
function tick(){
 var d=new Date(),days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],mons=['January','February','March','April','May','June','July','August','September','October','November','December'];
 var t=pad(d.getHours())+':'+pad(d.getMinutes()),ts=t+':'+pad(d.getSeconds()),ds=days[d.getDay()]+' · '+d.getDate()+' '+mons[d.getMonth()]+' '+d.getFullYear();
 var s=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v};
 s('loginClockTop',ts);s('loginDateTop',d.getDate()+' '+mons[d.getMonth()].slice(0,3).toUpperCase()+' '+d.getFullYear());s('bigClock',t);s('bigDate',ds);s('deskClock',ts);s('widgetClock',t);s('widgetDate',ds);s('dockClock',ts);s('dockDate',d.getDate()+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear());
}
tick();setInterval(tick,1000);
/* ---------- toast ---------- */
var toastT=null;
function toast(msg){var t=$('#toast');t.textContent=msg;t.style.display='block';clearTimeout(toastT);toastT=setTimeout(function(){t.style.display='none'},2600)}
/* ---------- login ---------- */
var loginWin=$('#loginWin'),userField=$('#userField'),passField=$('#passField'),loginErr=$('#loginErr');
function shakeErr(msg){loginErr.textContent=msg;loginErr.classList.add('show');loginWin.classList.remove('shake');void loginWin.offsetWidth;loginWin.classList.add('shake');$('#loginStatus').textContent='AUTH · INPUT REQUIRED';passField.focus()}
$$('#sessionSeg button').forEach(function(b){b.addEventListener('click',function(){$$('#sessionSeg button').forEach(function(x){x.classList.remove('sel')});b.classList.add('sel');state.session=b.getAttribute('data-sess');$('#sessLine').textContent='SESSION · '+state.session.toUpperCase()+'  /  DISPLAY :0'})});
$$('.userchip').forEach(function(ch){ch.addEventListener('click',function(){$$('.userchip').forEach(function(x){x.classList.remove('sel')});ch.classList.add('sel');var u=ch.getAttribute('data-user');userField.value=u;$('#loginAvatar').textContent=ch.getAttribute('data-init');$('#loginWho').textContent=u?u.charAt(0).toUpperCase()+u.slice(1):'Other account';$('#loginRole').textContent=ch.getAttribute('data-role');loginErr.classList.remove('show');passField.focus();if(u==='guest')passField.value='guest'})});
$('#eyeBtn').addEventListener('click',function(){passField.type=passField.type==='password'?'text':'password';passField.focus()});
$('#cancelBtn').addEventListener('click',function(){userField.value='';passField.value='';loginErr.classList.remove('show');$('#loginStatus').textContent='READY';userField.focus()});
passField.addEventListener('keyup',function(e){$('#capsInd').classList.toggle('on',!!(e.getModifierState&&e.getModifierState('CapsLock')))});
userField.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();passField.focus()}});
function doLogin(e){if(e)e.preventDefault();
 if(state.lockMode){ if(!passField.value){shakeErr('Enter your password to unlock.');return} finishUnlock(); return }
 var u=userField.value.trim(),p=passField.value;
 if(!u){shakeErr('Enter a username.');userField.focus();return}
 if(!p){shakeErr('Password is empty — enter any password to continue.');return}
 state.user=u;loginErr.classList.remove('show');startBoot();
}
$('#loginForm').addEventListener('submit',doLogin);
function startBoot(){
 $('#loginForm').style.display='none';$('#loginHint').style.display='none';$('#userRow').style.visibility='hidden';
 var area=$('#bootArea');area.style.display='block';var log=$('#bootLog');log.innerHTML='';
 $('#loginStatus').textContent='AUTH · OK';
 var lines=['[ ok ] session accepted — user '+state.user,'[ .. ] mounting /home/'+state.user,'[ .. ] loading profile · '+state.session.toLowerCase(),' [ ok ] starting window manager','[ ok ] restoring panels and dock'];
 var i=0;var iv=setInterval(function(){if(i<lines.length){log.innerHTML+=lines[i]+'<br>';i++}else{clearInterval(iv);setTimeout(enterDesktop,260)}},300);
}
function enterDesktop(){
 state.lockMode=false;
 $('#loginScreen').classList.remove('on');$('#desktopScreen').classList.add('on');
 $('#wsLabel').textContent='Workspace 01 — '+state.session;
 $('#launchUser').textContent=state.user.toUpperCase();$('#launchAv').textContent=state.user.charAt(0).toUpperCase()||'N';$('#launchSess').textContent=state.session.toUpperCase()+' · :0';
 $('#winLayer').innerHTML='';$('#taskBar').innerHTML='';
 openApp('home');openApp('files');
 toast('Session started — '+state.session);
}
function finishUnlock(){
 $('#loginTitle').textContent='Login — Session Manager';$('#loginBtn').textContent='Log In →';$('#sessionRow').style.display='';$('#loginHint').textContent="Any password works in this demo — try 'guest' via Guest user.";
 $('#loginScreen').classList.remove('on');$('#desktopScreen').classList.add('on');state.lockMode=false;passField.value='';
}
function lockScreen(){
 closeAllMenus();$('#desktopScreen').classList.remove('on');$('#loginScreen').classList.add('on');state.lockMode=true;
 $('#loginForm').style.display='';$('#bootArea').style.display='none';$('#userRow').style.visibility='visible';$('#loginHint').style.display='';
 $('#loginTitle').textContent='Locked — '+state.user;$('#loginBtn').textContent='Unlock →';$('#sessionRow').style.display='none';$('#loginHint').textContent='Screen locked. Enter your password to unlock.';
 userField.value=state.user;passField.value='';$('#loginStatus').textContent='LOCKED';passField.focus();
}
function logOut(){
 closeAllMenus();$('#desktopScreen').classList.remove('on');$('#loginScreen').classList.add('on');state.lockMode=false;
 $('#loginForm').style.display='';$('#bootArea').style.display='none';$('#userRow').style.visibility='visible';$('#loginHint').style.display='';
 $('#loginTitle').textContent='Login — Session Manager';$('#loginBtn').textContent='Log In →';$('#sessionRow').style.display='';$('#loginHint').textContent="Any password works in this demo — try 'guest' via Guest user.";
 userField.value='noctivagous';passField.value='';$('#loginStatus').textContent='READY';
}
$('#restartBtn').addEventListener('click',function(){$('#restartOverlay').classList.add('on');setTimeout(function(){$('#restartOverlay').classList.remove('on');logOut()},1600)});
$('#shutdownBtn').addEventListener('click',function(){$('#powerOverlay').classList.add('on')});
$('#loginPowerBtn').addEventListener('click',function(){$('#powerOverlay').classList.add('on')});
$('#powerOnBtn').addEventListener('click',function(){$('#powerOverlay').classList.remove('on');if($('#desktopScreen').classList.contains('on')){$('#desktopScreen').classList.remove('on');$('#loginScreen').classList.add('on')}logOut()});
$('#loginCloseX').addEventListener('click',function(){$('#powerOverlay').classList.add('on')});
$('#a11yBtn').addEventListener('click',function(){toast('Accessibility: large text off · screen reader off · high contrast off')});
/* ---------- menus ---------- */
var MENUS={File:[['New Window','files'],['Open Terminal','terminal'],['—'],['Lock Screen','lock'],['Log Out…','logout']],Edit:[['Undo','noop'],['Redo','noop'],['—'],['Settings…','settings']],View:[['Change Wallpaper','wallpaper'],['System Monitor','monitor'],['—'],['Show Desktop','showdesk']],Window:[['Files','files'],['Terminal','terminal'],['Notes','notes'],['About','about']],Help:[['About This System','about'],['System Monitor','monitor']]};
var appMenus=$('#appMenus');
Object.keys(MENUS).forEach(function(name){
 var w=document.createElement('div');w.className='menuwrap';
 var b=document.createElement('button');b.className='menubtn';b.textContent=name;w.appendChild(b);
 var dd=document.createElement('div');dd.className='dropdown';
 MENUS[name].forEach(function(it){if(it[0]==='—'){var s=document.createElement('div');s.className='sep';dd.appendChild(s);return}var btn=document.createElement('button');btn.textContent=it[0];btn.setAttribute('data-act',it[1]);dd.appendChild(btn)});
 w.appendChild(dd);appMenus.appendChild(w);
 b.addEventListener('click',function(e){e.stopPropagation();var was=dd.classList.contains('open');closeAllMenus();if(!was){dd.classList.add('open');b.classList.add('open')}});
});
function closeAllMenus(){$$('.dropdown').forEach(function(d){d.classList.remove('open')});$$('.menubtn').forEach(function(b){b.classList.remove('open')});$('#launcher').classList.remove('open');$('#ctxMenu').classList.remove('open')}
document.addEventListener('click',function(e){if(!e.target.closest('.menuwrap')&&!e.target.closest('#launcher')&&!e.target.closest('#startBtn')&&!e.target.closest('#ctxMenu'))closeAllMenus()});
$('#sysMenuBtn').addEventListener('click',function(e){e.stopPropagation();var m=$('#sysMenu'),was=m.classList.contains('open');closeAllMenus();if(!was)m.classList.add('open')});
$('#deskPowerBtn').addEventListener('click',function(e){e.stopPropagation();var m=$('#sysMenu'),was=m.classList.contains('open');closeAllMenus();if(!was)m.classList.add('open')});
document.addEventListener('click',function(e){var t=e.target.closest('[data-act]');if(!t)return;var a=t.getAttribute('data-act');closeAllMenus();menuAction(a)});
function menuAction(a){
 if(a==='lock')lockScreen();else if(a==='logout')logOut();else if(a==='wallpaper')cycleWallpaper();else if(a==='showdesk')showDesktop();else if(a==='noop')toast('Nothing to undo.');else openApp(a);
}
/* launcher */
var la=$('#launcherApps');APPS.forEach(function(ap){var b=document.createElement('button');b.className='app';b.innerHTML=ICONS[ap.icon]+'<span>'+ap.name+'</span><small>'+ap.hint+'</small>';b.addEventListener('click',function(){closeAllMenus();openApp(ap.id)});la.appendChild(b)});
$('#startBtn').addEventListener('click',function(e){e.stopPropagation();var l=$('#launcher'),was=l.classList.contains('open');closeAllMenus();if(!was)l.classList.add('open')});
$$('#launcher [data-lact]').forEach(function(b){b.addEventListener('click',function(){var a=b.getAttribute('data-lact');closeAllMenus();if(a==='lock')lockScreen();else if(a==='logout')logOut();else if(a==='shutdown'){$('#desktopScreen').classList.remove('on');$('#loginScreen').classList.add('on');$('#powerOverlay').classList.add('on')}})});
/* icons */
function buildIcons(el,ids){ids.forEach(function(id){var ap=appById(id);var d=document.createElement('button');d.className='dicon';d.innerHTML='<span class="dib">'+ICONS[ap.icon]+'</span><span>'+ap.name+'</span>';var last=0;d.addEventListener('click',function(){$$('.dicon').forEach(function(x){x.classList.remove('sel')});d.classList.add('sel');var now=Date.now();if(now-last<420||window.innerWidth<760)openApp(id);last=now});d.addEventListener('dblclick',function(){openApp(id)});el.appendChild(d)})}
buildIcons($('#iconGrid'),['home','files','terminal','settings','monitor','notes']);
buildIcons($('#iconGridR'),['about','trash']);
/* context menu */
var deskArea=$('#deskArea');
deskArea.addEventListener('contextmenu',function(e){if(e.target.closest('.nwin')||e.target.closest('.dicon'))return;e.preventDefault();var m=$('#ctxMenu');closeAllMenus();m.style.left=Math.min(e.clientX,innerWidth-226)+'px';m.style.top=Math.min(e.clientY,innerHeight-300)+'px';m.classList.add('open')});
$('#ctxAltBtn').addEventListener('click',function(){closeAllMenus();$('#launcher').classList.add('open')});
$$('#ctxMenu [data-c]').forEach(function(b){b.addEventListener('click',function(){var a=b.getAttribute('data-c');closeAllMenus();if(a==='wallpaper')cycleWallpaper();else if(a==='lock')lockScreen();else if(a==='logout')logOut();else openApp(a)})});
function cycleWallpaper(){state.wall=(state.wall+1)%3;$('#deskWall').setAttribute('data-w',state.wall);$('#loginWall').setAttribute('data-w',state.wall);toast('Wallpaper '+(state.wall+1)+' / 3');$$('.swatch').forEach(function(s,i){s.classList.toggle('sel',i===state.wall)})}
/* ---------- window manager ---------- */
var layer=$('#winLayer'),taskBar=$('#taskBar'),wins={};
function clampWin(el){var r=el.getBoundingClientRect(),a=deskArea.getBoundingClientRect();var w=Math.min(r.width,a.width);el.style.width=w+'px';var x=Math.max(0,Math.min(el.offsetLeft,a.width-60)),y=Math.max(0,Math.min(el.offsetTop,a.height-34));el.style.left=x+'px';el.style.top=y+'px'}
function focusWin(id){Object.keys(wins).forEach(function(k){wins[k].el.classList.toggle('focused',k===id);var tb=wins[k].task;if(tb)tb.classList.toggle('active',k===id)});if(wins[id]){wins[id].el.style.zIndex=++state.z;wins[id].min=false;wins[id].el.style.display='flex';syncTasks()}}
function syncTasks(){taskBar.innerHTML='';Object.keys(wins).forEach(function(id){var w=wins[id];if(!w)return;var b=document.createElement('button');b.className='task'+(w.el.classList.contains('focused')?' active':'')+(w.min?' min':'');b.innerHTML=ICONS[appById(id).icon]+'<span>'+appById(id).name+'</span>';b.addEventListener('click',function(){if(w.min||!w.el.classList.contains('focused')){w.el.style.display='flex';focusWin(id)}else{w.min=true;w.el.style.display='none';b.classList.add('min')}});w.task=b;taskBar.appendChild(b)})}
function showDesktop(){Object.keys(wins).forEach(function(id){wins[id].min=true;wins[id].el.style.display='none'});syncTasks()}
$('#showDeskBtn').addEventListener('click',showDesktop);
var cascade=0;
function openApp(id){
 if(wins[id]){wins[id].el.style.display='flex';focusWin(id);return}
 var ap=appById(id);state.winSeq++;cascade=(cascade+1)%5;
 var el=document.createElement('div');el.className='nwin opening';el.setAttribute('data-app',id);
 var defW=id==='settings'?560:(id==='files'?620:(id==='monitor'?540:480));
 var defH=id==='terminal'?360:(id==='files'?400:(id==='monitor'?440:'')); 
 el.style.width=Math.min(defW,innerWidth-16)+'px';if(defH)el.style.height=Math.min(defH,innerHeight-110)+'px';
 el.style.left=Math.min(28+cascade*26,Math.max(0,innerWidth-defW-10))+'px';el.style.top=(14+cascade*24)+'px';
 el.innerHTML='<div class="titlebar"><span class="tid">WIN · '+pad2(state.winSeq)+'</span><span class="tt">'+ap.name+'</span><span class="wctl"><button class="wbtn shade" title="Windowshade" aria-label="Shade">≡</button><button class="wbtn min" title="Minimize" aria-label="Minimize">_</button><button class="wbtn max" title="Maximize" aria-label="Maximize">□</button><button class="wbtn close" title="Close" aria-label="Close">✕</button></span></div><div class="wbody"></div>';
 el.querySelector('.wbody').innerHTML=contentFor(id);
 layer.appendChild(el);wins[id]={el:el,min:false,max:false,prev:null,task:null};
 initApp(id,el);focusWin(id);makeDraggable(el,id);clampWin(el);
 el.addEventListener('mousedown',function(){focusWin(id)});el.addEventListener('touchstart',function(){focusWin(id)},{passive:true});
 el.querySelector('.close').addEventListener('click',function(e){e.stopPropagation();el.remove();delete wins[id];syncTasks()});
 el.querySelector('.min').addEventListener('click',function(e){e.stopPropagation();wins[id].min=true;el.style.display='none';syncTasks()});
 el.querySelector('.shade').addEventListener('click',function(e){e.stopPropagation();var b=el.querySelector('.wbody');var st=el.querySelector('.wstatus');var hid=b.style.display==='none';b.style.display=hid?'':'none';if(st)st.style.display=hid?'':'none'});
 el.querySelector('.max').addEventListener('click',function(e){e.stopPropagation();toggleMax(id)});
 setTimeout(function(){el.classList.remove('opening')},200);
}
function pad2(n){return (n<10?'00':(n<100?'0':''))+n}
function toggleMax(id){var w=wins[id],el=w.el;
 if(!w.max){w.prev={l:el.style.left,t:el.style.top,wd:el.style.width,h:el.style.height};el.style.left='0px';el.style.top='0px';el.style.width='100%';el.style.height='100%';w.max=true}
 else if(w.prev){el.style.left=w.prev.l;el.style.top=w.prev.t;el.style.width=w.prev.wd;el.style.height=w.prev.h;w.max=false}}
function makeDraggable(el,id){var bar=el.querySelector('.titlebar');var sx,sy,ox,oy,drag=false;
 function down(x,y){if(wins[id]&&wins[id].max)return;drag=true;sx=x;sy=y;ox=el.offsetLeft;oy=el.offsetTop}
 function move(x,y){if(!drag)return;var a=deskArea.getBoundingClientRect();var nx=Math.max(-el.offsetWidth+80,Math.min(ox+x-sx,a.width-60));var ny=Math.max(0,Math.min(oy+y-sy,a.height-34));el.style.left=nx+'px';el.style.top=ny+'px'}
 function up(){drag=false}
 bar.addEventListener('mousedown',function(e){if(e.target.closest('.wbtn'))return;down(e.clientX,e.clientY);e.preventDefault()});
 document.addEventListener('mousemove',function(e){move(e.clientX,e.clientY)});
 document.addEventListener('mouseup',up);
 bar.addEventListener('touchstart',function(e){if(e.target.closest('.wbtn'))return;var t=e.touches[0];down(t.clientX,t.clientY)},{passive:true});
 document.addEventListener('touchmove',function(e){if(drag){var t=e.touches[0];move(t.clientX,t.clientY)}},{passive:true});
 document.addEventListener('touchend',up);
 bar.addEventListener('dblclick',function(e){if(!e.target.closest('.wbtn'))toggleMax(id)});
}
/* ---------- app contents ---------- */
function statusbar(l,r){return '<div class="wstatus" style="margin:12px -12px -12px;border-top:1px solid #000"><span>'+l+'</span><span class="grow">'+r+'</span></div>'}
var FILEDATA={
 Home:[['Documents','—','Folder'],['Projects','—','Folder'],['Pictures','—','Folder'],['notes.txt','2 KB','Text'],['.profile','1 KB','Config']],
 Documents:[['report-q3.txt','18 KB','Text'],['budget.csv','44 KB','Sheet'],['letter.txt','3 KB','Text'],['archive','—','Folder']],
 Projects:[['demo-de','—','Folder'],['nct-ui','—','Folder'],['whirlivector','—','Folder'],['README.md','6 KB','Markdown']],
 Pictures:[['wall-01.png','1.2 MB','Image'],['wall-02.png','980 KB','Image'],['capture.png','2.4 MB','Image']]};
function fileRows(k){return FILEDATA[k].map(function(r,i){return '<div class="lrow'+(i===0?' sel':'')+'"><span>'+(r[2]==='Folder'?'▸ ':'· ')+r[0]+'</span><span class="sz">'+r[1]+'</span><span class="tp">'+r[2]+'</span></div>'}).join('')}
function contentFor(id){
 if(id==='home')return '<div class="cap" style="margin-bottom:8px">Home · 01</div><div style="font-family:var(--font-d);font-size:19px;font-weight:600;color:#eee;letter-spacing:.04em;margin-bottom:6px">Welcome, '+esc(state.user)+'</div><p style="color:#a9a9a9;line-height:1.6;margin:4px 0 10px">'+state.session+' session on NOCTIVAGOUS. Home is mounted and the window manager is running.</p><div class="group"><h4>Session <span class="idx">01</span></h4><dl class="kv"><dt>USER</dt><dd>'+esc(state.user)+'</dd><dt>SESSION</dt><dd>'+state.session+'</dd><dt>DISPLAY</dt><dd>:0 · 60 Hz</dd><dt>UPTIME</dt><dd class="mono" id="uptimeEl">00:00</dd></dl></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn sm" data-open="files">Open Files</button><button class="btn sm" data-open="terminal">Open Terminal</button><button class="btn sm" data-open="settings">Settings</button></div>'+statusbar('READY','SESSION · '+state.session.toUpperCase());
 if(id==='files')return '<div class="toolbar"><button class="btn sm">New</button><button class="btn sm">Open</button><button class="btn sm">Save</button><span class="sp"></span><span class="mono" style="font-size:11px;color:#888" id="filesPath">/home/'+esc(state.user)+'</span></div><div class="files-grid"><div class="tree" id="fileTree">'+Object.keys(FILEDATA).map(function(k,i){return '<button class="'+(i===0?'sel':'')+'" data-folder="'+k+'">'+ICONS.folder+' '+k+'</button>'}).join('')+'</div><div class="listbox"><div class="listhead"><span>Name</span><span>Size</span><span>Type</span></div><div id="fileList">'+fileRows('Home')+'</div></div></div>'+statusbar('<span id="filesStatus" style="border:none;padding:0">Ready</span>','100%');
 if(id==='terminal')return '<div class="term" id="termBody"><div><span class="usr">NOCTIVAGOUS terminal</span> <span class="dim">— type </span>help<span class="dim"> for commands</span></div><div id="termOut"></div><div class="termline"><span>'+esc(state.user)+'@nct:~$</span><input id="termInput" autocomplete="off" spellcheck="false" aria-label="Terminal input"></div></div>';
 if(id==='settings')return settingsHTML();
 if(id==='monitor')return '<div class="cap" style="margin-bottom:9px">Live · sampling 500 ms</div>'
  +['CPU','Memory','Disk'].map(function(n,i){return '<div class="prow"><span>'+n+'</span><div class="meter'+(i===1?' blue':'')+(i===2?' amber':'')+'"><i id="mon'+n+'" style="width:'+(30+i*14)+'%"></i></div><span class="pv" id="mon'+n+'V">—</span></div>'}).join('')
  +'<div class="cap" style="margin:10px 0 6px">Value plotter · CPU %</div><canvas class="plot" id="plotCanvas" width="480" height="110"></canvas>'
  +'<div class="cap" style="margin:10px 0 6px">Processes</div><div class="listbox" style="max-height:118px"><div class="listhead" style="grid-template-columns:1fr 74px 92px"><span>Process</span><span>PID</span><span>CPU</span></div><div id="procList"></div></div>'
  +'<div style="display:flex;gap:14px;margin-top:10px;font-family:var(--font-m);font-size:11px;color:#9a9a9a;flex-wrap:wrap"><span>NET ↓ <b style="color:#ddd" id="netDown">1.24 MB/s</b></span><span>NET ↑ <b style="color:#ddd" id="netUp">0.31 MB/s</b></span><span>TEMP <b style="color:#ddd" id="tempV">54°C</b></span></div>'+statusbar('SAMPLING','LOAD AVG 0.42');
 if(id==='notes')return '<div class="toolbar"><button class="btn sm primary" id="notesSave">Save</button><button class="btn sm" id="notesClear">Clear</button><span class="sp"></span><span class="mono" style="font-size:11px;color:#888">untitled.txt</span></div><textarea class="tinput notes" id="notesArea" placeholder="Type here…">Session notes\n\n- \n</textarea>'+statusbar('<span id="notesStatus" style="border:none;padding:0">0 words · 0 chars</span>','UTF-8');
 if(id==='about')return '<div style="text-align:center;padding:4px 0 10px"><div class="avatar" style="margin:0 auto 8px">N</div><div style="font-family:var(--font-d);font-weight:700;letter-spacing:.2em;font-size:17px;color:#f0f0f0">NOCTIVAGOUS</div><div class="mono" style="font-size:10.5px;color:#888;letter-spacing:.14em;margin-top:4px">DESKTOP ENVIRONMENT</div></div><div class="group"><h4>System <span class="idx">01</span></h4><dl class="kv"><dt>VERSION</dt><dd>4.2.0 (build 2026.11)</dd><dt>KERNEL</dt><dd>6.8-NCT</dd><dt>SESSION</dt><dd>'+state.session+'</dd><dt>DISPLAY</dt><dd>:0 · Window manager 2.1</dd><dt>USER</dt><dd>'+esc(state.user)+'</dd></dl></div><div class="group"><h4>Hardware <span class="idx">02</span></h4><dl class="kv"><dt>MEMORY</dt><dd>16 GB</dd><dt>DISK</dt><dd>512 GB · 61% free</dd><dt>BATTERY</dt><dd id="aboutBatt">87% · discharging</dd></dl><div class="cap" style="margin:10px 0 5px">Disk used</div><div class="meter amber"><i style="width:39%"></i></div></div>'+statusbar('READY','SYSINFO 4.2');
 if(id==='trash')return '<div class="cap" style="margin-bottom:8px">Trash · 02</div><div class="listbox"><div class="listhead"><span>Name</span><span>Size</span><span>Type</span></div><div style="padding:22px;text-align:center;color:#777;font-family:var(--font-m);font-size:11.5px">TRASH IS EMPTY</div></div><div style="margin-top:10px"><button class="btn sm" disabled style="opacity:.45">Empty Trash</button></div>'+statusbar('0 ITEMS','—');
 return '<p>—</p>';
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
function settingsHTML(){
 return '<div class="tabs"><div class="tabstrip"><button class="sel" data-tab="0">Appearance</button><button data-tab="1">Controls</button><button data-tab="2">Sound</button></div>'
 +'<div class="tabpane sel" data-pane="0">'
 +'<div class="srow"><label>Brightness</label><input type="range" class="sys" id="setBright" min="30" max="100" value="'+state.brightness+'"><span class="sval" id="setBrightV">'+state.brightness+'%</span></div>'
 +'<div class="cap" style="margin:10px 0 7px">Wallpaper</div><div class="swatches">'
 +'<button class="swatch sel" data-wp="0" style="background:linear-gradient(150deg,#2b2b2b,#0a0a0a)" aria-label="Wallpaper 1"></button>'
 +'<button class="swatch" data-wp="1" style="background:linear-gradient(150deg,#26303a,#090b0d)" aria-label="Wallpaper 2"></button>'
 +'<button class="swatch" data-wp="2" style="background:linear-gradient(150deg,#33291f,#17141d)" aria-label="Wallpaper 3"></button></div>'
 +'<div class="hairline"></div><label class="chk"><input type="checkbox" id="chkNotif" checked> Enable notifications</label><label class="chk"><input type="checkbox" id="chkAuto"> Auto-start session apps</label><label class="chk"><input type="checkbox" id="chkAnim" checked> Animations</label></div>'
 +'<div class="tabpane" data-pane="1">'
 +'<div class="srow"><label>Volume</label><input type="range" class="sys" id="setVol" min="0" max="100" value="'+state.volume+'"><span class="sval" id="setVolV">'+state.volume+'%</span></div>'
 +'<div class="srow"><label>Brightness</label><input type="range" class="sys" id="setBright2" min="30" max="100" value="'+state.brightness+'"><span class="sval" id="setBright2V">'+state.brightness+'%</span></div>'
 +'<div class="srow"><label>Pointer speed</label><input type="range" class="sys" id="setPtr" min="0" max="100" value="50"><span class="sval" id="setPtrV">50%</span></div>'
 +'<div class="cap" style="margin:10px 0 7px">XY pad · pointer offset</div><div class="xypad" id="xyPad"><div class="xydot" id="xyDot" style="left:50%;top:50%"></div></div><div class="mono" style="font-size:11px;color:#9a9a9a;margin-top:6px">X <b style="color:#ddd" id="xyX">0.50</b> &nbsp; Y <b style="color:#ddd" id="xyY">0.50</b></div>'
 +'<div class="cap" style="margin:12px 0 4px">Pointer scheme</div><label class="radio"><input type="radio" name="ptr" checked> Default</label><label class="radio"><input type="radio" name="ptr"> Large</label><label class="radio"><input type="radio" name="ptr"> Crosshair</label></div>'
 +'<div class="tabpane" data-pane="2">'
 +'<div class="srow"><label>Volume</label><input type="range" class="sys" id="setVol2" min="0" max="100" value="'+state.volume+'"><span class="sval" id="setVol2V">'+state.volume+'%</span></div>'
 +'<div class="cap" style="margin:10px 0 6px">Output level</div><div class="meter"><i id="soundMeter" style="width:'+state.volume+'%"></i></div>'
 +'<div style="display:flex;gap:8px;margin-top:12px;align-items:center"><button class="btn sm" id="testSound">Test sound</button><span class="mono" style="font-size:11px;color:#888" id="soundMsg">Output: Speakers · 48 kHz</span></div></div>'
 +'</div>'+statusbar('CONTROL PANEL','APPLY: LIVE');
}
/* ---------- per-app init ---------- */
var monTimer=null,upTimer=null,plotData=[];
function initApp(id,el){
 $$('[data-open]',el).forEach(function(b){b.addEventListener('click',function(){openApp(b.getAttribute('data-open'))})});
 if(id==='home'){var t0=Date.now();clearInterval(upTimer);upTimer=setInterval(function(){var e=$('#uptimeEl');if(!e){clearInterval(upTimer);return}var s=Math.floor((Date.now()-t0)/1000);e.textContent=pad(Math.floor(s/60))+':'+pad(s%60)},1000)}
 if(id==='files'){$$('#fileTree button',el).forEach(function(b){b.addEventListener('click',function(){$$('#fileTree button',el).forEach(function(x){x.classList.remove('sel')});b.classList.add('sel');var k=b.getAttribute('data-folder');$('#fileList',el).innerHTML=fileRows(k);$('#filesStatus',el).textContent=k+' — '+FILEDATA[k].length+' items';var p=$('#filesPath',el);if(p)p.textContent='/home/'+state.user+(k==='Home'?'':'/'+k.toLowerCase())})});
  $$('.lrow',el).forEach(function(r){r.addEventListener('click',function(){$$('.lrow',el).forEach(function(x){x.classList.remove('sel')});r.classList.add('sel')})});}
 if(id==='terminal')initTerminal(el);
 if(id==='settings')initSettings(el);
 if(id==='monitor')initMonitor(el);
 if(id==='notes'){var ta=$('#notesArea',el);var upd=function(){var v=ta.value;var w=v.trim()?v.trim().split(/\s+/).length:0;$('#notesStatus',el).textContent=w+' words · '+v.length+' chars'};ta.addEventListener('input',upd);upd();
  $('#notesSave',el).addEventListener('click',function(){$('#notesStatus',el).textContent='Saved · '+new Date().toLocaleTimeString();toast('Notes saved (this session only)')});
  $('#notesClear',el).addEventListener('click',function(){ta.value='';upd();ta.focus()});}
}
function initTerminal(el){
 var input=$('#termInput',el),out=$('#termOut',el);
 el.querySelector('.term').addEventListener('click',function(){input.focus()});input.focus();
 function print(html){var d=document.createElement('div');d.innerHTML=html;out.appendChild(d);el.querySelector('.term').scrollTop=1e7}
 input.addEventListener('keydown',function(e){
  if(e.key==='ArrowUp'){e.preventDefault();if(state.termHi>0){state.termHi--;input.value=state.termHist[state.termHi]||''}return}
  if(e.key==='ArrowDown'){e.preventDefault();state.termHi=Math.min(state.termHist.length,state.termHi+1);input.value=state.termHist[state.termHi]||'';return}
  if(e.key!=='Enter')return;
  var raw=input.value;var cmd=raw.trim();print('<span>'+esc(state.user)+'@nct:~$</span> '+esc(raw));input.value='';
  if(cmd) {state.termHist.push(cmd);state.termHi=state.termHist.length}
  if(!cmd)return;
  var parts=cmd.split(/\s+/),c=parts[0].toLowerCase(),rest=cmd.slice(parts[0].length).trim();
  var d=new Date();
  if(c==='help')print('<span class="dim">help  ls  pwd  date  echo &lt;text&gt;  clear  whoami  neofetch  about  exit</span>');
  else if(c==='ls')print('Documents&nbsp;&nbsp;Projects&nbsp;&nbsp;Pictures&nbsp;&nbsp;notes.txt');
  else if(c==='pwd')print('/home/'+esc(state.user));
  else if(c==='date')print(d.toString());
  else if(c==='echo')print(esc(rest));
  else if(c==='clear')out.innerHTML='';
  else if(c==='whoami')print(state.user);
  else if(c==='neofetch'||c==='about')print('<span class="usr">NOCTIVAGOUS 4.2</span>\n<span class="dim">Kernel 6.8-NCT · Session '+state.session+' · Shell nctsh 1.4 · Uptime live</span>');
  else if(c==='exit'){var w=el.closest('.nwin');if(w){w.remove();delete wins.terminal;syncTasks()}}
  else print('<span style="color:#ff8a80">nctsh: command not found: '+esc(c)+'</span> <span class="dim">— try help</span>');
 });
}
function setVolume(v){state.volume=v;$('#volStat').textContent=v+'%';var lv=$('#loginVolStat');if(lv)lv.textContent='VOL '+v+'%';['setVol','setVol2'].forEach(function(i){var e=document.getElementById(i);if(e)e.value=v});['setVolV','setVol2V'].forEach(function(i){var e=document.getElementById(i);if(e)e.textContent=v+'%'});var m=$('#soundMeter');if(m)m.style.width=v+'%'}
function setBrightness(v){state.brightness=v;var o=((100-v)/100)*0.55;$('#brightVeil').style.opacity=o;var bl=$('#brightVeilLogin');if(bl)bl.style.opacity=o;['setBright','setBright2'].forEach(function(i){var e=document.getElementById(i);if(e)e.value=v});['setBrightV','setBright2V'].forEach(function(i){var e=document.getElementById(i);if(e)e.textContent=v+'%'})}
function initSettings(el){
 $$('.tabstrip button',el).forEach(function(b){b.addEventListener('click',function(){$$('.tabstrip button',el).forEach(function(x){x.classList.remove('sel')});b.classList.add('sel');$$('.tabpane',el).forEach(function(p){p.classList.toggle('sel',p.getAttribute('data-pane')===b.getAttribute('data-tab'))})})});
 var bind=function(iid,vid,fn){var inp=document.getElementById(iid);if(!inp)return;inp.addEventListener('input',function(){fn(parseInt(inp.value,10))})};
 bind('setVol',null,setVolume);bind('setVol2',null,setVolume);bind('setBright',null,setBrightness);bind('setBright2',null,setBrightness);
 bind('setPtr',null,function(v){var e=$('#setPtrV');if(e)e.textContent=v+'%'});
 $$('.swatch',el).forEach(function(s){s.addEventListener('click',function(){var w=parseInt(s.getAttribute('data-wp'),10);state.wall=w;$('#deskWall').setAttribute('data-w',w);$('#loginWall').setAttribute('data-w',w);$$('.swatch',el).forEach(function(x){x.classList.remove('sel')});s.classList.add('sel')})});
 var anim=$('#chkAnim',el);if(anim)anim.addEventListener('change',function(){document.body.classList.toggle('noanim',!anim.checked);toast('Animations '+(anim.checked?'on':'off'))});
 var padEl=$('#xyPad',el);
 if(padEl){var dot=$('#xyDot',el);var setXY=function(cx,cy){var r=padEl.getBoundingClientRect();var x=Math.max(0,Math.min(1,(cx-r.left)/r.width)),y=Math.max(0,Math.min(1,(cy-r.top)/r.height));dot.style.left=(x*100)+'%';dot.style.top=(y*100)+'%';$('#xyX',el).textContent=x.toFixed(2);$('#xyY',el).textContent=y.toFixed(2)};
  var dragP=false;padEl.addEventListener('mousedown',function(e){dragP=true;setXY(e.clientX,e.clientY)});document.addEventListener('mousemove',function(e){if(dragP)setXY(e.clientX,e.clientY)});document.addEventListener('mouseup',function(){dragP=false});
  padEl.addEventListener('touchstart',function(e){var t=e.touches[0];setXY(t.clientX,t.clientY)},{passive:true});padEl.addEventListener('touchmove',function(e){var t=e.touches[0];setXY(t.clientX,t.clientY)},{passive:true});}
 var ts=$('#testSound',el);if(ts)ts.addEventListener('click',function(){try{var Ctx=window.AudioContext||window.webkitAudioContext;var ctx=new Ctx();var o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=660;g.gain.value=Math.max(0.02,state.volume/100*0.18);o.connect(g);g.connect(ctx.destination);o.start();g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.45);o.stop(ctx.currentTime+0.5)}catch(err){}$('#soundMsg',el).textContent='Test tone played · '+state.volume+'%'});
 setVolume(state.volume);setBrightness(state.brightness);
}
function initMonitor(el){
 var cv=$('#plotCanvas',el);if(!cv)return;var ctx=cv.getContext('2d');plotData=[];for(var i=0;i<60;i++)plotData.push(30+Math.random()*25);
 var procs=[['window-manager',412],['files',688],['terminal',731],['settings',802],['monitor',915],['dock',388]];
 clearInterval(monTimer);
 function draw(){ctx.fillStyle='#070707';ctx.fillRect(0,0,cv.width,cv.height);ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=1;for(var g=0;g<=4;g++){var y=10+g*22;ctx.beginPath();ctx.moveTo(28,y);ctx.lineTo(cv.width-6,y);ctx.stroke();ctx.fillStyle='#666';ctx.font='9px JetBrains Mono';ctx.fillText(String(100-g*25),4,y+3)}ctx.strokeStyle='#5cb85c';ctx.lineWidth=1.6;ctx.beginPath();plotData.forEach(function(v,i){var x=28+i*((cv.width-36)/59),y=98-(v/100)*88;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
 function step(){
  if(!document.body.contains(el)){clearInterval(monTimer);return}
  var cpu=Math.round(28+Math.random()*38),mem=Math.round(48+Math.random()*14),disk=Math.round(36+Math.random()*10);
  var set=function(n,v){var b=$('#mon'+n,el),t=$('#mon'+n+'V',el);if(b)b.style.width=v+'%';if(t)t.textContent=v+'%'};
  set('CPU',cpu);set('Memory',mem);set('Disk',disk);
  plotData.push(cpu);plotData.shift();draw();
  var pl=$('#procList',el);if(pl)pl.innerHTML=procs.map(function(p){return '<div class="lrow" style="grid-template-columns:1fr 74px 92px"><span>'+p[0]+'</span><span class="sz">'+p[1]+'</span><span class="tp">'+(Math.random()*9).toFixed(1)+'%</span></div>'}).join('');
  var nd=$('#netDown',el);if(nd)nd.textContent=(0.6+Math.random()*1.4).toFixed(2)+' MB/s';var nu=$('#netUp',el);if(nu)nu.textContent=(0.1+Math.random()*0.5).toFixed(2)+' MB/s';var tv=$('#tempV',el);if(tv)tv.textContent=Math.round(50+Math.random()*9)+'°C';
  var wc=$('#wCpu');if(wc){wc.style.width=cpu+'%';$('#wCpuV').textContent=cpu+'%';$('#wMem').style.width=mem+'%';$('#wMemV').textContent=mem+'%';var nn=Math.round(12+Math.random()*30);$('#wNet').style.width=nn+'%';$('#wNetV').textContent=nn+'%'}
 }
 step();monTimer=setInterval(step,900);
}
/* battery drift (display only, slow) */
setInterval(function(){var b=$('#battStat');if(b&&Math.random()<0.25){var v=parseInt(b.textContent,10);if(v>20)b.textContent=(v-1)+'%'}},30000);
document.addEventListener('keydown',function(e){
 if(e.key==='Escape')closeAllMenus();
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='l'&&$('#desktopScreen').classList.contains('on')){e.preventDefault();lockScreen()}
});
window.addEventListener('resize',function(){Object.keys(wins).forEach(function(id){clampWin(wins[id].el)})});
setBrightness(state.brightness);
})();

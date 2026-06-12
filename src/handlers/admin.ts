// GET /admin — a tiny self-contained stats panel.
//
// The page itself carries no secret and is safe to serve publicly: all data is
// loaded from the authenticated /api/* endpoints. Auth = paste your API key
// once; it is kept in sessionStorage and sent as a Bearer token. For real SSO,
// put Cloudflare Access in front of /admin (no code change needed).

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>cf-redirector · panel</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.5 system-ui, sans-serif; background: #0e1116; color: #e6edf3; }
  .wrap { max-width: 880px; margin: 0 auto; padding: 28px 18px 60px; }
  h1 { font-size: 20px; margin: 0; letter-spacing: .3px; }
  h1 small { color: #7d8590; font-weight: 400; font-size: 13px; }
  a { color: #6cb6ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .dim { color: #7d8590; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  input, button { font: inherit; }
  input { background: #161b22; border: 1px solid #30363d; color: #e6edf3; border-radius: 8px; padding: 9px 11px; }
  input:focus { outline: none; border-color: #4493f8; }
  button { background: #238636; border: 0; color: #fff; border-radius: 8px; padding: 9px 14px; cursor: pointer; }
  button:hover { background: #2ea043; }
  button.ghost { background: #21262d; }
  button.ghost:hover { background: #30363d; }
  button.stbtn, button.edbtn, button.delbtn { background: #21262d; padding: 4px 10px; font-size: 13px; }
  button.stbtn:hover, button.edbtn:hover { background: #30363d; }
  button.delbtn { color: #ff9a8d; }
  button.delbtn:hover { background: #5a2a2a; }
  td.actions { white-space: nowrap; }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
  form.create { display: flex; gap: 10px; margin: 0 0 18px; flex-wrap: wrap; }
  form.create input[name=url] { flex: 1 1 320px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #21262d; }
  th { color: #7d8590; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
  td.url { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #msg { min-height: 20px; font-size: 13px; margin: 8px 0; }
  #msg.err { color: #ff7b72; }
  #msg.ok { color: #3fb950; }
  #detail { display: none; margin-top: 26px; padding: 18px; background: #161b22; border: 1px solid #30363d; border-radius: 12px; }
  #detail h3 { margin: 0 0 14px; font-size: 16px; }
  .bar { display: grid; grid-template-columns: 92px 1fr 44px; align-items: center; gap: 10px; margin: 3px 0; font-size: 13px; }
  .bar .track { background: #21262d; border-radius: 5px; height: 10px; overflow: hidden; }
  .bar .track i { display: block; height: 100%; background: #4493f8; }
  .bar .cnt { text-align: right; color: #7d8590; font-variant-numeric: tabular-nums; }
  ul.geo { list-style: none; padding: 0; margin: 8px 0 0; columns: 2; font-size: 14px; }
  .card { max-width: 420px; margin: 12vh auto 0; padding: 26px; background: #161b22; border: 1px solid #30363d; border-radius: 14px; }
  .card h1 { margin-bottom: 16px; }
</style>
</head>
<body>
<div class="wrap">

  <div id="login">
    <div class="card">
      <h1>cf-redirector <small>panel</small></h1>
      <p class="dim">Paste your API key to view stats. It stays in this browser session only.</p>
      <div class="row">
        <input id="key" type="password" placeholder="API key" style="flex:1" autocomplete="off">
        <button id="unlock">Unlock</button>
      </div>
    </div>
  </div>

  <div id="app" style="display:none">
    <div class="top">
      <h1>cf-redirector <small id="host"></small></h1>
      <button id="lock" class="ghost">Lock</button>
    </div>

    <form class="create" id="createForm">
      <input name="url" id="url" type="url" placeholder="https://destination.example/article" required>
      <input name="code" id="code" type="text" placeholder="custom code (optional)" style="flex:0 1 200px">
      <button type="submit">Shorten</button>
    </form>

    <div id="msg"></div>

    <table>
      <thead><tr><th>Code</th><th class="num">Clicks</th><th>Destination</th><th>Created</th><th></th></tr></thead>
      <tbody id="rows"></tbody>
    </table>

    <div id="detail"></div>
  </div>

</div>
<script>
  var KEY_NAME='cfr_key';
  function $(s){return document.querySelector(s)}
  function getKey(){return sessionStorage.getItem(KEY_NAME)||''}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function fmtDate(ms){return new Date(ms).toISOString().slice(0,16).replace('T',' ')}
  function refHost(r){if(r==='direct')return 'direct';try{return new URL(r).host||r}catch(e){return r}}
  function msg(t,err){var m=$('#msg');m.textContent=t||'';m.className=err?'err':'ok'}

  function api(path,opts){
    opts=opts||{};
    opts.headers=Object.assign({'Authorization':'Bearer '+getKey()},opts.headers||{});
    return fetch(path,opts).then(function(r){
      if(r.status===401){lock();throw new Error('Unauthorized — wrong API key')}
      return r.json().then(function(b){if(!r.ok)throw new Error(b.error||('HTTP '+r.status));return b});
    });
  }

  function showApp(){$('#login').style.display='none';$('#app').style.display='block';$('#host').textContent=location.host}
  function lock(){sessionStorage.removeItem(KEY_NAME);$('#app').style.display='none';$('#login').style.display='block';$('#key').value=''}
  function unlock(){var k=$('#key').value.trim();if(!k)return;sessionStorage.setItem(KEY_NAME,k);showApp();load()}

  function load(){
    msg('Loading…');
    api('/api/links?limit=200').then(function(b){
      $('#rows').innerHTML = b.links.map(function(l){
        return '<tr><td><a href="/'+encodeURIComponent(l.code)+'" target="_blank" rel="noopener">'+esc(l.code)+'</a></td>'
          +'<td class="num">'+l.clicks+'</td>'
          +'<td class="url" title="'+esc(l.url)+'">'+esc(l.url)+'</td>'
          +'<td class="dim">'+fmtDate(l.created_at)+'</td>'
          +'<td class="actions">'
          +'<button class="stbtn" data-code="'+esc(l.code)+'">stats</button> '
          +'<button class="edbtn" data-code="'+esc(l.code)+'" data-url="'+esc(l.url)+'">edit</button> '
          +'<button class="delbtn" data-code="'+esc(l.code)+'">del</button>'
          +'</td></tr>';
      }).join('') || '<tr><td colspan="5" class="dim">No links yet — create one above.</td></tr>';
      Array.prototype.forEach.call(document.querySelectorAll('.stbtn'),function(b){
        b.onclick=function(){showStats(b.getAttribute('data-code'))};
      });
      Array.prototype.forEach.call(document.querySelectorAll('.edbtn'),function(b){
        b.onclick=function(){editLink(b.getAttribute('data-code'),b.getAttribute('data-url'))};
      });
      Array.prototype.forEach.call(document.querySelectorAll('.delbtn'),function(b){
        b.onclick=function(){delLink(b.getAttribute('data-code'))};
      });
      msg('');
    }).catch(function(e){msg(e.message,true)});
  }

  function showStats(code){
    api('/api/stats/'+encodeURIComponent(code)+'?bots=exclude').then(function(s){
      var max=s.byDay.reduce(function(m,d){return Math.max(m,d.clicks)},1);
      var bars=s.byDay.map(function(d){
        var w=Math.round(d.clicks/max*100);
        return '<div class="bar"><span class="dim">'+d.day+'</span><span class="track"><i style="width:'+w+'%"></i></span><span class="cnt">'+d.clicks+'</span></div>';
      }).join('') || '<div class="dim">No human clicks yet.</div>';
      var geo=s.byCountry.map(function(c){return '<li>'+esc(c.country)+' <span class="dim">— '+c.clicks+'</span></li>'}).join('');
      var ref=(s.byReferer||[]).map(function(c){return '<li>'+esc(refHost(c.referer))+' <span class="dim">— '+c.clicks+'</span></li>'}).join('');
      $('#detail').innerHTML='<h3>/'+esc(code)+' · '+s.total+' clicks <span class="dim">(bots excluded)</span></h3>'
        +'<div>'+bars+'</div>'
        +(geo?'<h4 class="dim">By country</h4><ul class="geo">'+geo+'</ul>':'')
        +(ref?'<h4 class="dim">By referrer</h4><ul class="geo">'+ref+'</ul>':'');
      $('#detail').style.display='block';
      $('#detail').scrollIntoView({behavior:'smooth',block:'nearest'});
    }).catch(function(e){msg(e.message,true)});
  }

  function editLink(code,url){
    var nu=prompt('New destination URL for /'+code, url||'');
    if(nu===null)return;
    nu=nu.trim(); if(!nu)return;
    api('/api/links/'+encodeURIComponent(code),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:nu})})
      .then(function(){msg('Updated /'+code);load()}).catch(function(e){msg(e.message,true)});
  }

  function delLink(code){
    if(!confirm('Delete /'+code+' and all its clicks? This cannot be undone.'))return;
    api('/api/links/'+encodeURIComponent(code),{method:'DELETE'})
      .then(function(){msg('Deleted /'+code);if($('#detail'))$('#detail').style.display='none';load()})
      .catch(function(e){msg(e.message,true)});
  }

  function create(ev){
    ev.preventDefault();
    var url=$('#url').value.trim(); var code=$('#code').value.trim();
    if(!url)return;
    var body={url:url}; if(code)body.code=code;
    api('/api/links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){
      $('#url').value=''; $('#code').value='';
      msg('Created '+r.shortUrl); load();
    }).catch(function(e){msg(e.message,true)});
  }

  document.addEventListener('DOMContentLoaded',function(){
    $('#unlock').onclick=unlock;
    $('#key').addEventListener('keydown',function(e){if(e.key==='Enter')unlock()});
    $('#lock').onclick=lock;
    $('#createForm').addEventListener('submit',create);
    if(getKey()){showApp();load()}
  });
</script>
</body>
</html>`;

export function handleAdmin(): Response {
  return new Response(PAGE, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

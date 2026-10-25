/* La Bolita Jalisciense · lógica de la página (sin servidor: los datos viven en el navegador).
   En un sitio normal (GitHub Pages) no existe window.claude, así que se define una descarga por enlace. */
if(!window.claude){
  var MIME={pdf:"application/pdf",csv:"text/csv;charset=utf-8",png:"image/png",jpg:"image/jpeg"};
  window.claude={use:async function(n){
    if(n!=="downloads")return null;
    return{save:async function(o){
      var ext=(o.filename.split(".").pop()||"").toLowerCase();
      var b=(o.data instanceof Blob)?o.data:new Blob([o.data],{type:MIME[ext]||"application/octet-stream"});
      var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=o.filename;
      document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500);
      return{status:"saved"}
    }}
  }}
}
var ADMIN_TEL=BJ_CONFIG.adminTel, ADMIN_HASH=BJ_CONFIG.adminHash;
var K={cfg:"bj_cfg",res:"bj_res",next:"bj_next",ses:"bj_cel"};
var CFG={precio:1.5,desc:[{min:100,precio:1.4}],txt:{}}, cel=null, isAdm=false, ed=[];
function $(i){return document.getElementById(i)}
function ld(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function mx(n){return "$"+n.toFixed(2)+" MXN"}
function pad(n){return String(n).padStart(8,"0")}
function E(t,txt,c){var e=document.createElement(t);if(txt!==undefined)e.textContent=txt;if(c)e.className=c;return e}
async function sha(s){var b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,"0")}).join("")}
function ldCfg(){var c=ld(K.cfg,null);if(c&&c.precio>0&&Array.isArray(c.desc)){CFG=c;CFG.txt=CFG.txt||{}}}
function pu(q,c){var p=c.precio;c.desc.slice().sort(function(a,b){return a.min-b.min}).forEach(function(d){if(q>=d.min)p=d.precio});return p}
function calc(q){var R=curR(),p=R?R.precio:CFG.precio;return{p:p,t:Math.round(q*p*100)/100,d:""}}
function est(r){var s=r.estado==="pagado"?"validado":r.estado;return(s==="pendiente"&&Date.now()-r.ts>864e5)?"expirada":s}
function fecha(ts){return new Date(ts).toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"})}
function rPrice(){var p=$("precio");p.textContent=mx(CFG.precio);p.appendChild(E("small","por boleto"))}
function rDT(){}
function upd(){var q=Math.max(1,parseInt($("qty").value)||1),r=calc(q);$("tot").textContent=mx(r.t)}
function rifaNom(r){return r.rn||(CFG.txt&&CFG.txt.nombre)||"La Bolita Jalisciense"}
function rMine(){
  rUp();var box=$("mine");box.textContent="";
  var l=ld(K.res,[]).filter(function(r){return r.cel===cel}).reverse();
  if(!l.length){box.textContent="Aún no tienes reservas.";return}
  var ST=["pendiente","revision","validado"],TP={revision:"Comprobante enviado. Esperando que el administrador revise tu pago.",validado:"Pago validado. Ya puedes descargar tu boleto en PDF.",rechazado:"Tu pago fue rechazado y tus números se liberaron. Puedes hacer una nueva reserva.",expirada:"Se acabó el tiempo para pagar y tus números se liberaron.",liberada:"Tus números fueron liberados."};
  l.forEach(function(r){
    var s=est(r),t=E("div",null,"tk "+s),hd=E("div",null,"tkh");
    hd.appendChild(E("span","🎱 "+rifaNom(r)));hd.appendChild(E("span",LB[s]||s,"bd "+s));t.appendChild(hd);
    var bd=E("div",null,"tkb");
    function row(a,v){var d=E("div",null,"tkr");d.appendChild(E("span",a+": ","tkl"));d.appendChild(document.createTextNode(v));bd.appendChild(d)}
    row("Rifa",rifaNom(r));row("Código",r.code);row("Fecha y hora de compra",fecha(r.ts));row("Total",mx(r.t)+" · "+r.q+" boletos");
    bd.appendChild(E("div","Boletos seleccionados:","tkl"));
    var nb=E("div",null,"tkn");numsOf(r).forEach(function(n){nb.appendChild(E("span",pad(n)))});bd.appendChild(nb);
    var i=ST.indexOf(s);
    if(i>=0){var p=E("div",null,"note");["1. Subir pago","2. Revisión de pago","3. Validado"].forEach(function(x,j){var sp=E("span",x+(j<2?"  →  ":""));if(j===i)sp.style.cssText="font-weight:700;color:var(--acc)";p.appendChild(sp)});bd.appendChild(p)}
    if(s==="pendiente"){var hr=Math.max(0,Math.ceil((864e5-(Date.now()-r.ts))/36e5));bd.appendChild(E("div","Te quedan unas "+hr+" h para subir tu comprobante con el botón de arriba; después los números se liberan.","note"))}
    else if(TP[s])bd.appendChild(E("div",TP[s],"note"));
    var tb=E("button","⬇ Descargar boleto (PDF)","mini"),tm=E("div",s==="validado"?"":"El boleto se habilita cuando tu pago sea validado.","note");
    tb.disabled=s!=="validado";tb.onclick=function(){bajarBoleto(r.code,function(x){tm.textContent=x})};
    bd.appendChild(tb);bd.appendChild(tm);t.appendChild(bd);box.appendChild(t)
  })
}
function rEd(){}
function rAdm(){rTxt();rHist();rLista();rDBList();
  $("aPrecio").value=CFG.precio;ed=[];
  var all=ld(K.res,[]),f=$("aFil").value,pag=0,n={pendiente:0,revision:0,validado:0,rechazado:0,expirada:0,liberada:0};
  all.forEach(function(r){var s=est(r);n[s]++;if(s==="validado")pag+=r.t});
  $("aStats").textContent=all.length+" reservas · "+n.pendiente+" por pagar · "+n.revision+" en revisión · "+n.validado+" validadas ("+mx(pag)+") · "+n.rechazado+" rechazadas · "+n.expirada+" expiradas · "+n.liberada+" liberadas";
  var t=$("aTab");t.textContent="";var hr=E("tr");
  ["Código","Celular","Boletos","Total","Fecha","Estado","Acciones"].forEach(function(x){hr.appendChild(E("th",x))});t.appendChild(hr);
  all.slice().reverse().forEach(function(r){
    var s=est(r);if(f!=="todas"&&f!==s)return;
    var tr=E("tr");
    tr.appendChild(E("td",r.code+(r.rn?" · "+r.rn:"")));tr.appendChild(E("td",r.cel));
    tr.appendChild(nTd(r));
    tr.appendChild(E("td",mx(r.t)+" ("+mx(r.p)+" c/u)"));tr.appendChild(E("td",fecha(r.ts)));
    var te=E("td");te.appendChild(E("span",LB[s]||s,"bd "+s));tr.appendChild(te);
    tr.appendChild(acts(r));t.appendChild(tr)
  })
}
function setEst(code,e){var l=ld(K.res,[]);l.forEach(function(r){if(r.code===code){r.estado=e;if(e==="validado")r.vts=Date.now()}});sv(K.res,l);rAdm();rMine();if(DBK!==null)rDB()}
function show(c){
  cel=c;$("login").classList.add("hide");$("app").classList.remove("hide");
  $("who").textContent="+52 "+c+(isAdm?" (administrador)":"");$("btnOut").hidden=false;
  if(isAdm){$("adm").classList.remove("hide");rAdm();tab("costos")}
  rMine();upd()
}
$("cel").oninput=function(){
  var c=$("cel").value.replace(/\D/g,"").slice(0,10);$("cel").value=c;
  $("pwBox").classList.toggle("hide",c!==ADMIN_TEL);$("err").textContent="";
  if(c.length===10&&c!==ADMIN_TEL){isAdm=false;sv(K.ses,c);show(c)}
};
$("btnIn").onclick=async function(){
  var c=$("cel").value.replace(/\D/g,"");
  if(c.length!==10){$("err").textContent="Ingresa un número válido de 10 dígitos.";return}
  if(c===ADMIN_TEL){
    var pw=$("pw").value;
    if(!pw){$("err").textContent="Ingresa la contraseña de administrador.";return}
    var hh="";try{hh=await sha(pw)}catch(e){}
    if(hh!==ADMIN_HASH){$("err").textContent="Contraseña incorrecta.";return}
    isAdm=true;try{sessionStorage.setItem("bj_adm","1")}catch(e){}
  }
  $("err").textContent="";$("pw").value="";sv(K.ses,c);show(c)
};
$("btnOut").onclick=function(){
  try{localStorage.removeItem(K.ses);sessionStorage.removeItem("bj_adm")}catch(e){}
  isAdm=false;cel=null;$("btnOut").hidden=true;$("app").classList.add("hide");$("adm").classList.add("hide");
  $("login").classList.remove("hide");$("res").textContent="";clrPrev();$("cel").value="";$("pwBox").classList.add("hide")
};
$("qty").oninput=function(){upd();clrPrev()};
var PV=null;
function clrPrev(){PV=null;rPrev()}
function rPrev(){
  var b=$("prevBox");if(!PV){b.classList.add("hide");return}
  b.classList.remove("hide");$("prevT").textContent=PV.q+" boletos · Total "+mx(calc(PV.q).t);$("prevNums").textContent=PV.nums.map(pad).join("   ")
}
function genPrev(){
  if(!cel)return;
  var q=Math.min(1000,Math.max(1,parseInt($("qty").value)||1)),R=curR(),rid=R?R.id:"",used=tomados(rid);
  $("res").textContent="";
  if(used.size+q>99999999){PV=null;rPrev();$("res").textContent="No hay suficientes boletos disponibles.";return}
  PV={q:q,rid:rid,nums:azar(q,used).sort(function(a,b){return a-b})};rPrev()
}
$("btnRes").onclick=genPrev;$("btnRef").onclick=genPrev;
$("btnOk").onclick=function(){
  if(!cel||!PV)return;
  var q=PV.q,rid=PV.rid,R=RF.filter(function(z){return z.id===rid})[0]||null,used=tomados(rid);
  if(PV.nums.some(function(n){return used.has(n)})){genPrev();$("res").textContent="Algunos de esos números ya no estaban libres. Te mostramos otros: revísalos y acepta de nuevo.";return}
  var r=calc(q),code="BJ-"+Math.random().toString(36).slice(2,8).toUpperCase();
  var l=ld(K.res,[]);l.push({code:code,cel:cel,q:q,p:r.p,t:r.t,nums:PV.nums,ts:Date.now(),estado:"pendiente",rid:rid,rn:R?R.nombre:""});
  if(!sv(K.res,l)){$("res").textContent="No se pudo guardar la reserva en este navegador.";return}
  var d=E("div",null,"ok");d.appendChild(E("b","¡Reserva creada!"));d.appendChild(document.createElement("br"));
  d.appendChild(document.createTextNode("Código "+code+" · "+q+" boletos · Total "+mx(r.t)+". Tienes 24 horas para subir tu comprobante de pago. Tu boleto con la rifa, fecha y hora y tus números aparece en “Mis reservas”; cuando se valide el pago podrás descargarlo en PDF."+(CFG.txt.pago?" Pago: "+CFG.txt.pago:"")));
  clrPrev();$("res").textContent="";$("res").appendChild(d);rMine();if(isAdm){rAdm();rDBList()}
};
$("aFil").onchange=rAdm;
$("aSave").onclick=function(){
  var p=parseFloat($("aPrecio").value),ds=[];
  if(!(p>0)){$("aMsg").textContent="Escribe un precio válido.";return}
  for(var i=0;i<ed.length;i++){var m=parseInt(ed[i].min),pr=parseFloat(ed[i].precio);
    if(!(m>1)||!(pr>0)){$("aMsg").textContent="Revisa los descuentos: cantidad mínima mayor a 1 y precio válido.";return}
    ds.push({min:m,precio:pr})}
  CFG.precio=p;CFG.desc=ds;
  if(!persist()){$("aMsg").textContent="No se pudo guardar en este navegador.";return}
  $("aMsg").textContent="Costos guardados. Las reservas ya creadas conservan su precio original.";
  rPrice();rDT();upd();rAdm()
};
K.hist="bj_hist";K.img="bj_img";
var TB=[["costos","Costos"],["rifas","Nueva rifa"],["bases","Bases de datos"],["reservas","Reservas"],["contenido","Contenido"],["imagenes","Imágenes"],["versiones","Versiones"]];
var F=[["nombre","Nombre de la rifa","text"],["premio","Premio principal","text"],["descr","Descripción de la rifa","area"],["fecha","Fecha del sorteo","date"],["hora","Hora del sorteo","time"],["lugar","Lugar del sorteo","text"],["metodo","Método de sorteo","text"],["pago","Instrucciones de pago (CLABE, OXXO, etc.)","area"],["wa","WhatsApp de contacto (10 dígitos)","tel"],["footer","Texto del pie de página","text"],["reglas","Reglamento / términos y condiciones","area"]];
var IMG=[["logo","Logo de la rifa","imgLogo",320,"image/png"],["hero","Imagen principal","imgHero",900,"image/jpeg"]],ORIG={};
function persist(){var ok=sv(K.cfg,CFG);if(ok){var q=ld(K.hist,[]);q.push({ts:Date.now(),cfg:JSON.parse(JSON.stringify(CFG))});sv(K.hist,q.slice(-10))}return ok}
function tab(t){document.querySelectorAll("[data-t]").forEach(function(c){c.classList.toggle("hide",c.getAttribute("data-t")!==t)});document.querySelectorAll(".tb").forEach(function(b){b.classList.toggle("on",b.dataset.k===t)})}
function bTabs(){TB.forEach(function(x){var b=E("button",x[1],"alt mini tb");b.dataset.k=x[0];b.onclick=function(){tab(x[0])};$("aTabs").appendChild(b)})}
function fF(s){if(!s)return"";var d=new Date(s+"T12:00:00");return isNaN(d)?s:d.toLocaleDateString("es-MX",{dateStyle:"long"})}
function rPub(){
  var t=CFG.txt||{},n=t.nombre||"La Bolita Jalisciense";
  document.title=n;$("hTit").textContent=n;
  var rows=[["Premio principal",t.premio],["Sobre la rifa",t.descr],["Fecha del sorteo",t.fecha?fF(t.fecha)+(t.hora?" a las "+t.hora:""):""],["Lugar",t.lugar],["Método de sorteo",t.metodo]].filter(function(r){return r[1]});
  var b=$("info");b.textContent="";$("infoS").classList.toggle("hide",!rows.length);
  rows.forEach(function(r){var c=E("div",null,"card");c.appendChild(E("h3",r[0]));c.appendChild(E("p",r[1]));b.appendChild(c)});
  $("pagoBox").textContent=t.pago?"Instrucciones de pago: "+t.pago:"";
  $("reglasS").classList.toggle("hide",!t.reglas);$("reglasT").textContent=t.reglas||"";
  $("fTxt").textContent=t.footer||(n+" · Sorteos reales entre amigos");
  var c=$("fCt");c.textContent="";var w=(t.wa||"").replace(/\D/g,"");
  if(w.length===10){var a=E("a","Contacto por WhatsApp");a.href="https://wa.me/52"+w;a.target="_blank";a.rel="noopener";a.style.color="var(--acc)";c.appendChild(a)}
}
function rTxt(){
  var b=$("aTxt");b.textContent="";
  F.forEach(function(x){
    b.appendChild(E("label",x[1]));
    var i=x[2]==="area"?E("textarea"):E("input");if(x[2]!=="area")i.type=x[2];
    i.id="t_"+x[0];i.value=(CFG.txt||{})[x[0]]||"";b.appendChild(i)
  })
}
function rHist(){
  var b=$("aHist");b.textContent="";var q=ld(K.hist,[]).slice().reverse();
  if(!q.length){b.appendChild(E("p","Aún no hay versiones guardadas.","note"));return}
  q.forEach(function(v){
    var d=E("div",null,"mr");
    d.appendChild(document.createTextNode(fecha(v.ts)+" · "+mx(v.cfg.precio)+" · "+((v.cfg.txt&&v.cfg.txt.nombre)||"La Bolita Jalisciense")+" "));
    var r=E("button","Restaurar","alt mini");
    r.onclick=function(){CFG=JSON.parse(JSON.stringify(v.cfg));CFG.txt=CFG.txt||{};persist();rPrice();rDT();rPub();upd();rAdm()};
    d.appendChild(r);b.appendChild(d)
  })
}
function bImg(){
  IMG.forEach(function(i){
    ORIG[i[0]]=$(i[2]).src;var d=E("div");d.style.marginBottom="14px";
    d.appendChild(E("label",i[1]));var p=E("img",null,"pv");p.id="pv_"+i[0];p.alt="Vista previa";d.appendChild(p);
    var inp=E("input");inp.type="file";inp.accept="image/jpeg,image/png,image/webp";d.appendChild(inp);
    var rs=E("button","Restaurar original","alt mini");d.appendChild(rs);
    function msg(x){$("aMsgI").textContent=x}
    inp.onchange=function(){
      var f=inp.files[0];if(!f)return;
      if(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>5*1048576){msg("Usa JPG, PNG o WebP de hasta 5 MB.");return}
      var fr=new FileReader();
      fr.onload=function(){var im=new Image();
        im.onload=function(){var w=Math.min(im.width,i[3]),hh=Math.round(im.height*w/im.width),c=document.createElement("canvas");c.width=w;c.height=hh;c.getContext("2d").drawImage(im,0,0,w,hh);
          var s=ld(K.img,{});s[i[0]]=c.toDataURL(i[4],.82);
          if(sv(K.img,s)){rImg();msg("Imagen actualizada.")}else msg("La imagen no cabe en el almacenamiento del navegador.")};
        im.onerror=function(){msg("No se pudo leer la imagen.")};im.src=fr.result};
      fr.readAsDataURL(f)
    };
    rs.onclick=function(){var s=ld(K.img,{});delete s[i[0]];sv(K.img,s);rImg();msg("Imagen original restaurada.")};
    $("aImg").appendChild(d)
  })
}
function rImg(){var s=ld(K.img,{});IMG.forEach(function(i){var e=$(i[2]);e.src=s[i[0]]||ORIG[i[0]];var p=$("pv_"+i[0]);if(p)p.src=e.src})}
$("aSaveTxt").onclick=function(){
  var t={};F.forEach(function(x){var v=$("t_"+x[0]).value.trim().slice(0,3000);if(x[0]==="wa")v=v.replace(/\D/g,"");if(v)t[x[0]]=v});
  CFG.txt=t;if(persist()){rPub();$("aMsgT").textContent="Contenido guardado y publicado en esta página."}else $("aMsgT").textContent="No se pudo guardar en este navegador."
};
K.rifas="bj_rifas";var RF=ld(K.rifas,[]),PM=null;
function idb(){return new Promise(function(ok,no){try{var q=indexedDB.open("bj_media",1);q.onupgradeneeded=function(){q.result.createObjectStore("m")};q.onsuccess=function(){ok(q.result)};q.onerror=function(){no(q.error)}}catch(e){no(e)}})}
function mPut(k,v){return idb().then(function(d){return new Promise(function(ok,no){var t=d.transaction("m","readwrite");t.objectStore("m").put(v,k);t.oncomplete=ok;t.onerror=function(){no(t.error)}})})}
function mGet(k){return idb().then(function(d){return new Promise(function(ok,no){var r=d.transaction("m").objectStore("m").get(k);r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}})})}
function mDel(k){return idb().then(function(d){return new Promise(function(ok){var t=d.transaction("m","readwrite");t.objectStore("m").delete(k);t.oncomplete=ok;t.onerror=ok})})}
function curR(){var s=$("selRifa"),v=s?s.value:"";return RF.filter(function(r){return r.id===v})[0]||null}
function rSel(){
  var s=$("selRifa"),v=s.value;s.textContent="";
  var o=E("option","Rifa principal: "+((CFG.txt&&CFG.txt.nombre)||"La Bolita Jalisciense"));o.value="";s.appendChild(o);
  RF.forEach(function(r){var x=E("option",r.nombre+" ("+mx(r.precio)+")");x.value=r.id;s.appendChild(x)});
  s.value=RF.some(function(r){return r.id===v})?v:"";$("rifaBox").classList.toggle("hide",!RF.length)
}
function mkMedia(t,src,alt){var e=t==="video"?E("video"):E("img");if(t==="video"){e.controls=true;e.preload="metadata";e.playsInline=true}else e.alt=alt||"";e.className="rmed";e.src=src;return e}
function rPubR(){
  var g=$("rifasG");g.textContent="";$("rifasS").classList.toggle("hide",!RF.length);
  RF.forEach(function(r){
    var c=E("div",null,"card"),m=E("div");c.appendChild(m);
    if(r.m)mGet(r.id).then(function(d){if(d)m.appendChild(mkMedia(r.m,d,r.nombre))}).catch(function(){});
    c.appendChild(E("h3",r.nombre));
    if(r.premio)c.appendChild(E("p","Premio: "+r.premio));
    if(r.descr)c.appendChild(E("p",r.descr));
    c.appendChild(E("p",mx(r.precio)+" por boleto"+(r.fecha?" · Sorteo: "+fF(r.fecha):""),"note"));
    var b=E("button","Participar en esta rifa");b.onclick=function(){$("selRifa").value=r.id;upd();$("compra").scrollIntoView({behavior:"smooth"})};
    c.appendChild(b);g.appendChild(c)
  })
}
function rLista(){
  var b=$("rLista");b.textContent="";
  if(!RF.length){b.appendChild(E("p","Aún no has creado rifas nuevas.","note"));return}
  RF.forEach(function(r){
    var d=E("div",null,"mr");
    d.appendChild(document.createTextNode(r.nombre+" · "+mx(r.precio)+(r.fecha?" · "+fF(r.fecha):"")+(r.m?" · con "+(r.m==="video"?"video":"imagen"):"")+" "));
    var x=E("button","Eliminar","alt mini"),arm=false;
    x.onclick=function(){
      if(!arm){arm=true;x.textContent="¿Seguro? Eliminar";return}
      RF=RF.filter(function(z){return z.id!==r.id});sv(K.rifas,RF);if(r.m)mDel(r.id);
      rLista();rPubR();rSel();upd()
    };
    var v=E("button","Ver base de datos","alt mini");v.onclick=function(){abrirDB(r.id)};d.appendChild(v);d.appendChild(x);b.appendChild(d)
  })
}
function rMsg(x){$("rMsg").textContent=x}
$("rMedia").onchange=function(){
  var f=this.files[0],pv=$("rPrev");PM=null;pv.textContent="";if(!f)return;
  var img=/^image\/(jpeg|png|webp)$/.test(f.type),vid=/^video\/(mp4|webm)$/.test(f.type);
  if(!img&&!vid){rMsg("Formato no permitido. Usa JPG, PNG, WebP, MP4 o WebM.");return}
  if(f.size>(img?5:20)*1048576){rMsg(img?"La imagen pesa más de 5 MB.":"El video pesa más de 20 MB.");return}
  rMsg("Cargando archivo...");
  var fr=new FileReader();
  fr.onerror=function(){rMsg("No se pudo leer el archivo.")};
  fr.onload=function(){
    if(vid){PM={t:"video",d:fr.result};pv.appendChild(mkMedia("video",fr.result));rMsg("Video listo. Falta crear la rifa.");return}
    var im=new Image();
    im.onload=function(){var w=Math.min(im.width,900),hh=Math.round(im.height*w/im.width),c=document.createElement("canvas");c.width=w;c.height=hh;c.getContext("2d").drawImage(im,0,0,w,hh);
      var u=c.toDataURL("image/jpeg",.82);PM={t:"image",d:u};pv.appendChild(mkMedia("image",u,"Vista previa"));rMsg("Imagen lista. Falta crear la rifa.")};
    im.onerror=function(){rMsg("No se pudo leer la imagen.")};im.src=fr.result
  };
  fr.readAsDataURL(f)
};
$("rCrear").onclick=async function(){
  var nom=$("rNom").value.trim(),prc=parseFloat($("rPrc").value);
  if(!nom){rMsg("Escribe el nombre de la rifa.");return}
  if(!(prc>0)){rMsg("Escribe un precio por boleto válido.");return}
  var r={id:"r"+Date.now().toString(36),nombre:nom,premio:$("rPre").value.trim(),descr:$("rDes").value.trim(),fecha:$("rFec").value,precio:Math.round(prc*100)/100,next:1,m:""};
  if(PM){try{await mPut(r.id,PM.d);r.m=PM.t}catch(e){rMsg("No se pudo guardar el archivo en este navegador. La rifa no se creó.");return}}
  RF.push(r);
  if(!sv(K.rifas,RF)){RF.pop();if(r.m)mDel(r.id);rMsg("No se pudo guardar la rifa.");return}
  ["rNom","rPre","rDes","rFec"].forEach(function(i){$(i).value=""});$("rPrc").value=CFG.precio;$("rMedia").value="";$("rPrev").textContent="";PM=null;
  rMsg("Rifa creada y publicada en esta página.");rLista();rPubR();rSel()
};
$("selRifa").onchange=function(){upd();clrPrev()};
var DBK=null;
function dbNom(k){if(!k)return"Rifa principal: "+((CFG.txt&&CFG.txt.nombre)||"La Bolita Jalisciense");var r=RF.filter(function(z){return z.id===k})[0];if(r)return r.nombre;var o=ld(K.res,[]).filter(function(z){return z.rid===k})[0];return(o?o.rn:"Rifa")+" (eliminada)"}
function dbRows(k){return ld(K.res,[]).filter(function(r){return(r.rid||"")===k})}
function dbKeys(){var ks=[""].concat(RF.map(function(r){return r.id}));ld(K.res,[]).forEach(function(r){if(r.rid&&ks.indexOf(r.rid)<0)ks.push(r.rid)});return ks}
function dbStat(rows){var o={n:rows.length,v:0,p:0,rv:0,c:0};rows.forEach(function(r){var s=est(r);if(s==="validado"){o.c+=r.t;o.v+=r.q}if(s==="pendiente")o.p++;if(s==="revision")o.rv++});return o}
function rDBList(){
  var b=$("dbList");b.textContent="";if(!isAdm)return;
  dbKeys().forEach(function(k){
    var s=dbStat(dbRows(k)),d=E("div",null,"mr");d.appendChild(E("b",dbNom(k)));
    d.appendChild(document.createTextNode(" · "+s.n+" reservas · "+s.v+" boletos validados · "+s.p+" por pagar · "+s.rv+" en revisión · "+mx(s.c)+" cobrado "));
    var o=E("button","Abrir base de datos","mini");o.onclick=function(){abrirDB(k)};d.appendChild(o);b.appendChild(d)
  })
}
function abrirDB(k){if(!isAdm)return;DBK=k;tab("bases");$("dbDet").classList.remove("hide");rDB();$("dbDet").scrollIntoView({behavior:"smooth"})}
function dbFilt(){
  var f=$("dbFil").value,q=$("dbQ").value.trim().toLowerCase();
  return dbRows(DBK).filter(function(r){return(f==="todas"||est(r)===f)&&(!q||r.cel.indexOf(q)>=0||r.code.toLowerCase().indexOf(q)>=0)}).reverse()
}
function rDB(){
  if(!isAdm||DBK===null)return;
  $("dbTit").textContent=dbNom(DBK);var s=dbStat(dbRows(DBK));
  $("dbSt").textContent=s.n+" reservas · "+s.v+" boletos validados · "+s.p+" por pagar · "+s.rv+" en revisión · "+mx(s.c)+" cobrado";
  var t=$("dbTab");t.textContent="";var hr=E("tr");
  ["Código","Celular","Boletos","Total","Fecha","Estado","Acciones"].forEach(function(x){hr.appendChild(E("th",x))});t.appendChild(hr);
  dbFilt().forEach(function(r){
    var st=est(r),tr=E("tr");
    tr.appendChild(E("td",r.code));tr.appendChild(E("td",r.cel));
    tr.appendChild(nTd(r));tr.appendChild(E("td",mx(r.t)+" ("+mx(r.p)+" c/u)"));tr.appendChild(E("td",fecha(r.ts)));
    var te=E("td");te.appendChild(E("span",LB[st]||st,"bd "+st));tr.appendChild(te);
    tr.appendChild(acts(r));t.appendChild(tr)
  })
}
function csvE(v){v=String(v);if(/^[=+\-@]/.test(v))v="'"+v;return/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
$("dbFil").onchange=rDB;$("dbQ").oninput=rDB;
$("dbCerrar").onclick=function(){DBK=null;$("dbDet").classList.add("hide")};
$("dbCsv").onclick=async function(){
  if(!isAdm||DBK===null)return;
  var m=$("dbMsg"),dl=null;
  try{dl=window.claude?await window.claude.use("downloads"):null}catch(e){}
  if(!dl){m.textContent="La descarga no está disponible en esta vista.";return}
  var rows=[["Código","Rifa","Celular","Cantidad","Boletos","Precio unitario","Total","Fecha","Estado"]];
  dbRows(DBK).forEach(function(r){rows.push([r.code,dbNom(DBK),r.cel,r.q,numsOf(r).map(pad).join(" "),r.p.toFixed(2),r.t.toFixed(2),fecha(r.ts),LB[est(r)]])});
  var csv="\ufeff"+rows.map(function(x){return x.map(csvE).join(",")}).join("\r\n");
  var slug=dbNom(DBK).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)||"rifa";
  try{await dl.save({filename:"base-"+slug+".csv",data:csv});m.textContent="Archivo CSV listo."}
  catch(e){m.textContent=(e&&e.code==="declined")?"Descarga cancelada.":"No se pudo descargar el archivo."}
};
var LB={pendiente:"Pendiente de pago",revision:"En revisión de pago",validado:"Validado",rechazado:"Rechazado",expirada:"Expirada",liberada:"Liberada"};
function numsOf(r){if(r.nums)return r.nums;var a=[];for(var i=r.from;i<=r.to&&a.length<5000;i++)a.push(i);return a}
function tomados(rid){var s=new Set();ld(K.res,[]).forEach(function(r){if((r.rid||"")!==rid)return;var e=est(r);if(e==="pendiente"||e==="revision"||e==="validado")numsOf(r).forEach(function(n){s.add(n)})});return s}
function azar(q,used){var o=[],M=99999999,b=new Uint32Array(1);while(o.length<q){var n;if(window.crypto&&crypto.getRandomValues){crypto.getRandomValues(b);n=1+b[0]%M}else n=1+Math.floor(Math.random()*M);if(!used.has(n)){used.add(n);o.push(n)}}return o}
function nTd(r){var t=E("td"),d=document.createElement("details");d.appendChild(E("summary",r.q+" boletos"));d.appendChild(E("div",numsOf(r).map(pad).join(", "),"note"));t.appendChild(d);return t}
function b64(u){var s=atob(u.split(",")[1]),a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}
function acts(r){
  var s=est(r),ta=E("td");
  function B(t,c,fn){var b=E("button",t,c);b.onclick=fn;ta.appendChild(b);return b}
  if(s==="revision"){B("Validar","mini",function(){setEst(r.code,"validado")});B("Rechazar","alt mini",function(){setEst(r.code,"rechazado")})}
  var v=B("Ver comprobante","alt mini",function(){verComp(r.code)});
  if(!r.cp){v.disabled=true;v.title="El usuario aún no subió comprobante"}
  if(s==="pendiente"||s==="revision"||s==="validado")B("Liberar","alt mini",function(){setEst(r.code,"liberada")});
  return ta
}
function subirComp(code,f,msg){
  var img=/^image\/(jpeg|png|webp)$/.test(f.type),pdf=f.type==="application/pdf";
  if(!img&&!pdf){msg("Usa una imagen JPG, PNG, WebP o un PDF.");return}
  if(f.size>5*1048576){msg("El archivo pesa más de 5 MB.");return}
  msg("Cargando comprobante...");
  function guardar(o){
    var l=ld(K.res,[]),r=l.filter(function(z){return z.code===code&&z.cel===cel})[0];
    if(!r||est(r)!=="pendiente"){msg("Esta reserva ya no acepta comprobante.");return}
    mPut("p_"+code,o).then(function(){r.estado="revision";r.cp=Date.now();sv(K.res,l);msg("Comprobante enviado. Tu reserva quedó en revisión de pago.");aviso("Archivo aceptado","Tu comprobante se recibió y tu reserva quedó en revisión de pago.");rMine();if(isAdm){rAdm();rDBList()}}).catch(function(){msg("No se pudo guardar el comprobante en este navegador.")})
  }
  var fr=new FileReader();fr.onerror=function(){msg("No se pudo leer el archivo.")};
  fr.onload=function(){
    if(pdf){guardar({t:"pdf",d:fr.result});return}
    var im=new Image();
    im.onload=function(){var w=Math.min(im.width,1200),hh=Math.round(im.height*w/im.width),c=document.createElement("canvas");c.width=w;c.height=hh;c.getContext("2d").drawImage(im,0,0,w,hh);guardar({t:"image",d:c.toDataURL("image/jpeg",.85)})};
    im.onerror=function(){msg("No se pudo leer la imagen.")};im.src=fr.result
  };
  fr.readAsDataURL(f)
}
function ovl(){
  var ov=E("div");ov.style.cssText="position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.82);overflow:auto;padding:max(16px,env(safe-area-inset-top,0px)) 16px 16px";
  var c=E("div",null,"card");c.style.cssText="max-width:720px;margin:0 auto";ov.appendChild(c);document.body.appendChild(ov);
  return{c:c,close:function(){if(ov.parentNode)ov.parentNode.removeChild(ov)}}
}
function verComp(code){
  if(!isAdm)return;
  mGet("p_"+code).then(function(o){
    var r=ld(K.res,[]).filter(function(z){return z.code===code})[0];if(!r)return;
    var s=est(r),m=ovl(),c=m.c;
    c.appendChild(E("h3","Celular: +52 "+r.cel));
    [["Código",r.code],["Rifa",dbNom(r.rid||"")],["Estado",LB[s]||s],["Boletos",r.q+" · Total "+mx(r.t)],["Comprado el",fecha(r.ts)],["Comprobante subido",r.cp?fecha(r.cp):"—"]].forEach(function(x){
      var d=E("div",null,"mr");d.appendChild(E("b",x[0]+": "));d.appendChild(document.createTextNode(x[1]));c.appendChild(d)});
    var dt=document.createElement("details");dt.appendChild(E("summary","Ver los "+r.q+" números"));dt.appendChild(E("div",numsOf(r).map(pad).join(", "),"note"));c.appendChild(dt);
    if(!o)c.appendChild(E("p","No se encontró el comprobante en este navegador.","note"));
    else if(o.t==="image"){var im=E("img");im.src=o.d;im.alt="Comprobante de pago de +52 "+r.cel;im.style.cssText="max-width:100%;max-height:65vh;display:block;margin:12px auto;border-radius:8px";c.appendChild(im)}
    else{c.appendChild(E("p","El comprobante es un archivo PDF."));var pb=E("button","Descargar PDF","alt mini");
      pb.onclick=async function(){var dl=null;try{dl=window.claude?await window.claude.use("downloads"):null}catch(e){}
        if(!dl){pb.textContent="La descarga no está disponible aquí";return}
        try{await dl.save({filename:code+".pdf",data:b64(o.d)})}catch(e){}};c.appendChild(pb)}
    var row=E("div",null,"row");
    if(s==="revision"){
      var v=E("button","Validar pago");v.onclick=function(){m.close();setEst(code,"validado")};row.appendChild(v);
      var x=E("button","Rechazar y liberar números","alt");x.onclick=function(){m.close();setEst(code,"rechazado")};row.appendChild(x)
    }
    if(s==="pendiente"||s==="revision"||s==="validado"){var lb=E("button","Liberar números","alt");lb.onclick=function(){m.close();setEst(code,"liberada")};row.appendChild(lb)}
    var z=E("button","Cerrar","alt");z.onclick=m.close;row.appendChild(z);c.appendChild(row)
  }).catch(function(){})
}
function noComp(scope){
  if(!isAdm)return;
  var all=ld(K.res,[]),idx={},rows=[];
  all.forEach(function(z){numsOf(z).forEach(function(n){var k=(z.rid||"")+":"+n;(idx[k]=idx[k]||[]).push(z)})});
  all.slice().reverse().forEach(function(r){
    if(scope!==undefined&&(r.rid||"")!==scope)return;
    var s=est(r);if(s!=="expirada"&&s!=="rechazado"&&s!=="liberada")return;
    rows.push({r:r,s:s,ns:numsOf(r).map(function(n){return{n:n,nx:(idx[(r.rid||"")+":"+n]||[]).filter(function(z){return z.code!==r.code&&z.ts>r.ts})}})})
  });
  var tn=0,rt=0;rows.forEach(function(w){w.ns.forEach(function(x){tn++;if(x.nx.length)rt++})});
  var m=ovl(),c=m.c;
  c.appendChild(E("h3","No comprobado"+(scope!==undefined?" · "+dbNom(scope):"")));
  c.appendChild(E("p",rows.length+" reservas sin pago comprobado · "+tn+" números · "+rt+" retomados después por otra persona · "+(tn-rt)+" sin volver a tomarse.","note"));
  if(!rows.length)c.appendChild(E("p","Todavía no hay reservas liberadas, rechazadas o expiradas.","note"));
  rows.forEach(function(w){
    var r=w.r,d=E("div",null,"mr");
    d.appendChild(E("b",r.code));d.appendChild(document.createTextNode(" · +52 "+r.cel+" · "+fecha(r.ts)+(r.rn?" · "+r.rn:"")+" · "+mx(r.t)+" · "));
    d.appendChild(E("span",LB[w.s],"bd "+w.s));
    var dt=document.createElement("details");dt.appendChild(E("summary",r.q+" números"));
    var bx=E("div",null,"note");bx.style.cssText="font-family:ui-monospace,Menlo,Consolas,monospace;line-height:1.7";
    w.ns.forEach(function(x){bx.appendChild(E("div",pad(x.n)+" — "+(x.nx.length?"lo tomó después: "+x.nx.map(function(z){return"+52 "+z.cel+" ("+z.code+", "+LB[est(z)]+")"}).join("; "):"sin volver a tomarse")))});
    dt.appendChild(bx);d.appendChild(dt);c.appendChild(d)
  });
  var row=E("div",null,"row"),msg=E("div",null,"note"),ex=E("button","Exportar CSV","alt mini"),z=E("button","Cerrar","alt mini");
  ex.onclick=async function(){
    var dl=null;try{dl=window.claude?await window.claude.use("downloads"):null}catch(e){}
    if(!dl){msg.textContent="La descarga no está disponible en esta vista.";return}
    var out=[["Código","Rifa","Celular","Estado","Fecha de reserva","Número","Lo tomó después (celular)","Código posterior","Estado posterior","Fecha posterior"]];
    rows.forEach(function(w){var r=w.r,b=[r.code,dbNom(r.rid||""),r.cel,LB[w.s],fecha(r.ts)];
      w.ns.forEach(function(x){if(x.nx.length)x.nx.forEach(function(q){out.push(b.concat([pad(x.n),q.cel,q.code,LB[est(q)],fecha(q.ts)]))});else out.push(b.concat([pad(x.n),"","","",""]))})});
    var csv="\ufeff"+out.map(function(a){return a.map(csvE).join(",")}).join("\r\n");
    try{await dl.save({filename:"no-comprobado.csv",data:csv});msg.textContent="Archivo CSV listo."}catch(e){msg.textContent=(e&&e.code==="declined")?"Descarga cancelada.":"No se pudo descargar el archivo."}
  };
  z.onclick=m.close;row.appendChild(ex);row.appendChild(z);c.appendChild(row);c.appendChild(msg)
}
$("aNc").onclick=function(){noComp()};
$("dbNc").onclick=function(){if(DBK!==null)noComp(DBK)};
function ldImg(s){return new Promise(function(ok,no){var i=new Image();i.onload=function(){ok(i)};i.onerror=no;i.src=s})}
async function drawTicket(r){
  var nums=numsOf(r).map(pad),cols=4,rows=Math.ceil(nums.length/cols),W=900,gy=520,H=gy+rows*38+120;
  var c=document.createElement("canvas");c.width=W;c.height=H;var x=c.getContext("2d");
  x.fillStyle="#ffffff";x.fillRect(0,0,W,H);
  var g=x.createLinearGradient(0,0,W,0);g.addColorStop(0,"#4c1d95");g.addColorStop(1,"#0891b2");x.fillStyle=g;x.fillRect(0,0,W,150);
  try{var im=await ldImg($("imgLogo").src);x.save();x.beginPath();x.arc(85,75,55,0,7);x.clip();x.drawImage(im,30,20,110,110);x.restore()}catch(e){}
  var nom=rifaNom(r),fs=40;
  x.fillStyle="#ffffff";x.font="bold "+fs+"px Arial,sans-serif";
  while(x.measureText(nom).width>690&&fs>20){fs-=2;x.font="bold "+fs+"px Arial,sans-serif"}
  x.fillText(nom,170,72);x.font="22px Arial,sans-serif";x.fillText("Boleto de participación",170,110);
  x.fillStyle="#16a34a";x.fillRect(40,172,210,46);x.fillStyle="#ffffff";x.font="bold 24px Arial,sans-serif";x.fillText("VALIDADO",72,204);
  var rf=RF.filter(function(z){return z.id===r.rid})[0],fd=(rf?rf.fecha:(CFG.txt&&CFG.txt.fecha))||"";
  var det=[["Rifa",nom],["Código",r.code],["Celular","+52 "+r.cel],["Boletos",r.q+" · Total "+mx(r.t)+" ("+mx(r.p)+" c/u)"],["Fecha y hora",fecha(r.ts)],["Validado",r.vts?fecha(r.vts):"—"]];
  det.forEach(function(d,i){var y=262+i*34;x.fillStyle="#6b7280";x.font="bold 20px Arial,sans-serif";x.fillText(d[0],40,y);x.fillStyle="#111827";x.font="22px Arial,sans-serif";x.fillText(d[1],170,y)});
  x.fillStyle="#4c1d95";x.font="bold 24px Arial,sans-serif";x.fillText("Boletos seleccionados",40,gy-46);
  x.fillStyle="#111827";x.font="bold 26px 'Courier New',monospace";
  nums.forEach(function(n,i){x.fillText(n,40+(i%cols)*205,gy+Math.floor(i/cols)*38)});
  x.fillStyle="#e5e7eb";x.fillRect(40,H-90,W-80,2);
  x.fillStyle="#6b7280";x.font="18px Arial,sans-serif";
  x.fillText("Conserva este boleto."+(fd?" Sorteo: "+fF(fd)+".":""),40,H-52);x.fillText("Sorteos reales entre amigos",40,H-24);
  return{c:c,gy:gy,H:H}
}
function aviso(t,x){
  var ov=E("div");ov.setAttribute("role","alertdialog");
  ov.style.cssText="position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px";
  var c=E("div",null,"card");c.style.cssText="max-width:340px;width:100%;text-align:center";
  var ic=E("div","✔");ic.style.cssText="width:56px;height:56px;line-height:56px;border-radius:50%;background:#16a34a;color:#fff;font:700 30px system-ui,sans-serif;margin:0 auto 10px";
  c.appendChild(ic);c.appendChild(E("h3",t));c.appendChild(E("p",x,"note"));
  var b=E("button","Entendido");function cerrar(){if(ov.parentNode)ov.parentNode.removeChild(ov)}
  b.onclick=cerrar;c.appendChild(b);ov.appendChild(c);document.body.appendChild(ov);b.focus();setTimeout(cerrar,7000)
}
function mkPdf(pg){
  var parts=[],off=0,xr=[],enc=new TextEncoder();
  function add(x){var u=typeof x==="string"?enc.encode(x):x;parts.push(u);off+=u.length}
  function obj(n,body){xr[n]=off;add(n+" 0 obj\n"+body+"\nendobj\n")}
  add("%PDF-1.4\n");
  obj(1,"<< /Type /Catalog /Pages 2 0 R >>");
  obj(2,"<< /Type /Pages /Count "+pg.length+" /Kids ["+pg.map(function(p,i){return(3+3*i)+" 0 R"}).join(" ")+"] >>");
  pg.forEach(function(p,i){
    var n=3+3*i,ph=p.h*595/p.w,cs="q 595 0 0 "+ph.toFixed(2)+" 0 "+(842-ph).toFixed(2)+" cm /Im0 Do Q";
    obj(n,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 "+(n+2)+" 0 R >> >> /Contents "+(n+1)+" 0 R >>");
    obj(n+1,"<< /Length "+cs.length+" >>\nstream\n"+cs+"\nendstream");
    xr[n+2]=off;add((n+2)+" 0 obj\n<< /Type /XObject /Subtype /Image /Width "+p.w+" /Height "+p.h+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+p.b.length+" >>\nstream\n");add(p.b);add("\nendstream\nendobj\n")
  });
  var N=3+3*pg.length,x0=off;
  add("xref\n0 "+N+"\n0000000000 65535 f \n");
  for(var i=1;i<N;i++)add(("0000000000"+xr[i]).slice(-10)+" 00000 n \n");
  add("trailer\n<< /Size "+N+" /Root 1 0 R >>\nstartxref\n"+x0+"\n%%EOF");
  return new Blob(parts,{type:"application/pdf"})
}
async function ticketPdf(r){
  var t=await drawTicket(r),W=900,P=1272,pg=[],st=0;
  while(st<t.H){
    var en=(st+P>=t.H)?t.H:t.gy+Math.floor((st+P-9-t.gy)/38)*38+9;
    var sc=document.createElement("canvas");sc.width=W;sc.height=en-st;var x=sc.getContext("2d");
    x.fillStyle="#ffffff";x.fillRect(0,0,W,en-st);x.drawImage(t.c,0,st,W,en-st,0,0,W,en-st);
    var bl=await new Promise(function(ok,no){sc.toBlob(function(b){b?ok(b):no()},"image/jpeg",.92)});
    pg.push({b:new Uint8Array(await bl.arrayBuffer()),w:W,h:en-st});st=en
  }
  return mkPdf(pg)
}
async function verBoleto(r){
  try{
    var t=await drawTicket(r),m=ovl(),c=m.c;
    c.appendChild(E("h3","Tu boleto · "+r.code));
    c.appendChild(E("p","Mantén presionada la imagen (o clic derecho) y elige “Guardar imagen” para conservarla.","note"));
    var im=E("img");im.src=t.c.toDataURL("image/png");im.alt="Boleto "+r.code;im.style.cssText="width:100%;height:auto;border-radius:8px;border:1px solid var(--bd)";c.appendChild(im);
    var b=E("button","Cerrar","alt");b.onclick=m.close;c.appendChild(b)
  }catch(e){}
}
async function bajarBoleto(code,msg){
  var r=ld(K.res,[]).filter(function(z){return z.code===code&&z.cel===cel})[0];
  if(!r||est(r)!=="validado"){msg("El boleto se habilita cuando tu pago sea validado.");return}
  msg("Preparando tu boleto...");
  var pdf=null,dl=null;
  try{pdf=await ticketPdf(r)}catch(e){msg("No se pudo generar el PDF. Te mostramos tu boleto como imagen para que lo guardes.");await verBoleto(r);return}
  try{dl=window.claude?await window.claude.use("downloads"):null}catch(e){}
  if(!dl){msg("Esta vista no permite descargar archivos. Te mostramos tu boleto como imagen para que lo guardes.");await verBoleto(r);return}
  try{await dl.save({filename:"boleto-"+r.code+".pdf",data:pdf});msg("Boleto PDF guardado.")}
  catch(e){var k=e&&e.code;if(k==="declined"){msg("Descarga cancelada.");return}
    msg("No se pudo guardar el PDF"+(k?" ("+k+")":"")+". Te mostramos tu boleto como imagen para que lo guardes.");await verBoleto(r)}
}
function rUp(){
  var l=ld(K.res,[]).filter(function(r){return r.cel===cel&&est(r)==="pendiente"}).reverse(),sel=$("upSel"),keep=sel.value;
  sel.textContent="";
  l.forEach(function(r){var o=E("option",r.code+" · "+r.q+" boletos · "+mx(r.t)+(r.rn?" · "+r.rn:""));o.value=r.code;sel.appendChild(o)});
  if(l.some(function(r){return r.code===keep}))sel.value=keep;
  sel.classList.toggle("hide",l.length<2);
  var on=l.length>0;$("upLb").classList.toggle("off",!on);$("upIn").disabled=!on;
  $("upHint").textContent=on?(l.length>1?"Elige la reserva y sube su comprobante.":"Sube el comprobante de tu reserva "+l[0].code+"."):"Cuando tengas una reserva pendiente de pago, aquí subirás tu comprobante."
}
$("upIn").onchange=function(){var f=this.files[0],c=$("upSel").value;this.value="";if(f&&c)subirComp(c,f,function(t){$("upMsg").textContent=t})};
document.querySelectorAll(".qk").forEach(function(b){b.onclick=function(){$("qty").value=b.dataset.q;upd();genPrev()}});
ldCfg();$("rPrc").value=CFG.precio;bTabs();bImg();rPrice();rDT();rImg();rPub();rSel();rPubR();rLista();upd();
var s=ld(K.ses,null);
if(s){if(s===ADMIN_TEL){var ok=false;try{ok=sessionStorage.getItem("bj_adm")==="1"}catch(e){}if(ok){isAdm=true;show(s)}}else show(s)}

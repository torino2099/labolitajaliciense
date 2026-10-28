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
var K={ses:"bj_cel"}, ADMIN_TEL=String((window.BJ_CONFIG||{}).adminTel||"").replace(/\D/g,"");
var CFG={precio:1.5,txt:{},imagenes:{}}, cel=null, isAdm=false, ed=[], S={res:[]}, RF=[];
function RES(){return S.res}
function RFA(){return RF.filter(function(r){return r.activa!==false})}
function msgErr(e){var M={numeros_ocupados:"Esos números ya no están libres.",cantidad_invalida:"La cantidad debe ser de 1 a 1000 boletos.",celular_invalido:"Revisa tu número de celular (10 dígitos).",sin_numeros_libres:"No hay suficientes números libres.",rifa_no_disponible:"Esa rifa ya no está disponible.",reserva_no_acepta_comprobante:"Esta reserva ya no acepta comprobante.",no_autorizado:"Necesitas iniciar sesión como administrador."};return M[e&&e.code]||(e&&e.message)||"Ocurrió un error. Intenta de nuevo."}
function banner(t,ok){var b=$("modoBanner");b.textContent=t;b.classList.toggle("hide",!t)}
function $(i){return document.getElementById(i)}
function ld(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function mx(n){return "$"+n.toFixed(2)+" MXN"}
function pad(n){return String(n).padStart(8,"0")}
function E(t,txt,c){var e=document.createElement(t);if(txt!==undefined)e.textContent=txt;if(c)e.className=c;return e}
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
  var l=RES().filter(function(r){return r.cel===cel}).reverse();
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
function rAdmAll(){rTxt();rHist();rLista();rsUlt();$("aPrecio").value=CFG.precio;rAdm()}
function rAdm(){rDBList();
  var all=RES(),f=$("aFil").value,pag=0,n={pendiente:0,revision:0,validado:0,rechazado:0,expirada:0,liberada:0};
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
async function setEst(code,e){
  try{await DB.setEstado(code,e);await cargaRes();rRes()}catch(x){banner(msgErr(x))}
}
async function cargaRes(){
  try{S.res=isAdm?await DB.adminReservas():(cel?await DB.misReservas(cel):[]);if($("modoBanner").dataset.err)banner("")}
  catch(e){banner("No se pudo conectar con la base de datos: "+msgErr(e));$("modoBanner").dataset.err="1"}
}
function rRes(){rMine();if(isAdm){rAdm();if(DBK!==null)rDB();if(BQ)bBuscar(BQ)}}
async function show(c){
  cel=c;$("login").classList.add("hide");$("app").classList.remove("hide");
  $("who").textContent="+52 "+c;$("btnOut").hidden=false;upd();await cargaRes();rMine()
}
async function showAdmin(){
  isAdm=true;cel=null;$("login").classList.add("hide");$("app").classList.add("hide");$("adm").classList.remove("hide");$("btnOut").hidden=false;
  try{RF=await DB.rifasAdmin()}catch(e){}
  rSel();rPubR();await cargaRes();rAdmAll();tab("costos")
}
function adminEmail(){var e=(window.BJ_CONFIG||{}).adminEmail;return e||(DB.modo==="local"?"admin@demo.test":"")}
async function entrarAdmin(email,pw,el){
  el.textContent="";
  if(!email){el.textContent="Falta configurar adminEmail en js/config.js.";return}
  if(!pw){el.textContent="Ingresa la contraseña de administrador.";return}
  try{
    await DB.login(email,pw);
    if(!await DB.esAdmin()){await DB.logout();el.textContent="Esta cuenta no tiene permisos de administrador.";return}
    await showAdmin()
  }catch(e){el.textContent="No se pudo iniciar sesión: "+msgErr(e)}
}
$("cel").oninput=function(){
  var c=$("cel").value.replace(/\D/g,"").slice(0,10);$("cel").value=c;$("err").textContent="";
  var esAdm=!!ADMIN_TEL&&c===ADMIN_TEL;$("pwBox").classList.toggle("hide",!esAdm);
  if(c.length===10&&!esAdm){isAdm=false;sv(K.ses,c);show(c)}
};
$("btnIn").onclick=async function(){
  var c=$("cel").value.replace(/\D/g,"");
  if(c.length!==10){$("err").textContent="Ingresa un número válido de 10 dígitos.";return}
  if(ADMIN_TEL&&c===ADMIN_TEL){await entrarAdmin(adminEmail(),$("pw").value,$("err"));$("pw").value="";return}
  $("err").textContent="";sv(K.ses,c);show(c)
};
$("pw").onkeydown=function(e){if(e.key==="Enter")$("btnIn").click()};
$("aIn").onclick=async function(){await entrarAdmin($("aEmail").value.trim(),$("aPw").value,$("aErr"));$("aPw").value=""};
$("cpOk").onclick=async function(){
  var a=$("cpN").value,b=$("cpR").value,m=$("cpMsg");
  if(a.length<10){m.textContent="Usa al menos 10 caracteres.";return}
  if(a!==b){m.textContent="Las contraseñas no coinciden.";return}
  try{await DB.cambiarPassword(a);$("cpN").value="";$("cpR").value="";m.textContent="Contraseña actualizada. Úsala la próxima vez que entres."}
  catch(e){m.textContent=msgErr(e)}
};
$("btnOut").onclick=async function(){
  try{localStorage.removeItem(K.ses)}catch(e){}
  if(isAdm){try{await DB.logout()}catch(e){}}
  isAdm=false;cel=null;S.res=[];$("btnOut").hidden=true;$("app").classList.add("hide");$("adm").classList.add("hide");
  $("login").classList.remove("hide");$("res").textContent="";clrPrev();$("cel").value="";$("pw").value="";$("pwBox").classList.add("hide");
  try{RF=(await DB.cargarPublico()).rifas}catch(e){}rSel();rPubR()
};
$("qty").oninput=function(){upd();clrPrev()};
var PV=null;
function clrPrev(){PV=null;rPrev()}
function rPrev(){
  var b=$("prevBox");if(!PV){b.classList.add("hide");return}
  b.classList.remove("hide");$("prevT").textContent=PV.q+" boletos · Total "+mx(calc(PV.q).t);$("prevNums").textContent=PV.nums.map(pad).join("   ")
}
async function genPrev(){
  if(!cel)return;
  var q=Math.min(1000,Math.max(1,parseInt($("qty").value)||1)),R=curR(),rid=R?R.id:"";
  $("res").textContent="";
  try{var n=await DB.proponer(rid,q);PV={q:q,rid:rid,nums:n};rPrev()}
  catch(e){PV=null;rPrev();$("res").textContent=msgErr(e)}
}
$("btnRes").onclick=genPrev;$("btnRef").onclick=genPrev;
$("btnOk").onclick=async function(){
  if(!cel||!PV)return;
  var q=PV.q,b=$("btnOk");b.disabled=true;
  try{
    var r=await DB.crearReserva(cel,PV.rid,PV.nums);
    var d=E("div",null,"ok");d.appendChild(E("b","¡Reserva creada!"));d.appendChild(document.createElement("br"));
    d.appendChild(document.createTextNode("Código "+r.code+" · "+q+" boletos · Total "+mx(r.t)+". Tienes 24 horas para subir tu comprobante de pago. Tu boleto con la rifa, fecha y hora y tus números aparece en “Mis reservas”; cuando se valide el pago podrás descargarlo en PDF."+(CFG.txt.pago?" Pago: "+CFG.txt.pago:"")));
    clrPrev();$("res").textContent="";$("res").appendChild(d);await cargaRes();rRes()
  }catch(e){
    if(e.code==="numeros_ocupados"){await genPrev();$("res").textContent="Algunos de esos números ya no estaban libres. Te mostramos otros: revísalos y acepta de nuevo."}
    else $("res").textContent=msgErr(e)
  }finally{b.disabled=false}
};
$("aFil").onchange=rAdm;
$("aSave").onclick=async function(){
  var p=parseFloat($("aPrecio").value);
  if(!(p>0)){$("aMsg").textContent="Escribe un precio válido.";return}
  CFG.precio=Math.round(p*100)/100;
  try{await persist();$("aMsg").textContent="Costos guardados. Las reservas ya creadas conservan su precio original.";rPrice();upd();rHist()}
  catch(e){$("aMsg").textContent=msgErr(e)}
};
var TB=[["costos","Costos"],["rifas","Nueva rifa"],["bases","Bases de datos"],["reservas","Reservas"],["buscar","Buscar"],["contenido","Contenido"],["imagenes","Imágenes"],["versiones","Versiones"],["respaldo","Respaldo"],["restaurar","Restaurar"],["cuenta","Cuenta"]];
var F=[["nombre","Nombre de la rifa","text"],["premio","Premio principal","text"],["descr","Descripción de la rifa","area"],["fecha","Fecha del sorteo","date"],["hora","Hora del sorteo","time"],["lugar","Lugar del sorteo","text"],["metodo","Método de sorteo","text"],["pago","Instrucciones de pago (CLABE, OXXO, etc.)","area"],["wa","WhatsApp de contacto (10 dígitos)","tel"],["footer","Texto del pie de página","text"],["reglas","Reglamento / términos y condiciones","area"]];
var IMG=[["logo","Logo de la rifa","imgLogo",320,"image/png"],["hero","Imagen principal","imgHero",900,"image/jpeg"]],ORIG={};
async function persist(){await DB.guardarConfig({precio:CFG.precio,txt:CFG.txt||{},imagenes:CFG.imagenes||{}})}
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
async function rHist(){
  var b=$("aHist");b.textContent="";var q=[];
  try{q=await DB.historial()}catch(e){b.appendChild(E("p",msgErr(e),"note"));return}
  if(!q.length){b.appendChild(E("p","Aún no hay versiones guardadas.","note"));return}
  q.forEach(function(v){
    var d=E("div",null,"mr");
    d.appendChild(document.createTextNode(fecha(v.ts)+" · "+mx(v.cfg.precio)+" · "+((v.cfg.txt&&v.cfg.txt.nombre)||"La Bolita Jalisciense")+" "));
    var r=E("button","Restaurar","alt mini");
    r.onclick=async function(){
      CFG.precio=v.cfg.precio;CFG.txt=JSON.parse(JSON.stringify(v.cfg.txt||{}));CFG.imagenes=JSON.parse(JSON.stringify(v.cfg.imagenes||{}));
      try{await persist();rPrice();rPub();rImg();upd();rAdmAll()}catch(e){banner(msgErr(e))}
    };
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
      msg("Procesando imagen...");
      var fr=new FileReader();
      fr.onload=function(){var im=new Image();
        im.onload=function(){var w=Math.min(im.width,i[3]),hh=Math.round(im.height*w/im.width),c=document.createElement("canvas");c.width=w;c.height=hh;c.getContext("2d").drawImage(im,0,0,w,hh);
          c.toBlob(async function(bl){
            if(!bl){msg("No se pudo procesar la imagen.");return}
            try{var u=await DB.subirImagen(bl,i[4]==="image/png"?"png":"jpg",i[0]);CFG.imagenes=CFG.imagenes||{};CFG.imagenes[i[0]]=u;await persist();rImg();rHist();msg("Imagen actualizada y publicada.")}
            catch(e){msg(msgErr(e))}
          },i[4],.85)};
        im.onerror=function(){msg("No se pudo leer la imagen.")};im.src=fr.result};
      fr.readAsDataURL(f)
    };
    rs.onclick=async function(){CFG.imagenes=CFG.imagenes||{};delete CFG.imagenes[i[0]];try{await persist();rImg();rHist();msg("Imagen original restaurada.")}catch(e){msg(msgErr(e))}};
    $("aImg").appendChild(d)
  })
}
function rImg(){var s=CFG.imagenes||{};IMG.forEach(function(i){var e=$(i[2]);e.src=s[i[0]]||ORIG[i[0]];var p=$("pv_"+i[0]);if(p)p.src=e.src})}
$("aSaveTxt").onclick=async function(){
  var t={};F.forEach(function(x){var v=$("t_"+x[0]).value.trim().slice(0,3000);if(x[0]==="wa")v=v.replace(/\D/g,"");if(v)t[x[0]]=v});
  CFG.txt=t;
  try{await persist();rPub();rHist();$("aMsgT").textContent="Contenido guardado y publicado."}catch(e){$("aMsgT").textContent=msgErr(e)}
};
var PM=null;
function curR(){var s=$("selRifa"),v=s?s.value:"";return RF.filter(function(r){return r.id===v})[0]||null}
function rSel(){
  var s=$("selRifa"),v=s.value;s.textContent="";
  var o=E("option","Rifa principal: "+((CFG.txt&&CFG.txt.nombre)||"La Bolita Jalisciense"));o.value="";s.appendChild(o);
  RFA().forEach(function(r){var x=E("option",r.nombre+" ("+mx(r.precio)+")");x.value=r.id;s.appendChild(x)});
  s.value=RFA().some(function(r){return r.id===v})?v:"";$("rifaBox").classList.toggle("hide",!RFA().length)
}
function mkMedia(t,src,alt){var e=t==="video"?E("video"):E("img");if(t==="video"){e.controls=true;e.preload="metadata";e.playsInline=true}else e.alt=alt||"";e.className="rmed";e.src=src;return e}
function rPubR(){
  var g=$("rifasG");g.textContent="";$("rifasS").classList.toggle("hide",!RFA().length);
  RFA().forEach(function(r){
    var c=E("div",null,"card"),m=E("div");c.appendChild(m);
    if(r.m&&r.url)m.appendChild(mkMedia(r.m,r.url,r.nombre));
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
  if(!RFA().length){b.appendChild(E("p","Aún no has creado rifas nuevas.","note"));return}
  RFA().forEach(function(r){
    var d=E("div",null,"mr");
    d.appendChild(document.createTextNode(r.nombre+" · "+mx(r.precio)+(r.fecha?" · "+fF(r.fecha):"")+(r.m?" · con "+(r.m==="video"?"video":"imagen"):"")+" "));
    var x=E("button","Archivar","alt mini"),arm=false;
    x.onclick=async function(){
      if(!arm){arm=true;x.textContent="¿Seguro? Archivar";return}
      try{await DB.archivarRifa(r.id);r.activa=false;rLista();rPubR();rSel();upd();rDBList()}catch(e){x.textContent=msgErr(e)}
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
  if(vid){PM={t:"video",file:f,ext:f.type==="video/webm"?"webm":"mp4"};pv.appendChild(mkMedia("video",URL.createObjectURL(f)));rMsg("Video listo. Falta crear la rifa.");return}
  rMsg("Procesando imagen...");
  var fr=new FileReader();
  fr.onerror=function(){rMsg("No se pudo leer el archivo.")};
  fr.onload=function(){
    var im=new Image();
    im.onload=function(){var w=Math.min(im.width,900),hh=Math.round(im.height*w/im.width),c=document.createElement("canvas");c.width=w;c.height=hh;c.getContext("2d").drawImage(im,0,0,w,hh);
      c.toBlob(function(bl){if(!bl){rMsg("No se pudo procesar la imagen.");return}PM={t:"image",file:bl,ext:"jpg"};pv.appendChild(mkMedia("image",URL.createObjectURL(bl),"Vista previa"));rMsg("Imagen lista. Falta crear la rifa.")},"image/jpeg",.85)};
    im.onerror=function(){rMsg("No se pudo leer la imagen.")};im.src=fr.result
  };
  fr.readAsDataURL(f)
};
$("rCrear").onclick=async function(){
  var nom=$("rNom").value.trim(),prc=parseFloat($("rPrc").value),b=$("rCrear");
  if(!nom){rMsg("Escribe el nombre de la rifa.");return}
  if(!(prc>0)){rMsg("Escribe un precio por boleto válido.");return}
  b.disabled=true;rMsg("Creando rifa...");
  try{
    var r=await DB.crearRifa({nombre:nom,premio:$("rPre").value.trim(),descr:$("rDes").value.trim(),fecha:$("rFec").value,precio:Math.round(prc*100)/100},PM);
    RF.push(r);
    ["rNom","rPre","rDes","rFec"].forEach(function(i){$(i).value=""});$("rPrc").value=CFG.precio;$("rMedia").value="";$("rPrev").textContent="";PM=null;
    rMsg("Rifa creada y publicada.");rLista();rPubR();rSel();rDBList()
  }catch(e){rMsg(msgErr(e))}finally{b.disabled=false}
};
$("selRifa").onchange=function(){upd();clrPrev()};
var DBK=null;
function dbNom(k){if(!k)return"Rifa principal: "+((CFG.txt&&CFG.txt.nombre)||"La Bolita Jalisciense");var r=RF.filter(function(z){return z.id===k})[0];if(r)return r.nombre+(r.activa===false?" (archivada)":"");var o=RES().filter(function(z){return z.rid===k})[0];return(o?o.rn:"Rifa")+" (eliminada)"}
function dbRows(k){return RES().filter(function(r){return(r.rid||"")===k})}
function dbKeys(){var ks=[""].concat(RF.map(function(r){return r.id}));RES().forEach(function(r){if(r.rid&&ks.indexOf(r.rid)<0)ks.push(r.rid)});return ks}
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
  var d=q.replace(/\D/g,"");
  return dbRows(DBK).filter(function(r){return(f==="todas"||est(r)===f)&&(!q||r.cel.indexOf(q)>=0||r.code.toLowerCase().indexOf(q)>=0||(d.length>=3&&numsOf(r).some(function(n){return pad(n).indexOf(d)>=0})))}).reverse()
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
function nTd(r){var t=E("td"),d=document.createElement("details");d.appendChild(E("summary",r.q+" boletos"));d.appendChild(E("div",numsOf(r).map(pad).join(", "),"note"));t.appendChild(d);return t}
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
  msg("Subiendo comprobante...");
  function enviar(bl,ext){
    DB.subirComprobante(cel,code,bl,ext).then(async function(){
      msg("Comprobante enviado. Tu reserva quedó en revisión de pago.");
      aviso("Archivo aceptado","Tu comprobante se recibió y tu reserva quedó en revisión de pago.");
      await cargaRes();rRes()
    }).catch(function(e){msg(msgErr(e))})
  }
  if(pdf){enviar(f,"pdf");return}
  var fr=new FileReader();fr.onerror=function(){msg("No se pudo leer el archivo.")};
  fr.onload=function(){
    var im=new Image();
    im.onload=function(){var w=Math.min(im.width,1200),hh=Math.round(im.height*w/im.width),c=document.createElement("canvas");c.width=w;c.height=hh;c.getContext("2d").drawImage(im,0,0,w,hh);
      c.toBlob(function(bl){bl?enviar(bl,"jpg"):msg("No se pudo procesar la imagen.")},"image/jpeg",.85)};
    im.onerror=function(){msg("No se pudo leer la imagen.")};im.src=fr.result
  };
  fr.readAsDataURL(f)
}
function ovl(){
  var ov=E("div");ov.style.cssText="position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.82);overflow:auto;padding:max(16px,env(safe-area-inset-top,0px)) 16px 16px";
  var c=E("div",null,"card");c.style.cssText="max-width:720px;margin:0 auto";ov.appendChild(c);document.body.appendChild(ov);
  return{c:c,close:function(){if(ov.parentNode)ov.parentNode.removeChild(ov)}}
}
async function verComp(code){
  if(!isAdm)return;
  var r=RES().filter(function(z){return z.code===code})[0];if(!r)return;
  var o=null;try{if(r.cpath)o=await DB.comprobanteUrl(r)}catch(e){}
  var s=est(r),m=ovl(),c=m.c;
  c.appendChild(E("h3","Celular: +52 "+r.cel));
  [["Código",r.code],["Rifa",dbNom(r.rid||"")],["Estado",LB[s]||s],["Boletos",r.q+" · Total "+mx(r.t)],["Comprado el",fecha(r.ts)],["Comprobante subido",r.cp?fecha(r.cp):"—"]].forEach(function(x){
    var d=E("div",null,"mr");d.appendChild(E("b",x[0]+": "));d.appendChild(document.createTextNode(x[1]));c.appendChild(d)});
  var dt=document.createElement("details");dt.appendChild(E("summary","Ver los "+r.q+" números"));dt.appendChild(E("div",numsOf(r).map(pad).join(", "),"note"));c.appendChild(dt);
  if(!o)c.appendChild(E("p","No se pudo cargar el comprobante.","note"));
  else if(o.tipo==="pdf"){c.appendChild(E("p","El comprobante es un archivo PDF."));var a=E("a","Abrir el PDF en una pestaña nueva");a.href=o.url;a.target="_blank";a.rel="noopener";a.style.cssText="display:inline-block;margin:8px 0;color:var(--acc)";c.appendChild(a)}
  else{var im=E("img");im.src=o.url;im.alt="Comprobante de pago de +52 "+r.cel;im.style.cssText="max-width:100%;max-height:65vh;display:block;margin:12px auto;border-radius:8px";c.appendChild(im)}
  var row=E("div",null,"row");
  if(s==="revision"){
    var v=E("button","Validar pago");v.onclick=function(){m.close();setEst(code,"validado")};row.appendChild(v);
    var x=E("button","Rechazar y liberar números","alt");x.onclick=function(){m.close();setEst(code,"rechazado")};row.appendChild(x)
  }
  if(s==="pendiente"||s==="revision"||s==="validado"){var lb=E("button","Liberar números","alt");lb.onclick=function(){m.close();setEst(code,"liberada")};row.appendChild(lb)}
  var z=E("button","Cerrar","alt");z.onclick=m.close;row.appendChild(z);c.appendChild(row)
}
function noComp(scope){
  if(!isAdm)return;
  var all=RES(),idx={},rows=[];
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
function ldImg(s){return new Promise(function(ok,no){var i=new Image();i.crossOrigin="anonymous";i.onload=function(){ok(i)};i.onerror=no;i.src=s})}
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
  var r=RES().filter(function(z){return z.code===code&&z.cel===cel})[0];
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
  var l=RES().filter(function(r){return r.cel===cel&&est(r)==="pendiente"}).reverse(),sel=$("upSel"),keep=sel.value;
  sel.textContent="";
  l.forEach(function(r){var o=E("option",r.code+" · "+r.q+" boletos · "+mx(r.t)+(r.rn?" · "+r.rn:""));o.value=r.code;sel.appendChild(o)});
  if(l.some(function(r){return r.code===keep}))sel.value=keep;
  sel.classList.toggle("hide",l.length<2);
  var on=l.length>0;$("upLb").classList.toggle("off",!on);$("upIn").disabled=!on;
  $("upHint").textContent=on?(l.length>1?"Elige la reserva y sube su comprobante.":"Sube el comprobante de tu reserva "+l[0].code+"."):"Cuando tengas una reserva pendiente de pago, aquí subirás tu comprobante."
}
$("upIn").onchange=function(){var f=this.files[0],c=$("upSel").value;this.value="";if(f&&c)subirComp(c,f,function(t){$("upMsg").textContent=t})};
document.querySelectorAll(".qk").forEach(function(b){b.onclick=function(){$("qty").value=b.dataset.q;upd();genPrev()}});
var BQ=null;
function bBuscar(modo){
  BQ=modo;
  var m=$("bMsg"),t=$("bTab");t.textContent="";m.textContent="";
  var q=(modo==="num"?$("bNum"):$("bCel")).value.replace(/\D/g,"");
  if(!q){m.textContent=modo==="num"?"Escribe el número de boleto (o parte de él).":"Escribe el celular (o parte de él).";return}
  var rows=[];
  RES().slice().reverse().forEach(function(r){
    if(modo==="cel"){if(r.cel.indexOf(q)>=0)rows.push({r:r,hit:[]});return}
    var hit=numsOf(r).filter(function(x){return q.length===8?x===parseInt(q,10):pad(x).indexOf(q)>=0});
    if(hit.length)rows.push({r:r,hit:hit})
  });
  var vivo={pendiente:1,revision:1,validado:1};
  rows.sort(function(a,b){return(vivo[est(b.r)]?1:0)-(vivo[est(a.r)]?1:0)});
  if(!rows.length){
    m.textContent=modo==="num"?(q.length===8?"El boleto "+q+" no está reservado en ninguna rifa: está libre.":"Ningún boleto contiene "+q+"."):"No hay reservas con el celular "+q+".";
    return
  }
  var tn=0;rows.forEach(function(w){tn+=w.hit.length});
  m.textContent=modo==="num"?rows.length+" reserva(s) con "+tn+" boleto(s) que coinciden"+(q.length<8?" (coincidencia parcial)":"")+". Las activas aparecen primero; las liberadas, rechazadas o expiradas quedan como referencia."
    :rows.length+" reserva(s) del celular "+q+".";
  var hr=E("tr");["Boleto","Código","Celular","Rifa","Total","Fecha","Estado","Acciones"].forEach(function(x){hr.appendChild(E("th",x))});t.appendChild(hr);
  rows.slice(0,200).forEach(function(w){
    var r=w.r,s=est(r),tr=E("tr");
    tr.appendChild(modo==="num"?E("td",w.hit.slice(0,6).map(pad).join(", ")+(w.hit.length>6?" +"+(w.hit.length-6)+" más":"")):nTd(r));
    tr.appendChild(E("td",r.code));tr.appendChild(E("td",r.cel));tr.appendChild(E("td",dbNom(r.rid||"")));
    tr.appendChild(E("td",mx(r.t)));tr.appendChild(E("td",fecha(r.ts)));
    var te=E("td");te.appendChild(E("span",LB[s]||s,"bd "+s));tr.appendChild(te);
    tr.appendChild(acts(r));t.appendChild(tr)
  });
  if(rows.length>200)m.textContent+=" Se muestran las primeras 200.";
}
$("bNumGo").onclick=function(){bBuscar("num")};$("bCelGo").onclick=function(){bBuscar("cel")};
$("bNum").onkeydown=function(e){if(e.key==="Enter")bBuscar("num")};$("bCel").onkeydown=function(e){if(e.key==="Enter")bBuscar("cel")};
$("bNum").oninput=function(){this.value=this.value.replace(/\D/g,"")};$("bCel").oninput=function(){this.value=this.value.replace(/\D/g,"")};
/* ===== Respaldo: ZIP sin librerías ===== */
var CRCT=null;
function crc32(u){if(!CRCT){CRCT=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;CRCT[n]=c>>>0}}
  var c=0xFFFFFFFF;for(var i=0;i<u.length;i++)c=CRCT[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function mkZip(files){
  var enc=new TextEncoder(),parts=[],cd=[],off=0,d=new Date();
  var tm=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),dt=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  files.forEach(function(f){
    var nm=enc.encode(f.name),crc=crc32(f.data),sz=f.data.length,lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);lh.setUint16(10,tm,true);lh.setUint16(12,dt,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,sz,true);lh.setUint32(22,sz,true);lh.setUint16(26,nm.length,true);lh.setUint16(28,0,true);
    parts.push(new Uint8Array(lh.buffer),nm,f.data);
    var ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(10,0,true);ch.setUint16(12,tm,true);ch.setUint16(14,dt,true);
    ch.setUint32(16,crc,true);ch.setUint32(20,sz,true);ch.setUint32(24,sz,true);ch.setUint16(28,nm.length,true);ch.setUint32(42,off,true);
    cd.push(new Uint8Array(ch.buffer),nm);off+=30+nm.length+sz
  });
  var cs=0;cd.forEach(function(x){cs+=x.length});
  var e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
  return new Blob(parts.concat(cd,[new Uint8Array(e.buffer)]),{type:"application/zip"})
}
function u8(s){return new TextEncoder().encode(s)}
function csvDe(rows){return"\ufeff"+rows.map(function(a){return a.map(csvE).join(",")}).join("\r\n")}
function iso(ts){return ts?new Date(ts).toISOString():""}
function rsUlt(){
  var t=0;try{t=parseInt(localStorage.getItem("bj_respaldo"))||0}catch(e){}
  var el=$("rsUlt");
  if(!t){el.textContent="Aún no has hecho un respaldo desde este navegador. Te recomendamos hacerlo ahora.";return}
  var d=Math.floor((Date.now()-t)/864e5);
  el.textContent="Último respaldo desde este navegador: "+fecha(t)+(d>=7?" · hace "+d+" días: conviene hacer uno nuevo.":".")
}
async function ficherosDB(){
  var d=await DB.exportar(),nom=function(r){return r.rn||"Rifa principal"},F=[],act={pendiente:1,revision:1,validado:1};
  var rs=d.reservas;
  F.push({name:"base-de-datos/reservas.csv",data:u8(csvDe([["Código","Rifa","Celular","Cantidad","Precio unitario","Total","Estado","Fecha de reserva","Comprobante subido","Validado","Archivo de comprobante","Boletos"]].concat(rs.map(function(r){
    return[r.code,nom(r),r.cel,r.q,r.p.toFixed(2),r.t.toFixed(2),LB[est(r)]||est(r),iso(r.ts),iso(r.cp),iso(r.vts),r.cpath,numsOf(r).map(pad).join(" ")]}))))});
  var bol=[["Código","Rifa","Número","Celular","Estado de la reserva","¿Número tomado ahora?","Fecha de reserva"]];
  rs.forEach(function(r){numsOf(r).forEach(function(n){bol.push([r.code,nom(r),pad(n),r.cel,LB[est(r)]||est(r),act[est(r)]?"sí":"no",iso(r.ts)])})});
  F.push({name:"base-de-datos/boletos.csv",data:u8(csvDe(bol))});
  F.push({name:"base-de-datos/rifas.csv",data:u8(csvDe([["Nombre","Premio","Descripción","Fecha del sorteo","Precio","Activa","Medio","Creada"]].concat(d.rifas.map(function(r){
    return[r.nombre,r.premio||"",r.descr||"",r.fecha||"",r.precio,r.activa===false?"no":"sí",r.media_tipo||r.m||"",r.creada||""]}))))});
  d.rifas.forEach(function(r){delete r.url});
  F.push({name:"base-de-datos/respaldo.json",data:u8(JSON.stringify({generado:new Date().toISOString(),modo:DB.modo,configuracion:d.configuracion,rifas:d.rifas,historial:d.historial,reservas:rs},null,1))});
  F.push({name:"LEEME.txt",data:u8("Respaldo de La Bolita Jalisciense\r\nGenerado: "+new Date().toLocaleString("es-MX")+"\r\nModo: "+DB.modo+"\r\n\r\nbase-de-datos/reservas.csv  Una fila por reserva (con sus números).\r\nbase-de-datos/boletos.csv   Una fila por número, incluidos los liberados.\r\nbase-de-datos/rifas.csv     Rifas creadas.\r\nbase-de-datos/respaldo.json Todo en formato JSON (incluye precio, textos e historial).\r\ncomprobantes/               Imágenes y PDF de pago (si se incluyeron).\r\npagina/                     Archivos del sitio (si se incluyeron).\r\n\r\nPRIVACIDAD: este respaldo tiene celulares y comprobantes de compradores. Guárdalo en un lugar privado.\r\n")});
  return F
}
async function ficherosCp(prog){
  var F=[],err=[],l=RES().filter(function(r){return r.cpath});
  for(var i=0;i<l.length;i++){
    var r=l[i];prog("Comprobantes: "+(i+1)+" de "+l.length+"...");
    try{
      var o=await DB.comprobanteUrl(r),rs=await fetch(o.url);if(!rs.ok)throw 0;
      var ext=o.tipo==="pdf"?"pdf":(r.cpath.split(".").pop()||"jpg").toLowerCase();if(ext.length>4)ext="jpg";
      F.push({name:"comprobantes/"+r.code+"_"+r.cel+"."+ext,data:new Uint8Array(await rs.arrayBuffer())})
    }catch(e){err.push("comprobante "+r.code)}
  }
  return{F:F,err:err}
}
var PAG=["index.html","css/styles.css","js/app.js","js/db.js","js/db-local.js","js/config.js","assets/logo.jpg","assets/hero.jpg","assets/qr-whatsapp.jpg","supabase/schema.sql","README.md"];
async function ficherosPag(){
  var F=[],err=[];
  for(var i=0;i<PAG.length;i++){
    try{var rs=await fetch(PAG[i],{cache:"no-store"});if(!rs.ok)throw 0;F.push({name:"pagina/"+PAG[i],data:new Uint8Array(await rs.arrayBuffer())})}
    catch(e){err.push("archivo de la página "+PAG[i]+" (cópialo desde GitHub)")}
  }
  return{F:F,err:err}
}
async function respaldar(que){
  var m=$("rsMsg"),bs=document.querySelectorAll("#rsDb,#rsCp,#rsPg,#rsTodo");
  bs.forEach(function(b){b.disabled=true});m.textContent="Preparando...";
  try{
    await cargaRes();
    var F=[],ee=[],dia=new Date().toISOString().slice(0,10),nom={db:"respaldo-base-de-datos",cp:"respaldo-comprobantes",pg:"respaldo-pagina",todo:"respaldo-completo"}[que]+"-"+dia;
    if(que==="db"||que==="todo"){m.textContent="Preparando la base de datos...";F=F.concat(await ficherosDB())}
    if(que==="cp"||que==="todo"){var c=await ficherosCp(function(t){m.textContent=t});F=F.concat(c.F);ee=ee.concat(c.err)}
    if(que==="pg"||que==="todo"){m.textContent="Copiando la página...";var p=await ficherosPag();F=F.concat(p.F);ee=ee.concat(p.err)}
    if(ee.length)F.push({name:"AVISOS.txt",data:u8("No se pudieron incluir:\r\n"+ee.join("\r\n")+"\r\n")});
    m.textContent="Creando el archivo ZIP...";
    var dl=window.claude?await window.claude.use("downloads"):null;
    if(!dl)throw new Error("Esta vista no permite descargar archivos.");
    await dl.save({filename:nom+".zip",data:mkZip(F)});
    try{localStorage.setItem("bj_respaldo",String(Date.now()))}catch(e){}
    rsUlt();m.textContent="Respaldo listo: "+F.length+" archivo(s)"+(ee.length?" · "+ee.length+" aviso(s), revisa AVISOS.txt dentro del ZIP":"")+".";return true
  }catch(e){m.textContent="No se pudo crear el respaldo: "+msgErr(e);return false}
  finally{bs.forEach(function(b){b.disabled=false})}
}
$("rsDb").onclick=function(){respaldar("db")};$("rsCp").onclick=function(){respaldar("cp")};
$("rsPg").onclick=function(){respaldar("pg")};$("rsTodo").onclick=function(){respaldar("todo")};
/* ===== Liberar revisión y rechazados (sin tocar validados) ===== */
$("aLib").onclick=function(){
  if(!isAdm)return;
  function por(s){return RES().filter(function(r){return est(r)===s})}
  function bol(a){return a.reduce(function(t,r){return t+r.q},0)}
  var rv=por("revision"),rz=por("rechazado"),va=por("validado"),m=ovl(),c=m.c;
  c.appendChild(E("h3","Liberar revisión y rechazados"));
  c.appendChild(E("p","En revisión: "+rv.length+" reserva(s), "+bol(rv)+" boleto(s). Se liberan: sus números quedan libres y la reserva pasa a “Liberada”.","note"));
  c.appendChild(E("p","Rechazadas: "+rz.length+" reserva(s), "+bol(rz)+" boleto(s). Sus números ya quedaron libres al rechazarlas; no cambian.","note"));
  c.appendChild(E("p","Validadas: "+va.length+" reserva(s), "+bol(va)+" boleto(s). No se tocan.","note"));
  var row=E("div",null,"row"),out=E("p",null,"note");
  if(rv.length){
    var ok=E("button","Sí, liberar "+rv.length+" reserva(s) en revisión");
    ok.onclick=async function(){
      ok.disabled=true;out.textContent="Liberando...";
      try{var n=await DB.liberarRevision();await cargaRes();rRes();out.textContent="Listo: se liberaron "+n+" reserva(s) que estaban en revisión. Las validadas no se modificaron.";ok.hidden=true}
      catch(e){out.textContent=msgErr(e);ok.disabled=false}
    };
    row.appendChild(ok)
  }else c.appendChild(E("p","No hay reservas en revisión para liberar.","note"));
  var z=E("button","Cerrar","alt");z.onclick=m.close;row.appendChild(z);c.appendChild(row);c.appendChild(out)
};
/* ===== Restaurar (solo agrega lo que falta; no toca config.js ni llaves) ===== */
var RT=null;
async function leeZip(buf){
  var u=new Uint8Array(buf),dv=new DataView(buf),i=u.length-22;
  while(i>=0&&dv.getUint32(i,true)!==0x06054b50)i--;
  if(i<0)throw new Error("El archivo no es un ZIP válido.");
  var cnt=dv.getUint16(i+10,true),p=dv.getUint32(i+16,true),out={};
  for(var k=0;k<cnt;k++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    var nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true);
    out[new TextDecoder().decode(u.subarray(p+46,p+46+nl))]={met:dv.getUint16(p+10,true),csz:dv.getUint32(p+20,true),lo:dv.getUint32(p+42,true)};
    p+=46+nl+el+cl
  }
  return{u:u,dv:dv,files:out}
}
async function datosZip(z,name){
  var f=z.files[name],nl=z.dv.getUint16(f.lo+26,true),el=z.dv.getUint16(f.lo+28,true),s=f.lo+30+nl+el,raw=z.u.subarray(s,s+f.csz);
  if(f.met===0)return raw;
  if(f.met===8&&window.DecompressionStream){return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer())}
  throw new Error("El ZIP usa una compresión no compatible. Usa el ZIP tal como lo descargaste de la página.")
}
function entero(n){return typeof n==="number"&&isFinite(n)&&n===Math.floor(n)}
function resValida(r){
  return r&&typeof r.code==="string"&&/^BJ-[A-Z0-9]{6,14}$/.test(r.code)&&typeof r.cel==="string"&&/^\d{10}$/.test(r.cel)&&Array.isArray(r.nums)&&r.nums.length>=1&&r.nums.length<=1000&&
    r.nums.every(function(n){return entero(n)&&n>=1&&n<=99999999})&&typeof r.p==="number"&&typeof r.t==="number"&&r.p>=0&&r.t>=0&&entero(r.ts)&&(!r.rid||typeof r.rid==="string")
}
function rtVivas(){var m={};RES().forEach(function(r){var s=est(r);if(s==="pendiente"||s==="revision"||s==="validado")numsOf(r).forEach(function(n){m[(r.rid||"")+":"+n]=1})});return m}
function rtAnaliza(d,z){
  var cur=new Set(RES().map(function(r){return r.code})),vivas=rtVivas(),viva={pendiente:1,revision:1,validado:1};
  var rs=(d.reservas||[]).filter(resValida),inval=(d.reservas||[]).length-rs.length,nuevas=[],existen=0,conf=[];
  rs.forEach(function(r){
    if(cur.has(r.code)){existen++;return}
    var e=r.estado==="pagado"?"validado":r.estado;if(e==="pendiente"&&Date.now()-r.ts>864e5)e="expirada";
    if(viva[e]&&r.nums.some(function(n){return vivas[(r.rid||"")+":"+n]})){conf.push(r.code);return}
    nuevas.push(r)
  });
  var ids=new Set(RF.map(function(r){return r.id})),rifasNuevas=(d.rifas||[]).filter(function(r){return r&&r.id&&!ids.has(r.id)}).length;
  var cps=0;if(z)rs.forEach(function(r){if(r.cpath&&Object.keys(z.files).some(function(n){return n.indexOf("comprobantes/"+r.code+"_")===0}))cps++});
  return{rs:rs,inval:inval,nuevas:nuevas,existen:existen,conf:conf,rifasNuevas:rifasNuevas,cps:cps}
}
$("rtFile").onchange=async function(){
  var f=this.files[0],av=$("rtAviso"),inf=$("rtInfo");this.value="";RT=null;av.textContent="";inf.textContent="";$("rtOpc").classList.add("hide");$("rtMsg").textContent="";
  if(!f)return;
  try{
    inf.textContent="Leyendo "+f.name+"...";
    var buf=await f.arrayBuffer(),d,z=null;
    if(/\.json$/i.test(f.name))d=JSON.parse(new TextDecoder().decode(buf));
    else{z=await leeZip(buf);var jn=Object.keys(z.files).filter(function(n){return/(^|\/)respaldo\.json$/.test(n)})[0];
      if(!jn)throw new Error("Este ZIP no trae base-de-datos/respaldo.json. Usa el ZIP de “base de datos” o el “completo”.");
      d=JSON.parse(new TextDecoder().decode(await datosZip(z,jn)))}
    if(!d||!Array.isArray(d.reservas))throw new Error("El archivo no parece un respaldo de La Bolita Jalisciense.");
    if(d.modo&&d.modo!==DB.modo){inf.textContent="";av.textContent="Este respaldo es del modo “"+d.modo+"” y la página está en modo “"+DB.modo+"”. No se puede restaurar para no mezclar datos de prueba con los reales.";return}
    await cargaRes();
    var ok=true;try{ok=await DB.restaurarListo()}catch(e){ok=false}
    if(!ok){inf.textContent="";av.textContent="Para habilitar Restaurar ejecuta una sola vez el archivo supabase/restaurar.sql en el SQL Editor de Supabase (es seguro: solo agrega una función). Luego vuelve a elegir el archivo.";return}
    var a=rtAnaliza(d,z);RT={d:d,z:z,a:a};
    inf.textContent="Archivo "+f.name+" · Contenido: "+a.rs.length+" reserva(s) válidas"+(a.inval?" ("+a.inval+" ignoradas por datos inválidos)":"")+", "+(d.rifas||[]).length+" rifa(s), "+(z?Object.keys(z.files).filter(function(n){return n.indexOf("comprobantes/")===0}).length:0)+" comprobante(s). "+
      "Vista previa en tu base actual: "+a.nuevas.length+" reserva(s) se agregarían · "+a.existen+" ya existen (no se tocan) · "+a.conf.length+" tienen números que hoy usa otra persona (no se restaurarían)"+(a.conf.length?": "+a.conf.slice(0,8).join(", ")+(a.conf.length>8?"...":""):"")+" · "+a.rifasNuevas+" rifa(s) faltante(s).";
    $("rtOpc").classList.remove("hide")
  }catch(e){inf.textContent="";av.textContent="No se pudo leer el respaldo: "+(e.message||"archivo inválido")}
};
$("rtGo").onclick=function(){
  if(!isAdm||!RT)return;
  var m=ovl(),c=m.c,a=RT.a;
  c.appendChild(E("h3","Confirmar restauración"));
  c.appendChild(E("p","Se agregarán solo los datos que falten. No se borra ni se modifica nada existente"+($("rtCfg").checked?", excepto el precio, textos e imágenes de la rifa principal, que se reemplazarán (podrás volver en Versiones)":"")+".","note"));
  c.appendChild(E("p","Reservas nuevas: "+($("rtRes").checked?a.nuevas.length:0)+" · Rifas faltantes: "+($("rtRifas").checked?a.rifasNuevas:0)+" · Comprobantes disponibles: "+($("rtCp").checked?a.cps:0)+".","note"));
  var lb=E("label","Para continuar escribe RESTAURAR"),inp=E("input"),row=E("div",null,"row"),go=E("button","Restaurar"),no=E("button","Cancelar","alt");
  inp.autocomplete="off";go.disabled=true;inp.oninput=function(){go.disabled=inp.value.trim()!=="RESTAURAR"};
  no.onclick=m.close;go.onclick=function(){m.close();restaurar({rifas:$("rtRifas").checked,res:$("rtRes").checked,cp:$("rtCp").checked,cfg:$("rtCfg").checked,seg:$("rtSeg").checked})};
  row.appendChild(go);row.appendChild(no);c.appendChild(lb);c.appendChild(inp);c.appendChild(row)
};
async function restaurar(op){
  var m=$("rtMsg"),bt=$("rtGo"),out=[],d=RT.d,z=RT.z,rs=RT.a.rs;bt.disabled=true;
  try{
    if(op.seg){m.textContent="Descargando respaldo de seguridad...";if(!await respaldar("db")){m.textContent="No se pudo crear el respaldo de seguridad. No se restauró nada.";return}}
    if(op.rifas){m.textContent="Restaurando rifas...";var nr=await DB.restaurarRifas(d.rifas||[]);out.push("Rifas agregadas: "+nr);RF=await DB.rifasAdmin()}
    if(op.res){
      m.textContent="Restaurando reservas y boletos...";var t=await DB.restaurarReservas(rs);
      out.push("Reservas agregadas: "+t.insertadas+" · ya existían: "+t.existentes);
      if(t.conflictos.length)out.push("No restauradas por números en uso: "+t.conflictos.join(", "));
      if(t.sin_rifa.length)out.push("No restauradas porque su rifa no existe: "+t.sin_rifa.join(", ")+" (activa “Rifas que faltan”)");
      if(t.errores.length)out.push("Con error: "+t.errores.map(function(e){return e.codigo+" ("+e.error+")"}).join("; "))
    }
    if(op.cp&&z){
      var sub=0,exi=0,fal=0,names=Object.keys(z.files);
      for(var i=0;i<rs.length;i++){
        var r=rs[i];if(!r.cpath)continue;
        var fn=names.filter(function(n){return n.indexOf("comprobantes/"+r.code+"_")===0})[0];
        if(!fn||!/^BJ-[A-Z0-9]+\/\d+\.(jpg|jpeg|png|webp|pdf)$/i.test(r.cpath)&&!/^p_BJ-[A-Z0-9]+$/.test(r.cpath)){continue}
        m.textContent="Restaurando comprobantes: "+(i+1)+" de "+rs.length+"...";
        try{var ext=fn.split(".").pop().toLowerCase(),tipo=ext==="pdf"?"application/pdf":(ext==="png"?"image/png":(ext==="webp"?"image/webp":"image/jpeg"));
          var res=await DB.restaurarComprobante(r.cpath,new Blob([await datosZip(z,fn)],{type:tipo}));res==="ok"?sub++:exi++}catch(e){fal++}
      }
      out.push("Comprobantes subidos: "+sub+" · ya existían: "+exi+(fal?" · con error: "+fal:""))
    }
    if(op.cfg&&d.configuracion&&Number(d.configuracion.precio)>0&&typeof d.configuracion.txt==="object"){
      m.textContent="Restaurando precio, textos e imágenes...";
      CFG.precio=Number(d.configuracion.precio);CFG.txt=d.configuracion.txt||{};CFG.imagenes=d.configuracion.imagenes||{};
      await persist();rPrice();rPub();rImg();upd();rHist();out.push("Precio, textos e imágenes restaurados.")
    }
    await cargaRes();rRes();rLista();rSel();rPubR();rDBList();
    m.textContent="Restauración terminada. "+out.join(" · ")
  }catch(e){m.textContent="La restauración se detuvo: "+msgErr(e)+(out.length?" · Avance: "+out.join(" · "):"")}
  finally{bt.disabled=false}
}
function aplicaPublico(p){
  CFG={precio:p.precio,txt:p.txt||{},imagenes:p.imagenes||{}};RF=isAdm?RF:p.rifas;
}
async function init(){
  bTabs();bImg();
  if(DB.modo==="local")banner("Modo demostración: la página todavía no está conectada a la base de datos, así que los datos se guardan solo en este navegador. Para conectarla llena supabaseUrl y supabaseAnonKey en js/config.js (ver README). Contraseña de administrador de prueba: demo1234.");
  try{aplicaPublico(await DB.cargarPublico())}catch(e){banner("No se pudo conectar con la base de datos: "+msgErr(e));$("modoBanner").dataset.err="1"}
  $("rPrc").value=CFG.precio;rPrice();rImg();rPub();rSel();rPubR();rLista();upd();
  try{if(await DB.esAdmin()){await showAdmin();return}}catch(e){}
  var s=ld(K.ses,null);if(s)show(s);
  setInterval(function(){if((isAdm||cel)&&!document.hidden){cargaRes().then(rRes)}},20000)
}
init();

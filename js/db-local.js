/* Modo demostración: imita al servidor usando localStorage (solo este navegador).
   Se usa automáticamente cuando js/config.js no tiene los datos de Supabase.
   Admin de demostración: admin@demo.test / demo1234 */
(function(){
  var KEY="bjl_srv",ADM="bjl_admin",DAY=864e5;
  function ini(){return{cfg:{precio:1.5,txt:{},imagenes:{}},hist:[],rifas:[],res:[],files:{}}}
  function rd(){try{var s=JSON.parse(localStorage.getItem(KEY));if(s)return s}catch(e){}return ini()}
  function wr(s){try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){throw err("almacenamiento_lleno","El almacenamiento del navegador está lleno (modo demostración).")}}
  function err(c,m){var e=new Error(m||c);e.code=c;return e}
  function clone(x){return JSON.parse(JSON.stringify(x))}
  function venc(s){var ch=false;s.res.forEach(function(r){if(r.estado==="pendiente"&&Date.now()-r.ts>DAY){r.estado="expirada";ch=true}});if(ch)wr(s);return s}
  function act(r){return r.estado==="pendiente"||r.estado==="revision"||r.estado==="validado"}
  function cel10(c){c=String(c||"").replace(/\D/g,"");if(c.length!==10)throw err("celular_invalido");return c}
  function toData(b){return new Promise(function(ok,no){var f=new FileReader();f.onload=function(){ok(f.result)};f.onerror=no;f.readAsDataURL(b)})}
  function admin(){var ok=false;try{ok=localStorage.getItem(ADM)==="1"}catch(e){}if(!ok)throw err("no_autorizado","Sesión de administrador requerida.")}
  function rifaOut(s,r){return{id:r.id,nombre:r.nombre,premio:r.premio||"",descr:r.descr||"",fecha:r.fecha||"",precio:r.precio,m:r.m||"",url:r.m?(s.files[r.id]||""):"",activa:r.activa}}
  function azar(q,used){var o=[],M=99999999,b=new Uint32Array(1),t=0;
    while(o.length<q){if(++t>q*20+200)throw err("sin_numeros_libres");crypto.getRandomValues(b);var n=1+b[0]%M;if(!used.has(n)){used.add(n);o.push(n)}}
    return o.sort(function(a,b){return a-b})}
  function usados(s,rid){var u=new Set();s.res.forEach(function(r){if((r.rid||"")===rid&&act(r))r.nums.forEach(function(n){u.add(n)})});return u}
  window.DBLocal={
    modo:"local",
    async cargarPublico(){var s=venc(rd());return{precio:s.cfg.precio,txt:s.cfg.txt||{},imagenes:s.cfg.imagenes||{},rifas:s.rifas.filter(function(r){return r.activa}).map(function(r){return rifaOut(s,r)})}},
    async rifasAdmin(){admin();var s=rd();return s.rifas.map(function(r){return rifaOut(s,r)})},
    async proponer(rid,q){var s=venc(rd());q=parseInt(q);if(!(q>=1&&q<=1000))throw err("cantidad_invalida");return azar(q,usados(s,rid||""))},
    async crearReserva(cel,rid,nums){
      var s=venc(rd());cel=cel10(cel);rid=rid||"";var q=(nums||[]).length;
      if(!(q>=1&&q<=1000))throw err("cantidad_invalida");
      var u=usados(s,rid);if(nums.some(function(n){return!(n>=1&&n<=99999999)||u.has(n)})||new Set(nums).size!==q)throw err("numeros_ocupados");
      var precio=s.cfg.precio,nom=(s.cfg.txt&&s.cfg.txt.nombre)||"La Bolita Jalisciense";
      if(rid){var R=s.rifas.filter(function(r){return r.id===rid&&r.activa})[0];if(!R)throw err("rifa_no_disponible");precio=R.precio;nom=R.nombre}
      var r={id:"id"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),code:"BJ-"+Math.random().toString(16).slice(2,12).toUpperCase(),cel:cel,q:q,p:precio,t:Math.round(precio*q*100)/100,nums:nums.slice().sort(function(a,b){return a-b}),ts:Date.now(),estado:"pendiente",rid:rid,rn:rid?nom:"",cp:0,cpath:"",vts:0};
      s.res.push(r);wr(s);return clone(r)},
    async misReservas(cel){var s=venc(rd());cel=cel10(cel);return clone(s.res.filter(function(r){return r.cel===cel}))},
    async subirComprobante(cel,code,blob,ext){
      var s=venc(rd());cel=cel10(cel);var r=s.res.filter(function(x){return x.code===code&&x.cel===cel})[0];
      if(!r||r.estado!=="pendiente")throw err("reserva_no_acepta_comprobante");
      s.files["p_"+code]={d:await toData(blob),tipo:ext==="pdf"?"pdf":"image"};
      r.estado="revision";r.cp=Date.now();r.cpath="p_"+code;wr(s)},
    async login(email,pw){if(email==="admin@demo.test"&&pw===(localStorage.getItem("bjl_pw")||"demo1234")){localStorage.setItem(ADM,"1");return}throw err("credenciales","Correo o contraseña incorrectos.")},
    async logout(){localStorage.removeItem(ADM)},
    async cambiarPassword(pw){admin();localStorage.setItem("bjl_pw",pw)},
    async esAdmin(){try{return localStorage.getItem(ADM)==="1"}catch(e){return false}},
    async adminReservas(){admin();return clone(venc(rd()).res)},
    async setEstado(code,e){admin();if(["validado","rechazado","liberada"].indexOf(e)<0)throw err("estado_invalido");
      var s=venc(rd()),r=s.res.filter(function(x){return x.code===code})[0];if(!r)throw err("no_encontrada");
      r.estado=e;if(e==="validado"&&!r.vts)r.vts=Date.now();wr(s)},
    async comprobanteUrl(r){admin();var f=rd().files[r.cpath];return f?{url:f.d,tipo:f.tipo}:null},
    async guardarConfig(c){admin();var s=rd();s.cfg=clone(c);s.hist.push({ts:Date.now(),cfg:clone(c)});s.hist=s.hist.slice(-30);wr(s)},
    async historial(){admin();return clone(rd().hist.slice(-10).reverse())},
    async subirImagen(blob){admin();return toData(blob)},
    async crearRifa(d,media){admin();var s=rd(),r={id:"id"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),nombre:d.nombre,premio:d.premio,descr:d.descr,fecha:d.fecha,precio:d.precio,m:media?media.t:"",activa:true};
      if(media)s.files[r.id]=await toData(media.file);s.rifas.push(r);wr(s);return rifaOut(s,r)},
    async exportar(){admin();var s=venc(rd());return clone({configuracion:s.cfg,rifas:s.rifas.map(function(r){var o=rifaOut(s,r);o.url="";return o}),historial:s.hist,reservas:s.res})},
    async liberarRevision(){admin();var s=venc(rd()),n=0;s.res.forEach(function(r){if(r.estado==="revision"){r.estado="liberada";n++}});wr(s);return n},
    async restaurarListo(){admin();return true},
    async restaurarRifas(lista){admin();var s=rd(),n=0;(lista||[]).forEach(function(r){
        if(!r||!r.id||!r.nombre||!(Number(r.precio)>0)||s.rifas.some(function(x){return x.id===r.id}))return;
        s.rifas.push({id:r.id,nombre:r.nombre,premio:r.premio||"",descr:r.descr||"",fecha:r.fecha||"",precio:Number(r.precio),m:r.m||"",activa:r.activa!==false});n++});
      wr(s);return n},
    async restaurarReservas(lista){
      admin();var s=venc(rd()),t={insertadas:0,existentes:0,conflictos:[],sin_rifa:[],errores:[]};
      lista.forEach(function(r){
        if(s.res.some(function(x){return x.code===r.code})){t.existentes++;return}
        if(r.rid&&!s.rifas.some(function(x){return x.id===r.rid})){t.sin_rifa.push(r.code);return}
        var e=r.estado==="pagado"?"validado":r.estado;if(["pendiente","revision","validado","rechazado","liberada","expirada"].indexOf(e)<0)e="liberada";
        if(e==="pendiente"&&Date.now()-r.ts>DAY)e="expirada";
        if(act({estado:e})){var u=usados(s,r.rid||"");if(r.nums.some(function(n){return u.has(n)})){t.conflictos.push(r.code);return}}
        s.res.push({id:"id"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),code:r.code,cel:r.cel,q:r.nums.length,p:r.p,t:r.t,nums:r.nums.slice().sort(function(a,b){return a-b}),ts:r.ts,estado:e,rid:r.rid||"",rn:r.rid?(r.rn||""):"",cp:r.cp||0,cpath:r.cpath||"",vts:r.vts||0});t.insertadas++
      });
      wr(s);return t},
    async restaurarComprobante(cpath,blob){admin();var s=rd();if(s.files[cpath])return"existe";s.files[cpath]={d:await toData(blob),tipo:/\.pdf$/i.test(cpath)?"pdf":"image"};wr(s);return"ok"},
    async archivarRifa(id){admin();var s=rd();s.rifas.forEach(function(r){if(r.id===id)r.activa=false});wr(s)}
  }
})();

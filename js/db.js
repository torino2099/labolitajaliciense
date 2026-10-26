/* Capa de datos. Si js/config.js trae supabaseUrl y supabaseAnonKey se usa Supabase;
   si no, se usa el modo demostración (js/db-local.js). Todo el acceso a datos pasa por window.DB. */
(function(){
  var C=window.BJ_CONFIG||{};
  if(!(C.supabaseUrl&&C.supabaseAnonKey&&window.supabase&&window.supabase.createClient)){window.DB=window.DBLocal;return}
  var sb=window.supabase.createClient(C.supabaseUrl,C.supabaseAnonKey);
  function ok(r){if(r.error){var e=new Error(r.error.message||"Error de base de datos");e.code=String(r.error.message||"").trim();throw e}return r.data}
  function pub(b,p){return sb.storage.from(b).getPublicUrl(p).data.publicUrl}
  function ms(x){return x?Date.parse(x):0}
  function mapRes(x){return{id:x.id,code:x.codigo,cel:x.celular,q:x.cantidad,p:Number(x.precio_unit),t:Number(x.total),
    nums:(x.nums||(x.boletos||[]).map(function(b){return b.numero})).slice().sort(function(a,b){return a-b}),
    ts:ms(x.creada),estado:x.estado,rid:x.rifa_id||"",rn:x.rifa_id?(x.rifa_nombre||""):"",cp:ms(x.comprobante_subido),cpath:x.comprobante_path||"",vts:ms(x.validada)}}
  function mapRifa(r){return{id:r.id,nombre:r.nombre,premio:r.premio||"",descr:r.descr||"",fecha:r.fecha||"",precio:Number(r.precio),
    m:r.media_tipo||"",url:r.media_path?pub("rifa-assets",r.media_path):"",activa:r.activa}}
  function rnd(){return Math.random().toString(36).slice(2,10)}
  window.DB={
    modo:"supabase",
    async cargarPublico(){
      var c=ok(await sb.from("configuracion").select("precio,txt,imagenes").eq("id",1).single());
      var r=ok(await sb.from("rifas").select("*").eq("activa",true).order("creada"));
      return{precio:Number(c.precio),txt:c.txt||{},imagenes:c.imagenes||{},rifas:r.map(mapRifa)}
    },
    async rifasAdmin(){return ok(await sb.from("rifas").select("*").order("creada")).map(mapRifa)},
    async proponer(rid,q){return ok(await sb.rpc("proponer_numeros",{p_rifa:rid||null,p_cantidad:q}))},
    async crearReserva(cel,rid,nums){return mapRes(ok(await sb.rpc("crear_reserva",{p_cel:cel,p_rifa:rid||null,p_nums:nums})))},
    async misReservas(cel){return ok(await sb.rpc("mis_reservas",{p_cel:cel})).map(mapRes)},
    async subirComprobante(cel,code,blob,ext){
      var path=code+"/"+Date.now()+"."+ext;
      ok(await sb.storage.from("comprobantes").upload(path,blob,{contentType:blob.type||(ext==="pdf"?"application/pdf":"image/jpeg"),upsert:false}));
      ok(await sb.rpc("registrar_comprobante",{p_cel:cel,p_codigo:code,p_path:path}))
    },
    async login(email,pw){ok(await sb.auth.signInWithPassword({email:email,password:pw}))},
    async cambiarPassword(pw){ok(await sb.auth.updateUser({password:pw}))},
    async logout(){await sb.auth.signOut()},
    async esAdmin(){
      var s=(await sb.auth.getSession()).data.session;if(!s)return false;
      var r=await sb.from("admins").select("user_id").eq("user_id",s.user.id).maybeSingle();return!!(r.data)
    },
    async adminReservas(){
      await sb.rpc("liberar_vencidas");
      var out=[],from=0,step=1000;
      for(;;){var d=ok(await sb.from("reservas").select("*,boletos(numero)").order("creada",{ascending:false}).range(from,from+step-1));
        out=out.concat(d);if(d.length<step||from>=19000)break;from+=step}
      return out.map(mapRes).reverse()
    },
    async setEstado(code,e){ok(await sb.from("reservas").update({estado:e}).eq("codigo",code))},
    async comprobanteUrl(r){
      var d=ok(await sb.storage.from("comprobantes").createSignedUrl(r.cpath,300));
      return{url:d.signedUrl,tipo:/\.pdf$/i.test(r.cpath)?"pdf":"image"}
    },
    async guardarConfig(c){
      ok(await sb.from("configuracion").update({precio:c.precio,txt:c.txt,imagenes:c.imagenes,actualizada:new Date().toISOString()}).eq("id",1));
      ok(await sb.from("config_historial").insert({precio:c.precio,txt:c.txt,imagenes:c.imagenes}))
    },
    async historial(){
      return ok(await sb.from("config_historial").select("*").order("creada",{ascending:false}).limit(10))
        .map(function(h){return{ts:ms(h.creada),cfg:{precio:Number(h.precio),txt:h.txt||{},imagenes:h.imagenes||{}}}})
    },
    async subirImagen(blob,ext,clave){
      var path="site/"+clave+"-"+Date.now()+"."+ext;
      ok(await sb.storage.from("rifa-assets").upload(path,blob,{contentType:blob.type||"image/jpeg",upsert:false}));
      return pub("rifa-assets",path)
    },
    async crearRifa(d,media){
      var row={nombre:d.nombre,premio:d.premio||null,descr:d.descr||null,fecha:d.fecha||null,precio:d.precio};
      if(media){var path="rifas/"+rnd()+"-"+Date.now()+"."+media.ext;
        ok(await sb.storage.from("rifa-assets").upload(path,media.file,{contentType:media.file.type||(media.t==="video"?"video/mp4":"image/jpeg"),upsert:false}));
        row.media_tipo=media.t;row.media_path=path}
      return mapRifa(ok(await sb.from("rifas").insert(row).select().single()))
    },
    async archivarRifa(id){ok(await sb.from("rifas").update({activa:false}).eq("id",id))}
  }
})();

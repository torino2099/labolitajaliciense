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
    m:r.media_tipo||"",url:r.media_path?pub("rifa-assets",r.media_path):"",activa:r.activa,desde:r.num_desde||1,hasta:r.num_hasta||99999999}}
  function rnd(){return Math.random().toString(36).slice(2,10)}
  window.DB={
    modo:"supabase",
    async cargarPublico(){
      var c=ok(await sb.from("configuracion").select("*").eq("id",1).single());
      var r=ok(await sb.from("rifas").select("*").eq("activa",true).order("creada"));
      return{precio:Number(c.precio),txt:c.txt||{},imagenes:c.imagenes||{},desde:c.num_desde||1,hasta:c.num_hasta||99999999,rifas:r.map(mapRifa)}
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
      if(d.desde&&d.hasta&&(d.desde!==1||d.hasta!==99999999)){row.num_desde=d.desde;row.num_hasta=d.hasta}
      var ins=await sb.from("rifas").insert(row).select().single();
      if(ins.error&&/num_desde|num_hasta/.test(String(ins.error.message||""))){var e=new Error("falta_rangos_sql");e.code="falta_rangos_sql";throw e}
      return mapRifa(ok(ins))
    },
    async exportar(){
      var cfg=ok(await sb.from("configuracion").select("*").eq("id",1).single());
      var rifas=ok(await sb.from("rifas").select("*").order("creada"));
      var hist=ok(await sb.from("config_historial").select("*").order("creada"));
      return{configuracion:cfg,rifas:rifas,historial:hist,reservas:await window.DB.adminReservas()}
    },
    async liberarRevision(){
      var d=ok(await sb.from("reservas").update({estado:"liberada"}).eq("estado","revision").select("id"));
      return d.length
    },
    async restaurarListo(){
      var r=await sb.rpc("admin_restaurar_reservas",{p_reservas:[]});
      if(r.error){var m=String(r.error.message||"");if(/Could not find the function|PGRST202|does not exist/i.test(m+" "+(r.error.code||"")))return false;ok(r)}
      return true
    },
    async restaurarRifas(lista){
      var ex={};ok(await sb.from("rifas").select("id")).forEach(function(r){ex[r.id]=1});
      var rows=[];
      (lista||[]).forEach(function(r){
        if(!r||!/^[0-9a-f-]{36}$/i.test(r.id||"")||ex[r.id]||!r.nombre||!(Number(r.precio)>0))return;
        rows.push({id:r.id,nombre:String(r.nombre).slice(0,120),premio:r.premio||null,descr:r.descr||null,fecha:r.fecha||null,precio:Number(r.precio),
          media_tipo:(r.media_tipo||r.m)||null,media_path:r.media_path||null,activa:r.activa!==false,creada:r.creada||undefined});
        var d0=r.num_desde||r.desde,h0=r.num_hasta||r.hasta;
        if(d0&&h0&&(d0!==1||h0!==99999999)){rows[rows.length-1].num_desde=d0;rows[rows.length-1].num_hasta=h0}
      });
      if(rows.length)ok(await sb.from("rifas").insert(rows));
      return rows.length
    },
    async restaurarReservas(lista){
      var tot={insertadas:0,existentes:0,conflictos:[],sin_rifa:[],errores:[]};
      for(var i=0;i<lista.length;i+=40){
        var d=ok(await sb.rpc("admin_restaurar_reservas",{p_reservas:lista.slice(i,i+40)}));
        tot.insertadas+=d.insertadas;tot.existentes+=d.existentes;
        tot.conflictos=tot.conflictos.concat(d.conflictos);tot.sin_rifa=tot.sin_rifa.concat(d.sin_rifa);tot.errores=tot.errores.concat(d.errores)
      }
      return tot
    },
    async restaurarComprobante(cpath,blob){
      var r=await sb.storage.from("comprobantes").upload(cpath,blob,{contentType:blob.type||"image/jpeg",upsert:false});
      if(r.error){if(/already exists|Duplicate/i.test(String(r.error.message||"")))return"existe";ok(r)}
      return"ok"
    },
    async cambiarRango(rid,d,h){
      var r=await sb.rpc("admin_cambiar_rango",{p_rifa:rid||null,p_desde:d,p_hasta:h});
      if(r.error&&/Could not find the function|PGRST202/.test(String(r.error.message||"")+" "+(r.error.code||""))){var e=new Error("falta_rangos_sql");e.code="falta_rangos_sql";throw e}
      ok(r)
    },
    async archivarRifa(id){ok(await sb.from("rifas").update({activa:false}).eq("id",id))}
  }
})();

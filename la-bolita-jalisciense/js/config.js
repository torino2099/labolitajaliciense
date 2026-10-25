/* Configuración del administrador.
   adminTel: celular (10 dígitos) que abre el panel de administración.
   adminHash: SHA-256 de la contraseña. Para generarlo en una terminal:
       printf '%s' 'TU_CONTRASEÑA' | sha256sum
   IMPORTANTE: si el repositorio es público, este hash lo ve cualquiera.
   Usa una contraseña larga o mantén el repositorio privado. */
window.BJ_CONFIG={
  adminTel:"3325941532",
  adminHash:"21bd63e6381b57eb81eaa689a5539577384dc501659b2d7194fde971a8498379"
};

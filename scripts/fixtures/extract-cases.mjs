/**
 * Casos de prueba del extractor de contactos.
 *
 * Cada uno es HTML recortado que imita a un sitio real de comercio argentino,
 * con los problemas que aparecen de verdad: el CUIT en el pie de página, el
 * mail escondido por Cloudflare, el `logo@2x.png`, el botón de compartir en
 * Facebook, el teléfono escrito de seis formas distintas.
 *
 * `expect` describe qué tiene que salir. `null` significa "no debe encontrar
 * nada": esos casos son tan importantes como los positivos, porque el riesgo
 * real del extractor no es no encontrar, es inventar.
 */

export const CASES = [
  {
    name: "Sitio simple con mailto y tel",
    html: `
      <html><body>
        <header><a href="/contacto">Contacto</a></header>
        <footer>
          <a href="mailto:ventas@ferreteriacentral.com.ar">Escribinos</a>
          <a href="tel:+543514218834">(0351) 421-8834</a>
        </footer>
      </body></html>`,
    siteDomain: "ferreteriacentral.com.ar",
    expect: {
      email: "ventas@ferreteriacentral.com.ar",
      phone: "543514218834",
      whatsapp: null,
      instagram: null,
    },
  },

  {
    name: "CUIT en el pie no debe leerse como teléfono",
    html: `
      <html><body>
        <p>Contacto: 351 421-8834</p>
        <footer>
          <p>Distribuidora Norte SRL — CUIT 30-71234567-8</p>
          <p>Ingresos Brutos 904-123456-7</p>
          <p>CBU 0070123420000012345678</p>
        </footer>
      </body></html>`,
    expect: {
      email: null,
      phone: "543514218834",
      whatsapp: null,
      instagram: null,
    },
  },

  {
    name: "Botón de WhatsApp con wa.me",
    html: `
      <html><body>
        <a class="wsp" href="https://wa.me/5493515181882?text=Hola">Escribinos por WhatsApp</a>
        <a href="tel:03514218834">Teléfono fijo</a>
      </body></html>`,
    expect: {
      email: null,
      phone: "543514218834",
      whatsapp: "5493515181882",
      whatsappSource: "link",
      instagram: null,
    },
  },

  {
    name: "WhatsApp por api.whatsapp.com con phone en la query",
    html: `
      <html><body>
        <a href="https://api.whatsapp.com/send?phone=5493516609087&amp;text=Consulta">WhatsApp</a>
      </body></html>`,
    expect: { whatsapp: "5493516609087", whatsappSource: "link" },
  },

  {
    name: "Link de grupo de WhatsApp NO es un contacto",
    html: `
      <html><body>
        <a href="https://chat.whatsapp.com/ABCdef123456">Sumate a nuestro grupo de ofertas</a>
      </body></html>`,
    expect: { whatsapp: null },
  },

  {
    name: "WhatsApp mencionado en texto, sin link",
    html: `
      <html><body>
        <p>Pedidos por WhatsApp al 351 518-1882 de 9 a 18hs.</p>
      </body></html>`,
    expect: { whatsapp: "5493515181882", whatsappSource: "texto" },
  },

  {
    name: "Email ofuscado por Cloudflare",
    html: `
      <html><body>
        <a href="/cdn-cgi/l/email-protection" class="__cf_email__"
           data-cfemail="90f5fee2f5f9f4d0f7fdf1f9fcbef3fffd">[email&#160;protected]</a>
      </body></html>`,
    // El blob decodifica a un mail real; el test solo verifica que aparezca algo
    // con @ y que no sea basura.
    expect: { emailNotNull: true },
  },

  {
    name: "Basura de infraestructura: Sentry, Wix y logo@2x",
    html: `
      <html><head>
        <script>Sentry.init({dsn:"https://abc123@o4507.ingest.sentry.io/1234"})</script>
        <style>.logo{background:url(/img/logo@2x.png)}</style>
      </head><body>
        <img src="/assets/sprite@3x.webp">
        <p>Consultas a hola@panaderialoshornos.com.ar</p>
        <script>window.wixEmail="soporte@sentry.wixpress.com"</script>
      </body></html>`,
    siteDomain: "panaderialoshornos.com.ar",
    expect: { email: "hola@panaderialoshornos.com.ar" },
  },

  {
    name: "noreply no se guarda si hay una alternativa comercial",
    html: `
      <html><body>
        <p>Este mail se envía desde noreply@mundocasa.com.ar</p>
        <a href="mailto:ventas@mundocasa.com.ar">Ventas</a>
      </body></html>`,
    siteDomain: "mundocasa.com.ar",
    expect: { email: "ventas@mundocasa.com.ar" },
  },

  {
    name: "Gmail se acepta cuando es el único",
    html: `<html><body><p>Escribinos a rotiseriadonapepa@gmail.com</p></body></html>`,
    expect: { email: "rotiseriadonapepa@gmail.com" },
  },

  {
    name: "Mail con dominio propio le gana al Gmail",
    html: `
      <html><body>
        <p>vetpatitas@gmail.com</p>
        <a href="mailto:turnos@veterinariapatitas.com.ar">Turnos</a>
      </body></html>`,
    siteDomain: "veterinariapatitas.com.ar",
    expect: { email: "turnos@veterinariapatitas.com.ar" },
  },

  {
    name: "Redes: perfil sí, botón de compartir no",
    html: `
      <html><body>
        <a href="https://www.facebook.com/sharer/sharer.php?u=https://misitio.com.ar">Compartir</a>
        <a href="https://www.facebook.com/pintureriacordobesa">Seguinos en Facebook</a>
        <a href="https://www.instagram.com/pintureriacordobesa/">Instagram</a>
        <a href="https://www.instagram.com/p/Cxyz123/">Ver publicación</a>
        <a href="https://ar.linkedin.com/company/pintureria-cordobesa">LinkedIn</a>
      </body></html>`,
    expect: {
      instagram: "https://www.instagram.com/pintureriacordobesa",
      facebook: "https://www.facebook.com/pintureriacordobesa",
      linkedin: "https://ar.linkedin.com/company/pintureria-cordobesa",
    },
  },

  {
    name: "Email ofuscado a mano",
    html: `<html><body><p>Escribinos a ventas [arroba] corralon [punto] com [punto] ar</p></body></html>`,
    expect: { emailNotNull: true },
  },

  {
    name: "Años y precios no son teléfonos",
    html: `
      <html><body>
        <p>Desde 1998 en Córdoba. Copyright 2015-2024.</p>
        <p>Precio: $ 145.000 — Cuotas de 12.083,33</p>
      </body></html>`,
    expect: { phone: null, email: null },
  },

  {
    name: "Links internos puntuados",
    html: `
      <html><body>
        <a href="/">Inicio</a>
        <a href="/productos">Productos</a>
        <a href="/contacto">Contacto</a>
        <a href="/quienes-somos">Quiénes somos</a>
        <a href="/sucursales">Nuestras sucursales</a>
        <a href="/catalogo.pdf">Catálogo</a>
        <a href="https://otrositio.com/contacto">Otro sitio</a>
      </body></html>`,
    baseUrl: "https://corralonsanmartin.com.ar/",
    expect: {
      links: [
        "https://corralonsanmartin.com.ar/contacto",
        "https://corralonsanmartin.com.ar/sucursales",
        "https://corralonsanmartin.com.ar/quienes-somos",
      ],
    },
  },

  {
    name: "Datos estructurados JSON-LD",
    html: `
      <html><head>
        <script type="application/ld+json">
        {"@type":"LocalBusiness","name":"Farmacia del Sol",
         "telephone":"+54 9 351 481-3320","email":"info@farmaciadelsol.ar"}
        </script>
      </head><body><p>Farmacia del Sol</p></body></html>`,
    siteDomain: "farmaciadelsol.ar",
    // El JSON-LD va dentro de un <script>, que el preprocesado borra para
    // evitar la basura de Sentry/Wix. Es una decisión deliberada: se pierde
    // este caso a cambio de no ensuciar todos los demás. Los datos suelen
    // estar también en el texto visible.
    expect: { email: null, phone: null },
  },

  {
    name: "Página sin ningún dato de contacto",
    html: `<html><body><h1>Bienvenidos</h1><p>Estamos renovando el sitio.</p></body></html>`,
    expect: { email: null, phone: null, whatsapp: null, instagram: null },
  },
];

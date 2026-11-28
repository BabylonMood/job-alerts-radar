# Radar de empleo

[English](README.md) · [Español](README.es.md)

Las ofertas nuevas llegan repartidas en cinco portales y en mails de alerta que nadie revisa a tiempo. Radar de empleo junta esas alertas en una casilla dedicada, las limpia, las filtra por palabras clave y publica un único dashboard estático. Está pensado para personas que buscan trabajo y equipos que coordinan una búsqueda compartida, sin scrapear portales ni violar sus términos. Un script en Python lee la casilla por IMAP, ignora acentos y mayúsculas, sanea URLs y tokens, escribe `jobs.json`, y GitHub Actions actualiza el sitio en GitHub Pages cada 30 minutos. El resultado es un pipeline sin scraping, hecho con Python, IMAP, GitHub Actions y HTML/JS estático, que además genera borradores de postulación sin enviarlos.

## Cómo funciona

1. Creá una casilla dedicada, activá verificación en dos pasos y generá una contraseña de aplicación.
2. Activá alertas por mail en LinkedIn, Computrabajo, Bumeran, ZonaJobs e Indeed, todas hacia esa casilla.
3. Copiá `config.example.json` a `config.json` y completá `imap_user`, `senders`, `keywords_include` y `keywords_exclude`. El matching ignora acentos y mayúsculas.
4. Guardá la contraseña de aplicación como secreto de GitHub Actions y programá el workflow.
5. El dashboard en `index.html` lee `jobs.json` y muestra cada oferta con su porcentaje de match.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `scan_email.py` | Lectura IMAP, parseo, filtros y saneamiento |
| `config.example.json` | Plantilla de configuración |
| `jobs.json` | Feed generado que consume el dashboard |
| `index.html` | Dashboard estático publicado en GitHub Pages |

## Privacidad

No se scrappea ningún portal. Los tokens y datos personales se quitan antes de escribir cualquier archivo, y el borrador se genera solo en local: el script nunca envía una postulación.

[Read in English](README.md)

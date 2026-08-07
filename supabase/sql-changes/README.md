# Cambios de SQL

Cada vez que hay que tocar la base de datos, va un archivo nuevo acá, numerado en orden (`003_...`, `004_...`). Copiar el contenido, pegarlo en Supabase Dashboard → SQL Editor, y correrlo.

`schema.sql` (un nivel arriba) sigue siendo la referencia completa acumulada — sirve para armar una base desde cero. Esta carpeta es para ir corriendo los cambios de a uno, sin tener que buscar dentro de `schema.sql` cuál es el bloque nuevo.
